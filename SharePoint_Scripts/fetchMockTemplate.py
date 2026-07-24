# fetchMockTemplate.py
# ---------------------------------------------------------------------------
# DEV-TIME helper script (NOT part of the SPFx bundle). Read-only against
# SharePoint Online. App-only auth via docs/azure_key.txt.
#
# Install deps (script-only — never enters the webpart bundle):
#     pip install msal requests
#
# Phase 1 of TASK_mock_data_seeder.md. Implements STEP 1B (full fetch):
#   - Detail: page all items (no server-side filter; TPMNo is unindexed and the list
#     exceeds 5,000 items), keep those whose TPMNo == "DAPA1920-01" (exact).
#     Collect their Title set.
#   - Expenses + CBU: page all items, keep those whose Title is in the Detail Title set.
#   - Lookups are kept as integer ids (Graph returns "<Name>LookupId"); this script
#     normalizes them to the SharePoint REST POST convention "<Name>Id" so the bundled
#     template can be re-POSTed by the Phase 2 webpart without further mapping.
#       * single lookup  : "PromotionMonthLookupId":"9"            -> "PromotionMonthId": 9
#       * multi  lookup  : "Category":[{"LookupId":3,...}]         -> "CategoryId": [3]
#   - Writes SharePoint_Scripts/data/mockTemplate.json.
#
# Title carries the full e-Req number WITH the -TxNo suffix (e.g. "DAPA1920-01-1");
# TPMNo is the prefix only ("DAPA1920-01"), shared by every transaction in that month.
#
# AUTH NOTE (discovered at dev time): the Entra/Azure-AD app in azure_key.txt has a
# client SECRET, not a certificate. SharePoint's REST API rejects secret-based Entra
# app-only tokens ("Unsupported app only token"), and the legacy ACS app principal has
# no grant on this site (403). Microsoft Graph, however, accepts the secret-based
# app-only token and the app holds Sites.Read.All — so this script reads list items
# through Microsoft Graph rather than the SharePoint REST API.
# ---------------------------------------------------------------------------

import os
import sys
import json
from datetime import datetime, timezone
import requests
import msal

# --- Constants -------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# azure_key.txt lives in the project's docs/ folder (sibling of SharePoint_Scripts/).
# CLAUDE.md references ..\SPO-eRequisitionWebPart-Demo\docs\azure_key.txt; the real
# checkout is named differently, so probe a few candidate locations.
KEY_CANDIDATES = [
    os.path.join(SCRIPT_DIR, "..", "docs", "azure_key.txt"),
    os.path.join(SCRIPT_DIR, "..", "SPO-eRequisitionWebPart-Demo", "docs", "azure_key.txt"),
]

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
# List GUIDs (from list_ids.txt — never the SP2019 XML GUIDs).
LIST_GUID_DETAIL = "ef32f6d0-991c-4be5-9d03-83c2948d029b"
LIST_GUID_EXPENSE = "37775ba2-635d-49e7-ae84-fc3cc7d2a1ac"
LIST_GUID_CBU = "b5f28887-6136-4968-a1af-c96a29b969f6"
SOURCE_TPMNO = "DAPA1920-01"
PAGE_SIZE = 200  # Graph list-items max page size

OUTPUT_PATH = os.path.join(SCRIPT_DIR, "data", "mockTemplate.json")


def resolve_key_path():
    for candidate in KEY_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError(
        "azure_key.txt not found. Tried:\n  " + "\n  ".join(os.path.abspath(c) for c in KEY_CANDIDATES)
    )


def load_creds(path):
    # NOTE: CLAUDE.md/SHAREPOINT-SCRIPTS.md describe a "Label: Value" format, but the
    # actual file on disk is JSON with the same keys ("Tenant ID", etc.). Handle both:
    # try JSON first, fall back to "Label: Value" (split on the FIRST colon only — the
    # Site URL value itself contains "https://").
    raw = open(path, encoding="utf-8").read()
    creds = {}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            creds = {str(k).strip(): str(v).strip() for k, v in parsed.items()}
    except json.JSONDecodeError:
        for line in raw.splitlines():
            key, sep, val = line.partition(":")
            if sep:
                creds[key.strip()] = val.strip()
    required = ["Tenant ID", "Client ID", "Client Secret", "Site URL"]
    missing = [k for k in required if not creds.get(k)]
    if missing:
        raise ValueError("azure_key.txt missing keys: " + ", ".join(missing))
    return creds


