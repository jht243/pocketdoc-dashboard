-- Test mode is gone (Oct 18 2026). It swapped a member's own records for a seeded
-- demo profile ("Adam Locker"), and members read the demo's labs as their own: Adam's
-- "vitamin D 28 ng/mL" was the demo's value, not his. The app no longer reads or
-- writes this table; every row in it was a copy of the demo snapshot, never anything
-- a member entered.
drop table if exists ghai.test_mode_snapshots;
