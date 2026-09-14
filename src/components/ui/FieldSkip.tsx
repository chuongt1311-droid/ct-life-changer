'use client';

import { useState } from 'react';

/** DESIGN.md "Inputs / Fields — Skip": empties the group rather than hiding
 * it, then relabels itself "Skipped — undo". `onSkip` clears the caller's
 * field state; `onUndo` is optional and only needed if the caller wants to
 * restore a previous value rather than leave it empty. */
export function FieldSkip({ onSkip, onUndo }: { onSkip: () => void; onUndo?: () => void }) {
  const [skipped, setSkipped] = useState(false);

  function handleClick() {
    if (skipped) {
      onUndo?.();
      setSkipped(false);
    } else {
      onSkip();
      setSkipped(true);
    }
  }

  return (
    <button type="button" className="skip" onClick={handleClick}>
      {skipped ? 'Skipped — undo' : 'Skip this section'}
    </button>
  );
}
