import {collapseRepeatedTitlePrefix} from '../../jobs/title_utils';

describe('collapseRepeatedTitlePrefix', () => {
  it('collapses a single-word publication repeated several times', () => {
    expect(collapseRepeatedTitlePrefix('Universal Universal Universal Crossword - Aug 8 2026')).toBe(
      'Universal Crossword - Aug 8 2026'
    );
  });

  it('collapses a multi-word publication repeated twice', () => {
    expect(collapseRepeatedTitlePrefix('The New Yorker The New Yorker Crossword')).toBe(
      'The New Yorker Crossword'
    );
  });

  it('collapses a two-word publication repeated three times', () => {
    expect(collapseRepeatedTitlePrefix('USA Today USA Today USA Today Crossword')).toBe(
      'USA Today Crossword'
    );
  });

  it('ignores punctuation differences between copies and keeps the last one', () => {
    expect(collapseRepeatedTitlePrefix('Newsday, Newsday Crossword')).toBe('Newsday Crossword');
  });

  it('handles a title that is nothing but the repeated publication', () => {
    expect(collapseRepeatedTitlePrefix('Wall Street Journal Wall Street Journal')).toBe(
      'Wall Street Journal'
    );
  });

  it('leaves a title with no leading repeat alone', () => {
    expect(collapseRepeatedTitlePrefix('Universal Crossword - Aug 8 2026')).toBe(
      'Universal Crossword - Aug 8 2026'
    );
  });

  it('does not collapse a word repeated later in the title', () => {
    expect(collapseRepeatedTitlePrefix('Themeless Monday Monday')).toBe('Themeless Monday Monday');
  });

  it('normalizes stray whitespace', () => {
    expect(collapseRepeatedTitlePrefix('  Mini   Mini  Crossword ')).toBe('Mini Crossword');
  });

  it('handles empty and single-word titles', () => {
    expect(collapseRepeatedTitlePrefix('')).toBe('');
    expect(collapseRepeatedTitlePrefix('   ')).toBe('');
    expect(collapseRepeatedTitlePrefix('Crossword')).toBe('Crossword');
  });
});
