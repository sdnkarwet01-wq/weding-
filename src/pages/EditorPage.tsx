import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  Play,
  Plus,
  Save,
  Send,
  Smartphone,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  addSingleGuest,
  getInvitationById,
  isSlugAvailable,
  saveInvitationChanges,
  subscribeOwnerGuests,
  toggleInvitationStatus,
} from '../services/weddingService';
import { WEDDING_TEMPLATES } from '../data/templates';
import { CURATED_MUSIC_TRACKS } from '../data/defaultInvitation';
import { GuestDoc, InvitationDoc, TemplateId } from '../types/wedding';
import { MediaUploadField } from '../components/MediaUploadField';
import { InvitationRenderer } from '../components/InvitationRenderer';
import { ResilientImage } from '../components/ResilientImage';
import { uploadMediaFile } from '../lib/storage';
import { WeddingAudioController } from '../utils/audioEngine';
import { buildGuestUrl, buildWhatsAppShareUrl, sanitizeSlug } from '../utils/sanitize';

const WIZARD_STEPS = [
  { id: 1, label: 'Template' },
  { id: 2, label: 'Couple' },
  { id: 3, label: 'Event' },
  { id: 4, label: 'Story' },
  { id: 5, label: 'Gallery' },
  { id: 6, label: 'Music' },
  { id: 7, label: 'Sections' },
  { id: 8, label: 'Digital Gift' },
  { id: 9, label: 'Guest Links' },
  { id: 10, label: 'Preview & Publish' },
];

