# Task: Mock Data Form-Filler — Load-Test Harness for RequestPA

> ✅ **STATUS: IMPLEMENTED (Option A).** The seeder pre-fills the RequestPA form (41 transactions)
> and does NOT POST; the form's own Submit performs the timed write. Built:
> `components/pages/PA/RequestPA/MockDataSeeder/`, `utils/mockTemplateMapper.ts`,
> `constants/mockData.ts`, `useRequisitionForm.loadMockData`, and bundled
> `mockData/mockTemplate.json` + `mockData/lookupDescriptions.json`. The old POST-based
> `MockDataService` was removed. The notes below are the original design spec (kept for context).

> **Scope:** Developer-only utility. Not a production feature.
> **Real goal:** Measure how long the **form's own Submit** takes when posting a heavy
> payload (many transactions), to gauge real user experience. The mock button only
> *pre-fills* the form; the existing Submit button does the POST being timed.
> **Architecture:** TWO-PHASE. Phase 1 (done) fetched a template; Phase 2 maps that
> template into the live form state — **no POST in the seeder**.
> **Reference docs:** Read `docs/REQUIREMENTS.md`, `docs/CONVENTIONS.md` before coding.
>
> ⚠️ **Auth boundary (CLAUDE.md):** Phase 1 script lives in `../SharePoint_Scripts/`
> (app-only). Phase 2 webpart code uses ONLY the browser SP client — never `azure_key.txt`,
> `@azure/msal-node`, `msal`, or `ts-node`.

---

## Corrected behaviour (supersedes all earlier POST-based design)

```
Click "Seed Mock Data"  →  modal asks for Fiscal Year + Fiscal Month
        ↓ (OK)
Take bundled mockTemplate.json → rewrite FY/Month in Title/TPMNo →
group expenses + allocations under their parent transaction by Title →
map into the form's state shape → PUSH into the live RequestPA form.
        ↓
The seeder STOPS here. NO write to SharePoint.
        ↓
User clicks the form's EXISTING Submit button  →  RequisitionService POSTs
all transactions  →  user times this (the real user-experience path).
```

The mock button must **not** POST. The only POST is the form's real Submit handler,
because that is the code path being measured. A separate seeder POST would time the
wrong path and invalidate the test.

---

## ⚠️ Pivot notice for the agent — what to UNDO

A prior session built a POST-based `MockDataService` (clones template → POSTs to the
three lists). That measures the wrong path. Under Option A:

- **Remove `MockDataService`'s POST logic entirely** (the `seedMockData` write path,
  field-stripping for POST, GUID POST endpoints, success/error-on-POST). It is replaced
  by a mapping-into-form path. If anything in it is reusable for mapping, reuse it;
  otherwise delete the file.
- **Keep** `utils/requisitionNumberUtils.ts` (transform/parse/validate — verified), the
  bundled `mockData/mockTemplate.json`, `FISCAL_MONTHS`, and the dialog shell.
- **Drop from `constants/mockData.ts`** the POST-only constants (`SP_MANAGED_FIELDS`,
  the three `SP_LIST_GUID_*`) unless the mapping path genuinely needs them. Keep
  `MOCK_TEMPLATE_SOURCE_PREFIX` and `FISCAL_MONTHS`.

---

## Phase 1 — Template fetch — DONE ✅ (do not redo)

Confirmed facts (from the probe + full fetch via `SharePoint_Scripts/fetchMockTemplate.py`):

- `Title` = full e-Req number **with** `-TxNo` suffix, e.g. `DAPA1920-01-1`.
- `TPMNo` = prefix only, e.g. `DAPA1920-01` (shared by all txns in the month).
- Detail filtered by `TPMNo == 'DAPA1920-01'` (exact). Children joined by `Title`.
- **Counts: 41 transactions, 69 expenses, 80 allocations.** All child `Title`s ∈ the
  41-Title set; allocations carry `Allocation: 100` (BR-03 preserved).
- Bundle written to `src/webparts/requisition/mockData/mockTemplate.json`.
- Lookups normalized in-script to SP REST shape (`<Name>Id`, multi as `<Name>Id: [..]`).
- Auth deviation: SP REST app-only failed (cert required); script used **Graph**
  (`Sites.Read.All`). Dev-time only — does NOT affect the Phase 2 browser client.

> The 41-transaction payload is intentional: it is the heavy load for the Submit timing test.

---

## Phase 2 — Map template into the live form (no POST)

### MUST verify by reading code BEFORE writing (these drive the whole design)

