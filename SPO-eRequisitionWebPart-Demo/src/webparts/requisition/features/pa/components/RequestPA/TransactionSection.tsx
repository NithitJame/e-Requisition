// One promotion transaction block: summary table, mechanics, expenses + totals,
// comment, action buttons, and the Charge-to-CBU table.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import { showConfirmDialog } from '@/shared/utils/notify';
import { TITD_TYPE, WORKFLOW_STATUS_OPEN } from '@/features/pa/constants';
import { sumCommittedByType } from '@/features/pa/utils/totals';
import { IMajorGroupOption, IOption, IRequisitionFormHandlers, IRequisitionTransaction } from '@/features/pa/types';
import {
  getChargeToCBUColumns,
  getExpenseColumns,
  getTransactionColumns,
} from './RequestPA.columns';
import styles from './TransactionSection.module.scss';

interface ITransactionSectionProps {
  index: number;
  transaction: IRequisitionTransaction;
  disabled: boolean;
  handlers: IRequisitionFormHandlers;
  majorGroupOptions: IMajorGroupOption[];
  promotionOptions: IOption[];
  categoryOptions: IOption[];
  /** e-Requisition prefix (TPMNo), used to build this transaction's Ref No. */
  tpmNo: string;
  /** True for the transaction selected from the All Promotion Activities table. */
  isHighlighted?: boolean;
  /** Opens the Workflow History viewer for this transaction. */
  onOpenHistory: (refNo: string) => void;
  /** Opens the read-only Attachments viewer for this transaction (view mode). */
  onOpenAttachment: (refNo: string) => void;
  /** Opens the Attachment upload modal for this transaction (create/edit mode). */
  onOpenUpload: (transactionIndex: number, refNo: string) => void;
  /**
   * Saves just this transaction (Detail + its own Expense/CBU rows), without touching any other
   * transaction or its Status/WorkflowStatus. Only rendered in view mode while this transaction's
   * WorkflowStatus is "Open" — see the `editableFields` derivation below.
   */
  onSaveOpenTransaction: (index: number) => void;
  /**
   * Deletes just this transaction (Detail + its own Expense/CBU rows) immediately — unlike
   * `handlers.removeTransaction`, which only marks it for deletion locally until the next full
   * Save. Used instead of that handler in view mode, where there is no later page-level Save to
   * persist a deferred removal.
   */
  onDeleteOpenTransaction: (index: number) => void;
}

