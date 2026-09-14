import { Tag, type TagState } from './Tag';

export type SessionRank = 'done' | 'now' | 'next';

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
