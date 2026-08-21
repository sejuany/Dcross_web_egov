import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

/** 심사요청 또는 배송처리 이후 서버의 최신 처리상태와 저장 내용을 보여준다. */
export default function ProcessStatus() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.get(`/api/numplateapp/process/${encodeURIComponent(serviceId)}`);
      setDetail(data.data);
    } catch (error) {
      setMessage(error.response?.data?.message || '처리결과를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>처리결과조회</h1><span>{serviceId}</span></div>
        <button type="button" onClick={load} disabled={loading}>{loading ? '조회 중' : '새로고침'}</button>
      </div>
      {message && <p className="numplate-inline-message" role="alert">{message}</p>}
      {detail && (
        <div className="numplate-status-card">
          <div className="numplate-status-badge">{serviceId.startsWith('N') && detail.INSTALL_YN === 'Y' ? '배송처리 완료' : (detail.PROC_ST_NM || detail.PROC_ST)}</div>
          <dl>
            <dt>기존 차량번호</dt><dd>{detail.CAR_NO || '-'}</dd>
            <dt>신규 차량번호</dt><dd>{detail.ETC5 === 'Y' ? '번호판재발급' : (detail.POST_CAR_NO || '-')}</dd>
            <dt>차명</dt><dd>{detail.CAR_NAME || '-'}</dd>
            <dt>고객명</dt><dd>{detail.BUY_NM || '-'}</dd>
            <dt>연락처</dt><dd>{detail.TEL_NO ? <a href={`tel:${detail.TEL_NO}`}>{detail.TEL_NO}</a> : '-'}</dd>
            <dt>방문일시</dt><dd>{[detail.INSTALL_DT, detail.INSTALL_TIME && `${detail.INSTALL_TIME}:${detail.INSTALL_MINUTES}`].filter(Boolean).join(' ') || '-'}</dd>
            <dt>주소</dt><dd>{detail.LAST_DELIVERY_ADDR || '-'}</dd>
            <dt>메모</dt><dd>{detail.NUM_MEMO_TX || '-'}</dd>
          </dl>
        </div>
      )}
      <button className="numplate-secondary-button" type="button" onClick={() => navigate('/numplateapp')}>처리목록으로</button>
    </section>
  );
}
