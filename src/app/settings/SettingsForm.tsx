'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { MODEL_PRICES } from '@/core/mentor/cost';
import type { SettingsRow } from '@/lib/db/schemas';
import { saveSettingsAction, signOutAction } from './actions';

export function SettingsForm({ initial, ownerEmail }: { initial: SettingsRow; ownerEmail: string }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    await saveSettingsAction(draft);
    setSaving(false);
    setSavedAt(Date.now());
  }

  function addContact() {
    setDraft({ ...draft, crisis_contacts: [...draft.crisis_contacts, { label: '', phone: '', url: '' }] });
  }

  return (
    <div className="stepback">
      <Placard>Account</Placard>
      <p className="note">Signed in as {ownerEmail}.</p>

      <Placard>Mentor</Placard>
      <div className="field">
        <label htmlFor="model">Model</label>
        <select id="model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
          {Object.keys(MODEL_PRICES).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="cap">Monthly cap (USD)</label>
        <input id="cap" type="number" value={draft.monthly_cap_usd} onChange={(e) => setDraft({ ...draft, monthly_cap_usd: Number(e.target.value) })} />
      </div>

      <Placard>Schedule</Placard>
      <div className="field">
        <label htmlFor="timezone">Timezone (IANA)</label>
        <input id="timezone" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="wakeTime">Wake time</label>
        <input id="wakeTime" type="time" value={draft.wake_time} onChange={(e) => setDraft({ ...draft, wake_time: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="bedtime">Bedtime</label>
        <input id="bedtime" type="time" value={draft.bedtime} onChange={(e) => setDraft({ ...draft, bedtime: e.target.value })} />
      </div>

      <Placard>Crisis contacts</Placard>
      <ul className="sessions">
        {draft.crisis_contacts.map((c, i) => (
          <li key={i} data-rank="next">
            <span className="what">
              <input
                className="chip"
                placeholder="Label"
                value={c.label}
                onChange={(e) => {
                  const contacts = [...draft.crisis_contacts];
                  contacts[i] = { ...c, label: e.target.value };
                  setDraft({ ...draft, crisis_contacts: contacts });
                }}
              />
              <small>
                <input
                  className="chip"
                  placeholder="Phone"
                  value={c.phone ?? ''}
                  onChange={(e) => {
                    const contacts = [...draft.crisis_contacts];
                    contacts[i] = { ...c, phone: e.target.value };
                    setDraft({ ...draft, crisis_contacts: contacts });
                  }}
                />
              </small>
            </span>
            <button className="btn btn-quiet" onClick={() => setDraft({ ...draft, crisis_contacts: draft.crisis_contacts.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-quiet" onClick={addContact}>
        Add contact
      </button>

      {savedAt && <p className="hint">Saved.</p>}
      <ThumbBar>
        <button className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button className="btn btn-quiet" onClick={() => signOutAction()}>
          Sign out
        </button>
      </ThumbBar>
    </div>
  );
}
