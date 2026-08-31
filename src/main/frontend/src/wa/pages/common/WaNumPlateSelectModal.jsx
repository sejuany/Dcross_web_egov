/* ================================================

	 세션 + SERVICE_ID 단위로 최초 조회 번호판 최대 20개 기억
	
	 모달 OPEN
	   ↓
	 조회 버튼
	   ↓
	 세션에 SERVICE_ID 이력 없음
	   → 신규 번호 조회
	   → 최초 번호들을 세션에 누적 저장 (최대 20개)
	
	 세션에 SERVICE_ID 이력 있음
	   → 저장된 번호들만 대상으로 조회
	   → 현재 미사용인 번호만 다시 표시중 처리
	   → 사용/다른 사용자 표시중 번호는 제외
	
	 모달 CLOSE / 번호 선택
	   → 현재 표시중 번호는 미사용으로 원복
	   → 단, 선택 번호는 사용 처리
	   → 세션의 20개 이력은 유지
	
	 재조회
	 → 화면에 안 떠 있으면 미사용 처리
	 → 화면에 떠 있는 번호판만 표시중
	   
	 로그아웃 / 세션 만료
	   → 전체 조회 이력 삭제
	   
 ================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import '../../../components/newcar/NumPlateSelectModal.css';
import axios from 'axios';
import { gf } from '../../../utils/utils'; // 공통 유틸 함수

const WaNumPlateSelectModal = ({ 
	isOpen, onClose, carIdNo, taskCd, onSelect,
	dsService, dsNewCar, dsCarNoDetach, dsUserInfo,
	dsBranchList, setDsCarNoDetach
 }) => {
	
	// 차종
    const [carType, setCarType] = useState('SEDAN');
	// 번호판 조회 조건
	const [searchType, setSearchType] = useState('RANDOM');
	// 끝자리
    const [condition, setCondition] = useState('NOT');
	const [keyword, setKeyword] = useState('');
	const [list, setList] = useState([]);
	const [selected, setSelected] = useState('');
	const [tel, setTel] = useState('');
	const [sending, setSending] = useState(false);
	const [noticeOpen, setNoticeOpen] = useState(true);
	const preCarNoRef = useRef(''); // ref 내부 기억용
	const assignCdRef = useRef(''); 

	// 최초 조회한 전체 번호판(20개)
	const [cacheNumList, setCacheNumList] = useState([]);
	
	// 폴스타
	const isUserWa001 = dsUserInfo.COMPANY_ID === 'WA001' ? true : false; 
	
	// 모달 열릴 때 초기 조회
	useEffect(() => {
		let cancelled = false;
		const restoreAssignedList = async () => {
			if (!isOpen) return;

			setList([]);
			setSelected('');
			setKeyword('');
			setCondition('NOT');
			setNoticeOpen(true);
			setCacheNumList([]);
			preCarNoRef.current = '';
			setTel(String(dsNewCar.MPHONE_NO || '').replace(/\D/g, ''));

			if (dsService.SERVICE_ID && dsCarNoDetach.NUMPLATE_MSG_TOKEN) {
				try {
					const { data } = await axios.get('/api/newcar/numplate-selection/status', {
						params: { serviceId: dsService.SERVICE_ID }
					});
					const assigned = data.result?.state === 'ACTIVE' ? data.result.carNos || [] : [];
					if (!cancelled && assigned.length > 0) {
						setList(assigned);
						setCacheNumList(assigned);
						preCarNoRef.current = assigned.join(',');
					}
				} catch (e) {
					console.error('문자 배정 번호판 복원 실패', e);
				}
			}
		};
		restoreAssignedList();
		return () => { cancelled = true; };
	}, [isOpen, dsNewCar.MPHONE_NO, dsService.SERVICE_ID, dsCarNoDetach.NUMPLATE_MSG_TOKEN])
	

	// 선택 가능한 번호판 조회
	// 처음은 서버 조회(20개)를 하고, 2번 이상부터는 캐시에서 조회 하도록 함 
	// 선택 가능한 번호판 조회
	const fetchList = async () => {


		// 이전 조회 번호가 있으면 미사용 상태로 복구
		if (preCarNoRef.current) {
		    await axios.post('/api/newcar/numplateRelease', {
		        SERVICE_ID: dsService.SERVICE_ID,
		        PRE_CAR_NO: preCarNoRef.current
		    });

		    preCarNoRef.current = '';
		}
		
		const isBranchInfo = dsBranchList.find(
		    e => String(dsUserInfo.BRANCH_ID) === String(e.BRANCH_ID)
		);

		assignCdRef.current = isBranchInfo.ASSIGN_CD ?? '';

	    const assignCd = assignCdRef.current;

	    const dsWhere = {
	        SERVICE_ID: dsService.SERVICE_ID,
	        CAR_KD: carKdNumChange(carType),
	        NUM_KIND: dsNewCar.NUMPLATE_GB,
	        CARID_NO: dsNewCar.CARID_NO,
	        GOVT_ID: dsService.GOVT_ID,
	        CONDITION: condition,
	        WANT_CAR_NO: keyword,
	        ASSIGN_CD: assignCd,
	        TASK_CD: taskCd,
	        HOLE_YN: dsCarNoDetach.HOLE_YN,
	        SEAL_YN: dsCarNoDetach.SEAL_YN
	    };

	    const res = await axios.post('/api/newcar/numplateList', dsWhere);

	    const lData = (res.data || []).filter(
	        no => String(no).toLowerCase() !== 'null'
	    );

	    // 현재 화면에 표시할 번호
	    setList(lData);
	    setSelected('');

	    // 현재 P 상태인 번호 기억
	    preCarNoRef.current = lData.join(',');

	    // 모달에서 조회한 번호 누적
	    setCacheNumList(prev => [
	        ...new Set([...prev, ...lData])
	    ]);
	};
	
	// 미사용 번호판 상태복구
	const releaseNumplate = async () => {

	    if (!preCarNoRef.current) {
	        return;
	    }
		
		// 조회한 번호판 전체를 한 번에 원복
		await axios.post('/api/newcar/numplateRelease', {
		    SERVICE_ID: dsService.SERVICE_ID,
		    PRE_CAR_NO: preCarNoRef.current
		});
		
		// 화면 데이터 초기화
		preCarNoRef.current = '';
		setCacheNumList([]);
	};
	

	const resetModal = () => {

		// 조건 초기화
		setCarType('SEDAN');
		setSearchType('RANDOM');
		setCondition('NOT');

		// 입력값 초기화
		setKeyword('');
		setSelected('');
		setList([]);

		// 조회한 번호판 초기화
		setCacheNumList([]);

		// 원복 대상 초기화
		preCarNoRef.current = '';
	};
	
	// 모달창 닫기
	const handleClose = async () => {

	    try {
			// 미사용 번호판 상태복구
	        await releaseNumplate();
	    } catch (err) {
	        console.error('번호판 상태 복구 실패', err);
	    } finally {
			// 조건 초기화
			resetModal();
			
			onClose();
	    }
		
	};
	
	// 번호판 선택
	const handleSelect = async() => {
		if(!selected) {
			alert('번호 선택이 필요합니다.');
			return;
		}
		
		const dsWhere = {
		    SERVICE_ID: dsService.SERVICE_ID,
		    CAR_NO: selected,
		    PRE_CAR_NO: preCarNoRef.current,
		    CAR_KD: carKdNumChange(carType),
		    CARID_NO: carIdNo,
		    GOVT_ID: dsService.GOVT_ID,
		    NUM_KIND: dsNewCar.NUMPLATE_GB,
		    HOLE_YN: dsCarNoDetach.HOLE_YN,
		    SEAL_YN: dsCarNoDetach.SEAL_YN,
			CONDITION: condition,
			LIMIT: '10'
		};
		
		let bTrue = false;
		const selectedCarNo = selected;
		
		try {
			
			// 선택한 번호판 중복 체크
			const numFind = await axios.post('/api/common/query', {
				    QUERY_ID: 'checkDuplicateCarNo',
				    SERVICE_ID: dsService.SERVICE_ID,
					REQ_CAR_NO: selected
				});
				
			
			if (!numFind.data.success) {
				gf.alert('통신 실패 입니다. 재시도 해주세요.');
				return;
			}

			const duplicateInfo = numFind.data.data;
			const procSt = duplicateInfo?.PROC_ST;

			if (!duplicateInfo) {
			    // 중복 없음
			}
			
			// 반려, 삭제건에 들어가 있는 번호판인 경우
			else if(['DEL', 'RET'].includes(procSt)) {
				// 차량번호가 원래 들어가 있던 건의 서비스아이디 
				const beforeServiceId = duplicateInfo.SERVICE_ID;
				const procNm = procSt === 'DEL' ? '삭제' : '반려';

				// TR_NEWCAR의 REQ_CAR_NO를 빈값 처리
				const ok = await gf.confirm(
					`선택한 번호판 [${selected}]은(는) ${procNm} 처리된 신청건\n(${beforeServiceId})에서 사용 중입니다.\n
					기존 번호판을 해제하고 현재 신청건에 적용하시겠습니까?`
				);

				if (!ok) {
				    return;
				}
				
				// TR_NEWCAR의 REQ_CAR_NO를 빈값 처리
				await axios.post('/api/common/query', {
				    GUBUN: 'UPDATE',
				    QUERY_ID: 'updateTrNewCar',
				    SERVICE_ID: beforeServiceId,
				    REQ_CAR_NO: ''
				});
			}
			else {
				gf.alert(
					`선택한 번호판 [${selected}]은(는) 이미 사용 중인 번호판입니다. \n신청번호 : ${numFind.data.data.SERVICE_ID}`
				);
				return;
			}
			
			// 번호판 신청처리
			const res = await axios.post('/api/newcar/numplateSelect', dsWhere);

			console.log(res);

			if (!res.data.success) {
			    gf.alert(res.data.message);
				return;
			}
			
			// 선택한 번호판을 제외한 나머지 번호판만 상태 복구
			preCarNoRef.current = cacheNumList
			    .filter(no => no !== selected)
			    .join(',');
				
			// 화면에 있는 번호판들 미사용처리
			await releaseNumplate();

			gf.alert('선택되었습니다.');
			bTrue = true;
			
		} catch(e) {
			
			console.error(e);
			
			gf.alert('[번호선택] 처리 중 오류가 발생했습니다.\n' + e);
			
		}
		 
		if (bTrue) {

			// 부모에게 선택 완료 먼저 전달
			await onSelect(true, selectedCarNo);
			
			// 부모 처리 완료 후 모달 초기화/닫기
			resetModal();
		    onClose();
		}
		
	};
	
	const carKdNumChange = (str) => {
		
		// 폴스타는 무조건 승용차
		if(isUserWa001) {
			return '70';
		}
		
	    switch (str) {
	        case 'VAN': // 승합차 
				return '80';
	        case 'TRUCK': // 화물차
				return '97';
	        case 'SPCAR': // 특수차
				return '99';
	        default: 	// 승용차
				return '70';
	    }
	};

	const formatPhoneNumber = value => {
		const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
		if (digits.length <= 3) return digits;
		if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
		const middleEnd = digits.length === 10 ? 6 : 7;
		return `${digits.slice(0, 3)}-${digits.slice(3, middleEnd)}-${digits.slice(middleEnd)}`;
	};
	const handleSendSelectionSms = async () => {
		if (list.length === 0) return gf.alert('먼저 번호판을 조회해 주세요.');
		if (!/^\d{10,11}$/.test(tel)) return gf.alert('수신 휴대폰 번호를 확인해 주세요.');
		if (!await gf.confirm(`조회된 번호 ${list.length}개를 문자로 발송하시겠습니까?`)) return;
		setSending(true);
		try {
			const { data } = await axios.post('/api/newcar/numplate-selection/send', {
				SERVICE_ID: dsService.SERVICE_ID,
				PAY_HP_NO: tel,
				CAR_NOS: list,
				BASE_URL: window.location.origin
			});
			const result = data.result;
			setDsCarNoDetach(prev => ({
				...prev,
				CONFIRM_NO: result.confirmNo,
				NUMPLATE_MSG_TOKEN: result.token
			}));
			gf.alert('번호판 선택 문자를 발송했습니다. 5분 동안 선택할 수 있습니다.');
		} catch (e) {
			gf.alert(e.response?.data?.message || '문자 발송 중 오류가 발생했습니다.');
		} finally {
			setSending(false);
		}
	};
	
	if(!isOpen) return null; 

	return createPortal(
	    <div className="modal-overlay">
	        <div className="modal-container NumPlateSelect">

	            {/* Header */}
	            <div className="modal-header numplate-header">
					<div>
					    <h2>번호판 선택</h2>
					    <p>차량번호를 조회하고 원하는 번호를 선택하세요.</p>
					</div>

	                <button
	                    type="button"
	                    className="modal-close-btn"
	                    onClick={handleClose}
	                >
	                    ✕
	                </button>
	            </div>

	            {/* Body */}
	            <div className="modal-body numplate-body">

	                {/* 검색영역 */}
	                <div className="numplate-search-wrap">
						
						{ isUserWa001 ? (
							<>
								{/* 번호판 조회 조건 */}
								<div className="search-row">
								    <label>조건</label>

								    <select
										value={searchType}
										onChange={e => {
										    const value = e.target.value;

										    setSearchType(value);

										    if (value === 'RANDOM') {
										        setCondition('NOT');
										    } else {
										        // 끝자리 선택으로 바뀌면 기본값 0
										        setCondition('00');
										    }
										}}
									>
								        <option value="RANDOM">무작위(10개)</option>
								        <option value="LAST">끝자리 선택(1개)</option>
								    </select>
								</div>

								{/* 끝자리 선택 */}
								{searchType === 'LAST' && (
								    <div className="search-row">
								        <label>끝자리</label>

										<select
											value={condition}
										    onChange={e => setCondition(e.target.value)}
										>
											<option value="00">0</option>
											<option value="01">1</option>
											<option value="02">2</option>
											<option value="03">3</option>
											<option value="04">4</option>
											<option value="05">5</option>
											<option value="06">6</option>
											<option value="07">7</option>
											<option value="08">8</option>
											<option value="09">9</option>
										</select>
								    </div>
								)}
							</>
						):(
							<>
								{/* 차종 - 폴스타 아닌 경우만 차종 선택, 폴스타는 승용 */}
								<div className="search-row">
								    <label>차종</label>
	
								    <select
								        value={carType}
								        onChange={e => setCarType(e.target.value)}
								    >
								        <option value="SEDAN">승용</option>
								        <option value="VAN">승합</option>
								    </select>
								</div>
								
							</>
						)}
						
	                    <div className="search-row search-row-input">
	                        <label>번호</label>

	                        <div className="search-input-group">
	                            <input
	                                autoComplete="off"
	                                value={keyword}
	                                placeholder="조건 선택 후 조회 버튼을 눌러 차량번호를 조회해 주세요."
	                                onChange={e => setKeyword(e.target.value)}
									onKeyDown={(e) => {
									        if (e.key === 'Enter') {
									            fetchList();
									        }
								    }}
	                            />

	                            <button
	                                type="button"
	                                className="btn-search"
	                                onClick={fetchList}
	                            >
	                                조회
	                            </button>
	                        </div>
	                    </div>
	                </div>
					

					<div className="numplate-sms-wrap">
						<div className="numplate-sms-title">고객 번호 선택 문자</div>
						<div className="numplate-sms-row">
							<label htmlFor="numplate-sms-tel">휴대폰 번호</label>
							<div className="numplate-sms-controls">
								<input
									id="numplate-sms-tel"
									type="tel"
									inputMode="numeric"
									value={formatPhoneNumber(tel)}
									maxLength={13}
									onChange={e => setTel(e.target.value.replace(/\D/g, '').slice(0, 11))}
									placeholder="010-0000-0000"
								/>
								<button type="button" className="btn-send" disabled={sending || list.length === 0}
									onClick={handleSendSelectionSms}>
									{sending ? '발송 중' : '문자 발송'}
								</button>
							</div>
						</div>
						<p>조회된 번호판 목록과 고객 선택 링크를 전송합니다.</p>
					</div>
					<div className="numplate-notice">
					    <button type="button" className="notice-header"
							onClick={() => setNoticeOpen(prev => !prev)} aria-expanded={noticeOpen}>
					        <span>번호 조회 안내</span>
							<span className={`notice-toggle ${noticeOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
					    </button>

					    {noticeOpen && <div className="notice-content">
						
					        <p>
					            번호 조회는 <strong>총 2회</strong> 가능하며, 이후에는 조회된 번호 내에서만 선택할 수 있습니다.
					        </p>

					        <p>
					            <strong>※ 골드번호 선택 시 유의사항</strong>
					        </p>

					        <div className="notice-warning">
								골드번호 선택 건은 신규등록 접수 후 번호 변경 시, 변경된 번호판 비용이 추가로 청구됩니다.<br />
								<strong>번호판 청구 비용 : 취소된 골드번호판 비용 + 변경 번호판 비용</strong><br />
					             사유 : 골드번호판은 취소 시 폐기 처리됨 (재사용 불가)<br /><br />
								 골드번호 선택 고객님께 해당 내용 반드시 안내해 주시기 바랍니다.
					        </div>

					        <div className="notice-title">
					            ■ 골드번호 조건
					        </div>

					        <ul>
					            <li>뒷번호 연속 번호 (예: <b>1234</b>)</li>
					            <li>뒷번호 동일 번호 (예: <b>5555</b>)</li>
					            <li>뒷번호 2~3자리 동일 번호 (예: <b>1004</b>)</li>
					        </ul>
					    </div>}
					</div>

	                {/* 목록 */}
	                <div className="numplate-list-wrap">
	
						<div className="list-header">
						    <div className="list-header-left">
						        <span className="list-title">번호 목록</span>
						    </div>
	
						    <span className="list-count">총 {list.length}건</span>
						</div>

	                    <div className="grid-box">
	                        <table>
	                            <tbody>
	                                {list.length > 0 ? (
	                                    list.map((no) => (
	                                        <tr
	                                            key={no}
	                                            onClick={() => setSelected(no)}
	                                            className={selected === no ? 'selected' : ''}
	                                        >
	                                            <td className="radio-col">
	                                                <input
	                                                    type="radio"
	                                                    checked={selected === no}
	                                                    readOnly
	                                                />
	                                            </td>

	                                            <td className="number-col">
	                                                {no}
	                                            </td>
	                                        </tr>
	                                    ))
	                                ) : (
										<tr>
										    <td className="empty-row">
										        {cacheNumList.length === 0
										            ? '조회 버튼을 눌러 차량번호를 조회해주세요.'
										            : '조회 결과가 없습니다.'}
										    </td>
										</tr>
	                                )}
	                            </tbody>
	                        </table>
	                    </div>
	                </div>
	            </div>

	            {/* Footer */}
	            <div className="modal-footer numplate-footer">
	                <button
	                    type="button"
	                    className="btn-close"
	                    onClick={handleClose}
	                >
	                    닫기
	                </button>

	                <button
	                    type="button"
	                    className="btn-select"
	                    onClick={handleSelect}
	                >
	                    선택
	                </button>
	            </div>
	        </div>
	    </div>,
		document.body
	);
};

export default WaNumPlateSelectModal;
