'use client';

import { useEffect, useState } from 'react';

/** DESIGN.md "The Steady Numeral Rule": a countdown must never shuffle
 * width while it's being read. `initialMinutes` comes from the server;
 * this component only ticks it down client-side afterward. */
export function Countdown({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    setMinutes(initialMinutes);
    const id = setInterval(() => setMinutes((m) => Math.max(0, m - 1)), 60000);
    return () => clearInterval(id);
  }, [initialMinutes]);

  return (
    <span className="num" data-countdown={minutes}>
      {minutes} min
    </span>
  );
}
