export type TemplateId =
  | 'eternal-bloom'
  | 'the-tuscany'
  | 'sage-soul'
  | 'golden-hour'
  | 'pure-elegance'
  | 'floral-whisper'
  | 'modern-muse'
  | 'the-grand-affair';

export type InvitationStatus = 'draft' | 'published';

export interface PersonData {
  fullName: string;
  nickname: string;
  parents: string;
  photoUrl: string;
  instagram?: string;
}

export interface EventSubData {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  venue: string;
  address: string;
  mapsUrl: string;
}

export interface EventData {
  timezone: string; // e.g., 'Asia/Jakarta'
  akad: EventSubData;
  reception: EventSubData;
}

export interface StoryMilestone {
  id: string;
  title: string;
  date: string;
  description: string;
  photoUrl: string;
}

export interface StoryData {
  quote: string;
  quoteSource?: string;
  openingMessage: string;
  milestones: StoryMilestone[];
}

export interface MusicData {
  enabled: boolean;
  title: string;
  artist: string;
  url: string; // 'builtin:clair-de-lune' | 'builtin:tuscany' | 'builtin:vows' | 'builtin:golden' | https://... | /uploads/...
  volume: number; // 0..1
}

export interface EnabledSections {
  couple: boolean;
  story: boolean;
  countdown: boolean;
  gallery: boolean;
  rsvp: boolean;
  wishes: boolean;
  event: boolean;
  gift: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface GiftData {
  message: string;
  qrisUrl: string;
  accounts: BankAccount[];
}

export interface InvitationDoc {
  invitationId: string;
  ownerId: string;
  slug: string;
  templateId: TemplateId;
  status: InvitationStatus;
  groomData: PersonData;
  brideData: PersonData;
  mainCouplePhoto: string;
  closingPhoto: string;
  eventData: EventData;
  storyData: StoryData;
  gallery: string[];
  musicData: MusicData;
  enabledSections: EnabledSections;
  giftData: GiftData;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GuestDoc {
  guestId: string;
  invitationId: string;
  ownerId: string;
  guestName: string;
  guestGroup: string;
  uniqueToken: string;
  invitationUrl: string;
  invitationSent: boolean;
  rsvpStatus: 'pending' | 'attending' | 'declined';
  guestCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RsvpDoc {
  rsvpId: string;
  invitationId: string;
  ownerId: string;
  guestId?: string;
  guestName: string;
  attendance: 'attending' | 'unable';
  guestCount: number;
  message: string;
  createdAt?: unknown;
}

export interface WishDoc {
  wishId: string;
  invitationId: string;
  ownerId: string;
  guestName: string;
  message: string;
  isVisible: boolean;
  createdAt?: unknown;
}

export interface UserProfileDoc {
  userId: string;
  name: string;
  email: string;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
