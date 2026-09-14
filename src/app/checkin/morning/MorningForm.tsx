'use client';

import { useState } from 'react';
import { ChipGroup } from '@/components/ui/Chip';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import { applyAdjustmentsAction, keepOriginalAction, submitMorningCheckinAction } from './actions';
import type { ReassessResult } from '@/lib/checkins/reassessMorning';

const STRESS_CAUSES = [
  { value: 'family', label: 'Family' },
  { value: 'school/work', label: 'School/work' },
  { value: 'money', label: 'Money' },
  { value: 'social', label: 'Social' },
  { value: 'health', label: 'Health' },
  { value: 'none', label: 'None' },
];

export function MorningForm({ prefillBedtime, prefillWakeTime }: { prefillBedtime: string; prefillWakeTime: string }) {
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(3);
  const [stressCause, setStressCause] = useState<string[]>([]);
  const [privateMind, setPrivateMind] = useState(false);
  const [banner, setBanner] = useState<ReassessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitMorningCheckinAction({
      body: { bedtime: prefillBedtime, wakeTime: prefillWakeTime, sleepQuality, energy },
      mind: { mood, stress, stressCause },
      privateKeys: privateMind ? ['mind'] : [],
    });
    setSubmitting(false);
    if (result.changed) setBanner(result);
    else window.location.href = '/';
  }

  if (banner) {
    return (
      <div className="stepback">
        <Placard>Today changed</Placard>
        <p className="note">
          Your state moved to <b>{banner.state}</b> — here&apos;s why: {banner.flags.map((f) => f.reason).join('; ')}
        </p>
        <ThumbBar stacked>
          <button className="btn btn-main" onClick={() => applyAdjustmentsAction(banner)}>
            Apply the adjustments
          </button>
          <button className="btn btn-quiet" onClick={() => keepOriginalAction()}>
            Keep original
          </button>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>Body</Placard>
      <div className="field">
        <label htmlFor="sleepQuality">Sleep quality (1–5)</label>
        <input id="sleepQuality" type="range" min={1} max={5} value={sleepQuality} onChange={(e) => setSleepQuality(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="energy">Energy (1–10)</label>
        <input id="energy" type="range" min={1} max={10} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
      </div>

      <Placard>Mind</Placard>
      <div className="field">
        <label htmlFor="mood">Mood (1–10)</label>
        <input id="mood" type="range" min={1} max={10} value={mood} onChange={(e) => setMood(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="stress">Stress (1–10)</label>
        <input id="stress" type="range" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
      </div>
      <ChipGroup legend="What's behind it" name="stressCause" type="checkbox" options={STRESS_CAUSES} value={stressCause} onChange={(v) => setStressCause(v as string[])} />
      <label className="chip">
        <input type="checkbox" checked={privateMind} onChange={(e) => setPrivateMind(e.target.checked)} />
        <span>Just for me — don&apos;t send Mind to the mentor</span>
      </label>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={handleSubmit} disabled={submitting}>
          <Icon name="kept" />
          {submitting ? 'Logging…' : 'Log the morning'}
        </button>
      </ThumbBar>
    </div>
  );
}
