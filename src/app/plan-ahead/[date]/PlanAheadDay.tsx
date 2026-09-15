'use client';

import Link from 'next/link';
import type { Block } from '@/core/types';
import { EditableDay } from '@/components/today/EditableDay';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { previewPlanAheadAction, confirmPlanAheadAction } from './actions';

/** Plan-ahead's own thumb bar: unlike Today, there's no "Start rest" or
 * "Day changed" here — the only action a date that hasn't happened yet
 * needs is going back to the list. `EditableDay` swaps this out for its own
 * "Review changes" button the moment CT stacks an edit, same as Today. */
function BackBar() {
  return (
    <ThumbBar>
      <Link className="btn btn-quiet" href="/plan-ahead">
        Back to the list
      </Link>
    </ThumbBar>
  );
}

export function PlanAheadDay({ date, blocks, source }: { date: string; blocks: Block[]; source: 'existing' | 'generated' }) {
  return (
    <>
      {source === 'generated' && (
        <p className="note">This is a preview built from the template — nothing is saved until you edit and confirm it.</p>
      )}
      <EditableDay
        date={date}
        blocks={blocks}
        nowMinute={0}
        actions={<BackBar />}
        previewAction={previewPlanAheadAction}
        confirmAction={confirmPlanAheadAction}
      />
    </>
  );
}
