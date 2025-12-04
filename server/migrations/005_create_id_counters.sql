-- Migration: 005_create_id_counters.sql
-- Creates sequences for ID generation

CREATE SEQUENCE IF NOT EXISTS gid_counter START 100000000;
CREATE SEQUENCE IF NOT EXISTS pid_counter START 100000000;

GRANT ALL ON SEQUENCE gid_counter TO CURRENT_USER;
GRANT ALL ON SEQUENCE pid_counter TO CURRENT_USER;

