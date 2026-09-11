import { addDays } from '../time';
import { ATTRS, dayXp, type ProgressDay } from './xp';

export type FormBand = 'settling' | 'excellent' | 'good' | 'steady' | 'dipping' | 'rebuilding';

export const FORM_LABELS: Record<FormBand, string> = {
  settling: 'Settling in',
  excellent: 'Excellent',
  good: 'Good',
  steady: 'Steady',
  dipping: 'Dipping',
  rebuilding: 'Rebuilding',
};

export interface Form {
  band: FormBand;
  label: string;
  /** Last 7 days' XP ÷ average 7-day XP of the 21 days before; null while settling. */
  ratio: number | null;
}

const sumXp = (day: ProgressDay) => {
  const xp = dayXp(day);
  return ATTRS.reduce((total, a) => total + xp[a], 0);
};

/** Spec §8b.2. `today` is the last day of the 7-day window. Unlogged days count as 0 XP. */
export function formOn(days: ProgressDay[], today: string): Form {
  const logged = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const first = logged[0];
  if (!first || first.date > addDays(today, -13)) return { band: 'settling', label: FORM_LABELS.settling, ratio: null };

  const recentStart = addDays(today, -6);
  const previousStart = addDays(today, -27);
  let recent = 0;
  let previous = 0;
  for (const d of logged) {
    if (d.date >= recentStart) recent += sumXp(d);
    else if (d.date >= previousStart) previous += sumXp(d);
  }

  const baseline = previous / 3;
  if (baseline === 0) {
    const band: FormBand = recent > 0 ? 'excellent' : 'rebuilding';
    return { band, label: FORM_LABELS[band], ratio: null };
  }
  const ratio = recent / baseline;
  const band: FormBand =
    ratio >= 1.3 ? 'excellent' : ratio >= 1.05 ? 'good' : ratio >= 0.85 ? 'steady' : ratio >= 0.6 ? 'dipping' : 'rebuilding';
  return { band, label: FORM_LABELS[band], ratio: Math.round(ratio * 100) / 100 };
}
