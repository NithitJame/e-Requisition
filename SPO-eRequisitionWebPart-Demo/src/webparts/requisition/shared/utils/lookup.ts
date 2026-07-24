// Pure helpers for matching SharePoint values to options and reading lookup fields.

import { IOption } from '../types';

/**
 * Finds the option matching `value` (by value or label). If nothing matches but
 * a value is present, returns a synthetic option so the value still renders.
 */
export function findOption(options: IOption[], value: unknown): IOption | null {
  if (value === null || value === undefined || value === '') return null;
  const match = options.find((option) => option.value === value || option.label === value);
  if (match) return match;
  return { value: value as string | number, label: String(value) };
}

/**
 * Reads a usable value from a SharePoint field that may be a raw scalar or an
 * expanded lookup object. Prefers `Description`, then `LookupValue`.
 */
export function getLookupValue(raw: unknown): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object') {
    const obj = raw as { Description?: string | number; LookupValue?: string | number };
    return obj.Description ?? obj.LookupValue ?? null;
  }
  return raw as string | number;
}

/** Normalises a SharePoint multi-value field (`results` array or plain array) to an array. */
export function toArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const obj = value as { results?: unknown } | null;
  if (obj && Array.isArray(obj.results)) return obj.results as T[];
  return [];
}

/** Coerces an unknown SharePoint value to a number, defaulting to 0. */
export function toNumber(value: unknown): number {
  return Number(value) || 0;
}
