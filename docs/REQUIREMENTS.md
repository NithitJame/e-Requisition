# ABF e-Requisition — System Requirements

> **Version:** 1.1
> **Last Updated:** 2026-06-22
> **Status:** Draft — pending review against full BRD. PA create/edit (Save Draft, Submit,
> validation, existing-promotion detection) implemented in RequestPA; see CLAUDE.md
> "Implemented Features".

---

## 1. System Overview

ABF e-Requisition is a trade promotion management system for **AB Foods Thailand** sales representatives. It enables sales teams to create, approve, and pay out promotion activity requests tied to key retail channel customers across Thailand.

**Primary Users:**
- Sales Representatives — create and manage requests and payments
- Approvers / Managers — approve requests and payments that exceed thresholds
- Finance Team — upload SE numbers and match payments to invoices

**Supported Channels (Retail Customers):**

| Nickname | Channel Name     |
|----------|-----------------|
| 7E       | 7-ELEVEN         |
| MK       | MAKRO            |
| BC       | BIG C            |
| TL       | TESCO LOTUS      |
| *(others to be confirmed)* | |

---

## 2. Request Types

| Type | Code | Description |
|------|------|-------------|
| Promotion Activity | PA | Direct promotion request created by sales |
| Trade Agreement    | TA | Promotion derived from a trade agreement |

Both types result in a **Promotion Activity** entry in the system. They share the same downstream process (expenses, payments, SE matching) but have different upstream creation workflows.

---

## 3. e-Requisition Number Format

```
[Channel][Type][FiscalYear]-[FiscalMonth]-[TransactionNo]
```

**Example:** `7EPA2526-01-1`

| Segment       | Value   | Meaning                                          |
|---------------|---------|--------------------------------------------------|
| `7E`          | Channel | 7-ELEVEN (2-character channel nickname)          |
| `PA`          | Type    | Promotion Activity (or `TA` for Trade Agreement)|
| `2526`        | FY      | Fiscal Year 2025–2026                            |
| `01`          | Month   | Fiscal Month 01 (September = Month 1)            |
| `1`           | TxNo    | Transaction number within the fiscal month       |

**Fiscal Year Rule:** The fiscal year starts in **September**. September = Month 01, October = Month 02, etc.

**SharePoint storage (how this maps to the lists):**

| Field | Value | Scope |
|-------|-------|-------|
| `Title` (Promotion Activities Detail) | full number incl. TxNo, e.g. `7EPA2526-01-1` | **unique per transaction** |
| `TPMNo` | prefix only, e.g. `7EPA2526-01` | **shared** by all transactions in the channel/month |

Expense and Charge-to-CBU child rows carry their **parent's full `Title`** plus the shared
`TPMNo`, and are joined back to the parent transaction **by `Title`**.

---

## 4. Transaction Structure

Each e-Requisition is a **transaction**. A sales rep may create more than one transaction per fiscal month per channel.

### 4.1 Expenses

Each transaction contains **one or more expenses**.

| Field            | Description                                                             |
|------------------|-------------------------------------------------------------------------|
| Expense Type     | E.g., MAIL FEE, Unconditional Rebate *(full list TBC)*                 |
| Committed Value  | Estimated expense amount committed by the sales rep at submission      |
| Adjust Value     | Revised committed value entered after initial approval; shows previous value for reference |

### 4.2 Charge to CBU (Allocation)

Each transaction must define how the cost is allocated across **Cost Business Units (CBUs)**.

- Multiple CBU allocations are allowed per transaction (e.g., Base 3in1 20%, CL 20%, F3 50%)
- **Total allocation must equal 100%**
- CBU allocation is set at the **transaction level**, not the expense level

---

## 5. Workflow

### 5.1 PA Submission & Approval

```
Sales creates transaction
        ↓
Sales submits → Approval Workflow
        ↓
[Approved] → Sales may adjust Committed Value (Adjust field)
        ↓
Sales can initiate Payment (RFP)
```

### 5.2 Committed Value Adjustment

- Only allowed **after** the transaction is approved
- Sales enters a new value in the **Adjust** field
- The system retains and displays the **previous committed value** for reference to the approver

### 5.3 Payment (RFP — Request for Payment)

- Payments are based on the **Committed Value** or **Adjusted Value** (whichever is current)
- If a payment **exceeds** the committed/adjusted value → requires **additional approval**
- Each payment targets **one expense only** (one expense per RFP)
- Multiple payments are allowed per expense (e.g., 10 payments of 10,000 THB for a 100,000 THB MAIL FEE commitment)

**RFP Number Format:**
```
[e-Requisition Number]-[PaymentVersion]
```

| Example            | Meaning                              |
|--------------------|--------------------------------------|
| `7EPA2526-01-1-1`  | First payment on transaction 1       |
| `7EPA2526-01-1-2`  | Second payment on transaction 1      |

### 5.4 Receipt Validation

- Each payment must reference a **Receipt Number**
- Receipt master data contains: Receipt Number, Receipt Amount
- **Business Rule:** The total payments applied against a receipt must not exceed the receipt's total amount

### 5.5 SE Number Matching (Finance)

```
Finance team uploads SE Numbers (invoices)
        ↓
Finance matches RFPs to SE Numbers
        ↓
Once all RFPs in a match set are linked → Submit matching for approval
```

- SE Number = Invoice number from the finance/ERP system
- One SE Number may be matched to multiple RFPs (or TBC — to be confirmed)

---

## 6. Business Rules Summary

| # | Rule |
|---|------|
| BR-01 | e-Requisition number must follow the format `[CH][Type][FY]-[MM]-[N]` |
| BR-02 | Fiscal year starts in September (Month 01) |
| BR-03 | CBU allocation per transaction must total exactly 100% |
| BR-04 | Adjust Value can only be entered after the transaction is approved |
| BR-05 | Each RFP (payment) covers only one expense |
| BR-06 | Total payments per receipt must not exceed the receipt's registered amount |
| BR-07 | Payments exceeding the committed/adjusted value require additional approval |
| BR-08 | RFP number = e-Requisition number + `-[version]` suffix |
| BR-09 | SE Number matching must be submitted for approval before it is finalized |

> **Enforced today in RequestPA:** BR-01 (Title built from validated parts), BR-02 (fiscal
> month dropdown), and BR-03 (CBU total = 100%) are validated before Save Draft *and* Submit,
> along with all required (`*`) fields. BR-04–BR-09 concern the downstream payment/matching
> flow and are not yet implemented in this screen.

---

## 7. Open Questions / Items to Confirm

- [ ] Full list of valid **Expense Types** (MAIL FEE, Unconditional Rebate — others?)
- [ ] Full list of **Channel nicknames** beyond 7E
- [ ] Approval workflow — who approves? How many levels? Escalation rules?
- [ ] Can one SE Number be matched to multiple RFPs, or is it 1-to-1?
- [ ] Is the TA (Trade Agreement) creation process in scope for this system, or just the downstream PA result?
- [ ] What triggers the fiscal year boundary? Is it calendar September 1, or end of a business period?
- [ ] Role & permission matrix — which roles can view vs. edit vs. approve?
- [ ] Are there any reporting or dashboard requirements?

---

## 8. Out of Scope (Assumed)

- Source code implementation details
- ERP / SAP integration specifics (SE Number upload is manual for now)
- Mobile app (web only unless stated otherwise)

---

*This file is maintained in the ABF e-Requisition Claude Project knowledge base. Update it as requirements are clarified. Pass the finalized sections to Claude Code in VS Code via the project `docs/` folder.*