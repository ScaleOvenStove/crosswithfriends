import {dayOfWeekExtract} from '../../model/sql_helpers';

describe('dayOfWeekExtract', () => {
  it('returns SQL with table alias prefix when alias is provided', () => {
    const sql = dayOfWeekExtract('p');
    expect(sql).toContain("p.content->'info'->>'title'");
    expect(sql).toContain("THEN 'Mon'");
    expect(sql).toContain("THEN 'Sun'");
  });

  it('returns SQL without prefix when alias is empty string', () => {
    const sql = dayOfWeekExtract('');
    expect(sql).toContain("content->'info'->>'title'");
    expect(sql).not.toContain(".content->'info'->>'title'");
  });

  it('uses default empty alias when called with no arguments', () => {
    const sql = dayOfWeekExtract();
    expect(sql).toContain("content->'info'->>'title'");
    expect(sql).not.toContain(".content->'info'->>'title'");
  });

  it('contains all seven days of the week', () => {
    const sql = dayOfWeekExtract('p');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((day) => {
      expect(sql).toContain(`THEN '${day}'`);
    });
  });

  it('includes ELSE NULL fallback', () => {
    const sql = dayOfWeekExtract('p');
    expect(sql).toContain('ELSE NULL');
  });
});
