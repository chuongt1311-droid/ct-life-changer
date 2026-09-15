'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Adjustment, Block, Flag, GuardState } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import type { DiffEntry } from '@/core/planner/diff';
import { formatPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { Tag } from '@/components/ui/Tag';
import { DiffList } from '@/components/planner/DiffList';
import { EditBlockSheet } from './EditBlockSheet';
import { confirmEditsAction, previewEditsAction } from '@/app/day-changed/actions';

const RANK: Record<string, 'done' | 'now' | 'next'> = {
  done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done',
  active: 'now', planned: 'next',
};
const TAG_LABEL: Record<string, string> = {
  done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed',
  dropped: 'Dropped', active: 'Now', planned: 'Next',
};

/** What confirming needs beyond the edited blocks — only ever populated when
 * `previewAction` is the future-date one (Plan-ahead); Today's own
 * `previewEditsAction` never returns it, so `take()` passes `undefined`
 * straight through to `confirmEditsAction`, which ignores a 3rd argument it
 * never declared. */
type ConfirmMeta = { state: GuardState; flags: Flag[]; adjustments: Adjustment[] };
type Review = { date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; meta?: ConfirmMeta };

type PreviewFn = (date: string, edits: PlanEdit[]) => Promise<{
  date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[];
  state?: GuardState; flags?: Flag[]; adjustments?: Adjustment[];
}>;
type ConfirmFn = (date: string, blocks: Block[], meta?: ConfirmMeta) => Promise<void>;

const editTarget = (e: PlanEdit): string | null =>
  e.type === 'move' || e.type === 'resize' || e.type === 'drop' ? e.blockId : null;

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** A day's session list, made editable — Today's own day (sub-project A) by
 * default, or any date the Plan-ahead detail page passes in via
 * `previewAction`/`confirmAction`. Tapping an open row opens
 * `EditBlockSheet`; edits stack as client-only state until "Review changes"
 * turns them into one diff, and the confirm button persists. Nothing is
 * written until that last step.
 *
 * `actions` is the page's own thumb-bar content (Start rest / Day changed
 * on Today; a plain "back to the list" bar on Plan-ahead): while edits are
 * pending this component's own "Review changes" takes the screen's one gold
 * action instead, and the passed-in bar is shown otherwise. */
export function EditableDay({
  date,
  blocks,
  nowMinute,
  actions,
  previewAction,
  confirmAction,
}: {
  date: string;
  blocks: Block[];
  nowMinute: number;
  actions: ReactNode;
  previewAction?: PreviewFn;
  confirmAction?: ConfirmFn;
}) {
  const router = useRouter();
  const preview: PreviewFn = previewAction ?? ((_date: string, edits: PlanEdit[]) => previewEditsAction(edits));
  const confirm: ConfirmFn = confirmAction ?? confirmEditsAction;
  const [edits, setEdits] = useState<PlanEdit[]>([]);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined); // undefined = closed, null = adding
  const [review, setReview] = useState<Review | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pendingIds = new Set(edits.map(editTarget).filter((id): id is string => id !== null));

  async function openReview() {
    setBusy(true);
    const result = await preview(date, edits);
    setBusy(false);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const meta = result.state !== undefined && result.flags !== undefined && result.adjustments !== undefined
      ? { state: result.state, flags: result.flags, adjustments: result.adjustments }
      : undefined;
    setReview({ date: result.date, blocks: result.blocks, diff: result.diff, conflicts: result.conflicts, meta });
  }

  async function take() {
    if (!review) return;
    setBusy(true);
    // confirmEditsAction (Today's default) persists without redirecting —
    // Today is already at '/', and confirmReflowAction's redirect('/')
    // (fine for Day-changed, a real cross-route confirm) throws Next's
    // NEXT_REDIRECT sentinel as a terminal operation: any code after it in
    // the same call never runs, by design. router.refresh() plus resetting
    // this component's own local state is what gets the screen back to the
    // fresh list — Plan-ahead's confirm action follows the same pattern.
    await confirm(review.date, review.blocks, review.meta);
    router.refresh();
    setReview(null);
    setEdits([]);
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
