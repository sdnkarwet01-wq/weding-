import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from './firebase';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  url: string;
  provider: 'firebase-storage' | 'studio-server';
}

export function validateMediaFile(file: File, kind: 'image' | 'audio'): string | null {
  if (kind === 'image') {
    if (!IMAGE_TYPES.has(file.type)) {
      return 'Please upload a JPG, PNG, or WebP image file.';
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return 'Image must be 5 MB or smaller.';
    }
  } else {
    if (!AUDIO_TYPES.has(file.type)) {
      return 'Please upload an MP3, WAV, OGG, or M4A audio file.';
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return 'Audio file must be 10 MB or smaller.';
    }
  }
  return null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

async function uploadToStudioServer(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to upload media.');
  }
  const token = await user.getIdToken();
  onProgress?.(20);
  const dataBase64 = await readFileAsBase64(file);
  onProgress?.(55);

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      folder,
      dataBase64,
    }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || 'Server upload failed.');
  }

  const json = (await response.json()) as { url: string };
  onProgress?.(100);
  return { url: json.url, provider: 'studio-server' };
}

export async function uploadMediaFile(
  file: File,
  kind: 'image' | 'audio',
  invitationId: string,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const validationError = validateMediaFile(file, kind);
  if (validationError) {
    throw new Error(validationError);
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required for uploads.');
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-50);
  const storagePath = `wedlink/${user.uid}/${invitationId}/${folder}/${Date.now()}-${cleanName}`;

  try {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        task.cancel();
        reject(new Error('storage/timeout'));
      }, 15000);

      task.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(pct);
        },
        (err) => {
          clearTimeout(timeout);
          reject(err);
        },
        async () => {
          clearTimeout(timeout);
          try {
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            resolve(downloadUrl);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    return { url, provider: 'firebase-storage' };
  } catch (err) {
    // Graceful fallback to authenticated Studio Server storage if Firebase Storage bucket rules/CORS are not yet enabled
    console.warn('Firebase Storage unavailable, routing via authenticated Studio media endpoint:', err);
    return uploadToStudioServer(file, folder, onProgress);
  }
}

export async function deleteMediaByUrl(url: string): Promise<void> {
  if (!url || !url.includes('firebasestorage.googleapis.com')) {
    return;
  }
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // Non-fatal if already removed
  }
}
