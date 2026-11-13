# ClinIQ — UI plan

The design contract for every screen. `SPEC.md` cards say *what* to build; this file says how it
must look and behave. If a card and this file disagree, this file wins for visual matters and the
change is logged in `DECISIONS.md`.

**Direction in one line:** a quiet, dense clinical workstation — it should look like software a
hospital already runs, not like a startup landing page or a generated dashboard.

## 1. Principles

1. **The record is the interface.** Data first, chrome last. No hero sections, no marketing copy
   inside the app, no decorative illustration.
2. **Colour carries meaning only.** Neutral greys everywhere; colour appears for interactive
   elements and for clinical status (critical, warning, abnormal, machine-suggested). Never colour
   alone — always with text or a shape.
3. **Dense but calm.** Many rows on screen, strict alignment, generous line height inside rows,
   separation by hairline borders rather than cards and shadows.
4. **Unknown is not none.** "No allergies recorded" and "No known allergies" are different
   statements and look different. Missing values show "—" with a reason on hover, never blank.
5. **Machine output is always visibly machine output.** One consistent treatment (§5) for
   anything auto-extracted, auto-coded or AI-written.
6. **Every number has a unit, every code has a system, every date is `DD/MM/YYYY`.**

## 2. What is banned (the "AI slop" list)

- Gradients, glassmorphism, glow, coloured shadows, animated backgrounds.
- Purple/indigo as the brand colour; "sparkle" icons for AI; emoji anywhere in the UI.
- Card grids with large rounded corners and drop shadows for things that are lists or tables.
- Centered narrow columns for data screens; oversized headings; icon-in-a-coloured-circle tiles.
- KPI tiles that count things nobody asked about ("Total patients: 20").
- Smoothed chart lines, chart animation, pie or donut charts.
- Filler copy: "Welcome back!", "Oops!", "Powered by AI", "Seamlessly", exclamation marks.
- Placeholder text as labels; icon-only buttons without an accessible name and tooltip.
- Skeletons that do not match the final layout; spinners centred on a blank page.
- Default framework look: the Next.js starter fonts, favicon, metadata and page title.

## 3. Foundations

### Type
- UI and body: **Public Sans** (variable, via `next/font/google`, self-hosted at build).
- Codes, identifiers, HL7 and JSON: **IBM Plex Mono**.
- `font-variant-numeric: tabular-nums` on every table and on the patient banner.
- Sizes: 14 px base; 13 px secondary and table meta; 12 px minimum (labels, captions);
  headings 16 px (section) and 20 px (page). Weights 400, 500, 600 only. Sentence case everywhere;
  the only capitals are the family name in the patient banner.

### Colour tokens
Defined once as CSS variables in `globals.css` and exposed to Tailwind through `@theme`. Components
use tokens only — no raw hex values and no Tailwind palette classes (`text-gray-500`) in
components (lint rule or grep check).

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F6F7F9` | `#0F1418` | App background |
| `surface` | `#FFFFFF` | `#161D23` | Panels, tables |
| `sunken` | `#EEF1F4` | `#1D262E` | Table header, code blocks, reference band |
| `border` | `#D5DAE1` | `#2C3742` | Hairlines |
| `border-strong` | `#AEB6C2` | `#445261` | Inputs, focused panels |
| `text` | `#17212B` | `#E6EAEE` | Primary text |
| `text-muted` | `#55616F` | `#A3AEBA` | Secondary text |
| `accent` | `#0F5EA8` | `#6FB1F0` | Links, primary button, focus ring |
| `critical` / `critical-bg` | `#B42318` / `#FDECEA` | `#F2877C` / `#3A1A17` | Allergies, high-criticality, errors |
| `warning` / `warning-bg` | `#8A5A00` / `#FFF4D6` | `#E5B454` / `#3A2E10` | Abnormal results, care gaps |
| `success` / `success-bg` | `#1B6B3A` / `#E6F4EA` | `#6CC58A` / `#143021` | Confirmed, validation passed |
| `machine` / `machine-bg` | `#0B6B6B` / `#E6F3F2` | `#6FC7C2` / `#12302F` | Auto-extracted and AI content |

Every text/background pair must meet WCAG 2.2 AA (4.5:1). If axe reports a pair that fails,
adjust the token (not the component) and log it.

### Space, shape, depth
- 4 px grid. Table rows 32 px; form controls 32 px; page gutters 16 px (24 px ≥ 1280).
- Radius 4 px (6 px for dialogs and drawers). Nothing rounder.
- No shadows on page content. One shadow level for overlays (dialog, drawer, popover).
- Motion: 120 ms opacity/position for overlays only; none under `prefers-reduced-motion`.

### Icons
Lucide, 16 px, 1.5 px stroke, `currentColor`. An icon never replaces a text label except in
toolbars, where it has a tooltip and an `aria-label`.

