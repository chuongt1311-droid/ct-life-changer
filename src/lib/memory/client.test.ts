import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeMemory, queryMemory, listMentorMemories, deleteMemory } from './client';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('writeMemory', () => {
  it('POSTs with the bearer token and returns true when memory-api accepts it', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://memory.example.com/memory',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('returns false (never throws) when memory-api is unreachable', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBe(false);
  });

  it('returns false when memory-api answers with a non-ok status', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBe(false);
  });

  it('does nothing (no throw, no fetch) and returns false when MEMORY_API_URL is not configured', async () => {
    delete process.env.MEMORY_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(writeMemory('DailyDigest', { date: '2026-09-16', text: 'hi' })).resolves.toBe(false);
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
    const result = await listMentorMemories();
    expect(result).toEqual({ ok: true, memories: [{ id: '1', text: 'x', confidence: 'high', createdAt: 'now' }] });
  });

  it('distinguishes a genuinely empty list from an unreachable service', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memories: [] }) }));
    expect(await listMentorMemories()).toEqual({ ok: true, memories: [] });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await listMentorMemories()).toEqual({ ok: false });
  });

  it('reports ok: false when not configured', async () => {
    delete process.env.MEMORY_API_URL;
    expect(await listMentorMemories()).toEqual({ ok: false });
  });

  it('deletes by id and returns true', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteMemory('1')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://memory.example.com/memory/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('returns false (never throws) when the delete fails, so the row stays visible', async () => {
    process.env.MEMORY_API_URL = 'https://memory.example.com';
    process.env.MEMORY_API_TOKEN = 'tok';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(deleteMemory('1')).resolves.toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(deleteMemory('1')).resolves.toBe(false);
  });
});
