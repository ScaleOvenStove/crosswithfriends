/**
 * Returns a SQL CASE expression that extracts the day of the week from a puzzle title.
 * Uses PostgreSQL regex word boundaries to match day names and common abbreviations.
 *
 * @param tableAlias - Table alias for the puzzles table (e.g. 'p'). Pass empty string for no alias.
 */
export function dayOfWeekExtract(tableAlias = ''): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return `
  CASE
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(MONDAY|MON)\\M' THEN 'Mon'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(TUESDAY|TUE|TUES)\\M' THEN 'Tue'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(WEDNESDAY|WED|WEDS)\\M' THEN 'Wed'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(THURSDAY|THU|THURS)\\M' THEN 'Thu'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(FRIDAY|FRI)\\M' THEN 'Fri'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(SATURDAY|SAT)\\M' THEN 'Sat'
    WHEN UPPER(${prefix}content->'info'->>'title') ~ '\\m(SUNDAY|SUN)\\M' THEN 'Sun'
    ELSE NULL
  END`;
}
