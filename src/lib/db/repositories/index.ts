import type { RepositoryClient } from '../repository';
import { getSettings, upsertSettings } from './settings';
import { getTemplate, listTemplates, upsertTemplate } from './templates';
import { tableRepositories } from './tables';

/** One entry point for every repository in the data layer. Route handlers and
 * server actions call `repositories(await createServerSupabase())` and get
 * back everything spec §10 defines. */
export function repositories(client: RepositoryClient) {
  return {
    settings: { get: () => getSettings(client), upsert: (row: Parameters<typeof upsertSettings>[1]) => upsertSettings(client, row) },
    templates: {
      get: (weekday: number) => getTemplate(client, weekday),
      list: () => listTemplates(client),
      upsert: (row: Parameters<typeof upsertTemplate>[1]) => upsertTemplate(client, row),
    },
    ...tableRepositories(client),
  };
}

export * from './settings';
export * from './templates';
export * from './tables';
