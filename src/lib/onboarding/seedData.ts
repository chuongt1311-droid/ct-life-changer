import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import type { SettingsRow, TemplateRow } from '@/lib/db/schemas';
import type { TemplateBlock } from '@/core/types';

/** Spec §5.2 + the 4-week program: one seed template per weekday. CT edits
 * these later in the Templates screen (Plan 5) — this only has to be a
 * sane, safe starting point, not the final word. */
export function seedSettingsRow(): SettingsRow {
  return {
    id: 'singleton',
    owner_id: '',
    timezone: DEFAULT_SETTINGS.timezone,
    wake_time: DEFAULT_SETTINGS.wakeTime,
    bedtime: DEFAULT_SETTINGS.bedtime,
    model: DEFAULT_SETTINGS.model,
    monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
    nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
    deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
    thresholds: DEFAULT_THRESHOLDS,
    crisis_contacts: [],
  };
}

function routineBlocks(): TemplateBlock[] {
  return [
    { key: 'wake', title: 'Morning routine', kind: 'routine', anchor: true, priority: 5, start: '07:00', durationMin: 30, tags: ['morningRoutine'] },
    { key: 'breakfast', title: 'Breakfast', kind: 'buffer', anchor: false, priority: 2, start: '07:30', durationMin: 30 },
    { key: 'lunch', title: 'Lunch', kind: 'buffer', anchor: false, priority: 2, start: '12:30', durationMin: 45 },
    { key: 'dinner', title: 'Dinner', kind: 'buffer', anchor: false, priority: 2, start: '19:00', durationMin: 45 },
    { key: 'deep-work', title: 'Deep work', kind: 'task', anchor: false, priority: 4, start: '09:00', durationMin: 180, tags: ['deepWork'] },
  ];
}

function trainingDay(key: string, title: string, start: string, durationMin: number, checklist: string[]): TemplateBlock {
  return {
    key,
    title,
    kind: 'training',
    anchor: true,
    priority: 5,
    start,
    durationMin,
    tags: key === 'training-tue' ? ['recovery'] : ['hardTraining'],
    checklist,
  };
}

const WEEKDAY_TRAINING: Record<number, TemplateBlock | null> = {
  0: null, // Sunday — rest
  1: trainingDay('training-mon', 'Push strength + neck work', '17:00', 55, [
    'Clap push-ups', 'Push-ups (heavy reps)', 'Dips', 'Pseudo planche push-ups', 'Isometric neck work',
  ]),
  2: trainingDay('training-tue', 'Handstand skill + active recovery', '17:00', 40, [
    'Wall handstand hold', 'Wrist prep', 'Bridge hold', 'Deep squat hold', 'Shoulder dislocates',
  ]),
  3: trainingDay('training-wed', 'Legs + core + neck work', '17:00', 55, [
    'Pistol squat progression', 'Broad jumps', 'L-sit progression', 'Nordic curls', 'Isometric neck work',
  ]),
  4: trainingDay('training-thu', 'Pull strength', '17:00', 40, ['Front lever progression', 'Pull-ups']),
  5: null, // Friday — rest
  6: null, // Saturday — rest
};

export function seedTemplateRows(): TemplateRow[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const training = WEEKDAY_TRAINING[weekday];
    return {
      weekday,
      owner_id: '',
      rest_day: training === null,
      blocks: training ? [...routineBlocks(), training] : routineBlocks(),
    };
  });
}
