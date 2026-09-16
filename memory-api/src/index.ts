import express from 'express';
import { requireBearerToken } from './auth';
import { connectGraph } from './falkor';
import { writeMemory } from './writeMemory';

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

  app.listen(PORT, () => console.log(`memory-api listening on ${PORT}`));
}

main().catch((err) => {
  console.error('memory-api failed to start', err);
  process.exit(1);
});
