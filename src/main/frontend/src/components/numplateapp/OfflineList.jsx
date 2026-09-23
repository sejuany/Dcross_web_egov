import React, { useEffect, useState } from 'react';
import axios from 'axios';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function OfflineList() {
  const [search, setSearch] = useState({ conditionType: 'MORTREG_DT', keyword: localDate() });
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post('/api/numplateapp/offline/list', search);
      setRows(data.list || []);
    } catch (error) {
      setRows([]);
      setMessage(error.response?.data?.message || '오프라인 목록을 조회하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 최초에는 오늘 등록 건만 조회하고, 입력 변경은 조회 버튼을 눌렀을 때 반영한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const selectType = (conditionType) => setSearch({ conditionType, keyword: conditionType === 'MORTREG_DT' ? localDate() : '' });

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title"><h1>오프라인 목록</h1><button type="button" onClick={load} disabled={loading}>새로고침</button></div>
      <form className="numplate-search-form" onSubmit={load}>
        <select value={search.conditionType} onChange={(event) => selectType(event.target.value)}><option value="MORTREG_DT">등록일자</option><option value="CAR_NO">차량번호</option><option value="CARID_NO">차대번호</option></select>
        <input type={search.conditionType === 'MORTREG_DT' ? 'date' : 'search'} value={search.keyword} onChange={(event) => setSearch({ ...search, keyword: event.target.value })} maxLength="50" required />
        <button type="submit" disabled={loading}>{loading ? '조회 중' : '조회'}</button>
      </form>
      {message && <p className="numplate-inline-message" role="alert">{message}</p>}
      <div className="numplate-process-list">
        {rows.map((row, index) => <article className="numplate-process-card" key={`${row.CAR_NO}-${row.CARID_NO}-${index}`}>
          <div className="numplate-card-heading"><strong>{row.CAR_NO || '-'}</strong><span>{row.MORTREG_DT || '-'}</span></div>
          <dl><dt>신규번호</dt><dd>{row.CAR_NO === row.PRE_CAR_NO ? '-' : (row.PRE_CAR_NO || '-')}</dd><dt>차종</dt><dd>{row.CAR_NM || '-'}</dd><dt>색상</dt><dd>{row.CAR_KD || '-'}</dd><dt>차대번호</dt><dd>{row.CARID_NO || '-'}</dd></dl>
        </article>)}
        {!loading && !message && rows.length === 0 && <p className="numplate-empty">조회된 오프라인 등록 건이 없습니다.</p>}
      </div>
    </section>
  );
}
