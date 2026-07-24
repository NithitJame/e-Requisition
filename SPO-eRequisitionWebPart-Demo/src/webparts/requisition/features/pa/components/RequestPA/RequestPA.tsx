// PA request form. Thin shell: delegates all state/logic to useRequisitionForm
// and composes the header, per-transaction sections, and footer actions.

import * as React from 'react';
import { DefaultButton } from '@fluentui/react';

import LoadingOverlay from '@/shared/components/LoadingOverlay';
import { useRequisitionForm } from '@/features/pa/hooks/useRequisitionForm';
import RequisitionHeader from './RequisitionHeader';
import TransactionSection from './TransactionSection';
import MockDataSeeder from './MockDataSeeder';
import styles from './RequestPA.module.scss';

// Dev-only tooling (Mock Data Seeder) is excluded from production bundles.
const isDevMode = process.env.NODE_ENV !== 'production';

const RequestPA: React.FC = () => {
  const form = useRequisitionForm();
  const [isMockSeederOpen, setIsMockSeederOpen] = React.useState(false);

  return (
    <>
      <LoadingOverlay isLoading={form.isLoading} />

      {isDevMode ? (
        <div className={styles.devToolbar}>
          <DefaultButton text="Seed Mock Data" onClick={() => setIsMockSeederOpen(true)} />
        </div>
      ) : null}

      <RequisitionHeader
        channel={form.channel}
        fiscalYear={form.fiscalYear}
        promotionMonth={form.promotionMonth}
        eRequisitionNo={form.eRequisitionNo}
        totalSpendingTI={form.totalSpendingTI}
        totalSpendingTD={form.totalSpendingTD}
        disabled={form.disabledAction}
        onChannelChange={form.setChannel}
        onFiscalYearChange={form.setFiscalYear}
        onPromotionMonthChange={form.setPromotionMonth}
      />

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      <div className="row mt-3">
        {form.transactions.map((transaction, index) => (
          <TransactionSection
            key={index}
            index={index}
            transaction={transaction}
            disabled={form.disabledAction}
            handlers={form.handlers}
          />
        ))}
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-bold" />
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          {!form.disabledAction ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-info rounded-xl"
              onClick={form.handlers.addTransaction}
            >
              <i className="fa fa-plus me-1" /> Add Promotion
            </button>
          ) : null}
        </div>
      </div>

      <div className="row mt-5">
        <div className="col-12">
          {!form.disabledAction ? (
            <>
              <button
                className={`btn btn-secondary btn-custom-1 rounded-xl me-2 ${styles.actionButton}`}
                onClick={() => form.save('Draft')}
              >
                Save Draft
              </button>
              <button
                className={`btn btn-danger rounded-xl me-2 ${styles.actionButton}`}
                onClick={() => form.save('Submit')}
              >
                Send To Approve
              </button>
            </>
          ) : null}
        </div>
      </div>

      {isDevMode ? (
        <MockDataSeeder
          isOpen={isMockSeederOpen}
          onDismiss={() => setIsMockSeederOpen(false)}
          onPopulate={form.loadMockData}
        />
      ) : null}
    </>
  );
};

export default RequestPA;
