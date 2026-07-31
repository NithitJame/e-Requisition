// Promotion Activities > Approve screen. Thin shell: delegates all state/data work to
// useApprovePaInbox and reuses the AllPA filter form + results table, adding per-row
// Approve/Reject/Comment controls and a batch "Submit Decision" action.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import LoadingOverlay from '@/shared/components/LoadingOverlay';
import { useApprovePaInbox } from '@/features/pa/hooks/useApprovePaInbox';
import {
  eRequisitionNoOptions,
  fiscalYearOptions,
  monthOptions,
  workflowStatusOptions,
} from '@/features/pa/constants/filterOptions';
import AllPaFilters from '@/features/pa/components/AllPA/AllPaFilters';
import { getApprovePaColumns } from './ApprovePA.columns';
import styles from './ApprovePA.module.scss';

const ApprovePA: React.FC = () => {
  const inbox = useApprovePaInbox();

  const columns = React.useMemo(
    () =>
      getApprovePaColumns({
        onView: inbox.view,
        decisions: inbox.decisions,
        submitAttempted: inbox.submitAttempted,
        onDecision: inbox.setDecision,
        onComment: inbox.setComment,
      }),
    [inbox.view, inbox.decisions, inbox.submitAttempted, inbox.setDecision, inbox.setComment],
  );

  const filterOptions = React.useMemo(
    () => ({
      channelOptions: inbox.channelOptions,
      categoryOptions: inbox.categoryOptions,
      monthOptions,
      yearOptions: fiscalYearOptions,
      workflowStatusOptions,
      eRequisitionNoOptions,
    }),
    [inbox.channelOptions, inbox.categoryOptions],
  );

  return (
    <>
      <LoadingOverlay isLoading={inbox.isLoading || inbox.isSubmitting} />

      <AllPaFilters
        filters={inbox.filters}
        options={filterOptions}
        onChange={inbox.setFilter}
        onSearch={inbox.search}
        onClear={inbox.clear}
        onExport={inbox.exportExcel}
      />

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      {inbox.rows.length > 0 ? (
        <>
          <div className="row mt-3">
            <div className="col-12">
              <MyDataTable columns={columns} data={inbox.rows} isPagination />
            </div>
          </div>

          <div className="row mt-3">
            <div className={`col-12 ${styles.submitBar}`}>
              <button
                className="btn btn-outline-success rounded-xl"
                onClick={inbox.submit}
                disabled={inbox.isSubmitting}
              >
                <i className="fa fa-check me-1" /> Submit Decision
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="row mt-3">
          <div className="col-12 text-center text-muted">
            ไม่มีรายการที่รออนุมัติโดยคุณ
          </div>
        </div>
      )}
    </>
  );
};

export default ApprovePA;
