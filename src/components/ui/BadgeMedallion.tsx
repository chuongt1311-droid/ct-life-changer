import type { BadgeProgress } from '@/core/progression/badges';
import { TIER_NAMES } from '@/core/progression/badges';
import { Icon, type IconName } from '@/components/icons/Icon';

const BADGE_ICON: Record<string, IconName> = {
  'clutch-returner': 'boot',
  'iron-sleeper': 'bed',
  'film-room': 'film',
  anchor: 'anchor',
  workhorse: 'weight',
  'open-book': 'book',
};

/** DESIGN.md "Badge Medallions (signature)": an unearned badge is still
 * shown, unlit (`data-tier="none"`). */
export function BadgeMedallion({ badge }: { badge: BadgeProgress }) {
  return (
    <li className="medal" data-tier={badge.tier ?? 'none'}>
      <span className="disc">
        <Icon name={BADGE_ICON[badge.id] ?? 'book'} size="medal" />
      </span>
      <span className="m-name">{badge.name}</span>
      <span className="m-count">{badge.tier ? `${badge.count} · ${TIER_NAMES[badge.tier]}` : `${badge.count} of ${badge.nextAt}`}</span>
    </li>
  );
}
