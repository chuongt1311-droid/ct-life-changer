import { toPlanMinute } from '../time';
import type { Adjustment, Block, DayPlan, DayTemplate, Settings } from '../types';
import { blockFromTemplate, toRecovery } from './blocks';
import { layout } from './layout';

export interface BuildResult {
  plan: DayPlan;
  conflicts: [string, string][];
}

/** Adjustments are applied in this order regardless of the order they arrive in. */
const ORDER: Adjustment['type'][] = [
  'bedtimeEarlier',
  'trainingToRecovery',
  'removeRestDayTraining',
  'dropLowPriority',
  'capDeepWork',
  'capRest',
  'addMorningAnchor',
  'addEasyWin',
  'addMandatoryRest',
];

function guardBlock(date: string, key: string, fields: Partial<Block> & Pick<Block, 'title' | 'kind' | 'start' | 'end'>): Block {
  return {
    id: `${date}:${key}`,
    anchor: false,
    priority: 4,
    minMinutes: fields.end - fields.start,
    window: null,
    tags: [],
    checklist: [],
    recoveryVariant: null,
    status: 'planned',
    source: 'guard',
    ...fields,
  };
}

/** Keep total deep work within `cap` minutes: earlier blocks first; anchors shrink only to minMinutes. */
function capDeepWork(blocks: Block[], cap: number): Block[] {
  let remaining = cap;
  const updates = new Map<string, Block>();
  const deep = blocks.filter((b) => b.tags.includes('deepWork') && b.status === 'planned').sort((a, b) => a.start - b.start);
  for (const b of deep) {
    const duration = b.end - b.start;
    if (duration <= remaining) {
      remaining -= duration;
    } else if (b.anchor) {
      const kept = Math.max(b.minMinutes, remaining);
      updates.set(b.id, { ...b, end: b.start + kept });
      remaining = Math.max(0, remaining - kept);
    } else if (remaining >= b.minMinutes) {
      updates.set(b.id, { ...b, end: b.start + remaining, minMinutes: Math.min(b.minMinutes, remaining) });
      remaining = 0;
    } else {
      updates.set(b.id, { ...b, status: 'dropped' });
    }
  }
  return blocks.map((b) => updates.get(b.id) ?? b);
}

/** Spec §5.2: a plan for `date` from its weekday template, with the guard's adjustments applied. */
export function buildDay(template: DayTemplate, date: string, settings: Settings, adjustments: Adjustment[] = []): BuildResult {
  const wake = toPlanMinute(settings.wakeTime);
  let bedtime = toPlanMinute(settings.bedtime);
  let blocks = template.blocks.map((tb) => blockFromTemplate(tb, date));
  const placeFirst: string[] = [];

  const sorted = [...adjustments].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  for (const adj of sorted) {
    switch (adj.type) {
      case 'bedtimeEarlier':
        bedtime -= adj.minutes;
        break;
      case 'trainingToRecovery':
        blocks = blocks.map(toRecovery);
        break;
      case 'removeRestDayTraining':
        if (template.restDay) blocks = blocks.map((b) => (b.kind === 'training' ? { ...b, status: 'dropped' } : b));
        break;
      case 'dropLowPriority':
        blocks = blocks.map((b) => (!b.anchor && b.priority <= adj.maxPriority ? { ...b, status: 'dropped' } : b));
        break;
      case 'capDeepWork':
        blocks = capDeepWork(blocks, adj.minutes);
        break;
      case 'capRest':
        blocks = blocks.map((b) =>
          b.kind === 'rest' && b.end - b.start > adj.minutes
            ? { ...b, end: b.start + adj.minutes, minMinutes: Math.min(b.minMinutes, adj.minutes) }
            : b,
        );
        break;
      case 'addMorningAnchor': {
        const hasMorningAnchor = blocks.some((b) => b.anchor && b.status !== 'dropped' && b.start >= wake && b.start < wake + 120);
        if (!hasMorningAnchor) {
          blocks.push(
            guardBlock(date, 'morning-routine', {
              title: 'Morning routine',
              kind: 'routine',
              anchor: true,
              start: wake,
              end: wake + 30,
              tags: ['morningRoutine'],
            }),
          );
        }
        break;
      }
      case 'addEasyWin': {
        const easyWin = guardBlock(date, 'easy-win', {
          title: 'Easy win (15 min)',
          kind: 'task',
          start: wake,
          end: wake + 15,
          tags: ['easyWin'],
        });
        blocks.push(easyWin);
        placeFirst.push(easyWin.id);
        break;
      }
      case 'addMandatoryRest': {
        const at = toPlanMinute(adj.at);
        blocks.push(
          guardBlock(date, 'mandatory-rest', {
            title: 'Mandatory rest',
            kind: 'rest',
            anchor: true,
            start: at,
            end: at + 30,
            window: { earliestStart: at - 60, latestEnd: at + 120 },
            tags: ['mandatoryRest'],
          }),
        );
        break;
      }
    }
  }

  if (bedtime - 60 <= wake) throw new Error('Bedtime must be more than 60 minutes after wake time');
  blocks.push(
    guardBlock(date, 'wind-down', {
      title: 'Wind down',
      kind: 'routine',
      anchor: true,
      priority: 5,
      start: bedtime - 60,
      end: bedtime,
      tags: ['windDown'],
      source: 'template',
    }),
  );

  const result = layout({ blocks, now: wake, wake, until: bedtime - 60, keepRunning: false, placeFirst });
  return { plan: { date, wake, bedtime, blocks: result.blocks }, conflicts: result.conflicts };
}
