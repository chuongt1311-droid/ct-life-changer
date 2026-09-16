import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'ct' } } }) },
  }),
}));
vi.mock('@/lib/anthropic/client', () => ({ createAnthropicClient: () => ({}) }));
vi.mock('@/lib/db/repositories', () => ({
  repositories: () => ({ settings: { get: async () => ({ model: 'claude-sonnet-5', monthly_cap_usd: 12 }) } }),
}));

// The bug this guards against: route.ts used to drive `chat()` only from
// the ReadableStream's `pull()` callback. If the client disconnects
// (navigates away) before the turn finishes, `pull()` never gets called
// again and the generator is abandoned mid-turn — before its final
// `logMentorMessage` write, permanently leaving that turn's assistant
// message stuck as the empty placeholder `chat()` wrote before streaming
// started. Confirmed by direct reproduction against a real dev server:
// navigate away mid-reply, come back, and the reply is blank forever.
let finalWriteHappened = false;
vi.mock('@/lib/mentor/routes/chat', () => ({
  chat: async function* () {
    finalWriteHappened = false;
    yield { type: 'text', text: 'Hello' };
    yield { type: 'text', text: ' there' };
    // Simulates chat.ts's own final `logMentorMessage` call, which must run
    // regardless of whether anyone is still reading the stream.
    finalWriteHappened = true;
    return { fallback: false };
  },
}));

describe('POST /api/mentor/chat', () => {
  it('drives the chat turn to completion even after the client stops reading the stream', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/mentor/chat', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-16', message: 'hi' }),
    });

    const response = await POST(request);
    const reader = response.body!.getReader();

    // Read exactly one chunk — matching a browser that received the start
    // of a reply, then disconnected (navigated away) before it finished.
    await reader.read();
    await reader.cancel();

    // The generator's remaining work (including its final write) runs as
    // background work, not gated on further stream reads — give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(finalWriteHappened).toBe(true);
  });

  it('streams every event to a client that reads to completion', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/mentor/chat', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-09-16', message: 'hi' }),
    });

    const response = await POST(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    const events = text.trim().split('\n').map((line) => JSON.parse(line));
    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there' },
    ]);
  });
});
