#!/bin/sh

# This script is intended for use when you are locally standing up a postgres instance to test the backend
# it simply creates all of the relevant dbs in the provided param

echo "creating dbs in ${1}"

# Core tables
psql -a "${1}" < sql/create_game_events.sql
psql -a "${1}" < sql/create_puzzles.sql
psql -a "${1}" < sql/create_room_events.sql
psql -a "${1}" < sql/create_puzzle_solves.sql
psql -a "${1}" < sql/create_id_counters.sql

# Auth tables (order matters — users first, then tables that reference it)
psql -a "${1}" < sql/create_users.sql
psql -a "${1}" < sql/create_refresh_tokens.sql
psql -a "${1}" < sql/create_user_identity_map.sql
psql -a "${1}" < sql/create_email_auth_tables.sql

# Schema alterations (safe to re-run — use IF NOT EXISTS / IF NOT)
psql -a "${1}" < sql/alter_puzzle_solves_add_user_id.sql
psql -a "${1}" < sql/alter_puzzles_add_uploaded_by.sql
psql -a "${1}" < sql/make_puzzle_private.sql