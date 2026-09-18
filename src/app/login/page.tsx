'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { sendMagicLink, verifyOtpCode } from './actions';

function UrlError() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  return urlError ? (
    <p role="alert" className="note">
      {urlError}
    </p>
  ) : null;
}

export default function LoginPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  async function handleSend() {
    setStatus('sending');
    const result = await sendMagicLink();
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong');
    }
  }

  async function handleVerify() {
    setStatus('verifying');
    const result = await verifyOtpCode(code.trim());
    if (result.ok) {
      // A full navigation, not router.push — the session cookie
      // verifyOtpCode just set needs to reach the next request the
      // browser makes, and proxy.ts reads that from the request itself.
      window.location.href = '/';
    } else {
      setStatus('sent');
      setError(result.error ?? 'That code didn’t work — check it and try again.');
    }
  }

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Sign in
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">Life Changer</h1>
        <p className="next-note">
          {status === 'sent' || status === 'verifying'
            ? 'Enter the code from the email — same tab, no need to open anything else.'
            : 'Sends a one-time sign-in code to your email. No password to remember or leak.'}
        </p>
      </section>
      <div className="stepback">
        {(status === 'error' || (status === 'sent' && error)) && (
          <p role="alert" className="note">
            {error}
          </p>
        )}
        {status === 'idle' && (
          <Suspense fallback={null}>
            <UrlError />
          </Suspense>
        )}
      </div>
      {status === 'sent' || status === 'verifying' ? (
        <div className="thumb">
          <div className="field">
            <label htmlFor="otpCode">Sign-in code</label>
            <input
              id="otpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code from the email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={status === 'verifying'}
            />
          </div>
          <button className="btn btn-main btn-wide" onClick={handleVerify} disabled={status === 'verifying' || code.trim().length === 0}>
            {status === 'verifying' ? 'Checking…' : 'Confirm code'}
          </button>
        </div>
      ) : (
        <div className="thumb">
          <button className="btn btn-main btn-wide" onClick={handleSend} disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send me a sign-in code'}
          </button>
        </div>
      )}
    </main>
  );
}
