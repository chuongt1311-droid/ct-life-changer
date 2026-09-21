import { z } from 'zod';

export const priority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export const blockKind = z.enum(['task', 'training', 'rest', 'buffer', 'routine']);
const blockStatus = z.enum(['planned', 'active', 'done', 'partial', 'skipped', 'missed', 'dropped']);
const blockSource = z.enum(['template', 'manual', 'urgent', 'guard']);

const checklistItemSchema = z.object({ label: z.string(), done: z.boolean() });
export const templateBlockSchema = z.object({
  key: z.string(),
  title: z.string(),
  kind: blockKind,
  anchor: z.boolean(),
  priority,
  start: z.string(),
  durationMin: z.number(),
  minMinutes: z.number().optional(),
  window: z.object({ earliestStart: z.string(), latestEnd: z.string() }).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
  recoveryVariant: z.object({ title: z.string(), checklist: z.array(z.string()) }).optional(),
});

const thresholdsSchema = z.object({
  sleepLowHours: z.number(),
  sleepLowNights: z.number(),
  sleepLowWindow: z.number(),
  energyLowMax: z.number(),
  energyLowDays: z.number(),
  stressHighMin: z.number(),
  stressHighDays: z.number(),
  grindDays: z.number(),
  grindWindow: z.number(),
  grindRestDayTrainings: z.number(),
  indulgeHighMin: z.number(),
  indulgeHighDays: z.number(),
  anchorSkipRatio: z.number(),
  anchorSkipDays: z.number(),
  anchorSkipMinEnergy: z.number(),
});

const crisisContactSchema = z.object({
  label: z.string(),
  phone: z.string().optional(),
  url: z.string().optional(),
});

export const settingsRowSchema = z.object({
  id: z.literal('singleton'),
  owner_id: z.string(),
  timezone: z.string(),
  wake_time: z.string(),
  bedtime: z.string(),
  model: z.string(),
  monthly_cap_usd: z.number(),
  nudge_daily_cap: z.number(),
  deep_work_daily_cap_min: z.number(),
  thresholds: thresholdsSchema,
  crisis_contacts: z.array(crisisContactSchema),
});
export type SettingsRow = z.infer<typeof settingsRowSchema>;

export const templateRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  owner_id: z.string(),
  rest_day: z.boolean(),
  blocks: z.array(templateBlockSchema),
});
export type TemplateRow = z.infer<typeof templateRowSchema>;

export const planRowSchema = z.object({
  date: z.string(),
  owner_id: z.string(),
  state: z.enum(['ready', 'drifting', 'depleted', 'grinding']),
  flags: z.array(z.object({ code: z.string(), state: z.string(), reason: z.string() })),
  adjustments: z.array(z.record(z.string(), z.unknown())),
  overridden: z.boolean(),
});
export type PlanRow = z.infer<typeof planRowSchema>;

export const blockRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  title: z.string(),
  kind: blockKind,
  anchor: z.boolean(),
  priority,
  start: z.number(),
  end: z.number(),
  min_minutes: z.number(),
  window_start: z.number().nullable(),
  window_end: z.number().nullable(),
  tags: z.array(z.string()),
  checklist: z.array(checklistItemSchema),
  recovery_variant: z.object({ title: z.string(), checklist: z.array(z.string()) }).nullable(),
  status: blockStatus,
  source: blockSource,
});
export type BlockRow = z.infer<typeof blockRowSchema>;

export const checkinRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  type: z.enum(['morning', 'evening']),
  sections: z.record(z.string(), z.record(z.string(), z.unknown())),
  private_keys: z.array(z.string()),
  created_at: z.string(),
});
export type CheckinRow = z.infer<typeof checkinRowSchema>;

export const restSessionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  block_id: z.string().nullable(),
  activity: z.string(),
  planned: z.boolean(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  reentry_ack_at: z.string().nullable(),
});
export type RestSessionRow = z.infer<typeof restSessionRowSchema>;

export const unplannedIndulgenceRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  activity: z.string(),
  minutes: z.number(),
});
export type UnplannedIndulgenceRow = z.infer<typeof unplannedIndulgenceRowSchema>;

export const mentorMessageRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  route: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  state_at_time: z.string().nullable(),
  usage_id: z.string().nullable(),
  created_at: z.string(),
});
export type MentorMessageRow = z.infer<typeof mentorMessageRowSchema>;

