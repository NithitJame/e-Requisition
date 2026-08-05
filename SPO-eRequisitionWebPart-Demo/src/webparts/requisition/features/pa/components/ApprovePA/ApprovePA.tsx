// Promotion Activities > Approve screen. Thin shell: delegates all state/data work to
// useApprovePaInbox and reuses the AllPA filter form + results table, adding per-row
// Approve/Reject/Comment controls and a batch "Confirm" action next to Export To Excel.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import LoadingOverlay from '@/shared/components/LoadingOverlay';
import { useApprovePaInbox } from '@/features/pa/hooks/useApprovePaInbox';
import AllPaFilters from '@/features/pa/components/AllPA/AllPaFilters';
import { getApprovePaColumns } from './ApprovePA.columns';

const ApprovePA: React.FC = () => {
  const inbox = useApprovePaInbox();

  const columns = React.useMemo(
    () =>
      getApprovePaColumns({
        onView: inbox.view,
        rows: inbox.rows,
        decisions: inbox.decisions,
        submitAttempted: inbox.submitAttempted,
        onDecision: inbox.setDecision,
        onSetAllDecisions: inbox.setAllDecisions,
        onComment: inbox.setComment,
      }),
    [
      inbox.view,
      inbox.rows,
      inbox.decisions,
      inbox.submitAttempted,
      inbox.setDecision,
      inbox.setAllDecisions,
      inbox.setComment,
    ],
  );

  const filterOptions = React.useMemo(
    () => ({
      channelOptions: inbox.channelOptions,
      categoryOptions: inbox.categoryOptions,
      monthOptions: inbox.monthOptions,
      yearOptions: inbox.fiscalYearOptions,
      workflowStatusOptions: inbox.workflowStatusOptions,
      eRequisitionNoOptions: inbox.eRequisitionNoOptions,
    }),
    [
      inbox.channelOptions,
      inbox.categoryOptions,
      inbox.monthOptions,
      inbox.fiscalYearOptions,
      inbox.workflowStatusOptions,
      inbox.eRequisitionNoOptions,
    ],
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
        monthRangeError={inbox.monthRangeError}
        extraAction={
          <button
            className="btn btn-outline-success rounded-xl me-2"
            onClick={inbox.submit}
            disabled={inbox.isSubmitting || inbox.rows.length === 0}
          >
            <i className="fa fa-check me-1" /> Confirm
          </button>
        }
      />

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      {inbox.rows.length > 0 ? (
        <div className="row mt-3">
          <div className="col-12">
            <MyDataTable columns={columns} data={inbox.rows} isPagination />
          </div>
        </div>
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
