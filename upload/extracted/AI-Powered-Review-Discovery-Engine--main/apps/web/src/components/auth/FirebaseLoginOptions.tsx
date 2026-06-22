'use client';

import {
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInAnonymously,
  ConfirmationResult,
} from 'firebase/auth';
import { Loader2, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recaptchaVerifier: any;
  }
}

export function FirebaseLoginOptions() {
  const router = useRouter();
  const { loginWithFirebase } = useAuthStore();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingAnonymous, setLoadingAnonymous] = useState(false);

  // Phone auth state
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await loginWithFirebase(idToken);
      toast.success('Successfully signed in with Google');
      router.push('/dashboard');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Google sign in failed');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handleSendCode = async () => {
    if (!phoneNumber) return toast.error('Please enter a phone number');
    setLoadingPhone(true);
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setShowCodeInput(true);
      toast.success('Verification code sent');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Failed to send verification code');
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return toast.error('Please enter the verification code');
    if (!confirmationResult)
      return toast.error('No verification in progress. Please request a new code.');
    setLoadingPhone(true);
    try {
      const result = await confirmationResult.confirm(verificationCode);
      const idToken = await result.user.getIdToken();
      await loginWithFirebase(idToken);
      toast.success('Successfully signed in with Phone');
      router.push('/dashboard');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Invalid verification code');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setLoadingAnonymous(true);
    try {
      const result = await signInAnonymously(auth);
      const idToken = await result.user.getIdToken();
      await loginWithFirebase(idToken);
      toast.success('Successfully signed in as Guest');
      router.push('/dashboard');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Guest sign in failed');
    } finally {
      setLoadingAnonymous(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-surface-active" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-surface-base text-content-tertiary">Or continue with</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3">
        <button
          onClick={handleGoogleSignIn}
          disabled={loadingGoogle || loadingPhone || loadingAnonymous}
          className="w-full inline-flex justify-center py-2.5 px-4 border border-surface-active rounded-lg shadow-sm bg-surface-base text-body-sm font-medium text-content-primary hover:bg-surface-hover transition-colors"
        >
          {loadingGoogle ? (
            <Loader2 className="w-5 h-5 animate-spin text-content-secondary" />
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </>
          )}
        </button>

        {!showPhoneAuth ? (
          <button
            onClick={() => setShowPhoneAuth(true)}
            disabled={loadingGoogle || loadingPhone || loadingAnonymous}
            className="w-full inline-flex justify-center py-2.5 px-4 border border-surface-active rounded-lg shadow-sm bg-surface-base text-body-sm font-medium text-content-primary hover:bg-surface-hover transition-colors"
          >
            <Phone className="w-5 h-5 mr-2 text-content-secondary" />
            Phone Number
          </button>
        ) : (
          <div className="space-y-3 p-4 border border-surface-active rounded-lg bg-surface-subtle">
            {!showCodeInput ? (
              <>
                <div>
                  <label className="block text-xs text-content-secondary mb-1">
                    Phone Number (with country code)
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="input-field text-sm"
                  />
                </div>
                <button
                  onClick={handleSendCode}
                  disabled={loadingPhone || !phoneNumber || loadingAnonymous}
                  className="btn-secondary w-full text-sm py-2"
                >
                  {loadingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Code'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-content-secondary mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    className="input-field text-sm"
                  />
                </div>
                <button
                  onClick={handleVerifyCode}
                  disabled={loadingPhone || !verificationCode || loadingAnonymous}
                  className="btn-primary w-full text-sm py-2"
                >
                  {loadingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign In'}
                </button>
              </>
            )}
            <div id="recaptcha-container"></div>
          </div>
        )}

        <button
          onClick={handleAnonymousSignIn}
          disabled={loadingGoogle || loadingPhone || loadingAnonymous}
          className="w-full inline-flex justify-center py-2.5 px-4 border border-surface-active rounded-lg shadow-sm bg-surface-base text-body-sm font-medium text-content-primary hover:bg-surface-hover transition-colors"
        >
          {loadingAnonymous ? (
            <Loader2 className="w-5 h-5 animate-spin text-content-secondary" />
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2 text-content-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Continue as Guest
            </>
          )}
        </button>
      </div>
    </div>
  );
}
