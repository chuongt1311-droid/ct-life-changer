import express from 'express';
import { requireBearerToken } from './auth';
import { connectGraph } from './falkor';
import { writeMemory } from './writeMemory';
import { queryMemory } from './queryMemory';
import { listMentorMemories, deleteMemory } from './mentorMemories';

const PORT = Number(process.env.MEMORY_API_PORT ?? 3001);
const TOKEN = process.env.MEMORY_API_TOKEN;
if (!TOKEN) throw new Error('MEMORY_API_TOKEN must be set');

async function main() {
  const graph = await connectGraph();
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(requireBearerToken(TOKEN!));

  app.post('/memory', async (req, res) => {
    try {
      const result = await writeMemory(graph, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
    }
  });

  app.post('/memory/query', async (req, res) => {
    try {
      const { question, maxChars } = req.body as { question?: string; maxChars?: number };
      if (!question) return res.status(400).json({ error: 'question is required' });
      const text = await queryMemory(graph, question, maxChars);
      res.json({ text });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
    }
  });

  app.get('/memory/mentor', async (_req, res) => {
    try {
      res.json({ memories: await listMentorMemories(graph) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
    }
  });

  app.delete('/memory/:id', async (req, res) => {
    try {
      await deleteMemory(graph, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'bad request' });
    }
  });

  app.listen(PORT, () => console.log(`memory-api listening on ${PORT}`));
}

main().catch((err) => {
  console.error('memory-api failed to start', err);
  process.exit(1);
});