export function EditorPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const { user, loading, authReady } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [inv, setInv] = useState<InvitationDoc | null>(null);
  const [savedSlug, setSavedSlug] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [step, setStep] = useState(1);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('All changes saved');
  const [slugError, setSlugError] = useState<string | null>(null);

  // Preview states
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [previewOpenState, setPreviewOpenState] = useState(true);
  const [mobileShowPreview, setMobileShowPreview] = useState(false);

  // Gallery multi-upload
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Step 6 music tester
  const musicTestRef = useRef<WeddingAudioController | null>(null);
  const [musicTesting, setMusicTesting] = useState(false);

  // Step 9 inline guest list
  const [guests, setGuests] = useState<GuestDoc[]>([]);
  const [quickGuestName, setQuickGuestName] = useState('');
  const [quickGuestGroup, setQuickGuestGroup] = useState('Friends & Family');

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
      .then((doc) => {
        if (!mounted) return;
        if (!doc || doc.ownerId !== user.uid) {
          showToast('Invitation not found or unauthorized.', 'error');
          navigate('/dashboard', { replace: true });
          return;
        }
        setInv(doc);
        setSavedSlug(doc.slug);
        setPageLoading(false);
      })
      .catch(() => {
        if (mounted) navigate('/dashboard', { replace: true });
      });

    const unsubG = subscribeOwnerGuests(user.uid, invitationId, setGuests);
    return () => {
      mounted = false;
      unsubG();
    };
  }, [user, invitationId, navigate, showToast]);

  useEffect(() => {
    const ctrl = new WeddingAudioController((playing) => setMusicTesting(playing));
    musicTestRef.current = ctrl;
    return () => {
      ctrl.destroy();
      musicTestRef.current = null;
    };
  }, []);

  const updateInv = (updater: (prev: InvitationDoc) => InvitationDoc) => {
    setInv((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setDirty(true);
    setLastSavedText('Unsaved changes...');
  };

  // Debounced autosave to Firestore
  useEffect(() => {
    if (!dirty || !inv) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await saveInvitationChanges(inv, savedSlug);
        setSavedSlug(inv.slug);
        setDirty(false);
        setSlugError(null);
        setLastSavedText(
          `Saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Autosave paused';
        if (msg.toLowerCase().includes('slug')) {
          setSlugError(msg);
        }
        setLastSavedText('Save paused — check details');
      } finally {
        setSaving(false);
      }
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [dirty, inv, savedSlug]);

  const handleManualSave = async () => {
    if (!inv) return;
    setSaving(true);
    setSlugError(null);
    try {
      await saveInvitationChanges(inv, savedSlug);
      setSavedSlug(inv.slug);
      setDirty(false);
      setLastSavedText('Saved to cloud');
      showToast('Draft saved to Firestore.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft.';
      if (msg.toLowerCase().includes('slug')) setSlugError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!inv) return;
    setSaving(true);
    try {
      if (dirty) {
        await saveInvitationChanges(inv, savedSlug);
        setSavedSlug(inv.slug);
        setDirty(false);
      }
      const nextStatus = await toggleInvitationStatus(inv);
      setInv((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      showToast(
        nextStatus === 'published'
          ? `Invitation published! Public link active at /wedding/${inv.slug}`
          : 'Invitation unpublished (returned to Draft).',
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Publish failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSlugBlur = async () => {
    if (!inv) return;
    const cleaned = sanitizeSlug(inv.slug);
    if (cleaned !== inv.slug) {
      updateInv((p) => ({ ...p, slug: cleaned }));
    }
    if (cleaned.length < 3) {
      setSlugError('URL slug must be at least 3 characters.');
      return;
    }
    const free = await isSlugAvailable(cleaned, inv.invitationId);
    setSlugError(free ? null : 'This slug is already claimed by another wedding.');
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !inv) return;
    setGalleryUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files.slice(0, Math.max(0, 20 - inv.gallery.length))) {
        const res = await uploadMediaFile(file, 'image', inv.invitationId, 'gallery');
        uploadedUrls.push(res.url);
      }
      if (uploadedUrls.length > 0) {
        updateInv((p) => ({
          ...p,
          gallery: [...p.gallery, ...uploadedUrls].slice(0, 20),
        }));
        showToast(`Uploaded ${uploadedUrls.length} gallery photo(s).`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gallery upload failed.', 'error');
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const moveGalleryItem = (index: number, dir: -1 | 1) => {
    if (!inv) return;
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= inv.gallery.length) return;
    const arr = [...inv.gallery];
    const [item] = arr.splice(index, 1);
    arr.splice(nextIdx, 0, item);
    updateInv((p) => ({ ...p, gallery: arr }));
  };

  const handleQuickAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inv || !quickGuestName.trim()) return;
    try {
      await addSingleGuest({
        invitationId: inv.invitationId,
        ownerId: user.uid,
        slug: inv.slug,
        guestName: quickGuestName,
        guestGroup: quickGuestGroup,
      });
      setQuickGuestName('');
      showToast('Guest link created.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add guest.', 'error');
    }
  };

  const publicUrl = useMemo(() => {
    if (!inv) return '';
    return `${window.location.origin}/wedding/${inv.slug}`;
  }, [inv]);

  if (pageLoading || loading || !authReady) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-sm text-[#737C68]">
        Opening Invitation Builder...
      </div>
    );
  }

  if (!inv) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#443C35] font-dm-sans">
      {/* EDITOR TOP BAR */}
      <header className="bg-white border-b border-[#E5DDD0] px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-[#737C68] hover:text-[#443C35] shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-[#DCD3C6]">/</span>
          <div className="min-w-0">
            <p className="font-cormorant text-lg font-semibold truncate">
              {inv.groomData.nickname || 'Groom'} &amp; {inv.brideData.nickname || 'Bride'}
            </p>
            <p className="text-[11px] text-[#737C68] truncate">
              {saving ? 'Saving to cloud...' : lastSavedText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileShowPreview((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#DCD3C6] rounded-lg"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{mobileShowPreview ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleManualSave}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#FAF7F2] border border-[#DCD3C6] rounded-lg hover:bg-[#F1EAE0] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleTogglePublish}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer ${
              inv.status === 'published'
                ? 'bg-[#737C68] text-white hover:bg-[#5E6755]'
                : 'bg-[#443C35] text-white hover:bg-[#5A5047]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{inv.status === 'published' ? 'Published' : 'Publish'}</span>
          </button>
        </div>
      </header>

      {/* STEP PROGRESS BAR */}
      <div className="bg-white border-b border-[#E5DDD0] px-4 sm:px-6 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {WIZARD_STEPS.map((s) => {
            const active = s.id === step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStep(s.id);
                  setMobileShowPreview(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#443C35] text-[#FAF7F2]'
                    : 'text-[#443C35]/70 hover:bg-[#FAF7F2] hover:text-[#443C35]'
                }`}
              >
                <span className="font-mono-num opacity-70 mr-1">{s.id}.</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SPLIT STUDIO WORKSPACE: LEFT WIZARD + RIGHT LIVE PREVIEW */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* LEFT WIZARD FORM */}
        <div
          className={`lg:col-span-6 xl:col-span-5 bg-white border-r border-[#E5DDD0] p-6 sm:p-8 overflow-y-auto ${
            mobileShowPreview ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="max-w-xl mx-auto space-y-6">
            {/* STEP 1 — TEMPLATE */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 01</p>
                  <h2 className="font-cormorant text-3xl font-medium">Choose Your Template</h2>
                  <p className="text-xs text-[#443C35]/70 mt-1">
                    Switch templates anytime — your couple data, story, and photos stay preserved.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {WEDDING_TEMPLATES.map((tpl) => {
                    const selected = inv.templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => updateInv((p) => ({ ...p, templateId: tpl.id as TemplateId }))}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'border-[#443C35] bg-[#FAF7F2] ring-1 ring-[#443C35]'
                            : 'border-[#E5DDD0] bg-white hover:border-[#C6AC83]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-cormorant text-xl font-semibold">{tpl.name}</span>
                          <div className="flex items-center gap-1">
                            <span
                              className="w-3 h-3 rounded-full border border-black/10"
                              style={{ backgroundColor: tpl.bgCanvas }}
                            />
                            <span
                              className="w-3 h-3 rounded-full border border-black/10"
                              style={{ backgroundColor: tpl.accent }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-[#737C68]">{tpl.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2 — COUPLE */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 02</p>
                  <h2 className="font-cormorant text-3xl font-medium">Couple Profiles</h2>
                </div>

                <div className="space-y-4 pb-5 border-b border-[#EDE6DA]">
                  <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                    Groom Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Full Name</label>
                      <input
                        type="text"
                        maxLength={100}
                        value={inv.groomData.fullName}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            groomData: { ...p.groomData, fullName: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Nickname</label>
                      <input
                        type="text"
                        maxLength={50}
                        value={inv.groomData.nickname}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            groomData: { ...p.groomData, nickname: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Parents</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={inv.groomData.parents}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          groomData: { ...p.groomData, parents: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Instagram (Optional)</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={inv.groomData.instagram || ''}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          groomData: { ...p.groomData, instagram: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <MediaUploadField
                    label="Groom Portrait Photo"
                    kind="image"
                    value={inv.groomData.photoUrl}
                    invitationId={inv.invitationId}
                    folder="couple"
                    onChange={(url) =>
                      updateInv((p) => ({ ...p, groomData: { ...p.groomData, photoUrl: url } }))
                    }
                  />
                </div>

                <div className="space-y-4 pb-5 border-b border-[#EDE6DA]">
                  <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                    Bride Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Full Name</label>
                      <input
                        type="text"
                        maxLength={100}
                        value={inv.brideData.fullName}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            brideData: { ...p.brideData, fullName: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Nickname</label>
                      <input
                        type="text"
                        maxLength={50}
                        value={inv.brideData.nickname}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            brideData: { ...p.brideData, nickname: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Parents</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={inv.brideData.parents}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          brideData: { ...p.brideData, parents: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Instagram (Optional)</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={inv.brideData.instagram || ''}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          brideData: { ...p.brideData, instagram: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <MediaUploadField
                    label="Bride Portrait Photo"
                    kind="image"
                    value={inv.brideData.photoUrl}
                    invitationId={inv.invitationId}
                    folder="couple"
                    onChange={(url) =>
                      updateInv((p) => ({ ...p, brideData: { ...p.brideData, photoUrl: url } }))
                    }
                  />
                </div>

                <div className="space-y-4">
                  <MediaUploadField
                    label="Main Couple Hero & Cover Photo"
                    kind="image"
                    value={inv.mainCouplePhoto}
                    invitationId={inv.invitationId}
                    folder="couple"
                    onChange={(url) => updateInv((p) => ({ ...p, mainCouplePhoto: url }))}
                  />
                  <MediaUploadField
                    label="Closing Footer Photo"
                    kind="image"
                    value={inv.closingPhoto}
                    invitationId={inv.invitationId}
                    folder="couple"
                    onChange={(url) => updateInv((p) => ({ ...p, closingPhoto: url }))}
                  />
                </div>
              </div>
            )}

            {/* STEP 3 — EVENT */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 03</p>
                  <h2 className="font-cormorant text-3xl font-medium">Event Details &amp; URL</h2>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5DDD0] space-y-2">
                  <label className="block text-xs font-medium">Custom Invitation URL Slug</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#737C68] shrink-0">/wedding/</span>
                    <input
                      type="text"
                      maxLength={80}
                      value={inv.slug}
                      onChange={(e) =>
                        updateInv((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))
                      }
                      onBlur={handleSlugBlur}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-[#DCD3C6] rounded-lg font-mono-num"
                    />
                  </div>
                  {slugError && <p className="text-xs text-[#8B2626]">{slugError}</p>}
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-medium">Timezone</label>
                  <select
                    value={inv.eventData.timezone}
                    onChange={(e) =>
                      updateInv((p) => ({
                        ...p,
                        eventData: { ...p.eventData, timezone: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  </select>
                </div>

                {/* Akad */}
                <div className="space-y-3 pb-5 border-b border-[#EDE6DA]">
                  <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                    Akad / Ceremony
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Date</label>
                      <input
                        type="date"
                        value={inv.eventData.akad.date}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: { ...p.eventData, akad: { ...p.eventData.akad, date: e.target.value } },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Start Time</label>
                      <input
                        type="time"
                        value={inv.eventData.akad.startTime}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: {
                              ...p.eventData,
                              akad: { ...p.eventData.akad, startTime: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">End Time</label>
                      <input
                        type="time"
                        value={inv.eventData.akad.endTime || ''}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: {
                              ...p.eventData,
                              akad: { ...p.eventData.akad, endTime: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Venue Name</label>
                    <input
                      type="text"
                      maxLength={150}
                      value={inv.eventData.akad.venue}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: { ...p.eventData, akad: { ...p.eventData.akad, venue: e.target.value } },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Full Address</label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={inv.eventData.akad.address}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: { ...p.eventData, akad: { ...p.eventData.akad, address: e.target.value } },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Google Maps URL</label>
                    <input
                      type="url"
                      maxLength={500}
                      value={inv.eventData.akad.mapsUrl}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: { ...p.eventData, akad: { ...p.eventData.akad, mapsUrl: e.target.value } },
                        }))
                      }
                      placeholder="https://maps.google.com/?q=..."
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                </div>

                {/* Reception */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                    Wedding Reception
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Date</label>
                      <input
                        type="date"
                        value={inv.eventData.reception.date}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: {
                              ...p.eventData,
                              reception: { ...p.eventData.reception, date: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Start Time</label>
                      <input
                        type="time"
                        value={inv.eventData.reception.startTime}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: {
                              ...p.eventData,
                              reception: { ...p.eventData.reception, startTime: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">End Time</label>
                      <input
                        type="time"
                        value={inv.eventData.reception.endTime || ''}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            eventData: {
                              ...p.eventData,
                              reception: { ...p.eventData.reception, endTime: e.target.value },
                            },
                          }))
                        }
                        className="w-full px-2.5 py-2 text-xs border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Venue Name</label>
                    <input
                      type="text"
                      maxLength={150}
                      value={inv.eventData.reception.venue}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: {
                            ...p.eventData,
                            reception: { ...p.eventData.reception, venue: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Full Address</label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={inv.eventData.reception.address}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: {
                            ...p.eventData,
                            reception: { ...p.eventData.reception, address: e.target.value },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Google Maps URL</label>
                    <input
                      type="url"
                      maxLength={500}
                      value={inv.eventData.reception.mapsUrl}
                      onChange={(e) =>
                        updateInv((p) => ({
                          ...p,
                          eventData: {
                            ...p.eventData,
                            reception: { ...p.eventData.reception, mapsUrl: e.target.value },
                          },
                        }))
                      }
                      placeholder="https://maps.google.com/?q=..."
                      className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 — STORY */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 04</p>
                  <h2 className="font-cormorant text-3xl font-medium">Love Story &amp; Quote</h2>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Romantic Quote or Verse</label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={inv.storyData.quote}
                    onChange={(e) =>
                      updateInv((p) => ({ ...p, storyData: { ...p.storyData, quote: e.target.value } }))
                    }
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Quote Source (Optional)</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={inv.storyData.quoteSource || ''}
                    onChange={(e) =>
                      updateInv((p) => ({
                        ...p,
                        storyData: { ...p.storyData, quoteSource: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Opening Welcome Message</label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={inv.storyData.openingMessage}
                    onChange={(e) =>
                      updateInv((p) => ({
                        ...p,
                        storyData: { ...p.storyData, openingMessage: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  />
                </div>

                <div className="pt-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                      Timeline Milestones ({inv.storyData.milestones.length}/10)
                    </h3>
                    {inv.storyData.milestones.length < 10 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateInv((p) => ({
                            ...p,
                            storyData: {
                              ...p.storyData,
                              milestones: [
                                ...p.storyData.milestones,
                                {
                                  id: `ms-${Date.now()}`,
                                  title: 'New Milestone',
                                  date: '2026',
                                  description: '',
                                  photoUrl: '',
                                },
                              ],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#DCD3C6] rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Milestone</span>
                      </button>
                    )}
                  </div>

                  {inv.storyData.milestones.map((ms, idx) => (
                    <div key={ms.id} className="p-4 rounded-xl border border-[#E5DDD0] space-y-3 bg-[#FAF7F2]/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#737C68]">Milestone #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateInv((p) => ({
                              ...p,
                              storyData: {
                                ...p.storyData,
                                milestones: p.storyData.milestones.filter((m) => m.id !== ms.id),
                              },
                            }))
                          }
                          className="text-xs text-[#8B3A3A] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={ms.title}
                          placeholder="Title (e.g. First Meet)"
                          onChange={(e) =>
                            updateInv((p) => ({
                              ...p,
                              storyData: {
                                ...p.storyData,
                                milestones: p.storyData.milestones.map((m) =>
                                  m.id === ms.id ? { ...m, title: e.target.value } : m
                                ),
                              },
                            }))
                          }
                          className="px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                        />
                        <input
                          type="text"
                          value={ms.date}
                          placeholder="Date (e.g. Oct 2023)"
                          onChange={(e) =>
                            updateInv((p) => ({
                              ...p,
                              storyData: {
                                ...p.storyData,
                                milestones: p.storyData.milestones.map((m) =>
                                  m.id === ms.id ? { ...m, date: e.target.value } : m
                                ),
                              },
                            }))
                          }
                          className="px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={ms.description}
                        placeholder="Describe this chapter..."
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            storyData: {
                              ...p.storyData,
                              milestones: p.storyData.milestones.map((m) =>
                                m.id === ms.id ? { ...m, description: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                      />
                      <MediaUploadField
                        label="Milestone Photo"
                        kind="image"
                        value={ms.photoUrl}
                        invitationId={inv.invitationId}
                        folder="story"
                        onChange={(url) =>
                          updateInv((p) => ({
                            ...p,
                            storyData: {
                              ...p.storyData,
                              milestones: p.storyData.milestones.map((m) =>
                                m.id === ms.id ? { ...m, photoUrl: url } : m
                              ),
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5 — GALLERY */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 05</p>
                  <h2 className="font-cormorant text-3xl font-medium">Photo Gallery</h2>
                  <p className="text-xs text-[#443C35]/70 mt-1">
                    Upload up to 20 engagement portraits, reorder display sequence, or remove photos.
                  </p>
                </div>

                <div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={galleryUploading || inv.gallery.length >= 20}
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-[#D8CFC2] rounded-xl bg-[#FAF7F2] hover:bg-[#F1EAE0] transition-colors flex flex-col items-center justify-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5 text-[#737C68]" />
                    <span>
                      {galleryUploading
                        ? 'Uploading photos...'
                        : `Upload Photos (${inv.gallery.length}/20)`}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {inv.gallery.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="border border-[#E5DDD0] rounded-xl overflow-hidden bg-white"
                    >
                      <div className="aspect-[3/4]">
                        <ResilientImage
                          src={url}
                          alt={`Gallery item ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-1.5 flex items-center justify-between border-t border-[#F1EAE0]">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveGalleryItem(idx, -1)}
                            className="p-1 rounded hover:bg-[#FAF7F2] disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === inv.gallery.length - 1}
                            onClick={() => moveGalleryItem(idx, 1)}
                            className="p-1 rounded hover:bg-[#FAF7F2] disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateInv((p) => ({
                              ...p,
                              gallery: p.gallery.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1 rounded hover:bg-[#FDF2F2] text-[#8B3A3A]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6 — MUSIC */}
            {step === 6 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 06</p>
                  <h2 className="font-cormorant text-3xl font-medium">Background Music</h2>
                  <p className="text-xs text-[#443C35]/70 mt-1">
                    Music begins gracefully after your guest taps Open Invitation.
                  </p>
                </div>

                <label className="flex items-center justify-between p-4 rounded-xl border border-[#E5DDD0] bg-[#FAF7F2]">
                  <span className="text-sm font-medium">Enable Background Music</span>
                  <input
                    type="checkbox"
                    checked={inv.musicData.enabled}
                    onChange={(e) =>
                      updateInv((p) => ({
                        ...p,
                        musicData: { ...p.musicData, enabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-[#443C35]"
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#737C68]">Curated WEDLINK Chamber Tracks</p>
                  <div className="space-y-2">
                    {CURATED_MUSIC_TRACKS.map((track) => {
                      const active = inv.musicData.url === track.url;
                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() =>
                            updateInv((p) => ({
                              ...p,
                              musicData: {
                                ...p.musicData,
                                title: track.title,
                                artist: track.artist,
                                url: track.url,
                              },
                            }))
                          }
                          className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                            active
                              ? 'border-[#443C35] bg-[#FAF7F2]'
                              : 'border-[#E5DDD0] bg-white hover:border-[#C6AC83]'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">{track.title}</p>
                            <p className="text-xs text-[#737C68]">{track.mood}</p>
                          </div>
                          {active && <Check className="w-4 h-4 text-[#443C35]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <MediaUploadField
                  label="Or Upload Custom MP3 / Audio File"
                  kind="audio"
                  value={inv.musicData.url.startsWith('builtin:') ? '' : inv.musicData.url}
                  invitationId={inv.invitationId}
                  folder="music"
                  onChange={(url) =>
                    updateInv((p) => ({
                      ...p,
                      musicData: {
                        ...p.musicData,
                        url: url || CURATED_MUSIC_TRACKS[0].url,
                        title: url ? 'Custom Wedding Track' : CURATED_MUSIC_TRACKS[0].title,
                      },
                    }))
                  }
                />

                <div className="p-4 rounded-xl border border-[#E5DDD0] bg-[#FAF7F2] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Preview Audio &amp; Volume</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!musicTestRef.current) return;
                        if (musicTesting) musicTestRef.current.pause();
                        else void musicTestRef.current.play(inv.musicData.url, inv.musicData.volume);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#443C35] text-white text-xs rounded-lg"
                    >
                      {musicTesting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{musicTesting ? 'Pause' : 'Play Sample'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#737C68] tabular-nums w-12">
                      {Math.round(inv.musicData.volume * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={inv.musicData.volume}
                      onChange={(e) => {
                        const vol = Number(e.target.value);
                        musicTestRef.current?.setVolume(vol);
                        updateInv((p) => ({
                          ...p,
                          musicData: { ...p.musicData, volume: vol },
                        }));
                      }}
                      className="flex-1 accent-[#443C35]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7 — SECTIONS */}
            {step === 7 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 07</p>
                  <h2 className="font-cormorant text-3xl font-medium">Visible Sections</h2>
                  <p className="text-xs text-[#443C35]/70 mt-1">
                    Toggle which sections appear on your published wedding website.
                  </p>
                </div>

                <div className="divide-y divide-[#EDE6DA] border border-[#E5DDD0] rounded-xl overflow-hidden">
                  {(
                    [
                      ['couple', 'Couple Profiles (Groom & Bride)'],
                      ['story', 'Love Story Timeline'],
                      ['countdown', 'Live Wedding Countdown'],
                      ['event', 'Event Itinerary & Google Maps'],
                      ['gallery', 'Photo Gallery & Lightbox'],
                      ['rsvp', 'RSVP Attendance Form'],
                      ['wishes', 'Guestbook & Wedding Wishes'],
                      ['gift', 'Digital Gift & QRIS Envelope'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between px-4 py-3.5 bg-white hover:bg-[#FAF7F2] cursor-pointer"
                    >
                      <span className="text-sm">{label}</span>
                      <input
                        type="checkbox"
                        checked={inv.enabledSections[key]}
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            enabledSections: {
                              ...p.enabledSections,
                              [key]: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 accent-[#443C35]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 8 — DIGITAL GIFT */}
            {step === 8 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 08</p>
                  <h2 className="font-cormorant text-3xl font-medium">Digital Gift &amp; QRIS</h2>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Gift Note to Guests</label>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={inv.giftData.message}
                    onChange={(e) =>
                      updateInv((p) => ({
                        ...p,
                        giftData: { ...p.giftData, message: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border border-[#DCD3C6] rounded-lg"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest text-[#737C68] font-semibold">
                      Bank Accounts ({inv.giftData.accounts.length}/6)
                    </h3>
                    {inv.giftData.accounts.length < 6 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateInv((p) => ({
                            ...p,
                            giftData: {
                              ...p.giftData,
                              accounts: [
                                ...p.giftData.accounts,
                                {
                                  id: `bank-${Date.now()}`,
                                  bankName: 'Bank BCA',
                                  accountNumber: '',
                                  accountHolder: '',
                                },
                              ],
                            },
                          }))
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-[#DCD3C6] rounded-lg bg-[#FAF7F2]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Account</span>
                      </button>
                    )}
                  </div>

                  {inv.giftData.accounts.map((acc) => (
                    <div key={acc.id} className="p-4 rounded-xl border border-[#E5DDD0] space-y-2.5 bg-[#FAF7F2]/50">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-[#737C68]">Bank Details</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateInv((p) => ({
                              ...p,
                              giftData: {
                                ...p.giftData,
                                accounts: p.giftData.accounts.filter((a) => a.id !== acc.id),
                              },
                            }))
                          }
                          className="text-xs text-[#8B3A3A] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={acc.bankName}
                        placeholder="Bank Name (e.g. BCA / Mandiri)"
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            giftData: {
                              ...p.giftData,
                              accounts: p.giftData.accounts.map((a) =>
                                a.id === acc.id ? { ...a, bankName: e.target.value } : a
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                      />
                      <input
                        type="text"
                        value={acc.accountNumber}
                        placeholder="Account Number"
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            giftData: {
                              ...p.giftData,
                              accounts: p.giftData.accounts.map((a) =>
                                a.id === acc.id ? { ...a, accountNumber: e.target.value } : a
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg font-mono-num"
                      />
                      <input
                        type="text"
                        value={acc.accountHolder}
                        placeholder="Account Holder Name"
                        onChange={(e) =>
                          updateInv((p) => ({
                            ...p,
                            giftData: {
                              ...p.giftData,
                              accounts: p.giftData.accounts.map((a) =>
                                a.id === acc.id ? { ...a, accountHolder: e.target.value } : a
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                      />
                    </div>
                  ))}
                </div>

                <MediaUploadField
                  label="QRIS Code Image (Optional)"
                  kind="image"
                  value={inv.giftData.qrisUrl}
                  invitationId={inv.invitationId}
                  folder="qris"
                  onChange={(url) =>
                    updateInv((p) => ({ ...p, giftData: { ...p.giftData, qrisUrl: url } }))
                  }
                />
              </div>
            )}

            {/* STEP 9 — GUEST LINKS */}
            {step === 9 && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 09</p>
                    <h2 className="font-cormorant text-3xl font-medium">Personalized Guest Links</h2>
                  </div>
                  <Link
                    to={`/guests/${inv.invitationId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#DCD3C6] rounded-lg hover:bg-[#FAF7F2] shrink-0"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Bulk CSV &amp; RSVP</span>
                  </Link>
                </div>

                <form onSubmit={handleQuickAddGuest} className="space-y-2.5 p-4 rounded-xl bg-[#FAF7F2] border border-[#E5DDD0]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={quickGuestName}
                      onChange={(e) => setQuickGuestName(e.target.value)}
                      placeholder="Guest Name (e.g. Mr. John)"
                      className="px-3 py-2 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                    />
                    <input
                      type="text"
                      value={quickGuestGroup}
                      onChange={(e) => setQuickGuestGroup(e.target.value)}
                      placeholder="Group"
                      className="px-3 py-2 text-xs bg-white border border-[#DCD3C6] rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#443C35] text-white text-xs font-medium rounded-lg hover:bg-[#5A5047]"
                  >
                    + Generate Personalized Guest Link
                  </button>
                </form>

                <div className="space-y-2">
                  {guests.length === 0 ? (
                    <p className="text-xs text-[#737C68] py-4 text-center">
                      No guests added yet. Add a guest above or open the Bulk CSV Console.
                    </p>
                  ) : (
                    guests.slice(0, 10).map((g) => {
                      const url = buildGuestUrl(inv.slug, g.guestName);
                      const waUrl = buildWhatsAppShareUrl(
                        g.guestName,
                        inv.brideData.nickname,
                        inv.groomData.nickname,
                        inv.eventData.akad.date || inv.eventData.reception.date,
                        url
                      );
                      return (
                        <div
                          key={g.guestId}
                          className="p-3 rounded-xl border border-[#E5DDD0] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{g.guestName}</p>
                            <p className="text-[11px] text-[#737C68] truncate">{url}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(url);
                                showToast('Guest link copied.', 'success');
                              }}
                              className="p-1.5 rounded hover:bg-[#FAF7F2]"
                              title="Copy link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-[#FAF7F2] text-[#4B5B48]"
                              title="Share on WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STEP 10 — PREVIEW & PUBLISH */}
            {step === 10 && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase text-[#737C68]">Step 10</p>
                  <h2 className="font-cormorant text-3xl font-medium">Preview &amp; Publish</h2>
                </div>

                <div className="p-5 rounded-2xl border border-[#E5DDD0] bg-[#FAF7F2] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#737C68]">Publication Status</p>
                      <p className="text-base font-semibold">
                        {inv.status === 'published' ? 'Published (Live Publicly)' : 'Draft (Private)'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleTogglePublish}
                      className="px-4 py-2 bg-[#443C35] text-white text-xs font-medium rounded-lg hover:bg-[#5A5047]"
                    >
                      {inv.status === 'published' ? 'Unpublish to Draft' : 'Publish Invitation'}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#737C68]">Public Wedding URL</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={publicUrl}
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#DCD3C6] rounded-lg font-mono-num"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(publicUrl);
                          showToast('Public link copied!', 'success');
                        }}
                        className="px-3 py-2 bg-white border border-[#DCD3C6] text-xs rounded-lg hover:bg-[#F1EAE0]"
                      >
                        Copy
                      </button>
                      <a
                        href={`/wedding/${inv.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-[#737C68] text-white text-xs rounded-lg inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#E5DDD0] text-xs text-[#443C35]/80 space-y-2 leading-relaxed">
                  <p className="font-semibold text-[#443C35]">Hosting &amp; Custom Domain Notes</p>
                  <p>
                    Published invitations are served live directly from your Google Cloud Run / AI Studio hosting domain at{' '}
                    <code className="bg-[#FAF7F2] px-1 rounded">/wedding/{inv.slug}</code> backed by Cloud Firestore persistence.
                  </p>
                  <p>
                    To connect a custom domain (e.g., <code>adityaandnabila.com</code>), map your domain in Google Cloud Run Domain Mappings or Firebase Hosting rewrites to this deployed service.
                  </p>
                </div>
              </div>
            )}

            {/* WIZARD FOOTER NAV */}
            <div className="pt-6 border-t border-[#EDE6DA] flex items-center justify-between">
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[#DCD3C6] rounded-lg disabled:opacity-35 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {step < 10 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(10, s + 1))}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium bg-[#443C35] text-white rounded-lg hover:bg-[#5A5047] cursor-pointer"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTogglePublish}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium bg-[#737C68] text-white rounded-lg hover:bg-[#5E6755] cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{inv.status === 'published' ? 'Update Live Site' : 'Publish Now'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT REAL-TIME LIVE PREVIEW */}
        <div
          className={`lg:col-span-6 xl:col-span-7 bg-[#EFE8DC] flex flex-col ${
            mobileShowPreview ? 'block' : 'hidden lg:flex'
          } ${fullscreenPreview ? 'fixed inset-0 z-50' : ''}`}
        >
          <div className="bg-[#FAF7F2] border-b border-[#E5DDD0] px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#F1EAE0] rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewMode('mobile')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${
                    previewMode === 'mobile' ? 'bg-white shadow-sm font-medium' : 'opacity-70'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('desktop')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md ${
                    previewMode === 'desktop' ? 'bg-white shadow-sm font-medium' : 'opacity-70'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewOpenState((v) => !v)}
                className="px-2.5 py-1 text-xs border border-[#DCD3C6] bg-white rounded-md hover:bg-[#FAF7F2]"
              >
                {previewOpenState ? 'View Cover' : 'View Inside'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFullscreenPreview((f) => !f)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#DCD3C6] bg-white rounded-md hover:bg-[#FAF7F2]"
            >
              {fullscreenPreview ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
            <div
              className={`bg-white shadow-xl overflow-y-auto transition-all duration-300 ${
                previewMode === 'mobile'
                  ? 'w-full max-w-[390px] rounded-[28px] border-4 border-[#2C2622] max-h-[82vh]'
                  : 'w-full max-w-4xl rounded-xl border border-[#DCD3C6] max-h-[82vh]'
              }`}
            >
              <InvitationRenderer
                invitation={inv}
                guestName="Mr. Alexander Tan"
                isPreview
                compactFrame
                defaultOpened={previewOpenState}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