export const mentorProposalRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  message_id: z.string(),
  kind: z.enum(['schedule', 'template']),
  target: z.string(),
  edits: z.array(z.record(z.string(), z.unknown())),
  diff: z.array(z.record(z.string(), z.unknown())),
  conflicts: z.array(z.tuple([z.string(), z.string()])),
  status: z.enum(['pending', 'confirmed', 'discarded']),
  created_at: z.string(),
});
export type MentorProposalRow = z.infer<typeof mentorProposalRowSchema>;

export const digestRowSchema = z.object({
  date: z.string(),
  owner_id: z.string(),
  text: z.string().nullable(),
  attempts: z.number(),
});
export type DigestRow = z.infer<typeof digestRowSchema>;

export const weeklyLetterRowSchema = z.object({
  week_start: z.string(),
  owner_id: z.string(),
  letter: z.string(),
  metrics: z.record(z.string(), z.unknown()),
  // Matches profileVersionRowSchema.changes exactly — runWeeklyReview always
  // passes the array WeeklyReviewResult.changes produces, never a map. The
  // previous z.record(...) here rejected every real write with a ZodError,
  // and because nothing caught it and weekly review has no retry cap (unlike
  // the evening digest's DIGEST_MAX_ATTEMPTS), the cron tick re-ran the full
  // Anthropic call every single minute, forever, without ever persisting.
  changes: z.array(z.object({ section: z.string(), newText: z.string(), reason: z.string() })),
  profile_version_id: z.string().nullable(),
});
export type WeeklyLetterRow = z.infer<typeof weeklyLetterRowSchema>;

export const profileVersionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  created_at: z.string(),
  sections: z.record(z.string(), z.string()),
  author: z.enum(['claude', 'user']),
  changes: z.array(z.object({ section: z.string(), newText: z.string(), reason: z.string() })),
});
export type ProfileVersionRow = z.infer<typeof profileVersionRowSchema>;

export const pushSubscriptionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  endpoint: z.string(),
  keys: z.record(z.string(), z.string()),
  device_label: z.string().nullable(),
  created_at: z.string(),
});
export type PushSubscriptionRow = z.infer<typeof pushSubscriptionRowSchema>;

export const nudgeSentRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  type: z.string(),
  block_id: z.string().nullable(),
  key: z.string(),
  sent_at: z.string(),
  acked_at: z.string().nullable(),
});
export type NudgeSentRow = z.infer<typeof nudgeSentRowSchema>;

export const usageRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  created_at: z.string(),
  route: z.string(),
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_tokens: z.number(),
  cache_write_tokens: z.number(),
  cost_usd: z.number(),
});
export type UsageRow = z.infer<typeof usageRowSchema>;

// Form sections (spec §6). Stored inside checkins.sections as JSON, one schema
// per section so sections can evolve without a migration.
export const morningBodySchema = z.object({
  bedtime: z.string(),
  wakeTime: z.string(),
  sleepQuality: z.number().min(1).max(5),
  energy: z.number().min(1).max(10),
});
export const morningMindSchema = z.object({
  mood: z.number().min(1).max(10),
  stress: z.number().min(1).max(10),
  stressCause: z.array(z.string()),
});
export const eveningBodySchema = z.object({
  training: z.enum(['done', 'partial', 'skipped', 'rest']),
  protein: z.enum(['low', 'ok', 'hit']),
  waterL: z.number(),
  energyNow: z.number().min(1).max(10),
});
export const eveningMindSchema = z.object({
  peakStress: z.number().min(1).max(10),
  stressCause: z.array(z.string()),
  focusQuality: z.number().min(1).max(5),
  regulated: z.array(z.string()),
});
export const eveningWorkSchema = z.object({
  tasksDone: z.array(z.string()),
  deepWorkMinutes: z.number(),
  footballAnalytics: z.object({
    projects: z.array(z.string()),
    minutes: z.number(),
    learned: z.string(),
  }),
});
export const eveningPleasureSchema = z.object({
  plannedRestSessions: z.number(),
  unplannedEntries: z.array(z.object({ activity: z.string(), minutes: z.number() })),
  cameBackAfterRest: z.enum(['yes', 'partly', 'no']),
});
export const eveningPeopleSchema = z.object({
  who: z.array(z.string()),
  interactionType: z.enum(['in person', 'call', 'text', 'online']).nullable(),
  felt: z.enum(['draining', 'neutral', 'energizing']).nullable(),
  reachedOut: z.boolean(),
  frictionNote: z.string(),
});
export const eveningReflectionSchema = z.object({
  gratitudeLines: z.array(z.string()),
  lessonOfDay: z.string(),
  winOfDay: z.string(),
});
