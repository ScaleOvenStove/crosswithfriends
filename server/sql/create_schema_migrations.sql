-- psql < create_schema_migrations.sql
-- Migration tracking table to record which migrations have been applied

CREATE TABLE IF NOT EXISTS schema_migrations
(
    migration_name text PRIMARY KEY,
    applied_at timestamp without time zone DEFAULT now() NOT NULL,
    checksum text -- Optional: hash of migration file for integrity checking
);

ALTER TABLE public.schema_migrations
    OWNER to dfacadmin;

GRANT ALL ON TABLE public.schema_migrations TO dfacadmin;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS schema_migrations_applied_at_idx
    ON public.schema_migrations (applied_at);

