import { TemplateId } from '../types/wedding';

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  subtitle: string;
  description: string;
  fontDisplay: 'font-cormorant' | 'font-playfair' | 'font-dm-serif';
  fontBody: 'font-dm-sans' | 'font-manrope';
  bgCanvas: string;
  bgSurface: string;
  bgDarkCover: boolean;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  border: string;
  coverStyle: 'arch' | 'split' | 'minimal' | 'nocturne' | 'frame' | 'botanical' | 'editorial' | 'royal';
  ornamentType: 'botanical' | 'olive' | 'line' | 'gold-crest' | 'arch' | 'floral' | 'monogram' | 'double-border';
  previewImage: string;
}

export const WEDDING_TEMPLATES: TemplateConfig[] = [
  {
    id: 'eternal-bloom',
    name: 'Eternal Bloom',
    subtitle: 'Classic European Ivory & Botanical Line Art',
    description: 'Centered arched portrait framing, fine botanical wreaths, warm ivory linen canvas, and Cormorant Garamond poetry.',
    fontDisplay: 'font-cormorant',
    fontBody: 'font-dm-sans',
    bgCanvas: '#FAF7F2',
    bgSurface: '#F1EAE0',
    bgDarkCover: false,
    textPrimary: '#443C35',
    textMuted: '#737C68',
    accent: '#737C68',
    accentText: '#FFFFFF',
    border: '#D8CFC2',
    coverStyle: 'arch',
    ornamentType: 'botanical',
    previewImage: '/src/assets/images/hero_couple_editorial_1795071697382.jpg',
  },
  {
    id: 'the-tuscany',
    name: 'The Tuscany',
    subtitle: 'Sunlit Villa Terracotta & Olive Grove',
    description: 'Asymmetric sunlit Mediterranean split layout with warm olive accents, burnt sienna details, and italic Playfair Display headlines.',
    fontDisplay: 'font-playfair',
    fontBody: 'font-manrope',
    bgCanvas: '#F8F3EB',
    bgSurface: '#EFE5D6',
    bgDarkCover: false,
    textPrimary: '#3D322A',
    textMuted: '#6C735B',
    accent: '#9E6548',
    accentText: '#FFFFFF',
    border: '#DDD0BF',
    coverStyle: 'split',
    ornamentType: 'olive',
    previewImage: '/src/assets/images/couple_garden_walk_1795071697414.jpg',
  },
  {
    id: 'sage-soul',
    name: 'Sage & Soul',
    subtitle: 'Aesop Minimalist Botanical Calm',
    description: 'Serene sage-tinted mist surfaces, architectural hairline grid dividers, DM Serif Display balance, and quiet botanical poise.',
    fontDisplay: 'font-dm-serif',
    fontBody: 'font-dm-sans',
    bgCanvas: '#F2F4EF',
    bgSurface: '#E6EBE2',
    bgDarkCover: false,
    textPrimary: '#2D362C',
    textMuted: '#647061',
    accent: '#4B5B48',
    accentText: '#FFFFFF',
    border: '#CED6C9',
    coverStyle: 'minimal',
    ornamentType: 'line',
    previewImage: '/src/assets/images/floral_stationery_flatlay_1795071697390.jpg',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    subtitle: 'Candlelit Espresso & Burnished Gold',
    description: 'Deep espresso twilight opening cover illuminated by antique champagne gold filigree and warm sand editorial sections.',
    fontDisplay: 'font-cormorant',
    fontBody: 'font-manrope',
    bgCanvas: '#26201C',
    bgSurface: '#322A25',
    bgDarkCover: true,
    textPrimary: '#F5EFE6',
    textMuted: '#C9B99F',
    accent: '#C6AC83',
    accentText: '#26201C',
    border: '#4A3F37',
    coverStyle: 'nocturne',
    ornamentType: 'gold-crest',
    previewImage: '/src/assets/images/reception_candlelight_1795071697827.jpg',
  },
  {
    id: 'pure-elegance',
    name: 'Pure Elegance',
    subtitle: 'Haute Couture Gallery Minimalism',
    description: 'Crisp gallery white canvas, generous museum margins, 1px champagne frames, and timeless high-fashion Playfair Display typography.',
    fontDisplay: 'font-playfair',
    fontBody: 'font-dm-sans',
    bgCanvas: '#FFFFFF',
    bgSurface: '#F8F6F2',
    bgDarkCover: false,
    textPrimary: '#221F1D',
    textMuted: '#7A7269',
    accent: '#221F1D',
    accentText: '#FFFFFF',
    border: '#E8E2D9',
    coverStyle: 'frame',
    ornamentType: 'arch',
    previewImage: '/src/assets/images/bride_portrait_editorial_1795071696966.jpg',
  },
  {
    id: 'floral-whisper',
    name: 'Floral Whisper',
    subtitle: 'Soft Blush Ivory & Garden Rose',
    description: 'Delicate hand-drawn floral corner motifs on porcelain blush ivory paper with warm taupe rose and sage accents.',
    fontDisplay: 'font-cormorant',
    fontBody: 'font-dm-sans',
    bgCanvas: '#FCF8F6',
    bgSurface: '#F5ECE7',
    bgDarkCover: false,
    textPrimary: '#4A3D39',
    textMuted: '#8D726C',
    accent: '#A97F78',
    accentText: '#FFFFFF',
    border: '#E7D8D1',
    coverStyle: 'botanical',
    ornamentType: 'floral',
    previewImage: '/src/assets/images/floral_stationery_flatlay_1795071697390.jpg',
  },
  {
    id: 'modern-muse',
    name: 'Modern Muse',
    subtitle: 'Contemporary Magazine Spread',
    description: 'Bold editorial masthead typography, asymmetric two-column fashion journal rhythm, chalk ivory paper, and warm brass highlights.',
    fontDisplay: 'font-dm-serif',
    fontBody: 'font-manrope',
    bgCanvas: '#F7F5F0',
    bgSurface: '#ECE8DF',
    bgDarkCover: false,
    textPrimary: '#1D1B18',
    textMuted: '#6B655D',
    accent: '#B68F54',
    accentText: '#FFFFFF',
    border: '#D5CFC3',
    coverStyle: 'editorial',
    ornamentType: 'monogram',
    previewImage: '/src/assets/images/groom_portrait_editorial_1795071709814.jpg',
  },
  {
    id: 'the-grand-affair',
    name: 'The Grand Affair',
    subtitle: 'Black-Tie Manor & Champagne Crest',
    description: 'Formal double-lined champagne border, bespoke couple monogram crest, obsidian charcoal cover, and regal ivory banquet typography.',
    fontDisplay: 'font-playfair',
    fontBody: 'font-manrope',
    bgCanvas: '#FAF7F2',
    bgSurface: '#1C1917',
    bgDarkCover: true,
    textPrimary: '#29231F',
    textMuted: '#73675C',
    accent: '#C6AC83',
    accentText: '#1C1917',
    border: '#C6AC83',
    coverStyle: 'royal',
    ornamentType: 'double-border',
    previewImage: '/src/assets/images/hero_couple_editorial_1795071697382.jpg',
  },
];

export function getTemplateById(id: string): TemplateConfig {
  return WEDDING_TEMPLATES.find((t) => t.id === id) || WEDDING_TEMPLATES[0];
}
