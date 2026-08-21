import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/** 기존 RegSendList.jsp의 검색과 폐번호판 처리목록을 모바일 카드로 제공한다. */
export default function ReturnList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ conditionType: 'CAR_NO', keyword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (searchFilters) => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post('/api/numplateapp/returns/list', searchFilters);
      setRows(data.list || []);
    } catch (error) {
      setMessage(error.response?.data?.message || '반납목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load({ conditionType: 'CAR_NO', keyword: '' }); }, [load]);

  const search = (event) => {
    event?.preventDefault();
    load(filters);
  };

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>반납목록</h1><span>{rows.length}건</span></div>
        <button type="button" onClick={search} disabled={loading}>{loading ? '조회 중' : '새로고침'}</button>
      </div>

      <form className="numplate-search-form" onSubmit={search}>
        <select value={filters.conditionType} onChange={(event) => setFilters({ ...filters, conditionType: event.target.value })} aria-label="검색 항목">
          <option value="CAR_NO">차량번호</option>
          <option value="BUY_NM">고객명</option>
        </select>
        <input value={filters.keyword} onChange={(event) => setFilters({ ...filters, keyword: event.target.value })} maxLength={50} placeholder="검색어" aria-label="검색어" />
        <button type="submit">검색</button>
      </form>

      {message && <p className="numplate-inline-message" role="alert">{message}</p>}
      <div className="numplate-process-list">
        {rows.map((row) => (
          <button type="button" className="numplate-process-card" key={row.SERVICE_ID} onClick={() => navigate(`/numplateapp/returns/${encodeURIComponent(row.SERVICE_ID)}`)}>
            <div className="numplate-card-heading">
              <strong className={row.COMPANY_ID === 'CB407' ? 'numplate-kb-car' : ''}>{row.CAR_NO || '차량번호 없음'}</strong>
              <span>{row.PROC_ST || '폐판처리요청'}</span>
            </div>
            <dl>
              <dt>신규번호</dt><dd className={String(row.NUM_GB || '').includes('G') ? 'numplate-corporate-number' : ''}>{row.POST_CAR_NO || (row.ETC5 === 'Y' ? '번호판재발급' : '-')}</dd>
              <dt>고객명</dt><dd>{row.BUY_NM || '-'}</dd>
              <dt>심사완료일</dt><dd>{row.JUDGE_DT || '-'}</dd>
              <dt>탈부착일</dt><dd>{row.INSTALL_DT || '-'}</dd>
            </dl>
            <small>{row.SERVICE_ID}</small>
          </button>
        ))}
        {!loading && !rows.length && <p className="numplate-empty">반납 처리할 건이 없습니다.</p>}
      </div>
    </section>
  );
}
