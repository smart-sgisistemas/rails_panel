# Changelog

All notable changes to the **Rails Panel** Chrome extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] — 2026-07-31

### Added

- **Compare (A/B)** — pick two requests and compare B against A (baseline).
  - Summary line of total Δ (B − A)
  - Stacked duration bars + synchronized waterfall
  - Metrics table (DB, views, cache, SQL count, N+1 patterns, …)
  - Diff sections for **Params**, **SQL patterns**, **Cache keys**, **Views/partials**, and **Exceptions**
  - Filters: Diff / Added / Removed / Slower / Faster (plus N+1, F?, Hits where relevant)
  - Heuristic **F?** badge when param changes look filter-driven for SQL
  - Open A / Open B jump buttons into detail tabs
  - Export compare as text (clipboard) or JSON download
- **Compare tables** use the same resizable DataTable pattern as the rest of the panel
  - Separate columns: Count / Δ Count / Time / Δ Time
  - Sortable Side, Count, Δ Count, Time, Δ Time
  - Line wrapping for long SQL, params, cache keys, and templates
- **Syntax coloring** in Compare for Params (`pretty-print-json`) and SQL (`highlight.js`)
- **Relative template paths** in Compare Views (e.g. `app/views/...`)
- **ANSI color** support in Log and Exception compare samples

### Examples

#### Mark two requests and open Compare

1. In the request list, click **A** on the baseline request and **B** on the candidate.
2. Open the **Compare** tab.
3. Read the one-line summary, e.g. `B − A −42 ms (−12%) · SQL −3 · params 2 changed`.

#### Spot a slower SQL pattern

Filter SQL with **Slower** — rows where the pattern exists on both sides and time went up:

| Side | Pattern | Count | Δ Count | Time | Δ Time |
|------|---------|------:|--------:|------|-------:|
| A-B | `User Load · SELECT "users".* FROM ...` | 1 → 1 | 0 | 12 ms → 48 ms | **+36 ms** |

#### Filter-driven SQL (F?)

When meaningful params changed and SQL count/patterns shifted, rows may show **F?** — hint that the regression is likely from different filters/ids, not only code.

#### Params side-by-side

| Side | Name | A | B |
|------|------|---|---|
| changed | `q` | `"active"` | `"archived"` |
| B | `page` | — | `2` |

Hide framework noise with **Hide framework** (`controller`, `authenticity_token`, …).

#### Cache hit rate change

Filter Cache with **Hits** to see only keys whose hit/miss mix changed (`hitΔ`).

### Changed

- Request list Compare badges: **A**, **B**, **A-B**
- File path links can wrap when showing full relative paths

## [2.0.0] — 2026-07-30

### Added

- Waterfall **Timeline** with Slow / Heavy / Gap markers
- **N+1** detection on SQL patterns
- Configurable ERP / duration thresholds in settings
- Request memory cap
- Request **import/export** (clipboard + file), including external requests
- DevTools-safe clipboard via offscreen document
- Vue 3 + Vite + Pinia + PrimeVue panel rewrite packaging (`npm run release`)

### Packaging

- `npm run release` → `extension/releases/rails_panel-<version>.zip` (and `.crx` when Chrome is available)

## [1.x]

Earlier Chrome Web Store / classic extension builds. See git history for details.

[2.3.0]: https://github.com/smart-sgisistemas/rails_panel/releases/tag/v2.3.0
[2.0.0]: https://github.com/smart-sgisistemas/rails_panel/releases/tag/v2.0.0
