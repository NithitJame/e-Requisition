# SHAREPOINT-SCRIPTS.md — Helper Script Specification

> Referenced from CLAUDE.md. Read before writing any script that talks to SharePoint Online.
> These scripts are a DEV-TIME tool for the agent to retrieve (and, by explicit request, clean
> up) schema or item data. They are NOT part of the SPFx webpart and never ship in the bundle.

## Webpart code vs. helper scripts — never mix them

| Context | Auth | Lives in | Uses azure_key? |
|---|---|---|---|
| SPFx webpart (`src/`) | `context.spHttpClient` (browser session) | `SPO-eRequisitionWebPart-Demo/` | ❌ Never |
| Helper script | App-only via **Microsoft Graph** (`msal`) | `SharePoint_Scripts/` (repo root) | ✅ Yes |

## Where scripts live

Helper scripts live at the **repository root** in `SharePoint_Scripts/` — a sibling of the SPFx
project folder, and **tracked in git** (including `data/`):

```
SharePoint_Scripts/
├── fetchMockTemplate.py      # Phase 1: full mock e-Requisition template (TPMNo DAPA1920-01)
├── fetchExpenseTypeMap.py    # M_ExpenseType / M_Category : id -> Description
├── fetchLookupMaps.py        # M_PromotionType / M_AccountName / M_MajorGroupName : id -> Description
├── deleteMockData.py         # DESTRUCTIVE: delete seeded items by Title prefix (guarded)
└── data/                     # retrieved JSON output (committed)
    ├── mockTemplate.json
    ├── lookupMaps.json
    ├── displayLookupMaps.json
    └── majorGroupCategory.json
```

Rules:
- Python (`.py`) or Node.js (`.js`/`.ts`) — your choice per task. The existing scripts are Python.
- One script = one job. Single-purpose.
- **Read-only against SharePoint by default** — never write, update, or delete SP data
  **unless the user explicitly authorizes a destructive tool** (see `deleteMockData.py` below).
- Scripts may WRITE only to local files under `SharePoint_Scripts/` (e.g. `data/`).
- You MAY create extra subfolders under `SharePoint_Scripts/` to organize output.

## Destructive scripts — explicit authorization only

`deleteMockData.py` deletes Detail/Expenses/CBU items whose Title matches `[NN]PA[FY]-[MM]`
(e.g. `python deleteMockData.py DA 2526 12` → prefix `DAPA2526-12`). It exists because the user
explicitly asked for a cleanup tool. Any destructive script MUST:
- be created only on explicit user request;
- default to a **dry-run / preview** and require a typed confirmation (`--yes` to skip);
- print the exact items it will affect before acting.

## Read local schema first

Before writing a schema-inspection script, check the migrated schema already on disk:

```
docs/sharepoint_online/list_schema/Schema__sites_requisition_{LIST}.xml
docs/sharepoint_online/list_schema/list_ids.txt
```

- `Name` on `<Field>` = internal name for `$select`/`$filter`/POST.
- GUIDs inside the XML are **SP2019 IDs — never use them**; use `list_ids.txt`.
- Only write a schema script if the answer is genuinely not in the XML (a list that
  wasn't exported, content types, lookup `id -> Description` maps, or live/fresh values).

## Auth reality — use Microsoft Graph, not SharePoint REST

The Entra app in `azure_key.*` uses a client **secret**, not a certificate. SharePoint's REST
app-only endpoint rejects secret-based tokens ("Unsupported app only token"), and the legacy ACS
principal has no grant. **Microsoft Graph accepts the secret-based app-only token** and the app
holds `Sites.Read.All`, so all read scripts go through Graph:

```
GET https://graph.microsoft.com/v1.0/sites/{host}:{path}                  # resolve site id
GET https://graph.microsoft.com/v1.0/sites/{site-id}/lists/{guid}/items?expand=fields&$top=200
```

- Graph returns lookups as `<Name>LookupId`; multi-lookups as `[{LookupId, ...}]`.
- **Deleting** items needs write access: granted via **`Sites.Selected` + a full-control
  permission grant** on the site. `deleteMockData.py` then calls
  `DELETE /sites/{site-id}/lists/{guid}/items/{item-id}`.

| Language | Auth | Notes |
|----------|------|-------|
| Python   | `msal` + `requests` | what the existing scripts use |
| Node.js  | `@azure/msal-node` | if a JS script is ever needed |

Put the install command (`pip install msal requests`) in a comment at the top of every script.
These libraries are for `SharePoint_Scripts/` ONLY — never the webpart.

## Credentials — `docs/azure_key.*` (two formats, both gitignored)

Two credential files exist; **never commit either** (both are in the root `.gitignore`):
- `docs/azure_key.txt` — `Label: Value` format.
- `docs/azure_key.json` — the same values as JSON.

From a script in `SharePoint_Scripts/`, the path is `../docs/azure_key.txt`. The existing scripts
probe both that and a legacy `../SPO-eRequisitionWebPart-Demo/docs/azure_key.txt`, and accept
either format. Keys (with spaces): `Tenant ID`, `Client ID`, `Client Secret`, `Site URL`.

```python
import json

def load_creds(path):
    raw = open(path, encoding="utf-8").read()
    try:                                  # try JSON first
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k).strip(): str(v).strip() for k, v in parsed.items()}
    except json.JSONDecodeError:
        pass
    creds = {}                            # fall back to "Label: Value" (split on FIRST colon)
    for line in raw.splitlines():
        key, sep, val = line.partition(":")
        if sep:
            creds[key.strip()] = val.strip()
    return creds
# creds["Tenant ID"], creds["Client ID"], creds["Client Secret"], creds["Site URL"]
```

- Never hardcode any value — parse at runtime.

## Threshold caveat on large lists

Promotion Activities lists exceed 5,000 items (Detail ~9.9k, Expenses ~11.5k, CBU ~22k)
and `TPMNo`/`Title` are unindexed. A server-side `$filter` on an unindexed column throws
a threshold error regardless of match count. Scripts must **page through all items**
(`$top` + `@odata.nextLink`) and filter in code.

## Output

- Print a short human summary to stdout AND write the full result as pretty JSON
  (`indent=2`, `ensure_ascii=False`) to `SharePoint_Scripts/data/{name}.json`.

## After running a script

Tell the user: how to run it (command + prerequisites), what the output contains, and
which fields from the output matter for the current task.
