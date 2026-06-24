'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  getVerificationTasks,
  getVerificationStatus,
  triggerVerification,
  type VerificationTask,
  type VerificationStatus,
} from '@/api/verification';
import TelegramLinking from '@/components/TelegramLinking';

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  TELEGRAM: { icon: '✈️', color: 'text-sky-400', bgColor: 'bg-sky-900/20', borderColor: 'border-sky-700/40' },
  X:        { icon: '𝕏',  color: 'text-zinc-300', bgColor: 'bg-zinc-800',    borderColor: 'border-zinc-700' },
  YOUTUBE:  { icon: '▶️', color: 'text-red-400',  bgColor: 'bg-red-900/20',  borderColor: 'border-red-700/40' },
  DISCORD:  { icon: '💬', color: 'text-indigo-400', bgColor: 'bg-indigo-900/20', borderColor: 'border-indigo-700/40' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  VERIFIED: { label: '✓ Verified', color: 'text-emerald-400', bgColor: 'bg-emerald-900/30', borderColor: 'border-emerald-700/40' },
  PENDING:  { label: '⏳ Pending',  color: 'text-yellow-400', bgColor: 'bg-yellow-900/20', borderColor: 'border-yellow-700/30' },
  REJECTED: { label: '✗ Rejected', color: 'text-red-400',     bgColor: 'bg-red-900/30',    borderColor: 'border-red-700/40' },
  REVOKED:  { label: '⚠ Revoked',  color: 'text-orange-400',  bgColor: 'bg-orange-900/20', borderColor: 'border-orange-700/30' },
};

export default function TasksPage() {
  const { address, isConnected } = useAccount();
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [statuses, setStatuses] = useState<Map<string, VerificationStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      const [tasksData, statusData] = await Promise.all([
        getVerificationTasks(),
        getVerificationStatus(address),
      ]);

      if (!mountedRef.current) return;

      const activeTasks = tasksData.filter((t) => t.isActive);
      setTasks(activeTasks);

      const statusMap = new Map<string, VerificationStatus>();
      for (const s of statusData.verifiedTasks) {
        statusMap.set(s.verificationTaskId, s);
      }
      setStatuses(statusMap);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Failed to load tasks');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerify = async (taskId: string) => {
    if (!address) return;
    setVerifying(taskId);
    setError(null);

    try {
      await triggerVerification(address, taskId);

      // Poll for status update after 5 seconds
      pollRef.current = setTimeout(async () => {
        try {
          const statusData = await getVerificationStatus(address);
          if (!mountedRef.current) return;
          const statusMap = new Map<string, VerificationStatus>();
          for (const s of statusData.verifiedTasks) {
            statusMap.set(s.verificationTaskId, s);
          }
          setStatuses(statusMap);
        } catch {
          // ignore
        }
        if (mountedRef.current) setVerifying(null);
      }, 5000);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Verification failed');
        setVerifying(null);
      }
    }
  };

  const telegramTasks = tasks.filter((t) => t.platform === 'TELEGRAM');
  const otherTasks = tasks.filter((t) => t.platform !== 'TELEGRAM');

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-2">🔗</p>
          <p className="text-zinc-400">Connect your wallet to view tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-teal-400 mb-2">Tasks & Verification</h1>
          <p className="text-zinc-400">
            Complete platform tasks to verify your accounts and earn rewards.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-700/40 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Account Linking Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-teal-400">①</span> Link Your Accounts
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Link your social accounts first to enable automatic task verification.
          </p>
          <TelegramLinking />
        </div>

        {/* Tasks Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-teal-400">②</span> Verification Tasks
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
              <p className="text-zinc-500 text-lg">📋 No tasks available</p>
              <p className="text-zinc-600 text-sm mt-1">Check back later for new tasks</p>
            </div>
          ) : (
            <>
              {/* Telegram Tasks */}
              {telegramTasks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-sky-400 mb-3 uppercase tracking-wider">Telegram</h3>
                  <div className="space-y-3">
                    {telegramTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        status={statuses.get(task.id)}
                        verifying={verifying === task.id}
                        onVerify={() => handleVerify(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Tasks (placeholder) */}
              {otherTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-500 mb-3 uppercase tracking-wider">Other Platforms</h3>
                  <div className="space-y-3">
                    {otherTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        status={statuses.get(task.id)}
                        verifying={verifying === task.id}
                        onVerify={() => handleVerify(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Card Component ─────────────────────────────────────────────────────

interface TaskCardProps {
  task: VerificationTask;
  status?: VerificationStatus;
  verifying: boolean;
  onVerify: () => void;
}

function TaskCard({ task, status, verifying, onVerify }: TaskCardProps) {
  const platform = PLATFORM_CONFIG[task.platform] ?? PLATFORM_CONFIG.X;
  const statusCfg = status ? STATUS_CONFIG[status.status] : null;
  const isVerified = status?.status === 'VERIFIED';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-zinc-900 border rounded-xl p-5 transition-colors ${
        isVerified ? 'border-emerald-700/30' : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Platform icon */}
        <div className={`w-11 h-11 rounded-lg ${platform.bgColor} border ${platform.borderColor} flex items-center justify-center text-lg shrink-0`}>
          {platform.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-white truncate">{task.title}</h3>
            {statusCfg && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}>
                {statusCfg.label}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-zinc-400 mb-2">{task.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {task.reward > 0 && (
              <span className="text-teal-400 font-medium">+{task.reward} pts</span>
            )}
            <span className="uppercase">{task.platform}</span>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isVerified ? (
            <div className="w-10 h-10 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <button
              onClick={onVerify}
              disabled={verifying}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {verifying ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Checking...
                </span>
              ) : (
                'Verify'
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
