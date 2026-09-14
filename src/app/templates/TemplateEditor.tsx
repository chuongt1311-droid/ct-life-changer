'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import type { TemplateRow } from '@/lib/db/schemas';
import { saveTemplateAction } from './actions';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TemplateEditor({ templates }: { templates: TemplateRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  function openWeekday(weekday: number) {
    setOpen(weekday);
    setDraft(templates.find((t) => t.weekday === weekday) ?? null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    await saveTemplateAction(draft);
    setSaving(false);
    setOpen(null);
  }

  if (open === null || !draft) {
    return (
      <div className="stepback">
        <Placard>Weekday templates</Placard>
        <ul className="sessions">
          {WEEKDAY_NAMES.map((name, weekday) => {
            const t = templates.find((tpl) => tpl.weekday === weekday);
            return (
              <li key={weekday} data-rank="next">
                <span className="what">
                  {name}
                  <small>{t?.rest_day ? 'Rest day' : `${t?.blocks.length ?? 0} blocks`}</small>
                </span>
                <button className="btn btn-quiet" onClick={() => openWeekday(weekday)}>
                  Edit
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>{WEEKDAY_NAMES[open]}</Placard>
      <label className="chip">
        <input type="checkbox" checked={draft.rest_day} onChange={(e) => setDraft({ ...draft, rest_day: e.target.checked })} />
        <span>Rest day</span>
      </label>
      <ul className="sessions">
        {draft.blocks.map((b, i) => (
          <li key={b.key} data-rank="next">
            <span className="what">
              <input
                className="chip"
                style={{ width: '100%' }}
                value={b.title}
                onChange={(e) => {
                  const blocks = [...draft.blocks];
                  blocks[i] = { ...b, title: e.target.value };
                  setDraft({ ...draft, blocks });
                }}
              />
              <small>
                <input
                  type="time"
                  value={b.start}
                  onChange={(e) => {
                    const blocks = [...draft.blocks];
                    blocks[i] = { ...b, start: e.target.value };
                    setDraft({ ...draft, blocks });
                  }}
                />
                {' · '}
                <input
                  type="number"
                  value={b.durationMin}
                  onChange={(e) => {
                    const blocks = [...draft.blocks];
                    blocks[i] = { ...b, durationMin: Number(e.target.value) };
                    setDraft({ ...draft, blocks });
                  }}
                />
                {' min'}
              </small>
            </span>
            <button className="btn btn-quiet" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((x) => x.key !== b.key) })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-quiet"
        onClick={() =>
          setDraft({
            ...draft,
            blocks: [...draft.blocks, { key: `custom-${Date.now()}`, title: 'New block', kind: 'task', anchor: false, priority: 3, start: '09:00', durationMin: 30 }],
          })
        }
      >
        Add block
      </button>
      <ThumbBar>
        <button className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-quiet" onClick={() => setOpen(null)}>
          Cancel
        </button>
      </ThumbBar>
    </div>
  );
}
