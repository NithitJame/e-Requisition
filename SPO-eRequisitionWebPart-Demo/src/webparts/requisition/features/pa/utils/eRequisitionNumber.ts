// Pure helpers for building/parsing the e-Requisition number.
// Format: [Channel][Type][FY]-[MM]-[TxNo], e.g. 7EPA2526-01-1 (see docs/REQUIREMENTS.md §3, BR-01).

import { FISCAL_MONTH_OPTIONS, PA_TYPE_CODE } from '@/features/pa/constants';
import { IOption } from '@/features/pa/types';

interface IBuildERequisitionNoArgs {
  /** Selected channel; its `value` is the Nickname short code (e.g. "7E") from M_CustomerSubGroup
   * (see shared/services/ChannelService.ts), embedded directly — no separate short-code map. */
  channel: IOption | null;
  /** Selected fiscal year; its `value` is the FY code (e.g. "2526"). */
  fiscalYear: IOption | null;
  /** Selected promotion month; its `value` is the month label (e.g. "September"). */
  promotionMonth: IOption | null;
  /** Number of transactions, appended as the trailing TxNo segment. */
  transactionCount: number;
}

/** Builds the e-Requisition number from the current header selections. */
export function buildERequisitionNo(args: IBuildERequisitionNoArgs): string {
  const { channel, fiscalYear, promotionMonth, transactionCount } = args;
  let result = '';

  if (channel) result += `${channel.value}${PA_TYPE_CODE}`;
  if (fiscalYear) result += `${fiscalYear.value}-`;
  if (promotionMonth) {
    const month = FISCAL_MONTH_OPTIONS.find((option) => option.label === promotionMonth.value);
    if (month) result += `${month.value}-`;
  }
  if (channel && fiscalYear && promotionMonth) result += transactionCount;

  return result;
}

/**
 * Builds the TPM number — the e-Requisition prefix shared by every transaction in a
 * month: `[Channel nickname][PA][FY]-[MM]`, e.g. "DAPA2526-12". Returns "" until
 * channel, fiscal year and promotion month are all set. A transaction's unique Title
 * is this value plus its transaction number (e.g. "DAPA2526-12-1").
 */
export function buildTpmNo(args: {
  channel: IOption | null;
  fiscalYear: IOption | null;
  promotionMonth: IOption | null;
}): string {
  const { channel, fiscalYear, promotionMonth } = args;
  if (!channel || !fiscalYear || !promotionMonth) return '';

  const month = FISCAL_MONTH_OPTIONS.find((option) => option.label === promotionMonth.value);
  if (!month) return '';

  return `${channel.value}${PA_TYPE_CODE}${fiscalYear.value}-${month.value}`;
}

/**
 * Recovers the full channel name from a TPM number (e.g. "7EPA1819-01" -> "7-ELEVEN"), by
 * matching the embedded Nickname short code against the live Channel options
 * (value = Nickname, label = Description; see shared/services/ChannelService.ts).
 */
export function channelCodeFromTPMNo(tpmNo: string, channelOptions: IOption[]): string | null {
  const typeIndex = tpmNo.indexOf(PA_TYPE_CODE);
  if (typeIndex <= 0) return null;
  const short = tpmNo.substring(0, typeIndex);
  const match = channelOptions.find((option) => option.value === short);
  return match ? String(match.label) : null;
}

/** Recovers the month label from a TPM number (e.g. "7EPA1819-01" -> "September"). */
export function monthLabelFromTPMNo(tpmNo: string): string | null {
  const match = tpmNo.match(/PA\d{4}-(\d{2})/);
  if (!match) return null;
  const month = FISCAL_MONTH_OPTIONS.find((option) => option.value === match[1]);
  return month ? month.label : null;
}
