// Generic SharePoint REST paging helper. Pulls every item across pages by following the
// OData next-page link. Extracted here so multiple services share one implementation
// (see PromotionActivityService / ApprovalService) instead of duplicating the loop.

import axios from 'axios';

import api, { getSiteUrl } from '@/shared/services/api';
import { ISharePointItem } from '@/shared/types';

interface IListItemsResponse {
  value?: ISharePointItem[];
  // SharePoint REST has been observed returning either spelling depending on metadata mode /
  // tenant config; checking both avoids silently truncating to the first page.
  '@odata.nextLink'?: string;
  'odata.nextLink'?: string;
}

/**
 * Fetches every item of a list across all pages. Throws if any page request fails.
 * @param query the OData query string WITHOUT the leading `?` (e.g. `$select=...&$top=5000`).
 */
export async function fetchAllListItems(listName: string, query: string): Promise<ISharePointItem[]> {
  let items: ISharePointItem[] = [];
  let nextUrl: string | undefined = `${getSiteUrl()}/_api/web/lists/GetByTitle('${listName}')/items${
    query ? `?${query}` : ''
  }`;

  while (nextUrl) {
    let data: IListItemsResponse;
    try {
      const response = await api.get<IListItemsResponse>(nextUrl);
      data = response.data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      throw new Error(`Error while fetching list items from '${listName}' (HTTP ${status ?? 'unknown'}).`);
    }
    if (data.value) items = items.concat(data.value);
    nextUrl = data['@odata.nextLink'] ?? data['odata.nextLink'];
  }

  return items;
}
