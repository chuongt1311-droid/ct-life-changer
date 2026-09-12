'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { sendMagicLink } from './actions';

/** Reads the ?error= query param (set by /auth/callback or the middleware on
 * a rejected sign-in). Split out because useSearchParams() requires a
 * Suspense boundary for the page to still prerender. */
function UrlError() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  return urlError ? <p role="alert">{urlError}</p> : null;
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
    <main>
      <h1>Sign in</h1>
      <p>Sends a one-time sign-in link to your email.</p>
      <button onClick={handleClick} disabled={status === 'sending' || status === 'sent'}>
        {status === 'sent' ? 'Link sent — check your email' : 'Send me a sign-in link'}
      </button>
      {status === 'error' && <p role="alert">{error}</p>}
      {status !== 'error' && (
        <Suspense fallback={null}>
          <UrlError />
        </Suspense>
      )}
    </main>
  );
}