1. **Is RequestPA multi-transaction?** Confirm the form state is an array
   (`IRequisitionTransaction[]`) and the UI renders more than one. Option A loads all 41,
   so the form must hold many. If it is single-transaction, STOP and report — we rethink.
2. **Existing load path.** Read `utils/requisitionMapper.ts` (`mapRawDataToForm`) and how
   `loadRequisition` (in `useRequisitionForm`) flows raw SP rows + option sets into form
   state. Reuse that path — do not invent a second mapper.
3. **Bundle shape vs mapper input.** The bundle came via Graph then normalized. Confirm its
   row shape matches what `mapRawDataToForm` expects (the shape `RequisitionService` returns).
   If they differ, write a thin adapter — do not fork the mapper.
4. **State setter.** Determine how to push transactions into form state: extend the existing
   load path, or add one method `loadMockData(transactions)` to `useRequisitionForm`. Keep
   it surgical — one new method, no hook refactor.
5. **Channel / FY / Month wiring.** Check whether the form derives Channel + period from the
   transaction data or needs them set separately (header fields). The dialog supplies FY +
   Month; ensure they land wherever the form/Submit expects them.
6. **How Submit builds the e-Req number.** Read `RequisitionService` submit. If Submit
   *generates* `Title`/`TPMNo` from Channel+FY+Month+TxNo, then pre-rewriting them in the
   seeder may be redundant or conflict — flag and reconcile. If Submit *uses* the values
   already in form state, then `transformReqNumbers` must run so the new FY/Month (and thus
   new e-Req numbers) avoid colliding with existing SharePoint data on Submit.

### Files to CREATE
```
src/webparts/requisition/components/pages/PA/RequestPA/MockDataSeeder/
├── MockDataSeeder.tsx            ← Fluent UI Dialog — UI only, no data logic
├── MockDataSeeder.module.scss    ← Scoped styles — no inline CSS
├── MockDataSeeder.types.ts       ← Component interfaces
└── index.ts                      ← Barrel
src/webparts/requisition/utils/mockTemplateMapper.ts  ← group-by-Title + adapt bundle → mapper input (ONLY if an adapter is needed per check #3)
src/webparts/requisition/constants/mockData.ts        ← FISCAL_MONTHS + source prefix (trimmed)
```
### Files to MODIFY
```
src/webparts/requisition/hooks/useRequisitionForm.ts  ← add loadMockData(...) setter (surgical)
src/webparts/requisition/components/pages/PA/RequestPA/RequestPA.tsx  ← button + dialog (surgical)
src/webparts/requisition/constants/index.ts           ← re-export from mockData.ts
```

### 2.1 `MockDataSeeder.types.ts`
```typescript
export interface IMockDataSeederProps {
  isOpen: boolean;
  onDismiss: () => void;
  onPopulate: (fiscalYear: string, fiscalMonth: string) => void; // dialog hands FY/Month back; the page maps + loads
}
export interface IMockDataSeederFormValues {
  fiscalYear: string;   // 4-digit e.g. "2526"
  fiscalMonth: string;  // 2-digit zero-padded e.g. "03"
}
```

