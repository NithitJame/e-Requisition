// All Trade Agreement listing screen. Thin shell: reuses the shared listing hook, filter form,
// and columns (with TA formatting: currency totals + truncated Mechanics; Category shown,
// same as AllPA). Title/breadcrumb are rendered by MainLayout from the menu route.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import LoadingOverlay from '@/shared/components/LoadingOverlay';
import PromotionListingFilters from '@/shared/components/PromotionListingFilters';
import { getPromotionListingColumns } from '@/shared/components/promotionListingColumns';
import {
  eRequisitionNoOptions,
  fiscalYearOptions,
  monthOptions,
  workflowStatusOptions,
} from '@/shared/constants/listingFilterOptions';
import { useAllTaSearch } from '@/features/ta/hooks/useAllTaSearch';

const AllTA: React.FC = () => {
  const search = useAllTaSearch();

  const columns = React.useMemo(
    () =>
      getPromotionListingColumns(search.view, {
        currency: true,
        mechanicsTooltip: true,
      }),
    [search.view],
  );

  const filterOptions = React.useMemo(
    () => ({
      channelOptions: search.channelOptions,
      categoryOptions: search.categoryOptions,
      monthOptions,
      yearOptions: fiscalYearOptions,
      workflowStatusOptions,
      eRequisitionNoOptions,
    }),
    [search.channelOptions, search.categoryOptions],
  );

  return (
    <>
      <LoadingOverlay isLoading={search.isLoading} />

      <PromotionListingFilters
        filters={search.filters}
        options={filterOptions}
        onChange={search.setFilter}
        onSearch={search.search}
        onClear={search.clear}
        onExport={search.exportExcel}
      />

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      {search.error ? (
        <div className="row mt-3">
          <div className="col-12">
            <div className="alert alert-danger">{search.error}</div>
          </div>
        </div>
      ) : search.rows.length > 0 ? (
        <div className="row mt-3">
          <div className="col-12">
            <MyDataTable columns={columns} data={search.rows} isPagination />
          </div>
        </div>
      ) : search.hasSearched ? (
        <div className="row mt-3">
          <div className="col-12 text-center text-muted">
            ไม่พบข้อมูล Trade Agreement ตามเงื่อนไขที่เลือก
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AllTA;
