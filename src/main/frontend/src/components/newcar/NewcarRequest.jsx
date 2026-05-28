
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
import AddressSearchModal from '../common/AddressSearchModal';

// Style
import './NewcarRequest.css';

// initial
import {
    // 초기화
	initialDsService,
	initialDsNewCar,
	initialOwnerInfo,
	initialOwnerInfo1,
	initialDsPaymentList,
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
	// 번호선택 모달창
	const [isNumplateModalOpen, setIsNumplateModalOpen] = useState(false);
	// 주소 모달창
	const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
	// 주소검색 대상
	const [addressTarget, setAddressTarget] = useState(null);
	// 2번째 공동소유자 체크박스
	const [isMultiOwner, setIsMultiOwner] = useState(false);
	// 사용자정보
	const [dsUserInfo, setDsUserInfo] = useState({});
	// 공통코드
	const [codes, setCodes] = useState({});
	// 결제정보
	const [dsPaymentList, setDsPaymentList] = useState([]);
	// 결제관리 코드명 변환
	const payKdMap = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };
	
	// ===== State 선언 =====
	// dsService 		: 현재 화면 데이터 객체
	// setDsService 	: dsService를 변경하는 함수
	// initialDsService : 초기값이 담긴 객체
	const [dsService, setDsService] = useState(initialDsService);           // 신청 기본정보
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);             // 신규등록 정보
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);      // 공동소유자1 정보
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo1);   // 공동소유자2 정보
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialDsCarNoDetach); // 번호판 배송 정보
	const [dsBranchList, setDsBranchList] = useState(initialDsBranchList); // 지점 목록
	const [dsBaseList, setDsBaseList] = useState(initialDsBaseList);       // 관청 목록
	const [dsCompanyInfo, setDsCompanyInfo] = useState({});
	const [dsWorkCp, setDsWorkCp] = useState({});
	

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
	
	// INPUT SELECT 입력 가능 여부 체크 (내부 로직)
	const canEdit = () => {
		
		const procSt = (dsService.PROC_ST ?? '').trim();
		const judgeSt = (dsService.JUDGE_ST ?? '').trim();

	    // 반려/삭제는 항상 수정 가능
	    if (['RET', 'DEL'].includes(procSt)) {
	        return true;
	    }

	    // 신청/완료 상태면 수정 불가
	    if (['REQ', 'END'].includes(procSt)) {
	        return false;
	    }

	    // 심사상태 있으면 수정 불가
	    if (judgeSt) {
	        return false;
	    }

	    return true;
	};

	const isReadOnly = (originalReadOnly = false) => {
	    return originalReadOnly || !canEdit();
	};

	const isDisabled = (originalDisabled = false) => {
	    return originalDisabled || !canEdit();
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

		// 접수번호 있는 경우
		if (receiptNo) {
			// 상세 조회 공통
		    loadDetail(receiptNo);
		}

	    // 신규 초기화
	    else {
	        initProcess();
	    }

	}, [receiptNo]);
	
	// 신청
	const requestProcess = () => {
		
		// 신청 전 유효성 체크
		const msg = validateRequest();

		// 유효성 오류
		if (msg) {
		    alert(msg);
		    return;
		}

		// 저장용 데이터셋
		const newDataSet = {
		    dsService: { ...dsService },
		    dsNewCar: { ...dsNewCar },
		    dsOwnerInfo,
		    dsCarNoDetach,
		    dsPaymentList: [...dsPaymentList]
		};

		// 신청 상태
		newDataSet.dsService.PROC_ST = "REQ";

		// 후납인 경우 심사요청 상태
		if (newDataSet.dsNewCar.PAY_GB === "A") {
		    newDataSet.dsService.JUDGE_ST = "S_REQ";
		}

		// 화면 상태 반영
		setDsService(prev => ({
		    ...prev,
		    PROC_ST: newDataSet.dsService.PROC_ST,
		    JUDGE_ST: newDataSet.dsService.JUDGE_ST
		}));

		// 신청 처리
		processService(newDataSet);
	};
	
	
	// TODO 일단 이건 나중에 더 추가한다.
	// 신청 전 유효성 체크
	const validateRequest = () => {

	    if (!dsNewCar.TASK_CD) {
	        return '업무구분을 선택해주세요.';
	    }

	    if (!gf.Check(dsNewCar.CARID_NO, '차대번호', 17)) {
	        return '차대번호를 확인해주세요.';
	    }

		if (!dsNewCar.REG_GB) {
	        return '등록번호 구분을 입력해주세요';
	    }
		
		if (!dsNewCar.REG_NO) {
	        return '등록번호를 입력해주세요';
	    }
		
		if (!dsNewCar.REG_NM) {
		    return '성명(상호)을 입력해주세요.';
		}
		
		if (!dsNewCar.RATIO_NO) {
		    return '소유비율을 입력해주세요.';
		}
				
	    if (!dsNewCar.NUMPLATE_GB) {
	        return '번호판종류를 선택해주세요.';
	    }

	    if (!dsNewCar.PAY_GB) {
	        return '결제구분이 없습니다.';
	    }

	    return '';
	};
	
	// 저장
	// 저장 처리
	const saveProcess = (newDsNewCar = null) => {

	    // 저장용 복사 데이터
	    const newDataSet = {
	        dsService: { ...dsService },

	        // 전달받은 신규 차량 데이터 우선 사용
	        dsNewCar: newDsNewCar
	            ? { ...newDsNewCar }
	            : { ...dsNewCar },

	        dsOwnerInfo,
	        dsCarNoDetach,
	        dsPaymentList: [...dsPaymentList]
	    };

	    // 유효성 체크
	    const err = validate();
	    if (err) return alert(err);

	    const { PROC_ST, JUDGE_ST } = dsService;

	    // 1. 일반 저장 상태 처리
	    if (["INPUT", "C_SAV", "SAV", "C_REQ"].includes(PROC_ST)) {

	        newDataSet.dsService.PROC_ST = "SAV";

	        setDsService(prev => ({
	            ...prev,
	            PROC_ST: "SAV"
	        }));
	    }

	    // 2. 채권 처리
	    else if (PROC_ST === "D_MAN") {

	        // 결제 데이터 재계산
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
	                return {
	                    ...item,
	                    PAY_AMT: 600
	                };
	            }

	            return item;
	        });

	        // 총 금액 계산
	        const total = updatedList.reduce((sum, v) =>
	            sum + Number(v.PAY_AMT || 0), 0
	        );

	        // 저장 데이터 반영
	        newDataSet.dsPaymentList = updatedList;
	        newDataSet.dsNewCar.TOTAL_AMT = total;

	        // 화면 상태 반영
	        setDsPaymentList(updatedList);

	        setDsNewCar(prev => ({
	            ...prev,
	            TOTAL_AMT: total
	        }));

	        // 채권 매입 확인
	        if (dsNewCar.BOND_DC === "BUY"
	            && !window.confirm("채권 매입입니다. 진행하시겠습니까?")) {
	            return;
	        }

	        // 저장 확인
	        if (!window.confirm("저장하시겠습니까?")) {
	            return;
	        }

	        // 선수금 처리
	        if (dsNewCar.PAY_GB === "B") {

	            const rtAmt = Number(dsNewCar.PREREG_AMT || 0) - total;

	            // 저장 데이터 반영
	            newDataSet.dsNewCar.RT_AMT = rtAmt;
	            newDataSet.dsService.PROC_ST = "D_PAY";
	            newDataSet.dsService.JUDGE_ST = "D_PAY";

	            // 화면 상태 반영
	            setDsNewCar(prev => ({
	                ...prev,
	                RT_AMT: rtAmt
	            }));

	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: "D_PAY",
	                JUDGE_ST: "D_PAY"
	            }));

	        } else {

	            // 저장 데이터 반영
	            newDataSet.dsService.PROC_ST = "B_REQ";
	            newDataSet.dsService.JUDGE_ST = "B_REQ";

	            // 화면 상태 반영
	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: "B_REQ",
	                JUDGE_ST: "B_REQ"
	            }));
	        }
	    }

	    // 3. 부분 업데이트 처리
	    else if (JUDGE_ST?.length > 0 && JUDGE_ST !== '선택') {

	        console.log("JUDGE_ST : " + JUDGE_ST);

	        if (JUDGE_ST !== "RET") {

	            console.log("부분 업데이트 저장");

	            ///////////////////
	            // TODO 처리해야 됨 //
	            ///////////////////
	        }

	        return;
	    }

	    // 4. 사용자 상태 처리
	    if (['GU'].includes(dsUserInfo.LOGIN_GB)
	        || dsUserInfo.LOGIN_GB?.startsWith('U')) {

	        if (JUDGE_ST === "RET") {

	            // 저장 데이터 반영
	            newDataSet.dsService.PROC_ST =
	                newDataSet.dsService.JUDGE_ST;

	            // 화면 상태 반영
	            setDsService(prev => ({
	                ...prev,
	                PROC_ST: prev.JUDGE_ST
	            }));
	        }
	    }

	    // 저장 실행
	    processService(newDataSet);
	};
	
	const processService = async (newDataSet) => {

	    try {

	        // 저장 요청
	        const res = await axios.post('/api/newcar/process', newDataSet);

	        // 성공
	        if (res.data.success) {

				const completeMsg =
				    newDataSet.dsService.PROC_ST === 'REQ'
				        ? '신청되었습니다.' : '저장되었습니다.';

				alert(completeMsg);

	            const serviceId = newDataSet.dsService.SERVICE_ID || res.data.data?.SERVICE_ID;

	            // 상세 조회 공통
	            if (serviceId) {

	                // receiptNo 유지
	                navigate(location.pathname, {
	                    replace: true,
	                    state: { receiptNo: serviceId }
	                });
	            }

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
	
	// 상세 조회 공통
	const loadDetail = async (receiptNo) => {

	    try {

	        const res = await fetch(`/api/newcar/detail/${receiptNo}`);
	        const data = await res.json();

	        if (data.success && data.data) {

	            const dbData = gf.formatDateFields(data.data);

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
				setDsCompanyInfo(dbData.dsCompanyInfo || {});
				setDsWorkCp(dbData.dsWorkCp || {});
	        }

	    } catch (err) {
	        console.error(err);
	    }
	};
	
	// 초기화
	const initProcess = async () => {

	    // receiptNo 제거 (핵심)
	    navigate(location.pathname, { replace: true, state: {} });

	    // 화면 상태 초기화
		setDsService(initialDsService);
		setDsNewCar(initialDsNewCar);
		setDsOwnerInfo(initialOwnerInfo);
		setDsOwnerInfo1(initialOwnerInfo1);
		setDsPaymentList([]);
		setDsBranchList(initialDsBranchList);
		setDsBaseList(initialDsBaseList);
		setDsCarNoDetach(initialDsCarNoDetach);

	    // DB 조회 후 초기값 
	    const res = await fetch('/api/newcar/init', {
	        credentials: 'include',
	    });


		const resData = await res.json();
		
		log(resData);


		if (resData.success) {
			// DB 저장된 초기값 조회 후 넣기
			const {
			    dsService = {},
			    dsNewCar = {},
			    dsOwnerInfo = {},
			    dsOwnerInfo1 = {},
			    dsPaymentList = [],
			    dsBranchList = [],
			    dsBaseList = [],
			    dsCarNoDetach = {}
			} = resData.data || {};


			// [setter, 초기값, DB값]
			const initDataList = {
			    dsService: [setDsService, initialDsService, dsService],
			    dsNewCar: [setDsNewCar, initialDsNewCar, dsNewCar],
			    dsOwnerInfo: [setDsOwnerInfo, initialOwnerInfo, dsOwnerInfo],
			    dsOwnerInfo1: [setDsOwnerInfo1, initialOwnerInfo1, dsOwnerInfo1],
			    dsCarNoDetach: [setDsCarNoDetach, initialDsCarNoDetach, dsCarNoDetach],
			    dsPaymentList: [setDsPaymentList, initialDsPaymentList, dsPaymentList],
			    dsBranchList: [setDsBranchList, initialDsBranchList, dsBranchList],
			    dsBaseList: [setDsBaseList, initialDsBaseList, dsBaseList]
			};
			
			// initial 기본값 세팅 후 DB값으로 덮어쓰기
			Object.entries(initDataList).forEach(
			    ([datasetName, [setter, initialData, data]]) => {

			        gf.setInitData(
			            setter,
			            initialData,
			            data,
			            resData.data.configList || [],
			            datasetName
			        );

			    }
			);
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
		
		// 차대번호 체크
		if (!dsNewCar.CARID_NO || dsNewCar.CARID_NO.length !== 17) {
		    alert('차대번호 확인 필요');
		    return;
		}
		
	    // SERVICE_ID 체크
	    if (!dsService.SERVICE_ID) {
	        if (window.confirm('저장 후 사용 가능합니다. 저장하시겠습니까?')) {
				await saveProcess();
	        }
	        return;
	    }
		
	    // 3. 기존 번호 존재 여부
	    let reqCarNo = dsNewCar.REQ_CAR_NO;

	    if (reqCarNo) {
	        const confirmChange = window.confirm(
	            `이미 차량번호 ${reqCarNo} 선택됨. 변경하시겠습니까?`
	        );

	        if (!confirmChange) return;

	        // 기존 번호 해제 API 호출
	        await axios.post('/api/newcar/updateNumplateUseYn', {
	            serviceId: dsService.SERVICE_ID,
	            carNo: reqCarNo
	        });

	        // 상태 초기화
	        setDsNewCar(prev => ({ ...prev, REQ_CAR_NO: '' }));
	    }

	    // 4. 모달 오픈
	    setIsNumplateModalOpen(true);
	};
	
	// 주소검색 모달 열기
	const openAddressSearchModal = (target) => {
		// 주소 대상 매핑
		setAddressTarget(addressTargetMap[target]);

		setIsAddressModalOpen(true);
	};
	
	// 주소 대상 매핑(검색 후)
	const addressTargetMap = {
		owner: {
		    state: setDsNewCar,
		    fields: {
		        addr: 'ADDRESS',
		        addrDt: 'ADDRESS_DT',
		        postNo: 'POST_NO',
		        bubjungCd: 'BUBJUNG_CD',
				loadCd : 'RT_ACC_NM'
		    }
		},

	    baseOwner: {
	        state: setDsNewCar,
	        fields: {
				addr: 'BASE_ADDRESS',
		        addrDt: 'BASE_ADDRESS_DT',
		        postNo: 'BASE_POST_NO',
		        bubjungCd: 'BASE_BUBJUNG_CD',
				loadCd : 'RT_ACC_NO'
	        }
	    },

	    debtor: {
	        state: setDsOwnerInfo,
	        fields: {
				addr: 'DEBTOR_ADDR',
				addrDt: 'DEBTOR_ADDR_DT',
				postNo: 'DEBTOR_ROAD_CD' // 기존 컬럼 재사용(우편번호 저장용)
	        }
	    },

	    delivery: {
	        state: setDsCarNoDetach,
	        fields: {
				addr: 'DELIVERY_ADDR',
				addrDt: 'DELIVERY_ADDR_DT',
				postNo: 'DELIVERY_POST_NO'
	        }
	    }
	};
	
	// 주소 선택 처리
	const handleAddressSelect = (addr) => {

	    const target = addressTarget;

		if (!target) {
		    return;
		}
		
		target.state(prev => ({
		    ...prev,
		    [target.fields.addr]: addr.ADDR,
		    [target.fields.addrDt]: addr.ADDR_DT,
		    [target.fields.postNo]: addr.POST_NO,
		    [target.fields.bubjungCd]: addr.BUBJUNG_CD,
			[target.fields.loadCd]: addr.ROAD_CD
		}));

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
					<button
					    onClick={() => {
					        const name = prompt('데이터셋명 입력');
	
					        const datasetMap = {
					            dsService,
					            dsNewCar,
					            dsOwnerInfo,
					            dsOwnerInfo1,
					            dsPaymentList,
					            dsBranchList,
					            dsBaseList,
					            dsCarNoDetach,
								dsCompanyInfo
					        };
	
					        console.log(datasetMap[name]);
					    }}
					>데이터셋조회</button>
                    <button className="btn-erp" onClick={requestProcess} >신청</button>
                    <button className="btn-erp" onClick={saveProcess} >저장</button>
                    <button className="btn-erp" onClick={reloadProcess} >새로고침</button>
                    <button className="btn-erp" onClick={deleteProcess} >삭제</button>
                    <button className="btn-erp" onClick={initProcess} >초기화</button>
                    <button className="btn-erp" onClick={closeFrame} >닫기</button>
                </div>
            </div>

			{/* Application Info Section */}
            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={2} htmlFor="WORK_CD">
                        <CommonSelect groupId="SGB" codes={codes} name="WORK_CD" value={dsService.WORK_CD ?? '1'} data-type="service" onChange={handleChange} disabled={isDisabled(true)} />
                    </ErpField>
                    <ErpField label="접수번호" span={3} htmlFor="SERVICE_ID">
                        <input type="text" id="SERVICE_ID" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} data-type="service" value={dsService.SERVICE_ID} readOnly={isReadOnly(true)} onChange={() => {}} />
                    </ErpField>
                    <ErpField label="회사명" span={4} htmlFor="COMPANY_ID">
                        <select className="erp-input" id="COMPANY_ID" name="COMPANY_ID" value={dsService.COMPANY_ID} data-type="service" onChange={handleChange} disabled={isDisabled(true)}>
                            <option value={dsCompanyInfo.COMPANY_ID}>{dsCompanyInfo.COMPANY_NM}</option>
                        </select>
                    </ErpField>
                    <ErpField label="신청자명" span={3} htmlFor="MEMBER_ID">
                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="MEMBER_ID" name="MEMBER_ID" data-type="service" value={dsService.MEMBER_ID ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={3} htmlFor="REQUEST_DT">
                        <input type="date" className="erp-input" id="REQUEST_DT" name="REQUEST_DT" data-type="service" value={dsService.REQUEST_DT} readOnly={isReadOnly(true)} onChange={handleChange} />
                    </ErpField>
                    <ErpField label="신청상태" span={2} htmlFor="PROC_ST">
                        <CommonSelect groupId="PR_ST" codes={codes} name="PROC_ST" value={dsService.PROC_ST ?? ''} data-type="service" onChange={handleChange} disabled={isDisabled(true)} />
                    </ErpField>
                    <ErpField label="심사일자" span={3} htmlFor="JUDGE_DT">
                        <input type="date" className="erp-input" id="JUDGE_DT" name="JUDGE_DT" data-type="service" value={dsService.JUDGE_DT} readOnly={isReadOnly(true)} onChange={() => {}} />
                    </ErpField>
                    <ErpField label="심사상태" span={2} htmlFor="JUDGE_ST">
                        <CommonSelect groupId="JG_ST" codes={codes} name="JUDGE_ST" value={dsService.JUDGE_ST ?? ''} data-type="service" onChange={handleChange} disabled={isDisabled(true)} />
                    </ErpField>
                    <ErpField label="배송상태" span={2} htmlFor="NUMPLATE_ST">
                        <CommonSelect groupId="NUMST" codes={codes} name="NUMPLATE_ST" value={dsCarNoDetach.NUMPLATE_ST ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled(true)} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="반려사유" span={12} htmlFor="RETURN_TX">
                        <input type="text" className="erp-input" id="RETURN_TX" name="RETURN_TX" data-type="service" value={dsService.RETURN_TX} readOnly={isReadOnly(true)} onChange={handleChange} />
                    </ErpField>
                </div>
            </ErpSection>

			{/* Vehicle Information Section */}
            <ErpSection title="자동차정보">
                <div className="erp-row">
                    <ErpField label="업무 구분" span={3} htmlFor="TASK_CD">
                        <CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                    </ErpField>
                    <ErpField label="* 차대번호" span={4} labelWidth="120px" htmlFor="CARID_NO">
                        <input type="text" className="erp-input highlight-red" id="CARID_NO" name="CARID_NO" value={dsNewCar.CARID_NO} data-type="newcar" onChange={handleChange} readOnly={isReadOnly()} />
                    </ErpField>
                    <ErpField label="임시번호판 상태" span={3} labelWidth="120px" htmlFor="IMSINUM_YN">
                        <CommonSelect groupId="IMPST" codes={codes} name="IMSINUM_YN" value={dsNewCar.IMSINUM_YN ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                    </ErpField>
                    <ErpField label="사용연료" span={2} htmlFor="FUEL_CD">
                        <CommonSelect groupId="FUEL" codes={codes} name="FUEL_CD" value={dsNewCar.FUEL_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
                    </ErpField>
                </div>

                <div className="erp-row">
                    <ErpField label="번호판지정 요구사항" span={6} labelWidth="120px" htmlFor="NUMPLATE_GB">
                        <CommonSelect groupId="NUMGB" codes={codes} name="NUMPLATE_GB" value={dsNewCar.NUMPLATE_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                        <CommonSelect groupId="NHOLE" codes={codes} name="HOLE_YN" value={dsCarNoDetach.HOLE_YN ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
                        <CommonSelect groupId="NSEAL" codes={codes} name="SEAL_YN" value={dsCarNoDetach.SEAL_YN ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
                    </ErpField>
                    <ErpField label="보조판 사용" span={3} labelWidth="120px" htmlFor="REQ_CAR_NO">
                        <div className="flex-row">
                            <input type="checkbox" id="BOND_YN" name="BOND_YN" data-type="newcar" checked={dsNewCar.BOND_YN === 'Y'} onChange={e => setDsNewCar({ ...dsNewCar, BOND_YN: e.target.checked ? 'Y' : 'N' })} style={{ margin: '0px 3px 0 5px' }} disabled={isDisabled()} />
                            <input type="text" className="erp-input" id="REQ_CAR_NO" name="REQ_CAR_NO" data-type="newcar" value={dsNewCar.REQ_CAR_NO} onChange={handleChange} readOnly={isReadOnly()} />
	                        <button className="btn-erp sm light" style={{ minWidth: '65px', margin: '0 2px' }} onClick={handleOpenModal} disabled={isDisabled()}>번호선택</button>
                        </div>
                    </ErpField>
                    <div className="field-group col-3" style={{ borderRight: 'none' }}>
                        <div className="flex-row">
                            <input type="text" className="erp-input" id="GOVT_TX" name="GOVT_TX" data-type="newcar" value={dsNewCar.GOVT_TX} onChange={handleChange} readOnly={isReadOnly()} />
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
                        <CommonSelect groupId="CARUS" codes={codes} name="CAR_US" value={dsNewCar.CAR_US ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
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
                        <CommonSelect groupId="GOVT" codes={codes} name="GOVT_ID" value={dsService.GOVT_ID ?? ''} data-type="service" onChange={handleChange} disabled={isDisabled()} />
                    </ErpField>
                    <ErpField label="차령만료일" span={2}>
                        <span className="value-black">{dsNewCar.LAST_DT ?? ''}</span>
                    </ErpField>
                    <ErpField label="취득가액" span={2}>
                        <span className="value-red text-right flex-grow" style={{ overflow: 'hidden', marginRight: '5px' }}>{Number(dsNewCar.BUY_AMT || 0).toLocaleString()}</span>
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
                                        <CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                                    </ErpField>
                                    <ErpField label="업무구분" required={true} span={3} htmlFor="TASK_CD">
                                        <CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                                    </ErpField>
                                    <ErpField label="임시허가관청" span={3}>
                                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value="" readOnly={isReadOnly(true)} onChange={() => {}} />
                                    </ErpField>
                                    <ErpField label="임시허가일자" span={3}>
                                        <input type="date" className="erp-input" value="" readOnly={isReadOnly(true)} onChange={() => {}} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="* 등록번호" span={5} htmlFor="REG_NO">
                                        <CommonSelect groupId="REGGB" codes={codes} name="REG_GB" value={dsNewCar.REG_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                                        <input type="text" className="erp-input" id="REG_NO" name="REG_NO" data-type="newcar" value={dsNewCar.REG_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="* 성명(상호)" span={5} htmlFor="OWNER_NM">
                                        <input type="text" className="erp-input" id="OWNER_NM" name="OWNER_NM" data-type="newcar" value={dsNewCar.OWNER_NM} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="비율(%)" span={2} htmlFor="RATIO_NO">
                                        <input type="text" className="erp-input" id="RATIO_NO" name="RATIO_NO" data-type="newcar" value={dsNewCar.RATIO_NO} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="전화번호" span={4} htmlFor="TEL_NO">
                                        <input type="text" className="erp-input" id="TEL_NO" name="TEL_NO" data-type="newcar" value={dsNewCar.TEL_NO} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="휴대폰번호" span={4} htmlFor="MPHONE_NO">
                                        <input type="text" className="erp-input" id="MPHONE_NO" name="MPHONE_NO" data-type="newcar" value={dsNewCar.MPHONE_NO} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="보험사 정보" span={4}>
                                        <CommonSelect groupId="INSUR" codes={codes} name="INSURER_CD" value={dsNewCar.INSURER_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
                                        <input type="date" className="erp-input" id="INSURER_SDT" name="INSURER_SDT" data-type="newcar" value={dsNewCar.INSTALL_DT} onChange={handleChange} readOnly={isReadOnly()} />
                                        ~
                                        <input type="date" className="erp-input" id="INSURER_EDT" name="INSURER_EDT" data-type="newcar" value={dsNewCar.INSURER_EDT} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="소유자 주소" span={9} htmlFor="ADDRESS">
                                        <button className="btn-erp sm light" style={{ marginLeft: '23px' }} onClick={() => openAddressSearchModal('owner')} disabled={isDisabled()}>주소검색</button>
                                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="ADDRESS" name="ADDRESS" data-type="newcar" value={dsNewCar.ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
                                        <input type="text" className="erp-input text-left" id="ADDRESS_DT" style={{ width: '350px' }} name="ADDRESS_DT" data-type="newcar" value={dsNewCar.ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
                                    </ErpField>
                                    <ErpField label="도로명코드" span={3} htmlFor="RT_ACC_NM">
                                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NM" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM} readOnly={isReadOnly(true)} onChange={handleChange} />
                                    </ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="사용 본거지" span={9} htmlFor="BASE_ADDRESS">
                                        <input type="checkbox" style={{ margin: '0 5px' }} disabled={isDisabled()} />
                                        <button className="btn-erp sm light" onClick={() => openAddressSearchModal('baseOwner')} disabled={isDisabled()}>주소검색</button>
                                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="BASE_ADDRESS" name="BASE_ADDRESS" data-type="newcar" value={dsNewCar.BASE_ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
                                        <input type="text" className="erp-input text-left" style={{ width: '350px' }} id="BASE_ADDRESS_DT" name="BASE_ADDRESS_DT" data-type="newcar" value={dsNewCar.BASE_ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
                                    </ErpField>
                                    <ErpField label="도로명코드" span={3} htmlFor="RT_ACC_NO">
                                        <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NO" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO} readOnly={isReadOnly(true)} onChange={handleChange} />
                                    </ErpField>
                                </div>
                            </ErpSection>


							<ErpSection title="공동 소유자 정보" className="mt-10">
	                            {/* 체크 */}
	                            <div className="erp-row">
	                                <div style={{ width: '100%', textAlign: 'right' }}>
	                                    <label>
	                                        <input type="checkbox" checked={isMultiOwner} onChange={e => setIsMultiOwner(e.target.checked)} disabled={isDisabled()} /> 공동소유자 2명
	                                    </label>
	                                </div>
	                            </div>
	
	                            {/* 공동1 */}
	                            <div className="erp-row">
	                                <ErpField label="성명(상호)" span={3}>
	                                    <input className="erp-input" name="DEBTOR_NM" data-type="owner" value={dsOwnerInfo?.DEBTOR_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="등록번호" span={4}>
	                                    <CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_REG_GB" value={dsOwnerInfo.REG_GB ?? ''} data-type="owner" onChange={handleChange} disabled={isDisabled()} />
	                                    <input className="erp-input" name="DEBTOR_REG_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_REG_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="사업자번호" span={3}>
	                                    <input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="비율(%)" span={2}>
	                                    <input className="erp-input" name="DEBTOR_RATIO" data-type="owner" value={dsOwnerInfo?.DEBTOR_RATIO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                            </div>
	
	                            <div className="erp-row">
	                                <ErpField label="전화번호" span={4}>
	                                    <input className="erp-input" name="DEBTOR_TEL_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_TEL_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="휴대전화번호" span={4}>
	                                    <input className="erp-input" name="DEBTOR_MPHONE_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_MPHONE_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="만료일" span={4}>
	                                    <input type="date" className="erp-input" name="EXPIRE_DT" data-type="owner" value={dsOwnerInfo?.EXPIRE_DT ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                            </div>
	
	                            <div className="erp-row">
	                                <ErpField label="공동소유자 주소" span={12}>
	                                    <button className="btn-erp sm light" style={{ marginLeft: '2px' }} onClick={() => openAddressSearchModal('debtor')} disabled={isDisabled(true)}>주소검색</button>
	                                    <input className={`erp-input ${!canEdit() ? 'disabled' : ''}`} name="DEBTOR_ADDR" value={dsOwnerInfo?.DEBTOR_ADDR ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
	                                    <input className="erp-input" name="DEBTOR_ADDR_DT" value={dsOwnerInfo?.DEBTOR_ADDR_DT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)}  />
	                                </ErpField>
	                            </div>
	
	                            {/* 공동2 */}
	                            {isMultiOwner && (
	                                <>
	                                    <div className="erp-row">
	                                        <ErpField label="성명(상호)(2)" span={3}>
	                                            <input className="erp-input" name="DEBTOR_NM" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                        </ErpField>
	                                        <ErpField label="등록번호(2)" span={4}>
	                                            <CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_GB" value={dsOwnerInfo1.DEBTOR_GB ?? ''} data-type="owner" onChange={handleChange} disabled={isDisabled()} />
	                                            <input className="erp-input" name="DEBTOR_REG_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_REG_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                        </ErpField>
	                                        <ErpField label="사업자번호" span={3}>
	                                            <input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                        </ErpField>
	                                        <ErpField label="비율(%)" span={2}>
	                                            <input className="erp-input" name="DEBTOR_RATIO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_RATIO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
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
                                        <CommonSelect groupId="DLVGB" codes={codes} name="DELIVERY_GB" value={dsCarNoDetach.DELIVERY_GB ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
                                        <button className="btn-erp sm light" onClick={() => openAddressSearchModal('delivery')} disabled={isDisabled()}>주소검색</button>
                                        <input type="text" className={`erp-input flex-grow ${!canEdit() ? 'disabled' : ''}`} id="DELIVERY_ADDR" name="DELIVERY_ADDR" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR} readOnly={isReadOnly(true)} onChange={handleChange} />
                                        <input type="text" className="erp-input text-left" style={{ width: '200px' }} id="DELIVERY_ADDR_DT" name="DELIVERY_ADDR_DT" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
                                    </ErpField>
                                </div>
                                
                                <div className="erp-row">
                                    <ErpField label="배송 예정일" span={4} htmlFor="INSTALL_DT">
                                        <input type="date" className="erp-input" id="INSTALL_DT" name="INSTALL_DT" data-type="detach" value={dsCarNoDetach.INSTALL_DT} onChange={handleChange} readOnly={isReadOnly()} />
                                        <CommonSelect groupId="Time" codes={codes} name="INSTALL_TM" value={dsCarNoDetach.INSTALL_TM ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
                                    </ErpField>
                                    <ErpField label="수령인 정보" span={5} htmlFor="RECEIVE_NM">
                                        <input type="text" className="erp-input" id="RECEIVE_NM" name="RECEIVE_NM" data-type="detach" placeholder="성함" value={dsCarNoDetach.RECEIVE_NM} onChange={handleChange} readOnly={isReadOnly()} />
                                        <input type="text" className="erp-input" id="RECEIVE_TEL_NO" name="RECEIVE_TEL_NO" data-type="detach" placeholder="연락처" value={dsCarNoDetach.RECEIVE_TEL_NO} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="고객명" span={3} htmlFor="CUSTOMER_NM">
                                        <input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="고객명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                </div>
                                
                                <div className="erp-row">
                                    <ErpField label="배송자 정보" span={9} htmlFor="">
                                        <input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="배송자명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} readOnly={isReadOnly()} />
                                        <input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="배송자 전화번호" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM} onChange={handleChange} readOnly={isReadOnly()} />
                                    </ErpField>
                                    <ErpField label="배송 관련 문자" span={3} htmlFor="btnDeliberySmsSend">
                                        <button className="btn-erp md light" id="btnDeliberySmsSend" disabled={isDisabled()}>SMS 발송</button>
                                    </ErpField>
                                </div>
                                
                                <div className="erp-row">
                                    <ErpField label="배송 메모" span={12} htmlFor="NUM_MEMO_TX">
                                        <textarea className="erp-input erp-textArea" id="NUM_MEMO_TX" name="NUM_MEMO_TX" data-type="detach" style={{ height: '60px' }} value={dsCarNoDetach.NUM_MEMO_TX} onChange={handleChange} readOnly={isReadOnly()}></textarea>
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
					                    <CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                </ErpField>

					                <ErpField label="업무 구분" span={3}>
					                    <CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
					                </ErpField>

					                <ErpField label="입금구분" span={3}>
					                    <CommonSelect groupId="PAYGB" codes={codes} name="PAY_GB" value={dsNewCar.PAY_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                </ErpField>

					                <ErpField label="구입가액(VAT별도)" span={3}>
					                    <div className="flex-row">
					                        <input type="text" className="erp-input text-right" name="BUY_AMT" data-type="newcar" value={Number(dsNewCar.BUY_AMT || 0).toLocaleString()} onChange={handleChange} readOnly={isReadOnly()} />
					                    </div>
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="비과세대상" span={4}>
					                    <CommonSelect groupId="NTTCD" codes={codes} name="NTAX_TRGET_CD" value={dsNewCar.NTAX_TRGET_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                    <CommonSelect groupId="NTWHO" codes={codes} name="NTAX_WHO" value={dsNewCar.NTAX_WHO ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                </ErpField>

					                <ErpField label="비과세대상등급" span={4}>
					                    <CommonSelect groupId="NTTGR" codes={codes} name="NTAX_TRGET_GR_CD" value={dsNewCar.NTAX_TRGET_GR_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                </ErpField>

					                <ErpField label="비과세적용구분" span={4}>
					                    <CommonSelect groupId="NTACD" codes={codes} name="NTAX_APPLC_CD" value={dsNewCar.NTAX_APPLC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="채권할인여부" span={3}>
					                    <CommonSelect groupId="BOND" codes={codes} name="BOND_DC" value={dsNewCar.BOND_DC ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                </ErpField>

					                <ErpField label="인지세" span={4}>
					                    <CommonSelect groupId="STAMP" codes={codes} name="STAMP_GB" value={dsNewCar.STAMP_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                    <input type="text" className="erp-input" name="INJI_NO" data-type="newcar" value={dsNewCar.INJI_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
					                </ErpField>

					                <ErpField label="등록비용사전조회" span={5}>
					                    <div className="flex-row">
					                        <input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.PREREG_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => {}} />
					                        <span style={{ margin: '0 5px' }}>원</span>
					                        <button className="btn-erp sm light" disabled={isDisabled()}>조회</button>
					                    </div>
					                </ErpField>
					            </div>
								<div className="erp-row">
					                <ErpField label="결제자명" span={3}>
					                    <input type="text" className="erp-input" name="PAY_NM" data-type="newcar" value={dsNewCar.PAY_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
					                </ErpField>

					                <ErpField label="휴대폰번호" span={3}>
					                    <input type="text" className="erp-input" name="PAY_HP_NO" data-type="newcar" value={dsNewCar.PAY_HP_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
					                </ErpField>

					                <ErpField label="가상계좌" span={6}>
					                    <CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />    
					                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.VBANK_NO ?? ''} readOnly={isReadOnly(true)} onChange={() => {}} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="신규등록일자" span={3}>
					                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.NEWCAR_REG_DT ?? ''} readOnly={isReadOnly(true)} onChange={() => {}} />
					                </ErpField>

					                <ErpField label="등록비용" span={3}>
					                    <input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.TOTAL_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={handleChange} />
					                </ErpField>

					                <ErpField label="채권금액" span={3}>
					                    <input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.BOND_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => {}} />
					                </ErpField>

					                <ErpField label="채권납부계좌" span={3}>
					                    <CommonSelect groupId="BANK" codes={codes} name="BOND_BANK_CD" value={dsNewCar.BOND_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.BOND_BANK_NO ?? ''} readOnly={isReadOnly(true)} onChange={() => {}} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="환급계좌" span={5}>
					                    <CommonSelect groupId="BANK" codes={codes} name="RT_BANK_CD" value={dsNewCar.RT_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					                    <input type="text" className="erp-input" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
					                </ErpField>

					                <ErpField label="환급계좌 예금주" span={4}>
					                    <input type="text" className="erp-input" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
					                </ErpField>

					                <ErpField label="환급금액" span={3}>
					                    <input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.RT_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => {}} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="등록증 배송지" span={12}>
					                    <button className="btn-erp sm light" style={{ marginLeft: '2px' }} onClick={() => openAddressSearchModal('carp')} disabled={isDisabled()}>주소 검색</button>
					                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} name="CARP_ADDRESS" value={dsNewCar.CARP_ADDRESS ?? ''} readOnly={isReadOnly(true)} onChange={() => {}} />
					                    <input type="text" className="erp-input" style={{ width: '220px' }} name="CARP_ADDRESS_DT" value={dsNewCar.CARP_ADDRESS_DT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
					                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} style={{ width: '100px' }} value={dsNewCar.CARP_POST_NO ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
					                </ErpField>
					            </div>

					            <div className="erp-row">
					                <ErpField label="메모" span={12}>
					                    <textarea className="erp-input erp-textArea" name="MEMO_TX" data-type="newcar" style={{ height: '90px' }} value={dsNewCar.MEMO_TX ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
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
	                                    <input type="text" className="erp-input" id="PAY_NM" name="PAY_NM" data-type="newcar" value={dsNewCar.PAY_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="휴대폰번호" span={4} htmlFor="PAY_HP_NO">
	                                    <input type="text" className="erp-input" id="PAY_HP_NO" name="PAY_HP_NO" data-type="newcar" value={dsNewCar.PAY_HP_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
	                                </ErpField>
	                                <ErpField label="납부상태" span={4}>
	                                    <CommonSelect groupId="PAYST" codes={codes} name="PAY_ST" value={dsNewCar.PAY_ST ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
	                                </ErpField>
	                            </div>
	                            
	                            <div className="erp-row">
	                                <ErpField label="납부방법" span={4} htmlFor="PAY_ME">
	                                    <CommonSelect groupId="PAYME" codes={codes} name="PAY_ME" value={dsNewCar.PAY_ME ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
	                                </ErpField>
	                                <ErpField label="가상계좌" span={4} htmlFor="VBANK_CD">
	                                    <CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
	                                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="VBANK_NO" name="VBANK_NO" data-type="newcar" value={dsNewCar.VBANK_NO ?? ''} onChange={handleChange} readOnly={isReadOnly(true)}  />
	                                </ErpField>
	                                <ErpField label="총 금액" span={4} htmlFor="TOTAL_AMT">
	                                    <input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="TOTAL_AMT" name="TOTAL_AMT" data-type="newcar" value={dsNewCar.TOTAL_AMT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
	                                </ErpField>
	                            </div>
	                            
	                            <div className="erp-row mt-10">
	                                <div className="ag-theme-alpine" style={{ width: '100%', height: '286px', pointerEvents: !canEdit() ? 'none' : 'auto' }}>
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
			
			{/* 번호선택 모달창 */}
			<NumberPlateModal
			    isOpen={isNumplateModalOpen}
				dsService={dsService}
				dsNewCar={dsNewCar}
				dsCarNoDetach={dsCarNoDetach}
			    onClose={() => setIsNumplateModalOpen(false)}
			    onSelect={(isSucces, carNo) => {
					
			        console.log('선택된 번호:', carNo);
 					

					if (isSucces) {

					    const newDsNewCar = {
					        ...dsNewCar,
					        REQ_CAR_NO: carNo
					    };

					    setDsNewCar(newDsNewCar);
					    saveProcess(newDsNewCar);
					}
			    }}
			/>
			
			{/* 주소검색 모달창 */}
			<AddressSearchModal
				isOpen={isAddressModalOpen}
				onClose={() => setIsAddressModalOpen(false)}
				onSelect={handleAddressSelect}
			/>
			
        </div>
    );
};

export default NewcarRequest;
