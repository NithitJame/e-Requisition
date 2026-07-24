# fetchExpenseTypeMap.py
# ---------------------------------------------------------------------------
# DEV-TIME helper script (NOT part of the SPFx bundle). Read-only against
# SharePoint Online. App-only auth via docs/azure_key.txt (Graph, same as
# fetchMockTemplate.py — secret-based Entra token works on Graph, not SP REST).
#
# Purpose: resolve the integer lookup ids carried in mockData/mockTemplate.json
# back to their Description text, so the Phase 2 adapter (Option 3b) can map
# bundle ExpenseTypeId -> 'TI'/'TD' with a verified static constant instead of
# guessing. Also dumps M_Category for cross-checking CATEGORY_TEXT.
#
# Read-only: GETs M_ExpenseType and M_Category items and prints id -> Description.
# Writes nothing to SharePoint. Optional JSON dump under data/ for the record.
#
#     pip install msal requests
# ---------------------------------------------------------------------------

import os
import json
import requests
import msal

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_CANDIDATES = [
    os.path.join(SCRIPT_DIR, "..", "docs", "azure_key.txt"),
    os.path.join(SCRIPT_DIR, "..", "SPO-eRequisitionWebPart-Demo", "docs", "azure_key.txt"),
]
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
LIST_GUID_EXPENSE_TYPE = "f334e309-440f-4eac-b647-1d8a6dfba21a"  # M_ExpenseType (list_ids.txt)
LIST_GUID_CATEGORY = "fa9a0674-c066-4f8d-bf84-729d33aaab87"      # M_Category   (list_ids.txt)
PAGE_SIZE = 200
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "data", "lookupMaps.json")


def resolve_key_path():
    for candidate in KEY_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    raise FileNotFoundError(
        "azure_key.txt not found. Tried:\n  " + "\n  ".join(os.path.abspath(c) for c in KEY_CANDIDATES)
    )


def load_creds(path):
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
        raise RuntimeError("Graph token failed: " + result.get("error_description", result.get("error", "?")))
    return result["access_token"]


def get_site_id(headers, site_url):
    host = site_url.split("//")[1].split("/")[0]
    site_path = "/" + site_url.split(host)[1].lstrip("/")
    resp = requests.get(GRAPH_BASE + "/sites/" + host + ":" + site_path, headers=headers)
    resp.raise_for_status()
    return resp.json()["id"]


def fetch_id_description(headers, site_id, list_guid):
    url = (
        GRAPH_BASE + "/sites/" + site_id + "/lists/" + list_guid
        + "/items?expand=fields&$top=" + str(PAGE_SIZE)
    )
    rows = []
    while url:
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError("GET failed (HTTP %s): %s" % (resp.status_code, resp.text[:500]))
        payload = resp.json()
        for item in payload.get("value", []):
            fields = item.get("fields", {})
            rows.append({"id": item.get("id"), "Title": fields.get("Title"), "Description": fields.get("Description")})
        url = payload.get("@odata.nextLink")
    return rows


def main():
    creds = load_creds(resolve_key_path())
    site_url = creds["Site URL"].rstrip("/")
    token = acquire_graph_token(creds)
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    site_id = get_site_id(headers, site_url)

    expense_types = fetch_id_description(headers, site_id, LIST_GUID_EXPENSE_TYPE)
    categories = fetch_id_description(headers, site_id, LIST_GUID_CATEGORY)

    print("\n=== M_ExpenseType (id -> Title / Description) ===")
    for r in expense_types:
        print("  %s -> Title=%r Description=%r" % (r["id"], r["Title"], r["Description"]))
    print("\n=== M_Category (id -> Title / Description) ===")
    for r in categories:
        print("  %s -> Title=%r Description=%r" % (r["id"], r["Title"], r["Description"]))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"M_ExpenseType": expense_types, "M_Category": categories}, f, indent=2, ensure_ascii=False)
    print("\nwritten to %s" % os.path.abspath(OUTPUT_PATH))


if __name__ == "__main__":
    main()
