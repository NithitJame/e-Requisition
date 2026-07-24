// Developer-only Mock Data Seeder dialog (TASK §2.2). UI only — validation lives in
// utils (validateMockDataForm); the mapping into form state lives in the page/hook.
// Nothing is written to SharePoint here: this only pre-fills the form for the Submit
// load-test. The form's existing Submit button performs the (timed) POST.

import * as React from 'react';
import {
  Dialog,
  DialogFooter,
  DialogType,
  Dropdown,
  IDropdownOption,
  TextField,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
} from '@fluentui/react';

import styles from './MockDataSeeder.module.scss';
import { IMockDataSeederProps } from './MockDataSeeder.types';
import { FISCAL_MONTHS } from '@/features/pa/constants';
import { validateMockDataForm } from '@/features/pa/utils/requisitionNumberUtils';

const FISCAL_YEAR_MAX_LENGTH = 4;

const DIALOG_CONTENT_PROPS = {
  type: DialogType.normal,
  title: 'Seed Mock Data',
};

const MockDataSeeder: React.FC<IMockDataSeederProps> = ({ isOpen, onDismiss, onPopulate }) => {
  const [fiscalYear, setFiscalYear] = React.useState<string>('');
  const [fiscalMonth, setFiscalMonth] = React.useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (!isOpen) return;
    setFiscalYear('');
    setFiscalMonth(undefined);
    setErrorMessage(null);
  }, [isOpen]);

  const handleFiscalYearChange = (
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string,
  ): void => {
    setFiscalYear(newValue ?? '');
  };

  const handleFiscalMonthChange = (
    _event: React.FormEvent<HTMLDivElement>,
    option?: IDropdownOption,
  ): void => {
    setFiscalMonth(option ? String(option.key) : undefined);
  };

  const handlePopulate = (): void => {
    const validationError = validateMockDataForm({
      fiscalYear,
      fiscalMonth: fiscalMonth ?? '',
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    onPopulate(fiscalYear, fiscalMonth as string);
    onDismiss();
  };

  return (
    <Dialog hidden={!isOpen} onDismiss={onDismiss} dialogContentProps={DIALOG_CONTENT_PROPS}>
      <div className={styles.body}>
        <MessageBar messageBarType={MessageBarType.info} className={styles.messageBar}>
          Fills the form with 41 template transactions for the chosen period. Nothing is saved
          until you click Submit.
        </MessageBar>

        {errorMessage ? (
          <MessageBar messageBarType={MessageBarType.error} className={styles.messageBar}>
            {errorMessage}
          </MessageBar>
        ) : null}

        <TextField
          className={styles.field}
          label="Fiscal Year"
          placeholder="e.g. 2526"
          maxLength={FISCAL_YEAR_MAX_LENGTH}
          value={fiscalYear}
          onChange={handleFiscalYearChange}
        />

        <Dropdown
          className={styles.field}
          label="Fiscal Month"
          placeholder="Select a fiscal month"
          options={FISCAL_MONTHS}
          selectedKey={fiscalMonth}
          onChange={handleFiscalMonthChange}
        />
      </div>

      <DialogFooter>
        <PrimaryButton text="Populate Form" onClick={handlePopulate} />
        <DefaultButton text="Cancel" onClick={onDismiss} />
      </DialogFooter>
    </Dialog>
  );
};

export default MockDataSeeder;