def acquire_graph_token(creds):
    app = msal.ConfidentialClientApplication(
        client_id=creds["Client ID"],
        client_credential=creds["Client Secret"],
        authority="https://login.microsoftonline.com/" + creds["Tenant ID"],
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(
            "Graph token acquisition failed: "
            + result.get("error", "?")
            + " — "
            + result.get("error_description", "")
        )
    return result["access_token"]


def get_site_id(headers, site_url):
    host = site_url.split("//")[1].split("/")[0]
    site_path = "/" + site_url.split(host)[1].lstrip("/")
    resp = requests.get(GRAPH_BASE + "/sites/" + host + ":" + site_path, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError("Site lookup failed (HTTP %s): %s" % (resp.status_code, resp.text[:500]))
    return resp.json()["id"]


def normalize_fields(fields):
    # Convert Graph's field shape into the SharePoint REST POST convention, keeping
    # integer lookup ids (no expanded display objects):
    #   "<Name>LookupId": "9"               -> "<Name>Id": 9
    #   "<Name>": [{"LookupId": 3, ...}]    -> "<Name>Id": [3]   (multi-lookup)
    # All other (scalar) fields are kept verbatim. The "@odata.etag" key is dropped.
    out = {}
    for key, value in fields.items():
        if key == "@odata.etag":
            continue
        if isinstance(value, list):
            ids = [v.get("LookupId") for v in value if isinstance(v, dict) and "LookupId" in v]
            if ids and len(ids) == len(value):
                out[key + "Id"] = ids
            else:
                out[key] = value
        elif key.endswith("LookupId"):
            base = key[: -len("LookupId")]
            try:
                out[base + "Id"] = int(value)
            except (TypeError, ValueError):
                out[base + "Id"] = value
        else:
            out[key] = value
    return out


def fetch_all(headers, site_id, list_guid, keep):
    # Page through an entire list (no server-side filter — TPMNo/Title are unindexed and
    # these lists exceed 5,000 items). `keep(fields)` decides which items to retain.
    # Returns the normalized, retained records.
    url = (
        GRAPH_BASE
        + "/sites/" + site_id
        + "/lists/" + list_guid
        + "/items?expand=fields&$top=" + str(PAGE_SIZE)
    )
    scanned = 0
    kept = []
    page = 0
    while url:
        page += 1
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(
                "GET failed (HTTP %s) on page %s of list %s: %s"
                % (resp.status_code, page, list_guid, resp.text[:500])
            )
        payload = resp.json()
        for item in payload.get("value", []):
            scanned += 1
            fields = item.get("fields", {})
            if keep(fields):
                kept.append(normalize_fields(fields))
        url = payload.get("@odata.nextLink")
        print("    …scanned %d, kept %d so far" % (scanned, len(kept)))
    print("    done: scanned %d, kept %d" % (scanned, len(kept)))
    return kept


def main():
    key_path = resolve_key_path()
    print("Using credentials: %s" % os.path.abspath(key_path))
    creds = load_creds(key_path)
    site_url = creds["Site URL"].rstrip("/")
    print("Site URL: %s" % site_url)
    print("Acquiring app-only Graph token…")
    token = acquire_graph_token(creds)
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    print("Token acquired. Resolving site id…")
    site_id = get_site_id(headers, site_url)
    print("Site id: %s\n" % site_id)

    # 1) Detail — keep TPMNo == "DAPA1920-01" (exact); collect the Title set.
    print("Fetching Detail (TPMNo == %r)…" % SOURCE_TPMNO)
    transactions = fetch_all(
        headers, site_id, LIST_GUID_DETAIL,
        lambda f: f.get("TPMNo") == SOURCE_TPMNO,
    )
    title_set = {t.get("Title") for t in transactions if t.get("Title")}
    print("  Title set (%d): %s\n" % (len(title_set), sorted(title_set)))
    if not title_set:
        print("No Detail items matched — aborting before writing output.")
        sys.exit(2)

    # 2) Expenses — keep Title ∈ Detail Title set.
    print("Fetching Expenses (Title in Detail Title set)…")
    expenses = fetch_all(
        headers, site_id, LIST_GUID_EXPENSE,
        lambda f: f.get("Title") in title_set,
    )
    print()

    # 3) CBU allocations — keep Title ∈ Detail Title set.
    print("Fetching CBU allocations (Title in Detail Title set)…")
    allocations = fetch_all(
        headers, site_id, LIST_GUID_CBU,
        lambda f: f.get("Title") in title_set,
    )
    print()

    output = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "sourceTPMNo": SOURCE_TPMNO,
        "transactions": transactions,
        "expenses": expenses,
        "allocations": allocations,
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("=== STEP 1B COMPLETE ===")
    print("transactions : %d" % len(transactions))
    print("expenses     : %d" % len(expenses))
    print("allocations  : %d" % len(allocations))
    print("written to   : %s" % os.path.abspath(OUTPUT_PATH))


if __name__ == "__main__":
    main()
