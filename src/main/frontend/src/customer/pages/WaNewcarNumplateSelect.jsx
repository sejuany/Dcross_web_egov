import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, CarFront, CheckCircle2, ScanLine, UserRound, FileText, XCircle } from 'lucide-react';
import '../styles/CustomerPage.css';
import corporatePaintPlate from '../img/corporate-paint.jpg';
import corporateFilmPlate from '../img/corporate-film.jpg';

const numplateTypeOptions = [
	{ value: '2G', label: '법인 페인트', image: corporatePaintPlate },
	{ value: 'FG', label: '법인 필름', image: corporateFilmPlate }
];

const RegistrationChecklist = ({ data }) => (
	<div className="numplate-registration-guide">
		<section>
			<h5>원활한 차량 등록을 위해 아래 항목도 확인해 주세요!</h5>
			<ul>
				<li>차량대금 납부</li>
				<li>등록비용 납부</li>
				<li>자동차보험 가입</li>
			</ul>
		</section>
		<section>
			<h5>[자동차보험 가입 안내]</h5>
			<ul>
				<li>가입 필수 기한 : {data.insuranceDeadline || '-'} 까지</li>
				<li>보험 시작일 : {data.insuranceStartDate || '-'} 부터 ~</li>
				<li>반드시 차대번호 <strong>{data.carIdNo || '-'}</strong>로 가입 (차량번호 가입 불가)</li>
				<li>숫자 0과 알파벳 O 를 구분해서 가입해주세요.</li>
			</ul>
		</section>
	</div>
);