## 4. Layout

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ClinIQ   [ Search patients: name or IHI      ]        Demo · synthetic data   Dr Demo ▾ │ 48
├────────────────────────────────────────────────────────────────────────────────────────┤
│ CITIZEN, Jane   DOB 01/01/1970 (56 y)   Female   IHI 8003 6088 3335 7361                │ 56
│ ▲ Allergies: Penicillin (high) · Latex            3 active problems                     │ sticky
├───────────────┬─────────────────────────────────────────────────┬──────────────────────┤
│ Summary       │ Active problems                         View all │ Decision support     │
│ Problems      │ ───────────────────────────────────────────────  │ ┌──────────────────┐ │
│ Medicines     │ Hypertension           confirmed   since 03/2019 │ │ ▲ HbA1c overdue  │ │
│ Allergies     │ Type 2 diabetes        confirmed   since 07/2021 │ │ Last 14/08/2025  │ │
│ Pathology     │ ┆ Chronic kidney dis.  Auto-extracted — pending  │ └──────────────────┘ │
│ Vitals        │                                                  │ ┌──────────────────┐ │
│ Encounters    │ Current medicines                       View all │ │ eGFR 38 · G3b    │ │
│ Documents     │ ───────────────────────────────────────────────  │ └──────────────────┘ │
│ ───────────   │ metformin 500 mg tablet · 1 twice daily          │                      │
│ Export summary│ …                                                │ Ask about this record│
└───────────────┴─────────────────────────────────────────────────┴──────────────────────┘
   200 px                         fluid                                    320 px
