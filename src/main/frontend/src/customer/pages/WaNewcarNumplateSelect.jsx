import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CarFront, CheckCircle2, Clock3, ScanLine, UserRound } from 'lucide-react';
import '../styles/CustomerPage.css';

const WaNewcarNumplateSelect = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('t') || '';
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [remainingSeconds, setRemainingSeconds] = useState(null);

    useEffect(() => {
        axios.get('/api/customer/numplate-selection', { params: { token } })
            .then(({ data: response }) => {
                setData(response.result);
                setSelected(response.result.selectedCarNo || '');
            })
            .catch(e => setMessage(e.response?.data?.message || '번호판 선택 링크를 확인할 수 없습니다.'))
            .finally(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        if (!data?.expiresAt || data.selectedCarNo) return;
        const expiresAt = new Date(data.expiresAt.replace(' ', 'T')).getTime();
        const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [data?.expiresAt, data?.selectedCarNo]);

    const confirm = async () => {
        if (!selected) return setMessage('번호판을 선택해 주세요.');
        setLoading(true);
        try {
            const { data: response } = await axios.post('/api/customer/numplate-selection/confirm', {
                TOKEN: token,
                CAR_NO: selected
            });
            setData(prev => ({ ...prev, selectedCarNo: response.result.carNo }));
            setMessage(`${response.result.carNo} 번호가 선택되었습니다.`);
        } catch (e) {
            setMessage(e.response?.data?.message || '번호판 선택 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const expired = remainingSeconds === 0;
    const remainingText = remainingSeconds == null
        ? '--분 --초'
        : `${Math.floor(remainingSeconds / 60)}분 ${String(remainingSeconds % 60).padStart(2, '0')}초`;

    return (
        <div className="customer-page">
            <div className="customer-card numplate-customer-card">
                <div className="numplate-page-heading">
                    <span className="numplate-heading-icon"><CarFront size={26} /></span>
                    <div><h3>차량 번호 선택</h3><p>마음에 드는 차량 번호를 선택해 주세요.</p></div>
                </div>

                {data && (
                    <div className="numplate-car-summary">
                        <div><UserRound size={18} /><span>고객명<strong>{data.customerName || '-'}</strong></span></div>
                        <div><ScanLine size={18} /><span>차대번호<strong>{data.carIdNo || '-'}</strong></span></div>
                        <div><CarFront size={18} /><span>차명<strong>{data.carName || '-'}</strong></span></div>
                    </div>
                )}

                {data?.selectedCarNo ? (
                    <div className="numplate-complete" role="status">
                        <CheckCircle2 size={58} />
                        <h4>차량 번호 선택이 완료되었습니다</h4>
                        <div className="numplate-result-number">{data.selectedCarNo}</div>
                        <p>선택한 번호가 정상적으로 등록되었습니다.<br />이제 이 창을 닫으셔도 됩니다.</p>
                    </div>
                ) : data ? (
                    <>
                        <div className={`numplate-timer ${expired ? 'expired' : ''}`} aria-live="polite">
                            <Clock3 size={21} />
                            <span>{expired ? '선택 시간이 만료되었습니다' : '남은 선택 시간'}</span>
                            {!expired && <strong>{remainingText}</strong>}
                        </div>

                        <div className="numplate-customer-list">
                            {data.carNos?.map(item => (
                                <label key={item.CAR_NO} className={selected === item.CAR_NO ? 'selected' : ''}>
                                    <input type="radio" name="carNo" value={item.CAR_NO}
                                        checked={selected === item.CAR_NO} disabled={expired}
                                        onChange={() => { setSelected(item.CAR_NO); setMessage(''); }} />
                                    <span>{item.CAR_NO}</span>
                                    {selected === item.CAR_NO && <CheckCircle2 size={22} />}
                                </label>
                            ))}
                        </div>

                        {message && <p className="numplate-customer-message" role="alert">{message}</p>}
                        <div className="customer-btn-group">
                            <button type="button" className="customer-btn customer-btn-primary"
                                disabled={loading || !selected || expired} onClick={confirm}>
                                {loading ? '처리 중' : selected ? `${selected} 선택하기` : '번호를 선택해 주세요'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="numplate-empty-state" role="alert">
                        {loading ? '번호판 정보를 불러오고 있습니다.' : message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaNewcarNumplateSelect;
