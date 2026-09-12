import { templateRowSchema, type TemplateRow } from '../schemas';
import type { RepositoryClient } from '../repository';

export async function getTemplate(client: RepositoryClient, weekday: number): Promise<TemplateRow | null> {
  const { data, error } = await client.from('templates').select('*').eq('weekday', weekday).maybeSingle();
  if (error) throw new Error(`templates.get failed: ${error.message}`);
  return data ? templateRowSchema.parse(data) : null;
}

export async function listTemplates(client: RepositoryClient): Promise<TemplateRow[]> {
  const { data, error } = await client.from('templates').select('*').match({});
  if (error) throw new Error(`templates.list failed: ${error.message}`);
  return (data ?? []).map((row) => templateRowSchema.parse(row));
}

export async function upsertTemplate(client: RepositoryClient, row: TemplateRow): Promise<TemplateRow> {
  const validated = templateRowSchema.parse(row);
  const { data, error } = await client.from('templates').upsert(validated).select('*').single();
  if (error) throw new Error(`templates.upsert failed: ${error.message}`);
  return templateRowSchema.parse(data);
}
