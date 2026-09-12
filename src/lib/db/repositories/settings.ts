import { settingsRowSchema, type SettingsRow } from '../schemas';
import type { RepositoryClient } from '../repository';

/** `settings` is always exactly one row, keyed by the fixed id 'singleton'. */
export async function getSettings(client: RepositoryClient): Promise<SettingsRow | null> {
  const { data, error } = await client.from('settings').select('*').eq('id', 'singleton').maybeSingle();
  if (error) throw new Error(`settings.get failed: ${error.message}`);
  return data ? settingsRowSchema.parse(data) : null;
}

export async function upsertSettings(client: RepositoryClient, row: SettingsRow): Promise<SettingsRow> {
  const validated = settingsRowSchema.parse(row);
  const { data, error } = await client.from('settings').upsert(validated).select('*').single();
  if (error) throw new Error(`settings.upsert failed: ${error.message}`);
  return settingsRowSchema.parse(data);
}
