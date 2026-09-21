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

## Completed
