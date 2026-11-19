import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Disc3,
  Heart,
  MapPin,
  Pause,
  Play,
  QrCode,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { getTemplateById } from '../data/templates';
import { InvitationDoc, WishDoc } from '../types/wedding';
import { WeddingAudioController } from '../utils/audioEngine';
import {
  downloadCalendarIcs,
  formatReadableDate,
  getTimezoneMeta,
  isValidHttpOrLocalUrl,
} from '../utils/sanitize';
import { fetchPublicWishes, submitPublicRsvp, submitPublicWish, toMillis } from '../services/weddingService';
import { BotanicalOrnament } from './BotanicalOrnament';
import { ResilientImage } from './ResilientImage';
import { useToast } from '../contexts/ToastContext';

interface InvitationRendererProps {
  invitation: InvitationDoc;
  guestName?: string;
  isPreview?: boolean;
  compactFrame?: boolean;
  defaultOpened?: boolean;
}

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
}

function computeCountdown(dateStr: string, timeStr: string, offset: string): CountdownValues {
  if (!dateStr) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: false };
  }
  const targetIso = `${dateStr}T${timeStr || '09:00'}:00${offset}`;
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: false };
  }
  const diff = targetMs - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, passed: false };
}

export function InvitationRenderer({
  invitation,
  guestName,
  isPreview = false,
  compactFrame = false,
  defaultOpened = false,
}: InvitationRendererProps) {
  const template = useMemo(() => getTemplateById(invitation.templateId), [invitation.templateId]);
  const tzMeta = useMemo(
    () => getTimezoneMeta(invitation.eventData.timezone),
    [invitation.eventData.timezone]
  );
  const { showToast } = useToast();

  // Opening cover state (starts closed on live/preview; smooth open triggers music)
  const [opened, setOpened] = useState(defaultOpened);

  useEffect(() => {
    setOpened(defaultOpened);
  }, [defaultOpened]);

  // Countdown timer synchronized with selected Indonesian timezone
  const targetDate = invitation.eventData.akad.date || invitation.eventData.reception.date;
  const targetTime = invitation.eventData.akad.startTime || invitation.eventData.reception.startTime;
  const [countdown, setCountdown] = useState<CountdownValues>(() =>
    computeCountdown(targetDate, targetTime, tzMeta.offset)
  );

  useEffect(() => {
    setCountdown(computeCountdown(targetDate, targetTime, tzMeta.offset));
    const timer = window.setInterval(() => {
      setCountdown(computeCountdown(targetDate, targetTime, tzMeta.offset));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetDate, targetTime, tzMeta.offset]);

  // Audio player state
  const audioCtrlRef = useRef<WeddingAudioController | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(invitation.musicData.volume ?? 0.65);
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    const ctrl = new WeddingAudioController((playing, err) => {
      isPlayingRef.current = playing;
      setIsPlaying(playing);
      setAudioError(err);
    });
    audioCtrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      audioCtrlRef.current = null;
    };
  }, []);

  const volumeRef = useRef<number>(invitation.musicData.volume ?? 0.65);

  useEffect(() => {
    const v = invitation.musicData.volume ?? 0.65;
    volumeRef.current = v;
    setVolume(v);
    audioCtrlRef.current?.setVolume(v);
  }, [invitation.musicData.volume]);

  useEffect(() => {
    if (!invitation.musicData.enabled) {
      audioCtrlRef.current?.pause();
    } else if (isPlayingRef.current && invitation.musicData.url && audioCtrlRef.current) {
      void audioCtrlRef.current.play(invitation.musicData.url, volumeRef.current);
    }
  }, [invitation.musicData.enabled, invitation.musicData.url]);

  const handleOpenInvitation = () => {
    setOpened(true);
    if (invitation.musicData.enabled && invitation.musicData.url && audioCtrlRef.current) {
      void audioCtrlRef.current.play(invitation.musicData.url, volume);
    }
  };

  const toggleMusic = () => {
    if (!audioCtrlRef.current) return;
    if (isPlaying) {
      audioCtrlRef.current.pause();
    } else {
      void audioCtrlRef.current.play(invitation.musicData.url, volume);
    }
  };

  const handleVolumeChange = (nextVol: number) => {
    setVolume(nextVol);
    audioCtrlRef.current?.setVolume(nextVol);
  };

  // Gallery Lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') {
        setLightboxIdx((i) => (i === null ? null : (i + 1) % invitation.gallery.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((i) =>
          i === null ? null : (i - 1 + invitation.gallery.length) % invitation.gallery.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIdx, invitation.gallery.length]);

  // RSVP State
  const [rsvpName, setRsvpName] = useState(guestName || '');
  const [rsvpAttendance, setRsvpAttendance] = useState<'attending' | 'unable'>('attending');
  const [rsvpCount, setRsvpCount] = useState(1);
  const [rsvpMessage, setRsvpMessage] = useState('');
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  useEffect(() => {
    if (lightboxIdx !== null && lightboxIdx >= invitation.gallery.length) {
      setLightboxIdx(null);
    }
  }, [lightboxIdx, invitation.gallery.length]);

  useEffect(() => {
    if (guestName) {
      setRsvpName(guestName);
      setWishName(guestName);
    }
  }, [guestName]);

  useEffect(() => {
    setRsvpSubmitted(false);
    setRsvpError(null);
    setWishes([]);
    setVisibleWishLimit(6);
    setLightboxIdx(null);
    setShowQrisModal(false);
  }, [invitation.invitationId]);

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsvpError(null);
    if (!rsvpName.trim()) {
      setRsvpError('Please enter your full name.');
      return;
    }

    if (invitation.status !== 'published') {
      setRsvpSubmitted(true);
      showToast(
        'Draft preview RSVP recorded locally. Publish invitation to collect real guest RSVPs.',
        'info'
      );
      return;
    }

    setRsvpSubmitting(true);
    try {
      await submitPublicRsvp({
        invitationId: invitation.invitationId,
        ownerId: invitation.ownerId,
        guestName: rsvpName,
        attendance: rsvpAttendance,
        guestCount: rsvpAttendance === 'unable' ? 1 : rsvpCount,
        message: rsvpMessage,
      });
      setRsvpSubmitted(true);
      showToast('Thank you! Your RSVP confirmation has been recorded.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send RSVP right now.';
      setRsvpError(msg);
      showToast('Could not submit RSVP. Please try again.', 'error');
    } finally {
      setRsvpSubmitting(false);
    }
  };

  // Guest Wishes State
  const [wishes, setWishes] = useState<WishDoc[]>([]);
  const [wishesLoading, setWishesLoading] = useState(false);
  const [wishesError, setWishesError] = useState<string | null>(null);
  const [visibleWishLimit, setVisibleWishLimit] = useState(6);
  const [wishName, setWishName] = useState(guestName || '');
  const [wishText, setWishText] = useState('');
  const [wishSubmitting, setWishSubmitting] = useState(false);

  useEffect(() => {
    if (!invitation.invitationId || (isPreview && invitation.status !== 'published')) {
      return;
    }
    let mounted = true;
    setWishesLoading(true);
    setWishesError(null);
    fetchPublicWishes(invitation.invitationId, 60)
      .then((list) => {
        if (mounted) setWishes(list);
      })
      .catch(() => {
        if (mounted) setWishesError('Could not load wedding wishes at this moment.');
      })
      .finally(() => {
        if (mounted) setWishesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [invitation.invitationId, invitation.status, isPreview]);

  const handleWishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishName.trim() || !wishText.trim()) {
      showToast('Please enter your name and wedding blessing.', 'error');
      return;
    }

    if (invitation.status !== 'published') {
      const demoWish: WishDoc = {
        wishId: `preview_${Date.now()}`,
        invitationId: invitation.invitationId,
        ownerId: invitation.ownerId,
        guestName: wishName.trim(),
        message: wishText.trim(),
        isVisible: true,
        createdAt: Date.now(),
      };
      setWishes((prev) => [demoWish, ...prev]);
      setWishText('');
      showToast(
        'Draft preview wish added locally. Publish invitation to persist guest wishes.',
        'info'
      );
      return;
    }

    setWishSubmitting(true);
    try {
      const saved = await submitPublicWish({
        invitationId: invitation.invitationId,
        ownerId: invitation.ownerId,
        guestName: wishName,
        message: wishText,
      });
      setWishes((prev) => [{ ...saved, createdAt: Date.now() }, ...prev]);
      setWishText('');
      showToast('Your warm wishes have been posted to the guestbook.', 'success');
    } catch {
      showToast('Unable to post wish right now. Please try again.', 'error');
    } finally {
      setWishSubmitting(false);
    }
  };

  // Copy bank account state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQrisModal, setShowQrisModal] = useState(false);

  const handleCopyAccount = async (id: string, numberText: string) => {
    try {
      await navigator.clipboard.writeText(numberText);
      setCopiedId(id);
      showToast('Account number copied to clipboard.', 'success');
      window.setTimeout(() => setCopiedId(null), 2200);
    } catch {
      showToast('Copy failed. Please copy manually.', 'error');
    }
  };

  const formattedMainDate = formatReadableDate(
    invitation.eventData.akad.date || invitation.eventData.reception.date
  );
  const groomNick = invitation.groomData.nickname || 'Groom';
  const brideNick = invitation.brideData.nickname || 'Bride';
  const initials = `${groomNick.charAt(0).toUpperCase()} & ${brideNick.charAt(0).toUpperCase()}`;

  const isDarkTheme = template.id === 'golden-hour';
  const isCoverDark = template.bgDarkCover;

  // Render Opening Cover when not opened yet
  if (!opened) {
    return (
      <div
        className={`relative w-full overflow-hidden flex flex-col items-center justify-center text-center px-6 py-12 transition-all duration-500 ${
          compactFrame ? 'min-h-[680px]' : 'min-h-screen'
        } ${template.fontBody}`}
        style={{
          backgroundColor: isCoverDark ? '#1C1917' : template.bgCanvas,
          color: isCoverDark ? '#FAF7F2' : template.textPrimary,
        }}
      >
        {/* Background photography with calibrated contrast scrim */}
        <div className="absolute inset-0">
          <ResilientImage
            src={invitation.mainCouplePhoto}
            alt={`${groomNick} and ${brideNick}`}
            className="w-full h-full object-cover opacity-35"
            lazy={false}
          />
          <div
            className="absolute inset-0"
            style={{
              background: isCoverDark
                ? 'linear-gradient(to bottom, rgba(25,22,20,0.72), rgba(25,22,20,0.88))'
                : `linear-gradient(to bottom, ${template.bgCanvas}CC, ${template.bgCanvas}F2)`,
            }}
          />
        </div>

        {/* Cover inner architectural frame */}
        <div
          className={`relative z-10 max-w-md w-full px-7 py-11 sm:px-10 sm:py-14 ${
            template.coverStyle === 'royal'
              ? 'border-2 border-[#C6AC83]/70 outline outline-1 outline-[#C6AC83]/40 outline-offset-4'
              : template.coverStyle === 'arch'
              ? 'rounded-t-[160px] rounded-b-2xl border'
              : 'rounded-2xl border'
          }`}
          style={{
            borderColor: isCoverDark ? 'rgba(198,172,131,0.45)' : template.border,
            backgroundColor: isCoverDark ? 'rgba(28,25,23,0.72)' : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {template.coverStyle === 'editorial' ? (
            <p className="text-xs tracking-[0.28em] uppercase mb-5" style={{ color: template.accent }}>
              The Wedding Edition
            </p>
          ) : (
            <BotanicalOrnament
              type={template.ornamentType}
              color={isCoverDark ? '#C6AC83' : template.accent}
              className="mb-5"
            />
          )}

          <p
            className="text-xs tracking-[0.22em] uppercase mb-3"
            style={{ color: isCoverDark ? '#C6AC83' : template.textMuted }}
          >
            The Wedding Celebration of
          </p>

          {/* Arched or circular portrait preview on cover */}
          <div
            className={`mx-auto mb-6 overflow-hidden border ${
              template.coverStyle === 'arch'
                ? 'w-40 h-52 rounded-t-full rounded-b-lg'
                : template.coverStyle === 'split'
                ? 'w-48 h-40 rounded-xl'
                : 'w-36 h-36 rounded-full'
            }`}
            style={{ borderColor: isCoverDark ? '#C6AC83' : template.border }}
          >
            <ResilientImage
              src={invitation.mainCouplePhoto}
              alt={`${groomNick} and ${brideNick}`}
              className="w-full h-full object-cover"
              lazy={false}
            />
          </div>

          <h1
            className={`${template.fontDisplay} text-4xl sm:text-5xl font-medium tracking-tight leading-tight mb-2`}
          >
            {groomNick} <span className="italic font-normal text-3xl">&amp;</span> {brideNick}
          </h1>

          <p
            className="text-sm mb-7"
            style={{ color: isCoverDark ? '#E0D5C5' : template.textMuted }}
          >
            {formattedMainDate}
          </p>

          <div
            className="py-4 px-4 mb-7 border-y"
            style={{ borderColor: isCoverDark ? 'rgba(198,172,131,0.28)' : template.border }}
          >
            <p
              className="text-xs tracking-wider uppercase mb-1"
              style={{ color: isCoverDark ? '#C6AC83' : template.textMuted }}
            >
              Dear Honored Guest
            </p>
            <p className={`${template.fontDisplay} text-2xl font-medium`}>
              {guestName || 'Our Beloved Family & Friends'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenInvitation}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3 rounded-lg text-sm font-medium transition-transform duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
            style={{
              backgroundColor: template.accent,
              color: template.accentText,
            }}
          >
            <span>Open Invitation</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${template.fontBody} transition-colors duration-300`}
      style={{
        backgroundColor: template.bgCanvas,
        color: template.textPrimary,
      }}
    >
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden">
        {template.coverStyle === 'split' || template.coverStyle === 'editorial' ? (
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-6 space-y-5 text-center md:text-left">
              <p className="text-xs tracking-[0.25em] uppercase" style={{ color: template.textMuted }}>
                Save the Date · {formattedMainDate}
              </p>
              <h1 className={`${template.fontDisplay} text-5xl sm:text-6xl leading-[1.08] font-medium`}>
                {groomNick}
                <span className="block italic font-normal text-3xl sm:text-4xl my-1" style={{ color: template.accent }}>
                  &amp;
                </span>
                {brideNick}
              </h1>
              <p className="text-sm leading-relaxed max-w-md mx-auto md:mx-0" style={{ color: template.textMuted }}>
                {invitation.storyData.openingMessage}
              </p>
              <BotanicalOrnament type={template.ornamentType} color={template.accent} className="md:mx-0" />
            </div>
            <div className="md:col-span-6">
              <div
                className="aspect-[3/4] overflow-hidden rounded-2xl border shadow-sm"
                style={{ borderColor: template.border }}
              >
                <ResilientImage
                  src={invitation.mainCouplePhoto}
                  alt={`${groomNick} and ${brideNick}`}
                  className="w-full h-full object-cover"
                  lazy={false}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative min-h-[540px] sm:min-h-[620px] flex items-end justify-center text-center px-6 py-16">
            <div className="absolute inset-0">
              <ResilientImage
                src={invitation.mainCouplePhoto}
                alt={`${groomNick} and ${brideNick}`}
                className="w-full h-full object-cover"
                lazy={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
            </div>
            <div className="relative z-10 max-w-2xl text-white pb-4">
              <p className="text-xs tracking-[0.28em] uppercase text-[#F1EAE0] mb-3">
                We Are Getting Married
              </p>
              <h1 className={`${template.fontDisplay} text-5xl sm:text-6xl font-medium tracking-tight mb-3`}>
                {groomNick} &amp; {brideNick}
              </h1>
              <p className="text-sm sm:text-base text-[#FAF7F2]/90 tracking-wide">
                {formattedMainDate} · {invitation.eventData.akad.venue || invitation.eventData.reception.venue}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 2. QUOTE & OPENING MESSAGE */}
      <section
        className="py-16 sm:py-20 px-6 border-y"
        style={{
          backgroundColor: template.bgSurface,
          borderColor: template.border,
          color: template.id === 'the-grand-affair' ? '#FAF7F2' : template.textPrimary,
        }}
      >
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <BotanicalOrnament
            type={template.ornamentType}
            color={template.id === 'the-grand-affair' ? '#C6AC83' : template.accent}
          />
          <blockquote className={`${template.fontDisplay} text-2xl sm:text-3xl italic leading-relaxed`}>
            “{invitation.storyData.quote}”
          </blockquote>
          {invitation.storyData.quoteSource && (
            <p
              className="text-xs tracking-[0.2em] uppercase"
              style={{
                color: template.id === 'the-grand-affair' ? '#C6AC83' : template.textMuted,
              }}
            >
              — {invitation.storyData.quoteSource}
            </p>
          )}
        </div>
      </section>

      {/* 3. COUPLE PROFILE */}
      {invitation.enabledSections.couple && (
        <section className="py-16 sm:py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-2">
              <p className="text-xs tracking-[0.22em] uppercase" style={{ color: template.textMuted }}>
                Groom &amp; Bride
              </p>
              <h2 className={`${template.fontDisplay} text-3xl sm:text-4xl font-medium`}>
                Two Hearts, One Promise
              </h2>
              <p className="text-sm max-w-xl mx-auto pt-2" style={{ color: template.textMuted }}>
                {invitation.storyData.openingMessage}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              {/* Groom */}
              <div className="text-center space-y-4">
                <div
                  className={`mx-auto overflow-hidden border ${
                    template.coverStyle === 'arch' || template.coverStyle === 'botanical'
                      ? 'w-56 h-72 rounded-t-full rounded-b-xl'
                      : 'w-56 h-72 rounded-2xl'
                  }`}
                  style={{ borderColor: template.border }}
                >
                  <ResilientImage
                    src={invitation.groomData.photoUrl}
                    alt={invitation.groomData.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: template.accent }}>
                    The Groom
                  </p>
                  <h3 className={`${template.fontDisplay} text-3xl font-medium`}>
                    {invitation.groomData.fullName}
                  </h3>
                  <p className="text-sm mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: template.textMuted }}>
                    {invitation.groomData.parents}
                  </p>
                  {invitation.groomData.instagram && (
                    <p className="text-xs mt-2 opacity-75">{invitation.groomData.instagram}</p>
                  )}
                </div>
              </div>

              {/* Bride */}
              <div className="text-center space-y-4">
                <div
                  className={`mx-auto overflow-hidden border ${
                    template.coverStyle === 'arch' || template.coverStyle === 'botanical'
                      ? 'w-56 h-72 rounded-t-full rounded-b-xl'
                      : 'w-56 h-72 rounded-2xl'
                  }`}
                  style={{ borderColor: template.border }}
                >
                  <ResilientImage
                    src={invitation.brideData.photoUrl}
                    alt={invitation.brideData.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs tracking-[0.2em] uppercase mb-1" style={{ color: template.accent }}>
                    The Bride
                  </p>
                  <h3 className={`${template.fontDisplay} text-3xl font-medium`}>
                    {invitation.brideData.fullName}
                  </h3>
                  <p className="text-sm mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: template.textMuted }}>
                    {invitation.brideData.parents}
                  </p>
                  {invitation.brideData.instagram && (
                    <p className="text-xs mt-2 opacity-75">{invitation.brideData.instagram}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. COUNTDOWN */}
      {invitation.enabledSections.countdown && (
        <section
          className="py-14 px-6 border-y"
          style={{
            backgroundColor: isDarkTheme ? '#1E1916' : '#F1EAE0',
            borderColor: template.border,
            color: isDarkTheme ? '#FAF7F2' : '#443C35',
          }}
        >
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs tracking-[0.22em] uppercase mb-2 opacity-75">
              Counting Down the Days · {invitation.eventData.timezone || 'Asia/Jakarta'}
            </p>
            <h2 className={`${template.fontDisplay} text-2xl sm:text-3xl mb-8`}>
              {countdown.passed ? 'Today We Celebrate Forever' : 'Until We Say I Do'}
            </h2>
            <div className="grid grid-cols-4 gap-3 sm:gap-6 max-w-lg mx-auto">
              {[
                { label: 'Days', val: countdown.days },
                { label: 'Hours', val: countdown.hours },
                { label: 'Minutes', val: countdown.minutes },
                { label: 'Seconds', val: countdown.seconds },
              ].map((unit) => (
                <div
                  key={unit.label}
                  className="py-4 px-2 rounded-xl border"
                  style={{
                    borderColor: template.border,
                    backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  }}
                >
                  <div className={`${template.fontDisplay} text-3xl sm:text-4xl font-semibold tabular-nums`}>
                    {String(unit.val).padStart(2, '0')}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider opacity-70 mt-1">{unit.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. EVENT DETAILS */}
      {invitation.enabledSections.event && (
        <section className="py-16 sm:py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-2">
              <p className="text-xs tracking-[0.22em] uppercase" style={{ color: template.textMuted }}>
                Wedding Itinerary
              </p>
              <h2 className={`${template.fontDisplay} text-3xl sm:text-4xl font-medium`}>
                Ceremony &amp; Reception
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: 'Akad / Holy Matrimony', data: invitation.eventData.akad },
                { title: 'Wedding Reception', data: invitation.eventData.reception },
              ].map((ev) => (
                <div
                  key={ev.title}
                  className="p-8 rounded-2xl border flex flex-col justify-between space-y-6"
                  style={{
                    borderColor: template.border,
                    backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                  }}
                >
                  <div className="space-y-3 text-center">
                    <p className="text-xs tracking-[0.2em] uppercase" style={{ color: template.accent }}>
                      {ev.title}
                    </p>
                    <h3 className={`${template.fontDisplay} text-2xl font-medium`}>
                      {formatReadableDate(ev.data.date)}
                    </h3>
                    <p className="text-sm font-medium tabular-nums" style={{ color: template.textMuted }}>
                      {ev.data.startTime || '09:00'}
                      {ev.data.endTime ? ` — ${ev.data.endTime}` : ''} {tzMeta.abbr}
                    </p>
                    <div className="pt-3 border-t" style={{ borderColor: template.border }}>
                      <p className="font-medium text-base">{ev.data.venue}</p>
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: template.textMuted }}>
                        {ev.data.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {ev.data.mapsUrl && isValidHttpOrLocalUrl(ev.data.mapsUrl) && (
                      <a
                        href={ev.data.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
                        style={{
                          backgroundColor: template.accent,
                          color: template.accentText,
                        }}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Google Maps</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadCalendarIcs({
                          title: `${groomNick} & ${brideNick} — ${ev.title}`,
                          date: ev.data.date,
                          startTime: ev.data.startTime,
                          endTime: ev.data.endTime,
                          timezone: invitation.eventData.timezone,
                          venue: ev.data.venue,
                          address: ev.data.address,
                          description: `Wedding celebration of ${groomNick} & ${brideNick}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
                      style={{ borderColor: template.border }}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Save Date</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. LOVE STORY TIMELINE */}
      {invitation.enabledSections.story && invitation.storyData.milestones.length > 0 && (
        <section
          className="py-16 sm:py-24 px-6 border-t"
          style={{ borderColor: template.border }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 space-y-2">
              <p className="text-xs tracking-[0.22em] uppercase" style={{ color: template.textMuted }}>
                Our Journey
              </p>
              <h2 className={`${template.fontDisplay} text-3xl sm:text-4xl font-medium`}>
                How Our Story Unfolded
              </h2>
            </div>

            <div className="space-y-10">
              {invitation.storyData.milestones.map((ms, index) => (
                <div
                  key={ms.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-6 items-center ${
                    index % 2 === 1 ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  <div className={`md:col-span-5 ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                    <div
                      className="aspect-[4/3] rounded-xl overflow-hidden border"
                      style={{ borderColor: template.border }}
                    >
                      <ResilientImage
                        src={ms.photoUrl}
                        alt={ms.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className={`md:col-span-7 space-y-2 ${index % 2 === 1 ? 'md:order-1 md:text-right' : ''}`}>
                    <p className="text-xs tracking-[0.18em] uppercase" style={{ color: template.accent }}>
                      {ms.date}
                    </p>
                    <h3 className={`${template.fontDisplay} text-2xl sm:text-3xl font-medium`}>
                      {ms.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: template.textMuted }}>
                      {ms.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. PHOTO GALLERY */}
      {invitation.enabledSections.gallery && invitation.gallery.length > 0 && (
        <section
          className="py-16 sm:py-24 px-6 border-t"
          style={{ borderColor: template.border }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10 space-y-2">
              <p className="text-xs tracking-[0.22em] uppercase" style={{ color: template.textMuted }}>
                Captured Moments
              </p>
              <h2 className={`${template.fontDisplay} text-3xl sm:text-4xl font-medium`}>
                Editorial Gallery
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {invitation.gallery.map((photoUrl, idx) => (
                <button
                  key={`${photoUrl}-${idx}`}
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6AC83]"
                  style={{ borderColor: template.border }}
                >
                  <ResilientImage
                    src={photoUrl}
                    alt={`${groomNick} and ${brideNick} gallery ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. DIGITAL GIFT */}
      {invitation.enabledSections.gift &&
        (invitation.giftData.accounts.length > 0 || invitation.giftData.qrisUrl) && (
          <section
            className="py-16 sm:py-20 px-6 border-t"
            style={{
              borderColor: template.border,
              backgroundColor: isDarkTheme ? '#1E1916' : '#F6F1E9',
              color: isDarkTheme ? '#FAF7F2' : '#443C35',
            }}
          >
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="space-y-2">
                <p className="text-xs tracking-[0.22em] uppercase opacity-75">Wedding Gift</p>
                <h2 className={`${template.fontDisplay} text-3xl sm:text-4xl font-medium`}>
                  A Token of Love
                </h2>
                <p className="text-sm max-w-lg mx-auto opacity-80 leading-relaxed">
                  {invitation.giftData.message}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                {invitation.giftData.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-6 rounded-xl border flex flex-col justify-between gap-4"
                    style={{
                      borderColor: template.border,
                      backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    }}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-wider opacity-70">{acc.bankName}</p>
                      <p className="font-mono-num text-xl font-medium mt-1 tracking-wide">
                        {acc.accountNumber}
                      </p>
                      <p className="text-xs mt-1 opacity-80">a.n. {acc.accountHolder}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(acc.id, acc.accountNumber)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                      style={{ borderColor: template.border }}
                    >
                      {copiedId === acc.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#737C68]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Account Number</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {invitation.giftData.qrisUrl && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQrisModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: template.border }}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>View QRIS Code</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

      {/* 9. RSVP & GUEST WISHES */}
      {(invitation.enabledSections.rsvp || invitation.enabledSections.wishes) && (
        <section className="py-16 sm:py-24 px-6 border-t" style={{ borderColor: template.border }}>
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* RSVP FORM */}
            {invitation.enabledSections.rsvp && (
              <div className={invitation.enabledSections.wishes ? 'lg:col-span-5' : 'lg:col-span-12 max-w-lg mx-auto w-full'}>
                <div
                  className="p-7 rounded-2xl border space-y-5"
                  style={{
                    borderColor: template.border,
                    backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                  }}
                >
                  <div>
                    <p className="text-xs tracking-[0.2em] uppercase" style={{ color: template.accent }}>
                      RSVP
                    </p>
                    <h2 className={`${template.fontDisplay} text-3xl font-medium mt-1`}>
                      Confirm Attendance
                    </h2>
                  </div>

                  {rsvpSubmitted ? (
                    <div className="p-5 rounded-xl bg-[#737C68]/10 border border-[#737C68]/30 space-y-2">
                      <p className="text-sm font-medium">Thank you, {rsvpName}!</p>
                      <p className="text-xs opacity-80">
                        Your response ({rsvpAttendance === 'attending' ? `Attending · ${rsvpCount} guest(s)` : 'Unable to attend'}) has been saved.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRsvpSubmitted(false)}
                        className="text-xs underline opacity-75 hover:opacity-100"
                      >
                        Send another response
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRsvpSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={rsvpName}
                          onChange={(e) => setRsvpName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-[#C6AC83]"
                          style={{ borderColor: template.border }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Attendance</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRsvpAttendance('attending')}
                            className="py-2 px-3 text-xs font-medium rounded-lg border transition-colors"
                            style={{
                              borderColor: template.border,
                              backgroundColor: rsvpAttendance === 'attending' ? template.accent : 'transparent',
                              color: rsvpAttendance === 'attending' ? template.accentText : 'inherit',
                            }}
                          >
                            Will Attend
                          </button>
                          <button
                            type="button"
                            onClick={() => setRsvpAttendance('unable')}
                            className="py-2 px-3 text-xs font-medium rounded-lg border transition-colors"
                            style={{
                              borderColor: template.border,
                              backgroundColor: rsvpAttendance === 'unable' ? template.accent : 'transparent',
                              color: rsvpAttendance === 'unable' ? template.accentText : 'inherit',
                            }}
                          >
                            Unable to Attend
                          </button>
                        </div>
                      </div>

                      {rsvpAttendance === 'attending' && (
                        <div>
                          <label className="block text-xs font-medium mb-1">Number of Guests</label>
                          <select
                            value={rsvpCount}
                            onChange={(e) => setRsvpCount(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg border bg-transparent focus:outline-none"
                            style={{ borderColor: template.border }}
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n} className="text-[#443C35]">
                                {n} {n === 1 ? 'Guest' : 'Guests'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium mb-1">Short Note (Optional)</label>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={rsvpMessage}
                          onChange={(e) => setRsvpMessage(e.target.value)}
                          placeholder="Dietary notes or warm greetings..."
                          className="w-full px-3.5 py-2 text-sm rounded-lg border bg-transparent focus:outline-none"
                          style={{ borderColor: template.border }}
                        />
                      </div>

                      {rsvpError && <p className="text-xs text-[#C53030]">{rsvpError}</p>}

                      <button
                        type="submit"
                        disabled={rsvpSubmitting}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{
                          backgroundColor: template.accent,
                          color: template.accentText,
                        }}
                      >
                        {rsvpSubmitting ? 'Sending...' : 'Confirm Attendance'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* GUEST WISHES */}
            {invitation.enabledSections.wishes && (
              <div className={invitation.enabledSections.rsvp ? 'lg:col-span-7' : 'lg:col-span-12 max-w-2xl mx-auto w-full'}>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs tracking-[0.2em] uppercase" style={{ color: template.accent }}>
                      Guestbook
                    </p>
                    <h2 className={`${template.fontDisplay} text-3xl font-medium mt-1`}>
                      Prayers &amp; Wedding Wishes
                    </h2>
                  </div>

                  <form
                    onSubmit={handleWishSubmit}
                    className="p-5 rounded-2xl border space-y-3"
                    style={{
                      borderColor: template.border,
                      backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                    }}
                  >
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={wishName}
                      onChange={(e) => setWishName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border bg-transparent focus:outline-none"
                      style={{ borderColor: template.border }}
                    />
                    <textarea
                      rows={3}
                      required
                      maxLength={500}
                      value={wishText}
                      onChange={(e) => setWishText(e.target.value)}
                      placeholder="Write your heartfelt blessings for the couple..."
                      className="w-full px-3.5 py-2 text-sm rounded-lg border bg-transparent focus:outline-none"
                      style={{ borderColor: template.border }}
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={wishSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{
                          backgroundColor: template.accent,
                          color: template.accentText,
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{wishSubmitting ? 'Posting...' : 'Post Wish'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Wishes list */}
                  {wishesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((n) => (
                        <div key={n} className="h-20 rounded-xl border opacity-40 animate-pulse" style={{ borderColor: template.border }} />
                      ))}
                    </div>
                  ) : wishesError ? (
                    <p className="text-xs opacity-75">{wishesError}</p>
                  ) : wishes.length === 0 ? (
                    <div className="p-6 rounded-xl border text-center" style={{ borderColor: template.border }}>
                      <Heart className="w-5 h-5 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Be the first to leave a wedding blessing for {groomNick} &amp; {brideNick}.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {wishes.slice(0, visibleWishLimit).map((w) => {
                        const dt = toMillis(w.createdAt);
                        const dateText = dt
                          ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Just now';
                        return (
                          <div
                            key={w.wishId}
                            className="p-5 rounded-xl border space-y-1.5"
                            style={{
                              borderColor: template.border,
                              backgroundColor: isDarkTheme ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold">{w.guestName}</span>
                              <span className="opacity-60 tabular-nums">{dateText}</span>
                            </div>
                            <p className="text-sm leading-relaxed opacity-85">{w.message}</p>
                          </div>
                        );
                      })}
                      {wishes.length > visibleWishLimit && (
                        <button
                          type="button"
                          onClick={() => setVisibleWishLimit((c) => c + 6)}
                          className="text-xs underline opacity-80 hover:opacity-100"
                        >
                          Load more wishes ({wishes.length - visibleWishLimit} remaining)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 10. CLOSING SECTION */}
      <footer className="relative py-20 px-6 text-center overflow-hidden border-t" style={{ borderColor: template.border }}>
        <div className="absolute inset-0">
          <ResilientImage
            src={invitation.closingPhoto || invitation.mainCouplePhoto}
            alt="Closing portrait"
            className="w-full h-full object-cover opacity-20"
          />
          <div
            className="absolute inset-0"
            style={{
              background: isDarkTheme
                ? 'linear-gradient(to top, rgba(28,25,23,0.94), rgba(28,25,23,0.82))'
                : `linear-gradient(to top, ${template.bgCanvas}, ${template.bgCanvas}DD)`,
            }}
          />
        </div>
        <div className="relative z-10 max-w-lg mx-auto space-y-4">
          <p className="text-xs tracking-[0.22em] uppercase" style={{ color: template.textMuted }}>
            With Love &amp; Gratitude
          </p>
          <h2 className={`${template.fontDisplay} text-4xl sm:text-5xl font-medium`}>
            {groomNick} &amp; {brideNick}
          </h2>
          <p className="text-xs opacity-75">
            Thank you for celebrating our love story with us.
          </p>
          <p className={`${template.fontDisplay} text-lg italic opacity-70 pt-2`}>{initials}</p>
          <div className="pt-8 text-[11px] opacity-55">
            Crafted with WEDLINK · Digital Wedding Invitation Studio
          </div>
        </div>
      </footer>

      {/* FLOATING MUSIC PLAYER */}
      {invitation.musicData.enabled && (
        <div
          className={`${
            compactFrame ? 'sticky bottom-3 ml-auto mr-3 mb-3 w-fit' : 'fixed bottom-5 right-5 z-40'
          }`}
        >
          <div className="relative flex items-center gap-2.5 px-3.5 py-2 rounded-full border shadow-lg backdrop-blur-md bg-[#443C35]/90 text-[#FAF7F2] border-[#C6AC83]/40">
            <button
              type="button"
              onClick={toggleMusic}
              aria-label={isPlaying ? 'Pause wedding music' : 'Play wedding music'}
              className="w-8 h-8 rounded-full bg-[#C6AC83] text-[#2B241F] flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <div className="flex items-center gap-2 min-w-0 max-w-[140px]">
              <Disc3 className={`w-4 h-4 text-[#C6AC83] shrink-0 ${isPlaying ? 'animate-disc-spin' : ''}`} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate">
                  {invitation.musicData.title || 'Wedding Melody'}
                </p>
                {audioError && <p className="text-[10px] text-[#E5989B] truncate">Audio unavailable</p>}
              </div>
            </div>

            {isPlaying && (
              <div className="flex items-end gap-0.5 h-3.5 px-1" aria-hidden="true">
                <span className="w-0.5 h-full bg-[#C6AC83] eq-bar-1" />
                <span className="w-0.5 h-full bg-[#C6AC83] eq-bar-2" />
                <span className="w-0.5 h-full bg-[#C6AC83] eq-bar-3" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowVolume((s) => !s)}
              aria-label="Volume control"
              className="p-1 opacity-80 hover:opacity-100"
            >
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {showVolume && (
              <div className="absolute bottom-full right-0 mb-2 p-3 rounded-xl bg-[#443C35] border border-[#C6AC83]/40 shadow-xl w-40">
                <label className="block text-[10px] uppercase tracking-wider text-[#FAF7F2]/70 mb-1.5">
                  Volume · {Math.round(volume * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full accent-[#C6AC83]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* GALLERY LIGHTBOX MODAL */}
      {lightboxIdx !== null && invitation.gallery[lightboxIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta > 50) {
              setLightboxIdx((lightboxIdx - 1 + invitation.gallery.length) % invitation.gallery.length);
            } else if (delta < -50) {
              setLightboxIdx((lightboxIdx + 1) % invitation.gallery.length);
            }
            touchStartX.current = null;
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            aria-label="Close lightbox"
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setLightboxIdx((lightboxIdx - 1 + invitation.gallery.length) % invitation.gallery.length)
            }
            aria-label="Previous photo"
            className="absolute left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <img
            src={invitation.gallery[lightboxIdx]}
            alt={`Gallery ${lightboxIdx + 1}`}
            referrerPolicy="no-referrer"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
          />

          <button
            type="button"
            onClick={() => setLightboxIdx((lightboxIdx + 1) % invitation.gallery.length)}
            aria-label="Next photo"
            className="absolute right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* QRIS MODAL */}
      {showQrisModal && invitation.giftData.qrisUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setShowQrisModal(false)}
        >
          <div
            className="bg-white text-[#443C35] rounded-2xl p-6 max-w-sm w-full space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-cormorant text-2xl font-semibold">Digital Gift QRIS</h3>
              <button
                type="button"
                onClick={() => setShowQrisModal(false)}
                aria-label="Close QRIS"
                className="p-1 rounded-lg hover:bg-[#FAF7F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-square rounded-xl overflow-hidden border border-[#E5DDD0] bg-[#FAF7F2]">
              <ResilientImage
                src={invitation.giftData.qrisUrl}
                alt="QRIS Digital Gift"
                className="w-full h-full object-contain p-2"
              />
            </div>
            <p className="text-xs text-[#443C35]/70">Scan using your Indonesian mobile banking or e-wallet app.</p>
          </div>
        </div>
      )}
    </div>
  );
}
