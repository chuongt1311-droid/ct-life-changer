import type { ReactNode } from 'react';

export type TagState = 'ready' | 'drifting' | 'depleted' | 'grinding' | 'neutral';

const STATE_LABEL: Record<TagState, string> = {
  ready: 'Ready',
  drifting: 'Drifting',
  depleted: 'Depleted',
  grinding: 'Grinding',
  neutral: '',
};

/** DESIGN.md "Tags (readiness)": one reading colour per state, `grinding`
 * alone carries the zebra overload material. Pass `children` to override the
 * label (e.g. "Now", "Anchor", "+40 PHY") while keeping the state's colour. */
export function Tag({ state, children }: { state: TagState; children?: ReactNode }) {
  return (
    <span className="tag" data-state={state}>
      {children ?? STATE_LABEL[state]}
    </span>
  );
}
