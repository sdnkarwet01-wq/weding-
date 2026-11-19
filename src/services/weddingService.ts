import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { createDefaultInvitation } from '../data/defaultInvitation';
import {
  GuestDoc,
  InvitationDoc,
  RsvpDoc,
  TemplateId,
  WishDoc,
} from '../types/wedding';
import { buildGuestUrl, sanitizeSlug, sanitizeText } from '../utils/sanitize';

function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 18)
      : `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

function normalizeInvitationPayload(inv: InvitationDoc): Omit<InvitationDoc, 'createdAt' | 'updatedAt'> {
  return {
    invitationId: inv.invitationId,
    ownerId: inv.ownerId,
    slug: sanitizeSlug(inv.slug),
    templateId: inv.templateId,
    status: inv.status,
    groomData: {
      fullName: sanitizeText(inv.groomData.fullName, 100),
      nickname: sanitizeText(inv.groomData.nickname, 50),
      parents: sanitizeText(inv.groomData.parents, 200),
      photoUrl: sanitizeText(inv.groomData.photoUrl, 1000),
      instagram: sanitizeText(inv.groomData.instagram || '', 80),
    },
    brideData: {
      fullName: sanitizeText(inv.brideData.fullName, 100),
      nickname: sanitizeText(inv.brideData.nickname, 50),
      parents: sanitizeText(inv.brideData.parents, 200),
      photoUrl: sanitizeText(inv.brideData.photoUrl, 1000),
      instagram: sanitizeText(inv.brideData.instagram || '', 80),
    },
    mainCouplePhoto: sanitizeText(inv.mainCouplePhoto, 1000),
    closingPhoto: sanitizeText(inv.closingPhoto, 1000),
    eventData: {
      timezone: sanitizeText(inv.eventData.timezone || 'Asia/Jakarta', 60),
      akad: {
        date: sanitizeText(inv.eventData.akad.date, 40),
        startTime: sanitizeText(inv.eventData.akad.startTime, 20),
        endTime: sanitizeText(inv.eventData.akad.endTime || '', 20),
        venue: sanitizeText(inv.eventData.akad.venue, 150),
        address: sanitizeText(inv.eventData.akad.address, 300),
        mapsUrl: sanitizeText(inv.eventData.akad.mapsUrl, 500),
      },
      reception: {
        date: sanitizeText(inv.eventData.reception.date, 40),
        startTime: sanitizeText(inv.eventData.reception.startTime, 20),
        endTime: sanitizeText(inv.eventData.reception.endTime || '', 20),
        venue: sanitizeText(inv.eventData.reception.venue, 150),
        address: sanitizeText(inv.eventData.reception.address, 300),
        mapsUrl: sanitizeText(inv.eventData.reception.mapsUrl, 500),
      },
    },
    storyData: {
      quote: sanitizeText(inv.storyData.quote, 500),
      quoteSource: sanitizeText(inv.storyData.quoteSource || '', 120),
      openingMessage: sanitizeText(inv.storyData.openingMessage, 1000),
      milestones: (inv.storyData.milestones || []).slice(0, 10).map((m) => ({
        id: sanitizeText(m.id, 40),
        title: sanitizeText(m.title, 100),
        date: sanitizeText(m.date, 40),
        description: sanitizeText(m.description, 400),
        photoUrl: sanitizeText(m.photoUrl || '', 1000),
      })),
    },
    gallery: (inv.gallery || [])
      .map((u) => sanitizeText(u, 1000))
      .filter(Boolean)
      .slice(0, 20),
    musicData: {
      enabled: Boolean(inv.musicData.enabled),
      title: sanitizeText(inv.musicData.title, 120),
      artist: sanitizeText(inv.musicData.artist, 120),
      url: sanitizeText(inv.musicData.url, 1000),
      volume: Math.max(0, Math.min(1, Number(inv.musicData.volume ?? 0.65))),
    },
    enabledSections: {
      couple: Boolean(inv.enabledSections.couple),
      story: Boolean(inv.enabledSections.story),
      countdown: Boolean(inv.enabledSections.countdown),
      gallery: Boolean(inv.enabledSections.gallery),
      rsvp: Boolean(inv.enabledSections.rsvp),
      wishes: Boolean(inv.enabledSections.wishes),
      event: Boolean(inv.enabledSections.event),
      gift: Boolean(inv.enabledSections.gift),
    },
    giftData: {
      message: sanitizeText(inv.giftData.message, 400),
      qrisUrl: sanitizeText(inv.giftData.qrisUrl, 1000),
      accounts: (inv.giftData.accounts || []).slice(0, 6).map((acc) => ({
        id: sanitizeText(acc.id, 40),
        bankName: sanitizeText(acc.bankName, 80),
        accountNumber: sanitizeText(acc.accountNumber, 60),
        accountHolder: sanitizeText(acc.accountHolder, 100),
      })),
    },
  };
}

export async function isSlugAvailable(slug: string, currentInvitationId?: string): Promise<boolean> {
  const clean = sanitizeSlug(slug);
  if (clean.length < 3) return false;
  const path = `slugs/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'slugs', clean));
    if (!snap.exists()) return true;
    const data = snap.data() as { invitationId?: string };
    return Boolean(currentInvitationId && data.invitationId === currentInvitationId);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createNewInvitation(
  ownerId: string,
  templateId: TemplateId = 'eternal-bloom'
): Promise<InvitationDoc> {
  const invitationId = generateId('inv');
  const baseSlug = `wedding-${invitationId.slice(-6).toLowerCase()}`;
  const available = await isSlugAvailable(baseSlug);
  const slug = available ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;

  const payload = createDefaultInvitation(invitationId, ownerId, templateId, slug);
  const batch = writeBatch(db);
  const invRef = doc(db, 'invitations', invitationId);
  const slugRef = doc(db, 'slugs', slug);

  const fullDoc: InvitationDoc = {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(invRef, fullDoc);
  batch.set(slugRef, {
    slug,
    invitationId,
    ownerId,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return fullDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `invitations/${invitationId}`);
  }
}

export async function saveInvitationChanges(
  inv: InvitationDoc,
  previousSlug: string
): Promise<string> {
  const normalized = normalizeInvitationPayload(inv);
  const newSlug = normalized.slug;
  const cleanPrevSlug = sanitizeSlug(previousSlug);

  if (newSlug.length < 3) {
    throw new Error('Slug must be at least 3 characters (letters, numbers, hyphens).');
  }

  if (newSlug !== cleanPrevSlug) {
    const free = await isSlugAvailable(newSlug, inv.invitationId);
    if (!free) {
      throw new Error(`The URL slug "${newSlug}" is already taken. Please choose another.`);
    }
  }

  const batch = writeBatch(db);
  const invRef = doc(db, 'invitations', inv.invitationId);

  batch.update(invRef, {
    ...normalized,
    updatedAt: serverTimestamp(),
  });

  if (newSlug !== cleanPrevSlug) {
    if (cleanPrevSlug) {
      batch.delete(doc(db, 'slugs', cleanPrevSlug));
    }
    batch.set(doc(db, 'slugs', newSlug), {
      slug: newSlug,
      invitationId: inv.invitationId,
      ownerId: inv.ownerId,
      status: normalized.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'slugs', newSlug), {
      status: normalized.status,
      invitationId: inv.invitationId,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return newSlug;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invitations/${inv.invitationId}`);
  }
}

export async function toggleInvitationStatus(inv: InvitationDoc): Promise<'draft' | 'published'> {
  const cleanSlug = sanitizeSlug(inv.slug);
  if (cleanSlug.length < 3) {
    throw new Error('Please set a valid URL slug (at least 3 characters) before publishing.');
  }

  const nextStatus = inv.status === 'published' ? 'draft' : 'published';
  const batch = writeBatch(db);
  batch.update(doc(db, 'invitations', inv.invitationId), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'slugs', cleanSlug), {
    status: nextStatus,
    invitationId: inv.invitationId,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return nextStatus;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invitations/${inv.invitationId}`);
  }
}

export async function deleteUserInvitation(inv: InvitationDoc): Promise<void> {
  try {
    const [guestsSnap, rsvpsSnap, wishesSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'guests'),
          where('ownerId', '==', inv.ownerId),
          where('invitationId', '==', inv.invitationId)
        )
      ),
      getDocs(
        query(
          collection(db, 'rsvps'),
          where('ownerId', '==', inv.ownerId),
          where('invitationId', '==', inv.invitationId)
        )
      ),
      getDocs(
        query(
          collection(db, 'wishes'),
          where('ownerId', '==', inv.ownerId),
          where('invitationId', '==', inv.invitationId)
        )
      ),
    ]);

    const refsToDelete = [
      ...guestsSnap.docs.map((d) => d.ref),
      ...rsvpsSnap.docs.map((d) => d.ref),
      ...wishesSnap.docs.map((d) => d.ref),
      doc(db, 'invitations', inv.invitationId),
    ];

    const cleanSlug = sanitizeSlug(inv.slug);
    if (cleanSlug.length >= 3) {
      refsToDelete.push(doc(db, 'slugs', cleanSlug));
    }

    const CHUNK_SIZE = 450;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      for (const ref of refsToDelete.slice(i, i + CHUNK_SIZE)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invitations/${inv.invitationId}`);
  }
}

export async function getInvitationById(invitationId: string): Promise<InvitationDoc | null> {
  const path = `invitations/${invitationId}`;
  try {
    const snap = await getDoc(doc(db, 'invitations', invitationId));
    if (!snap.exists()) return null;
    return snap.data() as InvitationDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export interface PublicSlugResolution {
  status: 'found' | 'draft' | 'not-found';
  invitation: InvitationDoc | null;
}

export async function getPublicInvitationBySlug(
  slug: string,
  viewerUid?: string
): Promise<PublicSlugResolution> {
  const clean = sanitizeSlug(slug);
  if (clean.length < 3) return { status: 'not-found', invitation: null };
  const slugPath = `slugs/${clean}`;
  try {
    const slugSnap = await getDoc(doc(db, 'slugs', clean));
    if (!slugSnap.exists()) return { status: 'not-found', invitation: null };
    const slugData = slugSnap.data() as {
      invitationId: string;
      ownerId?: string;
      status: string;
    };
    if (slugData.status !== 'published' && slugData.ownerId !== viewerUid) {
      return { status: 'draft', invitation: null };
    }
    const invSnap = await getDoc(doc(db, 'invitations', slugData.invitationId));
    if (!invSnap.exists()) return { status: 'not-found', invitation: null };
    return { status: 'found', invitation: invSnap.data() as InvitationDoc };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, slugPath);
  }
}

export function subscribeOwnerInvitations(
  ownerId: string,
  onData: (items: InvitationDoc[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'invitations'), where('ownerId', '==', ownerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as InvitationDoc);
      list.sort((a, b) => {
        const ta = toMillis(a.updatedAt);
        const tb = toMillis(b.updatedAt);
        return tb - ta;
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, 'invitations');
    }
  );
}

// ---------------------------------------------------------------------------
// Guests Management
// ---------------------------------------------------------------------------

export function subscribeOwnerGuests(
  ownerId: string,
  invitationId: string | null,
  onData: (items: GuestDoc[]) => void
) {
  const q = invitationId
    ? query(
        collection(db, 'guests'),
        where('ownerId', '==', ownerId),
        where('invitationId', '==', invitationId)
      )
    : query(collection(db, 'guests'), where('ownerId', '==', ownerId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as GuestDoc);
      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'guests')
  );
}

export async function addSingleGuest(params: {
  invitationId: string;
  ownerId: string;
  slug: string;
  guestName: string;
  guestGroup: string;
}): Promise<GuestDoc> {
  const guestId = generateId('gst');
  const uniqueToken = generateId('tk').slice(0, 24);
  const cleanName = sanitizeText(params.guestName, 100);
  const cleanGroup = sanitizeText(params.guestGroup || 'Friends & Family', 60);

  if (!cleanName) throw new Error('Guest name is required.');

  const payload: GuestDoc = {
    guestId,
    invitationId: params.invitationId,
    ownerId: params.ownerId,
    guestName: cleanName,
    guestGroup: cleanGroup,
    uniqueToken,
    invitationUrl: buildGuestUrl(params.slug, cleanName).slice(0, 500),
    invitationSent: false,
    rsvpStatus: 'pending',
    guestCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'guests', guestId), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `guests/${guestId}`);
  }
}

export async function bulkAddGuests(params: {
  invitationId: string;
  ownerId: string;
  slug: string;
  rows: Array<{ guestName: string; guestGroup: string }>;
}): Promise<number> {
  const validRows = params.rows
    .map((r) => ({
      guestName: sanitizeText(r.guestName, 100),
      guestGroup: sanitizeText(r.guestGroup || 'Friends & Family', 60),
    }))
    .filter((r) => r.guestName.length >= 1)
    .slice(0, 250);

  if (validRows.length === 0) return 0;

  const batch = writeBatch(db);
  for (const row of validRows) {
    const guestId = generateId('gst');
    const uniqueToken = generateId('tk').slice(0, 24);
    batch.set(doc(db, 'guests', guestId), {
      guestId,
      invitationId: params.invitationId,
      ownerId: params.ownerId,
      guestName: row.guestName,
      guestGroup: row.guestGroup,
      uniqueToken,
      invitationUrl: buildGuestUrl(params.slug, row.guestName).slice(0, 500),
      invitationSent: false,
      rsvpStatus: 'pending',
      guestCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return validRows.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'guests');
  }
}

export async function updateGuestRecord(
  guestId: string,
  slug: string,
  updates: Partial<Pick<GuestDoc, 'guestName' | 'guestGroup' | 'invitationSent' | 'rsvpStatus' | 'guestCount'>>
): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.guestName === 'string') {
    const clean = sanitizeText(updates.guestName, 100);
    patch.guestName = clean;
    patch.invitationUrl = buildGuestUrl(slug, clean).slice(0, 500);
  }
  if (typeof updates.guestGroup === 'string') {
    patch.guestGroup = sanitizeText(updates.guestGroup, 60);
  }
  if (typeof updates.invitationSent === 'boolean') {
    patch.invitationSent = updates.invitationSent;
  }
  if (updates.rsvpStatus) {
    patch.rsvpStatus = updates.rsvpStatus;
  }
  if (typeof updates.guestCount === 'number') {
    patch.guestCount = Math.max(0, Math.min(20, Math.round(updates.guestCount)));
  }

  try {
    await updateDoc(doc(db, 'guests', guestId), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `guests/${guestId}`);
  }
}

export async function deleteGuestRecord(guestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'guests', guestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `guests/${guestId}`);
  }
}

// ---------------------------------------------------------------------------
// RSVPs & Wishes
// ---------------------------------------------------------------------------

export function subscribeOwnerRsvps(
  ownerId: string,
  invitationId: string | null,
  onData: (items: RsvpDoc[]) => void
) {
  const q = invitationId
    ? query(
        collection(db, 'rsvps'),
        where('ownerId', '==', ownerId),
        where('invitationId', '==', invitationId)
      )
    : query(collection(db, 'rsvps'), where('ownerId', '==', ownerId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as RsvpDoc);
      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'rsvps')
  );
}

export async function submitPublicRsvp(params: {
  invitationId: string;
  ownerId: string;
  guestName: string;
  attendance: 'attending' | 'unable';
  guestCount: number;
  message: string;
}): Promise<RsvpDoc> {
  const rsvpId = generateId('rsvp');
  const cleanName = sanitizeText(params.guestName, 100);
  if (!cleanName) throw new Error('Please enter your name.');

  const payload: RsvpDoc = {
    rsvpId,
    invitationId: params.invitationId,
    ownerId: params.ownerId,
    guestName: cleanName,
    attendance: params.attendance,
    guestCount: Math.max(1, Math.min(20, Math.round(params.guestCount || 1))),
    message: sanitizeText(params.message, 500),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'rsvps', rsvpId), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rsvps/${rsvpId}`);
  }
}

