'use client';

import { useState } from 'react';
import type { DiffEntry } from '@/core/planner/diff';
import type { TemplateDiffEntry } from '@/core/planner/diffTemplate';
import { DiffList } from '@/components/planner/DiffList';
import { TemplateDiffList } from './TemplateDiffList';
import { confirmProposalAction, discardProposalAction } from '@/app/mentor/actions';

export interface Proposal {
  id: string;
  kind: 'schedule' | 'template';
  target: string;
  diff: DiffEntry[] | TemplateDiffEntry[];
  conflicts: [string, string][];
}

/** The mentor's own diff card — inert until CT taps one of these two
 * buttons. Confirm re-validates against the schedule/template's CURRENT
 * state (`resolveProposalConfirmation`), so an error here means something
 * changed since the mentor proposed this, not that the tap failed. */
export function ProposalCard({ proposal, onResolved }: { proposal: Proposal; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // A server action can reject outright (e.g. the proposal's stored edits
  // turn out to be malformed and blow up deep in a DB write) rather than
  // resolving to `{ok:false}` — without this try/catch that left the button
  // stuck on "Working…" forever, since the code after the bare `await`
  // never ran.
  async function confirm() {
    setBusy(true);
    try {
      const result = await confirmProposalAction(proposal.id);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onResolved();
    } catch {
      setErrors(['Something went wrong confirming this. Try again, or discard it.']);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await discardProposalAction(proposal.id);
      onResolved();
    } catch {
      setErrors(['Something went wrong discarding this. Try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="proposal-card">
      {proposal.kind === 'schedule' ? <DiffList entries={proposal.diff as DiffEntry[]} /> : <TemplateDiffList entries={proposal.diff as TemplateDiffEntry[]} />}
      {proposal.conflicts.length > 0 && (
        <p className="note" role="alert">
          {proposal.conflicts.map(([a, b]) => `"${a}" and "${b}" overlap.`).join(' ')}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="empty" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="proposal-actions">
        <button className="btn btn-main" onClick={confirm} disabled={busy}>
          {busy ? 'Working…' : 'Confirm'}
        </button>
        <button className="btn btn-quiet" onClick={discard} disabled={busy}>
          Discard
        </button>
      </div>
    </div>
  );
}
