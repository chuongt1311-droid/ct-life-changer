import type { GraphClient } from './falkor';

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'it', 'is', 'to', 'and', 'in', 'on', 'for', 'my', 'me', 'i', 'you', 'do', 'does', 'can', 'what']);

function keywordsFor(question: string): string[] {
  return [...new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )];
}

interface MatchedNode {
  label: string;
  id: string;
  text: string;
}

/** Keyword-match-then-traverse retrieval, no embeddings (spec's v1 scope).
 * A cheap ~4-chars-per-token estimate keeps the returned text within
 * `maxChars` (default ~6000 chars ≈ 1500 tokens) so retrieval itself
 * never becomes the new blanket-inclusion problem it's replacing. */
export async function queryMemory(graph: GraphClient, question: string, maxChars = 6000): Promise<string> {
  const keywords = keywordsFor(question);
  if (keywords.length === 0) return '';

  const matchResult = await graph.roQuery(
    'MATCH (n) WHERE ANY(kw IN $keywords WHERE toLower(n.text) CONTAINS kw) RETURN labels(n)[0], n.id, n.text LIMIT 20',
    { keywords },
  );
  const matched: MatchedNode[] = matchResult.data.map((row) => ({ label: row[0] as string, id: row[1] as string, text: row[2] as string }));
  if (matched.length === 0) return '';

  const ids = matched.map((m) => m.id);
  const neighborResult = await graph.roQuery(
    'MATCH (n)-[]-(m) WHERE n.id IN $ids AND NOT m.id IN $ids RETURN labels(m)[0], m.id, m.text LIMIT 20',
    { ids },
  );
  const neighbors: MatchedNode[] = neighborResult.data.map((row) => ({ label: row[0] as string, id: row[1] as string, text: row[2] as string }));

  const seen = new Set<string>();
  const all = [...matched, ...neighbors].filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const lines: string[] = [];
  let used = 0;
  for (const n of all) {
    const line = `[${n.label}] ${n.text}`;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length;
  }
  return lines.join('\n\n');
}
