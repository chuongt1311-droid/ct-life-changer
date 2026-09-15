'use client';

import { type ReactNode, useState } from 'react';
import type { Block } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import type { DiffEntry } from '@/core/planner/diff';
import { formatPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { Tag } from '@/components/ui/Tag';
import { DiffList } from '@/components/planner/DiffList';
import { EditBlockSheet } from './EditBlockSheet';
import { confirmReflowAction, previewEditsAction } from '@/app/day-changed/actions';

const RANK: Record<string, 'done' | 'now' | 'next'> = {
  done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done',
  active: 'now', planned: 'next',
};
const TAG_LABEL: Record<string, string> = {
  done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed',
  dropped: 'Dropped', active: 'Now', planned: 'Next',
};

type Review = { date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][] };

const editTarget = (e: PlanEdit): string | null =>
  e.type === 'move' || e.type === 'resize' || e.type === 'drop' ? e.blockId : null;

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** Today's session list, made editable. Tapping an open row opens
 * `EditBlockSheet`; edits stack as client-only state until "Review changes"
 * turns them into one diff via `previewEditsAction`, and "Take the new day"
 * persists via the existing `confirmReflowAction`. Nothing is written until
 * that last step.
 *
 * `actions` is the page's own thumb-bar content (Start rest / Day changed):
 * while edits are pending this component's own "Review changes" takes the
 * screen's one gold action instead, and the passed-in bar is shown otherwise
 * — the day cannot be both "start resting" and "you have unreviewed changes"
 * as the single most important action. */
export function EditableDay({ blocks, nowMinute, actions }: { blocks: Block[]; nowMinute: number; actions: ReactNode }) {
  const [edits, setEdits] = useState<PlanEdit[]>([]);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined); // undefined = closed, null = adding
  const [review, setReview] = useState<Review | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pendingIds = new Set(edits.map(editTarget).filter((id): id is string => id !== null));

  async function openReview() {
    setBusy(true);
    const result = await previewEditsAction(edits);
    setBusy(false);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setReview({ date: result.date, blocks: result.blocks, diff: result.diff, conflicts: result.conflicts });
  }

  async function take() {
    if (!review) return;
    setBusy(true);
    await confirmReflowAction(review.date, review.blocks);
  }

  if (editing !== undefined) {
    return (
      <EditBlockSheet
        block={editing}
        nowMinute={nowMinute}
        onApply={(edit) => setEdits((list) => [...list, edit])}
        onClose={() => setEditing(undefined)}
      />
    );
  }

  if (review) {
    return (
      <div className="stepback">
        <Placard>What changed</Placard>
        {/* Two pinned blocks can only overlap because CT moved one onto the
            other. Say so and let them decide — the planner must not silently
            discard one of them. */}
        {review.conflicts.length > 0 && (
          <p className="note" role="alert">
            {review.conflicts.map(([a, b]) => `"${a}" and "${b}" overlap.`).join(' ')} You can still take the day.
          </p>
        )}
        <DiffList entries={review.diff} />
        <div className="thumb">
          <button className="btn btn-main" onClick={take} disabled={busy}>
            {busy ? 'Saving…' : 'Take the new day'}
          </button>
          <button className="btn btn-quiet" onClick={() => setReview(null)} disabled={busy}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Placard>The rest of today</Placard>
      <ul className="sessions">
        {blocks.map((b) => (
          <li key={b.id} data-rank={RANK[b.status] ?? 'next'} data-pending={pendingIds.has(b.id) ? 'true' : undefined}>
            {isOpen(b) ? (
              <button className="row-edit" onClick={() => setEditing(b)} aria-label={`Change ${b.title}`}>
                <span className="at">{formatPlanMinute(b.start)}</span>
                <span className="what">
                  {b.title}
                  <small>{b.anchor ? 'Anchor' : b.kind}</small>
                </span>
                <Tag state="neutral">{TAG_LABEL[b.status] ?? b.status}</Tag>
              </button>
            ) : (
              <>
                <span className="at">{formatPlanMinute(b.start)}</span>
                <span className="what">
                  {b.title}
                  <small>{b.anchor ? 'Anchor' : b.kind}</small>
                </span>
                <Tag state="neutral">{TAG_LABEL[b.status] ?? b.status}</Tag>
              </>
            )}
          </li>
        ))}
      </ul>

      <button className="btn btn-quiet" onClick={() => setEditing(null)}>
        Add something
      </button>

      {errors.length > 0 && (
        <ul className="empty" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {edits.length > 0 && (
        <p className="pending-strip">
          <span>
            {edits.length} {edits.length === 1 ? 'change' : 'changes'} pending
          </span>
          <button className="btn btn-quiet" onClick={() => setEdits([])}>
            Discard
          </button>
        </p>
      )}

      {edits.length > 0 ? (
        <div className="thumb stacked">
          <button className="btn btn-main btn-wide" onClick={openReview} disabled={busy}>
            {busy ? 'Working…' : 'Review changes'}
          </button>
        </div>
      ) : (
        actions
      )}
    </>
  );
}
