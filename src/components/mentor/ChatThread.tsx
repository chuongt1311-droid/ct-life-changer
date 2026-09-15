'use client';

import { useState } from 'react';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from './CrisisContactsCard';
import { Icon } from '@/components/icons/Icon';
import { ProposalCard, type Proposal } from './ProposalCard';
import type { CrisisContact } from '@/core/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Only assistant messages carry one — needed to attach a proposal loaded
   * on initial page load (mentor/page.tsx) to the message that produced it.
   * A message sent this session already gets its proposals live, keyed by
   * array index instead (see `liveProposalsByIndex` below). */
  id?: string;
}

type StreamEvent = { type: 'text'; text: string } | { type: 'proposal'; proposal: Proposal };

/** Reads the chat route's NDJSON stream — a mix of text deltas and, since
 * the mentor can now propose real changes (tool use), proposal events —
 * into the message list and a per-message set of pending proposal cards.
 * Everything else (cap check, context assembly, usage recording,
 * mentor_messages logging) still happens entirely in the route itself. */
export function ChatThread({
  date,
  initialMessages,
  initialProposalsByMessageId,
  crisisContacts,
}: {
  date: string;
  initialMessages: ChatMessage[];
  initialProposalsByMessageId: Record<string, Proposal[]>;
  crisisContacts: CrisisContact[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [proposalsByMessageId, setProposalsByMessageId] = useState(initialProposalsByMessageId);
  const [liveProposalsByIndex, setLiveProposalsByIndex] = useState<Record<number, Proposal[]>>({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const localCrisis = useCrisisCheck([draft]);

  function resolveProposal(id: string) {
    setProposalsByMessageId((byId) => {
      const next = { ...byId };
      for (const key of Object.keys(next)) next[key] = next[key]!.filter((p) => p.id !== id);
      return next;
    });
    setLiveProposalsByIndex((byIndex) => {
      const next: Record<number, Proposal[]> = {};
      for (const [index, list] of Object.entries(byIndex)) next[Number(index)] = list.filter((p) => p.id !== id);
      return next;
    });
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    const assistantIndex = messages.length + 1;
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const res = await fetch('/api/mentor/chat', { method: 'POST', body: JSON.stringify({ date, message: text }) });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'text') {
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: 'assistant', content: next[next.length - 1]!.content + event.text };
              return next;
            });
          } else {
            setLiveProposalsByIndex((byIndex) => ({ ...byIndex, [assistantIndex]: [...(byIndex[assistantIndex] ?? []), event.proposal] }));
          }
        }
      }
    }
    setSending(false);
  }

  return (
    <>
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}
      {messages.length === 0 && (
        <p className="empty">Nothing asked today. The mentor already has today&apos;s plan, your recent history and your check-ins — just start.</p>
      )}
      <ul className="thread" style={{ listStyle: 'none' }}>
        {messages.map((m, i) => {
          const proposals = (m.id ? proposalsByMessageId[m.id] : undefined) ?? liveProposalsByIndex[i] ?? [];
          return (
            <li className={`msg ${m.role === 'assistant' ? 'from-dept' : 'from-ct'}`} key={i}>
              <span className="who">{m.role === 'assistant' ? 'Mentor' : 'CT'}</span>
              <div className="body">
                <p>{m.content || (sending && i === messages.length - 1 ? '…' : '')}</p>
                {proposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} onResolved={() => resolveProposal(p.id)} />
                ))}
              </div>
            </li>
          );
        })}
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
