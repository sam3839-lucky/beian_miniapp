# QA Report — beian_miniapp

**Date:** 2026-06-03
**Branch:** feature/pg-migration
**Duration:** ~10 min
**Mode:** API-driven (mini program, no browser)

## Health Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Console | N/A (API-only) | — | — |
| Links | N/A | — | — |
| Functional | 85 | 50% | 42.5 |
| Data Integrity | 100 | 50% | 50.0 |
| **Total** | | | **92.5/100** |

## Endpoint Verification

| Endpoint | Status | Notes |
|----------|--------|-------|
| /api/resale/stats | ✅ 200 | Cache working, 4197 communities |
| /api/resale/meta | ✅ 200 | Materialized views + cache |
| /api/resale/community | ✅ 200 | MAX/MIN dates, layouts with year filter |
| /api/resale/search | ✅ 200 | ILIKE with pg_trgm index |
| /api/dashboard | ✅ 200 | 5-in-1 combined endpoint |
| /api/transactions/summary | ✅ (via dashboard) | — |
| /api/transactions/trends | ✅ (via dashboard) | — |

## Issues Found

### ISSUE-001 — /meta 500 error (materialized view permission)
- **Severity:** High
- **Status:** ✅ Fixed (granted SELECT to property_clawer)
- **Root cause:** mv_hot_communities created by postgres, API connects as property_clawer
- **Fix:** `GRANT SELECT ON mv_hot_communities, mv_district_stats, mv_community_zone TO property_clawer`

### ISSUE-002 — Materialized views need periodic refresh
- **Severity:** Medium
- **Status:** ⚠️ Deferred
- **Note:** The materialized views are static snapshots. Newly added data won't appear in /meta until REFRESH. Consider adding REFRESH to the daily cron.
- **Fix (later):** Add `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hot_communities` to daily sync script.

## Data Integrity

| Check | Result |
|-------|--------|
| total_price in correct range (万) | ✅ 200-2000万 |
| unit_price in correct range (元/㎡) | ✅ 30000-150000 |
| avg_price (total) vs avg_unit (per-area) ratio | ✅ Consistent |
| Layout year filter working (1yr vs 10yr) | ✅ |
| Old data (翠竹苑) not corrupted | ✅ |
| Recent transactions show correct prices | ✅ |

## Syntax Verification

All 10 JS files + 2 Python files pass syntax check ✅

## Summary

**1 critical issue found and fixed** (materialized view permission).
**1 deferred** (materialized view refresh scheduling).
Overall app health: **Good** — all APIs responding, data consistent, syntax clean.
