// Generic, domain-agnostic types shared across all features.
// Domain types (PA/TA) live in their feature's types.ts.

/** A generic select option (value + display label). */
export interface IOption {
  value: string | number;
  label: string;
}

/** A raw SharePoint list item. Field values are dynamic, hence `unknown`. */
export interface ISharePointItem {
  [fieldName: string]: unknown;
}

/** A SharePoint lookup value normalised to the `{ LookupValue }` shape the tables expect. */
export interface ILookupValue {
  LookupValue: string;
}
