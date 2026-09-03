# Korat Tan Phai Shared Components

This document is the living reuse map for the Korat Tan Phai / โคราชทันภัย UI.
Read it before adding a new shared-looking component, duplicated stat card,
dropdown, map preview, provenance marker, dashboard section, or map control.

The current code remains the source of truth when this document drifts. Update
this document in the same change whenever a shared component contract changes.

## Public Shared Components

These components are exported from `src/components/` and may be reused across
files.

| Component | File | Use For | Current Contract |
| --- | --- | --- | --- |
| `AppSelect` | `src/components/AppSelect.tsx` | Product dropdowns, filters, listbox controls | Center-aligned trigger text by default, mobile bottom-sheet menu from CSS, keyboard/typeahead support, `align="start"` only when scan-left text is intentionally needed. |
| `MetricCard` | `src/components/PageSummary.tsx` | Individual stat-only cards | Centered content by default; use `tone`, `icon`, `detail`, and `provenance` instead of one-off stat tile classes. |
| `MetricGrid` | `src/components/PageSummary.tsx` | Groups of stat cards | Variants: `default`, `segmented`, `compact`; use for repeated KPI/stat groups instead of custom grids. |
| `PageSummary` | `src/components/PageSummary.tsx` | Top summary panels with copy plus metrics | Use for high-level overview summaries where a short narrative and metrics share one surface. |
| `DataProvenanceChip` | `src/components/DataProvenanceChip.tsx` | Provenance dots/chips | Supported kinds: `REAL`, `CANONICAL_SYNTHETIC`, `DERIVED`, `RUNTIME_STATE`, `PROXY`, `PENDING_SOURCE`. Do not invent parallel provenance pills. |
| `DataProvenanceLegend` | `src/components/DataProvenanceChip.tsx` | Provenance legends | Use the same provenance semantics as chips. |
| `AuditTrailFootnotes` | `src/components/AuditTrail.tsx` | Evidence/source footnotes | Use when showing source notes, freshness, and audit trail sections. |
| `OperationalFilters` | `src/components/OperationalFilters.tsx` | Page-wide operational filters | Desktop field band plus mobile compact summary and edit bottom sheet. Use for page/dashboard filters, not map-only filter rails. |
| `MapPreviewFooter` | `src/components/MapPreviewFooter.tsx` | Map hover/selection preview footer | Renders the shared action button or centered fallback note. Do not hand-code `.map-preview-action` or `.map-preview-note` directly. |
| `ContentSection` | `src/components/ContentSection.tsx` | Generic titled content shell | Use for generic section containers outside the specialized Nakhon workspace panels. |
| `RiskMap` | `src/components/RiskMap.tsx` | Inherited national/province SVG risk map | Keep for the nationwide/legacy map surface; local Nakhon maps use `NakhonRatchasimaLocalMap`. |
| `NakhonRatchasimaWorkspace` | `src/components/NakhonRatchasimaWorkspace.tsx` | Main province/district/subdistrict workspace | Owns the local route hierarchy, data joins, local map, and Nakhon-specific dashboard modules. |
| `NakhonRatchasimaWorkspaceSummary` | `src/components/NakhonRatchasimaWorkspaceSummary.tsx` | Compact entry summary for the Nakhon workspace | Use for a small landing/entry card that points into the local workspace. |
| `ProvinceWorkspacePlaceholder` | `src/components/ProvinceWorkspacePlaceholder.tsx` | Route-backed placeholder for other canonical provinces | Keeps missing local evidence visible without rendering it as normal or low risk. |

Helper exports:

| Export | File | Use For |
| --- | --- | --- |
| `AppSelectOption` | `src/components/AppSelect.tsx` | Shared option shape for `AppSelect` and filter controls. |
| `SummaryMetric`, `MetricCardProps` | `src/components/PageSummary.tsx` | Shared metric/card typing. |
| `DataProvenanceChipKind`, `dataProvenanceChipKindFromText` | `src/components/DataProvenanceChip.tsx` | Provenance typing and text-to-kind mapping. |
| `AuditTrailItem`, `AuditTrailSection` | `src/components/AuditTrail.tsx` | Audit trail data typing. |
| `MapPreviewFooterAction` | `src/components/MapPreviewFooter.tsx` | Shared map preview action typing. |
| `provinceOptionsForMonth` | `src/components/OperationalFilters.tsx` | Province option list helper for operational filters. |

## Local Shared Primitives

`src/components/NakhonRatchasimaWorkspace.tsx` intentionally contains many
Nakhon-specific primitives that are reused across province, district, and
subdistrict routes. They are not exported today, but inside that file they
should be treated as shared components and reused instead of duplicated.

