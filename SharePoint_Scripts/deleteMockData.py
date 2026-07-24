# deleteMockData.py
# ===========================================================================
# ⚠️  DESTRUCTIVE DEV-TIME CLEANUP SCRIPT — DELETES SharePoint list items.
#
# This is an INTENTIONAL deviation from the read-only rule in CLAUDE.md /
# SHAREPOINT-SCRIPTS.md, created at the developer's explicit request to remove
# seeded mock e-Requisitions. It is NOT part of the SPFx bundle.
#
# What it does:
#   Given a channel nickname, fiscal year and fiscal month, it deletes every
#   item whose Title belongs to that e-Requisition (prefix [NN]PA[FY]-[MM]) from
#   all three lists: Promotion Activities Detail / Expenses / Charge to CBU.
#
#     python deleteMockData.py DA 2526 12
#       -> targets Title prefix "DAPA2526-12" (e.g. DAPA2526-12-1 ... -41)
#
# Safety:
#   * By default it PREVIEWS the matches and asks you to type DELETE to confirm.
#   * --dry-run  : preview only, never delete.
#   * --yes      : skip the confirmation prompt (use with care).
#   * --type TA  : target TA instead of PA (default PA).
#
# Auth: app-only via Microsoft Graph using docs/azure_key.txt (same as
# fetchMockTemplate.py). DELETE needs Sites.ReadWrite.All (or Sites.Manage.All)
# granted to the app; if the app only has Sites.Read.All the deletes return 403
# and the script reports it.
#
#     pip install msal requests
# ===========================================================================

import os
import sys
import argparse
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

# List GUIDs from docs/sharepoint_online/list_schema/list_ids.txt (live SPO ids).
LISTS = {
    "Promotion Activities Detail": "ef32f6d0-991c-4be5-9d03-83c2948d029b",
    "Promotion Activities Expenses": "37775ba2-635d-49e7-ae84-fc3cc7d2a1ac",
    "Promotion Activities Charge to CBU": "b5f28887-6136-4968-a1af-c96a29b969f6",
}


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
        raise RuntimeError(
            "Graph token acquisition failed: "
            + result.get("error", "?")
            + " - "
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


def build_prefix(channel, req_type, fy, month):
    return "%sPA%s-%s" % (channel, fy, month) if req_type == "PA" else "%sTA%s-%s" % (channel, fy, month)


def title_matches(title, prefix):
    # Match the exact e-Requisition (prefix) and all its -TxNo children, but not a
    # different month that merely shares leading characters.
    if not isinstance(title, str):
        return False
    return title == prefix or title.startswith(prefix + "-")


def find_matches(headers, site_id, list_guid, prefix):
    url = (
        GRAPH_BASE
        + "/sites/" + site_id
        + "/lists/" + list_guid
        + "/items?expand=fields&$top=" + str(PAGE_SIZE)
    )
    matches = []
    scanned = 0
    while url:
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError("GET failed (HTTP %s): %s" % (resp.status_code, resp.text[:500]))
        payload = resp.json()
        for item in payload.get("value", []):
            scanned += 1
            title = item.get("fields", {}).get("Title")
            if title_matches(title, prefix):
                matches.append({"id": item.get("id"), "title": title})
        url = payload.get("@odata.nextLink")
    return matches, scanned


def delete_item(headers, site_id, list_guid, item_id):
    url = GRAPH_BASE + "/sites/" + site_id + "/lists/" + list_guid + "/items/" + str(item_id)
    resp = requests.delete(url, headers={**headers, "if-match": "*"})
    return resp.status_code, resp.text


def main():
    parser = argparse.ArgumentParser(
        description="Delete seeded mock e-Requisition items from the three Promotion Activities lists."
    )
    parser.add_argument("channel", help="Channel nickname used in the e-Req number, e.g. DA, 7E, BC")
    parser.add_argument("fiscal_year", help="4-digit fiscal year, e.g. 2526")
    parser.add_argument("fiscal_month", help="Fiscal month 1-12 (zero-padded automatically), e.g. 12")
    parser.add_argument("--type", dest="req_type", choices=["PA", "TA"], default="PA", help="Request type (default PA)")
    parser.add_argument("--dry-run", action="store_true", help="Preview matches only; never delete")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    args = parser.parse_args()

    channel = args.channel.strip().upper()
    fy = args.fiscal_year.strip()
    if not (fy.isdigit() and len(fy) == 4):
        sys.exit("Fiscal year must be exactly 4 digits, e.g. 2526.")
    if not args.fiscal_month.strip().isdigit() or not (1 <= int(args.fiscal_month) <= 12):
        sys.exit("Fiscal month must be a number 1-12.")
    month = "%02d" % int(args.fiscal_month)

    prefix = build_prefix(channel, args.req_type, fy, month)
    print("Target Title prefix: %r  (matches %r and its -TxNo children)\n" % (prefix, prefix))

    creds = load_creds(resolve_key_path())
    token = acquire_graph_token(creds)
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    site_id = get_site_id(headers, creds["Site URL"].rstrip("/"))

    # 1) Scan all three lists for matches.
    found = {}
    total = 0
    for list_name, guid in LISTS.items():
        print("Scanning %s ..." % list_name)
        matches, scanned = find_matches(headers, site_id, guid, prefix)
        found[list_name] = (guid, matches)
        total += len(matches)
        sample = ", ".join(sorted({m["title"] for m in matches})[:3])
        print("  scanned %d, matched %d%s" % (scanned, len(matches), ("  e.g. " + sample) if sample else ""))

    print("\nTotal items matching %r: %d" % (prefix, total))
    if total == 0:
        print("Nothing to delete.")
        return

    if args.dry_run:
        print("\n--dry-run: no items deleted.")
        return

    # 2) Confirm.
    if not args.yes:
        answer = input('\nType "DELETE" to permanently remove these %d items: ' % total)
        if answer.strip() != "DELETE":
            print("Aborted. Nothing was deleted.")
            return

    # 3) Delete.
    deleted = 0
    failed = 0
    for list_name, (guid, matches) in found.items():
        for m in matches:
            status, text = delete_item(headers, site_id, guid, m["id"])
            if status in (200, 204):
                deleted += 1
            else:
                failed += 1
                print("  FAILED %s id=%s (HTTP %s): %s" % (list_name, m["id"], status, text[:200]))
                if status in (401, 403):
                    print("  -> The app likely lacks Sites.ReadWrite.All / Sites.Manage.All. Stopping.")
                    print("\nDeleted %d, failed %d before stopping." % (deleted, failed))
                    return

    print("\nDone. Deleted %d, failed %d." % (deleted, failed))


if __name__ == "__main__":
    main()
