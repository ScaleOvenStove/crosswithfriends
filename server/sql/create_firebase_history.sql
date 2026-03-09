-- firebase_history: Legacy game participation data migrated from Firebase.
-- Used to surface historical puzzle statuses and in-progress games
-- for users whose activity predates the PostgreSQL game_events system.

CREATE TABLE IF NOT EXISTS firebase_history (
  dfac_id       text    NOT NULL,
  gid           text    NOT NULL,
  pid           integer NOT NULL,
  solved        boolean NOT NULL DEFAULT false,
  activity_time bigint  NOT NULL,
  PRIMARY KEY (dfac_id, gid)
);

CREATE INDEX IF NOT EXISTS idx_firebase_history_dfac ON firebase_history (dfac_id);
CREATE INDEX IF NOT EXISTS idx_firebase_history_pid  ON firebase_history (pid);

GRANT ALL ON firebase_history TO dfacadmin;
