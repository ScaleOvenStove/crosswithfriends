-- psql < create_puzzles.sql
--
-- Persisted event types: create, updateCell, check, reveal, reset, updateClock, chat, updateDisplayName, updateColor
-- Ephemeral event types (broadcast only, NOT written to DB): updateCursor, addPing
-- See EPHEMERAL_EVENT_TYPES in server/SocketManager.ts

CREATE TABLE public.game_events
(
    gid text COLLATE pg_catalog."default",
    uid text COLLATE pg_catalog."default",
    ts timestamp without time zone,
    event_type text COLLATE pg_catalog."default",
    event_payload json
)
WITH (
    OIDS = FALSE,
    -- High-write table: tune autovacuum to run sooner and harder than defaults.
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_cost_limit = 1000,
    autovacuum_vacuum_cost_delay = 10
)
TABLESPACE pg_default;

ALTER TABLE public.game_events
    OWNER to dfacadmin;

-- GRANT ALL ON TABLE public.game_events TO dfac_production;

GRANT ALL ON TABLE public.game_events TO dfacadmin;
-- Index: game_events_gid_ts_idx

-- DROP INDEX public.game_events_gid_ts_idx;

CREATE INDEX game_events_gid_ts_idx
    ON public.game_events USING btree
    (gid COLLATE pg_catalog."default" ASC NULLS LAST, ts ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS game_events_uid_idx
    ON public.game_events (uid);

CREATE INDEX IF NOT EXISTS game_events_payload_id_idx
    ON public.game_events (((event_payload->'params'->>'id')));

CREATE INDEX IF NOT EXISTS game_events_gid_event_type_idx
    ON public.game_events (gid, event_type);

-- Supports wasParticipantOfGame()'s verifiedUserId probe (gid + verifiedUserId).
-- Partial: only authenticated events carry the field, keeping the index small.
CREATE INDEX IF NOT EXISTS game_events_gid_verified_user_idx
    ON public.game_events (gid, ((event_payload->>'verifiedUserId')))
    WHERE (event_payload->>'verifiedUserId') IS NOT NULL;