### 2.2 `MockDataSeeder.tsx` (Fluent UI only, no inline styles)
- Body: `TextField` "Fiscal Year" (placeholder `e.g. 2526`, maxLength 4); `Dropdown`
  "Fiscal Month" from `FISCAL_MONTHS`; info `MessageBar`
  ("Fills the form with 41 template transactions for the chosen period. Nothing is saved
   until you click Submit."); error `MessageBar` when `errorMessage` is set.
- Footer: `PrimaryButton` **"Populate Form"**, `DefaultButton` "Cancel".
- Validate on click via `validateMockDataForm()` (utils, not inline): FY `/^\d{4}$/`,
  Month selected. On pass: call `onPopulate(fy, month)` then dismiss. **No Spinner, no
  service call** — mapping is synchronous and in-memory.
- Follow `docs/CONVENTIONS.md` (guard clauses, `handle*` names).

### 2.3 Mapping + load (the core of Option A)
In RequestPA (or a small handler it owns):
1. Import bundled `mockTemplate.json`.
2. For every record run `transformReqNumbers(record, fy, month)` (rewrites FY/Month in
   `Title` and `TPMNo`; preserves `-TxNo` on `Title`, none on `TPMNo`).
3. Group `expenses` and `allocations` under their parent transaction by `Title`.
4. Convert to form state via the existing `mapRawDataToForm` path (+ adapter if check #3).
5. Call `useRequisitionForm.loadMockData(mappedTransactions)` to set state. Close dialog.
No POST anywhere in this flow.

### 2.4 `constants/mockData.ts` (trimmed)
```typescript
export const MOCK_TEMPLATE_SOURCE_PREFIX = 'DAPA1920-01';
export const FISCAL_MONTHS: IDropdownOption[] = [
  { key: '01', text: '01 — September' }, { key: '02', text: '02 — October'  },
  { key: '03', text: '03 — November'  }, { key: '04', text: '04 — December' },
  { key: '05', text: '05 — January'   }, { key: '06', text: '06 — February' },
  { key: '07', text: '07 — March'     }, { key: '08', text: '08 — April'    },
  { key: '09', text: '09 — May'       }, { key: '10', text: '10 — June'     },
  { key: '11', text: '11 — July'      }, { key: '12', text: '12 — August'   },
];
```
> POST-only constants (`SP_MANAGED_FIELDS`, `SP_LIST_GUID_*`) are not needed by the
> form-fill path. Remove them unless the mapping adapter requires a GUID.

### 2.5 `RequestPA.tsx` — targeted changes
Read the full file first. Add: dev gate `process.env.NODE_ENV !== 'production'`;
`useState` for dialog open; `DefaultButton` "Seed Mock Data" in a `devToolbar`
(`RequestPA.module.scss`, no inline styles); render `<MockDataSeeder onPopulate={...}>`;
the `onPopulate` handler does steps 2.3.1–2.3.5. If RequestPA passes ~150 lines, split and
explain what moved.

---

## Timing the test (how the dev uses this)
1. Run `npm run start` (Heft dev server); open RequestPA in the Workbench (dev build).
2. Click **Seed Mock Data** → enter a FY/Month not already in SharePoint → **Populate Form**.
3. Confirm all 41 transactions render in the form.
4. Click the form's **real Submit** and measure end-to-end (Network tab / `performance.now()`).
   This is the user-experience number you want.

---

## Business Rules Compliance

| Rule | How respected |
|------|---------------|
| BR-01 | `buildReqNumber()` rebuilds numbers from validated parts |
| BR-02 | Fiscal Month dropdown labels clarify Sept = 01 |
| BR-03 | CBU allocations cloned verbatim — already total 100% |
| BR-08 | No RFPs created; the seeder only fills the form |

---

## Acceptance Criteria
- [ ] Button NOT rendered when `process.env.NODE_ENV === 'production'`.
- [ ] Dialog has Fiscal Year field + Fiscal Month dropdown; "Populate Form" / "Cancel".
- [ ] Invalid FY (not 4 digits) or no month → inline error; form is NOT populated.
- [ ] On confirm, the form is filled with all 41 transactions (with their expenses +
      allocations), FY/Month rewritten in every e-Req number.
- [ ] **The seeder performs ZERO SharePoint writes.** (Verify Network tab: no POST on Populate.)
- [ ] Clicking the form's existing Submit triggers the normal `RequisitionService` path and
      posts the loaded data (this is the timed action).
- [ ] No inline styles anywhere; ESLint clean; strict TS (no `any`, no unjustified `!`).
- [ ] `MockDataService` POST logic removed (file deleted or repurposed to mapping only).

---

## Open Questions — resolve by reading code (see "MUST verify" above)

| Question | Resolve by |
|----------|-----------|
| Is RequestPA genuinely multi-transaction (`IRequisitionTransaction[]`)? | Read RequestPA + useRequisitionForm state |
| Does bundle row shape match `mapRawDataToForm` input? | Compare bundle vs `RequisitionService` return shape |
| Extend existing load path or add `loadMockData`? | Read `loadRequisition` in useRequisitionForm |
| Are Channel/FY/Month form-header fields the seeder must set? | Read form header + Submit |
| Does Submit generate or consume the e-Req number? | Read `RequisitionService` submit |

---

## Execution Order
1. Do the five "MUST verify" reads; report findings before writing code.
2. Trim `constants/mockData.ts`; remove POST-only constants.
3. Add `loadMockData` to `useRequisitionForm` (surgical).
4. Build `MockDataSeeder/` (types → scss → tsx → index) — no service, no POST.
5. Write the `onPopulate` map+load handler in RequestPA; wire the button/dialog.
6. Remove/repurpose `MockDataService`.
7. ESLint + `tsc --noEmit`; fix all issues. Manual Workbench run to confirm populate + time Submit.