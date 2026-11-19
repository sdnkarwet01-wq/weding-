import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  addSingleGuest,
  bulkAddGuests,
  deleteGuestRecord,
  deleteRsvpRecord,
  deleteWishRecord,
  getInvitationById,
  subscribeOwnerGuests,
  subscribeOwnerRsvps,
  subscribeOwnerWishes,
  toMillis,
  updateGuestRecord,
} from '../services/weddingService';
import { GuestDoc, InvitationDoc, RsvpDoc, WishDoc } from '../types/wedding';
import {
  buildGuestUrl,
  buildWhatsAppShareUrl,
  parseCsvGuestRows,
} from '../utils/sanitize';

export function GuestManagerPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const { user, loading, authReady } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [invitation, setInvitation] = useState<InvitationDoc | null>(null);
  const [guests, setGuests] = useState<GuestDoc[]>([]);
  const [rsvps, setRsvps] = useState<RsvpDoc[]>([]);
  const [wishes, setWishes] = useState<WishDoc[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'guests' | 'rsvps' | 'wishes'>('guests');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  // Add single guest form
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Friends & Family');
  const [addingGuest, setAddingGuest] = useState(false);

  // Bulk / CSV import modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  // Edit guest modal
  const [editingGuest, setEditingGuest] = useState<GuestDoc | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestGroup, setEditGuestGroup] = useState('');
  const [editGuestRsvp, setEditGuestRsvp] = useState<GuestDoc['rsvpStatus']>('pending');
  const [editGuestCount, setEditGuestCount] = useState(1);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authReady, loading, user, navigate]);

  useEffect(() => {
    if (!user || !invitationId) return;
    let mounted = true;
    setPageLoading(true);
    getInvitationById(invitationId)
      .then((inv) => {
        if (!mounted) return;
        if (!inv || inv.ownerId !== user.uid) {
          showToast('Invitation not found or access denied.', 'error');
          navigate('/dashboard', { replace: true });
          return;
        }
        setInvitation(inv);
        setPageLoading(false);
      })
      .catch(() => {
        if (mounted) navigate('/dashboard', { replace: true });
      });

    const unsubG = subscribeOwnerGuests(user.uid, invitationId, setGuests);
    const unsubR = subscribeOwnerRsvps(user.uid, invitationId, setRsvps);
    const unsubW = subscribeOwnerWishes(user.uid, invitationId, setWishes);

    return () => {
      mounted = false;
      unsubG();
      unsubR();
      unsubW();
    };
  }, [user, invitationId, navigate, showToast]);

  // Correlate guest list with latest public RSVP by matching name (case-insensitive)
  const enrichedGuests = useMemo(() => {
    const rsvpMap = new Map<string, RsvpDoc>();
    for (const r of rsvps) {
      const key = r.guestName.trim().toLowerCase();
      if (!rsvpMap.has(key)) rsvpMap.set(key, r);
    }

    return guests.map((g) => {
      const matched = rsvpMap.get(g.guestName.trim().toLowerCase());
      const effectiveStatus = matched
        ? matched.attendance === 'attending'
          ? 'attending'
          : 'declined'
        : g.rsvpStatus;
      const effectiveCount = matched ? matched.guestCount : g.guestCount;
      const freshUrl = invitation ? buildGuestUrl(invitation.slug, g.guestName) : g.invitationUrl;
      return {
        ...g,
        effectiveStatus,
        effectiveCount,
        freshUrl,
      };
    });
  }, [guests, rsvps, invitation]);

  const stats = useMemo(() => {
    const attendingRsvps = rsvps.filter((r) => r.attendance === 'attending');
    const declinedRsvps = rsvps.filter((r) => r.attendance === 'unable');
    const confirmedSeats = attendingRsvps.reduce((sum, r) => sum + (r.guestCount || 1), 0);
    const respondedNames = new Set(rsvps.map((r) => r.guestName.trim().toLowerCase()));
    const pendingGuests = guests.filter(
      (g) => g.rsvpStatus === 'pending' && !respondedNames.has(g.guestName.trim().toLowerCase())
    ).length;

    return {
      totalGuests: guests.length,
      attendingCount: attendingRsvps.length,
      declinedCount: declinedRsvps.length,
      pendingCount: pendingGuests,
      confirmedSeats,
    };
  }, [guests, rsvps]);

  const groups = useMemo(() => {
    const set = new Set<string>(['Friends & Family', 'Bride Family', 'Groom Family', 'Colleagues', 'VIP']);
    guests.forEach((g) => {
      if (g.guestGroup) set.add(g.guestGroup);
    });
    return Array.from(set);
  }, [guests]);

  const filteredGuests = useMemo(() => {
    return enrichedGuests.filter((g) => {
      if (groupFilter !== 'all' && g.guestGroup !== groupFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!g.guestName.toLowerCase().includes(q) && !g.guestGroup.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedGuests, groupFilter, searchTerm]);

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !invitation || !newName.trim()) return;
    setAddingGuest(true);
    try {
      await addSingleGuest({
        invitationId: invitation.invitationId,
        ownerId: user.uid,
        slug: invitation.slug,
        guestName: newName,
        guestGroup: newGroup,
      });
      setNewName('');
      showToast('Guest added with personalized invitation link.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add guest.', 'error');
    } finally {
      setAddingGuest(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBulkText(String(reader.result || ''));
    };
    reader.readAsText(file);
  };

  const parsedBulkPreview = useMemo(() => parseCsvGuestRows(bulkText), [bulkText]);

  const handleBulkImport = async () => {
    if (!user || !invitation || parsedBulkPreview.length === 0) return;
    setImporting(true);
    try {
      const count = await bulkAddGuests({
        invitationId: invitation.invitationId,
        ownerId: user.uid,
        slug: invitation.slug,
        rows: parsedBulkPreview,
      });
      setBulkText('');
      setBulkOpen(false);
      showToast(`Imported ${count} guest links.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCopyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      showToast('Personalized guest URL copied.', 'success');
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Copy failed.', 'error');
    }
  };

  const handleSaveEditGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest || !invitation) return;
    try {
      await updateGuestRecord(editingGuest.guestId, invitation.slug, {
        guestName: editGuestName,
        guestGroup: editGuestGroup,
        rsvpStatus: editGuestRsvp,
        guestCount: editGuestCount,
      });
      setEditingGuest(null);
      showToast('Guest updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update guest.', 'error');
    }
  };

  const handleToggleSent = async (guest: GuestDoc, nextSent: boolean) => {
    if (!invitation) return;
    try {
      await updateGuestRecord(guest.guestId, invitation.slug, {
        invitationSent: nextSent,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    try {
      await deleteGuestRecord(guestId);
      showToast('Guest removed.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete guest.', 'error');
    }
  };

  const handleDeleteRsvp = async (rsvpId: string) => {
    try {
      await deleteRsvpRecord(rsvpId);
      showToast('RSVP record deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete RSVP.', 'error');
    }
  };

  const handleDeleteWish = async (wishId: string) => {
    try {
      await deleteWishRecord(wishId);
      showToast('Wish removed from guestbook.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete wish.', 'error');
    }
  };

  const handleExportCsv = () => {
    const header = 'Guest Name,Group,RSVP Status,Seat Count,Sent,Personalized URL';
    const lines = enrichedGuests.map((g) =>
      [
        `"${g.guestName.replace(/"/g, '""')}"`,
        `"${g.guestGroup.replace(/"/g, '""')}"`,
        g.effectiveStatus,
        g.effectiveCount,
        g.invitationSent ? 'Yes' : 'No',
        `"${g.freshUrl}"`,
      ].join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invitation?.slug || 'guests'}-list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (pageLoading || loading || !authReady) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-sm text-[#737C68]">
        Loading Guest &amp; RSVP Console...
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] font-dm-sans">
      <header className="bg-white border-b border-[#E5DDD0] sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-[#737C68] hover:text-[#443C35] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <span className="text-[#DCD3C6]">/</span>
            <h1 className="font-cormorant text-xl font-semibold truncate">
              {invitation.groomData.nickname} &amp; {invitation.brideData.nickname} · Guests &amp; RSVP
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/editor/${invitation.invitationId}`}
              className="px-3.5 py-2 text-xs font-medium border border-[#DCD3C6] rounded-lg hover:bg-[#FAF7F2] whitespace-nowrap shrink-0"
            >
              Open Editor
            </Link>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg hover:bg-[#5A5047] whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
        {/* RSVP Analytics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total Invitations', val: stats.totalGuests },
            { label: 'Attending RSVPs', val: stats.attendingCount },
            { label: 'Declined RSVPs', val: stats.declinedCount },
            { label: 'Pending Guests', val: stats.pendingCount },
            { label: 'Confirmed Attendees', val: stats.confirmedSeats },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-[#E5DDD0] rounded-xl p-4">
              <p className="text-xs text-[#737C68]">{k.label}</p>
              <p className="font-cormorant text-3xl font-semibold tabular-nums mt-1">{k.val}</p>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-[#F1EAE0] rounded-lg">
            {[
              { id: 'guests', label: `Guest List (${guests.length})` },
              { id: 'rsvps', label: `RSVP Responses (${rsvps.length})` },
              { id: 'wishes', label: `Guest Wishes (${wishes.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as 'guests' | 'rsvps' | 'wishes')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors tabular-nums cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-white text-[#443C35] shadow-sm'
                    : 'text-[#443C35]/70 hover:text-[#443C35]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'guests' && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-[#DCD3C6] rounded-lg hover:bg-[#F1EAE0] cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk Add / Import CSV</span>
            </button>
          )}
        </div>

        {/* TAB 1: GUEST LIST */}
        {activeTab === 'guests' && (
          <div className="space-y-6">
            {/* Add single guest bar */}
            <form
              onSubmit={handleAddGuest}
              className="bg-white border border-[#E5DDD0] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium mb-1">Guest Full Name / Title</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Mr. John & Partner"
                  className="w-full px-3.5 py-2 text-sm border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium mb-1">Guest Group</label>
                <input
                  type="text"
                  list="guest-group-options"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
                />
                <datalist id="guest-group-options">
                  {groups.map((grp) => (
                    <option key={grp} value={grp} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={addingGuest}
                  className="w-full py-2.5 px-4 bg-[#443C35] text-white text-xs font-medium rounded-lg hover:bg-[#5A5047] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addingGuest ? 'Adding...' : 'Add Guest Link'}</span>
                </button>
              </div>
            </form>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[#737C68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search guest name..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#DCD3C6] rounded-lg"
                />
              </div>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3.5 py-2 text-sm bg-white border border-[#DCD3C6] rounded-lg"
              >
                <option value="all">All Groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Guest Table */}
            {filteredGuests.length === 0 ? (
              <div className="bg-white border border-[#E5DDD0] rounded-2xl p-10 text-center text-sm text-[#443C35]/70">
                No guests added yet. Add a guest above or import a CSV list to generate personalized invitation links.
              </div>
            ) : (
              <div className="bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#FAF7F2] border-b border-[#E5DDD0] text-xs text-[#737C68]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Guest Name</th>
                        <th className="py-3 px-4 font-medium">Group</th>
                        <th className="py-3 px-4 font-medium">RSVP Status</th>
                        <th className="py-3 px-4 font-medium text-right">Seats</th>
                        <th className="py-3 px-4 font-medium">Sent</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EAE0]">
                      {filteredGuests.map((g) => {
                        const waUrl = buildWhatsAppShareUrl(
                          g.guestName,
                          invitation.brideData.nickname,
                          invitation.groomData.nickname,
                          invitation.eventData.akad.date || invitation.eventData.reception.date,
                          g.freshUrl
                        );

                        return (
                          <tr key={g.guestId} className="hover:bg-[#FAF7F2]/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium text-[#443C35]">{g.guestName}</div>
                              <div className="text-[11px] text-[#737C68] truncate max-w-[260px]">
                                {g.freshUrl}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-[#443C35]/75">{g.guestGroup}</td>
                            <td className="py-3 px-4 text-xs">
                              <span
                                className={
                                  g.effectiveStatus === 'attending'
                                    ? 'text-[#3F5A36] font-medium'
                                    : g.effectiveStatus === 'declined'
                                    ? 'text-[#8B3A3A] font-medium'
                                    : 'text-[#8C6D46]'
                                }
                              >
                                {g.effectiveStatus === 'attending'
                                  ? 'Attending'
                                  : g.effectiveStatus === 'declined'
                                  ? 'Declined'
                                  : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-xs">
                              {g.effectiveCount}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <button
                                type="button"
                                onClick={() => void handleToggleSent(g, !g.invitationSent)}
                                className="underline text-[#737C68] hover:text-[#443C35]"
                              >
                                {g.invitationSent ? 'Sent' : 'Not sent'}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyLink(g.guestId, g.freshUrl)}
                                  title="Copy personalized URL"
                                  className="p-1.5 rounded-lg hover:bg-[#F1EAE0] text-[#443C35]"
                                >
                                  {copiedId === g.guestId ? (
                                    <Check className="w-4 h-4 text-[#4B5B48]" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => {
                                    if (!g.invitationSent) {
                                      void handleToggleSent(g, true);
                                    }
                                  }}
                                  title="Send via WhatsApp"
                                  className="p-1.5 rounded-lg hover:bg-[#F1EAE0] text-[#4B5B48]"
                                >
                                  <Send className="w-4 h-4" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGuest(g);
                                    setEditGuestName(g.guestName);
                                    setEditGuestGroup(g.guestGroup);
                                    setEditGuestRsvp(g.rsvpStatus);
                                    setEditGuestCount(g.guestCount);
                                  }}
                                  title="Edit guest"
                                  className="p-1.5 rounded-lg hover:bg-[#F1EAE0] text-[#443C35]/75"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteGuest(g.guestId)}
                                  title="Delete guest"
                                  className="p-1.5 rounded-lg hover:bg-[#FDF2F2] text-[#8B3A3A]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: RSVP RESPONSES */}
        {activeTab === 'rsvps' && (
          <div className="bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden">
            {rsvps.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#443C35]/70">
                No RSVP submissions received yet. Once published, guest confirmations appear here immediately.
              </div>
            ) : (
              <div className="divide-y divide-[#F1EAE0]">
                {rsvps.map((r) => (
                  <div key={r.rsvpId} className="p-5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-sm font-semibold text-[#443C35]">{r.guestName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            r.attendance === 'attending'
                              ? 'text-[#3F5A36] font-medium'
                              : 'text-[#8B3A3A] font-medium'
                          }
                        >
                          {r.attendance === 'attending'
                            ? `Attending (${r.guestCount} guest${r.guestCount > 1 ? 's' : ''})`
                            : 'Unable to Attend'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#737C68] tabular-nums">
                          {toMillis(r.createdAt)
                            ? new Date(toMillis(r.createdAt)).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Recent'}
                        </span>
                      </div>
                      {r.message && <p className="text-sm text-[#443C35]/80">{r.message}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRsvp(r.rsvpId)}
                      title="Delete RSVP"
                      className="p-1.5 rounded-lg hover:bg-[#FDF2F2] text-[#8B3A3A]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WISHES MODERATION */}
        {activeTab === 'wishes' && (
          <div className="bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden">
            {wishes.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#443C35]/70">
                No guestbook wishes submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-[#F1EAE0]">
                {wishes.map((w) => (
                  <div key={w.wishId} className="p-5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-sm font-semibold text-[#443C35]">{w.guestName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#737C68] tabular-nums">
                          {toMillis(w.createdAt)
                            ? new Date(toMillis(w.createdAt)).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Recent'}
                        </span>
                      </div>
                      <p className="text-sm text-[#443C35]/85">{w.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteWish(w.wishId)}
                      title="Delete wish"
                      className="p-1.5 rounded-lg hover:bg-[#FDF2F2] text-[#8B3A3A]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* BULK / CSV IMPORT MODAL */}
      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-cormorant text-2xl font-semibold">Bulk Guest Import</h3>
              <button type="button" onClick={() => setBulkOpen(false)} className="p-1 rounded-lg hover:bg-[#FAF7F2]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#443C35]/75 leading-relaxed">
              Upload a CSV file (<code>Name, Group</code>) or paste one guest per line below. Each entry gets a unique personalized URL.
            </p>
            <div>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#DCD3C6] rounded-lg hover:bg-[#FAF7F2]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Load from CSV File</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Mr. John Doe, VIP\nIbu Sarah & Family, Bride Family\nBapak Budi Santoso, Colleagues`}
              className="w-full p-3 text-xs font-mono-num border border-[#DCD3C6] rounded-xl focus:outline-none focus:border-[#737C68]"
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#737C68] tabular-nums">
                {parsedBulkPreview.length} valid guest(s) ready
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="px-4 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || parsedBulkPreview.length === 0}
                  onClick={handleBulkImport}
                  className="px-4 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Generate Guest Links'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT GUEST MODAL */}
      {editingGuest && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E5DDD0] rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-cormorant text-2xl font-semibold">Edit Guest</h3>
              <button type="button" onClick={() => setEditingGuest(null)} className="p-1 rounded-lg hover:bg-[#FAF7F2]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditGuest} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Guest Name</label>
                <input
                  type="text"
                  required
                  value={editGuestName}
                  onChange={(e) => setEditGuestName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Group</label>
                <input
                  type="text"
                  value={editGuestGroup}
                  onChange={(e) => setEditGuestGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">RSVP Status</label>
                  <select
                    value={editGuestRsvp}
                    onChange={(e) => setEditGuestRsvp(e.target.value as GuestDoc['rsvpStatus'])}
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  >
                    <option value="pending">Pending</option>
                    <option value="attending">Attending</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Seats</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={editGuestCount}
                    onChange={(e) => setEditGuestCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg tabular-nums"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGuest(null)}
                  className="px-4 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg"
                >
                  Save Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
