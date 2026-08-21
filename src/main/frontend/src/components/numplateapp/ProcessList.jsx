import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 입력 또는 심사요청이 가능한 기존 처리상태. 그 외 상태는 결과조회로 이동한다.
const requestStates = new Set([
  'N_REQ', 'N_INS', 'N_DLV',
  '번호판처리요청', '번호판발송요청', '번호판탈부착요청', '배송요청', '사무실배송요청',
]);

export default function ProcessList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ conditionType: 'CAR_NO', keyword: '', todayOnly: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (searchFilters) => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post('/api/numplateapp/process/list', searchFilters);
      setRows(data.list || []);
    } catch (error) {
      setMessage(error.response?.data?.message || '처리목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load({ conditionType: 'CAR_NO', keyword: '', todayOnly: false }); }, [load]);

  const search = (event) => {
    event?.preventDefault();
    load(filters);
  };

  const open = (row) => {
    // 동일 목록에서 현재 상태에 따라 다음 업무 화면을 자동으로 결정한다.
    const path = requestStates.has(row.PROC_ST) ? 'request' : 'status';
    navigate(`/numplateapp/${path}/${encodeURIComponent(row.SERVICE_ID)}`);
  };

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>처리목록</h1><span>{rows.length}건</span></div>
        <button type="button" onClick={search} disabled={loading}>{loading ? '조회 중' : '새로고침'}</button>
      </div>

      <form className="numplate-search-form" onSubmit={search}>
        <select value={filters.conditionType} onChange={(event) => setFilters({ ...filters, conditionType: event.target.value })} aria-label="검색 항목">
          <option value="CAR_NO">차량번호</option>
          <option value="BUY_NM">고객명</option>
        </select>
        <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} maxLength={50} placeholder="검색어" aria-label="검색어" />
        <button type="submit">검색</button>
        <label className="numplate-today-filter">
          <input type="checkbox" checked={filters.todayOnly} onChange={(event) => setFilters({ ...filters, todayOnly: event.target.checked })} /> 오늘 일정만
        </label>
      </form>

      {message && <p className="numplate-inline-message" role="alert">{message}</p>}
      <div className="numplate-process-list">
        {rows.map((row) => (
          <button type="button" className="numplate-process-card" key={row.SERVICE_ID} onClick={() => open(row)}>
            <div className="numplate-card-heading">
              <strong>{row.CAR_NO || '차량번호 없음'}</strong>
              <span>{row.PROC_ST_NM || row.PROC_ST}</span>
            </div>
            <dl>
              <dt>신규번호</dt><dd>{row.POST_CAR_NO || (row.ETC5 === 'Y' ? '번호판재발급' : '-')}</dd>
              <dt>고객명</dt><dd>{row.BUY_NM || '-'}</dd>
              <dt>방문일시</dt><dd>{[row.INSTALL_DT, row.INSTALL_TM].filter(Boolean).join(' ') || '-'}</dd>
              <dt>장소</dt><dd>{row.LAST_DELIVERY_ADDR || '-'}</dd>
            </dl>
            <small>{row.SERVICE_ID}</small>
          </button>
        ))}
        {!loading && !rows.length && <p className="numplate-empty">처리할 건이 없습니다.</p>}
      </div>
    </section>
  );
}