| Primitive | Use For |
| --- | --- |
| `OfficialMetricCard` | Nakhon-specific metric cards backed by `MetricCard`. |
| `ProvinceDashboardHeading` | Province heading with source/readiness context. |
| `DashboardSection` | Standard titled Nakhon dashboard section shell. |
| `DashboardAccordionSection` | Compact disclosure section for source/detail content. |
| `DataGovernanceGuardrailList` | Guardrail list explaining readiness/source caveats. |
| `DataGovernanceGuardrailAccordion` | Compact guardrail disclosure. |
| `DroughtPageHeader` | Drought page identity/header. |
| `SourceTruthNote` | Compact source-of-truth note. |
| `ResearchStatGrid` | Local grid wrapper for research metric groups. |
| `DroughtForecastTrendGraph` | Shared drought forecast/historical trend chart. |
| `ResearchAreaForecastPanel` | District/subdistrict forecast panel. |
| `DroughtForecastArchivePanel` | Shared historical drought forecast archive module for province, district, and subdistrict drought pages. It takes the selected target month plus T+ horizon and never fabricates missing vintage data. |
| `DroughtForecastArchiveHorizonSelector` | Shared single-choice T+ selector for archive mode. Use exactly one selector per archive module. |
| `DroughtForecastArchiveSummaryMetrics` | Shared archive summary metric grid using `MetricGrid`/`MetricCard`; keeps coverage, no-risk, risk, missing, and level-specific metrics centered and source-aware. |
| `DroughtForecastArchiveMapFilters` | Shared forecast archive map filter rail using `AppSelect` for target month and forecast status. |
| `DroughtForecastPriorityPanel` | Province-level drought priority panel. |
| `ResearchDroughtSituationPanel` | Province drought status summary. |
| `ResearchDroughtDistrictPanel` | District ranking/status module. |
| `ResearchSubdistrictAttentionPanel` | Subdistrict attention/follow-up list. |
| `DataTransparencyPanel` | Readiness/data transparency module. |
| `ResearchSourceLimitsPanel` | Source/freshness/limitations module. |
| `ResearchAreaHeading` | District/subdistrict identity header. |
| `ResearchAreaSituationPanel` | District/subdistrict situation strip. |
| `ResearchAreaMapSection` | District/subdistrict map section wrapper. |
| `ResearchAreaDroughtHistoryPanel` | District/subdistrict historical drought chart. |
| `ResearchAreaSubdistrictsPanel` | Subdistrict grid/list for an area. |
| `ResearchAreaAttentionPanel` | Area attention/watchlist module. |
| `ResearchSubdistrictProfilePanel` | Subdistrict profile/context module. |
| `ResearchSubdistrictDataGapPanel` | Subdistrict data-gap module. |
| `ResearchAreaSourceLimitsPanel` | Area-specific source limits/disclosure. |
| `ProvinceDashboardMapCard` | Province dashboard map surface. |
| `AgricultureVisibilityPanel` | Agriculture facts/KPI panel. |
| `AgricultureImpactPanel` | Province agriculture impact panel. |
| `ResearchAreaAgricultureImpactPanel` | District/subdistrict agriculture facts panel. |
| `PredictionReadinessPanel` | Readiness summary and breakdown panel. |
| `NakhonRatchasimaLocalMap` | Shared local SVG map across province, district, and subdistrict levels. Supports normal/research criteria maps and drought forecast archive mode keyed by target month + T+ horizon. |
| `NakhonRatchasimaBreadcrumbs` | Local route breadcrumbs. |
| `NakhonRatchasimaLayerInspector` | Layer/provenance inspector. |
| `SourceDecisionFootnotes` | Source-decision footnotes. |
| `SourceFreshness` | Freshness/source summary. |
| `PanelTitle` | Icon plus title label for local panels. |

## Reuse Rules

- **Stat cards:** use `MetricCard` and `MetricGrid` for stat-only cards. In the
  Nakhon workspace, prefer `OfficialMetricCard` when the surrounding file is
  already using it. Stat card content is centered unless a richer narrative card
  needs a different layout.
- **Dropdowns:** use `AppSelect` for visible product dropdowns and filter
  selects. The trigger text is centered by default and the mobile bottom-sheet
  behavior is shared through its CSS. Do not add native `<select>` controls for
  new product filters unless there is a concrete accessibility or platform
  reason.
- **Page filters:** use `OperationalFilters` for page-wide filters. Local map
  filters live in `NakhonRatchasimaLocalMap` but still use `AppSelect`.
- **Map preview cards:** use `MapPreviewFooter` for preview actions and fallback
  notes. Preview cards must sit above lower sections when they overlap and the
  fallback note must remain centered.
- **Maps:** use `RiskMap` for inherited national map behavior and
  `NakhonRatchasimaLocalMap` for province/district/subdistrict local maps. Do
  not duplicate SVG map interaction logic; shared math and labels live in
  `src/mapInteraction.ts`, `src/mapLabels.ts`, and
  `src/useFullscreenTarget.ts`.
- **Forecast archive:** use `DroughtForecastArchivePanel` above the shared
  `NakhonRatchasimaLocalMap` on drought pages, and use
  `DroughtForecastArchiveMapFilters` inside the map. The archive selection is
  target month + T+ horizon; changing T+ must not silently switch target month,
  and no-data combinations must stay no-data.
- **Provenance:** use `DataProvenanceChip` and `DataProvenanceLegend`. Missing
  evidence must not be rendered as normal, green, or low-risk.
- **Section shells:** use `DashboardSection` or `DashboardAccordionSection`
  inside the Nakhon workspace, and `ContentSection` for generic app sections.
- **Data guardrails:** keep agricultural figures clearly separated from
  official damage figures, and keep data readiness separate from hazard
  severity.

## Interaction Contracts To Preserve

- Selecting an area on the province map is transient and can be cleared by
  clicking the selected feature again or the map background. Clearing selection
  should not immediately reopen a new hover preview while the map animates back.
  A route-selected subdistrict remains selected only while the user is on that
  subdistrict route.
- Hover/preview cards on district and subdistrict maps must use the same layout
  priority as the province map and must not be hidden behind following sections.
- The map footer fallback text is a centered shared component state, not a
  one-off text alignment fix.
- Desktop/tablet/mobile may compose the same information differently, but data
  values, readiness categories, source semantics, and route behavior must remain
  identical.

## Verification Defaults

For docs-only updates, run:

```bash
git diff --check
```

For shared UI or map component changes, run the relevant release-gate checks for
the touched surface. The usual minimum for this project is:

```bash
git diff --check
npm run build
npm test
```

When committing, pushing, or deploying, follow `docs/RELEASE_RUNBOOK.md`.
