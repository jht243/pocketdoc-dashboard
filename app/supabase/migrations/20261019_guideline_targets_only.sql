-- Guideline-based targets only (Adam Locker, Oct 19 2026: "conventional/guideline-
-- based ranges throughout, not functional/optimal ranges, for now"). These four had
-- no guideline behind them, so they are removed and the member sees the lab range
-- printed on their own report instead. All were placeholders awaiting approval.
delete from ghai.marker_targets
 where marker_id in ('FASTING_INSULIN', 'WBC', 'RDW', 'ALBUMIN')
   and approved_by = 'pending';
