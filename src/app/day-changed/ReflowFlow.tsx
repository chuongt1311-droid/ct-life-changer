'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DiffEntry } from '@/core/planner/diff';
import { diffVisual } from '@/core/planner/diffVisual';
import type { Block } from '@/core/types';
import type { ReflowEvent } from '@/core/planner/reflow';
import { Icon } from '@/components/icons/Icon';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { askMentorAboutReflowAction, confirmReflowAction, previewReflowAction } from './actions';

type Picked =
  | { type: 'late'; minutes: number }
  | { type: 'lostTime'; minutes: number }
  | { type: 'urgent'; title: string; durationMin: number }
  | { type: 'lowEnergy' };

function toEvent(picked: Picked, now: number): ReflowEvent {
  switch (picked.type) {
    case 'late':
      return { type: 'late', minutes: picked.minutes };
    case 'lostTime':
      return { type: 'lostTime', start: now - picked.minutes, end: now };
    case 'urgent':
      return { type: 'urgent', id: `urgent-${Date.now()}`, title: picked.title, durationMin: picked.durationMin, priority: 3 };
    case 'lowEnergy':
      return { type: 'lowEnergy', restId: `recharge-${Date.now()}` };
  }
}

export function ReflowFlow({ nowMinute }: { nowMinute: number }) {
  const [result, setResult] = useState<{ date: string; blocks: Block[]; diff: DiffEntry[] } | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function preview(p: Picked) {
    setPending(true);
    const r = await previewReflowAction(toEvent(p, nowMinute));
    setResult(r);
    setPending(false);
  }

  if (!result) {
    return (
      <div className="stepback">
        <Placard>What changed?</Placard>
        <div className="chips">
          <button className="chip" onClick={() => preview({ type: 'late', minutes: 30 })} disabled={pending}>
            <span>Running late (30 min)</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'lostTime', minutes: 60 })} disabled={pending}>
            <span>Lost an hour</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'urgent', title: 'Something urgent', durationMin: 45 })} disabled={pending}>
            <span>Something urgent came up</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'lowEnergy' })} disabled={pending}>
            <span>Low energy right now</span>
          </button>
        </div>
        {pending && <p className="hint">Working out the new day…</p>}
      </div>
    );
  }

  return (
    <>
      <div className="stepback">
        <Placard>What changed</Placard>
        <ul className="diff">
          {result.diff.map((d) => {
            const v = diffVisual(d.change);
            return (
              <li key={d.blockId} data-kind={v.mark}>
                <Icon name={v.mark} />
                <span>
                  <span className="row-name">{d.title}</span>
                  <span className="row-note">{d.reason || 'Unchanged'}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="empty">Nothing is logged until you accept. Keeping the old plan costs nothing either.</p>
        {comment && <p className="note">{comment}</p>}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => setComment((await askMentorAboutReflowAction(result.date, result.diff)).text)}
        >
          Ask mentor
        </button>
      </div>
      <ThumbBar stacked>
        <button className="btn btn-main" onClick={() => confirmReflowAction(result.date, result.blocks)}>
          <Icon name="kept" />
          Take the new day
        </button>
        <Link className="btn btn-quiet" href="/">
          Keep the old one
        </Link>
      </ThumbBar>
    </>
  );
}
