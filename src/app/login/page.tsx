'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { sendMagicLink } from './actions';

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
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus('sending');
    const result = await sendMagicLink();
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong');
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
        <p className="next-note">Sends a one-time sign-in link to your email. No password to remember or leak.</p>
      </section>
      <div className="stepback">
        {status === 'error' && (
          <p role="alert" className="note">
            {error}
          </p>
        )}
        {status !== 'error' && (
          <Suspense fallback={null}>
            <UrlError />
          </Suspense>
        )}
      </div>
      <div className="thumb">
        <button className="btn btn-main btn-wide" onClick={handleClick} disabled={status === 'sending' || status === 'sent'}>
          {status === 'sent' ? 'Link sent — check your email' : 'Send me a sign-in link'}
        </button>
      </div>
    </main>
  );
}
