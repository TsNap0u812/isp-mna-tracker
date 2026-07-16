# scripts/lp-data/ — LP-disclosure CSV inputs

Any `*.csv` in this directory is ingested by `scripts/fund-data-query.mjs` at
output assembly and matched to tracked firms (CalPERS-style fund-name match).
Matched rows land in `fund-data.json` as `firms[n].lpDisclosures`; unmatched
rows are listed in a console warning. Like `scripts/fund-overrides.json`,
these files are merged inputs — `fund-data.json` is regenerated wholesale, so
LP data must live here, never be hand-edited into the output.

## Column format (header must match exactly)

```
source,fundName,vintage,committedM,calledM,distributedM,navM,irr,asOf,sourceUrl
```

| Column       | Type   | Notes                                              |
|--------------|--------|----------------------------------------------------|
| source       | string | LP name, e.g. `CalSTRS`, `WSIB`                    |
| fundName     | string | As printed in the LP report (quote if it has commas) |
| vintage      | int    | Vintage year (VY) from the report; blank if absent |
| committedM   | number | Capital committed, $ millions                      |
| calledM      | number | Capital contributed/called, $ millions             |
| distributedM | number | Capital distributed, $ millions                    |
| navM         | number | Market value / NAV, $ millions                     |
| irr          | number | Since-inception IRR, % (negative for losses)       |
| asOf         | string | Report as-of date, `YYYY-MM-DD`                    |
| sourceUrl    | string | Direct URL of the report the row was taken from    |

Blank cells become `null`. A dash ("–"/"-") in the source report means no
activity — leave the cell blank rather than writing 0. NEVER fabricate rows:
every row must be a real value transcribed from the cited report, and only
funds managed by firms in the tracked universe belong here.

## Sources and update cadence

### calstrs.csv — CalSTRS Private Equity Portfolio Performance
- Page: https://www.calstrs.com/private-equity-portfolio-performance
- Format: PDF (semi-annual, ~6-month lag; fiscal year ends June 30)
- Current report: `CalSTRSPrivateEquityPerformanceReportFYE2025.pdf` (as of 2025-06-30)
- Columns map directly: VY → vintage, Capital Committed/Contributed/Distributed →
  committedM/calledM/distributedM, Market Value → navM, Since-Inception IRR → irr.
  Amounts in the PDF are whole dollars — divide by 1,000,000.
- Update: when a new report posts (roughly Jan and Jul), re-extract rows for
  tracked firms (Apax, Apollo, Ares, KKR, Madison Dearborn, Searchlight, TPG
  as of FYE2025 — re-scan for others) and replace this file. Watch out for
  near-miss names that are NOT our firms: Oak HC/FT, Oak Investment Partners,
  Oaktree (none are Oak Hill Capital).

### wsib.csv — Washington State Investment Board quarterly report
- Page: https://www.sib.wa.gov/information/publications/quarterly-reports
- PDF template: https://www.sib.wa.gov/docs/reports/quarterly/ir{MMDDYY}.pdf
- Format: PDF, ~200 pages, quarterly. Private markets appendix tables list
  fund name, committed capital, and market value (called/distributed and IRR
  appear in some editions only — leave blank when not printed).
- Currently a header-only template: transcribe rows for tracked firms from the
  latest quarterly PDF and fill in `asOf` + the exact PDF URL per row.

## Adding another LP source

Create `<lp-name>.csv` with the header above — no code change needed. Register
the source in `LP_PORTAL_REFS` in `scripts/fund-data-query.mjs` so it appears
in `fund-data.json → lpPortalRefs`.
