import type { Settings } from '@/core/types';
import type { SettingsRow } from './schemas';

/** The DB row is snake_case and includes `id`/`owner_id`; the core `Settings`
 * type (consumed by the pure planner/guard/nudges/mentor modules) is
 * camelCase and has neither. One conversion, reused everywhere a repository
 * row needs to reach pure core code. */
export function settingsToDomain(row: SettingsRow): Settings {
  return {
    timezone: row.timezone,
    wakeTime: row.wake_time,
    bedtime: row.bedtime,
    model: row.model,
    monthlyCapUsd: row.monthly_cap_usd,
    nudgeDailyCap: row.nudge_daily_cap,
    deepWorkDailyCapMin: row.deep_work_daily_cap_min,
    thresholds: row.thresholds,
    crisisContacts: row.crisis_contacts,
  };
}
