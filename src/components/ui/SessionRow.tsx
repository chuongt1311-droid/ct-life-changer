import { Tag, type TagState } from './Tag';

/** `done` is a session that finished today and is struck through. `record` is a
 * past day in History: dimmed the same way, but never struck — a strikethrough
 * reads as "did not happen", and these did. */
export type SessionRank = 'done' | 'record' | 'now' | 'next';

export interface SessionRowProps {
  at: string;
  title: string;
  note: string;
  rank: SessionRank;
  tagState: TagState;
  tagLabel: string;
}

/** DESIGN.md "Session List / Diff Rows": rank drives brightness via the
 * `data-rank` attribute — dept.css handles the Floodlight White / Cool White
 * / Done Slate + strikethrough treatment; this component only supplies the
 * data attribute and content. */
export function SessionRow({ at, title, note, rank, tagState, tagLabel }: SessionRowProps) {
  return (
    <li data-rank={rank}>
      <span className="at">{at}</span>
      <span className="what">
        {title}
        <small>{note}</small>
      </span>
      <Tag state={tagState}>{tagLabel}</Tag>
    </li>
  );
}
