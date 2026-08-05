// Header section of RequestPA: channel / fiscal year / promotion month selectors
// and the read-only e-Requisition number + TI/TD spending totals.

import * as React from 'react';

import SearchableSelect from '@/shared/components/SearchableSelect';
import { IOption } from '@/features/pa/types';

interface IRequisitionHeaderProps {
  channel: IOption | null;
  channelOptions: IOption[];
  fiscalYear: IOption | null;
  fiscalYearOptions: IOption[];
  promotionMonth: IOption | null;
  monthOptions: IOption[];
  eRequisitionNo: string;
  totalSpendingTI: number;
  totalSpendingTD: number;
  disabled: boolean;
  onChannelChange: (option: IOption | null) => void;
  onFiscalYearChange: (option: IOption | null) => void;
  onPromotionMonthChange: (option: IOption | null) => void;
}

const RequisitionHeader: React.FC<IRequisitionHeaderProps> = ({
  channel,
  channelOptions,
  fiscalYear,
  fiscalYearOptions,
  promotionMonth,
  monthOptions,
  eRequisitionNo,
  totalSpendingTI,
  totalSpendingTD,
  disabled,
  onChannelChange,
  onFiscalYearChange,
  onPromotionMonthChange,
}) => (
  <>
    <div className="row">
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">Channel <span className="text-danger">*</span></label>
        <SearchableSelect
          isMulti={false}
          options={channelOptions}
          value={channel}
          onChange={onChannelChange}
          placeholder="Please select"
          disabled={disabled}
        />
      </div>
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">Fiscal Year <span className="text-danger">*</span></label>
        <SearchableSelect
          isMulti={false}
          options={fiscalYearOptions}
          value={fiscalYear}
          onChange={onFiscalYearChange}
          placeholder="Please select"
          disabled={disabled}
        />
      </div>
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">Promotion Month <span className="text-danger">*</span></label>
        <SearchableSelect
          isMulti={false}
          options={monthOptions}
          value={promotionMonth}
          onChange={onPromotionMonthChange}
          placeholder="Please select"
          disabled={disabled}
        />
      </div>
    </div>

    <div className="row mt-3">
      <div className="col-12">
        <hr className="hr-dashed" />
      </div>
    </div>

    <div className="row mt-3">
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">E-Requisition No.</label>
        <input type="text" className="form-control" value={eRequisitionNo} disabled />
      </div>
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">Total Spending TI</label>
        <input type="text" className="form-control" value={totalSpendingTI} disabled />
      </div>
      <div className="col-12 col-xl-4 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">Total Spending TD</label>
        <input type="text" className="form-control" value={totalSpendingTD} disabled />
      </div>
    </div>
  </>
);

export default RequisitionHeader;
