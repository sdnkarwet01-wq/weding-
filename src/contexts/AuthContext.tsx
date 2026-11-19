import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { UserProfileDoc } from '../types/wedding';
import { sanitizeText } from '../utils/sanitize';

interface AuthContextValue {
  user: User | null;
  profile: UserProfileDoc | null;
  isEmailVerified: boolean;
  loading: boolean;
  authReady: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithGoogleCredential: (idToken: string) => Promise<User>;
  signInWithGoogleRedirect: () => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const syncLockRef = useRef<Map<string, Promise<void>>>(new Map());

  const syncProfileToFirestore = useCallback(async (firebaseUser: User, explicitName?: string) => {
    if (!firebaseUser.emailVerified) {
      return;
    }

    const existingFlight = syncLockRef.current.get(firebaseUser.uid);
    if (existingFlight) {
      if (!explicitName) {
        await existingFlight;
        return;
      }
      await existingFlight.catch(() => {});
    }

    const runSync = async () => {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const path = `users/${firebaseUser.uid}`;

      const attemptSync = async () => {
        const snap = await getDoc(userRef);
        const safeName =
          sanitizeText(
            explicitName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Studio Host',
            100
          ) || 'Studio Host';
        const rawEmail = firebaseUser.email || `${firebaseUser.uid.slice(0, 10)}@wedlink.local`;
        const safeEmail = sanitizeText(rawEmail, 200);
        const safePhoto = sanitizeText(firebaseUser.photoURL || '', 1000);

        if (!snap.exists()) {
          const newProfile: UserProfileDoc = {
            userId: firebaseUser.uid,
            name: safeName,
            email: safeEmail.length >= 3 ? safeEmail : `${firebaseUser.uid.slice(0, 10)}@wedlink.local`,
            ...(safePhoto ? { photoUrl: safePhoto } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        } else {
          const existingData = snap.data() as UserProfileDoc;
          if (explicitName && explicitName !== existingData.name) {
            await setDoc(
              userRef,
              {
                name: safeName,
                email: safeEmail.length >= 3 ? safeEmail : existingData.email,
                ...(safePhoto ? { photoUrl: safePhoto } : {}),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            setProfile({ ...existingData, name: safeName, email: safeEmail });
          } else {
            setProfile(existingData);
          }
        }
      };

      try {
        await attemptSync();
      } catch (firstErr) {
        // Retry once after ensuring auth ID token is freshly attached to Firestore
        try {
          await firebaseUser.getIdToken(true);
          await new Promise((r) => setTimeout(r, 350));
          await attemptSync();
        } catch (err) {
          handleFirestoreError(err || firstErr, OperationType.WRITE, path);
        }
      }
    };

    const promise = runSync().finally(() => {
      if (syncLockRef.current.get(firebaseUser.uid) === promise) {
        syncLockRef.current.delete(firebaseUser.uid);
      }
    });
    syncLockRef.current.set(firebaseUser.uid, promise);
    await promise;
  }, []);

  useEffect(() => {
    void getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await result.user.getIdToken();
          await syncProfileToFirestore(result.user).catch(() => {});
        }
      })
      .catch(() => {
        // Redirect result not pending or already handled
      });

    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsEmailVerified(Boolean(currentUser?.emailVerified));
      if (currentUser && currentUser.emailVerified) {
        try {
          await syncProfileToFirestore(currentUser);
        } catch {
          // Handled inside syncProfileToFirestore
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
      setAuthReady(true);
    });
    return () => unsub();
  }, [syncProfileToFirestore]);

  const signInWithGoogle = async (): Promise<User> => {
    const result = await signInWithPopup(auth, googleProvider);
    await result.user.getIdToken();
    try {
      await syncProfileToFirestore(result.user);
    } catch {
      // Do not block authenticated Google session if Firestore profile sync hits a transient hiccup
    }
    return result.user;
  };

  const signInWithGoogleCredential = async (idToken: string): Promise<User> => {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    await result.user.getIdToken();
    try {
      await syncProfileToFirestore(result.user);
    } catch {
      // Do not block authenticated Google session if Firestore profile sync hits a transient hiccup
    }
    return result.user;
  };

  const signInWithGoogleRedirect = async (): Promise<void> => {
    await signInWithRedirect(auth, googleProvider);
  };

  const signUpWithEmail = async (name: string, email: string, password: string): Promise<User> => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const cleanName = sanitizeText(name, 100);
    if (cleanName) {
      await updateProfile(result.user, { displayName: cleanName });
    }
    try {
      await sendEmailVerification(result.user);
    } catch {
      // Non-fatal if verification email throttled
    }
    if (result.user.emailVerified) {
      await syncProfileToFirestore(result.user, cleanName);
    }
    return result.user;
  };

  const signInWithEmail = async (email: string, password: string): Promise<User> => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (result.user.emailVerified) {
      await syncProfileToFirestore(result.user);
    }
    return result.user;
  };

  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const refreshed = auth.currentUser;
    const verified = Boolean(refreshed.emailVerified);
    setUser(refreshed);
    setIsEmailVerified(verified);
    if (verified) {
      await syncProfileToFirestore(refreshed);
      return true;
    }
    return false;
  };

  const updateDisplayName = async (name: string): Promise<void> => {
    if (!auth.currentUser) throw new Error('Not signed in.');
    const cleanName = sanitizeText(name, 100);
    if (!cleanName) throw new Error('Name cannot be empty.');
    await updateProfile(auth.currentUser, { displayName: cleanName });
    await syncProfileToFirestore(auth.currentUser, cleanName);
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
    setIsEmailVerified(false);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isEmailVerified,
        loading,
        authReady,
        signInWithGoogle,
        signInWithGoogleCredential,
        signInWithGoogleRedirect,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        resendVerification,
        refreshUser,
        updateDisplayName,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
