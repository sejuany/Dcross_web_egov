
// 리액트 
import React, { useState, useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom'; // 페이지 이동
import { useTabs } from '../../context/TabContext'; // 전역 탭 

// 외부 라이브러리
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';

// 공통 컴포넌트
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { gf, log, mapData } from '../../utils/utils'; // 공통 유틸 함수
import NumberPlateModal from './NumPlateSelectModal'; // 번호판 모달
import CommonSelect from '../common/CommonSelect';	  // 콤보박스 세팅

// Style
import './NewcarRequest.css';

// initial
import {
    // 초기화
	initialDsService,
	initialDsNewCar,
	initialOwnerInfo,
	initialOwnerInfo1,
	initialDsBranchList,
	initialDsBaseList,
	initialDsCarNoDetach,
	
	// 매핑용
	serviceMap,
	newCarMap,
	ownerMap 
} from './newcarInitial';


const NewcarRequest = () => {
	// 훅(hook) 세팅
	const location = useLocation();
	const navigate = useNavigate(); // 페이지이동
	const { tabs, activeTabId, removeTab } = useTabs(); // 탭 관리
	// Param
	const receiptNo = location.state?.receiptNo ?? '';
	// UI 상태
	const [activeTab, setActiveTab] = useState('owner');
	const [isModalOpen, setIsModalOpen] = useState(false); 	 // 모달 여닫기
	const [isMultiOwner, setIsMultiOwner] = useState(false); // 두번째 공동소유자 체크박스
	// 사용자정보
	const [dsUserInfo, setDsUserInfo] = useState({});
	// 공통코드
	const [codes, setCodes] = useState({});
	// 결제정보
	const [dsPaymentList, setDsPaymentList] = useState([]);
	// 결제관리 코드명 변환
	const payKdMap = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };
	// State 
	const [dsService, setDsService] = useState(initialDsService);
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo1); // 공동소유 2번째
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialDsCarNoDetach);
	const [dsBranchList, setDsBranchList] = useState(initialDsBranchList);
	const [dsBaseList, setDsBaseList] = useState(initialDsBaseList);
	

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
	        flex: 1,
	        editable: true
	    },
	    {   
	        headerName: '결제여부', 
	        field: 'PAY_OP', 
	        width: 120,
	        editable: true,
	        cellEditor: 'agSelectCellEditor',
	        cellEditorParams: {
	            values: ['Y', 'N']
	        },
	        valueFormatter: p => p.value === 'Y' ? '납부' : '미납'
	    },
	    { 
	        headerName: '예상금액', 
	        field: 'PRE_PAY_AMT', 
	        width: 130,
	        editable: true,
	        cellClass: 'ag-right-cell',
	        valueFormatter: p => Number(p.value || 0).toLocaleString()
	    },
	    { 
	        headerName: '결제금액', 
	        field: 'PAY_AMT', 
	        width: 130,
	        editable: true,
	        cellClass: 'ag-right-cell',
	        valueFormatter: p => Number(p.value || 0).toLocaleString()
	    },
	    { 
	        headerName: '결제상태', 
	        field: 'PAY_ST', 
	        width: 120,
	        editable: true,
	        cellEditor: 'agSelectCellEditor',
	        cellEditorParams: {
	            values: ['Y', 'N']
	        },
	        valueFormatter: p => p.value === 'Y' ? '입금' : '미입금'
	    },
	    { 
	        headerName: '결제일시', 
	        field: 'PAY_DT', 
	        width: 200,
	        editable: false,
	        valueFormatter: p => p.value || '-'
	    }
	];
	
	// 금액 
	const onCellValueChanged = (params) => {
	    const updated = [...dsPaymentList];
	    updated[params.rowIndex] = params.data;
	    setDsPaymentList(updated);
	};

	useEffect(() => {

	    // 공통 코드 조회
	    const loadCodes = async () => {

	        const codeData = await gf.getCodes([ 'SGB', 'PR_ST', 'JG_ST', 'NEWGB', 'DELIV', 'TASK', 'BOND', 'NTTCD', 'NTTGR', 'NTACD', 'NTWHO', 'STAGB', 'DLVGB', 
								'REGGB', 'NUMGB', 'CARM', 'FRTAX', 'GOVT', 'PAYME', 'PAYGB', 'INSUR', 'NUMST', 'IMPST',
								'PAYKD', 'PAYME', 'PAYOP', 'PAYST', 'PAYTP', 'BANK', 'FUEL', 'CARUS', 'NHOLE', 'NSEAL'
							]);

	        setCodes(codeData);
	    };

	    loadCodes();

	    // 접수번호가 있는 경우 상세 조회
	    if (receiptNo) {

	        fetch(`/api/newcar/detail/${receiptNo}`)
	            .then(res => res.json())
	            .then(data => {

	                if (data.success && data.data) {

	                    const dbData = data.data;

	                    setDsPaymentList(Array.isArray(dbData.dsPaymentList)
	                        ? dbData.dsPaymentList
	                        : []);

	                    setDsService(prev =>
	                        mapData(prev, dbData.dsService, serviceMap)
	                    );

	                    setDsNewCar(prev =>
	                        mapData(prev, dbData.dsNewCar, newCarMap)
	                    );

	                    setDsOwnerInfo(prev =>
	                        mapData(prev, dbData.dsOwnerInfo || {}, ownerMap)
	                    );

	                    setDsOwnerInfo1(prev =>
	                        mapData(prev, dbData.dsOwnerInfo1 || {}, ownerMap)
	                    );

	                    setDsBranchList(dbData.dsBranchList || []);
	                    setDsBaseList(dbData.dsBaseList || []);
	                    setDsCarNoDetach(dbData.dsCarNoDetach || {});
	                }
	            })
	            .catch(err =>
	                console.error('Failed to fetch newcar detail:', err)
	            );
	    }

	    // 신규 초기화
	    else {
	        initProcess();
	    }

	}, [receiptNo]);
	

	useEffect(() => {
	    console.log('dsService 변경됨:', dsService);
	}, [dsService]);
	
	// 신청
	const requestProcess = (() => {
		console.log("신청");
	});
	
	// 저장
	const saveProcess = (bMsg) => {

	    const err = validate();
	    if (err) return alert(err);

	    const { PROC_ST, JUDGE_ST } = dsService;

	    // 1. 일반 저장
	    if (["INPUT", "C_SAV", "SAV", "C_REQ"].includes(PROC_ST)) {
	        setDsService(prev => ({ ...prev, PROC_ST: "SAV" }));
	    }

	    // 2. 채권 처리
	    else if (PROC_ST === "D_MAN") {

	        const updatedList = dsPaymentList.map((item, i) => {
	            if (i === 2) {
	                return {
	                    ...item,
	                    PAY_AMT: Number(gf.onlyNumber(dsNewCar.BOND_AMT || '0')),
	                    VBANK_CD: dsNewCar.BOND_BANK_CD,
	                    VBANK_NO: dsNewCar.BOND_BANK_NO
	                };
	            }
	            if (i === 1) {
	                return { ...item, PAY_AMT: 600 };
	            }
	            return item;
	        });

	        const total = updatedList.reduce((sum, v) => sum + Number(v.PAY_AMT || 0), 0);

	        setDsPaymentList(updatedList);
	        setDsNewCar(prev => ({ ...prev, TOTAL_AMT: total }));

	        if (dsNewCar.BOND_DC === "BUY" && !window.confirm("채권 매입입니다. 진행하시겠습니까?")) return;
	        if (!window.confirm("저장하시겠습니까?")) return;

	        if (dsNewCar.PAY_GB === "B") {
	            setDsNewCar(prev => ({
	                ...prev,
	                RT_AMT: Number(prev.PREREG_AMT) - total
	            }));

	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: "D_PAY",
	                JUDGE_ST: "D_PAY"
	            }));
	        } else {
	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: "B_REQ",
	                JUDGE_ST: "B_REQ"
	            }));
	        }
	    }

	    // 3. 부분 업데이트
	    else if (JUDGE_ST?.length > 0 && JUDGE_ST !== '선택') {
			console.log("JUDGE_ST : " + JUDGE_ST);
	        if (JUDGE_ST !== "RET") {
	            console.log("부분 업데이트 저장");
	        }
	        return;
	    }

	    // 4. 사용자 상태 처리
	    if (['GU'].includes(dsUserInfo.LOGIN_GB) || dsUserInfo.LOGIN_GB?.startsWith('U')) {
	        if (JUDGE_ST === "RET") {
	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: prev.JUDGE_ST
	            }));
	        }
	    }

	    processService(bMsg);
	};
	
	const processService = async (bMsg) => {
	    const hasServiceId = !!dsService.SERVICE_ID;

		let sSvcID = '';
		
		if(!hasServiceId) {
			sSvcID = 'insertNewCar';
		} else if(bMsg) {
			sSvcID = 'updateNewCarNoMSG';
		} else {
			sSvcID = 'updateNewCar';
		}
		
	    if (!bMsg && dsService.JUDGE_ST === "RET" && dsUserInfo.MEMBER_GB !== "GU") {
	        setDsService(prev => ({
	            ...prev,
	            PROC_ST: "REQ",
	            JUDGE_ST: "S_REQ"
	        }));
	    }

	    const requestDate = { dsService, dsNewCar, dsOwnerInfo, dsCarNoDetach, dsPaymentList };
		
		try {
			const res = await axios.post('/api/newcar/save', requestDate);
			
			// 성공
			if (res.data.success) {
	            alert('저장되었습니다.');
	        } else {
	            alert(res.data.message || '저장 실패');
	        }
		} catch (err) {
			console.error(err);
			alert('서버 오류 발생');
		}
	};

	
	// 새로고침
	const reloadProcess = (() => {
		window.location.reload();
	});

	// 삭제
	const deleteProcess  = (() => {
		console.log("삭제");
	});
	

	const initProcess = async () => {

	    // 2. receiptNo 제거 (핵심)
	    navigate(location.pathname, { replace: true, state: {} });

	    // 3. 화면 상태 초기화
		setDsService(initialDsService);
		setDsNewCar(initialDsNewCar);
		setDsOwnerInfo(initialOwnerInfo);
		setDsOwnerInfo1(initialOwnerInfo1);
		setDsPaymentList([]);
		setDsBranchList(initialDsBranchList);
		setDsBaseList(initialDsBaseList);
		setDsCarNoDetach(initialDsCarNoDetach);

	    // 4. init API로 기본값 세팅
	    const res = await fetch('/api/newcar/init', {
	        credentials: 'include', //
	    });


		const resData = await res.json();
		
		log(resData);


		if (resData.success) {

		    const {
		        dsPaymentList = [],
		        dsService = {},
		        dsBranchList = [],
		        dsBaseList = [],
		        dsCarNoDetach = {}
		    } = resData.data || {};

		    setDsPaymentList(dsPaymentList);

		    setDsService(prev => ({
		        ...prev,
		        ...dsService
		    }));

		    setDsBranchList(dsBranchList.length ? dsBranchList : initialDsBranchList);
		    setDsBaseList(dsBaseList.length ? dsBaseList : initialDsBaseList);
		    setDsCarNoDetach(Object.keys(dsCarNoDetach).length ? dsCarNoDetach : initialDsCarNoDetach);
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
	
	// 필수 정보 검증 및 체크
	const validate = () => {
	    const v = [
	        gf.Check(dsNewCar.CARID_NO, "차대번호", 17),
	        gf.Check(dsService.WORK_CD, "업무구분", 1)
	    ].find(Boolean);

	    if (v) return v;

	    if (dsService.PROC_ST === "D_MAN") {
	        return [
	            gf.Check(dsNewCar.BOND_AMT, "채권금액", 1),
	            gf.Check(dsNewCar.BOND_BANK_CD, "은행", 3),
	            gf.Check(dsNewCar.BOND_BANK_NO, "계좌번호", 5)
	        ].find(Boolean);
	    }

	    return null;
	};
	

	// input 공통 핸들러
	const handleChange = (e) => {
	    const { name, value, dataset } = e.target;

	    let v = value;

	    if (name === 'CARID_NO') {
	        v = gf.toUpperAlpha(value);
	    }

	    if (dataset.type === 'newcar') {
	        setDsNewCar(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'service') {
	        setDsService(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'owner') {
		    setDsOwnerInfo(prev => ({ ...prev, [name]: value }));
	    } else if (dataset.type === 'owner1') {
	        setDsOwnerInfo1(prev => ({ ...prev, [name]: value }));
	    } else if (dataset.type === 'detach') {
	        setDsCarNoDetach(prev => ({ ...prev, [name]: v }));
	    }
	};
	
	// === UI ============================
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
                    <ErpField label="신청구분" span={2} htmlFor="WORK_CD">
						<CommonSelect groupId="SGB" codes={codes} name="WORK_CD" value={dsService.WORK_CD ?? '1'} data-type="service" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="접수번호" span={3} htmlFor="SERVICE_ID" >
                        <input type="text" id="SERVICE_ID" className="erp-input disabled" data-type="service" value={dsService.SERVICE_ID} readOnly />
                    </ErpField>
                    <ErpField label="회사명" span={4} htmlFor="COMPANY_ID">
                        <select className="erp-input" id="COMPANY_ID" name="COMPANY_ID" value={dsService.COMPANY_ID} data-type="service" onChange={handleChange}>
                            <option value="X">오복사(성남)</option>
                        </select>
                    </ErpField>
                    <ErpField label="신청자명" span={3} htmlFor="MEMBER_ID">
                        <input type="text" className="erp-input disabled" id="MEMBER_ID" name="MEMBER_ID" data-type="service" value={dsService.MEMBER_ID ?? ''} readOnly />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={3} htmlFor="REQUEST_DT">
                        <input type="date" className="erp-input" id="REQUEST_DT" name="REQUEST_DT" data-type="service" value={dsService.REQUEST_DT} readOnly />
                    </ErpField>
                    <ErpField label="신청상태" span={2} htmlFor="PROC_ST">
						<CommonSelect groupId="PR_ST" codes={codes} name="PROC_ST" value={dsService.PROC_ST ?? ''} data-type="service" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="심사일자" span={3} htmlFor="JUDGE_DT">
                        <input type="date" className="erp-input" id="JUDGE_DT" name="JUDGE_DT" data-type="service" value={dsService.JUDGE_DT} readOnly />
                    </ErpField>
                    <ErpField label="심사상태" span={2} htmlFor="JUDGE_ST">
						<CommonSelect groupId="JG_ST" codes={codes} name="JUDGE_ST" value={dsService.JUDGE_ST ?? ''} data-type="service" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="배송상태" span={2} htmlFor="NUMPLATE_ST">
						<CommonSelect groupId="NUMST" codes={codes} name="NUMPLATE_ST" value={dsCarNoDetach.NUMPLATE_ST ?? ''} data-type="detach" onChange={handleChange} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="반려사유" span={12} htmlFor="RETURN_TX">
                        <input type="text" className="erp-input" id="RETURN_TX" name="RETURN_TX" data-type="service" value={dsService.RETURN_TX} readOnly />
                    </ErpField>
                </div>
            </ErpSection>

            {/* Vehicle Information Section */}
            <ErpSection title="자동차정보">
                <div className="erp-row">
                    <ErpField label="업무 구분" span={3} htmlFor="TASK_CD">
						<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="* 차대번호" span={4} labelWidth="120px" htmlFor="CARID_NO">
                        <input type="text" className="erp-input highlight-red" id="CARID_NO" name="CARID_NO" value={dsNewCar.CARID_NO} data-type="newcar" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="임시번호판 상태" span={3} labelWidth="120px" htmlFor="IMSINUM_YN">
						<CommonSelect groupId="IMPST" codes={codes} name="IMSINUM_YN" value={dsNewCar.IMSINUM_YN ?? ''} data-type="newcar" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="사용연료" span={2} htmlFor="FUEL_CD">
                        <CommonSelect groupId="FUEL" codes={codes} name="FUEL_CD" value={dsNewCar.FUEL_CD ?? ''} data-type="newcar" onChange={handleChange} disabled />
                    </ErpField>
                </div>

                <div className="erp-row">
                    <ErpField label="번호판지정 요구사항" span={6} labelWidth="120px" htmlFor="NUMPLATE_GB">
                        <CommonSelect groupId="NUMGB" codes={codes} name="NUMPLATE_GB" value={dsNewCar.NUMPLATE_GB ?? ''} data-type="newcar" onChange={handleChange} />
                        <CommonSelect groupId="NHOLE" codes={codes} name="HOLE_YN" value={dsCarNoDetach.HOLE_YN ?? ''} data-type="detach" onChange={handleChange} />
                        <CommonSelect groupId="NSEAL" codes={codes} name="SEAL_YN" value={dsCarNoDetach.SEAL_YN ?? ''} data-type="detach" onChange={handleChange} />
                    </ErpField>
                    <ErpField label="보조판 사용" span={3} labelWidth="120px" htmlFor="CAR_NO">
                        <div className="flex-row">
                            <input type="checkbox" id="BOND_YN" name="BOND_YN" data-type="newcar" checked={dsNewCar.BOND_YN === 'Y'} onChange={e => setDsNewCar({ ...dsNewCar, BOND_YN: e.target.checked ? 'Y' : 'N' })} style={{ margin: '0px 3px 0 5px' }} />
                            <input type="text" className="erp-input" id="CAR_NO" name="CAR_NO" data-type="newcar" value={dsNewCar.CAR_NO} readOnly />
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
                        <CommonSelect groupId="CARUS" codes={codes} name="CAR_US" value={dsNewCar.CAR_US ?? ''} data-type="newcar" onChange={handleChange} />
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
                    <ErpField label="등록관청" span={2} htmlFor="GOVT_ID">
						<CommonSelect groupId="GOVT" codes={codes} name="GOVT_ID" value={dsNewCar.GOVT_ID ?? ''} data-type="service" onChange={handleChange} />
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
                                    <ErpField label="신규등록 구분" span={3} htmlFor="PROC_CD">
										<CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} />
                                    </ErpField>
                                    <ErpField label="업무구분" required={true} span={3} htmlFor="TASK_CD">
                                        <CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} />
                                    </ErpField>
                                    <ErpField label="임시허가관청" span={3}>
                                        <input type="text" className="erp-input" value="" readOnly />
                                    </ErpField>
                                    <ErpField label="임시허가일자" span={3}>
                                        <input type="date" className="erp-input" value="" readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="* 등록번호" span={5} htmlFor="REG_NO">
                                        <CommonSelect groupId="REGGB" codes={codes} name="REG_GB" value={dsNewCar.REG_GB ?? ''} data-type="newcar" onChange={handleChange} />
                                        <input type="text" className="erp-input" id="REG_NO" name="REG_NO" data-type="newcar" value={dsNewCar.REG_NO ?? ''} onChange={handleChange} />
                                    </ErpField>
                                    <ErpField label="* 성명(상호)" span={5} htmlFor="OWNER_NM">
                                        <input type="text" className="erp-input" id="OWNER_NM" name="OWNER_NM" data-type="newcar" value={dsNewCar.OWNER_NM} onChange={handleChange} />
                                    </ErpField>
                                    <ErpField label="비율(%)" span={2} htmlFor="RATIO_NO">
                                        <input type="text" className="erp-input text-right" id="RATIO_NO" name="RATIO_NO" data-type="newcar" value={dsNewCar.RATIO_NO} onChange={handleChange} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="전화번호" span={4} htmlFor="TEL_NO">
                                        <input type="text" className="erp-input" id="TEL_NO" name="TEL_NO" data-type="newcar" value={dsNewCar.TEL_NO} onChange={handleChange} />
                                    </ErpField>
									<ErpField label="휴대폰번호" span={4} htmlFor="MPHONE_NO">
										<input type="text" className="erp-input" id="MPHONE_NO" name="MPHONE_NO" data-type="newcar" value={dsNewCar.MPHONE_NO} onChange={handleChange} />
									</ErpField>
                                    <ErpField label="보험사 정보" span={4}>
										<CommonSelect groupId="INSUR" codes={codes} name="INSURER_CD" value={dsNewCar.INSURER_CD ?? ''} data-type="newcar" onChange={handleChange} />
                                        <select className="erp-input"><option>선택</option></select>
                                        <input type="text" className="erp-input" style={{ maxWidth: '170px' }} placeholder="시작일" />
                                        <span>~</span>
                                        <input type="text" className="erp-input" style={{ maxWidth: '170px' }} placeholder="종료일" />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="소유자 주소" span={9} htmlFor="ADDRESS">
                                        <button className="btn-erp sm grey" style={{ marginLeft: '23px' }} >주소검색</button>
                                        <input type="text" className="erp-input disabled" id="ADDRESS" name="ADDRESS" data-type="newcar" value={dsNewCar.ADDRESS} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '350px' }} id="ADDRESS_DT" name="ADDRESS_DT" data-type="newcar" value={dsNewCar.ADDRESS_DT} onChange={handleChange} />
									</ErpField>
									<ErpField label="도로명코드" span={3} htmlFor="RT_ACC_NM">
										<input type="text" className="erp-input disabled" id="RT_ACC_NM" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM} readOnly />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="사용 본거지" span={9} htmlFor="BASE_ADDRESS">
                                        <input type="checkbox" style={{ margin: '0 5px' }} />
                                        <button className="btn-erp sm grey">주소검색</button>
                                        <input type="text" className="erp-input disabled" id="BASE_ADDRESS" name="BASE_ADDRESS" data-type="newcar" value={dsNewCar.BASE_ADDRESS} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '350px' }} id="BASE_ADDRESS_DT" name="BASE_ADDRESS_DT" data-type="newcar" value={dsNewCar.BASE_ADDRESS_DT} readOnly />
                                    </ErpField>
								    <ErpField label="도로명코드" span={3} htmlFor="RT_ACC_NO">
								        <input type="text" className="erp-input disabled" id="RT_ACC_NO" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO} readOnly />
								    </ErpField>
                                </div>
                            </ErpSection>


							<ErpSection title="공동 소유자 정보" className="mt-10">

							    {/* 체크 */}
							    <div className="erp-row">
							        <div style={{ width: '100%', textAlign: 'right' }}>
							            <label><input type="checkbox" checked={isMultiOwner} onChange={e => setIsMultiOwner(e.target.checked)} /> 공동소유자 2명</label>
							        </div>
							    </div>

							    {/* 공동1 */}
							    <div className="erp-row">
							        <ErpField label="성명(상호)" span={3}>
										<input className="erp-input" name="DEBTOR_NM" data-type="owner" value={dsOwnerInfo?.DEBTOR_NM ?? ''} onChange={handleChange} />
									</ErpField>
							        <ErpField label="등록번호" span={4}>
										<CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_REG_GB" value={dsNewCar.REG_GB ?? ''} data-type="owner" onChange={handleChange} />
										<input className="erp-input" name="DEBTOR_REG_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_REG_NO ?? ''} onChange={handleChange} />
									</ErpField>
							        <ErpField label="사업자번호" span={3}>
										<input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} />
									</ErpField>
							        <ErpField label="비율(%)" span={2}>
										<input className="erp-input text-right" name="DEBTOR_RATIO" data-type="owner" value={dsOwnerInfo?.DEBTOR_RATIO ?? ''} onChange={handleChange} />
									</ErpField>
							    </div>

							    <div className="erp-row">
							        <ErpField label="전화번호" span={4}>
										<input className="erp-input" name="DEBTOR_TEL_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_TEL_NO ?? ''} onChange={handleChange} />
									</ErpField>
							        <ErpField label="휴대전화번호" span={4}>
										<input className="erp-input" name="DEBTOR_MPHONE_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_MPHONE_NO ?? ''} onChange={handleChange} />
									</ErpField>
							        <ErpField label="만료일" span={4}>
										<input type="date" className="erp-input" name="EXPIRE_DT" data-type="owner" value={dsOwnerInfo?.EXPIRE_DT ?? ''} onChange={handleChange} />
									</ErpField>
							    </div>

							    <div className="erp-row">
							        <ErpField label="공동소유자 주소" span={12}>
							            <button className="btn-erp sm grey">주소 검색</button>
							            <input className="erp-input disabled" value={dsOwnerInfo?.DEBTOR_ADDR ?? ''} readOnly />
							            <input className="erp-input" value={dsOwnerInfo?.DEBTOR_ADDR_DT ?? ''} readOnly />
							        </ErpField>
							    </div>

							    {/* 공동2 */}
								{isMultiOwner && (
									<>
										<div className="erp-row">
										    <ErpField label="성명(상호)(2)" span={3}>
												<input className="erp-input" name="DEBTOR_NM" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_NM ?? ''} onChange={handleChange} />
											</ErpField>
										    <ErpField label="등록번호(2)" span={4}>
												<CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_GB" value={dsNewCar.DEBTOR_GB ?? ''} data-type="owner" onChange={handleChange} />
												<input className="erp-input" name="DEBTOR_REG_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_REG_NO ?? ''} onChange={handleChange} />
											</ErpField>
										    <ErpField label="사업자번호" span={3}><input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} /></ErpField>
										    <ErpField label="비율(%)" span={2}><input className="erp-input text-right" name="DEBTOR_RATIO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_RATIO ?? ''} onChange={handleChange} /></ErpField>
										</div>
	
										<div className="erp-row">
										    <ErpField label="전화번호" span={4}><input className="erp-input" name="DEBTOR_TEL_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_TEL_NO ?? ''} onChange={handleChange} /></ErpField>
										    <ErpField label="휴대전화번호" span={4}><input className="erp-input" name="DEBTOR_MPHONE_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_MPHONE_NO ?? ''} onChange={handleChange} /></ErpField>
										    <ErpField label="만료일" span={4}><input type="date" className="erp-input" name="EXPIRE_DT" data-type="owner1" value={dsOwnerInfo1?.EXPIRE_DT ?? ''} onChange={handleChange} /></ErpField>
										</div>
	
										<div className="erp-row">
										    <ErpField label="공동소유자 주소" span={12}>
										        <button className="btn-erp sm grey">주소 검색</button>
										        <input className="erp-input disabled" value={dsOwnerInfo1?.DEBTOR_ADDR ?? ''} readOnly />
										        <input className="erp-input" value={dsOwnerInfo1?.DEBTOR_ADDR_DT ?? ''} readOnly />
										    </ErpField>
										</div>
									</>
								)}
							</ErpSection>
                        </div>
                    )}

                    {activeTab === 'delivery' && (
                        <div className="delivery-info-section">
                            <ErpSection title="번호판 배송 정보">
							
                                <div className="erp-row">
                                    <ErpField label="배송지 선택" span={12} htmlFor="DELIVERY_GB">
										<CommonSelect groupId="DLVGB" codes={codes} name="DELIVERY_GB" value={dsCarNoDetach.DELIVERY_GB ?? ''} data-type="detach" onChange={handleChange} />
                                        <button className="btn-erp sm grey">주소입력</button>
                                        <input type="text" className="erp-input flex-grow disabled" id="DELIVERY_ADDR" name="DELIVERY_ADDR" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR} readOnly />
                                        <input type="text" className="erp-input text-left" style={{ width: '200px' }} id="DELIVERY_ADDR_DT" name="DELIVERY_ADDR_DT" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR_DT} onChange={handleChange} />
                                    </ErpField>
                                </div>
								
                                <div className="erp-row">
                                    <ErpField label="배송 예정일" span={4} htmlFor="INSTALL_DT">
                                        <input type="date" className="erp-input" id="INSTALL_DT" name="INSTALL_DT" data-type="detach" value={dsCarNoDetach.INSTALL_DT} onChange={handleChange} />
										<CommonSelect groupId="Time" codes={codes} name="INSTALL_TM" value={dsCarNoDetach.INSTALL_TM ?? ''} data-type="detach" onChange={handleChange} />
                                    </ErpField>
                                    <ErpField label="수령인 정보" span={5} htmlFor="RECEIVE_NM">
                                        <input type="text" className="erp-input" id="RECEIVE_NM" name="RECEIVE_NM" data-type="detach" placeholder="성함" value={dsCarNoDetach.RECEIVE_NM} onChange={handleChange} />
                                        <input type="text" className="erp-input" id="RECEIVE_TEL_NO" name="RECEIVE_TEL_NO" data-type="detach" placeholder="연락처" value={dsCarNoDetach.RECEIVE_TEL_NO} onChange={handleChange} />
                                    </ErpField>
									<ErpField label="고객명" span={3} htmlFor="CUSTOMER_NM">
										<input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="고객명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} />
									</ErpField>
                                </div>
								
								<div className="erp-row">
							        <ErpField label="배송자 정보" span={9} htmlFor="">
										<input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="배송자명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} />
										<input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="배송자 전화번호" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} />
									</ErpField>
									<ErpField label="배송 관련 문자" span={3} htmlFor="btnDeliberySmsSend" style={{ height: '278px' }} >
										<button className="btn-erp sm grey" id="btnDeliberySmsSend">SMS 발송</button>
									</ErpField>
							    </div>
								
                                <div className="erp-row">
                                    <ErpField label="배송 메모" span={12} htmlFor="NUM_MEMO_TX">
                                        <textarea className="erp-input erp-textArea" id="NUM_MEMO_TX" name="NUM_MEMO_TX" data-type="detach" style={{ height: '60px' }} value={dsCarNoDetach.NUM_MEMO_TX} onChange={handleChange}></textarea>
                                    </ErpField>
                                </div>
								
                            </ErpSection>
                        </div>
                    )}

					{activeTab === 'regInfo' && (
					    <div className="reg-info-section">
					        <ErpSection title="신규등록정보">

					            <div className="erp-row">
					                <ErpField label="신규등록 구분" span={3}>
										<CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="업무 구분" span={3}>
					                    <CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="입금구분" span={3}>
					                    <CommonSelect groupId="PAYGB" codes={codes} name="PAY_GB" value={dsNewCar.PAY_GB ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="구입가액(VAT별도)" span={3}>
					                    <div className="flex-row">
					                        <input type="text" className="erp-input text-right" name="BUY_AMT" data-type="newcar" value={Number(dsNewCar.BUY_AMT || 0).toLocaleString()} readOnly />
					                    </div>
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="비과세대상" span={4}>
					                    <CommonSelect groupId="NTTCD" codes={codes} name="NTAX_TRGET_CD" value={dsNewCar.NTAX_TRGET_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                    <CommonSelect groupId="NTWHO" codes={codes} name="NTAX_WHO" value={dsNewCar.NTAX_WHO ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="비과세대상등급" span={4}>
					                    <CommonSelect groupId="NTTGR" codes={codes} name="NTAX_TRGET_GR_CD" value={dsNewCar.NTAX_TRGET_GR_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="비과세적용구분" span={4}>
					                    <CommonSelect groupId="NTACD" codes={codes} name="NTAX_APPLC_CD" value={dsNewCar.NTAX_APPLC_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="채권할인여부" span={3}>
					                    <CommonSelect groupId="BOND" codes={codes} name="BOND_DC" value={dsNewCar.BOND_DC ?? ''} data-type="newcar" onChange={handleChange} />
					                </ErpField>

					                <ErpField label="인지세" span={4}>
										<CommonSelect groupId="STAMP" codes={codes} name="STAMP_GB" value={dsNewCar.STAMP_GB ?? ''} data-type="newcar" onChange={handleChange} />
					                    <input type="text" className="erp-input" name="INJI_NO" data-type="newcar" value={dsNewCar.INJI_NO ?? ''} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="등록비용사전조회" span={5}>
					                    <div className="flex-row">
					                        <input type="text" className="erp-input text-right disabled" value={Number(dsNewCar.PREREG_AMT || 0).toLocaleString()} readOnly />
					                        <span style={{ margin: '0 5px' }}>원</span>
					                        <button className="btn-erp sm light">조회</button>
					                    </div>
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="결제자명" span={3}>
					                    <input type="text" className="erp-input" name="PAY_NM" data-type="newcar" value={dsNewCar.PAY_NM ?? ''} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="휴대폰번호" span={3}>
					                    <input type="text" className="erp-input" name="PAY_HP_NO" data-type="newcar" value={dsNewCar.PAY_HP_NO ?? ''} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="가상계좌" span={6}>
										<CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled />	
					                    <input type="text" className="erp-input disabled" value={dsNewCar.VBANK_NO ?? ''} readOnly />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="신규등록일자" span={3}>
					                    <input type="text" className="erp-input disabled" value={dsNewCar.NEWCAR_REG_DT ?? ''} readOnly />
					                </ErpField>

					                <ErpField label="등록비용" span={3}>
					                    <input type="text" className="erp-input text-right disabled" value={Number(dsNewCar.TOTAL_AMT || 0).toLocaleString()} readOnly />
					                </ErpField>

					                <ErpField label="채권금액" span={3}>
					                    <input type="text" className="erp-input text-right disabled" value={Number(dsNewCar.BOND_AMT || 0).toLocaleString()} readOnly />
					                </ErpField>

					                <ErpField label="채권납부계좌" span={3}>
										<CommonSelect groupId="BANK" codes={codes} name="BOND_BANK_CD" value={dsNewCar.BOND_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                    <input type="text" className="erp-input disabled" value={dsNewCar.BOND_BANK_NO ?? ''} readOnly />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="환급계좌" span={5}>
										<CommonSelect groupId="BANK" codes={codes} name="RT_BANK_CD" value={dsNewCar.RT_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} />
					                    <input type="text" className="erp-input" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO ?? ''} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="환급계좌 예금주" span={4}>
					                    <input type="text" className="erp-input" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM ?? ''} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="환급금액" span={3}>
					                    <input type="text" className="erp-input text-right disabled" value={Number(dsNewCar.RT_AMT || 0).toLocaleString()} readOnly />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="등록증 배송지" span={12}>
					                    <button className="btn-erp sm grey" style={{ marginRight: '5px' }}>주소 검색</button>

					                    <input type="text" className="erp-input disabled" value={dsNewCar.CARP_ADDRESS ?? ''} readOnly />

					                    <input type="text" className="erp-input" style={{ width: '220px' }} value={dsNewCar.CARP_ADDRESS_DT ?? ''} readOnly />

					                    <input type="text" className="erp-input disabled" style={{ width: '100px' }} value={dsNewCar.CARP_POST_NO ?? ''} readOnly />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="메모" span={12}>
					                    <textarea className="erp-input erp-textArea" name="MEMO_TX" data-type="newcar" style={{ height: '90px' }} value={dsNewCar.MEMO_TX ?? ''} onChange={handleChange} />
					                </ErpField>
					            </div>

					        </ErpSection>
					    </div>
					)}

                    {activeTab === 'payment' && (
                        <div className="payment-info-section">
                            <ErpSection title="결제 및 납부 정보">
								<div className="erp-row">
								    <ErpField label="결제자명" span={4} htmlFor="PAY_NM">
								        <input type="text" className="erp-input" id="PAY_NM" name="PAY_NM" data-type="newcar" value={dsNewCar.PAY_NM ?? ''} onChange={handleChange} />
								    </ErpField>
								    <ErpField label="휴대폰번호" span={4} htmlFor="PAY_HP_NO">
								        <input type="text" className="erp-input" id="PAY_HP_NO" name="PAY_HP_NO" data-type="newcar" value={dsNewCar.PAY_HP_NO ?? ''} onChange={handleChange} />
								    </ErpField>
								    <ErpField label="납부상태" span={4}>
										<CommonSelect groupId="PAYST" codes={codes} name="PAY_ST" value={dsNewCar.PAY_ST ?? ''} data-type="newcar" onChange={handleChange} />
								    </ErpField>
								</div>
								
								<div className="erp-row">
								    <ErpField label="납부방법" span={4} htmlFor="PAY_ME">
										<CommonSelect groupId="PAYME" codes={codes} name="PAY_ME" value={dsNewCar.PAY_ME ?? ''} data-type="newcar" onChange={handleChange} />
								    </ErpField>
								    <ErpField label="가상계좌" span={4} htmlFor="VBANK_CD">
										<CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} />
								        <input type="text" className="erp-input" id="VBANK_NO" name="VBANK_NO" data-type="newcar" value={dsNewCar.VBANK_NO ?? ''} onChange={handleChange} />
								    </ErpField>
								    <ErpField label="총 금액" span={4} htmlFor="TOTAL_AMT">
									<input type="text" className="erp-input" id="TOTAL_AMT" name="TOTAL_AMT" data-type="newcar" value={dsNewCar.TOTAL_AMT ?? ''} onChange={handleChange} />
								    </ErpField>
								</div>
								
								
								<div className="erp-row mt-10">
								    <div className="ag-theme-alpine" style={{ width: '100%', height: '286px' }}>
								        <AgGridReact
											suppressMovableColumns={true}
											suppressDragLeaveHidesColumns={true}
											suppressColumnMoveAnimation={true}
								            rowData={dsPaymentList}
								            columnDefs={paymentColumnDefs}
								            defaultColDef={{ sortable: true, resizable: true, suppressMovable: true, cellClass: 'ag-center-cell' }}
											onCellValueChanged={onCellValueChanged}
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
