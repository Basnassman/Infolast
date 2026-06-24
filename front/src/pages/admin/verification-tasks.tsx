'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { motion } from 'framer-motion';

const API_BASE_URL = 'https://infolast.onrender.com/api/v1';

interface VerificationTask {
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

export default function AdminVerificationTasksPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<VerificationTask | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    platform: 'TELEGRAM' as const,
    channelUrl: '',
    channelIdentifier: '',
    reward: 0,
    isActive: true,
  });

  useEffect(() => {
    checkAdminRole();
  }, [address]);

  useEffect(() => {
    if (isAdmin) fetchTasks();
  }, [isAdmin]);

  const checkAdminRole = async () => {
    if (!address) { setIsAdmin(false); setCheckingRole(false); return; }
    setCheckingRole(true);
    try {
      const message = `Admin action at ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch(`${API_BASE_URL}/auth/check-role?address=${address}`, {
        headers: { 'x-wallet-address': address, 'x-signature': signature, 'x-message': message },
      });
      if (!res.ok) { setIsAdmin(false); return; }
      const data = await res.json();
      setIsAdmin(data.data?.isAuthorized || false);
    } catch { setIsAdmin(false); } finally { setCheckingRole(false); }
  };

  const fetchWithAuth = async (url: string, options: any = {}) => {
    if (!address) throw new Error('Wallet not connected');
    const message = `Admin action at ${Date.now()}`;
    const signature = await signMessageAsync({ message });
    return fetch(url, {
      ...options,
      headers: { ...options.headers, 'Content-Type': 'application/json', 'x-wallet-address': address, 'x-signature': signature, 'x-message': message },
    });
  };

  const fetchTasks = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/verification/tasks`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTasks(Array.isArray(data.data) ? data.data : []);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const url = editingTask
        ? `${API_BASE_URL}/verification/tasks/${editingTask.id}`
        : `${API_BASE_URL}/verification/tasks`;
      const method = editingTask ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          ...formData,
          channelUrl: formData.channelUrl || null,
          channelIdentifier: formData.channelIdentifier || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to save');
      }
      setShowForm(false); setEditingTask(null); resetForm(); fetchTasks();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/verification/tasks/${id}/toggle`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle');
      fetchTasks();
    } catch (err: any) { setError(err.message); }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', platform: 'TELEGRAM', channelUrl: '', channelIdentifier: '', reward: 0, isActive: true });
  };

  const startEdit = (task: VerificationTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      platform: task.platform as any,
      channelUrl: task.channelUrl || '',
      channelIdentifier: task.channelIdentifier || '',
      reward: task.reward,
      isActive: task.isActive,
    });
    setShowForm(true);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-400">Connect wallet to access admin panel</p>
      </div>
    );
  }

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Checking permissions...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-2">⛔ Access Denied</p>
          <p className="text-zinc-400">Admin role required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-teal-400 mb-2">Admin - Verification Tasks</h1>
        <p className="text-zinc-500 text-sm mb-8">Manage platform verification tasks (Telegram, X, YouTube, Discord)</p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4 text-red-300">{error}</div>
        )}

        <button
          onClick={() => { setShowForm(!showForm); setEditingTask(null); resetForm(); }}
          className="mb-6 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg font-medium transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Verification Task'}
        </button>

        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8 space-y-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-xl font-semibold mb-4">{editingTask ? 'Edit Verification Task' : 'Create Verification Task'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="Join our Telegram group" required />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Platform</label>
                <select value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value as any})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white">
                  <option value="TELEGRAM">Telegram</option>
                  <option value="X">X (Twitter)</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="DISCORD">Discord</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Channel URL</label>
                <input type="url" value={formData.channelUrl} onChange={e => setFormData({...formData, channelUrl: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="https://t.me/yourgroup" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Channel ID</label>
                <input type="text" value={formData.channelIdentifier} onChange={e => setFormData({...formData, channelIdentifier: e.target.value})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
                  placeholder="-1001234567890" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Reward (pts)</label>
                <input type="number" min="0" value={formData.reward} onChange={e => setFormData({...formData, reward: parseInt(e.target.value) || 0})}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700" />
                  Active
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white h-20"
                placeholder="Task description..." />
            </div>
            <button type="submit" disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50 transition-colors">
              {loading ? 'Saving...' : (editingTask ? 'Update' : 'Create')}
            </button>
          </motion.form>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Reward</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm">{task.title}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300 border border-zinc-700">{task.platform}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 truncate max-w-[200px]">{task.channelIdentifier || '—'}</td>
                  <td className="px-4 py-3 text-sm text-teal-400">{task.reward}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${task.isActive ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40' : 'bg-red-900/30 text-red-400 border border-red-700/40'}`}>
                      {task.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(task)} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors">Edit</button>
                      <button onClick={() => handleToggle(task.id)} className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded transition-colors">
                        {task.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && !loading && (
            <div className="text-center py-8 text-zinc-500">No verification tasks found. Create one above.</div>
          )}
        </div>
      </div>
    </div>
  );
}
