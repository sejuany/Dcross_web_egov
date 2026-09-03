import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

const show = (value) => value || '-';
const requestStates = new Set(['N_REQ', 'N_INS', 'N_DLV']);
const photoStates = new Set([
  '번호판사진등록요청', '번호판 사진을 다시 등록해 주세요.',
  '신분증사진등록요청', '서명 진행 전 신분증사진등록요청',
  '서명 진행 요청', '번호판사진등록완료',
]);
const slots = [[1, '기존 번호판'], [2, '신규 번호판'], [3, '차대번호'], [4, '신분증'], [6, '서명']];

/** 기존 processStatus.jsp의 상태별 조회·사진·요청 기능을 모바일 웹으로 제공한다. */
export default function ProcessStatus() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [memo, setMemo] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState('');
  const [imageVersion, setImageVersion] = useState(0);
  const [preview, setPreview] = useState(null);
  const [paper, setPaper] = useState({ type: '', destination: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [subPanelUsed, setSubPanelUsed] = useState('');
  const [subPanelSaved, setSubPanelSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}`);
      const item = data.data;
      // 기존 컨트롤러처럼 아직 심사요청 전 상태이면 입력 화면으로 돌려보낸다.
      if (requestStates.has(item.PROC_ST) || (serviceId.startsWith('N') && item.INSTALL_YN !== 'Y')) {
        navigate(`/numplateapp/request/${encodeURIComponent(serviceId)}`, { replace: true });
        return;
      }
      setDetail(item);
      setMemo(item.NUM_MEMO_TX || '');
      setSubPanelUsed('');
      setSubPanelSaved(false);
    } catch (error) {
      setMessage(error.response?.data?.message || '처리결과를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [navigate, serviceId]);

  useEffect(() => { load(); }, [load]);

  const run = async (name, action, successMessage) => {
    setWorking(name);
    setMessage('');
    try {
      const result = await action();
      if (result?.data?.data) {
        setDetail(result.data.data);
        setMemo(result.data.data.NUM_MEMO_TX || '');
      }
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error.response?.data?.message || '요청을 처리하지 못했습니다.');
      return false;
    } finally {
      setWorking('');
    }
  };

  const saveMemo = () => run(
    'memo',
    () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/memo`, { numMemo: memo }),
    '탈부착자 메모를 수정했습니다.',
  );

  const uploadPhoto = async (slot, file) => {
    if (!file) return;
    if (needsSubPanelChoice && !subPanelSaved) {
      setMessage('사진 촬영 전에 보조판 사용 여부를 저장해 주세요.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    const ok = await run(
      `image-${slot}`,
      () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/images/${slot}`, body),
      '사진을 등록했습니다.',
    );
    if (ok) setImageVersion((value) => value + 1);
  };

  const requestPaper = async (event) => {
    event.preventDefault();
    const ok = await run(
      'paper',
      () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/car-paper`, paper),
      '등록증 발송을 요청했습니다.',
    );
    if (ok) setPaper({ type: '', destination: '' });
  };

  const requestIdCard = () => {
    if (!window.confirm('고객에게 신분증 등록 요청 문자를 보내시겠습니까?')) return;
    run('id-card', () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/id-card-request`), '신분증 등록 요청 문자를 전송했습니다.');
  };

  const cancelReview = async (event) => {
    event.preventDefault();
    if (!window.confirm('심사요청을 취소하시겠습니까?')) return;
    const ok = await run(
      'cancel',
      () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/cancel-review`, { reason: cancelReason }),
      '심사취소를 요청했습니다.',
    );
    if (ok) setCancelReason('');
  };

  const finishPhotos = async () => {
    if (!window.confirm('사진 등록을 완료하고 고객에게 완료 문자를 보내시겠습니까?')) return;
    const ok = await run('complete', () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/photos-complete`), '사진 등록 완료 문자를 전송했습니다.');
    if (ok) navigate('/numplateapp/returns');
  };

  const saveSubPanel = async () => {
    if (!subPanelUsed) {
      setMessage('보조판 사용 여부를 선택해 주세요.');
      return;
    }
    const current = detail.BOND_YN === 'Y' ? '사용' : (detail.BOND_YN === 'N' ? '미사용' : '고급형');
    const selected = subPanelUsed === 'Y' ? '사용' : '미사용';
    if (current !== selected && !window.confirm(`보조판 사용 여부를 ${current} → ${selected}(으)로 변경하시겠습니까?`)) return;
    const ok = await run(
      'sub-panel',
      () => axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/sub-panel`, { used: subPanelUsed }),
      '보조판 사용 여부를 저장했습니다.',
    );
    if (ok) setSubPanelSaved(true);
  };

  const statusName = detail?.PROC_ST_NM || detail?.PROC_ST || '';
  const workflowStatus = statusName.replace(/\((?:전시장|임시판|임시)\)$/, '');
  const visibleSlots = useMemo(() => slots.filter(([slot]) => slot !== 6 || ['UTRNS', 'RTRNS'].includes(detail?.TASK_CD)), [detail?.TASK_CD]);
  const hasImage = (slot) => Boolean(detail?.[`IMAGE${slot}`] || detail?.[`IMAGE${slot}_PATH`]);
  const imageUrl = (slot) => `/image.do?key=${encodeURIComponent(serviceId)}&resize=false&img=${slot}&v=${imageVersion}`;
  const showPhotos = detail && (photoStates.has(workflowStatus) || visibleSlots.some(([slot]) => hasImage(slot)));
  const canEditPhotos = photoStates.has(workflowStatus);
  const needsSubPanelChoice = canEditPhotos && Boolean(detail?.BOND_YN)
    && detail.BOND_YN !== 'N' && ![1, 2, 3].every((slot) => hasImage(slot));

  if (!detail) {
    return <section className="numplate-process-page"><p className="numplate-inline-message" role="alert">{message || (loading ? '불러오는 중입니다.' : '처리 건이 없습니다.')}</p></section>;
  }

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>처리상태 조회</h1><span>{serviceId}</span></div>
        <button type="button" onClick={load} disabled={loading || Boolean(working)}>{loading ? '조회 중' : '새로고침'}</button>
      </div>

      {detail.CARD_YN === 'Y' && detail.CARD_PAY_YN !== 'Y' && <p className="numplate-status-warning" role="alert">카드 결제 건입니다. 카드 납부 완료 여부를 확인해 주세요.</p>}

      <div className="numplate-status-card">
        <div className="numplate-status-badge">{serviceId.startsWith('N') && detail.INSTALL_YN === 'Y' ? '배송처리 완료' : statusName}</div>
        <dl>
          <dt>기존 차량번호</dt><dd>{show(detail.CAR_NO)}</dd>
          <dt>신규 차량번호</dt><dd>{detail.ETC5 === 'Y' ? '번호판 재발급' : show(detail.POST_CAR_NO)}</dd>
          <dt>차명</dt><dd>{show(detail.CAR_NAME)}</dd>
          <dt>보조판 종류</dt><dd>{show(detail.BOND_NM)}</dd>
          <dt>고객명</dt><dd>{show(detail.BUY_NM)}</dd>
          <dt>연락처</dt><dd>{detail.TEL_NO ? <a href={`tel:${detail.TEL_NO}`}>{detail.TEL_NO}</a> : '-'}</dd>
          <dt>방문일시</dt><dd>{[detail.INSTALL_DT, detail.INSTALL_TIME && `${detail.INSTALL_TIME}:${detail.INSTALL_MINUTES}`].filter(Boolean).join(' ') || '-'}</dd>
          <dt>탈부착 주소</dt><dd>{show(detail.LAST_DELIVERY_ADDR)}</dd>
          <dt>등록증 배송 주소</dt><dd>{show(detail.CARP_ADDRESS)}</dd>
          <dt>요청사항</dt><dd>{show(detail.MEMO_TX)}</dd>
        </dl>
      </div>

      {detail.COMPANY_ID !== 'CB407' && <div className="numplate-status-section">
        <h2>탈부착자 메모</h2>
        <div className="numplate-memo-row"><textarea value={memo} maxLength={1000} onChange={(event) => setMemo(event.target.value)} /><button className="numplate-save-button" type="button" onClick={saveMemo} disabled={Boolean(working)}>{working === 'memo' ? '수정 중' : '수정'}</button></div>
      </div>}

      <details className="numplate-status-section">
        <summary>등록증 발송 요청</summary>
        <form className="numplate-action-form" onSubmit={requestPaper}>
          <select value={paper.type} onChange={(event) => setPaper({ type: event.target.value, destination: '' })} required><option value="">발송 방법 선택</option><option value="SMS">문자</option><option value="FAX">팩스</option><option value="MAIL">이메일</option></select>
          {paper.type && <input type={paper.type === 'MAIL' ? 'email' : 'tel'} value={paper.destination} onChange={(event) => setPaper({ ...paper, destination: event.target.value })} placeholder={paper.type === 'MAIL' ? 'example@email.com' : '010-0000-0000'} maxLength={100} required />}
          <button type="submit" disabled={Boolean(working) || !paper.type}>{working === 'paper' ? '요청 중' : '요청'}</button>
        </form>
      </details>

      {showPhotos && (
        <section className="numplate-status-section">
          <h2>번호판 사진 등록</h2>
          <p className="numplate-photo-guide">사진을 누르면 크게 볼 수 있습니다. 신분증 사진은 필요한 부분만 보이도록 촬영하고 완료 후 휴대폰에서도 삭제해 주세요.</p>
          {needsSubPanelChoice && <div className="numplate-sub-panel-choice">
            <strong>보조판 사용 여부</strong>
            <label><input type="radio" name="subPanelUsed" value="Y" checked={subPanelUsed === 'Y'} onChange={(event) => { setSubPanelUsed(event.target.value); setSubPanelSaved(false); }} /> 사용</label>
            <label><input type="radio" name="subPanelUsed" value="N" checked={subPanelUsed === 'N'} onChange={(event) => { setSubPanelUsed(event.target.value); setSubPanelSaved(false); }} /> 미사용</label>
            <button type="button" onClick={saveSubPanel} disabled={Boolean(working) || subPanelSaved}>{subPanelSaved ? '저장됨' : (working === 'sub-panel' ? '저장 중' : '저장')}</button>
          </div>}
          <div className="numplate-status-images">
            {visibleSlots.map(([slot, label]) => (
              <div key={slot}>
                <strong>{label}</strong>
                {hasImage(slot) ? <button type="button" className="numplate-image-preview" onClick={() => setPreview(slot)}><img src={imageUrl(slot)} alt={`${label} 등록 사진`} /></button> : <span className="numplate-image-empty">미등록</span>}
                {canEditPhotos && <label className="numplate-photo-button">{working === `image-${slot}` ? '등록 중' : (hasImage(slot) ? '재촬영' : '사진 촬영')}<input type="file" accept="image/*" capture="environment" disabled={Boolean(working)} onChange={(event) => uploadPhoto(slot, event.target.files?.[0])} /></label>}
              </div>
            ))}
          </div>
          {workflowStatus === '번호판사진등록완료' && <button className="numplate-primary-button" type="button" onClick={finishPhotos} disabled={Boolean(working)}>{working === 'complete' ? '처리 중' : '사진등록 완료'}</button>}
        </section>
      )}

      <div className="numplate-status-actions">
        <button type="button" onClick={requestIdCard} disabled={Boolean(working)}>{working === 'id-card' ? '전송 중' : '신분증 등록 요청'}</button>
        <button type="button" onClick={() => navigate('/numplateapp')}>처리목록으로</button>
      </div>

      {detail.PROC_ST === 'S_REQ' && (
        <form className="numplate-cancel-review" onSubmit={cancelReview}><h2>심사취소</h2><input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={2} maxLength={500} placeholder="심사취소 사유" required /><button type="submit" disabled={Boolean(working)}>{working === 'cancel' ? '취소 처리 중' : '심사취소'}</button></form>
      )}

      {message && <p className="numplate-inline-message" role="status">{message}</p>}
      {preview && <button type="button" className="numplate-image-modal" onClick={() => setPreview(null)} aria-label="확대 사진 닫기"><img src={imageUrl(preview)} alt="확대 사진" /></button>}
    </section>
  );
}
