import type Anthropic from '@anthropic-ai/sdk';
import { formatPlanMinute } from '../time';
import type { Adjustment, Block, Flag, GuardState } from '../types';
import { type Profile, renderProfile } from './profile';

export interface CheckinRecord {
  type: 'morning' | 'evening';
  /** section → field → value, e.g. { mind: { mood: 6, stressCause: ['school'] } } */
  sections: Record<string, Record<string, unknown>>;
  /** "section" hides a whole section, "section.field" hides one field. */
  privateKeys: string[];
}

export interface MentorContextInput {
  systemPrompt: string;
  profile: Profile;
  /** Compact text from the memory graph, relevant to `request` — replaces
   * the old blanket "last 7 digests, last 4 weekly letters" window. Empty
   * string when nothing matched or the memory service is unreachable. */
  retrievedMemory: string;
  today: {
    date: string;
    state: GuardState;
    flags: Flag[];
    adjustments: Adjustment[];
    overridden: boolean;
    blocks: Block[];
    checkins: CheckinRecord[];
  };
  /** Route instruction (briefing, evening review, …) or, for chat, CT's new message. */
  request: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface MentorContext {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}

/** Remove everything CT marked "just for me". Nothing private may ever reach Claude. */
export function stripPrivate(checkin: CheckinRecord): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [section, fields] of Object.entries(checkin.sections)) {
    if (checkin.privateKeys.includes(section)) continue;
    const kept = Object.fromEntries(
      Object.entries(fields).filter(([field]) => !checkin.privateKeys.includes(`${section}.${field}`)),
    );
    if (Object.keys(kept).length > 0) out[section] = kept;
  }
  return out;
}

function renderMemory(input: MentorContextInput): string {
  return ['<memory>', input.retrievedMemory || '(nothing retrieved)', '</memory>'].join('\n');
}

function renderBlock(b: Block): string {
  const anchor = b.anchor ? ' [anchor]' : '';
  return `- ${formatPlanMinute(b.start)}–${formatPlanMinute(b.end)} ${b.title}${anchor} — ${b.status}`;
}

function renderToday(today: MentorContextInput['today']): string {
  const lines = [`<today date="${today.date}">`, `State: ${today.state}`];
  lines.push('Flags:', ...(today.flags.length ? today.flags.map((f) => `- ${f.code}: ${f.reason}`) : ['- none']));
  lines.push(
    `Plan adjustments (CT overrode them: ${today.overridden ? 'yes' : 'no'}):`,
    ...(today.adjustments.length ? today.adjustments.map((a) => `- ${a.type}: ${a.reason}`) : ['- none']),
  );
  lines.push('Plan:', ...[...today.blocks].sort((a, b) => a.start - b.start).map(renderBlock));
  lines.push('Check-ins:');
  for (const c of today.checkins) lines.push(`${c.type}: ${JSON.stringify(stripPrivate(c))}`);
  if (today.checkins.length === 0) lines.push('(none yet)');
  lines.push('</today>');
  return lines.join('\n');
}

/**
 * Spec §8.3. Stable content first so the prompt cache can reuse it:
 * system = [persona ✱, profile ✱]; first user turn = [history ✱, today, request]. ✱ = cache breakpoint.
 */
export function buildMentorContext(input: MentorContextInput): MentorContext {
  const cache = { type: 'ephemeral' as const };
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: input.systemPrompt, cache_control: cache },
    { type: 'text', text: `# About CT\n\n${renderProfile(input.profile)}`, cache_control: cache },
  ];

  const turns = [...(input.chatHistory ?? []), { role: 'user' as const, content: input.request }];
  while (turns.length > 0 && turns[0]!.role !== 'user') turns.shift();
  const [first, ...rest] = turns;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: renderMemory(input), cache_control: cache },
        { type: 'text', text: renderToday(input.today) },
        { type: 'text', text: first!.content },
      ],
    },
    ...rest.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.content })),
  ];
  return { system, messages };
}