export async function deleteRsvpRecord(rsvpId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'rsvps', rsvpId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rsvps/${rsvpId}`);
  }
}

export async function submitPublicWish(params: {
  invitationId: string;
  ownerId: string;
  guestName: string;
  message: string;
}): Promise<WishDoc> {
  const wishId = generateId('wsh');
  const cleanName = sanitizeText(params.guestName, 80);
  const cleanMessage = sanitizeText(params.message, 500);

  if (!cleanName) throw new Error('Please enter your name.');
  if (!cleanMessage) throw new Error('Please write a wedding wish.');

  const payload: WishDoc = {
    wishId,
    invitationId: params.invitationId,
    ownerId: params.ownerId,
    guestName: cleanName,
    message: cleanMessage,
    isVisible: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'wishes', wishId), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `wishes/${wishId}`);
  }
}

export async function fetchPublicWishes(invitationId: string, maxItems = 100): Promise<WishDoc[]> {
  const q = query(
    collection(db, 'wishes'),
    where('invitationId', '==', invitationId),
    where('isVisible', '==', true),
    limit(maxItems)
  );
  try {
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => d.data() as WishDoc);
    items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'wishes');
  }
}

export function subscribeOwnerWishes(
  ownerId: string,
  invitationId: string,
  onData: (items: WishDoc[]) => void
) {
  const q = query(
    collection(db, 'wishes'),
    where('ownerId', '==', ownerId),
    where('invitationId', '==', invitationId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as WishDoc);
      items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'wishes')
  );
}

export async function deleteWishRecord(wishId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'wishes', wishId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `wishes/${wishId}`);
  }
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return ((ts as { seconds: number }).seconds || 0) * 1000;
  }
  return 0;
}
