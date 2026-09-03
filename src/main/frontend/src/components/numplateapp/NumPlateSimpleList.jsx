import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../numplate/NumberPlateList.css';
import { useAuth } from '../../context/AuthContext';
import ErpField from '../common/ErpField';
import ErpSection from '../common/ErpSection';

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * 번호판 관리의 단순 조회 화면들이 공유하는 목록 틀.
 * 같은 응답을 데스크톱에서는 AG Grid, 모바일에서는 카드 목록으로 표시한다.
 */
export default function NumPlateSimpleList({ title, endpoint, columns, mobile = false }) {
  const gridRef = useRef(null);
  const { user } = useAuth();
  const ownCompanyId = user?.company_ID === 'dacos' ? '' : (user?.company_ID || '');
  const [companyId, setCompanyId] = useState(ownCompanyId);
  const [companies, setCompanies] = useState([]);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post(endpoint, { COMPANY_ID: companyId });
      setRows(data.list || []);
    } catch (error) {
      setMessage(error.response?.data?.message || '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [companyId, endpoint]);

  useEffect(() => {
    search();
  }, [search]);

  useEffect(() => {
    // DACOS 관리자는 회사를 선택할 수 있고 일반 사용자는 로그인 회사로 고정한다.
    if (ownCompanyId) return;
    axios.get('/api/companies', { params: { workCd: '010' } })
      .then(({ data }) => setCompanies(data.list || []))
      .catch(() => setCompanies([]));
  }, [ownCompanyId]);

  return (
    <div className={`status-container ${mobile ? 'numplate-mobile' : ''}`}>
      {message && <div className="toast-notification" role="alert">{message}</div>}
      <div className="status-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-title">{title}</span>
          <span className="title-count">{rows.length}</span>건
        </div>
        <div className="toolbar-right">
          <button type="button" className="btn-status" onClick={search} disabled={loading}>
            {loading ? '조회 중' : '조회[F2]'}
          </button>
          <button
            type="button"
            className="btn-status"
            onClick={() => gridRef.current?.api.exportDataAsCsv({ fileName: `${title}.csv` })}
            disabled={!rows.length}
          >
            엑셀[F7]
          </button>
        </div>
      </div>

      <ErpSection isHeader>
        <div className="erp-row">
          <ErpField label="회사" span={3}>
            <select
              className="erp-input"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              disabled={Boolean(ownCompanyId)}
              aria-label="회사"
            >
              <option value="">전체</option>
              {companies.map((company) => (
                <option key={company.COMPANY_ID} value={company.COMPANY_ID}>
                  {company.COMPANY_NM}
                </option>
              ))}
            </select>
          </ErpField>
        </div>
      </ErpSection>

      {mobile && (
        <div className="numplate-mobile-cards">
          {rows.map((row, index) => (
            <article className="numplate-mobile-card" key={row.CAR_NO || row.SERVICE_ID || index}>
              <h2>{row.CAR_NO || `번호판 ${index + 1}`}</h2>
              <dl>
                {columns.filter(({ field }) => field && field !== 'CAR_NO').map((column) => (
                  <React.Fragment key={column.field}>
                    <dt>{column.headerName}</dt>
                    <dd>{row[column.field] ?? '-'}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </article>
          ))}
          {!rows.length && !loading && <p className="numplate-mobile-empty">조회된 데이터가 없습니다.</p>}
        </div>
      )}

      <div className={`grid-container ${mobile ? 'numplate-desktop-grid' : ''}`}>
        <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            overlayNoRowsTemplate="조회된 데이터가 없습니다."
          />
        </div>
      </div>
    </div>
  );
}
