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

  if (!detail) return <section className="numplate-process-page"><p className="numplate-inline-message" role="alert">{message || (loading ? '불러오는 중…' : '처리 건이 없습니다.')}</p></section>;

  // N 접수는 배송 확인만 하고, 그 외 건은 일부 회사 예외를 빼고 방문일정을 필수 입력한다.
  const delivery = serviceId.startsWith('N');
  const scheduleRequired = !delivery && detail.COMPANY_ID !== 'CB407';

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>처리건 세부정보</h1><span>{serviceId}</span></div>
        <button type="button" onClick={() => navigate(-1)}>목록</button>
      </div>

      <div className="numplate-detail-grid">
        <div><span>기존 차량번호</span><strong>{show(detail.CAR_NO)}</strong></div>
        <div><span>신규 차량번호</span><strong>{detail.ETC5 === 'Y' ? '번호판재발급' : show(detail.POST_CAR_NO)}</strong></div>
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
    </section>
  );
}
