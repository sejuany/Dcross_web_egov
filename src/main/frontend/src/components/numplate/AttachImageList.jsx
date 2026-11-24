import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, ChevronLeft, ChevronRight, Expand, ImageOff, RefreshCw, Search, X } from 'lucide-react';
import './AttachImageList.css';

const photoSlots = [
  { slot: 1, label: '기존 번호판' },
  { slot: 2, label: '신규 앞 번호판' },
  { slot: 3, label: '신규 뒤 번호판' },
  { slot: 4, label: '신분증' },
  { slot: 5, label: '폐번호판' },
  { slot: 6, label: '서명' },
];

function initialFilters() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { workCd: '011', carNo: '', startDate: today, endDate: today, missingReturnPlate: false };
}

function imageUrl(serviceId, slot) {
  return `/api/attach/images/${encodeURIComponent(serviceId)}/${slot}`;
}

function PhotoCell({ row, photo, onOpen }) {
  const [failed, setFailed] = useState(false);
  const source = imageUrl(row.SERVICE_ID, photo.slot);
  useEffect(() => setFailed(false), [source]);

  if (row[`IMAGE${photo.slot}_YN`] !== 'Y' || failed) {
    return (
      <div className={`attach-image-placeholder${failed ? ' attach-image-placeholder-error' : ''}`}>
        <ImageOff size={23} aria-hidden="true" />
        <span>{failed ? '불러오기 실패' : '미등록'}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="attach-image-thumbnail"
      aria-label={`${row.CAR_NO || row.SERVICE_ID} ${photo.label} 사진 확대`}
      onClick={() => onOpen({ source, label: photo.label, row })}
    >
      <img src={source} alt={`${row.CAR_NO || row.SERVICE_ID} ${photo.label}`} loading="lazy" onError={() => setFailed(true)} />
      <span className="attach-image-thumbnail-action"><Expand size={13} aria-hidden="true" /> 확대</span>
    </button>
  );
}

function PhotoPreview({ photo, onClose }) {
  const dialogRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="attach-image-preview"
      aria-labelledby="attach-image-preview-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="attach-image-preview-header">
        <div>
          <h2 id="attach-image-preview-title">{photo.row.CAR_NO || photo.row.SERVICE_ID} · {photo.label}</h2>
          <p>{photo.row.SERVICE_ID}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="사진 확대 닫기" autoFocus><X size={23} aria-hidden="true" /></button>
      </header>
      <div className="attach-image-preview-body">
        {failed ? <p role="alert">사진을 불러오지 못했습니다. 닫은 후 새로고침해 주세요.</p>
          : <img src={photo.source} alt={`${photo.row.CAR_NO || photo.row.SERVICE_ID} ${photo.label} 확대 사진`} onError={() => setFailed(true)} />}
      </div>
    </dialog>
  );
}

