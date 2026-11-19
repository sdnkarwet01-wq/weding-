import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarHeart,
  Check,
  Eye,
  Gift,
  HeartHandshake,
  Image as ImageIcon,
  MapPin,
  Menu,
  MessageSquareHeart,
  Music,
  Send,
  Smartphone,
  Monitor,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { WEDDING_TEMPLATES, TemplateConfig } from '../data/templates';
import { createDefaultInvitation } from '../data/defaultInvitation';
import { useAuth } from '../contexts/AuthContext';
import { createNewInvitation } from '../services/weddingService';
import { useToast } from '../contexts/ToastContext';
import { TemplateId } from '../types/wedding';
import { BotanicalOrnament } from '../components/BotanicalOrnament';
import { InvitationRenderer } from '../components/InvitationRenderer';
import { ResilientImage } from '../components/ResilientImage';

const FEATURES_LIST = [
  {
    num: '01',
    title: 'Personalized Guest Names & Links',
    desc: 'Generate individual links for every family member and VIP guest so the opening cover greets them personally by name.',
    icon: Users,
    span: 'md:col-span-2',
  },
  {
    num: '02',
    title: 'Curated Music & Vinyl Player',
    desc: 'Ambient chamber melodies or custom uploaded MP3s that begin gracefully when your guest taps Open Invitation.',
    icon: Music,
    span: 'md:col-span-1',
  },
  {
    num: '03',
    title: 'Live Asia/Jakarta Countdown',
    desc: 'Precision days, hours, minutes, and seconds synchronized to your ceremony timezone.',
    icon: CalendarHeart,
    span: 'md:col-span-1',
  },
  {
    num: '04',
    title: 'Instant RSVP & Attendance Analytics',
    desc: 'Guests confirm attendance and party size without logging in while your dashboard updates in real time.',
    icon: HeartHandshake,
    span: 'md:col-span-1',
  },
  {
    num: '05',
    title: 'Swipeable Editorial Gallery',
    desc: 'Curate up to 20 engagement portraits in a responsive grid with keyboard and touch lightbox navigation.',
    icon: ImageIcon,
    span: 'md:col-span-1',
  },
  {
    num: '06',
    title: 'Love Story Timeline',
    desc: 'Chronicle your first meet, first date, and engagement with bespoke milestone photographs.',
    icon: HeartHandshake,
    span: 'md:col-span-1',
  },
  {
    num: '07',
    title: 'Google Maps & Calendar Sync',
    desc: 'One-tap directions for Akad and Reception venues plus downloadable .ics calendar reminders.',
    icon: MapPin,
    span: 'md:col-span-1',
  },
  {
    num: '08',
    title: 'Digital Gift & QRIS Envelope',
    desc: 'Multiple bank accounts with instant copy-to-clipboard and scannable QRIS code support.',
    icon: Gift,
    span: 'md:col-span-1',
  },
  {
    num: '09',
    title: 'Guest Wishes Guestbook',
    desc: 'Collect warm prayers and heartfelt blessings stored persistently and moderated from your studio.',
    icon: MessageSquareHeart,
    span: 'md:col-span-1',
  },
  {
    num: '10',
    title: 'One-Click WhatsApp Sharing',
    desc: 'Send tailored Indonesian or English WhatsApp messages carrying each guest’s unique link.',
    icon: Send,
    span: 'md:col-span-2',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Choose Your Design', desc: 'Select from eight editorial wedding stationery templates crafted with distinct typography.' },
  { step: '02', title: 'Customize Your Story', desc: 'Add couple portraits, ceremony venues, love story milestones, music, and digital gift accounts.' },
  { step: '03', title: 'Preview Your Invitation', desc: 'Inspect every edit live across mobile, desktop, and fullscreen views in real time.' },
  { step: '04', title: 'Publish', desc: 'Claim your custom /wedding/couple-name URL backed by cloud database persistence.' },
  { step: '05', title: 'Share', desc: 'Generate personalized guest links and dispatch elegant invitations directly via WhatsApp.' },
];

const SAMPLE_TESTIMONIALS = [
  {
    couple: 'Clarissa & Adrian Wijaya',
    event: 'Jakarta · Eternal Bloom Template (Sample Demo)',
    quote:
      'Managing 280 guest links and tracking confirmed seats in real time saved us weeks of spreadsheet work. Guests loved the personalized opening cover.',
  },
  {
    couple: 'Nadia & Matteo Rossi',
    event: 'Ubud, Bali · The Tuscany Template (Sample Demo)',
    quote:
      'Our family in Italy and Jakarta opened the same invitation seamlessly on mobile, with Google Maps directions and warm chamber music.',
  },
  {
    couple: 'Sasha & Dimas Kusuma',
    event: 'Bandung · Sage & Soul Template (Sample Demo)',
    quote:
      'Clean, quiet luxury without cluttered ads. Every wish our friends left became a keepsake we still reread after our reception.',
  },
];

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateConfig | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [creatingTemplateId, setCreatingTemplateId] = useState<TemplateId | null>(null);

  const previewInvitationDoc = useMemo(() => {
    if (!previewTemplate) return null;
    const base = createDefaultInvitation('preview_demo', 'preview_owner', previewTemplate.id, 'aditya-nabila');
    return { ...base, status: 'draft' as const };
  }, [previewTemplate]);

  const handleCreateWithTemplate = async (templateId: TemplateId = 'eternal-bloom') => {
    if (!user) {
      navigate(`/auth?mode=signup&template=${templateId}`);
      return;
    }
    if (!user.emailVerified) {
      navigate('/dashboard');
      return;
    }
    setCreatingTemplateId(templateId);
    try {
      const created = await createNewInvitation(user.uid, templateId);
      navigate(`/editor/${created.invitationId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start invitation.', 'error');
    } finally {
      setCreatingTemplateId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] font-dm-sans">
      {/* TOP BAR CONTRACT: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <Link
            to="/"
            className="font-cormorant text-2xl font-semibold tracking-[0.06em] text-[#443C35] whitespace-nowrap shrink-0"
          >
            WEDLINK
          </Link>

          {/* Zone 2: Clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm text-[#443C35]/80">
            <a href="#home" className="hover:text-[#443C35] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#templates" className="hover:text-[#443C35] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Templates
            </a>
            <a href="#features" className="hover:text-[#443C35] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#pricing" className="hover:text-[#443C35] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <Link
              to={user ? '/dashboard' : '/auth'}
              className="hover:text-[#443C35] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Dashboard' : 'Sign In'}
            </Link>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void handleCreateWithTemplate('eternal-bloom')}
              disabled={creatingTemplateId !== null}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-[#443C35] text-[#FAF7F2] text-xs font-medium rounded-lg hover:bg-[#584E45] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <span>Create Invitation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg border border-[#DCD3C6] text-[#443C35]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5DDD0] bg-[#FAF7F2] px-6 py-4 space-y-3">
            <a href="#home" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-sm">
              Home
            </a>
            <a href="#templates" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-sm">
              Templates
            </a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-sm">
              Features
            </a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-1.5 text-sm">
              Pricing
            </a>
            <Link to={user ? '/dashboard' : '/auth'} className="block py-1.5 text-sm font-medium">
              {user ? 'Dashboard' : 'Sign In'}
            </Link>
            <button
              type="button"
              onClick={() => void handleCreateWithTemplate('eternal-bloom')}
              className="w-full py-2.5 px-4 bg-[#443C35] text-white text-sm font-medium rounded-lg"
            >
              Create Invitation
            </button>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section id="home" className="relative overflow-hidden border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">
              WEDLINK · Your Love Story, Beautifully Invited.
            </p>

            <h1
              className="font-cormorant font-medium tracking-tight text-[#443C35] leading-[1.06]"
              style={{ fontSize: 'clamp(2.4rem, 4.2vw, 3.85rem)', textWrap: 'balance' }}
            >
              Every love story deserves a beautiful invitation.
            </h1>

            <p className="text-base sm:text-lg text-[#443C35]/75 leading-relaxed max-w-xl">
              Create a timeless digital wedding invitation that captures your story, your moments, and your love — beautifully.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => void handleCreateWithTemplate('eternal-bloom')}
                disabled={creatingTemplateId !== null}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#443C35] text-[#FAF7F2] text-sm font-medium rounded-lg hover:bg-[#5A5047] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <span>{creatingTemplateId ? 'Preparing Studio...' : 'Create Your Invitation'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#templates"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-[#D8CFC2] text-[#443C35] text-sm font-medium rounded-lg hover:bg-[#F1EAE0] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Explore Templates</span>
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#737C68]">
              <span>8 Editorial Templates</span>
              <span aria-hidden="true">·</span>
              <span>Live Mobile Preview</span>
              <span aria-hidden="true">·</span>
              <span>Personalized Guest Links</span>
              <span aria-hidden="true">·</span>
              <span>Real-Time RSVP</span>
            </div>
          </motion.div>

          {/* Hero Visual: Smartphone Mockup + Editorial Couple Portrait */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative flex items-center justify-center"
          >
            {/* Background editorial photograph card */}
            <div className="hidden sm:block w-72 h-[420px] rounded-2xl overflow-hidden border border-[#DCD3C6] shadow-sm -mr-14 mt-10">
              <ResilientImage
                src="/src/assets/images/couple_garden_walk_1795071697414.jpg"
                alt="Editorial couple walking through olive grove"
                className="w-full h-full object-cover"
                lazy={false}
              />
            </div>

            {/* Foreground realistic smartphone wedding website mockup */}
            <div className="relative z-10 w-[290px] sm:w-[310px] rounded-[38px] p-2.5 bg-[#2C2622] shadow-2xl border border-[#443C35]/40">
              <div className="rounded-[30px] overflow-hidden bg-[#FAF7F2] border border-[#E5DDD0]">
                {/* Phone notch */}
                <div className="h-6 bg-[#FAF7F2] flex items-center justify-center border-b border-[#EDE6DA]">
                  <div className="w-16 h-1.5 rounded-full bg-[#443C35]/15" />
                </div>
                <div className="p-6 text-center space-y-4">
                  <BotanicalOrnament type="botanical" color="#737C68" className="scale-90" />
                  <p className="text-[10px] tracking-[0.24em] uppercase text-[#737C68]">
                    The Wedding of
                  </p>
                  <div className="w-32 h-40 mx-auto rounded-t-full overflow-hidden border border-[#C6AC83]">
                    <ResilientImage
                      src="/src/assets/images/hero_couple_editorial_1795071697382.jpg"
                      alt="Aditya and Nabila wedding portrait"
                      className="w-full h-full object-cover"
                      lazy={false}
                    />
                  </div>
                  <div>
                    <h2 className="font-cormorant text-3xl font-medium text-[#443C35]">
                      Aditya <span className="italic">&amp;</span> Nabila
                    </h2>
                    <p className="text-xs text-[#737C68] mt-0.5">Saturday, 19 June 2027</p>
                  </div>
                  <div className="py-2.5 border-y border-[#E5DDD0]">
                    <p className="text-[10px] uppercase tracking-widest text-[#737C68]">Dear Guest</p>
                    <p className="font-cormorant text-lg text-[#443C35]">Mr. Alexander Tan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(WEDDING_TEMPLATES[0])}
                    className="w-full py-2.5 bg-[#737C68] text-white text-xs font-medium rounded-lg hover:bg-[#5E6755] transition-colors cursor-pointer"
                  >
                    Open Live Preview
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* TEMPLATE SHOWCASE (8 DISTINCT TEMPLATES) */}
      <section id="templates" className="py-20 lg:py-28 border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-14 space-y-3">
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">
              Curated Stationery Collection
            </p>
            <h2 className="font-cormorant text-4xl sm:text-5xl font-medium tracking-tight text-[#443C35]">
              Eight distinct editorial designs.
            </h2>
            <p className="text-base text-[#443C35]/75 leading-relaxed">
              Every template pairs bespoke serif typography, original botanical ornaments, and tailored layout rhythm. Preview any design live before customizing your story.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WEDDING_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="group bg-white border border-[#E5DDD0] rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  {/* Miniature aesthetic preview card */}
                  <div
                    className="relative h-60 p-4 flex flex-col items-center justify-center text-center overflow-hidden"
                    style={{
                      backgroundColor: tpl.bgDarkCover ? '#1E1A17' : tpl.bgCanvas,
                      color: tpl.bgDarkCover ? '#FAF7F2' : tpl.textPrimary,
                    }}
                  >
                    <div
                      className="w-full h-full border rounded-xl p-3 flex flex-col items-center justify-between"
                      style={{ borderColor: tpl.bgDarkCover ? 'rgba(198,172,131,0.4)' : tpl.border }}
                    >
                      <BotanicalOrnament
                        type={tpl.ornamentType}
                        color={tpl.bgDarkCover ? '#C6AC83' : tpl.accent}
                        className="scale-75"
                      />
                      <div
                        className={`w-20 h-24 overflow-hidden border ${
                          tpl.coverStyle === 'arch' || tpl.coverStyle === 'botanical'
                            ? 'rounded-t-full'
                            : 'rounded-lg'
                        }`}
                        style={{ borderColor: tpl.bgDarkCover ? '#C6AC83' : tpl.border }}
                      >
                        <ResilientImage
                          src={tpl.previewImage}
                          alt={tpl.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className={`${tpl.fontDisplay} text-xl leading-tight`}>Aditya &amp; Nabila</p>
                        <p className="text-[10px] opacity-70 mt-0.5">{tpl.subtitle.split('&')[0]}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card details */}
                  <div className="p-5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-cormorant text-2xl font-semibold text-[#443C35]">
                        {tpl.name}
                      </h3>
                      <div className="flex items-center gap-1" aria-hidden="true">
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
                    <p className="text-xs text-[#443C35]/70 leading-relaxed pt-1">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(tpl)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium border border-[#DCD3C6] rounded-lg hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    disabled={creatingTemplateId === tpl.id}
                    onClick={() => void handleCreateWithTemplate(tpl.id)}
                    className="flex-1 py-2 px-3 text-xs font-medium bg-[#443C35] text-white rounded-lg hover:bg-[#5A5047] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {creatingTemplateId === tpl.id ? 'Creating...' : 'Use Design'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section id="features" className="py-20 lg:py-28 bg-[#F1EAE0]/55 border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-14 space-y-3">
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">
              Studio Capabilities
            </p>
            <h2 className="font-cormorant text-4xl sm:text-5xl font-medium tracking-tight text-[#443C35]">
              Everything your wedding website requires, thoughtfully integrated.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES_LIST.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.num}
                  className={`${feat.span} bg-white border border-[#E5DDD0] rounded-2xl p-6 flex flex-col justify-between space-y-4`}
                >
                  <div className="flex items-center justify-between text-xs text-[#737C68]">
                    <span className="font-mono-num">{feat.num}.</span>
                    <Icon className="w-4 h-4 opacity-75" strokeWidth={1.6} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-cormorant text-2xl font-semibold text-[#443C35]">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#443C35]/75 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 lg:py-24 border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-xl mb-12 space-y-2">
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">Workflow</p>
            <h2 className="font-cormorant text-4xl font-medium text-[#443C35]">
              From studio draft to published celebration in five steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="border-t border-[#C6AC83] pt-5 space-y-2">
                <span className="font-mono-num text-xs text-[#737C68]">{item.step}</span>
                <h3 className="font-cormorant text-2xl font-semibold text-[#443C35]">
                  {item.title}
                </h3>
                <p className="text-xs text-[#443C35]/75 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 lg:py-24 bg-[#F1EAE0]/45 border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12 space-y-2">
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">Studio Plans</p>
            <h2 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#443C35]">
              Transparent publishing for couples and boutique planners.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Studio Preview',
                audience: 'For drafting & exploring designs',
                price: 'Free',
                cadence: 'No credit card required',
                features: [
                  'Access all 8 editorial templates',
                  'Real-time mobile & desktop builder',
                  'Unlimited draft saves to cloud',
                  'Up to 10 test guest links',
                ],
                cta: 'Start Free Draft',
                highlighted: false,
              },
              {
                name: 'Signature Wedding',
                audience: 'For couples celebrating their big day',
                price: 'Rp 149.000',
                cadence: 'One-time · Active 12 months',
                features: [
                  'Public /wedding/your-slug URL',
                  'Unlimited personalized guest links & CSV import',
                  'Real-time RSVP dashboard & WhatsApp share',
                  'Digital gift accounts, QRIS & background music',
                ],
                cta: 'Create Signature Invitation',
                highlighted: true,
              },
              {
                name: 'Atelier Studio',
                audience: 'For wedding planners & agencies',
                price: 'Rp 490.000',
                cadence: 'Per month · Up to 15 active weddings',
                features: [
                  'Multi-couple studio workspace',
                  'Custom domain mapping readiness',
                  'Full CSV RSVP & guestbook exports',
                  'Priority media upload storage',
                ],
                cta: 'Launch Studio Account',
                highlighted: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col justify-between space-y-6 border ${
                  plan.highlighted
                    ? 'bg-[#443C35] text-[#FAF7F2] border-[#443C35]'
                    : 'bg-white text-[#443C35] border-[#E5DDD0]'
                }`}
              >
                <div className="space-y-4">
                  <div>
                    <p className={`text-xs ${plan.highlighted ? 'text-[#C6AC83]' : 'text-[#737C68]'}`}>
                      {plan.audience}
                    </p>
                    <h3 className="font-cormorant text-3xl font-medium mt-1">{plan.name}</h3>
                  </div>
                  <div>
                    <div className="font-cormorant text-4xl font-semibold tabular-nums">
                      {plan.price}
                    </div>
                    <p className={`text-xs mt-1 ${plan.highlighted ? 'text-[#FAF7F2]/70' : 'text-[#443C35]/65'}`}>
                      {plan.cadence}
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-2 border-t border-current/15 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-[#C6AC83]' : 'text-[#737C68]'}`} />
                        <span className="opacity-90">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateWithTemplate('eternal-bloom')}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    plan.highlighted
                      ? 'bg-[#C6AC83] text-[#2B241F] hover:bg-[#D5BE9A]'
                      : 'bg-[#FAF7F2] border border-[#D8CFC2] text-[#443C35] hover:bg-[#F1EAE0]'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO TESTIMONIALS (CLEARLY LABELED SAMPLE CONTENT) */}
      <section className="py-20 lg:py-24 border-b border-[#E5DDD0]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12 space-y-2">
            <p className="text-xs tracking-[0.22em] uppercase text-[#737C68]">
              Illustrative Demo Testimonials · Sample Couple Stories
            </p>
            <h2 className="font-cormorant text-4xl font-medium text-[#443C35]">
              Designed for effortless guest experiences.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <div
                key={t.couple}
                className="bg-white border border-[#E5DDD0] rounded-2xl p-7 flex flex-col justify-between space-y-5"
              >
                <p className="font-cormorant text-xl italic leading-relaxed text-[#443C35]">
                  “{t.quote}”
                </p>
                <div className="pt-4 border-t border-[#EDE6DA]">
                  <p className="text-sm font-medium text-[#443C35]">{t.couple}</p>
                  <p className="text-xs text-[#737C68] mt-0.5">{t.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="py-14 bg-[#FAF7F2]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="font-cormorant text-2xl font-semibold tracking-[0.06em] text-[#443C35]">
              WEDLINK
            </p>
            <p className="text-xs text-[#737C68] mt-1">
              Your Love Story, Beautifully Invited.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#443C35]/75">
            <a href="#templates" className="hover:text-[#443C35]">Templates</a>
            <a href="#features" className="hover:text-[#443C35]">Features</a>
            <a href="#pricing" className="hover:text-[#443C35]">Pricing</a>
            <Link to="/auth" className="hover:text-[#443C35]">Studio Sign In</Link>
          </div>

          <p className="text-xs text-[#443C35]/60">
            © {new Date().getFullYear()} WEDLINK Digital Wedding Invitation Studio.
          </p>
        </div>
      </footer>

      {/* LIVE TEMPLATE PREVIEW MODAL */}
      {previewTemplate && previewInvitationDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col"
        >
          <div className="bg-[#FAF7F2] border-b border-[#E5DDD0] px-5 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[#737C68] truncate">
                Template Preview · {previewTemplate.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 p-1 bg-[#F1EAE0] rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                    previewDevice === 'mobile' ? 'bg-white text-[#443C35] shadow-sm' : 'text-[#443C35]/70'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                    previewDevice === 'desktop' ? 'bg-white text-[#443C35] shadow-sm' : 'text-[#443C35]/70'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const id = previewTemplate.id;
                  setPreviewTemplate(null);
                  void handleCreateWithTemplate(id);
                }}
                className="px-3.5 py-1.5 bg-[#443C35] text-white text-xs font-medium rounded-lg hover:bg-[#5A5047] whitespace-nowrap shrink-0"
              >
                Use This Design
              </button>

              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                aria-label="Close preview"
                className="p-1.5 rounded-lg border border-[#DCD3C6] hover:bg-[#F1EAE0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
            <div
              className={`bg-white shadow-2xl overflow-y-auto transition-all duration-300 ${
                previewDevice === 'mobile'
                  ? 'w-full max-w-[390px] rounded-[28px] border-4 border-[#2C2622]'
                  : 'w-full max-w-5xl rounded-xl border border-[#E5DDD0]'
              }`}
            >
              <InvitationRenderer
                invitation={previewInvitationDoc}
                guestName="Mr. Alexander Tan"
                isPreview
                compactFrame
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
