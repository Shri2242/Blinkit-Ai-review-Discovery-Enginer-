'use client';

import { format } from 'date-fns';
import { UserPlus, Trash2, Mail, Shield, User, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Project } from '@/store/project';

interface TeamMember {
  id: string; // project_members.id
  role: 'admin' | 'analyst' | 'viewer';
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
  };
}

interface TeamMembersTabProps {
  project: Project;
}

export default function TeamMembersTab({ project }: TeamMembersTabProps) {
  const { user: currentUser } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);

  // Load team members
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${project.id}/teams/members`);
      setMembers(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      toast.error('Could not load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [project.id]);

  // Handle invitation submission
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await api.post(`/projects/${project.id}/teams/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      toast.success(`Invite sent successfully to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('viewer');
      // Refresh list
      fetchMembers();
    } catch (error) {
      console.error('Failed to send invite:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to send invite';
      toast.error(errMsg);
    } finally {
      setInviting(false);
    }
  };

  // Handle role modification
  const handleRoleChange = async (memberId: string, role: string) => {
    try {
      await api.patch(`/projects/${project.id}/teams/${memberId}/role`, { role });
      toast.success('Member role updated');
      // Update local state directly
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: role as 'admin' | 'analyst' | 'viewer' } : m
        )
      );
    } catch (error) {
      console.error('Failed to update role:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to update member role';
      toast.error(errMsg);
    }
  };

  // Handle member removal
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from this project?`)) {
      return;
    }

    try {
      await api.delete(`/projects/${project.id}/teams/${memberId}`);
      toast.success(`${email} removed from the team`);
      // Update local state directly
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (error) {
      console.error('Failed to remove member:', error);
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errMsg = err.response?.data?.error?.message || 'Failed to remove member';
      toast.error(errMsg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-200">Team Members</h2>
        <p className="text-xs text-slate-500 mt-1">Manage team members, permissions, and roles.</p>
      </div>

      {/* Invite member section */}
      <div className="p-5 rounded-2xl border border-slate-900 bg-slate-950/40 max-w-2xl">
        <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
          <UserPlus size={16} className="text-indigo-400" />
          <span>Invite New Member</span>
        </h3>
        <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              disabled={inviting}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100 text-sm focus:outline-none focus:border-indigo-500/80 transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="w-full md:w-40">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'analyst' | 'viewer')}
              disabled={inviting}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/80 transition cursor-pointer disabled:opacity-60"
            >
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-sm transition shrink-0"
          >
            {inviting ? <Loader2 size={16} className="animate-spin" /> : <span>Invite</span>}
          </button>
        </form>
      </div>

      {/* Members list table */}
      <div className="border border-slate-900 bg-slate-950/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="text-indigo-500 animate-spin" size={24} />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm italic">
            No team members found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/45 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Joined Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {members.map((member) => {
                  const isSelf = member.user.id === currentUser?.id;
                  const isOwner = member.user.id === project.owner_id;
                  const joinedDate = new Date(member.created_at);
                  const formattedJoined = isNaN(joinedDate.getTime())
                    ? 'N/A'
                    : format(joinedDate, 'MMM d, yyyy');

                  return (
                    <tr key={member.id} className="hover:bg-slate-900/10 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                            <User size={15} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-200">
                              {member.user.name || 'Invited User'}
                              {isSelf && (
                                <span className="ml-2 text-[9px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">
                                  You
                                </span>
                              )}
                              {isOwner && (
                                <span className="ml-2 text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{member.user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isSelf || isOwner ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <Shield size={14} className="text-slate-500" />
                            <span className="capitalize">{member.role}</span>
                          </div>
                        ) : (
                          <div className="w-32">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="analyst">Analyst</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-400">{formattedJoined}</td>

                      <td className="px-6 py-4 text-right">
                        {isSelf || isOwner ? (
                          <span className="text-[10px] text-slate-600 font-medium italic">
                            System Lock
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.user.email)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
