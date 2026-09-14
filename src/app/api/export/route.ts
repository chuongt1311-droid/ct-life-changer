import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { buildExportData } from '@/lib/export/exportData';
import { toCsv } from '@/core/export/toCsv';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const client = supabase as unknown as RepositoryClient;
  const data = await buildExportData(client);
  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'json';

  if (format === 'csv') {
    const table = url.searchParams.get('table');
    const rows = table ? data[table] : undefined;
    if (!table || !rows) return NextResponse.json({ error: `Unknown table "${table}"` }, { status: 400 });
    return new Response(toCsv(rows as Record<string, unknown>[]), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${table}.csv"` },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="life-changer-export.json"' },
  });
}
