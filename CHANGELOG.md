# Changelog

## [1.10.0.0] - 2026-09-22

### Added

- Added the new-house destocking cycle entry and page with citywide and district metrics.
- Added live API loading, quality-state labels, sorting, fixed progress scale, and district-to-search navigation.
- Added frontend tests for formatting, sorting, status mapping, and payload preparation.

## [1.9.0] - 2026-09-21

### Added

- Added daily transaction averages for total sales, new homes, and second-hand homes on the Shenzhen market analysis page.
- Added a current-speed monthly transaction estimate that appears from the 10th day of the month and respects 28/29/30/31-day calendar months.
- Added mortgage calculation flows for equal-installment and equal-principal repayment, including input boundary handling.
- Added historical transaction comparison with monthly same-period views, cumulative totals, and comparison filters.
- Added market-analysis, city-selection, price-index, mortgage, and collection entry pages used by the current Mini Program workspace.

### Changed

- Updated the transaction analysis layout to show the daily-average card between the monthly summary and district breakdown.
- Updated the custom tab bar to support administrator-only collection access.
- Updated the Mini Program navigation, sharing flows, search entry points, subscription/member surfaces, and market data cards.

### Fixed

- Prevented incomplete or inconsistent transaction summary payloads from rendering invalid daily-average or forecast values.
- Added regression coverage for calendar-month boundaries, pre-day-10 forecast hiding, request failures, mortgage branches, tab navigation, and collection submission states.
