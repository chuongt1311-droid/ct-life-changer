import { describe, expect, it } from 'vitest';
import { applyProfileChanges, emptyProfile, PROFILE_SECTIONS, renderProfile, revertSection } from './profile';

describe('profile', () => {
  it('renders every section in a fixed order, marking empty ones', () => {
    const profile = { ...emptyProfile(), values: 'Honesty. Discipline.' };
    const md = renderProfile(profile);
    expect(md.startsWith('## Physical goals\n\n(not written yet)')).toBe(true);
    expect(md).toContain('## Values\n\nHonesty. Discipline.');
    expect(md.match(/^## /gm)).toHaveLength(PROFILE_SECTIONS.length);
  });

  it('applies changes and rejects unknown sections', () => {
    const next = applyProfileChanges(emptyProfile(), [
      { section: 'observedPatterns', newText: 'Late gaming → short sleep', reason: 'Seen 3 times' },
    ]);
    expect(next.observedPatterns).toBe('Late gaming → short sleep');
    expect(() =>
      applyProfileChanges(emptyProfile(), [{ section: 'nope' as never, newText: 'x', reason: '' }]),
    ).toThrow('Unknown profile section');
  });

  it('reverts a single section from the previous version', () => {
    const previous = { ...emptyProfile(), values: 'old', goalsMind: 'keep' };
    const current = { ...previous, values: 'new', goalsMind: 'changed too' };
    expect(revertSection(current, previous, 'values')).toMatchObject({ values: 'old', goalsMind: 'changed too' });
  });
});
