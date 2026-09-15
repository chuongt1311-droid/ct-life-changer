import type { DiffEntry } from '@/core/planner/diff';
import { diffVisual } from '@/core/planner/diffVisual';
import { Icon } from '@/components/icons/Icon';

/** The "What changed" rows. Shared by Day changed and Today's review sheet so
 *  the two review surfaces cannot drift apart. */
export function DiffList({ entries }: { entries: DiffEntry[] }) {
  return (
    <ul className="diff">
      {entries.map((d) => {
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
  );
}
