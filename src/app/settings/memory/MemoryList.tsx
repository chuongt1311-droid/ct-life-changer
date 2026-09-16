'use client';

import { useState } from 'react';
import type { MentorMemoryRow } from '@/lib/memory/client';
import { deleteMentorMemoryAction } from './actions';

export function MemoryList({ initial }: { initial: MentorMemoryRow[] }) {
  const [memories, setMemories] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusyId(id);
    await deleteMentorMemoryAction(id);
    setMemories((list) => list.filter((m) => m.id !== id));
    setBusyId(null);
  }

  if (memories.length === 0) return <p className="empty">The mentor hasn&apos;t saved anything about you yet.</p>;

  return (
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
  );
}