const TransactionSection: React.FC<ITransactionSectionProps> = ({
  index,
  transaction,
  disabled,
  handlers,
  majorGroupOptions,
  promotionOptions,
  categoryOptions,
  tpmNo,
  isHighlighted,
  onOpenHistory,
  onOpenAttachment,
  onOpenUpload,
  onSaveOpenTransaction,
  onDeleteOpenTransaction,
}) => {
  const totalTI = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TI);
  const totalTD = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TD);
  const transactionNo = transaction.tebles[0]?.Transaction ?? '';
  const refNo = transaction.Title ?? `${tpmNo}-${transactionNo}`;

  // View mode locks everything by default; this transaction's own fields listed in
  // getTransactionColumns/getExpenseColumns/getChargeToCBUColumns stay editable while its
  // WorkflowStatus is still "Open", OR while it was just added this session and never saved
  // (no Id yet, so it has no WorkflowStatus to check — treated like a normal new transaction,
  // fully editable). Outside view mode, editableFields is always true — unchanged create/edit
  // behaviour.
  const isNewTransaction = !transaction.Id;
  const isOpenTransaction = transaction.workflowStatus === WORKFLOW_STATUS_OPEN;
  const editableFields = !disabled || isNewTransaction || isOpenTransaction;
  // True only for a transaction that already existed on the server before this view — Category/
  // Comment/etc. stay locked for those (even when Open), but not for one added just now.
  const isLockedTransaction = disabled && !isNewTransaction;
  const showOpenTransactionSave = disabled && (isNewTransaction || isOpenTransaction);

  // MajorGroup Name choices for this transaction's Charge-to-CBU table are narrowed to the
  // ones whose SubBrand:Category matches this transaction's own Category selection (above).
  // Before a Category is picked, every active MajorGroup Name is offered.
  const selectedCategory = transaction.tebles[0]?.Category;
  const cbuMajorGroupOptions = selectedCategory
    ? majorGroupOptions.filter((option) => option.category === String(selectedCategory.value))
    : majorGroupOptions;

  const sectionRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isHighlighted && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  return (
    <>
      {index > 0 && (
        <div className="col-12 mt-3">
          <hr className="hr-bold" />
        </div>
      )}

      <div className={`col-12 mt-3 ${isHighlighted ? styles.highlighted : ''}`} ref={sectionRef}>
        <MyDataTable
          data={transaction.tebles}
          columns={getTransactionColumns(
            isLockedTransaction,
            editableFields,
            handlers,
            onOpenAttachment,
            onOpenUpload,
            tpmNo,
            index,
            promotionOptions,
            categoryOptions,
          )}
          isPagination={false}
        />
      </div>

      <div className="col-12 mt-3">
        <label className="fw-bold mb-1">Mechanics Details <span className="text-danger">*</span></label>
        <textarea
          className="form-control"
          value={transaction.MechanicsDetails}
          onChange={(e) => handlers.updateMechanicsDetails(index, e.target.value)}
          disabled={!editableFields}
        />
      </div>

      <div className="col-12 mt-3">
        <hr className="hr-bold" />
      </div>

      <div className="col-12 mt-3">
        <div className="row">
          {/* Left: Estimated Promotion Expense */}
          <div className="col-12 col-xl-7 col-lg-6 col-md-6">
            <div className="tag-custom-1 mb-3">Estimated Promotion Expense</div>

            <div className="border rounded">
              <MyDataTable
                data={transaction.EstimatedPromotionExpense}
                columns={getExpenseColumns(index, disabled, editableFields, handlers)}
                isPagination={false}
              />
            </div>

            <div className="mt-3">
              {editableFields ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-info rounded-xl"
                  onClick={() => handlers.addExpenseRow(index)}
                >
                  <i className="fa fa-plus me-1" /> Add Exp. Type
                </button>
              ) : null}
            </div>

            <div className="row mt-3">
              <div className="col-12">
                <table className="table table-sm table-borderless">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className={`align-middle fw-bold ${styles.totalsLabelCell}`}>
                        Total spending
                      </td>
                      <td className={`text-center ${styles.totalsTypeCell}`}>TI</td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm text-end"
                          value={totalTI.toLocaleString()}
                          disabled
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm text-end"
                          value="0"
                          disabled
                          placeholder="Adjust"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center">TD</td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm text-end"
                          value={totalTD.toLocaleString()}
                          disabled
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm text-end"
                          value="0"
                          disabled
                          placeholder="Adjust"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3">
              <label className="fw-bold mb-1">Comment</label>
              <textarea
                className="form-control"
                rows={2}
                value={transaction.Comment || ''}
                onChange={(e) => handlers.updateComment(index, e.target.value)}
                disabled={isLockedTransaction}
              />
            </div>

            <div className="mt-3 d-flex gap-2">
              {editableFields && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm rounded-xl"
                  onClick={async () => {
                    // onDeleteOpenTransaction already confirms itself (it deletes immediately, no
                    // later Save to catch a mistake) — don't confirm twice for that path.
                    if (isLockedTransaction) {
                      onDeleteOpenTransaction(index);
                      return;
                    }
                    const confirmed = await showConfirmDialog(`ต้องการลบ Transaction "${refNo}" ใช่หรือไม่?`);
                    if (confirmed) handlers.removeTransaction(index);
                  }}
                >
                  <i className="fa fa-trash me-1" /> Delete Transaction
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-xl"
                onClick={() => onOpenHistory(refNo)}
              >
                <i className="fa fa-history me-1" /> View Workflow History
              </button>
              {showOpenTransactionSave && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm rounded-xl"
                    onClick={() => onSaveOpenTransaction(index)}
                  >
                    Save Draft
                  </button>
                  {/* Placeholder — not wired up yet; behaviour to be defined separately. */}
                  <button type="button" className="btn btn-danger btn-sm rounded-xl">
                    Send To Approve
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Charge to CBU */}
          <div className="col-12 col-xl-5 col-lg-6 col-md-6">
            <div className="tag-custom-1 mb-3">Charge to CBU</div>

            <div className="border rounded">
              <MyDataTable
                data={transaction.ChargeToCBU}
                columns={getChargeToCBUColumns(
                  index,
                  disabled,
                  editableFields,
                  handlers,
                  cbuMajorGroupOptions,
                  transaction.tebles[0]?.Allocation ?? false,
                  (checked) => handlers.updateTransactionRow(transaction.tebles[0], 'Allocation', checked),
                )}
                isPagination={false}
              />
            </div>

            <div className="mt-3">
              {editableFields ? (
                <button
                  className="btn btn-sm btn-outline-info rounded-xl"
                  onClick={() => handlers.addChargeToCBURow(index)}
                >
                  <i className="fa fa-plus me-1" /> Add Major G.Brand
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionSection;
