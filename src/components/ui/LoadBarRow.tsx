export type ReadLevel = 'ok' | 'warn' | 'over';

export interface LoadBarRowProps {
  name: string;
  /** The reading written in words, e.g. "4h 10m · 40m over plan". Colour is
   * never the only channel (DESIGN.md "Do: write the reading in words"). */
  valueText: string;
  /** 0–100. Values ≥100 with read="over" render the zebra overload material. */
  percent: number;
  read: ReadLevel;
}

export function LoadBarRow({ name, valueText, percent, read }: LoadBarRowProps) {
  return (
    <li data-read={read}>
      <span className="bar-name">{name}</span>
      <span className="bar-val">{valueText}</span>
      <span className="track">
        <span className="fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </span>
    </li>
  );
}
