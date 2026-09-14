'use client';

import { useState } from 'react';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from './CrisisContactsCard';
import { Icon } from '@/components/icons/Icon';
import type { CrisisContact } from '@/core/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Reads Plan 4's existing `POST /api/mentor/chat` text stream chunk by
 * chunk into the last assistant message — the route itself already does
 * everything else (cap check, context assembly, usage recording,
 * mentor_messages logging). */
export function ChatThread({ date, initialMessages, crisisContacts }: { date: string; initialMessages: ChatMessage[]; crisisContacts: CrisisContact[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const localCrisis = useCrisisCheck([draft]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const res = await fetch('/api/mentor/chat', { method: 'POST', body: JSON.stringify({ date, message: text }) });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: next[next.length - 1]!.content + chunk };
          return next;
        });
      }
    }
    setSending(false);
  }

  return (
    <>
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}
      <ul className="thread" style={{ listStyle: 'none' }}>
        {messages.map((m, i) => (
          <li className={`msg ${m.role === 'assistant' ? 'from-dept' : 'from-ct'}`} key={i}>
            <span className="who">{m.role === 'assistant' ? 'Mentor' : 'CT'}</span>
            <div className="body">
              <p>{m.content || (sending && i === messages.length - 1 ? '…' : '')}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="thumb">
        <form
          className="composer btn-wide"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="placard" htmlFor="ask" style={{ gridColumn: '1/-1' }}>
            Ask
          </label>
          <textarea id="ask" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message" />
          <button className="btn btn-main" type="submit" aria-label="Send" disabled={sending}>
            <Icon name="send" />
          </button>
        </form>
      </div>
    </>
  );
}
