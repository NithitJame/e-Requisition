// Read-only Trade Agreement detail, opened from the All Trade Agreement "View" button
// (#/ta/request?_id=<TPMNo>&_tx=<n>&mode=view).
//
// NOTE: this is the navigation target + Back affordance. The full read-only detail (reusing the
// Request layout backed by a TA read service over the TA Detail/Expenses/CBU/History/Documents
// lists) is the fast-follow — see the change summary. For now it confirms the selected record
// and returns to the list.

import * as React from 'react';
import { useHistory, useLocation } from 'react-router-dom';

/** Reads a query param from the HashRouter URL (search first, then raw hash). */
function readQueryParam(search: string, key: string): string | null {
  const fromSearch = new URLSearchParams(search).get(key);
  if (fromSearch) return fromSearch;
  const rawHash = window.location.hash || '';
  const queryIndex = rawHash.indexOf('?');
  if (queryIndex === -1) return null;
  return new URLSearchParams(rawHash.substring(queryIndex)).get(key);
}

const TradeAgreementView: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const id = readQueryParam(location.search, '_id');
  const tx = readQueryParam(location.search, '_tx');

  const goBack = (): void => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    history.push('/ta');
  };

  return (
    <>
      <div className="row mb-2">
        <div className="col-12">
          <button className="btn btn-outline-secondary rounded-xl" onClick={goBack}>
            <i className="fa fa-arrow-left me-1" /> Back
          </button>
        </div>
      </div>

      <div className="row mt-3">
        <div className="col-12">
          <div className="alert alert-info">
            <strong>Trade Agreement (read-only)</strong>
            <br />
            E-Requisition No.: {id ?? '-'}
            {tx ? ` — Transaction ${tx}` : ''}
            <br />
            หน้ารายละเอียด Trade Agreement (read-only) พร้อม workflow history จะตามมาในขั้นถัดไป
          </div>
        </div>
      </div>
    </>
  );
};

export default TradeAgreementView;
