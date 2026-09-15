import type { TemplateDiffEntry } from '@/core/planner/diffTemplate';

export function TemplateDiffList({ entries }: { entries: TemplateDiffEntry[] }) {
  return (
    <ul className="diff">
      {entries.map((d, i) => (
        <li key={`${d.key}-${i}`} data-kind={d.change === 'removed' ? 'dropped' : d.change === 'added' ? 'kept' : 'moved'}>
          <span>
            <span className="row-name">{d.title}</span>
            <span className="row-note">{d.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
