import { InvitationDoc, TemplateId } from '../types/wedding';

export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  mood: string;
}

export const CURATED_MUSIC_TRACKS: CuratedTrack[] = [
  {
    id: 'clair-de-lune',
    title: 'Clair de Lune — Piano Reverie',
    artist: 'WEDLINK Chamber Ensemble',
    url: 'builtin:clair-de-lune',
    mood: 'Soft Romantic Solo Piano',
  },
  {
    id: 'tuscany-morning',
    title: 'Tuscany Morning — Acoustic Strings',
    artist: 'Villa Quartet',
    url: 'builtin:tuscany',
    mood: 'Warm Mediterranean Harp & Strings',
  },
  {
    id: 'vows-in-ivory',
    title: 'Vows in Ivory — Harp & Cello',
    artist: 'Atelier Conservatory',
    url: 'builtin:vows',
    mood: 'Intimate Ceremony Prelude',
  },
  {
    id: 'golden-hour',
    title: 'Golden Hour — Warm Ambient',
    artist: 'Nocturne Keys',
    url: 'builtin:golden',
    mood: 'Candlelit Reception Glow',
  },
];

export function createDefaultInvitation(
  invitationId: string,
  ownerId: string,
  templateId: TemplateId = 'eternal-bloom',
  slugOverride?: string
): Omit<InvitationDoc, 'createdAt' | 'updatedAt'> {
  const shortSuffix = invitationId.slice(-4).toLowerCase();
  return {
    invitationId,
    ownerId,
    slug: slugOverride || `aditya-nabila-${shortSuffix}`,
    templateId,
    status: 'draft',
    groomData: {
      fullName: 'Aditya Mahendra Pratama',
      nickname: 'Aditya',
      parents: 'Putra pertama dari Bapak Hendra Pratama & Ibu Ratna Dewi',
      photoUrl: '/src/assets/images/groom_portrait_editorial_1795071709814.jpg',
      instagram: '@adityapratama',
    },
    brideData: {
      fullName: 'Nabila Putri Kusuma',
      nickname: 'Nabila',
      parents: 'Putri kedua dari Bapak Bambang Kusuma & Ibu Sari Lestari',
      photoUrl: '/src/assets/images/bride_portrait_editorial_1795071696966.jpg',
      instagram: '@nabilakusuma',
    },
    mainCouplePhoto: '/src/assets/images/hero_couple_editorial_1795071697382.jpg',
    closingPhoto: '/src/assets/images/reception_candlelight_1795071697827.jpg',
    eventData: {
      timezone: 'Asia/Jakarta',
      akad: {
        date: '2027-06-19',
        startTime: '08:00',
        endTime: '10:00',
        venue: 'The Glasshouse Conservatory, Plataran Menteng',
        address: 'Jl. HOS. Cokroaminoto No. 42, Menteng, Jakarta Pusat',
        mapsUrl: 'https://maps.google.com/?q=Plataran+Menteng+Jakarta',
      },
      reception: {
        date: '2027-06-19',
        startTime: '18:30',
        endTime: '21:30',
        venue: 'Grand Ballroom — The Hermitage Menteng',
        address: 'Jl. Cilacap No. 1, Menteng, Jakarta Pusat',
        mapsUrl: 'https://maps.google.com/?q=The+Hermitage+Menteng+Jakarta',
      },
    },
    storyData: {
      quote:
        'And of His signs is that He created for you from yourselves mates that you may find tranquility in them; and He placed between you affection and mercy.',
      quoteSource: 'QS. Ar-Rum: 21',
      openingMessage:
        'With gratitude and joy in our hearts, we invite you to share in the celebration of our marriage and witness the beginning of our lifelong chapter together.',
      milestones: [
        {
          id: 'ms-1',
          title: 'First Meet',
          date: 'October 2022',
          description:
            'An unhurried autumn afternoon at an architecture bookshop in Kemang turned a brief introduction into hours of quiet conversation.',
          photoUrl: '/src/assets/images/floral_stationery_flatlay_1795071697390.jpg',
        },
        {
          id: 'ms-2',
          title: 'First Date',
          date: 'January 2023',
          description:
            'Dinner beneath soft courtyard lanterns, discovering a shared love for classic cinema, handmade paper, and Sunday morning coffee.',
          photoUrl: '/src/assets/images/couple_garden_walk_1795071697414.jpg',
        },
        {
          id: 'ms-3',
          title: 'The Engagement',
          date: 'August 2026',
          description:
            'Surrounded by olive trees at golden hour in Ubud, we promised to walk hand in hand through every season ahead.',
          photoUrl: '/src/assets/images/hero_couple_editorial_1795071697382.jpg',
        },
      ],
    },
    gallery: [
      '/src/assets/images/hero_couple_editorial_1795071697382.jpg',
      '/src/assets/images/couple_garden_walk_1795071697414.jpg',
      '/src/assets/images/bride_portrait_editorial_1795071696966.jpg',
      '/src/assets/images/groom_portrait_editorial_1795071709814.jpg',
      '/src/assets/images/floral_stationery_flatlay_1795071697390.jpg',
      '/src/assets/images/reception_candlelight_1795071697827.jpg',
    ],
    musicData: {
      enabled: true,
      title: CURATED_MUSIC_TRACKS[0].title,
      artist: CURATED_MUSIC_TRACKS[0].artist,
      url: CURATED_MUSIC_TRACKS[0].url,
      volume: 0.65,
    },
    enabledSections: {
      couple: true,
      story: true,
      countdown: true,
      gallery: true,
      rsvp: true,
      wishes: true,
      event: true,
      gift: true,
    },
    giftData: {
      message:
        'Your presence and prayers are the greatest gifts we could ask for. Should you wish to send a token of love, we have prepared the details below with heartfelt gratitude.',
      qrisUrl: '',
      accounts: [
        {
          id: 'bank-1',
          bankName: 'Bank Central Asia (BCA)',
          accountNumber: '5420881920',
          accountHolder: 'Aditya Mahendra Pratama',
        },
        {
          id: 'bank-2',
          bankName: 'Bank Mandiri',
          accountNumber: '1240009182734',
          accountHolder: 'Nabila Putri Kusuma',
        },
      ],
    },
  };
}