const WaNewcarNumplateSelect = () => {
    const [searchParams] = useSearchParams();
    const tokenParam = searchParams.get('t') || '';
    // 예: ?t=CustomerSign?t=TEST123 형식에서는 마지막 ?t= 뒤의 TEST123만 토큰으로 사용한다.
    const token = tokenParam.includes('?t=')
        ? tokenParam.substring(tokenParam.lastIndexOf('?t=') + 3)
        : tokenParam;
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [remainingSeconds, setRemainingSeconds] = useState(null);
    const [wobblingIndex, setWobblingIndex] = useState(-1);
    const [showLookupConsent, setShowLookupConsent] = useState(false);
    const [lookupConsentChecked, setLookupConsentChecked] = useState(false);
    const [showSelectionConfirm, setShowSelectionConfirm] = useState(false);
	const [selectedNumplateType, setSelectedNumplateType] = useState('');
	const [showNumplateTypeConfirm, setShowNumplateTypeConfirm] = useState(false);
	const [numplateTypeConfirmChecked, setNumplateTypeConfirmChecked] = useState(false);
    const selectedRef = useRef('');

	// URL의 공개 토큰만 서버로 보내며, 고객/차량/번호 목록과 서버 기준 만료 시각을 조회한다.
	useEffect(() => {
        axios.get('/api/customer/numplate-selection', { params: { token } })
            .then(({ data: response }) => {
                setData(response.result);
                setSelected(response.result.selectedCarNo || '');
            })
            .catch(e => setMessage(e.response?.data?.message || '번호판 선택 링크를 확인할 수 없습니다.'))
            .finally(() => setLoading(false));
    }, [token]);

	/*
	 * 초 단위 카운트다운은 안내용 UI다. 브라우저 시간이 다르거나 탭이 지연되더라도
	 * 최종 선택 가능 여부는 confirm API가 DB의 NUMPLATE_SELECT_TIME을 기준으로 다시 검증한다.
	 */
	useEffect(() => {
        if (!data?.expiresAt || data.selectedCarNo) {
            setRemainingSeconds(null);
            return;
        }
        const expiresAt = new Date(data.expiresAt.replace(' ', 'T')).getTime();
        const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [data?.expiresAt, data?.selectedCarNo]);

	// 선택하지 않은 번호 중 하나를 5초마다 무작위로 흔들어 선택을 자연스럽게 유도한다.
	useEffect(() => {
		selectedRef.current = selected;
	}, [selected]);

	useEffect(() => {
		setWobblingIndex(-1);
		const carNos = data?.carNos || [];
		if (!data?.selectionStarted || !carNos.length) return undefined;

		let previous = -1;
		const timer = window.setInterval(() => {
			const candidates = carNos
				.map((item, index) => ({ carNo: item.CAR_NO, index }))
				.filter(candidate => candidate.carNo !== selectedRef.current && candidate.index !== previous);
			if (!candidates.length) return;
			previous = candidates[Math.floor(Math.random() * candidates.length)].index;
			setWobblingIndex(previous);
		}, 5000);

		return () => window.clearInterval(timer);
	}, [data?.carNos, data?.selectionStarted]);

	// 실제 조회 버튼을 누른 시점에만 서버가 조회 횟수와 조회 시작 시각을 기록한다.
	const startSelection = async () => {
		setShowLookupConsent(false);
		setLookupConsentChecked(false);
		setLoading(true);
		setMessage('');
		try {
			const { data: response } = await axios.post('/api/customer/numplate-selection/start', {
				TOKEN: token
			});
			setData(response.result);
			setSelected(response.result.selectedCarNo || '');
		} catch (e) {
			setMessage(e.response?.data?.message || '번호판 정보를 조회할 수 없습니다.');
		} finally {
			setLoading(false);
		}
	};

	const closeLookupConsent = () => {
		setShowLookupConsent(false);
		setLookupConsentChecked(false);
	};

	const saveNumplateType = async () => {
		if (!selectedNumplateType || !numplateTypeConfirmChecked) return;
		setShowNumplateTypeConfirm(false);
		setNumplateTypeConfirmChecked(false);
		setLoading(true);
		setMessage('');
		try {
			const { data: response } = await axios.post('/api/customer/numplate-selection/type', {
				TOKEN: token,
				NUMPLATE_GB: selectedNumplateType
			});
			setData(response.result);
			setSelectedNumplateType('');
		} catch (e) {
			setMessage(e.response?.data?.message || '번호판 종류를 저장할 수 없습니다.');
		} finally {
			setLoading(false);
		}
	};

	// 서버가 동시 요청을 잠금 처리하므로 더블 클릭/재요청에도 한 번호만 최종 확정된다.
	const confirm = async () => {
        if (!selected) return setMessage('번호판을 선택해 주세요.');
        setShowSelectionConfirm(false);
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
	const canStart = Boolean(data?.canStart);
	// COUNT/TIME 조합이 시작 가능 상태가 아니거나 5분이 지난 경우 조회 불가로 처리한다.
	const selectionUnavailable = Boolean(data)
		&& !canStart
		&& (!data.selectionStarted || !data.expiresAt || expired);
	const remainingText = remainingSeconds == null
	    ? '--:--'
	    : `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
	const urgency = remainingSeconds != null && remainingSeconds > 0 && remainingSeconds <= 30
		? 'critical'
		: remainingSeconds != null && remainingSeconds > 30 && remainingSeconds <= 120
			? 'warning'
			: 'active';
	const requiresNumplateTypeSelection = Boolean(data?.requiresNumplateTypeSelection);
	const selectedNumplateTypeLabel = numplateTypeOptions.find(
		option => option.value === selectedNumplateType
	)?.label || '';
	const selectedNumplateTypeOption = numplateTypeOptions.find(
		option => option.value === selectedNumplateType
	);
	const savedNumplateGb = String(data?.numplateGb || '').toUpperCase();
	const savedNumplateTypeLabel = savedNumplateGb.length >= 2 && savedNumplateGb[1] === 'G'
		? savedNumplateGb === 'FG' ? '법인 필름' : savedNumplateGb === '2G' ? '법인 페인트' : ''
		: '';

    return (
        <div className={`customer-page numplate-customer-page numplate-${urgency}`}>
            <div className="customer-card numplate-customer-card">
                <div className="numplate-page-heading">
                    <span className="numplate-heading-icon"><CarFront size={26} /></span>
                    <div className="numplate-heading-text">
						<h3>
							{requiresNumplateTypeSelection ? '번호판 종류 선택' : '차량 번호 선택'}
							{!requiresNumplateTypeSelection && savedNumplateTypeLabel
								&& <span className="numplate-heading-type">{savedNumplateTypeLabel}</span>}
						</h3>
						<p>{requiresNumplateTypeSelection
							? '원하시는 번호판 종류를 먼저 선택해 주세요.'
							: '번호 조회 후 5분이 지나면 오늘은 다시 조회할 수 없습니다.'}</p>
					</div>
                </div>

                {data && (
                    <div className="numplate-car-summary">
                        <div><UserRound size={18} /><span>고객명<strong>{data.customerName || '-'}</strong></span></div>
                        <div><ScanLine size={18} /><span>차대번호<strong>{data.carIdNo || '-'}</strong></span></div>
                        <div><CarFront size={18} /><span>차명<strong>{data.carName || '-'}</strong></span></div>
                        <div><FileText size={18} /><span>주문번호<strong>{data.linkId || '-'}</strong></span></div>
                    </div>
                )}

                {data?.selectedCarNo ? (
                    <div className="numplate-complete" role="status">
                        <CheckCircle2 size={58} />
                        <h4>차량 번호 선택이 완료되었습니다</h4>
                        <div className="numplate-result-number">{data.selectedCarNo}</div>
                        <p>선택한 번호가 정상적으로 등록되었습니다.<br />이제 이 창을 닫으셔도 됩니다.</p>
						<RegistrationChecklist data={data} />
                    </div>
				) : requiresNumplateTypeSelection ? (
					<>
						<div className="numplate-type-list" role="radiogroup" aria-label="번호판 종류">
							{numplateTypeOptions.map(option => (
								<label key={option.value}
									className={selectedNumplateType === option.value ? 'selected' : ''}>
									<input type="radio" name="numplateType" value={option.value}
										checked={selectedNumplateType === option.value}
										onChange={() => {
											setSelectedNumplateType(option.value);
											setMessage('');
										}} />
									<span className="numplate-type-image-wrap">
										<img src={option.image} alt={`${option.label} 번호판 예시`} />
									</span>
									<span className="numplate-type-name">{option.label}</span>
									{selectedNumplateType === option.value
										&& <CheckCircle2 className="numplate-type-check" size={25} aria-hidden="true" />}
								</label>
							))}
						</div>

						{message && <p className="numplate-customer-message" role="alert">{message}</p>}
						<div className="customer-btn-group numplate-type-submit">
							<button type="button" className="customer-btn customer-btn-primary"
								disabled={loading || !selectedNumplateType}
								onClick={() => {
									setNumplateTypeConfirmChecked(false);
									setShowNumplateTypeConfirm(true);
								}}>
								{loading ? '처리 중' : '번호판 종류 선택'}
							</button>
						</div>

						{showNumplateTypeConfirm && selectedNumplateType && (
							<div className="numplate-consent-backdrop">
								<section className="numplate-consent-modal" role="dialog" aria-modal="true"
									aria-labelledby="numplate-type-confirm-title">
									<h4 id="numplate-type-confirm-title">번호판 종류 선택 확인</h4>
									<div className="numplate-type-confirm-image">
										<img src={selectedNumplateTypeOption?.image}
											alt={`${selectedNumplateTypeLabel} 번호판 예시`} />
									</div>
									<p><strong>{selectedNumplateTypeLabel} 번호판</strong>을 선택하셨습니다.</p>
									<label className="numplate-consent-check">
										<input type="checkbox" checked={numplateTypeConfirmChecked}
											onChange={event => setNumplateTypeConfirmChecked(event.target.checked)} />
										<span>번호 선택 시 페인트/필름 수정 불가 확인</span>
									</label>
									<div className="numplate-consent-actions">
										<button type="button" className="no"
											onClick={() => {
												setShowNumplateTypeConfirm(false);
												setNumplateTypeConfirmChecked(false);
											}}>취소</button>
										<button type="button" className="yes"
											disabled={!numplateTypeConfirmChecked || loading}
											onClick={saveNumplateType}>확인</button>
									</div>
								</section>
							</div>
						)}
					</>
				) : data?.lookupFailed ? (
					<div className="numplate-complete numplate-lookup-error" role="alert">
						<AlertCircle size={58} />
						<h4>번호 조회 오류</h4>
						<p>차량번호 선택을 위해<br />아래 번호로 연락 바랍니다.<br />1844-0801 (내선 1번)</p>
					</div>
				) : selectionUnavailable ? (
					<div className="numplate-complete numplate-not-selected" role="status">
						<XCircle size={58} />
						<h4>차량 번호가 선택되지 않았습니다</h4>
						<p className="numplate-not-selected-description">
							다음 영업일에 새로운 번호 선택 문자가 발송될 예정이오니,<br />
							해당 문자를 확인하신 후 번호를 선택해 주세요.<br />
							문의 사항은 1844-0801 로 연락 바랍니다.
						</p>
						<RegistrationChecklist data={data} />
					</div>
                ) : data ? (
                    <>
						{data.selectionStarted && !selectionUnavailable && (
						<div className="wa-numplate-timer" aria-live="polite">
	
						    <div className="wa-numplate-timer-head">
						        <span>{expired ? '선택 시간 종료' : '번호 선택 중'}</span>
						        <strong>{remainingText}</strong>
						    </div>
	
						    {!expired && (
						        <progress
						            max="300"
						            value={remainingSeconds ?? 300}
						        />
						    )}
	
						    <p>
						        {expired
						            ? '번호 선택 시간이 종료되었습니다.'
						            : '시간 종료 시 선택한 번호가 자동 확정됩니다.'}
						    </p>
	
						</div>
						)}

						{data.selectionStarted && !selectionUnavailable && (
                        <div className="numplate-customer-list">
                            {data.carNos?.map((item, index) => (
                                <label key={item.CAR_NO}
									className={`${selected === item.CAR_NO ? 'selected' : ''}${wobblingIndex === index ? ' pick-me' : ''}`.trim()}>
                                    <input type="radio" name="carNo" value={item.CAR_NO}
                                        checked={selected === item.CAR_NO} disabled={expired}
                                        onChange={() => { setSelected(item.CAR_NO); setMessage(''); }} />
                                    <span>{item.CAR_NO}</span>
									{selected === item.CAR_NO && <b className="numplate-check-icon" aria-hidden="true">✓</b>}
                                </label>
                            ))}
                        </div>
						)}

						{selectionUnavailable && (
							<p className="numplate-expired-message" role="alert">
								번호판을 조회할 수 있는 시간이 지났습니다.
							</p>
						)}

                        {message && <p className="numplate-customer-message" role="alert">{message}</p>}
                        <div className="customer-btn-group">
                            <button type="button" className="customer-btn customer-btn-primary"
								disabled={loading || selectionUnavailable || (data.selectionStarted && !selected)}
								onClick={canStart ? () => setShowLookupConsent(true) : () => setShowSelectionConfirm(true)}>
								{loading
									? '처리 중'
									: canStart
										? '번호판 조회'
										: selectionUnavailable
											? '번호판 조회 불가'
											: selected
												? `${selected} 선택하기`
												: '번호를 선택해 주세요'}
                            </button>
                        </div>

						{showLookupConsent && (
							<div className="numplate-consent-backdrop">
								<section className="numplate-consent-modal" role="dialog" aria-modal="true"
									aria-labelledby="numplate-consent-title">
									<h4 id="numplate-consent-title">번호판 조회 안내</h4>
									<p>번호 조회 후 5분이 지나면 오늘은 번호판 조회를 다시 할 수 없습니다. 동의하시겠습니까?</p>
									<label className="numplate-consent-check">
										<input type="checkbox" checked={lookupConsentChecked}
											onChange={event => setLookupConsentChecked(event.target.checked)} />
										<span>네, 동의합니다.</span>
									</label>
									<div className="numplate-consent-actions">
										<button type="button" className="no" onClick={closeLookupConsent}>아니오</button>
										<button type="button" className="yes" disabled={!lookupConsentChecked || loading}
											onClick={startSelection}>예</button>
									</div>
								</section>
							</div>
						)}

						{showSelectionConfirm && selected && (
							<div className="numplate-consent-backdrop">
								<section className="numplate-consent-modal" role="dialog" aria-modal="true"
									aria-labelledby="numplate-selection-confirm-title">
									<h4 id="numplate-selection-confirm-title">번호판 선택 확인</h4>
									<p><strong>{selected}</strong>를 선택하시겠습니까?</p>
									<div className="numplate-consent-actions">
										<button type="button" className="no"
											onClick={() => setShowSelectionConfirm(false)}>취소</button>
										<button type="button" className="yes" disabled={loading} onClick={confirm}>확인</button>
									</div>
								</section>
							</div>
						)}
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
