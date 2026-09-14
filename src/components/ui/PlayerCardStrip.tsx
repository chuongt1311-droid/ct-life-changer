import Link from 'next/link';
import type { PlayerCard } from '@/core/progression/card';
import { Icon } from '@/components/icons/Icon';
import { Tag, type TagState } from './Tag';

const FORM_ICON = { excellent: 'up', good: 'up', steady: 'flat', dipping: 'down', rebuilding: 'down', settling: 'flat' } as const;
const CARD_TAG_STATE: Record<NonNullable<PlayerCard['tag']> | 'ready', TagState> = {
  ready: 'ready',
  'Out of form': 'drifting',
  Fatigued: 'depleted',
  'Injury risk': 'grinding',
};

/** DESIGN.md "Player Card Strip (signature)": OVR in gold, a worded form
 * arrow, a readiness tag — one row, links to the full card (Task 17). */
export function PlayerCardStrip({ card, href = '/card' }: { card: PlayerCard; href?: string }) {
  const dir = FORM_ICON[card.form.band];
  const tagState = CARD_TAG_STATE[card.tag ?? 'ready'];
  return (
    <Link
      className="cardstrip"
      href={href}
      aria-label={`Player card: overall ${card.ovr}, ${card.form.label.toLowerCase()}, ${tagState}`}
    >
      <span className="ovr">
        <b>{card.ovr}</b>
        <span>OVR</span>
      </span>
      <span className="form-read" data-dir={dir}>
        <Icon name={dir} />
        <span className="label">{card.form.label}</span>
      </span>
      {card.tag && <Tag state={tagState} />}
    </Link>
  );
}
