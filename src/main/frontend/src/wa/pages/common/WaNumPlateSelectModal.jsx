
import React, { useState, useEffect, useRef } from 'react';

import '../../../components/newcar/NumPlateSelectModal.css';
import axios from 'axios';
import { gf } from '../../../utils/utils'; // 공통 유틸 함수

const WaNumPlateSelectModal = ({ 
	isOpen, onClose, carIdNo, taskCd, onSelect,
	dsService, dsNewCar, dsCarNoDetach, dsUserInfo
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
	const preCarNoRef = useRef(''); // ref 내부 기억용

	// 최초 조회한 전체 번호판(20개)
	const [cacheNumList, setCacheNumList] = useState([]);
	
	// 폴스타
	const isUserWa001 = dsUserInfo.COMPANY_ID === 'WA001' ? true : false; 
	
	// 모달 열릴 때 초기 조회
	useEffect(() => {
		if (isOpen) {
		    setList([]);
		    setSelected('');
		    setKeyword('');
		    setCondition('NOT');
		    setCacheNumList([]);
		    preCarNoRef.current = '';
		}
	}, [isOpen])
	
	// 선택 가능한 번호판 조회
	const fetchList2 = async() => {

		// 이미 최초 조회를 완료한 경우
		// 서버를 호출하지 않고 조회한 20건 중 랜덤 10건만 표시
		if (cacheNumList.length > 0) {

		    const randomList = [...cacheNumList]
		        .sort(() => Math.random() - 0.5)
		        .slice(0, 10);

		    setList(randomList);
		    return;
		}
		
		let assignCd = '';
		
		// 폴스타
		if(isUserWa001) {
			// 지점코드 1로 들어가도록 설정
			assignCd = dsUserInfo.COMPANY_ID + '1'; 
		}
		// 나머지는 회원사 코드 + 지점코드
		else {
			assignCd = `${dsUserInfo.COMPANY_ID}${dsUserInfo.BRANCH_ID}`;
		}
			
		console.log("assignCd : " + assignCd);
		
		// 번호판 조회 조건
		const dsWhere = {
		    SERVICE_ID: dsService.SERVICE_ID,
		    PRE_CAR_NO: preCarNoRef.current,
		    CAR_KD: carKdNumChange(carType),
		    NUM_KIND: dsNewCar.NUMPLATE_GB,
		    CARID_NO: dsNewCar.CARID_NO,
		    LIMIT: '10',
		    GOVT_ID: dsService.GOVT_ID,
		    CONDITION: condition,
		    WANT_CAR_NO: keyword,
		    ASSIGN_CD: assignCd,
		    TASK_CD: taskCd,
		    HOLE_YN: dsCarNoDetach.HOLE_YN,
		    SEAL_YN: dsCarNoDetach.SEAL_YN
		};
		
		// 최초 조회 시 패키지에서 20건 조회
		const res = await axios.post('/api/newcar/numplateList', dsWhere);
		
		// null 데이터 제거
		const lData = (res.data || []).filter(
		    no => String(no).toLowerCase() !== 'null'
		);
		
		// 조회한 전체 번호판(20건) 저장
		setCacheNumList(lData);

		// 화면에는 랜덤 10건만 표시
		setList(
		    [...lData]
		        .sort(() => Math.random() - 0.5)
		        .slice(0, 10)
		);
		
		// 번호판 상태 복구를 위해 조회한 전체 번호판 저장
		preCarNoRef.current = lData.join(',');
	};
	

	// 선택 가능한 번호판 조회
	// 처음은 서버 조회(20개)를 하고, 2번 이상부터는 캐시에서 조회 하도록 함 
	const fetchList = async () => {

	    // ======================================================
	    // 캐시 조회
	    // ======================================================
	    if (cacheNumList.length > 0) {

	        // 번호 검색
	        if (keyword.trim()) {
	            setList(cacheNumList.filter(no => no === keyword.trim()));
	            return;
	        }

	        // 무작위
	        if (condition === 'NOT') {
	            setList(
	                [...cacheNumList]
	                    .sort(() => Math.random() - 0.5)
	                    .slice(0, 10)
	            );
	            return;
	        }

	        // 끝자리
	        if (/^\d{2}$/.test(condition)) {

	            const lastNo = condition.charAt(1);

	            const cacheResult = cacheNumList.filter(no =>
	                no.endsWith(lastNo)
	            );

	            // 캐시에 있으면 랜덤 1개
	            if (cacheResult.length > 0) {

	                const randomNo =
	                    cacheResult[Math.floor(Math.random() * cacheResult.length)];

	                setList([randomNo]);
	                return;
	            }

	            // 캐시에 없으면 아래 서버조회까지 내려감
	        }
	    }

	    // ======================================================
	    // 서버 조회
	    // ======================================================

	    let assignCd = '';

	    if (isUserWa001) {
	        assignCd = dsUserInfo.COMPANY_ID + '1';
	    } else {
	        assignCd = `${dsUserInfo.COMPANY_ID}${dsUserInfo.BRANCH_ID}`;
	    }

	    const dsWhere = {
	        SERVICE_ID: dsService.SERVICE_ID,
	        PRE_CAR_NO: preCarNoRef.current,
	        CAR_KD: carKdNumChange(carType),
	        NUM_KIND: dsNewCar.NUMPLATE_GB,
	        CARID_NO: dsNewCar.CARID_NO,
	        LIMIT: '10',
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
		
		console.log(lData);

	    // ======================================================
	    // 최초 조회
	    // ======================================================
		if (cacheNumList.length === 0) {

		    // 캐시는 항상 전체 저장
		    setCacheNumList(lData);
		    preCarNoRef.current = lData.join(',');

		    // 끝자리 조회
		    if (/^\d{2}$/.test(condition)) {

		        if (lData.length > 0) {

		            const randomNo =
		                lData[Math.floor(Math.random() * lData.length)];

		            setList([randomNo]);

		        } else {
		            setList([]);
		        }

		    } else {

		        // 무작위 조회
		        setList(
		            [...lData]
		                .sort(() => Math.random() - 0.5)
		                .slice(0, 10)
		        );
		    }

		    return;
		}

	    // ======================================================
	    // 끝자리 조회 (캐시에 없어서 서버를 탄 경우)
	    // ======================================================
	    if (/^\d{2}$/.test(condition)) {

	        if (lData.length > 0) {

	            const randomNo =
	                lData[Math.floor(Math.random() * lData.length)];

	            const nextCache = [...new Set([
	                ...cacheNumList,
	                randomNo
	            ])];

	            setCacheNumList(nextCache);

	            preCarNoRef.current = nextCache.join(',');

	            setList([randomNo]);

	        } else {
	            setList([]);
	        }

	        return;
	    }

	    // 번호 검색 등 기타
	    setList(lData);
	};
	
	// 미사용 번호판 상태복구
	const releaseNumplate = async () => {

	    if (!preCarNoRef.current) {
	        return;
	    }

	    // 조회한 번호판(20건)
	    const numList = preCarNoRef.current.split(',');

	    // 10개씩 나누어 원복
	    for (let i = 0; i < numList.length; i += 10) {

	        const dsWhere = {
	            SERVICE_ID: dsService.SERVICE_ID,
	            PRE_CAR_NO: numList.slice(i, i + 10).join(','),
	            CAR_KD: carKdNumChange(carType),
	            HOLE_YN: dsCarNoDetach.HOLE_YN,
	            LIMIT: '0',                     // 조회 없이 원복만 수행
	            NUM_KIND: dsNewCar.NUMPLATE_GB,
	            GOVT_ID: dsService.GOVT_ID,
	            CONDITION: 'NOT'
	        };

	        await axios.post('/api/newcar/numplateRelease', dsWhere);
	    }

	    // 초기화
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
			// 조회한 전체 번호판(20건) 상태 복구
			preCarNoRef.current = cacheNumList.join(',');

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
		    resetModal();
		    onSelect(bTrue, selectedCarNo);
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
	
	if(!isOpen) return null; 

	return (
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
					
					<div className="numplate-notice">
					    <div className="notice-header">
					        번호 조회 안내
					    </div>

					    <div className="notice-content">
						
					        <p>
					            번호 조회는 <strong>총 2회</strong> 가능하며, 이후에는 조회된 번호 내에서만 선택할 수 있습니다.
					        </p>

					        <p>
					            <strong>※ 골드번호 선택 시 유의사항</strong>
					        </p>

					        <div className="notice-warning">
								골드번호 선택 후 신규등록 진행 중 번호를 변경 시, 취소된 골드번호판 비용과 변경된 번호판 비용이 함께 청구됩니다.<br />
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
					    </div>
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
	    </div>
	);
};

export default WaNumPlateSelectModal;
