# fetchLookupMaps.py
# ---------------------------------------------------------------------------
# DEV-TIME helper (NOT in the SPFx bundle). Read-only against SharePoint Online,
# app-only via Graph (same auth as fetchMockTemplate.py).
#
# Resolves the display-only lookup ids carried in mockData/mockTemplate.json
# (PromotionTypeId, Account_x0020_NameId, MajorGroupNameId) to their Description,
# so the Phase-2 adapter can populate those dropdowns. Writes nothing to SharePoint.
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
PAGE_SIZE = 200
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "data", "displayLookupMaps.json")

# Live list GUIDs from docs/sharepoint_online/list_schema/list_ids.txt.
LISTS = {
    "M_PromotionType": "91aba696-8b4b-4297-a4cc-63d8cb37c658",
    "M_AccountName": "ae27f821-4b97-4f56-8af9-3b4c87ea82be",
    "M_MajorGroupName": "d7fcf299-bebe-477d-be75-9d7df21d7294",
    "M_MajorName": "02c79a0e-d6ae-4f0e-afea-766b433cefb8",
}


def load_creds(path):
    raw = open(path, encoding="utf-8").read()
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return {str(k).strip(): str(v).strip() for k, v in parsed.items()}
    except json.JSONDecodeError:
        pass
    creds = {}
    for line in raw.splitlines():
        key, sep, val = line.partition(":")
        if sep:
            creds[key.strip()] = val.strip()
    return creds


def resolve_key_path():
    for c in KEY_CANDIDATES:
        if os.path.isfile(c):
            return c
    raise FileNotFoundError("azure_key.txt not found")


def acquire_token(creds):
    app = msal.ConfidentialClientApplication(
        client_id=creds["Client ID"],
        client_credential=creds["Client Secret"],
        authority="https://login.microsoftonline.com/" + creds["Tenant ID"],
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError("token failed: " + result.get("error_description", "?"))
    return result["access_token"]


def get_site_id(headers, site_url):
    host = site_url.split("//")[1].split("/")[0]
    site_path = "/" + site_url.split(host)[1].lstrip("/")
    r = requests.get(GRAPH_BASE + "/sites/" + host + ":" + site_path, headers=headers)
    r.raise_for_status()
    return r.json()["id"]


def fetch(headers, site_id, guid):
    url = GRAPH_BASE + "/sites/" + site_id + "/lists/" + guid + "/items?expand=fields&$top=" + str(PAGE_SIZE)
    rows = []
    while url:
        r = requests.get(url, headers=headers)
        if r.status_code != 200:
            raise RuntimeError("GET %s failed: %s %s" % (guid, r.status_code, r.text[:300]))
        payload = r.json()
        for item in payload.get("value", []):
            f = item.get("fields", {})
            if f.get("Title") or f.get("Description"):
                rows.append({"id": item.get("id"), "Title": f.get("Title"), "Description": f.get("Description")})
        url = payload.get("@odata.nextLink")
    return rows


def main():
    creds = load_creds(resolve_key_path())
    token = acquire_token(creds)
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    site_id = get_site_id(headers, creds["Site URL"].rstrip("/"))

    out = {}
    for name, guid in LISTS.items():
        rows = fetch(headers, site_id, guid)
        out[name] = rows
        print("\n=== %s (%d rows) ===" % (name, len(rows)))
        for r in rows:
            print("  %s -> Title=%r Description=%r" % (r["id"], r["Title"], r["Description"]))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("\nwritten to %s" % os.path.abspath(OUTPUT_PATH))


if __name__ == "__main__":
    main()
