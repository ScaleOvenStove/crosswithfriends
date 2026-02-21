import {pool} from './pool';

export async function saveGameSnapshot(
  gid: string,
  pid: string,
  snapshot: object,
  replayRetained = false
): Promise<void> {
  await pool.query(
    `INSERT INTO game_snapshots (gid, pid, snapshot, replay_retained)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (gid) DO UPDATE SET snapshot = $3, replay_retained = game_snapshots.replay_retained OR $4`,
    [gid, pid, JSON.stringify(snapshot), replayRetained]
  );
}

export async function getGameSnapshot(
  gid: string
): Promise<{gid: string; pid: string; snapshot: object; replayRetained: boolean} | null> {
  const {
    rows,
  } = await pool.query(`SELECT gid, pid, snapshot, replay_retained FROM game_snapshots WHERE gid = $1`, [
    gid,
  ]);
  if (rows.length === 0) return null;
  return {
    gid: rows[0].gid,
    pid: rows[0].pid,
    snapshot: rows[0].snapshot,
    replayRetained: rows[0].replay_retained,
  };
}

export async function setReplayRetained(gid: string, retained: boolean): Promise<boolean> {
  const result = await pool.query(`UPDATE game_snapshots SET replay_retained = $2 WHERE gid = $1`, [
    gid,
    retained,
  ]);
  return (result.rowCount || 0) > 0;
}
