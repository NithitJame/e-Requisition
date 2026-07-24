// Props/interfaces for the developer-only Mock Data Seeder dialog (TASK §2.1).

// Canonical form-values type lives in ../../../../../types so utils/validation can
// depend on it without importing this component. Re-exported here for convenience.
export { IMockDataSeederFormValues } from '@/features/pa/types';

/**
 * Props for the MockDataSeeder dialog.
 *
 * The dialog is UI only: it collects a fiscal year + month, validates them, and hands
 * them back via onPopulate. The page (RequestPA) maps the bundled template into form
 * state via useRequisitionForm.loadMockData — no SharePoint read or write happens here.
 */
export interface IMockDataSeederProps {
  isOpen: boolean;
  onDismiss: () => void;
  onPopulate: (fiscalYear: string, fiscalMonth: string) => void;
}
