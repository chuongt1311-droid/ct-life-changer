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
  // writeMemory never throws — without both of these set it silently
  // no-ops, and a wrong/missing token is the likeliest misconfiguration.
  if (!process.env.MEMORY_API_URL) throw new Error('MEMORY_API_URL must be set before backfilling.');
  if (!process.env.MEMORY_API_TOKEN) throw new Error('MEMORY_API_TOKEN must be set before backfilling.');

  const admin = createAdminSupabase();
  const client = admin as unknown as RepositoryClient;
  const repos = repositories(client);

  const digests = (await repos.digests.list()).filter((d) => d.text !== null);
  let digestsPushed = 0;
  for (const d of digests) {
    if (await writeMemory('DailyDigest', { date: d.date, text: d.text })) {
      digestsPushed += 1;
      console.log(`digest ${d.date} pushed`);
    } else {
      console.error(`digest ${d.date} FAILED — memory-api did not accept it`);
    }
  }

  const letters = await repos.weeklyLetters.list();
  let lettersPushed = 0;
  for (const l of letters) {
    if (await writeMemory('WeeklyLetter', { weekStart: l.week_start, text: l.letter })) {
      lettersPushed += 1;
      console.log(`weekly letter ${l.week_start} pushed`);
    } else {
      console.error(`weekly letter ${l.week_start} FAILED — memory-api did not accept it`);
    }
  }

  const digestsFailed = digests.length - digestsPushed;
  const lettersFailed = letters.length - lettersPushed;
  console.log(
    `Backfilled ${digestsPushed} of ${digests.length} digests` +
      (digestsFailed > 0 ? ` (${digestsFailed} failed)` : '') +
      ` and ${lettersPushed} of ${letters.length} weekly letters` +
      (lettersFailed > 0 ? ` (${lettersFailed} failed)` : '') +
      '.',
  );
  // A partial backfill is a failure the runner needs to notice, not a
  // clean exit with some noise in the scrollback.
  if (digestsFailed > 0 || lettersFailed > 0) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((err) => {
  console.error('backfill failed', err);
  process.exit(1);
});
