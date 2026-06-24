'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTelegramDeepLink, getLinkedAccounts, unlinkAccount, type LinkedAccount } from '@/api/verification';

export default function TelegramLinking() {
  const { address, isConnected } = useAccount();
  const [linked, setLinked] = useState<LinkedAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const checkLinked = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const { accounts } = await getLinkedAccounts(address);
      if (!mountedRef.current) return;
      const tg = accounts.find((a) => a.platform === 'TELEGRAM' && a.verified);
      setLinked(tg ?? null);
    } catch {
      // silently ignore
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    checkLinked();
  }, [checkLinked]);

  // Countdown timer for deep link expiry
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleLink = async () => {
    if (!address) return;
    setLinking(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await generateTelegramDeepLink(address);

      // Open Telegram deep link in new tab
      window.open(result.deepLinkUrl, '_blank');

      // Start countdown (token expires in 10 minutes)
      setTimeLeft(600);

      // Poll for linking completion
      pollRef.current = setInterval(async () => {
        try {
          const { accounts } = await getLinkedAccounts(address);
          if (!mountedRef.current) return;
          const tg = accounts.find((a) => a.platform === 'TELEGRAM' && a.verified);
          if (tg) {
            setLinked(tg);
            setSuccess(true);
            setLinking(false);
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setTimeLeft(0);
          }
        } catch {
          // continue polling
        }
      }, 3000);

      // Stop polling after 10 minutes
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        if (mountedRef.current) setLinking(false);
      }, 600_000);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to generate link');
        setLinking(false);
      }
    }
  };

  const handleUnlink = async () => {
    if (!address) return;
    setLoading(true);
    try {
      await unlinkAccount(address, 'TELEGRAM');
      setLinked(null);
      setSuccess(false);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Failed to unlink');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-sky-900/30 border border-sky-700/50 flex items-center justify-center">
          <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">Telegram Account</h3>
          <p className="text-sm text-zinc-400">
            {linked
              ? `Linked as @${linked.platformUsername || 'unknown'}`
              : 'Link your Telegram for auto-verification'}
          </p>
        </div>
        <StatusBadge status={linked ? 'linked' : 'unlinked'} />
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700/40 rounded-lg text-red-300 text-sm"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 px-3 py-2 bg-emerald-900/30 border border-emerald-700/40 rounded-lg text-emerald-300 text-sm"
          >
            ✅ Telegram account linked successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Linking in progress */}
      {linking && (
        <div className="mb-3 px-3 py-2 bg-sky-900/20 border border-sky-700/30 rounded-lg">
          <div className="flex items-center gap-2 text-sky-300 text-sm mb-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Waiting for you to click the link in Telegram...
          </div>
          {timeLeft > 0 && (
            <p className="text-xs text-zinc-500">
              Link expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-1">
            Click the Telegram link that opened, then tap <strong>Start</strong> in the bot.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!linked ? (
          <button
            onClick={handleLink}
            disabled={linking || loading}
            className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {linking ? 'Linking...' : '🔗 Link Telegram'}
          </button>
        ) : (
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm text-zinc-400 transition-colors"
          >
            Unlink
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'linked' | 'unlinked' }) {
  return (
    <span
      className={`px-2.5 py-1 text-xs rounded-full font-medium ${
        status === 'linked'
          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40'
          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
      }`}
    >
      {status === 'linked' ? '✓ Linked' : 'Not linked'}
    </span>
  );
}
