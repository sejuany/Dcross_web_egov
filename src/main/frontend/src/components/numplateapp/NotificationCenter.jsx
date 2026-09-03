import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/** TR_PUSH_MESSAGE의 최근 15일 알림을 읽음 상태와 함께 표시한다. */
export default function NotificationCenter() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data } = await axios.get('/api/numplateapp/notifications');
      setItems(data.list || []);
    } catch (error) {
      setMessage(error.response?.data?.message || '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (item) => {
    try {
      if (item.READ_YN !== 'Y') {
        await axios.post(`/api/numplateapp/notifications/${item.IDX}/read`);
        setItems((current) => current.map((row) => row.IDX === item.IDX ? { ...row, READ_YN: 'Y' } : row));
      }
      if (item.SERVICE_ID) navigate(`/numplateapp/request/${encodeURIComponent(item.SERVICE_ID)}`);
    } catch (error) {
      setMessage(error.response?.data?.message || '알림을 처리하지 못했습니다.');
    }
  };

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>알림센터</h1><span>최근 15일 동안 받은 알림입니다.</span></div>
        <button type="button" onClick={load} disabled={loading}>새로고침</button>
      </div>
      {message && <p className="numplate-inline-message" role="alert">{message}</p>}
      <div className="numplate-notification-list">
        {!loading && !items.length && <p className="numplate-empty">받은 알림이 없습니다.</p>}
        {items.map((item) => (
          <button
            type="button"
            className={item.READ_YN === 'Y' ? 'read' : 'unread'}
            key={item.IDX}
            onClick={() => open(item)}
          >
            <strong>{item.TITLE || '알림'}</strong>
            <span>{item.MESSAGE}</span>
            <small>{item.INS_DATE}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
