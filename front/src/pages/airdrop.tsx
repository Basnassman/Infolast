import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { formatUnits, type Hash, zeroHash } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { CURRENT_CONTRACTS } from '@/config/contracts';
import { AIRDROP_ABI } from '@/config/abis';

const API_BASE_URL = 'https://infolast.onrender.com/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibilityData {
  walletAddress: string;
  eligible: boolean;
  amountWei: string;
  points: number;
  proof: `0x${string}`[];
  alreadyClaimed: boolean;
  message?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  platform: 'X' | 'TELEGRAM' | 'YOUTUBE' | 'ARTICLE';
  category: 'SOCIAL' | 'VIDEO' | 'ARTICLE';
  url: string;
  isActive: boolean;
}

interface UserTaskStatus {
  id: string;
  userId: string;
  taskId: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVIEW';
  rewardGiven: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatLargeNumber(value: bigint, decimals = 18): string {
  const num = parseFloat(formatUnits(value, decimals));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Ended';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseContractError(err: unknown): string {
  const msg = (
    (err as { shortMessage?: string })?.shortMessage ||
    (err as { message?: string })?.message ||
    ''
  ).toLowerCase();
  if (msg.includes('user rejected') || msg.includes('denied')) return 'Transaction rejected by user.';
  if (msg.includes('alreadyclaimed')) return 'You have already claimed your airdrop.';
  if (msg.includes('invalidproof')) return 'Invalid Merkle proof. Please contact support.';
  if (msg.includes('deadlinepassed')) return 'The claim window has ended.';
  if (msg.includes('notactive')) return 'The claim window has not started yet.';
  if (msg.includes('rootnotset')) return 'Merkle root not set yet. Please wait for announcement.';
  if (msg.includes('enforcedpause')) return 'Airdrop is currently paused.';
  if (msg.includes('finalized')) return 'Airdrop has been finalized.';
  if (msg.includes('insufficientvestingbalance')) return 'Insufficient vesting balance available.';
  if (msg.includes('exceedscap')) return 'Airdrop cap has been reached.';
  if (msg.includes('invalidamount')) return 'Invalid claim amount.';
  return 'Transaction failed. Please try again.';
}

function PlatformIcon({ platform }: { platform: Task['platform'] }) {
  const icons = {
    X: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    TELEGRAM: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    YOUTUBE: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    ARTICLE: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  };
  return icons[platform] || null;
}

function PlatformColor(platform: Task['platform']) {
  const colors = {
    X: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    TELEGRAM: 'bg-sky-900/30 text-sky-400 border-sky-700/50',
    YOUTUBE: 'bg-red-900/30 text-red-400 border-red-700/50',
    ARTICLE: 'bg-amber-900/30 text-amber-400 border-amber-700/50',
  };
  return colors[platform] || 'bg-zinc-800 text-zinc-300';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AirdropPage() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  // ── Eligibility Data ────────────────────────────────────────────────────────
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // ── Claim State ─────────────────────────────────────────────────────────────
  const [claimTxHash, setClaimTxHash] = useState<Hash | null>(null);
  const [claimStep, setClaimStep] = useState<'idle' | 'claiming' | 'waiting' | 'syncing'>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // ── Tasks State ─────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userTasks, setUserTasks] = useState<Record<string, UserTaskStatus>>({});
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [startedTasks, setStartedTasks] = useState<Set<string>>(new Set());

  // ── Contract Reads ──────────────────────────────────────────────────────────
  const { data: govLockConstant } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'GOVERNANCE_LOCK',
  });

  const { data: maxWindowExtConstant } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'MAX_WINDOW_EXTENSION',
  });

  const { data: merkleRoot } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'merkleRoot',
  });

  const { data: claimStart } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'claimStart',
  });

  const { data: claimEnd } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'claimEnd',
  });

  const { data: totalAllocated } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'totalAllocated',
  });

  const { data: maxAllocation } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'maxAllocation',
  });

  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'claimed',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: finalized } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'finalized',
  });

  const { data: isPaused } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'paused',
  });

  const { data: vestingAddress } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'vesting',
  });

  const { data: tokenAddress } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'token',
  });

  const { data: treasuryAddress } = useReadContract({
    address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: 'treasury',
  });

  // ── Write Contract ──────────────────────────────────────────────────────────
  const { writeContractAsync: claimAirdrop } = useWriteContract();

  const { isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimTxHash ?? undefined,
    query: { enabled: !!claimTxHash },
  });

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!claimEnd) return;
    const end = Number(claimEnd as bigint);
    const update = () => setCountdown(Math.max(0, end - Math.floor(Date.now() / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [claimEnd]);

  useEffect(() => {
    if (address && isConnected) {
      checkEligibility(address);
      fetchTasks();
    } else {
      setEligibility(null);
      setCheckError(null);
      setTasks([]);
      setUserTasks({});
      setStartedTasks(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  useEffect(() => {
    if (claimConfirmed && claimStep === 'waiting') {
      syncClaimWithBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimConfirmed, claimStep]);

  // ── Tasks Handlers ──────────────────────────────────────────────────────────

  const fetchTasks = async () => {
    if (!address) return;
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tasks?walletAddress=${address}`);
      
      if (!res.ok) throw new Error('Failed to fetch tasks');
      
      const data = await res.json();
      const allTasks: Task[] = data.data || [];
      const activeTasks = allTasks.filter(t => t.isActive);
      setTasks(activeTasks);

      await fetchUserTasks(activeTasks);
    } catch (err) {
      setTasksError((err as Error).message || 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchUserTasks = async (activeTasks: Task[]) => {
    if (!address || activeTasks.length === 0) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tasks/me?walletAddress=${address}`);
      
      if (res.status === 404) {
        setUserTasks({});
        return;
      }
      
      if (!res.ok) {
        console.warn('Failed to fetch user tasks:', res.status);
        return;
      }

      const data = await res.json();
      const userTasksList = data.data || [];
      const utMap: Record<string, UserTaskStatus> = {};
      userTasksList.forEach((ut: any) => {
        utMap[ut.taskId] = ut;
      });
      setUserTasks(utMap);
    } catch (err) {
      console.warn('Failed to fetch user tasks:', err);
    }
  };

  const handleStartTask = (task: Task) => {
    window.open(task.url, '_blank', 'noopener,noreferrer');
    setStartedTasks(prev => new Set(prev).add(task.id));
  };

  const handleCompleteTask = async (task: Task) => {
  if (!address) return;
  
  if (!startedTasks.has(task.id)) {
    setTasksError('⚠️ Please click "Start Task" first to open the link');
    return;
  }
  
  setCompletingTask(task.id);
  setTasksError(null);
  
  try {
    const res = await fetch(`${API_BASE_URL}/tasks/submit`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: address,
        taskId: task.id,
        proof: {},
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || 'Failed to complete task');
    }

    const data = await res.json();
    
    setUserTasks(prev => ({
      ...prev,
      [task.id]: {
        id: data.data?.id || task.id,
        userId: address,
        taskId: task.id,
        status: data.data?.status || 'REVIEW',
        rewardGiven: data.data?.rewardGiven || false,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));

    await fetchTasks();
    

  } catch (err) {
    setTasksError((err as Error).message || 'Failed to complete task');
  } finally {
    setCompletingTask(null);
  }
};

  // ── Eligibility Handlers ───────────────────────────────────────────────────
  const checkEligibility = async (addr: string) => {
    setCheckLoading(true);
    setCheckError(null);
    setEligibility(null);
    try {
      const res = await fetch(`${API_BASE_URL}/airdrop/eligibility?walletAddress=${addr}`);
      if (!res.ok) throw new Error('Backend eligibility check failed');
      
      const response = await res.json();
      const data = response.data;
      
      setEligibility({
        walletAddress: addr,
        eligible: data.eligible ?? data.isEligible ?? false,
        amountWei: data.amountWei ?? data.allocationWei ?? '0',
        points: data.points ?? 0,
        proof: data.proof ?? [],
        alreadyClaimed: data.alreadyClaimed ?? false,
        message: data.message,
      });
    } catch (err) {
      console.warn('Backend eligibility failed:', err);
      setCheckError('Failed to check eligibility. Please try again later.');
    } finally {
      setCheckLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    if (!eligibility?.eligible) {
      setClaimError('Address not eligible for airdrop.');
      return;
    }

    if (!eligibility.amountWei || eligibility.amountWei === '0') {
      setClaimError('Invalid claim amount.');
      return;
    }

    if (!eligibility.proof || eligibility.proof.length === 0) {
      setClaimError('Merkle proof missing.');
      return;
    }

    setClaimError(null);
    setSyncError(null);

    try {
      setClaimStep('claiming');

      const hash = await claimAirdrop({
        address: CURRENT_CONTRACTS.AIRDROP as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: 'claim',
        args: [BigInt(eligibility.amountWei), eligibility.proof],
      });

      setClaimTxHash(hash);
      setClaimStep('waiting');
    } catch (err) {
      setClaimError(parseContractError(err));
      setClaimStep('idle');
    }
  };

  const syncClaimWithBackend = async () => {
    if (!address || !claimTxHash || !eligibility) return;
    setClaimStep('syncing');
    setSyncError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/airdrop/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          txHash: claimTxHash,
        }),
      });
      if (!response.ok) throw new Error(`Backend sync failed: ${response.status}`);
      const data = await response.json();
      console.log('Claim synced with backend:', data);
      setClaimStep('idle');
      setClaimSuccess(true);
      refetchClaimed();
    } catch (err) {
      console.error('Backend sync error:', err);
      setSyncError('Claim successful but failed to sync with database. Please contact support.');
      setClaimStep('idle');
      setClaimSuccess(true);
      refetchClaimed();
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const now = Date.now() / 1000;
  const start = claimStart ? Number(claimStart as bigint) : 0;
  const end = claimEnd ? Number(claimEnd as bigint) : 0;
  const rootSet = merkleRoot ? (merkleRoot as `0x${string}`) !== zeroHash : false;
  const isFinalized = finalized === true;
  const isActive = rootSet && !isFinalized && !isPaused && now >= start && now <= end;
  const claimWindowOpen = rootSet && !isFinalized && !isPaused && now >= start && now <= end;
  const claimWindowNotStarted = rootSet && !isFinalized && !isPaused && now < start;
  const claimWindowEnded = rootSet && (isFinalized || now > end);

  const allocationProgress =
    totalAllocated && maxAllocation && (maxAllocation as bigint) > 0n
      ? Math.min(
          100,
          (Number(formatUnits(totalAllocated as bigint, 18)) /
            Number(formatUnits(maxAllocation as bigint, 18))) *
            100
        )
      : 0;

  const alreadyClaimed = (claimed as boolean) || eligibility?.alreadyClaimed || claimSuccess;
  const isClaimLoading = claimStep !== 'idle';

  const getTaskStatus = (taskId: string): UserTaskStatus | undefined => userTasks[taskId];

  // ── Status Label ────────────────────────────────────────────────────────────
  function getStatusLabel() {
    if (!rootSet) return { label: 'Uninitialized', color: 'text-zinc-400', bg: 'bg-zinc-800' };
    if (isFinalized) return { label: 'Finalized', color: 'text-blue-400', bg: 'bg-blue-900/20' };
    if (isPaused) return { label: 'Paused', color: 'text-red-400', bg: 'bg-red-900/20' };
    if (now < start) return { label: 'Upcoming', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
    if (now > end) return { label: 'Ended', color: 'text-zinc-400', bg: 'bg-zinc-800' };
    return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-900/20' };
  }

  const stateInfo = getStatusLabel();

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="py-12 px-4 min-h-screen bg-black">
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* ── Title ── */}
        <motion.h1
          className="text-4xl md:text-5xl font-bold text-teal-400 text-center mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          FOR Token Airdrop
        </motion.h1>
        <motion.p
          className="text-zinc-400 text-center mb-8 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
        >
          Check your eligibility and claim your allocated tokens
        </motion.p>

        <div className="space-y-4">
          {/* ── Airdrop Stats ── */}
          <motion.div
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.05 } }}
          >
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Status</p>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${stateInfo.bg} ${stateInfo.color}`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  {stateInfo.label}
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Merkle Root</p>
                <p className={`text-sm font-semibold ${rootSet ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {rootSet ? 'Set' : 'Not Set'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500 mb-1">Claim Ends</p>
                <p className="text-sm font-semibold text-teal-300 font-mono">
                  {claimEnd ? formatCountdown(countdown) : '—'}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>
                  Allocated:{' '}
                  <span className="text-zinc-300">
                    {totalAllocated ? formatLargeNumber(totalAllocated as bigint) : '0'} FOR
                  </span>
                </span>
                <span>
                  Max Cap:{' '}
                  <span className="text-zinc-300">
                    {maxAllocation ? formatLargeNumber(maxAllocation as bigint) : '—'} FOR
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 to-teal-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${allocationProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
              <p className="text-right text-xs text-zinc-500 mt-1">{allocationProgress.toFixed(1)}% allocated</p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2">
              <div className="bg-zinc-800/40 rounded-lg p-2">
                <p className="text-[10px] text-zinc-500">Token</p>
                <p className="text-xs text-zinc-300 font-mono truncate">{tokenAddress ? (tokenAddress as string).slice(0, 8) + '...' : '—'}</p>
              </div>
              <div className="bg-zinc-800/40 rounded-lg p-2">
                <p className="text-[10px] text-zinc-500">Vesting</p>
                <p className="text-xs text-zinc-300 font-mono truncate">{vestingAddress ? (vestingAddress as string).slice(0, 8) + '...' : '—'}</p>
              </div>
              <div className="bg-zinc-800/40 rounded-lg p-2">
                <p className="text-[10px] text-zinc-500">Treasury</p>
                <p className="text-xs text-zinc-300 font-mono truncate">{treasuryAddress ? (treasuryAddress as string).slice(0, 8) + '...' : '—'}</p>
              </div>
              <div className="bg-zinc-800/40 rounded-lg p-2">
                <p className="text-[10px] text-zinc-500">Gov Lock</p>
                <p className="text-xs text-zinc-300">{govLockConstant ? `${Number(govLockConstant as bigint) / 86400} days` : '—'}</p>
              </div>
            </div>
          </motion.div>

          {/* ── Eligibility Check Card ── */}
          <motion.div
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          >
            <p className="text-sm text-zinc-400 mb-4">Eligibility Check</p>

            {!isConnected ? (
              <div className="text-center py-6">
                <p className="text-zinc-500 text-sm mb-4">Connect your wallet to check eligibility</p>
                <button
                  onClick={() => openConnectModal?.()}
                  className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-black font-semibold rounded-lg transition-all active:scale-95"
                >
                  Connect Wallet
                </button>
              </div>
            ) : checkLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-zinc-400 text-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Checking eligibility...
                </div>
              </div>
            ) : checkError ? (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-3">{checkError}</p>
                <button
                  onClick={() => address && checkEligibility(address)}
                  className="text-xs text-teal-400 hover:text-teal-300 underline"
                >
                  Try again
                </button>
              </div>
            ) : eligibility ? (
              <AnimatePresence mode="wait">
                {eligibility.eligible ? (
                  <motion.div
                    key="eligible"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4 text-center">
                      <div className="text-3xl mb-2">🎉</div>
                      <p className="text-emerald-400 font-semibold">You are eligible!</p>
                      <p className="text-2xl font-bold text-white mt-2">
                        {formatLargeNumber(BigInt(eligibility.amountWei))} FOR
                      </p>
                      {eligibility.points > 0 && (
                        <p className="text-sm text-teal-400 mt-1">
                          +{eligibility.points} Points from tasks
                        </p>
                      )}
                      <p className="text-xs text-zinc-400 mt-1">
                        Tokens will be allocated to your vesting schedule
                      </p>
                    </div>

                    {alreadyClaimed && (
                      <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-center">
                        <p className="text-blue-400 text-sm font-medium">Already Claimed</p>
                        <p className="text-zinc-400 text-xs mt-1">
                          Your tokens are in your vesting schedule. Visit the Vesting page to track them.
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="not-eligible"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="text-4xl mb-3">😔</div>
                    <p className="text-zinc-300 font-medium">Not Eligible</p>
                    <p className="text-zinc-500 text-sm mt-2">
                      {eligibility.message || 'This address is not included in the airdrop list.'}
                    </p>
                    {!rootSet && (
                      <p className="text-yellow-400 text-xs mt-2">
                        ⚠️ Merkle root not set yet. Please complete tasks and wait for the admin to sync.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            ) : null}
          </motion.div>

          {/* ── Social Tasks Section ──────────────────────────────────────────── */}
          <motion.div
            className="bg-zinc-900 rounded-xl border border-zinc-800 p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-zinc-300 font-semibold">Social Tasks</p>
                <p className="text-xs text-zinc-500 mt-0.5">Complete tasks to earn points</p>
              </div>
              <div className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                {tasks.length} Tasks
              </div>
            </div>

            {!isConnected ? (
              <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                <p className="text-zinc-500 text-sm">Connect wallet to view tasks</p>
              </div>
            ) : tasksLoading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 text-zinc-400 text-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading tasks...
                </div>
              </div>
            ) : tasksError ? (
              <div className="text-center py-4">
                <p className="text-red-400 text-sm mb-2">{tasksError}</p>
                <button
                  onClick={fetchTasks}
                  className="text-xs text-teal-400 hover:text-teal-300 underline"
                >
                  Retry
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                <p className="text-zinc-500 text-sm">No tasks available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const userTask = getTaskStatus(task.id);
                  const isCompleted = userTask?.status === 'VERIFIED';
                  const isPending = userTask?.status === 'PENDING' || userTask?.status === 'REVIEW';
                  const isRejected = userTask?.status === 'REJECTED';
                  const isProcessing = completingTask === task.id;
                  const hasStarted = startedTasks.has(task.id);

                  return (
                    <motion.div
                      key={task.id}
                      className={`bg-zinc-800/50 rounded-lg border p-4 transition-all ${
                        isCompleted
                          ? 'border-emerald-700/40 bg-emerald-900/10'
                          : isRejected
                          ? 'border-red-700/40 bg-red-900/10'
                          : 'border-zinc-700/50 hover:border-zinc-600'
                      }`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-sm font-medium text-zinc-200 truncate">
                              {task.title}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${PlatformColor(
                                task.platform
                              )}`}
                            >
                              <PlatformIcon platform={task.platform} />
                              {task.platform}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                            {task.description}
                          </p>

                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-teal-400">
                              +{task.points}
                            </span>
                            <span className="text-[10px] text-zinc-500">Points</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          {isCompleted ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Completed
                            </div>
                          ) : isPending ? (
                            <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-medium">
                              <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Under Review
                            </div>
                          ) : isRejected ? (
                            <div className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Rejected
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => handleStartTask(task)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all active:scale-95 ${
                                  hasStarted
                                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40'
                                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                                }`}
                              >
                                {hasStarted ? '✓ Link Opened' : 'Start Task'}
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task)}
                                disabled={isProcessing || !hasStarted}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all active:scale-95 ${
                                  isProcessing || !hasStarted
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-teal-600 hover:bg-teal-500 text-white'
                                }`}
                              >
                                {isProcessing ? (
                                  <span className="flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Verifying...
                                  </span>
                                ) : (
                                  'Complete Task'
                                )}
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <span className="text-[10px] text-emerald-400/70">
                              {task.points} Points Earned
                            </span>
                          )}
                          {isPending && userTask?.status === 'REVIEW' && (
                            <span className="text-[10px] text-yellow-400/70">
                              Manual review required
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Claim Button ── */}
          {isConnected && eligibility?.eligible && !alreadyClaimed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            >
              {!claimWindowOpen && rootSet && (
                <div className="mb-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-yellow-400 text-xs text-center">
                  {claimWindowNotStarted
                    ? `Claim starts ${formatCountdown(start - now)}`
                    : claimWindowEnded
                    ? 'Claim window has ended.'
                    : isPaused
                    ? 'Airdrop is currently paused.'
                    : 'Airdrop is not active.'}
                </div>
              )}

              {!rootSet && (
                <div className="mb-3 p-3 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-zinc-400 text-xs text-center">
                  Merkle root not set yet. Complete tasks and wait for admin sync.
                </div>
              )}

              <button
                onClick={handleClaim}
                disabled={isClaimLoading || !claimWindowOpen}
                className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                  isClaimLoading || !claimWindowOpen
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-teal-500 hover:from-purple-500 hover:to-teal-400 text-white active:scale-95'
                }`}
              >
                {isClaimLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {claimStep === 'claiming'
                  ? 'Sending Claim...'
                  : claimStep === 'waiting'
                  ? 'Waiting for Confirmation...'
                  : claimStep === 'syncing'
                  ? 'Syncing with Database...'
                  : !rootSet
                  ? 'Not Ready'
                  : claimWindowNotStarted
                  ? 'Not Started'
                  : claimWindowEnded
                  ? 'Ended'
                  : isPaused
                  ? 'Paused'
                  : 'Claim Airdrop'}
              </button>
            </motion.div>
          )}

          {/* ── Claim Error ── */}
          <AnimatePresence>
            {claimError && (
              <motion.div
                className="p-4 bg-red-900/40 border border-red-700/60 rounded-xl text-red-300 text-sm text-center"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {claimError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Sync Error ── */}
          <AnimatePresence>
            {syncError && (
              <motion.div
                className="p-4 bg-yellow-900/40 border border-yellow-700/60 rounded-xl text-yellow-300 text-sm text-center"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p className="font-semibold mb-1">⚠️ Sync Warning</p>
                {syncError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Claim Success ── */}
          <AnimatePresence>
            {claimSuccess && (
              <motion.div
                className="p-4 bg-emerald-900/40 border border-emerald-700/60 rounded-xl text-emerald-300 text-sm"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p className="font-semibold mb-1">Airdrop Claimed Successfully! 🎉</p>
                <p className="text-xs text-emerald-400/80 mb-2">
                  Your tokens have been allocated to your vesting schedule and saved to the database.
                </p>
                {claimTxHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${claimTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline hover:text-emerald-200 break-all block"
                  >
                    View on Etherscan ↗
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Pending TX ── */}
          <AnimatePresence>
            {claimStep === 'waiting' && (
              <motion.div
                className="p-3 bg-blue-900/30 border border-blue-700/40 rounded-xl text-blue-300 text-xs text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Transaction submitted. Waiting for blockchain confirmation...
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Info Note ── */}
          <motion.div
            className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-zinc-500 text-xs space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.3 } }}
          >
            <p>• Airdrop uses a <span className="text-zinc-300">Merkle proof</span> system for gas-efficient eligibility verification.</p>
            <p>• Claimed tokens are allocated to your <span className="text-zinc-300">vesting schedule</span> — not sent directly to your wallet.</p>
            <p>• Each address can only claim <span className="text-zinc-300">once</span>.</p>
            <p>• Claims are <span className="text-zinc-300">blocked when paused or finalized</span>.</p>
            <p>• Max window extension: <span className="text-zinc-300">{maxWindowExtConstant ? `${Number(maxWindowExtConstant as bigint) / 86400} days` : '...'}</span>.</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
