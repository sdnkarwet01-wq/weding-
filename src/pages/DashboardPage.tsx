import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Globe,
  LogOut,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  createNewInvitation,
  deleteUserInvitation,
  subscribeOwnerGuests,
  subscribeOwnerInvitations,
  subscribeOwnerRsvps,
  toggleInvitationStatus,
} from '../services/weddingService';
import { GuestDoc, InvitationDoc, RsvpDoc } from '../types/wedding';
import { getTemplateById } from '../data/templates';
import { formatReadableDate } from '../utils/sanitize';
import { ResilientImage } from '../components/ResilientImage';
import { InvitationRenderer } from '../components/InvitationRenderer';

export function DashboardPage() {
  const {
    user,
    profile,
    isEmailVerified,
    loading,
    authReady,
    resendVerification,
    refreshUser,
    updateDisplayName,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [invitations, setInvitations] = useState<InvitationDoc[]>([]);
  const [guests, setGuests] = useState<GuestDoc[]>([]);
  const [rsvps, setRsvps] = useState<RsvpDoc[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  // Modals
  const [previewInv, setPreviewInv] = useState<InvitationDoc | null>(null);
  const [shareInv, setShareInv] = useState<InvitationDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvitationDoc | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);

  useEffect(() => {
    if (authReady && !loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authReady, loading, user, navigate]);

  useEffect(() => {
    if (!user || !isEmailVerified) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    const unsubInv = subscribeOwnerInvitations(user.uid, (items) => {
      setInvitations(items);
      setDataLoading(false);
    });
    const unsubGuests = subscribeOwnerGuests(user.uid, null, setGuests);
    const unsubRsvps = subscribeOwnerRsvps(user.uid, null, setRsvps);
    return () => {
      unsubInv();
      unsubGuests();
      unsubRsvps();
    };
  }, [user, isEmailVerified]);

  useEffect(() => {
    setEditName(profile?.name || user?.displayName || '');
  }, [profile, user]);

  const stats = useMemo(() => {
    const activeIds = new Set(invitations.map((i) => i.invitationId));
    const activeGuests = guests.filter((g) => activeIds.has(g.invitationId));
    const activeRsvps = rsvps.filter((r) => activeIds.has(r.invitationId));
    const publishedCount = invitations.filter((i) => i.status === 'published').length;
    const draftCount = invitations.length - publishedCount;
    const attendingRsvps = activeRsvps.filter((r) => r.attendance === 'attending');
    const declinedRsvps = activeRsvps.filter((r) => r.attendance === 'unable');
    const confirmedSeats = attendingRsvps.reduce((sum, r) => sum + (r.guestCount || 1), 0);

    return {
      totalInvitations: invitations.length,
      publishedCount,
      draftCount,
      totalGuests: activeGuests.length,
      totalResponses: activeRsvps.length,
      confirmedSeats,
      declinedCount: declinedRsvps.length,
    };
  }, [invitations, guests, rsvps]);

  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${inv.groomData.nickname} ${inv.brideData.nickname} ${inv.groomData.fullName} ${inv.brideData.fullName} ${inv.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [invitations, statusFilter, searchQuery]);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const created = await createNewInvitation(user.uid, 'eternal-bloom');
      showToast('New wedding draft created.', 'success');
      navigate(`/editor/${created.invitationId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create invitation.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyPublicUrl = async (slug: string) => {
    const url = `${window.location.origin}/wedding/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Public invitation link copied.', 'success');
    } catch {
      showToast('Could not copy link automatically.', 'error');
    }
  };

  const handleTogglePublish = async (inv: InvitationDoc) => {
    try {
      const next = await toggleInvitationStatus(inv);
      showToast(
        next === 'published'
          ? `Published! Live at /wedding/${inv.slug}`
          : 'Invitation reverted to Draft.',
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUserInvitation(deleteTarget);
      showToast('Invitation deleted.', 'info');
      setDeleteTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete invitation.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateDisplayName(editName);
      showToast('Profile updated.', 'success');
      setProfileOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !authReady) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-sm text-[#737C68]">
        Loading WEDLINK Studio...
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Host';

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] font-dm-sans">
      {/* Studio Top Bar */}
      <header className="bg-white border-b border-[#E5DDD0] sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-cormorant text-2xl font-semibold tracking-[0.06em] text-[#443C35] whitespace-nowrap shrink-0"
          >
            WEDLINK
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-[#443C35]/75">
            <Link to="/dashboard" className="text-[#443C35] font-medium whitespace-nowrap shrink-0">
              Studio Dashboard
            </Link>
            <Link to="/#templates" className="hover:text-[#443C35] whitespace-nowrap shrink-0">
              Templates
            </Link>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="hover:text-[#443C35] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Account
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={creating || !isEmailVerified}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#443C35] text-[#FAF7F2] text-xs font-medium rounded-lg hover:bg-[#5A5047] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{creating ? 'Creating...' : 'Create New Invitation'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
        {/* Email verification gate if email/password account is not yet verified */}
        {!isEmailVerified && (
          <div className="bg-white border border-[#C6AC83] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-cormorant text-2xl font-semibold">Verify your email address</h2>
              <p className="text-sm text-[#443C35]/75">
                We sent a verification link to <strong>{user.email}</strong>. Verify your email to unlock cloud persistence, publishing, and guest management.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendVerification();
                    showToast('Verification email resent.', 'success');
                  } catch {
                    showToast('Please wait a moment before resending.', 'info');
                  }
                }}
                className="px-4 py-2 text-xs font-medium border border-[#DCD3C6] rounded-lg hover:bg-[#FAF7F2]"
              >
                Resend Email
              </button>
              <button
                type="button"
                disabled={checkingVerify}
                onClick={async () => {
                  setCheckingVerify(true);
                  const ok = await refreshUser();
                  setCheckingVerify(false);
                  if (ok) showToast('Email verified! Studio unlocked.', 'success');
                  else showToast('Not verified yet. Please check your inbox.', 'info');
                }}
                className="px-4 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg hover:bg-[#5A5047]"
              >
                {checkingVerify ? 'Checking...' : "I've Verified"}
              </button>
            </div>
          </div>
        )}

        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Wedding Studio</p>
            <h1 className="font-cormorant text-4xl font-medium text-[#443C35]">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-[#443C35]/70">
              Manage your wedding invitations, personalize guest links, and monitor live RSVPs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#DCD3C6] rounded-lg hover:bg-[#F1EAE0] transition-colors cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#DCD3C6] rounded-lg hover:bg-[#FDF2F2] hover:text-[#8B3A3A] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Statistics Grid (Tabular Numerals, clean hairline dividers) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Invitations',
              value: stats.totalInvitations,
              sub: `${stats.publishedCount} Published · ${stats.draftCount} Draft`,
            },
            {
              label: 'Total Guests Invited',
              value: stats.totalGuests,
              sub: 'Personalized guest links',
            },
            {
              label: 'RSVP Responses',
              value: stats.totalResponses,
              sub: `${stats.declinedCount} Declined`,
            },
            {
              label: 'Confirmed Attendees',
              value: stats.confirmedSeats,
              sub: 'Total seats reserved',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-[#E5DDD0] rounded-2xl p-5 space-y-1.5"
            >
              <p className="text-xs text-[#737C68]">{stat.label}</p>
              <p className="font-cormorant text-4xl font-semibold text-[#443C35] tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-[#443C35]/65 tabular-nums">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F1EAE0] rounded-lg w-fit">
            {(['all', 'published', 'draft'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-[#443C35] shadow-sm'
                    : 'text-[#443C35]/70 hover:text-[#443C35]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#737C68] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search couple or slug..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
            />
          </div>
        </div>

        {/* Invitations Grid */}
        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 bg-white border border-[#E5DDD0] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-12 text-center space-y-4">
            <h2 className="font-cormorant text-3xl font-medium text-[#443C35]">
              {invitations.length === 0
                ? 'Begin crafting your first wedding invitation'
                : 'No invitations match your filter'}
            </h2>
            <p className="text-sm text-[#443C35]/70 max-w-md mx-auto">
              {invitations.length === 0
                ? 'Select a luxury stationery template, customize your story and photos, and generate personalized links for every guest.'
                : 'Try switching status tabs or clearing your search query.'}
            </p>
            {invitations.length === 0 && (
              <button
                type="button"
                disabled={creating || !isEmailVerified}
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#443C35] text-white text-sm font-medium rounded-lg hover:bg-[#5A5047] cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Invitation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvitations.map((inv) => {
              const tpl = getTemplateById(inv.templateId);
              const invGuestCount = guests.filter((g) => g.invitationId === inv.invitationId).length;
              const invRsvpCount = rsvps.filter((r) => r.invitationId === inv.invitationId).length;
              const weddingDate = formatReadableDate(
                inv.eventData.akad.date || inv.eventData.reception.date
              );

              return (
                <div
                  key={inv.invitationId}
                  className="bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[16/10] overflow-hidden border-b border-[#EDE6DA] bg-[#F1EAE0]">
                      <ResilientImage
                        src={inv.mainCouplePhoto}
                        alt={`${inv.groomData.nickname} and ${inv.brideData.nickname}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs text-[#737C68]">
                        <span>{tpl.name}</span>
                        <span className={inv.status === 'published' ? 'text-[#4B5B48] font-medium' : 'text-[#8C6D46]'}>
                          {inv.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-cormorant text-2xl font-semibold text-[#443C35]">
                          {inv.groomData.nickname || 'Groom'} &amp; {inv.brideData.nickname || 'Bride'}
                        </h3>
                        <p className="text-xs text-[#443C35]/70 mt-0.5">
                          {weddingDate} · /wedding/{inv.slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#443C35]/75 pt-2 border-t border-[#F1EAE0] tabular-nums">
                        <span>{invGuestCount} Guests</span>
                        <span aria-hidden="true">·</span>
                        <span>{invRsvpCount} RSVPs</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        to={`/editor/${inv.invitationId}`}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#443C35] text-white text-xs font-medium rounded-lg hover:bg-[#5A5047] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
                      <Link
                        to={`/guests/${inv.invitationId}`}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF7F2] border border-[#DCD3C6] text-[#443C35] text-xs font-medium rounded-lg hover:bg-[#F1EAE0] transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Guest List</span>
                      </Link>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewInv(inv)}
                          title="Preview invitation"
                          className="p-2 rounded-lg hover:bg-[#FAF7F2] text-[#443C35]/80 hover:text-[#443C35]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareInv(inv)}
                          title="Share invitation"
                          className="p-2 rounded-lg hover:bg-[#FAF7F2] text-[#443C35]/80 hover:text-[#443C35]"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopyPublicUrl(inv.slug)}
                          title="Copy public link"
                          className="p-2 rounded-lg hover:bg-[#FAF7F2] text-[#443C35]/80 hover:text-[#443C35]"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(inv)}
                          title="Delete invitation"
                          className="p-2 rounded-lg hover:bg-[#FDF2F2] text-[#443C35]/60 hover:text-[#8B3A3A]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleTogglePublish(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCD3C6] text-xs font-medium hover:bg-[#FAF7F2] cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{inv.status === 'published' ? 'Unpublish' : 'Publish'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* PREVIEW MODAL */}
      {previewInv && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/75 flex flex-col">
          <div className="bg-[#FAF7F2] border-b border-[#E5DDD0] px-5 py-3 flex items-center justify-between">
            <p className="text-xs text-[#737C68]">
              Preview · {previewInv.groomData.nickname} &amp; {previewInv.brideData.nickname}
            </p>
            <div className="flex items-center gap-2">
              {previewInv.status === 'published' && (
                <a
                  href={`/wedding/${previewInv.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[#443C35] text-white rounded-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Public URL</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setPreviewInv(null)}
                className="p-1.5 rounded-lg border border-[#DCD3C6] hover:bg-[#F1EAE0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
            <div className="w-full max-w-4xl bg-white rounded-2xl overflow-y-auto shadow-2xl">
              <InvitationRenderer invitation={previewInv} isPreview compactFrame />
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {shareInv && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShareInv(null)}
        >
          <div
            className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-md w-full space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-cormorant text-2xl font-semibold">Share Invitation</h3>
              <button type="button" onClick={() => setShareInv(null)} className="p-1 rounded-lg hover:bg-[#FAF7F2]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {shareInv.status !== 'published' && (
              <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#C6AC83] text-xs text-[#443C35]">
                This invitation is currently a <strong>Draft</strong>. Publish it so guests can open the link without signing in.
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#737C68]">Public Wedding URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/wedding/${shareInv.slug}`}
                  className="flex-1 px-3 py-2 text-xs bg-[#FAF7F2] border border-[#DCD3C6] rounded-lg font-mono-num"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyPublicUrl(shareInv.slug)}
                  className="px-3.5 py-2 bg-[#443C35] text-white text-xs font-medium rounded-lg"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `You are invited to the wedding of ${shareInv.groomData.nickname} & ${shareInv.brideData.nickname}: ${window.location.origin}/wedding/${shareInv.slug}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-[#737C68] text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-[#5E6755]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Share via WhatsApp</span>
              </a>
              <Link
                to={`/guests/${shareInv.invitationId}`}
                className="w-full py-2.5 px-4 border border-[#DCD3C6] text-[#443C35] text-xs font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-[#FAF7F2]"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Create Personalized Guest Links</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-cormorant text-2xl font-semibold">Delete Invitation?</h3>
            <p className="text-sm text-[#443C35]/75">
              This will permanently remove <strong>{deleteTarget.groomData.nickname} &amp; {deleteTarget.brideData.nickname}</strong> and release the slug <code>/wedding/{deleteTarget.slug}</code>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-medium border border-[#DCD3C6] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-medium bg-[#8B3A3A] text-white rounded-lg hover:bg-[#722F2F]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT PROFILE MODAL */}
      {profileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-cormorant text-2xl font-semibold">Studio Profile</h3>
              <button type="button" onClick={() => setProfileOpen(false)} className="p-1 rounded-lg hover:bg-[#FAF7F2]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  readOnly
                  value={user.email || ''}
                  className="w-full px-3.5 py-2 text-sm bg-[#FAF7F2] border border-[#DCD3C6] rounded-lg text-[#737C68]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-[#DCD3C6] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
