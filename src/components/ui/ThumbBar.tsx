import type { ReactNode } from 'react';

/** DESIGN.md "The Thumb-Zone Rule": the committing action lives here, 52px
 * minimum, two columns by default or `stacked` for one full-width action. */
export function ThumbBar({ stacked = false, children }: { stacked?: boolean; children: ReactNode }) {
  return <div className={`thumb${stacked ? ' stacked' : ''}`}>{children}</div>;
}
