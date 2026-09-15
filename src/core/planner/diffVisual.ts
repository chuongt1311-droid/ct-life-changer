import type { ChangeKind } from './diff';

export interface DiffVisual {
  mark: 'moved' | 'shorter' | 'dropped' | 'kept';
  tone: 'ok' | 'warn' | 'stop';
}

/** Maps the planner's seven ChangeKinds onto DESIGN.md's four diff marks
 * (Session List / Diff Rows). Pure. */
export function diffVisual(change: ChangeKind): DiffVisual {
  switch (change) {
    case 'kept':
    case 'added':
      return { mark: 'kept', tone: 'ok' };
    case 'moved':
    case 'swapped':
      return { mark: 'moved', tone: 'warn' };
    case 'shrunk':
      return { mark: 'shorter', tone: 'warn' };
    case 'dropped':
    case 'missed':
      return { mark: 'dropped', tone: 'stop' };
    case 'skipped':
      // CT chose this. It leaves the day like a drop, but it is not an alarm.
      return { mark: 'dropped', tone: 'warn' };
  }
}
