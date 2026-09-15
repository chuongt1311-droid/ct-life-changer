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

  async function confirm() {
    setBusy(true);
    const result = await confirmProposalAction(proposal.id);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onResolved();
  }

  async function discard() {
    setBusy(true);
    await discardProposalAction(proposal.id);
    setBusy(false);
    onResolved();
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
