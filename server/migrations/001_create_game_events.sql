-- Migration: 001_create_game_events.sql
-- Creates the game_events table for event sourcing

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

GRANT ALL ON TABLE public.game_events TO dfacadmin;

CREATE INDEX game_events_gid_ts_idx
    ON public.game_events USING btree
    (gid COLLATE pg_catalog."default" ASC NULLS LAST, ts ASC NULLS LAST)
    TABLESPACE pg_default;

