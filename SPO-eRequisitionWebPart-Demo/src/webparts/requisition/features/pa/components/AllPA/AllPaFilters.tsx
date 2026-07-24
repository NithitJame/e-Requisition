// Filter form for the AllPA search screen: channel / category / month / fiscal year / status
// selectors plus the action buttons. Presentational only — all state lives in useAllPaSearch.

import * as React from 'react';
import Form from 'react-bootstrap/Form';

import SearchableSelect from '@/shared/components/SearchableSelect';
import { IAllPaFiltersProps } from './AllPaFilters.types';
import styles from './AllPA.module.scss';

const PROMOTION_WEEKS = ['W1-2', 'W3-4', 'All'] as const;

const AllPaFilters: React.FC<IAllPaFiltersProps> = ({
  filters,
  options,
  onChange,
  onSearch,
  onRefresh,
  onClear,
  onExport,
}) => (
  <>
    <div className="row">
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-1">
          Channel
          <button
            className={`btn btn-sm btn-secondary btn-custom-1 rounded-xl me-2 ${styles.clearChannelButton}`}
            onClick={() => onChange('channel', null)}
          >
            Clear
          </button>
        </label>
        <SearchableSelect
          isMulti
          options={options.channelOptions}
          value={filters.channel}
          onChange={(option) => onChange('channel', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Category</label>
        <SearchableSelect
          isMulti
          options={options.categoryOptions}
          value={filters.category}
          onChange={(option) => onChange('category', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Promotion Month From</label>
        <SearchableSelect
          isMulti={false}
          options={options.monthOptions}
          value={filters.monthFrom}
          onChange={(option) => onChange('monthFrom', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Promotion Month To</label>
        <SearchableSelect
          isMulti={false}
          options={options.monthOptions}
          value={filters.monthTo}
          onChange={(option) => onChange('monthTo', option)}
          placeholder="Please select"
        />
      </div>
    </div>

    <div className="row mt-3">
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Fiscal Year</label>
        <SearchableSelect
          isMulti={false}
          options={options.yearOptions}
          value={filters.fiscalYear}
          onChange={(option) => onChange('fiscalYear', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Status</label>
        <SearchableSelect
          isMulti={false}
          options={options.workflowStatusOptions}
          value={filters.workflowStatus}
          onChange={(option) => onChange('workflowStatus', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">E-Requisition No.</label>
        <SearchableSelect
          isMulti={false}
          options={options.eRequisitionNoOptions}
          value={filters.eRequisitionNo}
          onChange={(option) => onChange('eRequisitionNo', option)}
          placeholder="Please select"
        />
      </div>
      <div className="col-12 col-xl-3 col-lg-4 col-md-6">
        <label className="fw-bold mb-2">Expected to Close</label>
        <SearchableSelect
          isMulti={false}
          options={options.monthOptions}
          value={filters.expectedToClose}
          onChange={(option) => onChange('expectedToClose', option)}
          placeholder="Please select"
        />
      </div>
    </div>

    <div className="row mt-5">
      <div className="col-12">
        <label className="fw-bold mb-2">Promotion Week</label>
        <div>
          {PROMOTION_WEEKS.map((week, index) => (
            <Form.Check
              key={week}
              inline
              label={week}
              name="group1"
              type="radio"
              checked={filters.promotionWeek === week}
              onChange={() => onChange('promotionWeek', week)}
              id={`inline-promotion-week-${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>

    <div className="row mt-3">
      <div className="col-6 text-start">
        <button className="btn btn-secondary btn-custom-1 rounded-xl me-2" onClick={onExport}>
          Export To Excel
        </button>
      </div>
      <div className="col-6 text-end">
        <button
          className={`btn btn-secondary btn-custom-1 rounded-xl me-2 ${styles.actionButton}`}
          onClick={onClear}
        >
          Clear
        </button>
        <button
          className={`btn btn-outline-secondary rounded-xl me-2 ${styles.actionButton}`}
          onClick={onRefresh}
        >
          Refresh
        </button>
        <button
          className={`btn btn-outline-success rounded-xl me-2 ${styles.actionButton}`}
          onClick={onSearch}
        >
          Search
        </button>
      </div>
    </div>
  </>
);

export default AllPaFilters;
