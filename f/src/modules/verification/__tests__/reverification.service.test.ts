import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { reverificationService } from "../services/reverification.service";
import { VerificationPlatform, VerificationStatus } from "@prisma/client";

describe("Reverification Service (batch counters)", () => {
  let verifiedRecords: any[];
  let reverificationResults: Map<string, { status: VerificationStatus; changed: boolean } | Error>;

  let originals: Record<string, any>;

  beforeEach(() => {
    verifiedRecords = [
      {
        id: "uv-1",
        userId: "user-1",
        verificationTaskId: "task-1",
        status: VerificationStatus.VERIFIED,
        verifiedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      } as any,
    ];
    reverificationResults = new Map();

    originals = {
      userVerificationTaskRepository: (reverificationService as any).userVerificationTaskRepository,
      verificationTaskRepository: (reverificationService as any).verificationTaskRepository,
      verificationService: (reverificationService as any).verificationService,
    };

    (reverificationService as any).userVerificationTaskRepository = {
      findAllVerified: async () => verifiedRecords,
      findByUserAndTask: async (userId: string) =>
        verifiedRecords.find((r) => r.userId === userId) ?? null,
    };
    (reverificationService as any).verificationTaskRepository = {
      findActive: async () => [
        {
          id: "task-1",
          title: "Telegram Verify",
          platform: VerificationPlatform.TELEGRAM,
          isActive: true,
        },
      ],
    };
    (reverificationService as any).verificationService = {
      // Simulates one live reverification per record (the real live-check
      // behaviour is covered by verification.service tests).
      reverificationCheck: async (userId: string, _taskId: string) => {
        const outcome = reverificationResults.get(userId);
        if (outcome instanceof Error) throw outcome;
        if (outcome) return outcome;
        return { status: VerificationStatus.VERIFIED, changed: false };
      },
    };
  });

  afterEach(() => {
    Object.assign(reverificationService as any, originals);
  });

  it("counter increments only on ACTUAL membership change (I.6) — never on a plain read", async () => {
    // user-1: still VERIFIED, no change (equivalent to a cache-hit result)
    reverificationResults.set("user-1", { status: VerificationStatus.VERIFIED, changed: false });

    const batch = await reverificationService.reverificationBatch("task-1");

    assert.equal(batch.total, 1);
    assert.equal(batch.verified, 0, "no actual change → verified counter must stay 0");
    assert.equal(batch.revoked, 0, "no actual change → revoked counter must stay 0");
    assert.equal(batch.failed, 0);
  });

  it("actual membership loss increments ONLY the revoked counter (I.6)", async () => {
    reverificationResults.set("user-1", { status: VerificationStatus.REVOKED, changed: true });

    const batch = await reverificationService.reverificationBatch("task-1");

    assert.equal(batch.total, 1);
    assert.equal(batch.revoked, 1, "must count a real membership loss as revoked");
    assert.equal(batch.verified, 0);
    assert.equal(batch.failed, 0);
    assert.equal(batch.results[0].newStatus, VerificationStatus.REVOKED);
    assert.equal(batch.results[0].changed, true);
  });

  it("returning membership increments ONLY the verified counter", async () => {
    verifiedRecords[0].status = VerificationStatus.REVOKED;
    reverificationResults.set("user-1", { status: VerificationStatus.VERIFIED, changed: true });

    const batch = await reverificationService.reverificationBatch("task-1");

    assert.equal(batch.total, 1);
    assert.equal(batch.verified, 1, "REVOKED → VERIFIED is a real change");
    assert.equal(batch.revoked, 0);
    assert.equal(batch.failed, 0);
  });

  it("a failed reverification counts as failed and does not corrupt other counters", async () => {
    reverificationResults.set("user-1", new Error("Telegram API unavailable"));

    const batch = await reverificationService.reverificationBatch("task-1");

    assert.equal(batch.total, 1);
    assert.equal(batch.failed, 1);
    assert.equal(batch.verified, 0);
    assert.equal(batch.revoked, 0);
    assert.match(String(batch.results[0].error), /Telegram API unavailable/);
  });

  it("re-verification with no records returns zero counters", async () => {
    verifiedRecords = [];

    const batch = await reverificationService.reverificationBatch("task-1");

    assert.equal(batch.total, 0);
    assert.equal(batch.verified, 0);
    assert.equal(batch.revoked, 0);
    assert.equal(batch.failed, 0);
  });
});
