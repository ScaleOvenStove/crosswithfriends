-- Locate 1000011097-104 and 1000011113-4.
--
-- Read-only. Probes every id-bearing table at once, plus prefix variants in
-- case the suffix differs from what was quoted, plus total row counts as a
-- sanity check that this database is the populated one.
--
-- Whatever comes back non-empty tells us where the title actually lives:
--
--   game_events.gid       -> title is frozen in the create event payload
--   game_snapshots.gid    -> create event was archived; pid is on the snapshot
--   puzzle_solves.gid     -> game exists, resolve the pid from here
--   puzzles.pid           -> these were puzzle ids after all
--   (all empty)           -> wrong database, or the ids are from somewhere else

WITH ids(id) AS (VALUES ('1000011097-104'), ('1000011113-4')),
     prefixes(p) AS (VALUES ('1000011097%'), ('1000011113%'))
SELECT * FROM (
  SELECT 'game_events.gid' AS location, ge.gid AS matched_id, COUNT(*)::text AS rows
    FROM game_events ge JOIN ids ON ge.gid = ids.id GROUP BY ge.gid
  UNION ALL
  SELECT 'game_snapshots.gid', gs.gid, COUNT(*)::text
    FROM game_snapshots gs JOIN ids ON gs.gid = ids.id GROUP BY gs.gid
  UNION ALL
  SELECT 'puzzle_solves.gid', ps.gid, COUNT(*)::text
    FROM puzzle_solves ps JOIN ids ON ps.gid = ids.id GROUP BY ps.gid
  UNION ALL
  SELECT 'firebase_history.gid', fh.gid, COUNT(*)::text
    FROM firebase_history fh JOIN ids ON fh.gid = ids.id GROUP BY fh.gid
  UNION ALL
  SELECT 'game_dismissals.gid', gd.gid, COUNT(*)::text
    FROM game_dismissals gd JOIN ids ON gd.gid = ids.id GROUP BY gd.gid
  UNION ALL
  SELECT 'game_locks.gid', gl.gid, COUNT(*)::text
    FROM game_locks gl JOIN ids ON gl.gid = ids.id GROUP BY gl.gid
  UNION ALL
  SELECT 'game_bans.gid', gb.gid, COUNT(*)::text
    FROM game_bans gb JOIN ids ON gb.gid = ids.id GROUP BY gb.gid
  UNION ALL
  SELECT 'game_restrictions.gid', gr.gid, COUNT(*)::text
    FROM game_restrictions gr JOIN ids ON gr.gid = ids.id GROUP BY gr.gid
  UNION ALL
  SELECT 'room_events.rid', re.rid, COUNT(*)::text
    FROM room_events re JOIN ids ON re.rid = ids.id GROUP BY re.rid
  UNION ALL
  SELECT 'puzzles.pid', p.pid, COUNT(*)::text
    FROM puzzles p JOIN ids ON p.pid = ids.id GROUP BY p.pid
  UNION ALL
  SELECT 'puzzles.pid LIKE', p.pid, COUNT(*)::text
    FROM puzzles p JOIN prefixes ON p.pid LIKE prefixes.p GROUP BY p.pid
  UNION ALL
  SELECT 'game_snapshots.gid LIKE', gs.gid, COUNT(*)::text
    FROM game_snapshots gs JOIN prefixes ON gs.gid LIKE prefixes.p GROUP BY gs.gid
  UNION ALL
  SELECT 'game_events.gid LIKE', ge.gid, COUNT(*)::text
    FROM game_events ge JOIN prefixes ON ge.gid LIKE prefixes.p GROUP BY ge.gid
  UNION ALL
  SELECT 'TOTAL game_events', '(any)', COUNT(*)::text FROM game_events
  UNION ALL
  SELECT 'TOTAL game_snapshots', '(any)', COUNT(*)::text FROM game_snapshots
  UNION ALL
  SELECT 'TOTAL puzzles', '(any)', COUNT(*)::text FROM puzzles
) r
ORDER BY location;
