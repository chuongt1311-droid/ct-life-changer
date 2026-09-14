'use client';

import { useState } from 'react';
import { PROFILE_SECTIONS, type Profile } from '@/core/mentor/profile';
import { DEFAULT_SETTINGS } from '@/core/types';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { completeOnboardingAction } from './actions';

function emptyProfileDraft(): Profile {
  return Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, ''])) as Profile;
}

export function OnboardingForm() {
  const [profile, setProfile] = useState<Profile>(emptyProfileDraft());
  const [contactLabel, setContactLabel] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [wakeTime, setWakeTime] = useState(DEFAULT_SETTINGS.wakeTime);
  const [bedtime, setBedtime] = useState(DEFAULT_SETTINGS.bedtime);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    await completeOnboardingAction({
      profile,
      crisisContacts: contactLabel ? [{ label: contactLabel, phone: contactPhone || undefined }] : [],
      timezone,
      wakeTime,
      bedtime,
    });
  }

  return (
    <div className="stepback">
      <Placard>Your schedule</Placard>
      <div className="field">
        <label htmlFor="timezone">Timezone</label>
        <input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="wakeTime">Usual wake time</label>
        <input id="wakeTime" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="bedtime">Usual bedtime</label>
        <input id="bedtime" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
      </div>

      <Placard>Tell the mentor about you</Placard>
      <p className="hint">One line per section is plenty — the mentor and weekly review fill these in more over time.</p>
      {PROFILE_SECTIONS.map((s) => (
        <div className="field" key={s.key}>
          <label htmlFor={s.key}>{s.heading}</label>
          <textarea id={s.key} rows={2} value={profile[s.key]} onChange={(e) => setProfile({ ...profile, [s.key]: e.target.value })} />
        </div>
      ))}

      <Placard>A crisis contact (spec §11)</Placard>
      <div className="field">
        <label htmlFor="contactLabel">Label</label>
        <input id="contactLabel" value={contactLabel} onChange={(e) => setContactLabel(e.target.value)} placeholder="A crisis line, a trusted person" />
      </div>
      <div className="field">
        <label htmlFor="contactPhone">Phone</label>
        <input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      <p className="hint">More can be added anytime in Settings.</p>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={submit} disabled={submitting}>
          {submitting ? 'Setting up…' : "Let's go"}
        </button>
      </ThumbBar>
    </div>
  );
}
