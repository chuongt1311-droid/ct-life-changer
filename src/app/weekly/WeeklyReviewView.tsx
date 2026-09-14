'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import type { ProfileSection } from '@/core/mentor/profile';
import { revertProfileSectionAction, runWeeklyReviewAction } from './actions';
import type { WeeklyReviewResult } from '@/lib/mentor/runWeeklyReview';

export function WeeklyReviewView({ weekStart }: { weekStart: string }) {
  const [result, setResult] = useState<WeeklyReviewResult | null>(null);
  const [running, setRunning] = useState(false);
  const [reverted, setReverted] = useState<Set<string>>(new Set());

  async function run() {
    setRunning(true);
    setResult(await runWeeklyReviewAction(weekStart));
    setRunning(false);
  }

  async function revert(section: string) {
    await revertProfileSectionAction(section as ProfileSection);
    setReverted((s) => new Set(s).add(section));
  }

  if (!result) {
    return (
      <div className="stepback">
        <Placard>This week&apos;s letter</Placard>
        <p className="note">One Claude call — S1–S4, training, indulgence trend, one pattern, one focus, and any profile updates.</p>
        <ThumbBar>
          <button className="btn btn-main btn-wide" onClick={run} disabled={running}>
            {running ? 'Writing the letter…' : "Run this week's review"}
          </button>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>The letter</Placard>
      <p className="note">{result.letter}</p>
      {result.changes.length > 0 && (
        <>
          <Placard>What changed about you</Placard>
          <ul className="sessions">
            {result.changes.map((c) => (
              <li key={c.section} data-rank="next">
                <span className="what">
                  {c.section}
                  <small>{c.reason}</small>
                </span>
                {!reverted.has(c.section) ? (
                  <button className="btn btn-quiet" onClick={() => revert(c.section)}>
                    Revert
                  </button>
                ) : (
                  <span className="tag" data-state="neutral">
                    Reverted
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
