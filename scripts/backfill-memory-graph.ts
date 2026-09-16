// scripts/backfill-memory-graph.ts
//
// One-time: pushes every existing digest and weekly letter into the
// memory graph, so history that predates this feature isn't starting
// from zero. Run once after memory-api is deployed and MEMORY_API_URL/
// MEMORY_API_TOKEN are set (production .env.local, or .env.test.local
// against the test project):
//   npx tsx scripts/backfill-memory-graph.ts
import { config } from 'dotenv';
config({ path: process.env.BACKFILL_ENV_FILE ?? '.env.local' });

import { createAdminSupabase } from '@/lib/supabase/admin';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { writeMemory } from '@/lib/memory/client';

async function main() {
  if (!process.env.MEMORY_API_URL) throw new Error('MEMORY_API_URL must be set before backfilling.');

  const admin = createAdminSupabase();
  const client = admin as unknown as RepositoryClient;
  const repos = repositories(client);

  const digests = (await repos.digests.list()).filter((d) => d.text !== null);
  for (const d of digests) {
    await writeMemory('DailyDigest', { date: d.date, text: d.text });
    console.log(`digest ${d.date} pushed`);
  }

  const letters = await repos.weeklyLetters.list();
  for (const l of letters) {
    await writeMemory('WeeklyLetter', { weekStart: l.week_start, text: l.letter });
    console.log(`weekly letter ${l.week_start} pushed`);
  }

  console.log(`Backfilled ${digests.length} digests and ${letters.length} weekly letters.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('backfill failed', err);
  process.exit(1);
});
