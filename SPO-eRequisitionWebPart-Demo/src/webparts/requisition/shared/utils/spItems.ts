// Generic SharePoint REST paging helper. Pulls every item across pages by following the
// OData `@odata.nextLink`. Extracted here so multiple services share one implementation
// (see PromotionActivityService / ApprovalService) instead of duplicating the loop.

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

import { ISharePointItem } from '@/shared/types';

/**
 * Fetches every item of a list across all pages. Throws if any page request fails.
 * @param query the OData query string WITHOUT the leading `?` (e.g. `$select=...&$top=5000`).
 */
export async function fetchAllListItems(
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listName: string,
  query: string,
): Promise<ISharePointItem[]> {
  let items: ISharePointItem[] = [];
  let nextUrl: string | undefined = `${siteUrl}/_api/web/lists/GetByTitle('${listName}')/items${
    query ? `?${query}` : ''
  }`;

  while (nextUrl) {
    const response: SPHttpClientResponse = await spHttpClient.get(
      nextUrl,
      SPHttpClient.configurations.v1,
    );
    if (!response.ok) {
      throw new Error(`Error while fetching list items from '${listName}' (HTTP ${response.status}).`);
    }
    const json = await response.json();
    if (json.value) items = items.concat(json.value);
    nextUrl = json['@odata.nextLink'];
  }

  return items;
}
