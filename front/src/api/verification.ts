const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://infolast.onrender.com/api/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LinkedAccount {
  platform: 'TELEGRAM' | 'X' | 'YOUTUBE' | 'DISCORD';
  platformUsername: string | null;
  verified: boolean;
  linkedAt: string;
}

export interface VerificationStatus {
  id: string;
  verificationTaskId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  task: {
    title: string;
    platform: string;
  };
}

export interface DeepLinkResult {
  deepLinkUrl: string;
  token: string;
  expiresAt: string;
}

export interface EligibilityResult {
  eligible: boolean;
  failedTasks: string[];
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.data ?? data;
}

// ─── Account Linking ─────────────────────────────────────────────────────────

export async function generateTelegramDeepLink(walletAddress: string): Promise<DeepLinkResult> {
  return apiFetch<DeepLinkResult>('/verification/link', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, platform: 'TELEGRAM' }),
  });
}

export async function getLinkedAccounts(walletAddress: string): Promise<{ accounts: LinkedAccount[] }> {
  return apiFetch(`/verification/linked-accounts?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function unlinkAccount(walletAddress: string, platform: string): Promise<void> {
  await apiFetch('/verification/unlink', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, platform }),
  });
}

// ─── Verification Status ─────────────────────────────────────────────────────

export async function getVerificationStatus(walletAddress: string): Promise<{ verifiedTasks: VerificationStatus[] }> {
  return apiFetch(`/verification/status?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export async function triggerVerification(walletAddress: string, verificationTaskId: string): Promise<{ message: string }> {
  return apiFetch('/verification/verify', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, verificationTaskId }),
  });
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

export async function checkEligibility(walletAddress: string): Promise<EligibilityResult> {
  return apiFetch(`/verification/eligibility?walletAddress=${encodeURIComponent(walletAddress)}`);
}

// ─── Verification Tasks (Admin) ──────────────────────────────────────────────

export interface VerificationTask {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  channelUrl: string | null;
  channelIdentifier: string | null;
  reward: number;
  isActive: boolean;
  createdAt: string;
}

export async function getVerificationTasks(): Promise<VerificationTask[]> {
  return apiFetch('/verification/tasks');
}
