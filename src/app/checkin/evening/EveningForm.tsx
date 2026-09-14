'use client';

import { useState } from 'react';
import { ChipGroup } from '@/components/ui/Chip';
import { FieldSkip } from '@/components/ui/FieldSkip';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from '@/components/mentor/CrisisContactsCard';
import type { CrisisContact } from '@/core/types';
import { submitEveningCheckinAction } from './actions';
import type { EveningCheckinInput } from '@/lib/checkins/submitCheckin';

const TRAINING_OPTIONS = [
  { value: 'done', label: 'Full session' },
  { value: 'partial', label: 'Part of it' },
  { value: 'rest', label: 'Rest day' },
  { value: 'skipped', label: "Didn't happen" },
];
const PROTEIN_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'ok', label: 'OK' },
  { value: 'hit', label: 'Hit target' },
];
const REGULATION_OPTIONS = ['guitar', 'walk', 'stretching', 'breathing', 'talked to someone', 'other'].map((v) => ({ value: v, label: v }));

export function EveningForm({ crisisContacts }: { crisisContacts: CrisisContact[] }) {
  const [training, setTraining] = useState<'done' | 'partial' | 'skipped' | 'rest'>('done');
  const [protein, setProtein] = useState<'low' | 'ok' | 'hit'>('ok');
  const [waterL, setWaterL] = useState(2);
  const [energyNow, setEnergyNow] = useState(5);
  const [peakStress, setPeakStress] = useState(3);
  const [regulated, setRegulated] = useState<string[]>([]);
  const [deepWorkMinutes, setDeepWorkMinutes] = useState(0);
  const [footballMinutes, setFootballMinutes] = useState(0);
  const [learned, setLearned] = useState('');
  const [gratitudeText, setGratitudeText] = useState('');
  const [lessonOfDay, setLessonOfDay] = useState('');
  const [winOfDay, setWinOfDay] = useState('');
  const [reachedOut, setReachedOut] = useState(false);
  const [frictionNote, setFrictionNote] = useState('');
  const [privatePeople, setPrivatePeople] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<Awaited<ReturnType<typeof submitEveningCheckinAction>> | null>(null);

  const localCrisis = useCrisisCheck([learned, lessonOfDay, winOfDay, frictionNote]);

  async function handleSubmit() {
    setSubmitting(true);
    const input: EveningCheckinInput = {
      body: { training, protein, waterL, energyNow },
      mind: { peakStress, stressCause: [], focusQuality: 3, regulated },
      work: { tasksDone: [], deepWorkMinutes, footballAnalytics: { projects: [], minutes: footballMinutes, learned } },
      pleasure: { plannedRestSessions: 0, unplannedEntries: [], cameBackAfterRest: 'yes' },
      people: { who: [], interactionType: null, felt: null, reachedOut, frictionNote },
      reflection: { gratitudeLines: gratitudeText.split('\n').filter((l) => l.trim().length > 0), lessonOfDay, winOfDay },
      privateKeys: privatePeople ? ['people'] : [],
    };
    const result = await submitEveningCheckinAction(input);
    setSubmitting(false);
    setReview(result);
  }

  if (review) {
    return (
      <div className="stepback">
        {(review.crisis || localCrisis) && <CrisisContactsCard contacts={crisisContacts} />}
        <Placard>From the department</Placard>
        <p className="note">{review.message}</p>
        {review.tomorrowNote && <p className="hint">{review.tomorrowNote}</p>}
        <ThumbBar>
          <a className="btn btn-main btn-wide" href="/">
            Back to today
          </a>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}

      <Placard>Body</Placard>
      <ChipGroup legend="Training" name="training" type="radio" options={TRAINING_OPTIONS} value={training} onChange={(v) => setTraining(v as typeof training)} />
      <ChipGroup legend="Protein" name="protein" type="radio" options={PROTEIN_OPTIONS} value={protein} onChange={(v) => setProtein(v as typeof protein)} />
      <div className="field">
        <label htmlFor="waterL">Water (L)</label>
        <input id="waterL" type="number" step={0.1} value={waterL} onChange={(e) => setWaterL(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="energyNow">Energy now (1–10)</label>
        <input id="energyNow" type="range" min={1} max={10} value={energyNow} onChange={(e) => setEnergyNow(Number(e.target.value))} />
      </div>

      <Placard>Mind</Placard>
      <div className="field">
        <label htmlFor="peakStress">Peak stress (1–10)</label>
        <input id="peakStress" type="range" min={1} max={10} value={peakStress} onChange={(e) => setPeakStress(Number(e.target.value))} />
      </div>
      <ChipGroup legend="What regulated me" name="regulated" type="checkbox" options={REGULATION_OPTIONS} value={regulated} onChange={(v) => setRegulated(v as string[])} />

      <Placard>Work &amp; growth</Placard>
      <div className="field">
        <label htmlFor="deepWorkMinutes">Deep work minutes</label>
        <input id="deepWorkMinutes" type="number" value={deepWorkMinutes} onChange={(e) => setDeepWorkMinutes(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="footballMinutes">Football analytics minutes</label>
        <input id="footballMinutes" type="number" value={footballMinutes} onChange={(e) => setFootballMinutes(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="learned">What I learned</label>
        <textarea id="learned" rows={2} value={learned} onChange={(e) => setLearned(e.target.value)} />
        <FieldSkip onSkip={() => setLearned('')} />
      </div>

      <Placard>People &amp; connections</Placard>
      <label className="chip">
        <input type="checkbox" checked={reachedOut} onChange={(e) => setReachedOut(e.target.checked)} />
        <span>Reached out to someone</span>
      </label>
      <div className="field">
        <label htmlFor="frictionNote">Anything friction-y worth a note</label>
        <textarea id="frictionNote" rows={2} value={frictionNote} onChange={(e) => setFrictionNote(e.target.value)} />
        <FieldSkip onSkip={() => setFrictionNote('')} />
      </div>
      <label className="chip">
        <input type="checkbox" checked={privatePeople} onChange={(e) => setPrivatePeople(e.target.checked)} />
        <span>Just for me — don&apos;t send People to the mentor</span>
      </label>

      <Placard>Reflection</Placard>
      <div className="field">
        <label htmlFor="gratitude">Gratitude — one per line</label>
        <textarea id="gratitude" rows={3} value={gratitudeText} onChange={(e) => setGratitudeText(e.target.value)} />
        <FieldSkip onSkip={() => setGratitudeText('')} />
      </div>
      <div className="field">
        <label htmlFor="lesson">Lesson of the day</label>
        <textarea id="lesson" rows={2} value={lessonOfDay} onChange={(e) => setLessonOfDay(e.target.value)} />
        <FieldSkip onSkip={() => setLessonOfDay('')} />
      </div>
      <div className="field">
        <label htmlFor="win">Win of the day</label>
        <textarea id="win" rows={2} value={winOfDay} onChange={(e) => setWinOfDay(e.target.value)} />
        <FieldSkip onSkip={() => setWinOfDay('')} />
      </div>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={handleSubmit} disabled={submitting}>
          <Icon name="kept" />
          {submitting ? 'Logging…' : 'Log the day'}
        </button>
      </ThumbBar>
    </div>
  );
}
