-- IPPAS Pulse Migration 09: Staff & User Unique ID + Date of Birth (DOB) for 2-of-3 Password Reset
-- Safe & idempotent: can be run multiple times in Supabase SQL Editor or PostgreSQL.

-- 1. Add unique_id and dob columns to profiles (Owner, Manager, Accountant, Super Admin)
alter table profiles
  add column if not exists unique_id text,
  add column if not exists dob date;

-- 2. Add unique_id and dob columns to staff_members (Crew & Staff Portal accounts)
alter table staff_members
  add column if not exists unique_id text,
  add column if not exists dob date;

-- 3. Case-insensitive partial unique indexes so non-empty Unique IDs remain unique per table
create unique index if not exists profiles_unique_id_upper_idx
  on profiles (upper(btrim(unique_id)))
  where unique_id is not null and btrim(unique_id) <> '';

create unique index if not exists staff_members_unique_id_upper_idx
  on staff_members (upper(btrim(unique_id)))
  where unique_id is not null and btrim(unique_id) <> '';
