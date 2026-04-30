
// React
import React, { useState, useEffect } from 'react';

// Router
import { useLocation, useNavigate } from 'react-router-dom';

// Context
import { useTabs } from '../../context/TabContext';

// Library
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';

// Components
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import NumberPlateModal from './NumPlateSelectModal';

// Style
import './NewcarRequest.css';

const NewcarRequest = () => {
	// Router / Context
	const location = useLocation();
	const navigate = useNavigate();// 페이지이동
	const { tabs, activeTabId, removeTab } = useTabs(); // 탭삭제
	// Param
	const receiptNo = location.state?.receiptNo || '';
	// UI State
	const [activeTab, setActiveTab] = useState('owner');
    // 공통 코드 상태
    const [taskCodes, setTaskCodes] = useState([]);
	// 결제정보
	const [dsPaymentList, setDsPaymentList] = useState([]);
	// 모달창 여닫기
	const [isModalOpen, setIsModalOpen] = useState(false);

	const initialDsService = {
	    SERVICE_ID: '',
	    WORK_CD: '',
	    COMPANY_ID: '',
	    MEMBER_ID: '',
	    REQUEST_DT: '',
	    PROC_DT: '',
	    JUDGE_DT: '',
	    PROC_ST: '저장',
	    JUDGE_ST: '선택',
	    RETURN_TX: '',
	};

	const initialDsNewCar = {
	    PROC_CD: '',
	    TASK_CD: '',
	    CARID_NO: '',
	    FUEL_CD: '',
	    NUMPLATE_GB: '',
	    IMSINUM_YN: '',
	    CAR_NO: '',
	    MADE_DT: '',
	    CAR_KD: '',
	    CAR_NM: '',
	    FM_NM: '',
	    SPMNNO: '',
	    BUY_AMT: '',
	    LAST_DT: '',
	    GOVT_ID: '',
	    OWNER_NM: '',
	    REG_NO: '',
	    ADDRESS: '',
	    ADDRESS_DT: '',
	    TEL_NO: '',
	    MPHONE_NO: '',
	    RATIO_NO: '',
	    BOND_YN: 'N',
	    LOW_POLLUTION_YN: 'N'
	};

	const initialOwnerInfo = {
	    DEBTOR_NM: '',
	    REG_NO: '',
	    DEBTOR_RATIO: '',
	    TEL_NO: '',
	    MPHONE_NO: '',
	    DEBTOR_ADDR: '',
	    DEBTOR_ADDR_DT: ''
	};

	const initialCarNoDetach = {
	    DELIVERY_GB: '',
	    DELIVERY_ADDR: '',
	    DELIVERY_ADDR_DT: '',
	    INSTALL_DT: '',
	    INSTALL_TM: '',
	    RECEIVE_NM: '',
	    RECEIVE_TEL_NO: '',
	    CUSTOMER_NM: '',
	    NUM_MEMO_TX: '',
	    STATUS_SMS_NO: '',
	    INSTALL_SMS_TX: ''
	};

	
    useEffect(() => {
        // 공통 코드 조회 API 호출 (업무구분)
        fetch('/api/codes/TASK')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTaskCodes(data.codes); 
                }
            })
            .catch(err => console.error('Failed to fetch TASK codes:', err));

        // 접수번호가 있는 경우 상세 데이터 조회
        if (receiptNo) {
            fetch(`/api/newcar/detail/${receiptNo}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        const dbData = data.data;
						
						setDsPaymentList(Array.isArray(dbData.dsPaymentList) ? dbData.dsPaymentList : []);

                        setDsService(prev => ({
                            ...prev,
                            SERVICE_ID: dbData.SERVICE_ID || prev.SERVICE_ID,
                            WORK_CD: dbData.WORK_CD || prev.WORK_CD,
                        }));

                        setDsNewCar(prev => ({
                            ...prev,
                            PROC_CD: dbData.PROC_CD || prev.PROC_CD,
                            TASK_CD: dbData.TASK_CD || prev.TASK_CD,
                            CARID_NO: dbData.CARID_NO || prev.CARID_NO,
                            FUEL_CD: dbData.FUEL_CD || prev.FUEL_CD,
                            NUMPLATE_GB: dbData.NUMPLATE_GB || prev.NUMPLATE_GB,
                            IMSINUM_YN: dbData.IMSINUM_YN || prev.IMSINUM_YN,
                            CAR_NO: dbData.CAR_NO || prev.CAR_NO,
                            MADE_DT: dbData.MADE_DT || prev.MADE_DT,
                            CAR_KD: dbData.CAR_KD || prev.CAR_KD,
                            CAR_NM: dbData.CAR_NM || prev.CAR_NM,
                            FM_NM: dbData.FM_NM || prev.FM_NM,
                            SPMNNO: dbData.SPMNNO || prev.SPMNNO,
                            BUY_AMT: dbData.BUY_AMT || prev.BUY_AMT,
                            LAST_DT: dbData.LAST_DT || prev.LAST_DT,
                            BOND_YN: dbData.BOND_YN || prev.BOND_YN,
                            LOW_POLLUTION_YN: dbData.LOW_POLLUTION_YN || prev.LOW_POLLUTION_YN,
                            PAY_NM: dbData.PAY_NM || prev.PAY_NM,
                            PAY_HP_NO: dbData.PAY_HP_NO || prev.PAY_HP_NO,
                        }));

                        setDsOwnerInfo(prev => ({
                            ...prev,
                            DEBTOR_NM: dbData.OWNER_NM || prev.DEBTOR_NM,
                            REG_NO: dbData.REG_NO || prev.REG_NO,
                            DEBTOR_RATIO: dbData.RATIO_NO || prev.DEBTOR_RATIO,
                            TEL_NO: dbData.TEL_NO || prev.TEL_NO,
                            MPHONE_NO: dbData.MPHONE_NO || prev.MPHONE_NO,
                            DEBTOR_ADDR: dbData.ADDRESS || dbData.BASE_ADDRESS || prev.DEBTOR_ADDR,
                            DEBTOR_ADDR_DT: dbData.ADDRESS_DT || dbData.BASE_ADDRESS_DT || prev.DEBTOR_ADDR_DT
                        }));
                    }
                })
                .catch(err => console.error('Failed to fetch newcar detail:', err));
        }
		
		// 신규등록 기본정보 초기화 (접수번호가 없는 경우)
		else {
			initProcess();
		}
		
    }, [receiptNo]);
	

	// 신청
	const requestProcess = (() => {
		console.log("신청");
	});
	
	// 저장
	const saveProcess = (()=> {
		console.log("저장이다");
	});
	
	// 새로고침
	const reloadProcess = (() => {
		window.location.reload();
	});

	// 삭제
	const deleteProcess  = (() => {
		console.log("삭제");
	});
	
	// 초기화
	const initProcess = async () => {

	    setDsService(initialDsService);
	    setDsNewCar(initialDsNewCar);
	    setDsOwnerInfo(initialOwnerInfo);
	    setDsOwnerInfo1(initialOwnerInfo);
	    setDsCarNoDetach(initialCarNoDetach);
	    setDsPaymentList([]);

	    const res = await fetch('/api/newcar/init', {
		    credentials: 'include'
		});
		
	    const data = await res.json();

	    if (data.success) {
	        setDsPaymentList(data.data.dsPaymentList || []);
	        // TODO 초기화 후 기본 세팅 필요한 것들 선언해야 됨 
	    }
	};
	
	// 닫기
	const closeFrame = () => {
	    if (!activeTabId) return;
	    removeTab(activeTabId);
	};
	
	
	// 번호선택 버튼 눌렀을 때 체크
	const handleOpenModal = async () => {
		
		console.log("SERVICE_ID : " + dsService.SERVICE_ID);
		
	    // 1. SERVICE_ID 체크
	    if (!dsService.SERVICE_ID) {
	        if (window.confirm('저장 후 사용 가능합니다. 저장하시겠습니까?')) {
	            // 
				await saveProcess();
	        }
	        return;
	    }
		
		/*
	    // 2. 차대번호 체크
	    if (!dsNewCar.CARID_NO || dsNewCar.CARID_NO.length !== 17) {
	        alert('차대번호 확인 필요');
	        return;
	    }

	    // 3. 기존 번호 존재 여부
	    const reqCarNo = dsNewCar.REQ_CAR_NO;

	    if (reqCarNo) {
	        const confirmChange = window.confirm(
	            `이미 차량번호 ${reqCarNo} 선택됨. 변경하시겠습니까?`
	        );

	        if (!confirmChange) return;

	        // 기존 번호 해제 API 호출
	        await axios.post('/api/newcar/numplateUseN', {
	            serviceId: dsService.SERVICE_ID,
	            carNo: reqCarNo
	        });

	        // 상태 초기화
	        setDsNewCar(prev => ({ ...prev, REQ_CAR_NO: '' }));
	    }

	    // 4. 모달 오픈
	    setIsModalOpen(true);
		*/
	};
	

	// 변환할 이름
	const payKdMap = {
	    ACQ: '취득세',
	    BFEE: '채권취급수수료',
	    BOND: '채권',
	    FEE: '등록수수료',
	    INJI: '인지세',
		SPARE: '예비비',
	    STAMP: '증지대',
	    TNUM: '번호판대',
	    UNUM: '번호판대행',
	    UREG: '등록면허세'
	}; 
	
	const [dsService, setDsService] = useState(initialDsService);
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo);
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialCarNoDetach);
	
	const paymentColumnDefs = [
	    { 
			headerName: '결제종류', 
			field: 'PAY_KD',
			width: 150,
			valueFormatter: p => payKdMap[p.value] || p.value
		},
	    { 
			headerName: '전자납부번호(가상계좌)', 
			field: 'VBANK_NO',
			flex: 1
		},
	    { 	headerName: '결제여부', 
			field: 'PAY_OP', 
			width: 120,
	        valueFormatter: p => p.value === 'Y' ? '납부' : '미납'
	    },
	    { 
			headerName: '예상금액', 
			field: 'PRE_PAY_AMT', 
			width: 130,
	        cellClass: 'ag-right-cell',
	        valueFormatter: p => Number(p.value).toLocaleString()
	    },
	    { 
			headerName: '결제금액', 
			field: 'PAY_AMT', 
			width: 130,
	        cellClass: 'ag-right-cell',
	        valueFormatter: p => Number(p.value).toLocaleString()
	    },
	    { 
			headerName: '결제상태', 
			field: 'PAY_ST', 
			width: 120,
	        valueFormatter: p => p.value === 'Y' ? '입금' : '미입금'
	    },
	    { 
			headerName: '결제일시', 
			field: 'PAY_DT', 
			width: 200,
	        valueFormatter: p => p.value || '-'
	    }
	];

    return (
        <div className="new-reg-container">
            {/* Unified Toolbar with Title */}
            <div className="erp-toolbar">
                <div className="toolbar-left">
                    <button className="btn-erp light">목록</button>
                </div>
                <div className="toolbar-right">
                    <button className="btn-erp dark">정보수정</button>
                    <button className="btn-erp dark">원부연계</button>
                    <button className="btn-erp dark">기준가액 조회</button>
                    <button className="btn-erp dark">수기부과</button>
                    <button className="btn-erp dark">심사처리</button>
                    <button className="btn-erp" onClick={requestProcess} >신청[F3]</button>
                    <button className="btn-erp" onClick={saveProcess} >저장[F4]</button>
                    <button className="btn-erp" onClick={reloadProcess} >새로고침[F5]</button>
                    <button className="btn-erp" onClick={deleteProcess} >삭제[F6]</button>
                    <button className="btn-erp" onClick={initProcess} >초기화[F8]</button>
                    <button className="btn-erp" onClick={closeFrame} >닫기[F9]</button>
                </div>
            </div>

            {/* Application Info Section */}
            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={2}>
                        <select className="erp-input" value={dsService.WORK_CD} onChange={e => setDsService({ ...dsService, WORK_CD: e.target.value })}>
                            <option value="1">신규등록</option>
                        </select>
                    </ErpField>
                    <ErpField label="접수번호" span={3}>
                        <input type="text" className="erp-input disabled" value={dsService.SERVICE_ID} readOnly />
                    </ErpField>
                    <ErpField label="회사명" span={4}>
                        <select className="erp-input" value={dsService.COMPANY_ID} onChange={e => setDsService({ ...dsService, COMPANY_ID: e.target.value })}>
                            <option value="X">오복사(성남)</option>
                        </select>
                    </ErpField>
                    <ErpField label="신청자명" span={3}>
                        <input type="text" className="erp-input disabled" value={dsService.MEMBER_ID || ''} readOnly />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={3}>
                        <input type="date" className="erp-input" value={dsService.REQUEST_DT} readOnly />
                    </ErpField>
                    <ErpField label="신청상태" span={2}>
                        <select className="erp-input disabled" value={dsService.PROC_ST} readOnly><option>저장</option></select>
                    </ErpField>
                    <ErpField label="심사일자" span={3}>
                        <input type="date" className="erp-input" value={dsService.JUDGE_DT} readOnly />
                    </ErpField>
                    <ErpField label="심사상태" span={2}>
                        <select className="erp-input disabled" value={dsService.JUDGE_ST} readOnly><option>선택</option></select>
                    </ErpField>
                    <ErpField label="배송상태" span={2}>
                        <select className="erp-input disabled" value={dsService.RETURN_TX ? '반려' : '선택'} readOnly>
                            <option value="선택">선택</option>
                            <option value="반려">반려</option>
                        </select>
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="반려사유" span={12}>
                        <input type="text" className="erp-input" value={dsService.RETURN_TX} readOnly />
                    </ErpField>
                </div>
            </ErpSection>

            {/* Vehicle Information Section */}
            <ErpSection title="자동차정보">
                <div className="erp-row">
                    <ErpField label="업무 구분" span={3}>
                        <select className="erp-input" value={dsNewCar.TASK_CD} onChange={e => setDsNewCar({ ...dsNewCar, TASK_CD: e.target.value })}>
                            {taskCodes.length > 0 ? (
                                taskCodes.map(code => (
                                    <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                                ))
                            ) : (
                                <option value="1">일반등록</option>
                            )}
                        </select>
                    </ErpField>
                    <ErpField label="* 차대번호" span={4} labelWidth="120px">
                        <input type="text" className="erp-input highlight-red" value={dsNewCar.CARID_NO} onChange={e => setDsNewCar({ ...dsNewCar, CARID_NO: e.target.value })} />
                    </ErpField>
                    <ErpField label="임시번호판 상태" span={3} labelWidth="120px">
                        <select className="erp-input" value={dsNewCar.IMSINUM_YN} onChange={e => setDsNewCar({ ...dsNewCar, IMSINUM_YN: e.target.value })}>
                            <option value="N">반납대상X</option>
                            <option value="Y">반납대상</option>
                        </select>
                    </ErpField>
                    <ErpField label="사용연료" span={2}>
                        <select className="erp-input highlight-yellow" value={dsNewCar.FUEL_CD} readOnly>
                            <option value="H">하이브리드</option>
                            <option value="G">가솔린</option>
                            <option value="D">디젤</option>
                        </select>
                    </ErpField>
                </div>

                <div className="erp-row">
                    <ErpField label="번호판지정 요구사항" span={6} labelWidth="120px">
                        <select className="erp-input" value={dsNewCar.NUMPLATE_GB} onChange={e => setDsNewCar({ ...dsNewCar, NUMPLATE_GB: e.target.value })}>
                            <option value="F">필름 번호판</option>
                            <option value="P">페인트 번호판</option>
                        </select>
                        <select className="erp-input" style={{margin:'0px'}} ><option>비천공</option></select>
                        <select className="erp-input"><option>비봉인</option></select>
                    </ErpField>
                    <ErpField label="보조판 사용" span={3} labelWidth="120px">
                        <div className="flex-row">
                            <input type="checkbox" checked={dsNewCar.BOND_YN === 'Y'} onChange={e => setDsNewCar({ ...dsNewCar, BOND_YN: e.target.checked ? 'Y' : 'N' })} style={{ margin: '0px 3px 0 5px' }} />
                            <input type="text" className="erp-input" value={dsNewCar.CAR_NO} readOnly />
                        </div>
                    </ErpField>
                    <div className="field-group col-3" style={{ borderRight: 'none' }}>
                        <div className="flex-row">
                            <button className="btn-erp sm light" style={{ minWidth: '65px', marginLeft: '2px' }} onClick={handleOpenModal} >번호선택</button>
                            <span className="info-txt" style={{ marginLeft: '10px', width: '100%' }}>_벤츠 이지원 자곡 안호범 위택스...</span>
                        </div>
                    </div>
                </div>

                <div className="erp-row">
                    <ErpField label="등록 차량번호" span={3} labelWidth="120px">
                        <span className="value-red">{dsNewCar.CAR_NO}</span>
                    </ErpField>
                    <ErpField label="최초등록일" span={2}>
                        <span className="value-black">{dsNewCar.MADE_DT}</span>
                    </ErpField>
                    <ErpField label="차종명" span={2}>
                        <span className="value-black">{dsNewCar.CAR_KD}</span>
                    </ErpField>
                    <div className="field-group col-1">
                        <select className="erp-input" disabled><option>자가용</option></select>
                    </div>
                    <ErpField label="차명" span={4}>
                        <span className="value-black">{dsNewCar.CAR_NM}</span>
                    </ErpField>
                </div>

                <div className="erp-row">
                    <ErpField label="원동기형식" span={2}>
                        <span className="value-black">{dsNewCar.FM_NM}</span>
                    </ErpField>
                    <ErpField label="형식승인번호" span={4} labelWidth="120px">
                        <span className="value-black">{dsNewCar.SPMNNO}</span>
                    </ErpField>
                    <ErpField label="등록관청" span={2}>
                        <select className="erp-input highlight-blue" value={dsNewCar.GOVT_ID} readOnly>
                            <option value="BUSAN">부산시청</option>
                        </select>
                    </ErpField>
                    <ErpField label="차령만료일" span={2}>
                        <span className="value-black">{dsNewCar.LAST_DT}</span>
                    </ErpField>
                    <ErpField label="취득가액" span={2}>
                        <span className="value-red text-right flex-grow" style={{ overflow: 'hidden', marginRight: '5px' }} >{Number(dsNewCar.BUY_AMT).toLocaleString()}</span>
                    </ErpField>
                </div>
            </ErpSection>

            {/* Tab Container */}
            <div className="tab-container">
                <div className="tab-header-list">
                    <button className={`tab-btn ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>소유자정보</button>
                    <button className={`tab-btn ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>배송정보</button>
                    <button className={`tab-btn ${activeTab === 'regInfo' ? 'active' : ''}`} onClick={() => setActiveTab('regInfo')}>신규등록정보</button>
                    <button className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>결제정보</button>
                </div>

                <div className="tab-content">
                    {activeTab === 'owner' && (
                        <div className="owner-info-section">
                            <ErpSection title="대표 소유자 정보">
                                <div className="erp-row">
                                    <ErpField label="신규등록 구분" span={3}>
                                        <select className="erp-input" value={dsNewCar.PROC_CD} readOnly><option value="1">신조차 신규</option></select>
                                    </ErpField>
                                    <ErpField label="업무구분" required={true} span={3}>
                                        <select className="erp-input disabled" value={dsNewCar.TASK_CD} readOnly>
                                            {taskCodes.length > 0 ? (
                                                taskCodes.map(code => (
                                                    <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                                                ))
                                            ) : (
                                                <option value="1">일반등록</option>
                                            )}
                                        </select>
                                    </ErpField>
                                    <ErpField label="임시허가관청" span={3}>
                                        <input type="text" className="erp-input" value="" readOnly />
                                    </ErpField>
                                    <ErpField label="임시허가일자" span={3}>
                                        <input type="date" className="erp-input" value="" readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="* 등록번호" span={5}>
                                        <select className="erp-input" style={{ maxWidth: '100px' }}><option>주민등록번호</option></select>
                                        <input type="text" className="erp-input" value={dsOwnerInfo.REG_NO} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, REG_NO: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="* 성명(상호)" span={5}>
                                        <input type="text" className="erp-input" value={dsOwnerInfo.DEBTOR_NM} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, DEBTOR_NM: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="비율(%)" span={2}>
                                        <input type="text" className="erp-input text-right" value={dsOwnerInfo.DEBTOR_RATIO} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, DEBTOR_RATIO: e.target.value })} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="전화번호" span={4}>
                                        <input type="text" className="erp-input" value={dsOwnerInfo.TEL_NO} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, TEL_NO: e.target.value })} />
                                    </ErpField>
									<ErpField label="휴대폰번호" span={4}>
										<input type="text" className="erp-input" value={dsOwnerInfo.MPHONE_NO} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, MPHONE_NO: e.target.value })} />
									</ErpField>
                                    <ErpField label="보험사 정보" span={4}>
                                        <select className="erp-input"><option>선택</option></select>
                                        <input type="text" className="erp-input" style={{ maxWidth: '170px' }} placeholder="시작일" />
                                        <span>~</span>
                                        <input type="text" className="erp-input" style={{ maxWidth: '170px' }} placeholder="종료일" />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="소유자 주소" span={9}>
                                        <button className="btn-erp sm grey" style={{ marginLeft: '23px' }} >주소검색</button>
                                        <input type="text" className="erp-input disabled" value={dsOwnerInfo.DEBTOR_ADDR} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '350px' }} value={dsOwnerInfo.DEBTOR_ADDR_DT} onChange={e => setDsOwnerInfo({ ...dsOwnerInfo, DEBTOR_ADDR_DT: e.target.value })} />
									</ErpField>
									<ErpField label="도로명코드" span={3}>
										<input type="text" className="erp-input disabled" value={dsNewCar.RT_ACC_NM} readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="사용 본거지" span={9}>
                                        <input type="checkbox" style={{ margin: '0 5px' }} />
                                        <button className="btn-erp sm grey">주소검색</button>
                                        <input type="text" className="erp-input disabled" value={dsOwnerInfo.BASE_ADDRESS} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '350px' }} value={dsOwnerInfo.BASE_ADDRESS_DT} readOnly />
                                    </ErpField>
								    <ErpField label="도로명코드" span={3}>
								        <input type="text" className="erp-input disabled" value={dsNewCar.RT_ACC_NO} readOnly />
								    </ErpField>
                                </div>
                            </ErpSection>

                            <ErpSection title="공동 소유자 정보" className="mt-10">
                                <div className="erp-row">
                                    <ErpField label="* 성명(상호) 2" span={5}>
                                        <input type="text" className="erp-input" value={dsOwnerInfo1.DEBTOR_NM} onChange={e => setDsOwnerInfo1({ ...dsOwnerInfo1, DEBTOR_NM: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="* 등록번호" span={5}>
                                        <select className="erp-input" style={{ maxWidth: '120px' }}><option>선택</option></select>
                                        <input type="text" className="erp-input" value={dsOwnerInfo1.REG_NO} onChange={e => setDsOwnerInfo1({ ...dsOwnerInfo1, REG_NO: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="비율(%)" span={2}>
                                        <input type="text" className="erp-input text-right" value={dsOwnerInfo1.DEBTOR_RATIO} onChange={e => setDsOwnerInfo1({ ...dsOwnerInfo1, DEBTOR_RATIO: e.target.value })} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="전화번호" span={5}>
                                        <input type="text" className="erp-input" value={dsOwnerInfo1.TEL_NO} onChange={e => setDsOwnerInfo1({ ...dsOwnerInfo1, TEL_NO: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="휴대폰번호" span={7}>
                                        <input type="text" className="erp-input" value={dsOwnerInfo1.MPHONE_NO} onChange={e => setDsOwnerInfo1({ ...dsOwnerInfo1, MPHONE_NO: e.target.value })} />
                                    </ErpField>
                                </div>
                            </ErpSection>
                        </div>
                    )}

                    {activeTab === 'delivery' && (
                        <div className="delivery-info-section">
                            <ErpSection title="번호판 배송 정보">
                                <div className="erp-row">
                                    <ErpField label="탁송구분(번호판)" span={6}>
                                        <div className="flex-row f-left">
                                            <label className="ml-10" style={{ marginRight: '15px' }}><input type="checkbox" style={{ marginRight: '5px' }} />번호판발송</label>
                                            <label><input type="checkbox" style={{ marginRight: '5px' }} />번호판수령</label>
                                        </div>
                                    </ErpField>
                                    <ErpField label="탁송구분(임시 번호판)" span={6} style={{ width: '150px' }} >
                                        <div className="flex-row f-left">
                                            <label className="ml-10" style={{ marginRight: '15px' }}><input type="checkbox" style={{ marginRight: '5px' }} />임시번호판발송</label>
                                            <label><input type="checkbox" style={{ marginRight: '5px' }} />임시번호판수령</label>
                                        </div>
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="배송지 선택" span={12}>
                                        <select className="erp-input" value={dsCarNoDetach.DELIVERY_GB} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, DELIVERY_GB: e.target.value })}>
                                            <option value="X">직접수령</option>
                                            <option value="D">배송</option>
                                        </select>
                                        <button className="btn-erp sm grey">주소입력</button>
                                        <input type="text" className="erp-input flex-grow disabled" value={dsCarNoDetach.DELIVERY_ADDR} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '200px' }} value={dsCarNoDetach.DELIVERY_ADDR_DT} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, DELIVERY_ADDR_DT: e.target.value })} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="배송 예정일" span={4}>
                                        <input type="date" className="erp-input" value={dsCarNoDetach.INSTALL_DT} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, INSTALL_DT: e.target.value })} />
                                        <select className="erp-input" value={dsCarNoDetach.INSTALL_TM} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, INSTALL_TM: e.target.value })}>
                                            <option value="091">09:00 ~ 09:30</option>
                                        </select>
                                    </ErpField>
                                    <ErpField label="수령인 정보" span={5}>
                                        <input type="text" className="erp-input" placeholder="성함" value={dsCarNoDetach.RECEIVE_NM} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, RECEIVE_NM: e.target.value })} />
                                        <input type="text" className="erp-input" placeholder="연락처" value={dsCarNoDetach.RECEIVE_TEL_NO} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, RECEIVE_TEL_NO: e.target.value })} />
                                    </ErpField>
									<ErpField label="고객명" span={3}>
										<input type="text" placeholder="고객명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, CUSTOMER_NM: e.target.value })} />
									</ErpField>
                                </div>
                                <div className="erp-row" style={{ minHeight: '80px' }}>
                                    <ErpField label="메모" span={12}>
                                        <textarea className="erp-input erp-textArea" style={{ height: '60px' }} value={dsCarNoDetach.NUM_MEMO_TX} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, NUM_MEMO_TX: e.target.value })}></textarea>
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="SMS 연락처" span={12}>
                                        <input type="text" className="erp-input" placeholder="콤마(,)로 구분" value={dsCarNoDetach.STATUS_SMS_NO} onChange={e => setDsCarNoDetach({ ...dsCarNoDetach, STATUS_SMS_NO: e.target.value })} />
                                        <button className="btn-erp sm light" style={{ margin: '0 3px' }}>SMS 발송</button>
                                    </ErpField>
                                </div>
                            </ErpSection>
                        </div>
                    )}

                    {activeTab === 'regInfo' && (
                        <div className="reg-info-section">
                            <ErpSection title="신규등록 상세정보">
                                <div className="erp-row">
                                    <ErpField label="구입가액" span={4}>
                                        <div className="flex-row">
                                            <input type="text" className="erp-input highlight-red text-right" value={dsNewCar.BUY_AMT} readOnly />
                                            <button className="btn-erp sm light" style={{ margin: '0 5px', whiteSpace: 'nowrap' }}>사전조회</button>
                                        </div>
                                    </ErpField>
                                    <ErpField label="비과세대상" span={8}>
                                        <select className="erp-input"><option>선택</option></select>
                                        <select className="erp-input"><option>비과세대상등급</option></select>
                                        <select className="erp-input disabled" disabled><option>적용구분</option></select>
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="채권할인여부" span={4}>
                                        <select className="erp-input"><option>할인</option></select>
                                    </ErpField>
                                    <ErpField label="인지세" span={4}>
                                        <select className="erp-input"><option>전자관리번호</option></select>
                                    </ErpField>
                                    <ErpField label="가상계좌" span={4}>
                                        <select className="erp-input disabled" disabled><option>은행선택</option></select>
                                        <input type="text" className="erp-input disabled" readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="환급계좌" span={6}>
                                        <select className="erp-input"><option>은행</option></select>
                                        <input type="text" className="erp-input" placeholder="계좌번호" />
                                    </ErpField>
                                    <ErpField label="예금주" span={3}>
                                        <input type="text" className="erp-input" />
                                    </ErpField>
                                    <ErpField label="환급금액" span={3}>
                                        <input type="text" className="erp-input text-right disabled" value="" readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="등록증 배송지" span={12}>
                                        <button className="btn-erp sm grey" style={{ margin: '0 5px' }}>주소검색</button>
                                        <input type="text" className="erp-input disabled" placeholder="주소" />
                                        <input type="text" className="erp-input text-left" placeholder="상세주소" />
                                    </ErpField>
                                </div>
                            </ErpSection>
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div className="payment-info-section">
                            <ErpSection title="결제 및 납부 정보">
                                <div className="erp-row">
                                    <ErpField label="결제자명" span={4}>
                                        <input type="text" className="erp-input" value={dsNewCar.PAY_NM || ''} onChange={e => dsNewCar({ ...dsNewCar, PAY_NM: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="휴대폰번호" span={4}>
                                        <input type="text" className="erp-input" value={dsNewCar.PAY_HP_NO || ''} onChange={e => dsNewCar({ ...dsNewCar, PAY_HP_NO: e.target.value })} />
                                    </ErpField>
                                    <ErpField label="납부상태" span={4}>
                                        <select className="erp-input disabled" disabled readOnly ><option>미납</option></select>
                                    </ErpField>
                                </div>

								<div className="erp-row mt-10">
								    <div className="ag-theme-alpine" style={{ width: '100%', height: '286px' }}>
								        <AgGridReact
											theme="legacy"
								            rowData={dsPaymentList}
								            columnDefs={paymentColumnDefs}
								            defaultColDef={{ sortable: true, resizable: true, cellClass: 'ag-center-cell' }}
								        />
								    </div>
								</div>
                            </ErpSection>
                        </div>
                    )}
                </div>
            </div>
			
			{/* 번호선택 모달 */}
			<NumberPlateModal
			    isOpen={isModalOpen}
			    onClose={() => setIsModalOpen(false)}
			    onSelect={(value) => {
			        console.log('선택된 번호:', value);
 
			        // TODO 
			        // setDsNewCar({...dsNewCar, CAR_NO: value});

			        setIsModalOpen(false);
			    }}
			/>
			
        </div>
    );
};

export default NewcarRequest;
