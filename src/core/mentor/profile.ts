/** Spec §8.6: the profile is a fixed set of named free-text sections. */
export const PROFILE_SECTIONS = [
  { key: 'goalsPhysical', heading: 'Physical goals' },
  { key: 'goalsFootballAnalytics', heading: 'Football analytics goals' },
  { key: 'goalsMind', heading: 'Mind goals' },
  { key: 'goalsCharacter', heading: 'Character goals' },
  { key: 'values', heading: 'Values' },
  { key: 'stressTriggers', heading: 'Stress triggers' },
  { key: 'whatWorks', heading: 'What works' },
  { key: 'whatDoesntWork', heading: "What doesn't work" },
  { key: 'commitments', heading: 'Current commitments' },
  { key: 'mentorStyle', heading: 'How the mentor should talk' },
  { key: 'observedPatterns', heading: 'Observed patterns' },
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number]['key'];
export type Profile = Record<ProfileSection, string>;

export function emptyProfile(): Profile {
  return Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, ''])) as Profile;
}

/** Markdown with one heading per section, always in the same order (keeps the prompt cache stable). */
export function renderProfile(profile: Profile): string {
  return PROFILE_SECTIONS.map(({ key, heading }) => `## ${heading}\n\n${profile[key].trim() || '(not written yet)'}`).join('\n\n');
}

export interface ProfileChange {
  section: ProfileSection;
  newText: string;
  reason: string;
}

/** Apply the weekly review's changes. Unknown sections are rejected so a bad model output can't corrupt the profile. */
export function applyProfileChanges(profile: Profile, changes: ProfileChange[]): Profile {
  const next = { ...profile };
  for (const change of changes) {
    if (!PROFILE_SECTIONS.some((s) => s.key === change.section)) {
      throw new Error(`Unknown profile section "${change.section}"`);
    }
    next[change.section] = change.newText;
  }
  return next;
}

/** One-tap revert: restore a section's text from the previous version. */
export function revertSection(current: Profile, previous: Profile, section: ProfileSection): Profile {
  return { ...current, [section]: previous[section] };
}
