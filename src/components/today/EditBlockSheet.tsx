'use client';

import { useState } from 'react';
import type { Block } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import { formatPlanMinute, toPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';

/** Edit one block, or add a new one when `block` is null. Emits a single
 *  PlanEdit; nothing is saved here — EditableDay collects edits and one review
 *  commits them all. */
export function EditBlockSheet({
  block,
  nowMinute,
  onApply,
  onClose,
}: {
  block: Block | null;
  nowMinute: number;
  onApply: (edit: PlanEdit) => void;
  onClose: () => void;
}) {
  const adding = block === null;
  const [title, setTitle] = useState(block?.title ?? '');
  const [startText, setStartText] = useState(formatPlanMinute(block?.start ?? nowMinute));
  const [duration, setDuration] = useState(block ? block.end - block.start : 30);

  function apply() {
    const toStart = toPlanMinute(startText);
    if (adding) {
      onApply({
        type: 'add',
        id: `manual-${Date.now()}`,
        title,
        kind: 'task',
        start: toStart,
        durationMin: duration,
        priority: 3,
      });
      onClose();
      return;
    }
    if (toStart !== block.start) onApply({ type: 'move', blockId: block.id, toStart });
    if (duration !== block.end - block.start) onApply({ type: 'resize', blockId: block.id, durationMin: duration });
    onClose();
  }

  return (
    <div className="stepback">
      <Placard>{adding ? 'Add something' : block.title}</Placard>

      {adding && (
        <div className="field">
          <label htmlFor="edit-title">What is it</label>
          <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with coach" />
        </div>
      )}

      <div className="field">
        <label htmlFor="edit-start">Starts at</label>
        <input id="edit-start" type="time" value={startText} onChange={(e) => setStartText(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="edit-duration">Minutes</label>
        <input
          id="edit-duration"
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      {!adding && (
        <button
          className="btn btn-quiet btn-wide"
          onClick={() => {
            onApply({ type: 'drop', blockId: block.id });
            onClose();
          }}
        >
          Skip it today
        </button>
      )}

      <ThumbBar>
        <button className="btn btn-main" onClick={apply}>
          {adding ? 'Add it' : 'Apply'}
        </button>
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
      </ThumbBar>
    </div>
  );
}
