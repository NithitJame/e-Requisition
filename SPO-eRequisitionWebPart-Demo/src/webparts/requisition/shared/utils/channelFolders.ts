// Shared helpers for organising SharePoint list items into Channel-named subfolders, matching
// how "Promotion Activities Detail/Expenses/Charge to CBU", "PA Documents", and
// "PA Workflow History" are structured in SharePoint. Used by RequisitionService (Save) and
// ApprovalService (Approve/Reject) — kept here (not private to one service) since both need it.

import api, { getSiteUrl } from '@/shared/services/api';

/** Server-relative URL of a list's root folder (the base every Channel subfolder sits under). */
export async function getListRootFolderUrl(listName: string): Promise<string> {
  const response = await api.get<{ ServerRelativeUrl?: string }>(
    `${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/RootFolder?$select=ServerRelativeUrl`,
  );
  const url = response.data.ServerRelativeUrl;
  if (!url) throw new Error(`ไม่พบตำแหน่งของ list "${listName}"`);
  return url;
}

/**
 * Server-relative URL of the Channel-named subfolder under a list's root, creating it first
 * if it doesn't exist yet (e.g. a brand-new Channel with no folder set up).
 *
 * `GetFolderByServerRelativeUrl` does NOT throw/404 for a missing folder — it returns HTTP 200
 * with `Exists: false` on the folder object. Relying on try/catch alone (as an earlier version of
 * this function did) means a missing folder is silently treated as "already there": no folder
 * gets created, and the item is later "moved" to a path that doesn't exist, which fails and is
 * swallowed by moveItemToFolder's own best-effort catch — the item just stays at the list root
 * with no visible error. So `Exists` must be checked explicitly.
 */
export async function ensureChannelFolder(
  listName: string,
  listRootUrl: string,
  channelName: string,
): Promise<string> {
  const folderUrl = `${listRootUrl}/${channelName}`;
  const safeFolderUrl = folderUrl.replace(/'/g, "''");

  try {
    const response = await api.get<{ Exists?: boolean }>(
      `${getSiteUrl()}/_api/web/GetFolderByServerRelativeUrl('${safeFolderUrl}')?$select=Exists`,
    );
    if (response.data.Exists) return folderUrl;
  } catch {
    // Assume "not found" and create it below.
  }

  const safeChannelName = channelName.replace(/'/g, "''");
  await api.post(
    `${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/RootFolder/Folders/add('${safeChannelName}')`,
    null,
  );
  return folderUrl;
}

/**
 * Resolves (and creates if missing) a list's Channel-named folder. Returns undefined on any
 * failure so the caller can fall back to "no folder" (item stays at the list root) instead of
 * failing the whole save/approve operation over a folder-organisation nicety.
 */
export async function resolveChannelFolder(listName: string, channelName: string): Promise<string | undefined> {
  if (!channelName) return undefined;
  try {
    const rootUrl = await getListRootFolderUrl(listName);
    return await ensureChannelFolder(listName, rootUrl, channelName);
  } catch (error) {
    console.error(`[channelFolders] could not resolve Channel folder for "${listName}".`, error);
    return undefined;
  }
}

/**
 * Moves a just-created LIST ITEM (not a document library file — see uploadOneAttachment for
 * that case, which can target the folder directly on upload) into a target folder. Best-effort:
 * the item's field data is already saved correctly by the time this runs, so a failure here is
 * logged and swallowed rather than failing the caller — the item just stays at the list root.
 */
export async function moveItemToFolder(listName: string, itemId: number, targetFolderUrl: string): Promise<void> {
  try {
    const itemResponse = await api.get<{ FileRef?: string; FileLeafRef?: string }>(
      `${getSiteUrl()}/_api/web/lists/getbytitle('${listName}')/items(${itemId})?$select=FileRef,FileLeafRef`,
    );
    const currentUrl = itemResponse.data.FileRef;
    const fileName = itemResponse.data.FileLeafRef;
    if (!currentUrl || !fileName) return;

    const newUrl = `${targetFolderUrl}/${fileName}`;
    if (currentUrl === newUrl) return;

    await api.post(
      `${getSiteUrl()}/_api/web/GetFileByServerRelativeUrl('${currentUrl.replace(/'/g, "''")}')` +
        `/moveto(newurl='${newUrl.replace(/'/g, "''")}',flags=1)`,
      null,
    );
  } catch (error) {
    console.error(`[channelFolders] failed to move item ${itemId} in "${listName}" into its Channel folder.`, error);
  }
}
