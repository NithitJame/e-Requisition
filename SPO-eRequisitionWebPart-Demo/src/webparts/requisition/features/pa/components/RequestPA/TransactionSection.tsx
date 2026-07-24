// One promotion transaction block: summary table, mechanics, expenses + totals,
// comment, action buttons, and the Charge-to-CBU table.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import { TITD_TYPE } from '@/features/pa/constants';
import { sumCommittedByType } from '@/features/pa/utils/totals';
import { IRequisitionFormHandlers, IRequisitionTransaction } from '@/features/pa/types';
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
}

const TransactionSection: React.FC<ITransactionSectionProps> = ({
  index,
  transaction,
  disabled,
  handlers,
}) => {
  const totalTI = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TI);
  const totalTD = sumCommittedByType(transaction.EstimatedPromotionExpense, TITD_TYPE.TD);

  return (
    <>
      {index > 0 && (
        <div className="col-12 mt-3">
          <hr className="hr-bold" />
        </div>
      )}

      <div className="col-12 mt-3">
        <MyDataTable data={transaction.tebles} columns={getTransactionColumns(handlers)} isPagination={false} />
      </div>

      <div className="col-12 mt-3">
        <label className="fw-bold mb-1">Mechanics Details <span className="text-danger">*</span></label>
        <textarea
          className="form-control"
          value={transaction.MechanicsDetails}
          onChange={(e) => handlers.updateMechanicsDetails(index, e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="col-12 mt-3">
        <hr className="hr-bold" />
      </div>

      <div className="col-12 mt-3">
        <div className="row">
          {/* Left: Estimated Promotion Expense */}
          <div className="col-12 col-xl-7 col-lg-7 col-md-7">
            <div className="tag-custom-1 mb-3">Estimated Promotion Expense</div>

            <div className="border rounded">
              <MyDataTable
                data={transaction.EstimatedPromotionExpense}
                columns={getExpenseColumns(index, disabled, handlers)}
                isPagination={false}
              />
            </div>

            <div className="mt-3">
              {!disabled ? (
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
              <div className="col-12 col-md-9 offset-md-3">
                <table className="table table-sm table-bordered">
                  <tbody>
                    <tr>
                      <td rowSpan={2} className={`align-middle fw-bold bg-light ${styles.totalsLabelCell}`}>
                        Total spending
                      </td>
                      <td className={`fw-bold text-center ${styles.totalsTypeCell}`}>TI</td>
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
                      <td className="fw-bold text-center">TD</td>
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
                disabled={disabled}
              />
            </div>

            <div className="mt-3 d-flex gap-2">
              {!disabled && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm rounded-xl"
                  onClick={() => handlers.removeTransaction(index)}
                >
                  <i className="fa fa-trash me-1" /> Delete Transaction
                </button>
              )}
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-xl">
                <i className="fa fa-history me-1" /> View Workflow History
              </button>
            </div>
          </div>

          {/* Right: Charge to CBU */}
          <div className="col-12 col-xl-5 col-lg-5 col-md-5">
            <div className="tag-custom-1 mb-3">Charge to CBU</div>

            <div className="border rounded">
              <MyDataTable
                data={transaction.ChargeToCBU}
                columns={getChargeToCBUColumns(index, disabled, handlers)}
                isPagination={false}
              />
            </div>

            <div className="mt-3">
              {!disabled ? (
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
