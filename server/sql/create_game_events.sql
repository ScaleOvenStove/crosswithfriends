-- psql < create_puzzles.sql
--
-- Persisted event types: create, updateCell, check, reveal, reset, updateClock, chat
-- Ephemeral event types (broadcast only, NOT written to DB): updateCursor, addPing, updateDisplayName, updateColor
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
    OIDS = FALSE
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