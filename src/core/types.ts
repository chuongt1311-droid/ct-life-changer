/** Shared domain types for the Daily Loop core. All times are plan minutes (see time.ts). */

export type Priority = 1 | 2 | 3 | 4 | 5;
export type BlockKind = 'task' | 'training' | 'rest' | 'buffer' | 'routine';
export type BlockStatus = 'planned' | 'active' | 'done' | 'partial' | 'skipped' | 'missed' | 'dropped';
export type BlockSource = 'template' | 'manual' | 'urgent' | 'guard';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface TimeWindow {
  earliestStart: number;
  latestEnd: number;
}

export interface Block {
  id: string;
  title: string;
  kind: BlockKind;
  /** Anchors are never dropped by the planner. */
  anchor: boolean;
  priority: Priority;
  start: number;
  end: number;
  /** How far the planner may shrink this block. */
  minMinutes: number;
  /** Movable anchors may move inside this window; null = fixed time. */
  window: TimeWindow | null;
  /** e.g. 'deepWork', 'hardTraining', 'recovery', 'windDown', 'morningRoutine', 'easyWin', 'mandatoryRest', 'urgent', 'recharge' */
  tags: string[];
  checklist: ChecklistItem[];
  recoveryVariant: { title: string; checklist: string[] } | null;
  status: BlockStatus;
  source: BlockSource;
}

export interface TemplateBlock {
  key: string;
  title: string;
  kind: BlockKind;
  anchor: boolean;
  priority: Priority;
  start: string; // HH:MM
  durationMin: number;
  minMinutes?: number;
  window?: { earliestStart: string; latestEnd: string };
  tags?: string[];
  checklist?: string[];
  recoveryVariant?: { title: string; checklist: string[] };
}

export interface DayTemplate {
  weekday: number; // 0 = Sunday … 6 = Saturday
  restDay: boolean;
  blocks: TemplateBlock[];
}

export interface DayPlan {
  date: string;
  wake: number;
  bedtime: number;
  blocks: Block[];
}

export interface Thresholds {
  sleepLowHours: number;
  sleepLowNights: number;
  sleepLowWindow: number;
  energyLowMax: number;
  energyLowDays: number;
  stressHighMin: number;
  stressHighDays: number;
  grindDays: number;
  grindWindow: number;
  grindRestDayTrainings: number;
  indulgeHighMin: number;
  indulgeHighDays: number;
  anchorSkipRatio: number;
  anchorSkipDays: number;
  anchorSkipMinEnergy: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  sleepLowHours: 6,
  sleepLowNights: 3,
  sleepLowWindow: 4,
  energyLowMax: 4,
  energyLowDays: 3,
  stressHighMin: 8,
  stressHighDays: 2,
  grindDays: 5,
  grindWindow: 7,
  grindRestDayTrainings: 2,
  indulgeHighMin: 120,
  indulgeHighDays: 2,
  anchorSkipRatio: 0.5,
  anchorSkipDays: 2,
  anchorSkipMinEnergy: 6,
};

export interface CrisisContact {
  label: string;
  phone?: string;
  url?: string;
}

export interface Settings {
  timezone: string;
  wakeTime: string; // HH:MM
  bedtime: string; // HH:MM
  model: string;
  monthlyCapUsd: number;
  nudgeDailyCap: number;
  deepWorkDailyCapMin: number;
  thresholds: Thresholds;
  crisisContacts: CrisisContact[];
}

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'UTC',
  wakeTime: '07:00',
  bedtime: '23:00',
  model: 'claude-sonnet-5',
  monthlyCapUsd: 12,
  nudgeDailyCap: 8,
  deepWorkDailyCapMin: 360,
  thresholds: DEFAULT_THRESHOLDS,
  crisisContacts: [],
};

export type GuardState = 'ready' | 'drifting' | 'depleted' | 'grinding';
export type FlagCode =
  | 'SLEEP_LOW'
  | 'ENERGY_LOW'
  | 'STRESS_HIGH'
  | 'GRIND_HOURS'
  | 'GRIND_REST_DAYS'
  | 'INDULGE_HIGH'
  | 'ANCHOR_SKIP';

export interface Flag {
  code: FlagCode;
  state: Exclude<GuardState, 'ready'>;
  reason: string;
}

export type Adjustment =
  | { type: 'bedtimeEarlier'; minutes: number; reason: string }
  | { type: 'trainingToRecovery'; reason: string }
  | { type: 'removeRestDayTraining'; reason: string }
  | { type: 'dropLowPriority'; maxPriority: Priority; reason: string }
  | { type: 'capDeepWork'; minutes: number; reason: string }
  | { type: 'capRest'; minutes: number; reason: string }
  | { type: 'addMorningAnchor'; reason: string }
  | { type: 'addEasyWin'; reason: string }
  | { type: 'addMandatoryRest'; at: string; reason: string };

/** One day of data as the guard sees it. null = not logged (unknown, never "bad"). */
export interface DaySummary {
  date: string;
  sleepHours: number | null;
  morningEnergy: number | null;
  /** Highest stress logged that day (morning or evening peak). */
  stress: number | null;
  deepWorkMin: number | null;
  restSessionsTaken: number;
  trainedOnRestDay: boolean;
  unplannedIndulgenceMin: number | null;
  anchorsTotal: number;
  /** Anchors whose status ended as skipped or missed. */
  anchorsSkipped: number;
}

export interface Assessment {
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
}
