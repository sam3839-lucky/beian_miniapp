# Changelog

## [1.11.0] - 2026-10-29

### Added

- Added 近三年 / 近四年 / 近五年 range options to historical transaction comparison, alongside the existing 往年 default.

### Changed

- Bound the range label, its internal key and its year count into a single configuration table so the three can no longer drift apart.

### Fixed

- 近三年 previously rendered four year columns; it now renders exactly three, matching its label.
- Stopped rendering year columns that contain no data when the backend returns fewer years than the selected range asks for; the year-range label now derives from the columns actually rendered instead of the requested range.

## [1.10.0] - 2026-09-21

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
- Corrected the daily-average hero order so the metric label appears above the value, matching the approved mobile design.
- Added regression coverage for calendar-month boundaries, month-end forecasts, pre-day-10 forecast hiding, request failures, mortgage branches, tab navigation, and collection submission states.
