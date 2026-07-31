// AllPA listing screen. Thin shell: delegates all state/data work to useAllPaSearch and
// composes the filter form, results table, and loading overlay.

import * as React from 'react';

import MyDataTable from '@/shared/components/DataTable';
import LoadingOverlay from '@/shared/components/LoadingOverlay';
import { useAllPaSearch } from '@/features/pa/hooks/useAllPaSearch';
import {
  eRequisitionNoOptions,
  fiscalYearOptions,
  monthOptions,
  workflowStatusOptions,
} from '@/features/pa/constants/filterOptions';
import AllPaFilters from './AllPaFilters';
import { getAllPaColumns } from './AllPA.columns';

const AllPA: React.FC = () => {
  const search = useAllPaSearch();

  const columns = React.useMemo(() => getAllPaColumns(search.view), [search.view]);

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

      <AllPaFilters
        filters={search.filters}
        options={filterOptions}
        onChange={search.setFilter}
        onSearch={search.search}
        onRefresh={search.refresh}
        onClear={search.clear}
      />

      <div className="row mt-3">
        <div className="col-12">
          <hr className="hr-dashed" />
        </div>
      </div>

      {search.rows.length > 0 ? (
        <div className="row mt-3">
          <div className="col-12">
            <MyDataTable columns={columns} data={search.rows} isPagination />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AllPA;
