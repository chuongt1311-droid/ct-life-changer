'use client';

import { useState } from 'react';
import { pingSupabase, type PingResult } from './actions';

export function HealthCheck() {
  const [result, setResult] = useState<PingResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setResult(await pingSupabase());
    setLoading(false);
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Checking…' : 'Read + write settings'}
      </button>
      {result?.ok && <p>OK — timezone is {result.timezone}.</p>}
      {result && !result.ok && <p role="alert">{result.error}</p>}
    </div>
  );
}