```

- Full-width application shell; data screens are never centred in a narrow column.
- ≥ 1280 px: three columns as above. 768–1279 px: section nav becomes a tab row, the right rail
  becomes a drawer opened from a "Decision support (2)" button. < 768 px: single column; usable,
  not optimised.
- The patient banner stays visible on every chart screen and inside every drawer that shows
  patient data (wrong-patient errors are the hazard being designed against).
- "Demo · synthetic data" stays in the header on every page. SMART mode shows "SMART · read-only".

## 5. Clinical display rules

| Thing | Rule |
|---|---|
| Patient banner | `FAMILY, Given` · `DOB DD/MM/YYYY (age)` · sex · IHI in 4-4-4-4 groups (mono). Deceased: "Deceased DD/MM/YYYY" replaces age, banner border becomes `border-strong`, no decision-support cards. |
| Allergies | In the banner, `critical` text with a ▲ shape; criticality in words. None recorded → "No allergies recorded" in muted text. Explicit no-known-allergy record → "No known allergies". |
| Problems | Name, verification status in words, onset. Sorted active first, then by onset. |
| Medicines | Following the ACSQHC on-screen medicines display guidance: active ingredient in lower case, strength with a space before the unit (`500 mg`), no trailing zeros (`5 mg`, not `5.0 mg`), leading zero (`0.5 mg`), dose instructions in words, no dangerous abbreviations (`daily`, not `qd`). The source code system is named ("RxNorm (US)"). |
| Results table | Columns: test, value (right-aligned), unit, reference range, flag, date. Abnormal: value in `warning` with the word "High"/"Low" and ▲/▼. No flag when the resource has no interpretation or range. |
| Charts | Straight line segments with a marker at each real measurement; true time scale; unit on the y-axis label; reference range as a `sunken` band; abnormal points use a different marker shape; no animation; a "Show table" toggle gives the same data as a table. |
| Dates | `DD/MM/YYYY`, times `HH:mm` Sydney. Relative time ("3 days ago") only as a tooltip. |
| Codes | Mono, with the system name: `SNOMED CT 38341003`. Never a bare number. |
| Machine output | `machine-bg` background, 2 px dashed left border in `machine`, and a text label: "Auto-extracted — pending review" or "AI-generated — verify against the record". Used for unconfirmed Conditions, pipeline suggestions and assistant answers, and for nothing else. |
| Confidence | Band in words plus the number: "High (0.95)". Never a percentage, never a progress bar. |
| Raw FHIR | "View FHIR JSON" opens a right drawer: resource type and id as the title, syntax-highlighted mono JSON, copy button, patient banner repeated at the top. |

## 6. States and copy

- **Loading:** skeleton rows that match the table's columns. HAPI cold start: an inline notice
  "The FHIR server is waking up. This can take up to two minutes. Retrying…" with elapsed seconds.
- **Empty:** one factual sentence in the table body ("No immunisations recorded."). No
  illustration, no call to action unless there is a real next step.
- **Error:** what failed, in plain words, plus what the user can do; a "Details" disclosure with
  the OperationOutcome or status code. Never a raw stack trace, never "Something went wrong".
- **Not configured:** "Terminology service not configured — using the offline subset (12 terms)."
- **Buttons** are verbs on the object: "Confirm diagnosis", "Reject", "Send message", "Export
  patient summary". One primary button per view.
- **Destructive or record-changing actions** state the consequence next to the button ("Marks the
  diagnosis as confirmed and records you as the verifier.").
- Voice: short, neutral, Australian spelling, no exclamation marks, no first-person from the app.

## 7. Screens

| Route | Purpose | Notes |
|---|---|---|
| `/` (signed out) | What this is, in three sentences; "Sign in as demo clinician"; link to About and the demo video | The only page with any prose pitch. No hero image. |
| `/patients` | Search and worklist table: name, DOB (age), sex, IHI, active problems, last encounter | Search is the page's main control; table rows are links. |
| `/patient/[id]` | Chart summary (wireframe above) | Sections link to full views. |
| `/patient/[id]/pathology` | Analyte list on the left, trend chart and results table on the right | |
| `/hl7` | Three panes: message (mono, segments on separate lines, field under the cursor named in a footer, e.g. "OBX-5 Observation value"), mapped FHIR, outcome and ACK | Message log table below with status. |
| `/pipeline` | Stepper: note → extraction → coding → validation → write, each step expandable with timing and JSON | Uses the machine treatment for suggestions. |
| `/review` | Queue on the left; on the right the note with the span highlighted, the suggested code, alternatives as radio options, confidence, rationale; "Confirm diagnosis", "Change code", "Reject" | Keyboard: `j`/`k` move, `c` confirm, `r` reject, shown in a legend. |
| `/audit` | Filterable table of audit events | |
| `/about` | Case study: problem, architecture diagram, standards and versions, limitations, path to production | Long-form reading width (72 ch) — the only narrow page. |

```
/review
┌──────────────────────┬───────────────────────────────────────────────────────────────┐
│ Pending (4)          │ CITIZEN, Jane · DOB 01/01/1970 (56 y) · IHI 8003 6088 3335 7361│
│ ▸ Chronic kidney dis.│───────────────────────────────────────────────────────────────│
│   CITIZEN, Jane      │ Discharge summary · 02/11/2026                                 │
│   High (0.95)        │ … PMHx: HTN, T2DM. Bloods show ┆chronic kidney disease┆ stage… │
│ ▸ GORD               │───────────────────────────────────────────────────────────────│
│   NGUYEN, Minh       │ Suggested code   SNOMED CT 709044004  Chronic kidney disease   │
│   Medium (0.72)      │ Confidence       High (0.95) — exact match on preferred term   │
│                      │ Alternatives     ○ 431855005  CKD stage 1   ○ 433144002 …      │
│                      │ Extracted by     medspaCy 1.x · SNOMED CT-AU 2026-10            │
│                      │                                                               │
│                      │ [ Confirm diagnosis ]  [ Change code ]  [ Reject ]             │
│                      │ Confirming records you as the verifier in the Provenance.      │
└──────────────────────┴───────────────────────────────────────────────────────────────┘
```

(Codes in wireframes are illustrative; real ones come from the terminology service.)

The assistant panel is specified in [`AI.md`](AI.md) §4.

## 8. Components and tooling

- **Primitives:** shadcn/ui (Radix underneath, so dialogs, drawers, menus, tabs and comboboxes
  are accessible by default), restyled to the tokens above. Take only what a card needs. Remove
  shadcn's default radius, shadows and colour variables in favour of §3 — unstyled defaults are
  exactly the generic look this plan avoids.
- **Tables:** plain semantic `<table>` with a shared `DataTable` wrapper (sticky header, row
  height, alignment). No data-grid library.
- **Charts:** Recharts (already installed), configured once in a shared `TrendChart`.
- **Tools for the building sessions** (owner installs once; see `PLAN.md`):
  1. `frontend-design` plugin for Claude Code — design guidance loaded during UI cards.
  2. shadcn MCP server — lets the session look up and add components correctly.
  3. Playwright MCP server — lets the session open the running app, take screenshots and compare
     them with this file before calling a card done.

## 9. How UI work is checked

Each card that touches UI is done only when:

1. Playwright screenshots of every touched screen at 1440×900 (light and dark) and 834×1112 are
   saved to `docs/ui/screens/<card>/` and committed.
2. axe reports no serious or critical violations on those screens, in both themes.
3. Every interactive element is reachable and operable by keyboard, with a visible focus ring.
4. `grep -r` finds no raw hex colours and no Tailwind palette colour classes in `src/components`
   or `src/app` (tokens only).
5. The session re-reads §2 against its own screenshots and states, item by item, that nothing on
   the banned list is present.
6. The owner looks at the screenshots. "Looks generic" is a valid reason to reopen the card.
