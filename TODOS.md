# TODOS

## WeChat QA

### Native Mini Program acceptance

**What:** Run the current release through WeChat Developer Tools or a preview/device build, including成交分析日均卡片、下拉刷新、页面导航和异常状态。

**Why:** The local Node test suite cannot prove the native Mini Program renderer, canvas behavior, or real page navigation.

**Context:** The current release plan records native Mini Program verification as NOT_TESTED. Keep the result separate from unit-test PASS evidence.

**Effort:** M
**Priority:** P1
**Depends on:** WeChat Developer Tools or preview/device access

## Backend Product Scope

### Price spread and project comparison APIs

**What:** Implement and test the price-spread and project-comparison APIs in the separate backend repository, then integrate them into the Mini Program when that repository is in scope.

**Why:** The historical plan referenced these APIs, but their implementation does not belong in this Mini Program repository.

**Context:** Deferred from the 2026-09-21 release plan. Do not treat the absence of `beian_query/app.py` here as a Mini Program defect.

**Effort:** XL
**Priority:** P2
**Depends on:** Separate backend repository and API contract

### Price alerts, saved searches, and watchlists

**What:** Define and implement the future retention features and their backend limits and concurrency tests.

**Why:** These are future product scope, not part of the daily-average成交 release.

**Context:** Deferred from the historical v2.0 retention-first plan. No current release claim is made for these features.

**Effort:** XL
**Priority:** P2
**Depends on:** Product scope decision and backend ownership

### Monthly comparison cards still build by requested year count

**What:** `buildMonthlyCards` 仍按请求年数生成行，后端少返年份时会产生整行 `—`。该视图当前不渲染（`empty` 已改为看 `monthlyTable`），线上不受影响。

**Why:** ISSUE-001 的修复只加固了实际渲染的表格（`buildMonthlyTable`）。卡片视图真正启用前，需要做同样的"只保留有数据的年份"过滤。

**Context:** 由 /qa 于 2026-10-29 记录。报告：`.gstack/qa-reports/run-20261028T233925Z/qa-report-transaction-compare-2026-10-29.md`。

**Effort:** S
**Priority:** P3
**Depends on:** 无（启用卡片视图时一并处理）

## Completed
