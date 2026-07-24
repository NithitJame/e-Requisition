// Pure helpers for the Mock Data Seeder (TASK_mock_data_seeder.md §2.3).
// No side effects, no SharePoint calls.
//
// These operate on the raw e-Requisition number STRING:
//   [Channel][Type][FY]-[MM]-[TxNo]   e.g. "DAPA2526-03-1"
// (Channel = 2-char nickname, Type = "PA" | "TA", FY = 4 digits, MM = 2 digits.)
//
// This complements utils/eRequisitionNumber.ts, which builds the number from the
// form's IOption selections and maps channel/month via option lists. Keep the
// option-list logic there; keep raw-string parse/build/transform here.

import { IReqNumberParts, IMockDataSeederFormValues } from '@/features/pa/types';

// Matches "[Channel][Type][FY]-[MM]" with an optional trailing "-[TxNo]".
// Groups: 1 channel (2 chars), 2 type (PA|TA), 3 FY (4 digits), 4 MM (2 digits), 5 TxNo (optional).
const RE_REQ_NUMBER = /^([A-Z0-9]{2})(PA|TA)(\d{4})-(\d{2})(?:-(\d+))?$/;

const RE_FISCAL_YEAR = /^\d{4}$/;

/**
 * Parses an e-Req number into parts. Returns null if the format does not match.
 * Example: "DAPA1920-01-1" -> { channel:"DA", type:"PA", fy:"1920", month:"01", txNo:"1" }
 * A number without a TxNo segment (e.g. "DAPA1920-01") yields txNo: "".
 */
export function parseReqNumber(reqNo: string): IReqNumberParts | null {
  const match = RE_REQ_NUMBER.exec(reqNo);
  if (!match) return null;

  return {
    channel: match[1],
    type: match[2],
    fy: match[3],
    month: match[4],
    txNo: match[5] ?? '',
  };
}

/**
 * Rebuilds an e-Req number from parts. Omits the trailing "-TxNo" when txNo is empty.
 * Example: { channel:"DA", type:"PA", fy:"2526", month:"03", txNo:"1" } -> "DAPA2526-03-1"
 */
export function buildReqNumber(parts: IReqNumberParts): string {
  const base = `${parts.channel}${parts.type}${parts.fy}-${parts.month}`;
  return parts.txNo ? `${base}-${parts.txNo}` : base;
}

/**
 * Returns a NEW object with FY and Month replaced in every string field whose
 * value parses as an e-Req number (Title, TPMNo, and any other matching field).
 * Channel, Type, and TxNo are preserved. Non-string and non-matching values are
 * copied through unchanged. Does NOT mutate the original object.
 */
export function transformReqNumbers(
  item: Record<string, unknown>,
  newFY: string,
  newMonth: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(item)) {
    const value = item[key];

    if (typeof value !== 'string') {
      result[key] = value;
      continue;
    }

    const parts = parseReqNumber(value);
    result[key] = parts
      ? buildReqNumber({ ...parts, fy: newFY, month: newMonth })
      : value;
  }

  return result;
}

/**
 * Validates the seeder form. Returns an error string if invalid, or null if valid.
 * Rules (TASK §2.2): Fiscal Year must be exactly 4 digits; Fiscal Month must be selected.
 */
export function validateMockDataForm(values: IMockDataSeederFormValues): string | null {
  if (!RE_FISCAL_YEAR.test(values.fiscalYear)) {
    return 'Fiscal Year must be exactly 4 digits (e.g. 2526).';
  }
  if (!values.fiscalMonth) {
    return 'Please select a Fiscal Month.';
  }
  return null;
}
