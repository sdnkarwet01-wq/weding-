import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseConfig } from '../lib/firebase';
import { createNewInvitation } from '../services/weddingService';
import { TemplateId } from '../types/wedding';

type AuthMode = 'signin' | 'signup' | 'reset';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      type?: 'standard' | 'icon';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      width?: number;
      locale?: string;
    }
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthMode) || 'signin';
  const requestedTemplate = searchParams.get('template') as TemplateId | null;

  const [mode, setMode] = useState<AuthMode>(
    initialMode === 'signup' || initialMode === 'reset' ? initialMode : 'signin'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);

  const {
    user,
    isEmailVerified,
    signInWithGoogle,
    signInWithGoogleCredential,
    signInWithGoogleRedirect,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const redirectingRef = useRef(false);
  const gsiContainerRef = useRef<HTMLDivElement | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [showNewTabHint, setShowNewTabHint] = useState(false);
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);

  const finishAuthenticatedNavigation = useCallback(
    async (uid: string) => {
      redirectingRef.current = true;
      showToast('Signed in to WEDLINK Studio.', 'success');
      if (requestedTemplate) {
        try {
          const created = await createNewInvitation(uid, requestedTemplate);
          navigate(`/editor/${created.invitationId}`, { replace: true });
          return;
        } catch {
          // Fall through to dashboard if template creation fails
        }
      }
      navigate('/dashboard', { replace: true });
    },
    [navigate, requestedTemplate, showToast]
  );

  useEffect(() => {
    if (user && isEmailVerified && !submitting && !redirectingRef.current) {
      redirectingRef.current = true;
      if (requestedTemplate) {
        void (async () => {
          try {
            const created = await createNewInvitation(user.uid, requestedTemplate);
            navigate(`/editor/${created.invitationId}`, { replace: true });
          } catch {
            navigate('/dashboard', { replace: true });
          }
        })();
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isEmailVerified, requestedTemplate, navigate, submitting]);

  const handleGoogleError = useCallback(
    (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string })?.code || '';
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      setErrorCode(code || null);

      if (code === 'auth/popup-blocked' || raw.includes('auth/popup-blocked')) {
        setErrorMsg(
          'Popup Google Login diblokir oleh browser atau frame pratinjau. Gunakan tombol Google di atas, izinkan popup, atau buka login di tab baru.'
        );
        setShowNewTabHint(true);
        if (!isInIframe) setShowRedirectFallback(true);
      } else if (
        code === 'auth/popup-closed-by-user' ||
        raw.includes('auth/popup-closed-by-user') ||
        code === 'auth/cancelled-popup-request' ||
        raw.includes('auth/cancelled-popup-request')
      ) {
        setErrorMsg(
          'Jendela Google Login ditutup sebelum selesai atau terhalang kebijakan iframe/cookie. Coba tombol Google utama atau buka di tab baru.'
        );
        if (isInIframe) setShowNewTabHint(true);
        else setShowRedirectFallback(true);
      } else if (code === 'auth/unauthorized-domain' || raw.includes('auth/unauthorized-domain')) {
        setErrorMsg(
          `Domain "${host}" belum terdaftar di Firebase Authorized Domains. Tambahkan "${host}" di Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/operation-not-allowed' || raw.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Google Sign-In belum aktif di Firebase Console (Authentication → Sign-in method → Google).'
        );
      } else if (
        code === 'auth/network-request-failed' ||
        raw.includes('auth/network-request-failed') ||
        code === 'auth/internal-error' ||
        raw.includes('auth/internal-error')
      ) {
        setErrorMsg(
          'Koneksi Google Sign-In gagal atau cookie pihak ketiga diblokir di frame pratinjau. Coba buka studio di tab baru.'
        );
        setShowNewTabHint(true);
        if (!isInIframe) setShowRedirectFallback(true);
      } else if (raw.startsWith('{') && raw.includes('Missing or insufficient permissions')) {
        setErrorMsg(
          'Login berhasil tetapi gagal menyinkronkan profil studio ke database. Silakan muat ulang atau coba klik lagi.'
        );
      } else {
        setErrorMsg(raw || 'Google Sign-In failed.');
      }
    },
    [isInIframe]
  );

  // Load Google Identity Services (direct ID token credential flow; bypasses firebaseapp.com/__/auth/iframe)
  useEffect(() => {
    if (mode === 'reset') return;
    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId || typeof window === 'undefined') return;

    let cancelled = false;

    const initGisButton = () => {
      if (cancelled || !window.google?.accounts?.id || !gsiContainerRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          cancel_on_tap_outside: false,
          callback: async (response) => {
            if (!response.credential) {
              setErrorMsg('Google tidak mengembalikan token kredensial. Silakan coba lagi.');
              return;
            }
            setErrorMsg(null);
            setErrorCode(null);
            setSubmitting(true);
            try {
              const signedIn = await signInWithGoogleCredential(response.credential);
              await finishAuthenticatedNavigation(signedIn.uid);
            } catch (err) {
              redirectingRef.current = false;
              handleGoogleError(err);
            } finally {
              setSubmitting(false);
            }
          },
        });

        gsiContainerRef.current.innerHTML = '';
        const containerWidth = Math.min(360, Math.max(240, gsiContainerRef.current.clientWidth || 340));
        window.google.accounts.id.renderButton(gsiContainerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          width: containerWidth,
        });
        setGisReady(true);
      } catch {
        setGisReady(false);
      }
    };

    if (window.google?.accounts?.id) {
      initGisButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', initGisButton);
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initGisButton);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGisButton;
    script.onerror = () => {
      if (!cancelled) setGisReady(false);
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [mode, finishAuthenticatedNavigation, handleGoogleError, signInWithGoogleCredential]);

  const handleGooglePopup = async () => {
    setErrorMsg(null);
    setErrorCode(null);
    setShowNewTabHint(false);
    setShowRedirectFallback(false);
    setSubmitting(true);
    try {
      const signedIn = await signInWithGoogle();
      await finishAuthenticatedNavigation(signedIn.uid);
    } catch (err) {
      redirectingRef.current = false;
      handleGoogleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setErrorMsg(null);
    setErrorCode(null);
    setSubmitting(true);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      setSubmitting(false);
      handleGoogleError(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorCode(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setInfoMsg('Password reset instructions have been sent to your email.');
        showToast('Password reset email sent.', 'success');
        setSubmitting(false);
        return;
      }

      if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMsg('Please enter your full name.');
          setSubmitting(false);
          return;
        }
        const createdUser = await signUpWithEmail(name, email, password);
        if (!createdUser.emailVerified) {
          showToast('Account created! Please verify your email address.', 'info');
        }
        navigate('/dashboard', { replace: true });
      } else {
        const signedIn = await signInWithEmail(email, password);
        redirectingRef.current = true;
        if (signedIn.emailVerified && requestedTemplate) {
          const created = await createNewInvitation(signedIn.uid, requestedTemplate);
          navigate(`/editor/${created.invitationId}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      redirectingRef.current = false;
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Please enable it there or use Google Sign-In above right away.'
        );
      } else if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        setErrorMsg('Invalid email or password. Please check your credentials.');
      } else if (raw.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Try signing in instead.');
      } else if (raw.includes('auth/weak-password')) {
        setErrorMsg('Please use a password of at least 6 characters.');
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#443C35] flex flex-col justify-between p-6">
      <div className="max-w-md w-full mx-auto pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#737C68] hover:text-[#443C35] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to WEDLINK</span>
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto my-8 bg-white border border-[#E5DDD0] rounded-2xl p-8 sm:p-10 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <p className="font-cormorant text-2xl font-semibold tracking-[0.06em]">WEDLINK</p>
          <h1 className="font-cormorant text-3xl font-medium text-[#443C35]">
            {mode === 'signup'
              ? 'Create your studio account'
              : mode === 'reset'
              ? 'Reset your password'
              : 'Welcome back to studio'}
          </h1>
          <p className="text-xs text-[#737C68]">
            {mode === 'reset'
              ? 'Enter your email address to receive a reset link.'
              : 'Your invitations, guest lists, and RSVPs stay private to your account.'}
          </p>
        </div>

        {/* Google Sign-In: Official Google Identity Services + Firebase Popup Fallback */}
        {mode !== 'reset' && (
          <>
            <div className="space-y-2.5">
              {firebaseConfig.oAuthClientId && (
                <div
                  ref={gsiContainerRef}
                  className={`w-full flex justify-center min-h-[42px] ${submitting ? 'opacity-60 pointer-events-none' : ''}`}
                />
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleGooglePopup}
                className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 ${
                  gisReady
                    ? 'bg-[#FAF7F2] border border-[#DCD3C6] text-[#443C35] hover:bg-[#F1EAE0] text-xs py-2'
                    : 'bg-[#443C35] text-[#FAF7F2] hover:bg-[#5A5047]'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>
                  {submitting
                    ? 'Signing in...'
                    : gisReady
                    ? 'Alternative: Google Popup Sign-In'
                    : 'Continue with Google'}
                </span>
              </button>

              {showRedirectFallback && !isInIframe && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleRedirect}
                  className="w-full py-2 px-3 rounded-lg border border-[#C6AC83] bg-[#FAF7F2] text-xs font-medium text-[#443C35] hover:bg-[#F1EAE0] transition-colors cursor-pointer"
                >
                  Continue with Google (Full-Page Redirect)
                </button>
              )}

              {(isInIframe || showNewTabHint) && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/auth'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-lg border border-[#E5DDD0] bg-[#FAF7F2] text-[11px] text-[#443C35]/80 hover:text-[#443C35] hover:bg-[#F1EAE0] transition-colors flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Halaman Login di Tab Baru</span>
                </a>
              )}
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#E5DDD0] w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-widest text-[#737C68]">
                or
              </span>
              <div className="border-t border-[#E5DDD0] w-full" />
            </div>
          </>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[#FDF2F2] border border-[#E5B8B8] text-xs text-[#8B2626] leading-relaxed space-y-1"
          >
            <p>{errorMsg}</p>
            {errorCode && (
              <p className="text-[10px] font-mono opacity-80">
                Kode: {errorCode}
                {typeof window !== 'undefined' ? ` · Host: ${window.location.hostname}` : ''}
              </p>
            )}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-lg bg-[#F1EAE0] border border-[#C6AC83] text-xs text-[#443C35] leading-relaxed">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#737C68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aditya & Nabila"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#737C68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="couple@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg(null);
                      setErrorCode(null);
                      setInfoMsg(null);
                    }}
                    className="text-xs text-[#737C68] hover:text-[#443C35] underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737C68] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-[#DCD3C6] rounded-lg focus:outline-none focus:border-[#737C68]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[#FAF7F2] border border-[#D8CFC2] text-[#443C35] text-sm font-medium rounded-lg hover:bg-[#F1EAE0] transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'signup'
              ? 'Create Account'
              : mode === 'reset'
              ? 'Send Reset Email'
              : 'Sign In with Email'}
          </button>
        </form>

        <div className="text-center text-xs text-[#737C68] pt-2">
          {mode === 'signin' ? (
            <>
              New to WEDLINK?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setErrorCode(null);
                }}
                className="text-[#443C35] font-medium underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setErrorCode(null);
                }}
                className="text-[#443C35] font-medium underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#443C35]/55">
        WEDLINK Digital Wedding Invitation Studio
      </p>
    </div>
  );
}
