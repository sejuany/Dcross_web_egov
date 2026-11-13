import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { getProcessPath } from './processNavigation';

const show = (value) => value || '-';
// 기존 운영시간과 동일한 10분 단위 방문 예약 선택값(점심시간 12시 제외).
const visitTimes = [9, 10, 11, 13, 14, 15, 16, 17]
  .flatMap((hour) => Array.from({ length: 6 }, (_, index) => `${String(hour).padStart(2, '0')}:${index}0`));
const savedTime = (item) => item.INSTALL_TIME == null || item.INSTALL_TIME === '' || item.INSTALL_MINUTES == null || item.INSTALL_MINUTES === ''
  ? '' : `${String(item.INSTALL_TIME).padStart(2, '0')}:${String(item.INSTALL_MINUTES).padStart(2, '0')}`;
const koreaDate = (clock) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(clock));
const plateStatusNames = { REQ: '번호 선택 중', END: '배정 완료', N_END: '배정 완료', CAN: '요청 취소', FAIL: '재시도 중', N_FAIL: '재시도 중', EXP: '요청시간 만료', N_EXP: '요청시간 만료' };

function scheduleError(form, detail, today) {
  if (!form.installDate || !form.installTime) return '방문 예정일과 시간을 모두 입력해 주세요.';
  if (detail.INSU_START_DT && form.installDate < detail.INSU_START_DT) return '보험 시작일자부터 방문 가능합니다.';
  const unchanged = form.installDate === detail.INSTALL_DT && form.installTime === savedTime(detail);
  if (form.installDate < today && !unchanged) return '변경할 방문 예정일은 오늘 이후로 선택해 주세요.';
  if (!visitTimes.includes(form.installTime)) return '방문 예정시간을 확인해 주세요.';
  return '';
}

