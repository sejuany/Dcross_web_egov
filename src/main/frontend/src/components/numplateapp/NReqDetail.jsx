import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

const show = (value) => value || '-';
// 기존 운영시간과 동일한 10분 단위 방문 예약 선택값(점심시간 12시 제외).
const visitTimes = [9, 10, 11, 13, 14, 15, 16, 17]
  .flatMap((hour) => Array.from({ length: 6 }, (_, index) => `${String(hour).padStart(2, '0')}:${index}0`));

export default function NReqDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ installDate: '', installTime: '', numMemo: '', confirmed: false });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [plateModalOpen, setPlateModalOpen] = useState(false);
  const [plates, setPlates] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState('');
  const [plateSearch, setPlateSearch] = useState('');
  const [plateLoading, setPlateLoading] = useState(false);

  useEffect(() => {
    // URL의 접수번호로 상세를 읽고 기존 방문정보·메모를 입력 폼의 초기값으로 사용한다.
    axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}`)
      .then(({ data }) => {
        const item = data.data;
        setDetail(item);
        setForm({
          installDate: item.INSTALL_DT || '',
          installTime: item.INSTALL_TIME && item.INSTALL_MINUTES ? `${item.INSTALL_TIME}:${item.INSTALL_MINUTES}` : '',
          numMemo: item.NUM_MEMO_TX || '',
          confirmed: false,
        });
      })
      .catch((error) => setMessage(error.response?.data?.message || '상세정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [serviceId]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await axios.post(`/api/numplateapp/process/${encodeURIComponent(serviceId)}/request`, form);
      // 저장과 상태 변경이 완료되면 뒤로가기로 중복 제출되지 않도록 결과 화면으로 교체한다.
      navigate(`/numplateapp/status/${encodeURIComponent(serviceId)}`, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || '요청을 처리하지 못했습니다.');
    } finally {
      setLoading(false);
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

  if (!detail) return <section className="numplate-process-page"><p className="numplate-inline-message" role="alert">{message || (loading ? '불러오는 중…' : '처리 건이 없습니다.')}</p></section>;

  // N 접수는 배송 확인만 하고, 그 외 건은 일부 회사 예외를 빼고 방문일정을 필수 입력한다.
  const delivery = serviceId.startsWith('N');
  const scheduleRequired = !delivery && detail.COMPANY_ID !== 'CB407';
  const canSelectPlate = !delivery && detail.ETC5 !== 'Y'
    && detail.SUDO === '수도권' && (detail.SONGJANG_NO || '없음') === '없음';

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>처리건 세부정보</h1><span>{serviceId}</span></div>
        <button type="button" onClick={() => navigate(-1)}>목록</button>
      </div>

      <div className="numplate-detail-grid">
        <div><span>기존 차량번호</span><strong>{show(detail.CAR_NO)}</strong></div>
        <div className="numplate-new-number">
          <span>신규 차량번호</span>
          <strong>{detail.ETC5 === 'Y' ? '번호판재발급' : show(detail.POST_CAR_NO)}</strong>
          {canSelectPlate && <button type="button" onClick={openPlateModal}>번호판 선택</button>}
        </div>
        <div><span>차명 / 연식</span><strong>{show([detail.CAR_NAME, detail.MADE_YY].filter(Boolean).join(' / '))}</strong></div>
        <div><span>고객명</span><strong>{show(detail.BUY_NM)}</strong></div>
        <div><span>연락처</span><strong>{detail.TEL_NO ? <a href={`tel:${detail.TEL_NO}`}>{detail.TEL_NO}</a> : '-'}</strong></div>
        <div><span>탈부착·배송 주소</span><strong>{show(detail.LAST_DELIVERY_ADDR)}</strong></div>
        <div><span>보조판 종류</span><strong>{show(detail.BOND_NM)}</strong></div>
        <div><span>처리상태</span><strong>{show(detail.PROC_ST_NM || detail.PROC_ST)}</strong></div>
      </div>

      <form className="numplate-request-form" onSubmit={submit}>
        {scheduleRequired && (
          <div className="numplate-schedule-row">
            <label><span>방문 예정일</span><input type="date" value={form.installDate} onChange={(event) => setForm({ ...form, installDate: event.target.value })} required /></label>
            <label><span>방문 예정시간</span><select value={form.installTime} onChange={(event) => setForm({ ...form, installTime: event.target.value })} required><option value="">시간 선택</option>{visitTimes.map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
          </div>
        )}
        <label><span>요청사항</span><textarea value={detail.MEMO_TX || ''} readOnly /></label>
        <label><span>탈부착자 메모</span><textarea value={form.numMemo} maxLength={1000} onChange={(event) => setForm({ ...form, numMemo: event.target.value })} /></label>
        <label className="numplate-confirm">
          <input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} required />
          {delivery ? '배송할 번호판과 수령 정보를 확인했습니다.' : '차량·번호판·방문 정보를 모두 확인했습니다.'}
        </label>
        {message && <p className="numplate-inline-message" role="alert">{message}</p>}
        <button className="numplate-primary-button" type="submit" disabled={loading || !form.confirmed}>{loading ? '처리 중…' : (delivery ? '배송처리' : '심사요청')}</button>
      </form>

      {plateModalOpen && (
        <div className="numplate-modal-backdrop">
          <section className="numplate-plate-modal" role="dialog" aria-modal="true" aria-labelledby="plate-modal-title">
            <header>
              <div><h2 id="plate-modal-title">차량번호 선택</h2><span>{show(detail.NUM_KIND)} · {show(detail.CAR_KD)}</span></div>
              <button type="button" onClick={() => fetchPlates(plates, '')} disabled={plateLoading} aria-label="번호판 새로고침">↻</button>
            </header>

            {detail.CAN_SEARCH_NUMPLATE && (
              <form className="numplate-plate-search" onSubmit={(event) => { event.preventDefault(); fetchPlates(plates, plateSearch); }}>
                <input value={plateSearch} maxLength={12} onChange={(event) => setPlateSearch(event.target.value.replace(/[^0-9가-힣]/g, ''))} placeholder="희망 번호 검색" aria-label="희망 번호" />
                <button type="submit" disabled={plateLoading}>검색</button>
              </form>
            )}

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
              <button type="button" onClick={closePlateModal} disabled={plateLoading}>취소</button>
              <button type="button" className="save" onClick={savePlate} disabled={plateLoading || !selectedPlate}>저장</button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
