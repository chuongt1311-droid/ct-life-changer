import type { Attr } from '@/core/progression/xp';
import { ATTR_NAMES } from '@/core/progression/xp';

export interface AttributeRowProps {
  attr: Attr;
  rating: number;
  /** `Level.intoLevel` / `Level.toNext` from `levelFromXp` (Plan 1b,
   * `src/core/progression/curve.ts`) — already computed on `PlayerCard.attributes[attr]`. */
  intoLevel: number;
  toNext: number;
  leveledUp?: boolean;
}

/** DESIGN.md "Attribute Rows (signature)": a levelled-up row becomes an
 * edged gold plate via `data-up`; dept.css owns the visual treatment. */
export function AttributeRow({ attr, rating, intoLevel, toNext, leveledUp }: AttributeRowProps) {
  const need = intoLevel + toNext;
  const percent = rating >= 99 ? 100 : need === 0 ? 0 : Math.min(100, Math.round((intoLevel / need) * 100));
  return (
    <li data-up={leveledUp ? 'true' : undefined}>
      <span className="a-name">
        {attr} <span className="a-full">{ATTR_NAMES[attr]}</span>
      </span>
      <span className="a-val">{rating}</span>
      <span className="track">
        <span className="fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="to-next">{rating >= 99 ? 'Maxed' : `${intoLevel} of ${need} XP into ${rating + 1}`}</span>
    </li>
  );
}