export default function NReqDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ installDate: '', installTime: '', numMemo: '', confirmed: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [plateModalOpen, setPlateModalOpen] = useState(false);
  const [plates, setPlates] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState('');
  const [plateSearch, setPlateSearch] = useState('');
  const [plateLoading, setPlateLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [previewIdCard, setPreviewIdCard] = useState(false);
  const [plateMessage, setPlateMessage] = useState({});
  const [plateMessageError, setPlateMessageError] = useState('');
  const [plateMessageBusy, setPlateMessageBusy] = useState(false);
  const [clock, setClock] = useState(Date.now);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const detailRequest = useRef(null);

  useEffect(() => {
    const updateClock = () => setClock(Date.now());
    const onVisible = () => { if (document.visibilityState === 'visible') updateClock(); };
    const timer = window.setInterval(updateClock, 30000);
    window.addEventListener('focus', updateClock);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateClock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    detailRequest.current = controller;
    setLoading(true);
    setMessage('');
    setDetail(null);
    setPreviewIdCard(false);
    setRefreshRequired(false);
    axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const item = data.data;
        const path = getProcessPath({ ...item, SERVICE_ID: serviceId });
        if (path !== `/numplateapp/request/${encodeURIComponent(serviceId)}`) {
          navigate(path, { replace: true });
          return;
        }
        setDetail(item);
        setForm({
          installDate: item.INSTALL_DT || '',
          installTime: savedTime(item),
          numMemo: item.NUM_MEMO_TX || '',
          confirmed: false,
        });
      })
      .catch((error) => { if (!controller.signal.aborted) setMessage(error.response?.data?.message || '상세정보를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [navigate, serviceId, retryCount]);

  const submit = async (event) => {
    event.preventDefault();
    if (plateMessageBusy || refreshRequired) return setMessage('최신 업무 정보를 확인한 후 심사요청해 주세요.');
    if (scheduleRequired) {
      const error = scheduleError(form, detail, today);
      if (error) return setMessage(error);
      if (detail.READY_YN !== 'Y') return setMessage('출발 문자 전송 후 심사요청이 가능합니다.');
      if (tooEarly) return setMessage('방문 예정시간 30분 전부터 심사요청이 가능합니다.');
    }
    if (!form.confirmed) return setMessage('차량·번호판·방문 정보를 확인해 주세요.');
    if (insuranceIssue) return setMessage('보험 관련 요청사항을 먼저 확인해 주세요.');
    setLoading(true);
    setMessage('');
    try {
      await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/request`, form);
      // 신규등록은 배송 완료 후 사진 등록 업무 없이 처리목록으로 돌아간다.
      navigate(serviceId.startsWith('N') ? '/numplateapp' : `/numplateapp/status/${encodeURIComponent(serviceId)}`, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || '요청을 처리하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    const error = scheduleError(form, detail, today);
    if (error) return setMessage(error);
    // 기존 다코스 예외 담당자는 문자 발송 여부를 선택하고, 그 외 담당자는 기존처럼 함께 발송한다.
    const sendSms = detail.CAN_SEARCH_NUMPLATE
      ? window.confirm('고객에게 방문 일정 안내 문자를 발송하시겠습니까?\n취소를 눌러도 일정은 저장됩니다.')
      : true;
    setSaving('schedule');
    setMessage('');
    try {
      const { data } = await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/schedule`, {
        installDate: form.installDate,
        installTime: form.installTime,
        sendSms,
      });
      setDetail(data.data);
      setMessage('방문 예정일과 시간이 저장되었습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '방문 일정을 저장하지 못했습니다.');
    } finally {
      setSaving('');
    }
  };

  const saveMemo = async () => {
    setSaving('memo');
    setMessage('');
    try {
      const { data } = await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/memo`, {
        numMemo: form.numMemo,
      });
      setDetail(data.data);
      setMessage('탈부착자 메모가 수정되었습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '탈부착자 메모를 수정하지 못했습니다.');
    } finally {
      setSaving('');
    }
  };

  const depart = async () => {
    if (!detail.INSTALL_DT || !savedTime(detail) || form.installDate !== detail.INSTALL_DT || form.installTime !== savedTime(detail)) return setMessage('방문 예정일과 시간을 먼저 저장해 주세요.');
    if (!window.confirm(detail.READY_YN === 'Y' ? '출발 문자를 다시 보내시겠습니까?' : '고객에게 출발 문자를 보내시겠습니까?')) return;
    setSaving('depart');
    setMessage('');
    try {
      const { data } = await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/depart`);
      setDetail(data.data);
      setMessage('출발 문자를 전송했습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '출발 처리를 완료하지 못했습니다.');
    } finally {
      setSaving('');
    }
  };

  const loadPlateMessage = async () => {
    if (!detail.CAN_SEARCH_NUMPLATE) return;
    setPlateMessageError('');
    try {
      const { data } = await axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/plate-message`);
      setPlateMessage(data.data || {});
    } catch (error) {
      setPlateMessageError(error.response?.data?.message || '고객 번호 선택 상태를 확인하지 못했습니다.');
    }
  };

  const refreshCancelledDetail = async (controller = detailRequest.current) => {
    try {
      const { data } = await axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setDetail(data.data);
      setRefreshRequired(false);
      setMessage('고객 번호 선택 요청을 취소했습니다.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setRefreshRequired(true);
      setMessage('고객 번호 선택 요청은 취소했습니다. 최신 업무 정보를 불러오지 못했으니 다시 조회해 주세요.');
    }
  };

  const changePlateMessage = async (cancel) => {
    if (!window.confirm(cancel ? '고객의 번호 선택 요청을 취소하시겠습니까?' : '표시된 후보 번호를 고객에게 문자로 보내시겠습니까?')) return;
    const controller = detailRequest.current;
    setPlateMessageBusy(true);
    setMessage('');
    try {
      const { data } = await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/plate-message${cancel ? '/cancel' : ''}`, cancel ? {} : { displayedPlates: plates });
      if (controller.signal.aborted) return;
      setPlateMessage(data.data || {});
      setPlateMessageError('');
      setMessage(cancel ? '고객 번호 선택 요청을 취소했습니다.' : '고객에게 번호 선택 문자를 발송했습니다.');
      if (cancel) {
        setPlateModalOpen(false); setPlates([]); setSelectedPlate(''); setPlateMessage({});
        await refreshCancelledDetail(controller);
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.response?.data?.message || '고객 번호 선택 요청을 처리하지 못했습니다.');
    } finally {
      if (!controller.signal.aborted) setPlateMessageBusy(false);
    }
  };

  // 기존 JSP의 선택/새로고침/검색은 모두 같은 프로시저를 호출하고, 화면에 보인 번호는 임시 배정 상태로 관리한다.
  const fetchPlates = async (displayedPlates = plates, searchCarNo = '') => {
    setPlateLoading(true);
    setMessage('');
    try {
      const { data } = await axios.post(
        `/api/numplateapp/process/${encodeURIComponent(serviceId)}/available-plates`,
        { displayedPlates, searchCarNo },
      );
      setPlates(data.list || []);
      setSelectedPlate('');
      await loadPlateMessage();
    } catch (error) {
      setMessage(error.response?.data?.message || '사용 가능한 번호판을 조회하지 못했습니다.');
    } finally {
      setPlateLoading(false);
    }
  };

  const openPlateModal = async () => {
    setPlateModalOpen(true);
    setPlateSearch('');
    await fetchPlates(detail.POST_CAR_NO ? [detail.POST_CAR_NO] : [], '');
  };

  const closePlateModal = async () => {
    setPlateLoading(true);
    try {
      await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/plate`, {
        selectedPlate: '',
        displayedPlates: plates,
      });
      setPlateModalOpen(false);
      setPlates([]);
      setSelectedPlate('');
    } catch (error) {
      setMessage(error.response?.data?.message || '번호판 임시 배정을 해제하지 못했습니다.');
    } finally {
      setPlateLoading(false);
    }
  };

  const savePlate = async () => {
    if (!selectedPlate) {
      setMessage('번호판을 선택해 주세요.');
      return;
    }
    setPlateLoading(true);
    try {
      const { data } = await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/plate`, {
        selectedPlate,
        displayedPlates: plates,
      });
      setDetail(data.data);
      setPlateModalOpen(false);
      setPlates([]);
      setSelectedPlate('');
      setMessage('번호판이 저장되었습니다.');
    } catch (error) {
      setMessage(error.response?.data?.message || '번호판을 저장하지 못했습니다.');
    } finally {
      setPlateLoading(false);
    }
  };

  if (!detail) return <section className="numplate-process-page"><p className="numplate-inline-message" role="alert">{message || (loading ? '불러오는 중…' : '처리 건이 없습니다.')}</p>{!loading && <button className="numplate-secondary-button" type="button" onClick={() => setRetryCount((value) => value + 1)}>다시 조회</button>}</section>;

  // N 접수는 배송 확인만 하고, 그 외 건은 일부 회사 예외를 빼고 방문일정을 필수 입력한다.
  const delivery = serviceId.startsWith('N');
  const scheduleRequired = !delivery && detail.COMPANY_ID !== 'CB407';
  const today = koreaDate(clock);
  const scheduleUnchanged = form.installDate === detail.INSTALL_DT && form.installTime === savedTime(detail);
  const normalMinDate = detail.INSU_START_DT && detail.INSU_START_DT > today ? detail.INSU_START_DT : today;
  const minDate = scheduleUnchanged && detail.INSTALL_DT < normalMinDate && (!detail.INSU_START_DT || detail.INSTALL_DT >= detail.INSU_START_DT) ? detail.INSTALL_DT : normalMinDate;
  const invalidSchedule = scheduleRequired ? scheduleError(form, detail, today) : '';
  const departureRequired = scheduleRequired && detail.READY_YN !== 'Y';
  const canSelectPlate = !delivery && detail.ETC5 !== 'Y'
    && detail.SUDO === '수도권' && (detail.SONGJANG_NO || '없음') === '없음';
  const insuranceIssue = !delivery && (detail.TN_MEMO_TX || '').includes('#보험');
  const tooEarly = scheduleRequired && form.installDate && form.installTime
    && new Date(`${form.installDate}T${form.installTime}:00+09:00`).getTime() > clock + (30 * 60 * 1000);

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>{delivery ? '배송건 세부정보' : '번호판 처리요청'}</h1><span>{serviceId}</span></div>
        <button type="button" onClick={() => navigate(-1)}>목록</button>
      </div>

      <div className="numplate-detail-grid">
        {!delivery && <div><span>기존 차량번호</span><strong>{show(detail.CAR_NO)}</strong></div>}
        <div className="numplate-new-number">
          <span>신규 차량번호</span>
          <strong>{!delivery && detail.ETC5 === 'Y' ? '번호판재발급' : show(detail.POST_CAR_NO)}</strong>
          {canSelectPlate && <button type="button" onClick={openPlateModal}>번호판 선택</button>}
        </div>
        <div><span>차명 / 연식</span><strong>{show([detail.CAR_NAME, detail.MADE_YY].filter(Boolean).join(' / '))}</strong></div>
        <div><span>차량 색상</span><strong>{show(detail.COLOR_GB)}</strong></div>
        <div><span>등록 관청</span><strong>{show(detail.GOVT_ID_K)}</strong></div>
        <div><span>고객명</span><strong>{show(detail.BUY_NM)}</strong></div>
        <div><span>연락처</span><strong>{detail.TEL_NO ? <a href={`tel:${detail.TEL_NO}`}>{detail.TEL_NO}</a> : '-'}</strong></div>
        <div><span>탈부착·배송 주소</span><strong>{show(detail.LAST_DELIVERY_ADDR)}</strong></div>
        <div><span>보조판 종류</span><strong>{show(detail.BOND_NM)}</strong></div>
        <div><span>처리상태</span><strong>{show(detail.PROC_ST_NM || detail.PROC_ST)}</strong></div>
        {!delivery && detail.COMPANY_ID !== 'CB407' && <>
          <div className="numplate-tracking-row"><span>송장번호</span><strong>{show(detail.SONGJANG_NO)}</strong>{detail.SONGJANG_NO && detail.SONGJANG_NO !== '없음' ? <a className="numplate-tracking-link" href={`https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(String(detail.SONGJANG_NO).replace(/-/g, ''))}&displayHeader=N`} target="_blank" rel="noopener noreferrer">배송조회</a> : <button type="button" className="numplate-tracking-link" disabled>배송조회</button>}</div>
          <div><span>등록증 주소</span><strong>{show(detail.CARP_ADDRESS)}</strong></div>
        </>}
        {!delivery && <div><span>보험 시작일자</span><strong>{show(detail.INSU_START_DT)}</strong></div>}
      </div>

      {!delivery && detail.INSTALL_DT && detail.INSTALL_DT <= today && (detail.IMAGE4 || detail.IMAGE4_PATH) && <section className="numplate-status-section numplate-request-id-card"><h2>등록된 신분증 확인</h2><button type="button" className="numplate-image-preview" onClick={() => setPreviewIdCard(true)} aria-label="등록된 신분증 크게 보기"><img src={`/api/numplateapp/process/${encodeURIComponent(serviceId)}/images/4`} alt="등록된 신분증" /></button></section>}

      <form className="numplate-request-form" onSubmit={submit} aria-label="번호판 처리 요청">
        {!delivery && (
          <div className="numplate-schedule-row">
            <label><span>방문 예정일</span><input type="date" min={minDate} value={form.installDate} onChange={(event) => setForm({ ...form, installDate: event.target.value })} required={scheduleRequired} /></label>
            <label><span>방문 예정시간</span><select value={form.installTime} onChange={(event) => setForm({ ...form, installTime: event.target.value })} required={scheduleRequired}><option value="">시간 선택</option>{visitTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
            <button className="numplate-save-button" type="button" onClick={saveSchedule} disabled={loading || Boolean(saving)}>{saving === 'schedule' ? '저장 중…' : '저장'}</button>
          </div>
        )}
        {!delivery && <button className="numplate-secondary-button" type="button" onClick={depart} disabled={loading || Boolean(saving)}>{saving === 'depart' ? '출발 처리 중…' : (detail.READY_YN === 'Y' ? '출발 문자 재전송' : '출발')}</button>}
        <label><span>요청사항</span><textarea value={detail.MEMO_TX || ''} readOnly /></label>
        {detail.COMPANY_ID !== 'CB407' && (
          <div className="numplate-memo-row">
            <label><span>탈부착자 메모</span><textarea value={form.numMemo} maxLength={1000} onChange={(event) => setForm({ ...form, numMemo: event.target.value })} /></label>
            <button className="numplate-save-button" type="button" onClick={saveMemo} disabled={loading || Boolean(saving)}>{saving === 'memo' ? '수정 중…' : '수정'}</button>
          </div>
        )}
        <label className="numplate-confirm">
          <input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} required />
          {delivery ? '배송할 번호판과 수령 정보를 확인했습니다.' : '차량·번호판·방문 정보를 모두 확인했습니다.'}
        </label>
        {message && <p className="numplate-inline-message" role="alert">{message}</p>}
        {refreshRequired && <button type="button" onClick={() => { setPlateMessageBusy(true); refreshCancelledDetail().finally(() => setPlateMessageBusy(false)); }} disabled={plateMessageBusy}>최신 정보 다시 조회</button>}
        {insuranceIssue && <p className="numplate-status-warning" role="alert">보험 관련 요청사항을 먼저 확인해 주세요.</p>}
        {tooEarly && <p className="numplate-status-warning" role="alert">방문 예정시간 30분 전부터 심사요청이 가능합니다.</p>}
        {departureRequired && <p className="numplate-status-warning">출발 문자 전송 후 심사요청이 가능합니다.</p>}
        {invalidSchedule && <p className="numplate-status-warning">{invalidSchedule}</p>}
        <button className="numplate-primary-button" type="submit" disabled={loading || Boolean(saving) || plateMessageBusy || refreshRequired || !form.confirmed || insuranceIssue || tooEarly || departureRequired || Boolean(invalidSchedule)}>{loading ? '처리 중…' : (delivery ? '배송처리' : '심사요청')}</button>
      </form>

      {plateModalOpen && (
        <div className="numplate-modal-backdrop">
          <section className="numplate-plate-modal" role="dialog" aria-modal="true" aria-labelledby="plate-modal-title">
            <header>
              <div><h2 id="plate-modal-title">차량번호 선택</h2><span>{show(detail.NUM_KIND)} · {show(detail.CAR_KD)}</span></div>
              <button type="button" onClick={() => fetchPlates(plates, '')} disabled={plateLoading || plateMessageBusy} aria-label="번호판 새로고침">↻</button>
            </header>

            {detail.CAN_SEARCH_NUMPLATE && (
              <form className="numplate-plate-search" onSubmit={(event) => { event.preventDefault(); fetchPlates(plates, plateSearch); }}>
                <input value={plateSearch} maxLength={12} onChange={(event) => setPlateSearch(event.target.value.replace(/[^0-9가-힣]/g, ''))} placeholder="희망 번호 검색" aria-label="희망 번호" />
                <button type="submit" disabled={plateLoading || plateMessageBusy}>검색</button>
              </form>
            )}

            {detail.CAN_SEARCH_NUMPLATE && <section className="numplate-plate-message" aria-label="고객 번호 선택 문자">
              <h3>고객 번호 선택 문자</h3>
              <dl><dt>선택 상태</dt><dd>{plateStatusNames[plateMessage.NUM_SELECT_ST] || plateMessage.NUM_SELECT_ST || '요청 없음'}</dd><dt>확정번호</dt><dd>{plateMessage.CONFIRM_NO || '-'}</dd></dl>
              {plateMessageError && <p role="alert">{plateMessageError}</p>}
              <div><button type="button" onClick={() => { setPlateMessageBusy(true); loadPlateMessage().finally(() => setPlateMessageBusy(false)); }} disabled={plateLoading || plateMessageBusy}>상태 확인</button><button type="button" onClick={() => changePlateMessage(true)} disabled={plateLoading || plateMessageBusy || Boolean(plateMessageError)} >요청취소</button><button type="button" onClick={() => changePlateMessage(false)} disabled={plateLoading || plateMessageBusy || plates.length === 0 || Boolean(plateMessageError)}>{plateMessageBusy ? '처리 중…' : '문자발송'}</button></div>
            </section>}

            <div className="numplate-plate-list">
              {plates.map((plate) => (
                <label key={plate} className={selectedPlate === plate ? 'selected' : ''}>
                  <input type="radio" name="selectedPlate" value={plate} checked={selectedPlate === plate} onChange={() => setSelectedPlate(plate)} />
                  <span>{plate}</span>
                </label>
              ))}
              {!plateLoading && plates.length === 0 && <p>배정 가능한 번호판이 없습니다.</p>}
              {plateLoading && <p>번호판을 확인하는 중입니다.</p>}
            </div>

            {message && <p className="numplate-inline-message" role="alert">{message}</p>}
            <p className="numplate-plate-warning">번호를 선택하지 않을 때는 반드시 취소를 눌러 임시 배정을 해제해 주세요.</p>
            <footer>
              <button type="button" onClick={closePlateModal} disabled={plateLoading || plateMessageBusy}>취소</button>
              <button type="button" className="save" onClick={savePlate} disabled={plateLoading || plateMessageBusy || !selectedPlate}>저장</button>
            </footer>
          </section>
        </div>
      )}
      {previewIdCard && <button type="button" className="numplate-image-modal" onClick={() => setPreviewIdCard(false)} aria-label="신분증 확대 사진 닫기"><img src={`/api/numplateapp/process/${encodeURIComponent(serviceId)}/images/4`} alt="등록된 신분증 확대 사진" /></button>}
    </section>
  );
}
