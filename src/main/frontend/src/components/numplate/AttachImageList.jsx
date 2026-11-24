import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Camera, ChevronLeft, ChevronRight, Expand, ImageOff, RefreshCw, Search, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './AttachImageList.css';

const photoSlots = [
  { slot: 1, label: '기존 번호판' },
  { slot: 2, label: '신규 앞 번호판' },
  { slot: 3, label: '신규 뒤 번호판' },
  { slot: 4, label: '신분증' },
  { slot: 5, label: '폐번호판' },
  { slot: 'samsong', label: '폐번호판(삼송)', readOnly: true },
  { slot: 6, label: '서명', rtrnsOnly: true },
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DRIVE_READY_CONFIRM = '등록된 사진이 해당 차량의 (기존/신규)번호판이 맞습니까?\n[확인]을 누르면 차량 운행 가능 문자가 발송됩니다.\n반드시 검토 후 [확인]을 눌러주세요.';

function initialFilters(workCd = '011') {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { workCd, carNo: '', startDate: today, endDate: today, missingReturnPlate: false, allImages: false };
}

function imageUrl(serviceId, slot, version = 0) {
  const base = `/api/attach/images/${encodeURIComponent(serviceId)}/${slot}`;
  return version ? `${base}?v=${version}` : base;
}

function hasSavedImage(row, slot) {
  if (slot === 'samsong') return row.HAS_OTHER_RETURN_IMAGE === 'Y';
  return row[`IMAGE${slot}_YN`] === 'Y';
}

function canUploadSlot(row, photo) {
  if (photo.readOnly) return false;
  if (photo.rtrnsOnly) return row.TASK_CD === 'RTRNS';
  return true;
}

function PhotoCell({ row, photo, version = 0, onOpen, onUploaded }) {
  const [failed, setFailed] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);
  const uploadable = canUploadSlot(row, photo);
  const saved = hasSavedImage(row, photo.slot);
  const serverSource = imageUrl(row.SERVICE_ID, photo.slot, version);
  const activeSource = previewUrl || serverSource;
  const showImage = Boolean(previewUrl) || (saved && !failed);

  useEffect(() => setFailed(false), [serverSource]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setStatus({ type: 'error', text: 'JPG 또는 PNG 파일만 선택할 수 있습니다.' });
      event.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus({ type: 'error', text: '10MB 이하 파일만 선택할 수 있습니다.' });
      event.target.value = '';
      return;
    }
    setStatus(null);
    setSelectedFile(file);
  };

  const upload = async () => {
    if (!selectedFile || uploading) return;
    const shouldAskSms = photo.slot === 3 && Boolean(row.CAR_NO) && row.HAS_RECEIVE_TEL === 'Y';
    const sendDriveReadySms = shouldAskSms ? window.confirm(DRIVE_READY_CONFIRM) : false;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('sendDriveReadySms', String(sendDriveReadySms));
    setUploading(true);
    setStatus(null);
    try {
      const { data } = await axios.post(`/api/attach/images/${encodeURIComponent(row.SERVICE_ID)}/${photo.slot}`, formData);
      if (!data?.success) {
        setStatus({ type: 'error', text: data?.message || '업로드하지 못했습니다.' });
        return;
      }
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setFailed(false);
      onUploaded(row.SERVICE_ID, photo.slot);
      setStatus({ type: 'ok', text: '업로드 완료' });
      if (data.data?.smsSent) {
        window.alert('업로드 및 운행 가능 문자가 전송 되었습니다.');
      }
    } catch (exception) {
      setStatus({ type: 'error', text: exception.response?.data?.message || '업로드 중 오류가 발생했습니다.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="attach-image-cell">
      {showImage ? (
        <button
          type="button"
          className={`attach-image-thumbnail${previewUrl ? ' attach-image-thumbnail-staged' : ''}`}
          aria-label={`${row.CAR_NO || row.SERVICE_ID} ${photo.label} 사진 확대`}
          onClick={() => onOpen({ source: activeSource, label: photo.label, row })}
        >
          <img
            src={activeSource}
            alt={`${row.CAR_NO || row.SERVICE_ID} ${photo.label}`}
            loading="lazy"
            onError={() => { if (!previewUrl) setFailed(true); }}
          />
          {previewUrl && <span className="attach-image-staged-badge">선택됨</span>}
          <span className="attach-image-thumbnail-action"><Expand size={13} aria-hidden="true" /> 확대</span>
        </button>
      ) : (
        <div className={`attach-image-placeholder${failed ? ' attach-image-placeholder-error' : ''}`}>
          <ImageOff size={23} aria-hidden="true" />
          <span>{failed ? '불러오기 실패' : '미등록'}</span>
        </div>
      )}
      {uploadable && (
        <div className="attach-image-upload-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="attach-image-file-input"
            onChange={selectFile}
            disabled={uploading}
          />
          <button
            type="button"
            className="attach-image-mini-btn"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            사진선택
          </button>
          <button
            type="button"
            className="attach-image-mini-btn attach-image-mini-btn-upload"
            disabled={!selectedFile || uploading}
            onClick={upload}
          >
            <Upload size={11} aria-hidden="true" />
            {uploading ? '저장중' : '업로드'}
          </button>
        </div>
      )}
      {status && (
        <span className={`attach-image-cell-status attach-image-cell-status-${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
          {status.text}
        </span>
      )}
    </div>
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

export default function AttachImageList({ accountWorkCd } = {}) {
  const { user } = useAuth();
  const companyId = user?.company_ID || user?.COMPANY_ID;
  const loginId = user?.login_ID || user?.LOGIN_ID || '';
  const requiredImageCount = companyId === 'DC001' ? 5
    : (['CB062', 'CB035'].includes(companyId)
      || (companyId === 'dacos' && (loginId.startsWith('dacos') || loginId.startsWith('call')))) ? 4 : 0;
  const requiredPhotos = photoSlots.slice(0, requiredImageCount);
  const [draft, setDraft] = useState(() => initialFilters(accountWorkCd));
  const [query, setQuery] = useState(() => ({ ...initialFilters(accountWorkCd), page: 1, size: 10 }));
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [visibleCount, setVisibleCount] = useState(10);
  const [versions, setVersions] = useState({});
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
    setVisibleCount(10);
    axios.get('/api/attach/images', { params: query, signal: controller.signal })
      .then(({ data }) => {
        if (requestId !== requestRef.current || controller.signal.aborted) return;
        if (!data.success) {
          setError(data.message || '사진 목록을 조회하지 못했습니다.');
          return;
        }
        const result = data.data;
        const resultTotal = Number(result.total) || 0;
        if (!query.allImages) {
          const lastPage = Math.max(1, Math.ceil(resultTotal / query.size));
          if (query.page > lastPage) {
            setQuery((current) => ({ ...current, page: lastPage }));
            return;
          }
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

  useEffect(() => {
    if (!query.allImages || loading || visibleCount >= rows.length) return;
    const wrap = tableRef.current;
    if (wrap && wrap.scrollHeight <= wrap.clientHeight + 20) {
      setVisibleCount((current) => Math.min(rows.length, current + 10));
    }
  }, [loading, query.allImages, rows.length, visibleCount]);

  const handleTableScroll = useCallback((event) => {
    if (!query.allImages) return;
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60) {
      setVisibleCount((current) => (current < rows.length ? Math.min(rows.length, current + 10) : current));
    }
  }, [query.allImages, rows.length]);

  const handleUploaded = useCallback((serviceId, slot) => {
    setRows((current) => current.map((item) => (
      item.SERVICE_ID === serviceId ? { ...item, [`IMAGE${slot}_YN`]: 'Y' } : item
    )));
    setVersions((current) => ({
      ...current,
      [`${serviceId}:${slot}`]: (current[`${serviceId}:${slot}`] || 0) + 1,
    }));
  }, []);

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
  const displayedRows = query.allImages ? rows.slice(0, visibleCount) : rows;
  const totalPages = Math.max(1, Math.ceil(total / query.size));
  const firstRow = query.allImages ? (displayedRows.length ? 1 : 0) : (total ? (query.page - 1) * query.size + 1 : 0);
  const lastRow = query.allImages ? displayedRows.length : Math.min(query.page * query.size, total);

  return (
    <section className="attach-image-page" aria-label="탈부착 이미지 관리">
      <div className="attach-image-page-header">
        <div className="attach-image-heading">
          <span className="attach-image-heading-icon"><Camera size={23} aria-hidden="true" /></span>
          <div><h1>탈부착 이미지 관리</h1><p>차량별 등록 사진을 확인하고 필요한 사진을 바로 업로드하세요.</p></div>
        </div>
        <div className="attach-image-total" role="status" aria-live="polite">전체 <strong>{total.toLocaleString()}</strong>건</div>
      </div>

      <form className="attach-image-search" onSubmit={search} aria-label="탈부착 이미지 검색">
        <div className="attach-image-search-fields">
          <label className="attach-image-field">신청구분
            <select disabled={Boolean(accountWorkCd)} value={draft.workCd} onChange={(event) => changeFilter('workCd', event.target.value)}>
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
          <div className="attach-image-checkbox-group">
            <label className="attach-image-checkbox"><input type="checkbox" checked={draft.missingReturnPlate} onChange={(event) => changeFilter('missingReturnPlate', event.target.checked)} />폐번호판 미등록건</label>
            <label className="attach-image-checkbox"><input type="checkbox" checked={draft.allImages} onChange={(event) => changeFilter('allImages', event.target.checked)} />전체 이미지 확인</label>
          </div>
          <span>사진을 누르면 크게 볼 수 있으며, 사진선택 후 업로드로 바로 등록할 수 있습니다.</span>
        </div>
        {validation && <p className="attach-image-validation" role="alert">{validation}</p>}
      </form>

      {error && <div className="attach-image-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRefresh((value) => value + 1)}>다시 조회</button></div>}

      <div className="attach-image-results">
        <div className="attach-image-results-bar">
          <div><strong>{query.workCd === '030' ? '변경등록' : '이전등록'}</strong><span>{query.startDate} ~ {query.endDate}</span></div>
          {!query.allImages && (
            <label>표시 건수<select aria-label="페이지당 표시 건수" value={query.size} disabled={loading} onChange={(event) => setQuery((current) => ({ ...current, size: Number(event.target.value), page: 1 }))}>
              <option value={10}>10건</option><option value={20}>20건</option><option value={50}>50건</option>
            </select></label>
          )}
        </div>
        <p className="attach-image-mobile-hint">표를 좌우로 움직여 모든 사진을 확인하세요.</p>
        <div className="attach-image-table-wrap" ref={tableRef} onScroll={handleTableScroll} tabIndex={0} role="region" aria-label="탈부착 이미지 조회 결과" aria-busy={loading}>
          <table className="attach-image-table">
            <caption>차량별 기존·신규 번호판, 신분증, 폐번호판, 폐번호판(삼송)과 서명 사진</caption>
            <thead><tr>
              <th scope="col" className="attach-image-index">순번</th><th scope="col" className="attach-image-old-number">기존 차량번호</th>
              <th scope="col">기존 번호판</th><th scope="col" className="attach-image-new-number">신규 차량번호</th>
              {photoSlots.slice(1).map((photo) => <th scope="col" key={photo.slot}>{photo.label}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="attach-image-table-message"><span className="attach-image-loading" aria-hidden="true" />사진 목록을 불러오는 중입니다.</td></tr>}
              {!loading && !displayedRows.length && <tr><td colSpan={10} className="attach-image-table-message">{error ? '목록을 불러오지 못했습니다. 다시 조회해 주세요.' : '조회 조건에 해당하는 차량이 없습니다.'}</td></tr>}
              {!loading && displayedRows.map((row, index) => (
                <tr key={row.SERVICE_ID} className={requiredImageCount
                  ? `attach-image-row-${requiredPhotos.every(({ slot }) => hasSavedImage(row, slot)) ? 'complete' : 'incomplete'}`
                  : undefined}>
                  <td className="attach-image-index">{firstRow + index}</td>
                  <th scope="row" className="attach-image-old-number"><strong>{row.CAR_NO || '-'}</strong><span className="attach-image-service-id">{row.SERVICE_ID}</span><span className="attach-image-judge-date">{row.JUDGE_DT || '-'}</span></th>
                  <td><PhotoCell row={row} photo={photoSlots[0]} version={versions[`${row.SERVICE_ID}:${photoSlots[0].slot}`] || 0} onOpen={setPreview} onUploaded={handleUploaded} /></td>
                  <td className="attach-image-new-number"><strong>{(row.MDF_GB === 'PRPNO' ? row.REQ_CAR_NO : row.POST_CAR_NO) || '-'}</strong><span>{row.CAR_NM || '-'}</span>{row.SUBPANNEL && <span className="attach-image-panel-badge">{row.SUBPANNEL}</span>}</td>
                  {photoSlots.slice(1).map((photo) => (
                    <td key={photo.slot}>
                      <PhotoCell
                        row={row}
                        photo={photo}
                        version={versions[`${row.SERVICE_ID}:${photo.slot}`] || 0}
                        onOpen={setPreview}
                        onUploaded={handleUploaded}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="attach-image-pagination">
          <span>{firstRow.toLocaleString()}–{lastRow.toLocaleString()} / {total.toLocaleString()}건</span>
          {query.allImages ? (
            <span>{displayedRows.length < rows.length ? '아래로 스크롤하면 10건씩 추가 표시됩니다.' : '조회된 이미지를 모두 표시했습니다.'}</span>
          ) : (
            <nav aria-label="사진 목록 페이지">
              <button type="button" aria-label="이전 페이지" disabled={loading || query.page === 1} onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={18} aria-hidden="true" />이전</button>
              <span><strong>{query.page}</strong> / {totalPages.toLocaleString()}</span>
              <button type="button" aria-label="다음 페이지" disabled={loading || query.page >= totalPages} onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>다음<ChevronRight size={18} aria-hidden="true" /></button>
            </nav>
          )}
        </footer>
      </div>
      {preview && <PhotoPreview photo={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
