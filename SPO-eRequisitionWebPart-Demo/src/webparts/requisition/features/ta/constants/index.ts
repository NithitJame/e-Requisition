// Trade Agreement list-set. TA records live in their own list family (see docs list_ids.txt);
// TA Detail mirrors Promotion Activities Detail but has no `…Adjust` columns.

export const TA_LISTS = {
  DETAIL: 'TA Detail',
  // Channel/Category masters are shared with PA.
  CHANNEL_MASTER: 'M_CustomerSubGroup',
  CATEGORY_MASTER: 'M_Category',
} as const;
