'use client';

import { useState } from 'react';
import type { MentorMemoryRow } from '@/lib/memory/client';
import { deleteMentorMemoryAction } from './actions';

export function MemoryList({ initial, unreachable = false }: { initial: MentorMemoryRow[]; unreachable?: boolean }) {
  const [memories, setMemories] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function remove(id: string) {
    setBusyId(id);
    setErrors([]);
    try {
      await deleteMentorMemoryAction(id);
      setMemories((list) => list.filter((m) => m.id !== id));
    } catch {
      setErrors(['Something went wrong deleting this. Try again.']);
    } finally {
      setBusyId(null);
    }
  }

  // "Nothing saved" and "couldn't reach the service" look identical from an
  // empty list, so the page tells us which one it is.
  if (unreachable) return <p className="empty">Couldn&apos;t reach the mentor&apos;s memory right now. Try again in a moment.</p>;
  if (memories.length === 0) return <p className="empty">The mentor hasn&apos;t saved anything about you yet.</p>;

  return (
    <>
      {errors.length > 0 && (
        <ul className="empty" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <ul className="sessions plain">
      {memories.map((m) => (
        <li key={m.id} data-rank="next">
          <span className="what">
            {m.text}
            <small>{m.confidence} confidence · {new Date(m.createdAt).toLocaleDateString()}</small>
          </span>
          <button className="btn btn-quiet" onClick={() => remove(m.id)} disabled={busyId === m.id}>
            {busyId === m.id ? 'Removing…' : 'Delete'}
          </button>
        </li>
      ))}
      </ul>
    </>
  );
}
