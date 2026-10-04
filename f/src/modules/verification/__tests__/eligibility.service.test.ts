import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FakeCache } from "./test-helper";
import { verificationEligibilityService } from "../services/eligibility.service";
import { VerificationPlatform, VerificationStatus } from "@prisma/client";

describe("Eligibility Service", () => {
  let fakeCache: FakeCache;

  // Mutable fixtures
  let activeTasksFixture: any[];
  let uvtFixture: any;
  let verifyUserTaskCalls: Array<{ userId: string; taskId: string; canUseCache?: boolean }>;
  let verifyUserTaskResult: any;

  let originals: Record<string, any>;

  beforeEach(() => {
    fakeCache = new FakeCache();
    verifyUserTaskCalls = [];
    verifyUserTaskResult = { status: VerificationStatus.VERIFIED };

    activeTasksFixture = [
      {
        id: "task-1",
        title: "Telegram Verify",
        platform: VerificationPlatform.TELEGRAM,
        isActive: true,
        channelIdentifier: "chat-1",
      },
    ];
    uvtFixture = null; // default: no verification record

    originals = {
      verificationTaskRepository: (verificationEligibilityService as any).verificationTaskRepository,
      userVerificationTaskRepository: (verificationEligibilityService as any).userVerificationTaskRepository,
      verificationService: (verificationEligibilityService as any).verificationService,
      cacheService: (verificationEligibilityService as any).cacheService,
    };

    (verificationEligibilityService as any).verificationTaskRepository = {
      findActive: async () => activeTasksFixture,
      findActiveByPlatform: async () => activeTasksFixture,
    };
    (verificationEligibilityService as any).userVerificationTaskRepository = {
      findByUserAndTask: async () => uvtFixture,
      findByUser: async () => (uvtFixture ? [uvtFixture] : []),
      countVerifiedByUserAndPlatform: async () => 0,
    };
    (verificationEligibilityService as any).verificationService = {
      verifyUserTask: async (userId: string, taskId: string, canUseCache?: boolean) => {
        verifyUserTaskCalls.push({ userId, taskId, canUseCache });
        return verifyUserTaskResult;
      },
    };
    (verificationEligibilityService as any).cacheService = fakeCache;
  });

  afterEach(() => {
    Object.assign(verificationEligibilityService as any, originals);
    fakeCache.clear();
  });

  it("MISSING required verification record -> task added to failedTasks (I.5)", async () => {
    uvtFixture = null; // no UserVerificationTask for user-1/task-1

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");

    const failed = result.failedTasks.find((t: any) => t.taskId === "task-1");
    assert.ok(failed, "missing required verification must be in failedTasks");
    assert.equal(failed.platform, VerificationPlatform.TELEGRAM);
    assert.equal(result.eligible, false, "missing record must never be eligible");
    assert.equal(verifyUserTaskCalls.length, 0, "missing record must fail BEFORE any live check");
  });

  it("REJECTED verification record -> task added to failedTasks", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.REJECTED,
    };

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");

    const failed = result.failedTasks.find((t: any) => t.taskId === "task-1");
    assert.ok(failed, "rejected verification must be in failedTasks");
    assert.equal(result.eligible, false);
  });

  it("REVOKED verification record -> task added to failedTasks", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.REVOKED,
    };

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");
    assert.equal(result.eligible, false);
    assert.ok(result.failedTasks.some((t: any) => t.taskId === "task-1"));
  });

  it("VERIFIED record -> claim gate performs a LIVE check with canUseCache=false (I.3/I.4)", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
    };
    verifyUserTaskResult = { status: VerificationStatus.VERIFIED };

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");

    assert.equal(result.eligible, true);
    assert.equal(verifyUserTaskCalls.length, 1, "verified record must be live-reverified before claim");
    assert.equal(verifyUserTaskCalls[0].canUseCache, false, "claim gate must bypass cache");
    assert.equal(verifyUserTaskCalls[0].userId, "user-1");
    assert.equal(verifyUserTaskCalls[0].taskId, "task-1");
  });

  it("STALE cached VERIFIED cannot hide a lost membership (I.4)", async () => {
    // Stale "eligible" cache entry — must be ignored by verifyBeforeClaim
    await fakeCache.set("verification:eligibility:user-1", {
      eligible: true,
      failedTasks: [],
    } as any, 300);

    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
    };
    // Live check discovers membership is gone
    verifyUserTaskResult = { status: VerificationStatus.REVOKED };

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");

    assert.equal(result.eligible, false, "cached eligible must NOT override the live check");
    assert.ok(result.failedTasks.some((t: any) => t.taskId === "task-1"));
  });

  it("live check failure (thrown error) fails closed -> not eligible", async () => {
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
    };
    (verificationEligibilityService as any).verificationService = {
      verifyUserTask: async () => {
        throw new Error("Telegram API unavailable");
      },
    };

    const result = await verificationEligibilityService.verifyBeforeClaim("user-1");

    assert.equal(result.eligible, false, "provider errors must fail the claim gate closed");
  });

  it("checkEligibility: missing record -> not eligible; verified -> eligible", async () => {
    // Missing record
    uvtFixture = null;
    let result = await verificationEligibilityService.checkEligibility("user-1");
    assert.equal(result.eligible, false);
    assert.ok(result.failedTasks.includes("task-1"));

    // Cache from the previous call must not leak into a fresh check
    fakeCache.clear();

    // Verified record
    uvtFixture = {
      id: "uv-1",
      userId: "user-1",
      verificationTaskId: "task-1",
      status: VerificationStatus.VERIFIED,
    };
    result = await verificationEligibilityService.checkEligibility("user-1");
    assert.equal(result.eligible, true);
  });

  it("checkEligibility returns cached result when present (optionally)", async () => {
    await fakeCache.set("verification:eligibility:user-1", {
      eligible: true,
      failedTasks: [],
    } as any, 300);

    const result = await verificationEligibilityService.checkEligibility("user-1");
    assert.equal(result.eligible, true);
  });
});
