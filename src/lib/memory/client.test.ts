import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeMemory, queryMemory, listMentorMemories, deleteMemory } from './client';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('writeMemory', () => {
  it('POSTs with the bearer token and does not throw when memory-api is unreachable', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://memory.example.com/memory',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('does nothing (no throw, no fetch) when MEMORY_API_URL is not configured', async () => {
    delete process.env.MEMORY_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('queryMemory', () => {
  it('returns the retrieved text on success', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: 'relevant stuff' }) }));
    const text = await queryMemory('how am I doing');
    expect(text).toBe('relevant stuff');
  });

  it('returns "" (never throws) when memory-api errors', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const text = await queryMemory('how am I doing');
    expect(text).toBe('');
  });

  it('returns "" when not configured', async () => {
    delete process.env.MEMORY_API_URL;
    const text = await queryMemory('how am I doing');
    expect(text).toBe('');
  });
});

describe('listMentorMemories / deleteMemory', () => {
  it('lists memories', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memories: [{ id: '1', text: 'x', confidence: 'high', createdAt: 'now' }] }) }));
    const rows = await listMentorMemories();
    expect(rows).toEqual([{ id: '1', text: 'x', confidence: 'high', createdAt: 'now' }]);
  });

  it('deletes by id', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await deleteMemory('1');
    expect(fetchMock).toHaveBeenCalledWith('https://memory.example.com/memory/1', expect.objectContaining({ method: 'DELETE' }));
  });
});