export default function AttachImageList() {
  const [draft, setDraft] = useState(initialFilters);
  const [query, setQuery] = useState(() => ({ ...initialFilters(), page: 1, size: 10 }));
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [preview, setPreview] = useState(null);
  const requestRef = useRef(0);
  const tableRef = useRef(null);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);
    setTotal(0);
    axios.get('/api/attach/images', { params: query, signal: controller.signal })
      .then(({ data }) => {
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        if (!data.success) {
          setError(data.message || '사진 목록을 조회하지 못했습니다.');
          return;
        }
        const result = data.data;
        const resultTotal = Number(result.total) || 0;
        const lastPage = Math.max(1, Math.ceil(resultTotal / query.size));
        if (query.page > lastPage) {
          setQuery((current) => ({ ...current, page: lastPage }));
          return;
        }
        setRows(result.rows || []);
        setTotal(resultTotal);
        if (tableRef.current) tableRef.current.scrollTop = 0;
      })
      .catch((exception) => {
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        setError(exception.response?.data?.message || '사진 목록을 조회하지 못했습니다. 다시 시도해 주세요.');
      })
      .finally(() => {
        if (requestId === requestRef.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, refresh]);

  const changeFilter = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const search = (event) => {
    event.preventDefault();
    if (!draft.startDate || !draft.endDate) {
      setValidation('심사일의 시작일과 종료일을 선택해 주세요.');
      return;
    }
    if (draft.startDate > draft.endDate) {
      setValidation('시작일은 종료일보다 늦을 수 없습니다.');
      return;
    }
    setValidation('');
    setQuery({ ...draft, carNo: draft.carNo.trim(), page: 1, size: query.size });
  };
  const totalPages = Math.max(1, Math.ceil(total / query.size));
  const firstRow = total ? (query.page - 1) * query.size + 1 : 0;
  const lastRow = Math.min(query.page * query.size, total);

  return (
    <section className="attach-image-page" aria-label="탈부착 이미지 관리">
      <div className="attach-image-page-header">
        <div className="attach-image-heading">
          <span className="attach-image-heading-icon"><Camera size={23} aria-hidden="true" /></span>
          <div><h1>탈부착 이미지 관리</h1><p>차량별 등록 사진을 한눈에 확인하세요.</p></div>
        </div>
        <div className="attach-image-total" role="status" aria-live="polite">전체 <strong>{total.toLocaleString()}</strong>건</div>
      </div>

      <form className="attach-image-search" onSubmit={search} aria-label="탈부착 이미지 검색">
        <div className="attach-image-search-fields">
          <label className="attach-image-field">신청구분
            <select value={draft.workCd} onChange={(event) => changeFilter('workCd', event.target.value)}>
              <option value="011">이전등록</option><option value="030">변경등록</option>
            </select>
          </label>
          <label className="attach-image-field attach-image-car-field" htmlFor="attach-image-car-no">차량번호
            <span className="attach-image-input-wrap">
              <input id="attach-image-car-no" value={draft.carNo} onChange={(event) => changeFilter('carNo', event.target.value)} maxLength={30} placeholder="차량번호 검색" />
              {draft.carNo && <button type="button" aria-label="차량번호 지우기" onClick={() => changeFilter('carNo', '')}><X size={16} aria-hidden="true" /></button>}
            </span>
          </label>
          <div className="attach-image-date-field">
            <span>심사일</span>
            <div className="attach-image-date-range">
              <input type="date" aria-label="심사 시작일" value={draft.startDate} onChange={(event) => changeFilter('startDate', event.target.value)} required />
              <span aria-hidden="true">~</span>
              <input type="date" aria-label="심사 종료일" value={draft.endDate} onChange={(event) => changeFilter('endDate', event.target.value)} required />
            </div>
          </div>
          <div className="attach-image-search-actions">
            <button type="submit" className="attach-image-button attach-image-button-primary" disabled={loading}><Search size={17} aria-hidden="true" />조회</button>
            <button type="button" className="attach-image-button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={17} aria-hidden="true" />새로고침</button>
          </div>
        </div>
        <div className="attach-image-search-bottom">
          <label className="attach-image-checkbox"><input type="checkbox" checked={draft.missingReturnPlate} onChange={(event) => changeFilter('missingReturnPlate', event.target.checked)} />폐번호판 미등록건</label>
          <span>사진을 누르면 크게 볼 수 있습니다.</span>
        </div>
        {validation && <p className="attach-image-validation" role="alert">{validation}</p>}
      </form>

      {error && <div className="attach-image-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRefresh((value) => value + 1)}>다시 조회</button></div>}

      <div className="attach-image-results">
        <div className="attach-image-results-bar">
          <div><strong>{query.workCd === '030' ? '변경등록' : '이전등록'}</strong><span>{query.startDate} ~ {query.endDate}</span></div>
          <label>표시 건수<select aria-label="페이지당 표시 건수" value={query.size} disabled={loading} onChange={(event) => setQuery((current) => ({ ...current, size: Number(event.target.value), page: 1 }))}>
            <option value={10}>10건</option><option value={20}>20건</option><option value={50}>50건</option>
          </select></label>
        </div>
        <p className="attach-image-mobile-hint">표를 좌우로 움직여 모든 사진을 확인하세요.</p>
        <div className="attach-image-table-wrap" ref={tableRef} tabIndex={0} role="region" aria-label="탈부착 이미지 조회 결과" aria-busy={loading}>
          <table className="attach-image-table">
            <caption>차량별 기존·신규 번호판, 신분증, 폐번호판과 서명 사진</caption>
            <thead><tr>
              <th scope="col" className="attach-image-index">순번</th><th scope="col" className="attach-image-old-number">기존 차량번호</th>
              <th scope="col">기존 번호판</th><th scope="col" className="attach-image-new-number">신규 차량번호</th>
              {photoSlots.slice(1).map((photo) => <th scope="col" key={photo.slot}>{photo.label}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="attach-image-table-message"><span className="attach-image-loading" aria-hidden="true" />사진 목록을 불러오는 중입니다.</td></tr>}
              {!loading && !rows.length && <tr><td colSpan={9} className="attach-image-table-message">{error ? '목록을 불러오지 못했습니다. 다시 조회해 주세요.' : '조회 조건에 해당하는 차량이 없습니다.'}</td></tr>}
              {!loading && rows.map((row, index) => (
                <tr key={row.SERVICE_ID}>
                  <td className="attach-image-index">{firstRow + index}</td>
                  <th scope="row" className="attach-image-old-number"><strong>{row.CAR_NO || '-'}</strong><span className="attach-image-service-id">{row.SERVICE_ID}</span><span className="attach-image-judge-date">{row.JUDGE_DT || '-'}</span></th>
                  <td><PhotoCell row={row} photo={photoSlots[0]} onOpen={setPreview} /></td>
                  <td className="attach-image-new-number"><strong>{(row.MDF_GB === 'PRPNO' ? row.REQ_CAR_NO : row.POST_CAR_NO) || '-'}</strong><span>{row.CAR_NM || '-'}</span>{row.SUBPANNEL && <span className="attach-image-panel-badge">{row.SUBPANNEL}</span>}</td>
                  {photoSlots.slice(1).map((photo) => <td key={photo.slot}><PhotoCell row={row} photo={photo} onOpen={setPreview} />{photo.slot === 5 && row.HAS_OTHER_RETURN_IMAGE === 'Y' && <span className="attach-image-other-photo">별도 첨부 있음</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="attach-image-pagination">
          <span>{firstRow.toLocaleString()}–{lastRow.toLocaleString()} / {total.toLocaleString()}건</span>
          <nav aria-label="사진 목록 페이지">
            <button type="button" aria-label="이전 페이지" disabled={loading || query.page === 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={18} aria-hidden="true" />이전</button>
            <span><strong>{query.page}</strong> / {totalPages.toLocaleString()}</span>
            <button type="button" aria-label="다음 페이지" disabled={loading || query.page >= totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>다음<ChevronRight size={18} aria-hidden="true" /></button>
          </nav>
        </footer>
      </div>
      {preview && <PhotoPreview photo={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
