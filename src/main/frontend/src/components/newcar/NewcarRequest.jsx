import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom'; // 페이지 이동
import { useTabs } from '../../context/TabContext'; // 전역 탭 

// 외부 라이브러리
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';

// 공통 컴포넌트
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { gf, log, mapData} from '../../utils/utils'; // 공통 유틸 함수
import CommonSelect from '../common/CommonSelect';	  // 콤보박스 세팅
import NumberPlateModal from './NumPlateSelectModal'; // 번호판 모달
import AddressSearchModal from '../common/AddressSearchModal';  // 주소검색 모달
import NewCarReceiptModal from './NewCarReceiptModal';	// 영수증 모달
import BondReceiptModal from './BondReceiptModal';		// 채권 인쇄 모달

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


// 화면 강조용 필수 입력 항목
const HIGHLIGHT_FIELDS = [
    'TASK_CD', 'REG_GB', 'REG_NO', 'OWNER_NM',
    'RATIO_NO', 'MPHONE_NO', 'ADDRESS', 'RT_ACC_NM',
    'BASE_ADDRESS', 'RT_ACC_NO', 'NTAX_TRGET_CD', 'NTAX_WHO',
    'BOND_DC', 'RT_BANK_CD', 'RETURN_NO', 'RETURN_NM'
];

// 실제 신청 검증용 필수 입력 항목
const REQUIRED_FIELDS = [
    { name: 'TASK_CD', label: '업무구분', tab: 'owner' },
    { name: 'CARID_NO', label: '차대번호', tab: 'owner' },
	{ name: 'REQ_CAR_NO', label: '차량번호', tab: 'owner' },
    { name: 'REG_GB', label: '등록구분', tab: 'owner' },
    { name: 'REG_NO', label: '등록번호', tab: 'owner' },
    { name: 'OWNER_NM', label: '성명(상호)', tab: 'owner' },
    { name: 'RATIO_NO', label: '소유비율', tab: 'owner' },
    { name: 'MPHONE_NO', label: '핸드폰번호', tab: 'owner' },
    { name: 'ADDRESS', label: '소유자 주소', tab: 'owner' },
    { name: 'RT_ACC_NM', label: '소유자 성명', tab: 'owner' },
    { name: 'BASE_ADDRESS', label: '사용본거지 주소', tab: 'owner' },
    { name: 'RT_ACC_NO', label: '사용본거지 연락처', tab: 'owner' },
    { name: 'NUMPLATE_GB', label: '번호판종류', tab: 'owner' },
    { name: 'PAY_GB', label: '결제구분', tab: 'owner' },
    { name: 'BUY_AMT', label: '공급가액', tab: 'owner' },
    { name: 'NTAX_TRGET_CD', label: '비과세대상', tab: 'owner' },
    { name: 'BOND_DC', label: '채권할인여부', tab: 'owner' },
    { name: 'RT_BANK_CD', label: '환급계좌 은행', tab: 'owner' },
    { name: 'RETURN_NO', label: '환급계좌번호', tab: 'owner' },
    { name: 'RETURN_NM', label: '환급예금주', tab: 'owner' }
];

// 결제관리 코드명 변환
const payKdMap = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };


// 회사별 화면/권한 정책
// - TASK
//   업무구분 콤보 표시 대상
//
// - DLVGB
//   배송지 콤보 표시 대상
//
// - MEMBER_GB_USE
//   true  : CA/SU 권한 구분 사용
//   false : CA/SU 통합 운영
//
const COMPANY_POLICY = {

    // 폴스타
    WA001: {
        TASK: ['NORML', 'LEASE'],
        DLVGB: ['INPUT', 'HANAM', 'JEJU', 'SUWON', 'SEOUL', 'DAEGU', 'BUSAN', 'DAEJE', 'GWANG', 'ILSAN'],
        MEMBER_GB_USE: true
    },

    // 한성
    WB001: {
		NUMGB: ['F', '7', 'FG'],
        MEMBER_GB_USE: false
    }
};


// 회사별 기본값
// // 값이 있으면 빈값 포함하여 무조건 적용
const COMPANY_DEFAULT = {

    // 폴스타
    WA001: {
    },

    // 한성
    WB001: {
       	dsNewCar: {
			NUMPLATE_GB: '', //번호판 선택으로 둠
			REGIST_DATE: '',
		}
    }
};

// 회사별 번호판 비용 설정
// 회사코드 > 번호판종류 > 금액
const COMPANY_NUMPLATE_PRICE = {

    // 폴스타
    WA001: {
        DEFAULT: 0,
		'NOT': 0,
		'': 0,
        '7': 31400,     // 전기
        'F': 28600      // 필름
    }
};

// 주민등록번호 / 법인등록번호 포맷팅 (123456-1234567)
const formatRegNo = (value) => {
	if (!value) return '';
	const num = String(value).replace(/\D/g, '').slice(0, 13);
	if (num.length <= 6) return num;
	return `${num.slice(0, 6)}-${num.slice(6, 13)}`;
};


// MEMBER_GB = 'CA' 회원구분 체크
const isCaMember = (user) =>
    !!user && user.MEMBER_GB === 'CA';

// COMPANY_ID LIKE 'WA%' 회사코드 체크
// (예: WA001, WA002 ...)
const isWaCompany = (user) =>
    !!user && !!user.COMPANY_ID && user.COMPANY_ID.indexOf('WA') === 0;

// COMPANY_ID LIKE 'WB%' 회사코드 체크
// (예: WB001, WB002 ...)
const isWbCompany = (user) =>
    !!user && !!user.COMPANY_ID && user.COMPANY_ID.indexOf('WB') === 0;


const NewcarRequest = () => {
	
	// UI 상태
	const [activeTab, setActiveTab] = useState('owner');
	// 번호선택 모달창
	const [isNumplateModalOpen, setIsNumplateModalOpen] = useState(false);
	// 주소 모달창
	const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
	// 예상금액 모달창
	const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
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
	// 번호선택 효과
	const [isShake, setIsShake] = useState(false);
	// reload 효과 
	const [isLoading, setIsLoading] = useState(false);
	// 소유자명 체크 계약자명에 복사 
	const [sameOwnerYn, setSameOwnerYn] = useState(false);
	// 사전비용 계산(저장, 신청)
	const [estimateMode, setEstimateMode] = useState('');

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
	const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false); 	// 영수증 모달창
	const [isBondReceiptModalOpen, setIsBondReceiptModalOpen] = useState(false); // 채권인쇄 모달창

	// 훅(hook) 세팅
	const location = useLocation();
	const navigate = useNavigate(); // 페이지이동
	const { tabs, activeTabId, removeTab, addTab, switchTab } = useTabs(); // 탭 관리
	
	// Param
	const receiptNo = location.state?.receiptNo ?? '';
	const detailOpenKey = location.state?.detailOpenKey ?? '';
	const hasInitializedRef = useRef(false);
	const loadedReceiptNoRef = useRef('');
	const loadedDetailOpenKeyRef = useRef('');
	const hasLoadedCodesRef = useRef(false);
	
	//  업무구분 리스
	const isLease = dsNewCar.TASK_CD === 'LEASE';
	
	const focusField = (fieldName, tabName = null) => {
		if (tabName) {
			setActiveTab(tabName);
		}

		window.setTimeout(() => {
			const targets = Array.from(document.querySelectorAll(`[name="${fieldName}"]`));
			const target = targets.find(el => !el.disabled && el.getClientRects().length > 0) || targets[0];

			if (!target) {
				return;
			}

			target.scrollIntoView({ block: 'center', inline: 'nearest' });
			target.focus({ preventScroll: true });
		}, 100);
	};

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

		const isCardPay = dsNewCar.CARD_YN === 'Y';
		const total = updated.reduce((sum, v) => {
			if (isCardPay && v.PAY_KD === 'ACQ') {
				return sum;
			}
			return sum + Number(v.PAY_AMT || 0);
		}, 0);

		setDsNewCar(prev => ({
			...prev,
			TOTAL_AMT: total
		}));
	};

	// INPUT SELECT 입력 가능 여부 체크 (내부 로직)
	const canEdit = () => {
		
		// 처리상태
		const procSt = (dsService.PROC_ST ?? '').trim();
		// 심사상태 
		const judgeSt = (dsService.JUDGE_ST ?? '').trim();
		// 회원구분(CA/SU) 권한 사용 여부
		const useMemberGb =
		    COMPANY_POLICY?.[dsUserInfo.COMPANY_ID]?.MEMBER_GB_USE ?? true;
		 
		// 'SU'는 INPUT 상태에서 조회만 가능
		if (
			useMemberGb &&
		    procSt === 'INPUT' && 
			dsUserInfo.MEMBER_GB === 'SU'
		) {
		    return false;
		}
		
		// 반려/삭제는 항상 수정 가능
		if (['RET', 'DEL'].includes(procSt)) {
			return true;
		}

		// 신청/완료 상태면 수정 불가
		if (['P_REQ', 'REQ', 'END', 'B_REQ', 'PBEND', 'PREND'].includes(procSt)) {
			return false;
		}

		// 심사상태 있으면 수정 불가
		if (judgeSt) {
			return false;
		}

		return true;
	};
	
	// 공동소유자 입력란 읽기 전용 여부 체크 (화면에서 직접 사용)
	const isJointOwnerReadOnly = (originalReadOnly = false) => {
		// 공동소유 비율 100 미만이면 무조건 입력 가능
		if (Number(dsNewCar?.RATIO_NO) < 100) {
		    return false;
		}

		return originalReadOnly || !canEdit();
	};

	// 공동소유자 입력란 비활성화 여부 체크 (화면에서 직접 사용)
	const isJointOwnerDisabled = (originalDisabled = false) => {
		// 공동소유 비율 100 미만이면 무조건 입력 가능
		if (Number(dsNewCar?.RATIO_NO) < 100) {
		    return false;
		}

		return originalDisabled || !canEdit();
	};

	
	// INPUT SELECT 읽기 전용 여부 체크 (화면에서 직접 사용)
	const isReadOnly = (originalReadOnly = false) => {
		return originalReadOnly || !canEdit();
	};
	
	// INPUT SELECT 비활성화 여부 체크 (화면에서 직접 사용)
	const isDisabled = (target = '', originalDisabled = false) => {

	    // 영수증 버튼 예외
	    if (target === 'RECEIPT_PRINT') {

	        const procSt = (dsService.PROC_ST ?? '').trim();

	        // 특정 상태에서는 활성화
	        if (['END', 'PBEND', 'PREND', 'J_REQ', 'J_ING', 'J_END'].includes(procSt)) {
	            return false;
	        }
	    }

	    return originalDisabled || !canEdit();
	};

	// 데이터셋 조회
	const showDataSet = () => {

	    const name = prompt('데이터셋명 입력');

	    console.log('dsUserInfo state', dsUserInfo);

	    const datasetMap = {
	        dsService,
	        dsNewCar,
	        dsOwnerInfo,
	        dsOwnerInfo1,
	        dsPaymentList,
	        dsBranchList,
	        dsBaseList,
	        dsCarNoDetach,
	        dsCompanyInfo,
	        dsUserInfo
	    };

	    console.log(datasetMap[name]);
	};

	// 계약자명 -> 소유자명 복사 체크
	const handleSameOwnerChange = (e) => {
		const checked = e.target.checked;

		setSameOwnerYn(checked);

		// 체크 시 계약자명 자동 입력
		if (checked) {
			setDsNewCar(prev => ({
				...prev,
				OWNER_NM: dsCarNoDetach.CUSTOMER_NM || '',
				PAY_NM: dsCarNoDetach.CUSTOMER_NM || ''
			}));
		}
	};
	
	useEffect(() => {
		if (hasLoadedCodesRef.current) {
			return;
		}

		const loadCodes = async () => {
			const codeData = await gf.getCodes(['SGB', 'PR_ST', 'JG_ST', 'NEWGB', 'DELIV', 'TASK', 
				'BOND', 'NTTCD', 'NTTGR', 'NTACD', 'NTWHO', 'STAGB', 'DLVGB', 'DLADD', 'REGGB', 
				'NUMGB', 'CARM', 'FRTAX', 'GOVT', 'PAYME', 'PAYGB', 'INSUR', 'NUMST', 'IMPST',
				'PAYKD', 'PAYME', 'PAYOP', 'PAYST', 'PAYTP', 'BANK', 'FUEL', 'CARUS', 'NHOLE', 
				'NSEAL' 
			]);

			hasLoadedCodesRef.current = true;
			setCodes(codeData);
		};

		loadCodes();
	}, [setCodes]);

	useEffect(() => {
		if (location.pathname !== '/newcar/newcar-request') {
			return;
		}

		// 접수번호 있는 경우
		if (receiptNo) {
			const shouldReloadDetail =
				detailOpenKey &&
				loadedDetailOpenKeyRef.current !== detailOpenKey;

			if (loadedReceiptNoRef.current === receiptNo && !shouldReloadDetail) {
				hasInitializedRef.current = true;
				return;
			}

			hasInitializedRef.current = true;
			loadedReceiptNoRef.current = receiptNo;
			loadedDetailOpenKeyRef.current = detailOpenKey;

			// 상세 조회 공통
			loadDetail(receiptNo);
			return;
		}

		if (hasInitializedRef.current) {
			return;
		}

		hasInitializedRef.current = true;
		loadedReceiptNoRef.current = '';

		// 신규 초기화
		initProcess();

	}, [detailOpenKey, location.pathname, receiptNo]);


	// 등록비용 사전조회
	const preregAmountProcess = async () => {

	    // 신청 검증과 동일하게 사용
	    const msg = validateRequest();

	    if (msg) {
	        gf.alert(msg);
	        return;
	    }
		
		setEstimateMode('SAVE'); // 조회 후 저장
	    setIsEstimateModalOpen(true);
	};
	
	// 등록
	const handleEstimateConfirm = () => {

	    if (estimateMode === 'SAVE') {

	        // 계산 후 저장만
	        calculatePreregAmount();

	    } else {

	        // 계산 후 신청
	        confirmRequestProcess();

	    }
	};
	
	// 등록비용 계산
	const getEstimateResult = () => {

	    const buyAmt = Number(
	        gf.onlyNumber(String(dsNewCar.BUY_AMT || '0'))
	    );

	    const acqTax = Math.floor((buyAmt * 0.07) / 10) * 10;
		const bondAmt = Math.floor((buyAmt * 0.2) / 10) * 10; // 채권매입액
	    const bond = Math.floor((buyAmt * 0.2 * 0.1) / 10) * 10;  // 채권할인금액 - 20%가 대형 최고금액(0.2), 채권할인금액 10% 적용(0.1)
	    const bondFee = Math.floor(((bondAmt * 0.003) + 600) / 10) * 10;
		
		const fee = Number(dsPaymentList.find(item => item.PAY_KD === 'FEE')?.PAY_AMT ?? 27500);
		const stamp = Number(dsPaymentList.find(item => item.PAY_KD === 'STAMP')?.PAY_AMT ?? 2500);
		const inji = Number(dsPaymentList.find(item => item.PAY_KD === 'INJI')?.PAY_AMT ?? 3000);

	    const isCardPay = dsNewCar.CARD_YN === 'Y';

	    const totalAmt = isCardPay
	        ? bond + fee + stamp + inji + bondFee
	        : acqTax + bond + fee + stamp + inji + bondFee;

	    const updatedNewCar = {
	        ...dsNewCar,
	        PREREG_AMT: totalAmt,
	        TOTAL_AMT: totalAmt
	    };

	    const updatedPaymentList = dsPaymentList.map(item => {
	        if (item.PAY_KD === 'ACQ') {
	            return { ...item, PRE_PAY_AMT: acqTax, PAY_AMT: acqTax };
	        }
	        if (item.PAY_KD === 'BOND') {
	            return { ...item, PRE_PAY_AMT: bond, PAY_AMT: bond };
	        }
	        if (item.PAY_KD === 'BFEE') {
	            return { ...item, PRE_PAY_AMT: bondFee, PAY_AMT: bondFee };
	        }
	        if (item.PAY_KD === 'FEE') {
	            return { ...item, PRE_PAY_AMT: fee, PAY_AMT: fee };
	        }
	        if (item.PAY_KD === 'INJI') {
	            return { ...item, PRE_PAY_AMT: inji, PAY_AMT: inji };
	        }
	        if (item.PAY_KD === 'STAMP') {
	            return { ...item, PRE_PAY_AMT: stamp, PAY_AMT: stamp };
	        }
	        return item;
	    });

		return {
		    buyAmt,
		    acqTax,
		    bond,
		    bondFee,
		    fee,
		    stamp,
		    inji,
		    isCardPay,
		    totalAmt,
		    updatedNewCar,
		    updatedPaymentList
		};
	};
	
	// 등록비용 사전조회 계산 후 저장
	const calculatePreregAmount = async () => {

		// 모달 닫기
		setIsEstimateModalOpen(false);
		
		// 예상금액 계산
		const {
		    updatedNewCar,
		    updatedPaymentList
		} = getEstimateResult();
		
		// 화면 상태 반영
		setDsNewCar(updatedNewCar);
		setDsPaymentList(updatedPaymentList);

		// 계산된 금액으로 저장
		await saveProcess(updatedNewCar, 'SAV', updatedPaymentList);
	};
	
	// 신청 - SU 제외 신청 CA는 예상금액 모달창 오픈
	const requestProcess = async () => {

		let ok = true;

		// 저장되지 않은 경우 먼저 저장
		if (!dsService.SERVICE_ID) {

		    ok = await gf.confirm('저장 후 신청 가능합니다. 저장하시겠습니까?');

		    if (!ok) {
		        return;
		    }

		    ok = await saveProcess();

		    if (!ok) {
		        return;
		    }
		}
		
		// 신청 전 유효성 체크
		const msg = validateRequest();

		// 유효성 오류
		if (msg) {
			gf.alert(msg);
			return;
		}

		// 'WAxxx'의 'CA'는 신청대기 상태만 신청 가능
		if (isWaCompany(dsUserInfo) && isCaMember(dsUserInfo)) {
			
			if(dsService.PROC_ST !== 'W_REQ') {
				gf.alert('신청대기 상태만 신청 가능합니다.');
			    return;
			} 
			
			setEstimateMode('REQ');
		    setIsEstimateModalOpen(true);
		    return;
		}
		
		// 그 외는 바로 신청 처리
	    confirmRequestProcess();
	};

	// 신청2 - SU가 요청 눌렀을 때 신청대기로 변경
	const requestWaitProcess = async () => {
		
		// 저장 및 요청일 때만 요청할 수 있게 => 신청대기 변경
		if(!['C_REQ', 'SAV'].includes(dsService.PROC_ST)) {
			alert('저장 및 요청 상태일 때만 요청 가능합니다.');
		    return;
		}
		
		// 필수 입력값 체크
		const validMsg = validateRequest();

		if (validMsg) {
			gf.alert(validMsg);
			return;
		}

	    const newDataSet = {
	        dsService: {
	            ...dsService,
	            PROC_ST: 'W_REQ' // 신청대기
	        },
	        dsNewCar: { ...dsNewCar },
	        dsOwnerInfo,
	        dsOwnerInfo1,
	        dsCarNoDetach,
	        dsPaymentList: [...dsPaymentList]
	    };

		await processService(newDataSet, "REQ");
	};

	// 필수 입력값 강조 (SU)
	const setRequiredHighlight = () => {
		const procSt = dsService?.PROC_ST ?? '';
		
		//if(!(isWaCompany(dsUserInfo) || ['SAV', 'C_REQ'].includes(procSt))) {
		if(!(['SAV', 'C_REQ', 'INPUT'].includes(procSt))) {
			return;
		}

		// 변수로 지정해둔 필수 입력값 읽어서 강조
		HIGHLIGHT_FIELDS.forEach(name => {

			if (name === 'TASK_CD') {

				document.querySelectorAll('[name="TASK_CD"]')[1]
					?.classList.add('required-highlight');

				return;
			}

			const elements = document.querySelectorAll(
				`[name="${name}"]`
			);

			elements.forEach(el => {
				el.classList.add('required-highlight');
			});
		});
	};
	
	// 모달창에서 신청 클릭 시 실제 신청 처리
	const confirmRequestProcess = async () => {
		
		// 저장용 데이터셋
		let newDataSet = {
		    dsService: { ...dsService },
		    dsNewCar: { ...dsNewCar },
		    dsOwnerInfo,
			dsOwnerInfo1,
		    dsCarNoDetach,
		    dsPaymentList: [...dsPaymentList]
		};
		
		// 'CA'만 신청시 예상금액 모달 표시
		if(isCaMember) {
			setIsEstimateModalOpen(false);

			const {
			    updatedNewCar,
			    updatedPaymentList
			} = getEstimateResult();

			// React 화면 상태에 반영
			setDsNewCar(updatedNewCar);
			setDsPaymentList(updatedPaymentList);
			
			newDataSet.dsNewCar = updatedNewCar;
			newDataSet.dsPaymentList = updatedPaymentList;
		} 
		
		else if (dsUserInfo.MEMBER_GB === 'SU') {
			gf.alert('신청 권한이 없습니다.');
			return;
		}
		
		// 후납
		if (newDataSet.dsNewCar.PAY_GB === "A") {
		    newDataSet.dsService.PROC_ST = "S_WAIT";
		    newDataSet.dsService.JUDGE_ST = "S_WAIT";
		}
		// 선납
		else {
		    newDataSet.dsService.PROC_ST = "P_REQ";
		    newDataSet.dsService.JUDGE_ST = "";
		}
		
		// 숫자 데이터 하이픈(-), 쉼표(,) 등 제거
		newDataSet = formatNumberData(newDataSet); 
		await processService(newDataSet, "REQ");

		return;
	};

	// 필수 입력 정보 체크 
	const validateRequiredFields = () => {

		const emptyField = REQUIRED_FIELDS.find(
			field => !dsNewCar[field.name]
		);

		if (emptyField) {
			focusField(emptyField.name, emptyField.tab);
			return `${emptyField.label}를(을) 입력해주세요.`;
		}

		return '';
	}; 

	// 신청 전 유효성 체크
	const validateRequest = () => {

		const requiredMsg = validateRequiredFields();

		if (requiredMsg) {
			return requiredMsg;
		}

		if (gf.Check(dsNewCar.CARID_NO, '차대번호', 17)) {
			focusField('CARID_NO');
			return '차대번호를 확인해주세요.';
		}

		if (dsNewCar.RATIO_NO < 100) {
			// TODO 대표소유자 비율이 100% 이하인경우에는 공동소유자가 존재해야한다.
			// 대표소유자 비율 + 공동소유자 비율의 합이 100%가 되어야 한다.	(공동소유자 비율 0이상, 대표소유자 비율 100 이하 둘의 합이 100이 아닐경우)
			if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 && Number(dsNewCar.RATIO_NO) + Number(dsOwnerInfo.DEBTOR_RATIO) !== 100) {
				focusField('DEBTOR_RATIO', 'owner');
				return '대표소유자 + 공동소유자 비율을 확인해주세요 둘의 합은 100%이어야 합니다.';				
			}
			else {
				// 공동소유자2명인 경우 총합이 100이 안되는지 확인
				if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 
				 && dsOwnerInfo1.DEBTOR_RATIO > 0 && dsOwnerInfo1.DEBTOR_RATIO <= 100 
				 && Number(dsNewCar.RATIO_NO) + Number(dsOwnerInfo.DEBTOR_RATIO) + Number(dsOwnerInfo1.DEBTOR_RATIO) !== 100) {
					focusField('DEBTOR_RATIO', 'owner');
					return '대표소유자 + 공동소유자1 + 공동소유자2 비율을 확인해주세요 둘의 합은 100%이어야 합니다.';
				}
				// 공동소유자 비율 합이 100%인경우 성명, 등록번호 주소체크
				if (dsOwnerInfo.DEBTOR_NM === '' || dsOwnerInfo.DEBTOR_REG_NO === '' || dsOwnerInfo.DEBTOR_ADDR === '') {
					focusField('DEBTOR_NM', 'owner');
					return '공동소유자의 정보를 입력해주세요.';
				}
			}
		}else {
			// 대표소유자 비율이 100%인 경우 공동소유자 정보가 없어야 한다.
			if (dsOwnerInfo.DEBTOR_RATIO > 0) {
				focusField('DEBTOR_RATIO', 'owner');
				return '대표소유자 비율이 100%인 경우 공동소유자 비율은 0%이어야 합니다.';
			}
			if (dsOwnerInfo.DEBTOR_NM || dsOwnerInfo.DEBTOR_REG_NO || dsOwnerInfo.DEBTOR_ADDR) {
				focusField('DEBTOR_NM', 'owner');
				return '대표소유자 비율이 100%인 경우 공동소유자 정보는 입력할 수 없습니다.';
			}
		}
		
		if (dsNewCar.NTAX_TRGET_CD === 'Y' && dsNewCar.NTAX_WHO === '') {
			focusField('NTAX_WHO', 'owner');
			return '비과세대상자 정보를 입력해주세요.';
		}
		
		return '';
	};

	// 저장 및 신청할 때 하이픈(-), 콤마(,) 제거한 숫자만 저장되도록 포맷팅
	const formatNumberData = (dataSet) => {
	    return {
	        ...dataSet,

	        dsService: {
	            ...dataSet.dsService,
	            LINK_ID: gf.onlyNumber(String(dataSet.dsService.LINK_ID || ''))
	        },

	        dsNewCar: {
	            ...dataSet.dsNewCar,
				// 주민등록번호
				REG_NO: gf.onlyNumber(String(dataSet.dsNewCar.REG_NO || '')),

				// 휴대폰번호
				MPHONE_NO: gf.onlyNumber(String(dataSet.dsNewCar.MPHONE_NO || '')),

				// 환급계좌
				RT_ACC_NO: gf.onlyNumber(String(dataSet.dsNewCar.RT_ACC_NO || '')),

				// 가상계좌
				VBANK_NO: gf.onlyNumber(String(dataSet.dsNewCar.VBANK_NO || '')),

				// 반환번호
				RETURN_NO: gf.onlyNumber(String(dataSet.dsNewCar.RETURN_NO || '')),

				// 금액
				BUY_AMT: gf.onlyNumber(String(dataSet.dsNewCar.BUY_AMT || '')),
				TOTAL_AMT: gf.onlyNumber(String(dataSet.dsNewCar.TOTAL_AMT || '')),
				RT_AMT: gf.onlyNumber(String(dataSet.dsNewCar.RT_AMT || '')),
				BOND_AMT: gf.onlyNumber(String(dataSet.dsNewCar.BOND_AMT || '')),
				
				// 날짜
				REGIST_DATE: gf.onlyNumber(String(dataSet.dsNewCar.REGIST_DATE || '')),
				MADE_DT: gf.onlyNumber(String(dataSet.dsNewCar.MADE_DT || '')),
				LAST_DT: gf.onlyNumber(String(dataSet.dsNewCar.LAST_DT || '')),
				INSURER_SDT: gf.onlyNumber(String(dataSet.dsNewCar.INSURER_SDT || '')),
				INSURER_EDT: gf.onlyNumber(String(dataSet.dsNewCar.INSURER_EDT || '')),
				NEWCAR_REG_DT: gf.onlyNumber(String(dataSet.dsNewCar.NEWCAR_REG_DT || ''))
	        },

	        dsOwnerInfo: {
	            ...dataSet.dsOwnerInfo,

				// 공동소유자 주민번호
				DEBTOR_REG_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_REG_NO || '')),

				// 공동소유자 사업자번호
				DEBTOR_BIZ_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_BIZ_NO || '')),

				// 공동소유자 전화번호
				DEBTOR_TEL_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_TEL_NO || '')),

				// 공동소유자 휴대폰번호
				DEBTOR_MPHONE_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_MPHONE_NO || ''))
	        },
			

			dsOwnerInfo1: {
			    ...dataSet.dsOwnerInfo1,

			    DEBTOR_REG_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_REG_NO || '')),
			    DEBTOR_BIZ_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_BIZ_NO || '')),
			    DEBTOR_TEL_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_TEL_NO || '')),
			    DEBTOR_MPHONE_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_MPHONE_NO || ''))
			},
			
			dsPaymentList: dataSet.dsPaymentList.map(item => ({
			    ...item,

			    PRE_PAY_AMT: gf.onlyNumber(String(item.PRE_PAY_AMT || '')),
			    PAY_AMT: gf.onlyNumber(String(item.PAY_AMT || ''))
			}))
	    };
	};

	// 저장
	const saveProcess = async (
	    newDsNewCar = null,
	    proc = "SAV",
	    newDsPaymentList = null // 사전조회 계산 결과 저장용
	) => {
		
		const targetNewCar = newDsNewCar || dsNewCar;

		// 저장은 차대번호만 체크
		if (gf.Check(targetNewCar.CARID_NO, '차대번호', 17)) {
		    gf.alert('차대번호를 확인해주세요.');
		    return;
		}
		
		// 저장 시 사용할 요청 데이터 생성
		// 파라미터가 있으면 계산된 최신 데이터 사용
		let newDataSet = {
		    dsService: { ...dsService },

		    dsNewCar: newDsNewCar
		        ? { ...newDsNewCar }
		        : { ...dsNewCar },

		    dsOwnerInfo,
		    dsOwnerInfo1,
		    dsCarNoDetach,

		    dsPaymentList: newDsPaymentList
		        ? [...newDsPaymentList]
		        : [...dsPaymentList]
		};
		
		// 숫자 데이터 하이픈(-), 쉼표(,) 등 제거 
		newDataSet = formatNumberData(newDataSet); 
		
	    const { PROC_ST } = dsService;
		const userGb = dsUserInfo.MEMBER_GB;
		log("userGb : " + userGb);

	    // 1. 일반 저장 상태 처리
		// 입력, 등록요청, 신청대기, 저장일 때 저장 가능 
	    if (["INPUT", "C_REQ", "W_REQ", "SAV"].includes(PROC_ST)) {
			
			// 최초 저장(INPUT) 또는 AD가 등록요청(C_REQ) 상태에서 저장할 때는 상태 유지, SU가 저장할 때는 저장으로 변경
			if ( PROC_ST === "INPUT" || (PROC_ST === "C_REQ" && userGb === "SU")) {
				newDataSet.dsService.PROC_ST = "SAV";
			}
	    }

		log("저장 요청 데이터:");
	    // 저장 실행
	    await processService(newDataSet, proc);
	};
	
	const processService = async (newDataSet, proc) => {

	    try {

	        // 저장 요청
	        const res = await axios.post('/api/newcar/process', newDataSet);
	        log("들렸다 옴");
			log(res);
			
			// 서버에러
			const isErr = (res.data?.data?.RESULT_CD ?? 0) < 0;
			
	        // 성공
	        if (res.data.success && !isErr) {
				
				let completeMsg; 
				
				if(newDataSet.dsService.PROC_ST === "REQ" && proc === "REQ") {
					completeMsg = "신청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "P_REQ" && proc === "REQ") {
					completeMsg = "납부요청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "W_REQ" && proc === "REQ") {
					completeMsg = "요청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "DEL" && proc === "DEL") {
					completeMsg = "삭제되었습니다.";
				}
				else {
					completeMsg = "저장되었습니다.";
				}

				if(proc !== "NUM_SAV") {
					await gf.alert(completeMsg);
				}

	            const serviceId = newDataSet.dsService.SERVICE_ID || res.data.data?.SERVICE_ID;
				
				// 최초 저장(insert) 후 SERVICE_ID만 화면 state 반영
				if (!dsService.SERVICE_ID && serviceId) {

				    setDsService(prev => ({
				        ...prev,
				        SERVICE_ID: serviceId
				    }));
				}

				// URL 상태 유지
				if (serviceId) {
					hasInitializedRef.current = true;
					loadedReceiptNoRef.current = serviceId;
					loadedDetailOpenKeyRef.current = '';

					navigate(location.pathname, {
						replace: true,
						state: { receiptNo: serviceId }
					});

					// 처리 후 화면 재조회
					await reloadProcess(serviceId);
					return true;
				}

	        } else {
				const errMsg = res.data?.data?.MESSAGE || res.data?.message || '저장 실패';
	            gf.alert(errMsg);
				return false;
	        }

	    } catch (err) {

	        console.error(err);

	        gf.alert('서버 오류 발생');
			return false;
	    }
	};

	
	// 새로고침: 탭은 유지하고 현재 화면 데이터만 다시 조회
	const reloadProcess = async (targetServiceId = '') => {

		try {
			// 로딩 시작
			setIsLoading(true);
			
			const serviceId = String(
			    targetServiceId ||
			    receiptNo ||
			    dsService.SERVICE_ID ||
			    ''
			).trim();
			
			// 이벤트 객체 넘어온 경우 제거
			if (
			    targetServiceId &&
			    typeof targetServiceId === 'object'
			) {
			    targetServiceId = '';
			}
			
			console.log('reload serviceId =', serviceId);

			// 저장 건이면 상세조회, 아니면 초기화
			if (serviceId) {
			    await loadDetail(serviceId);
			} else {
			    await initProcess();
			}
		}
		finally {
			// 로딩 종료
			setIsLoading(false);
		}
	};

	// 삭제
	const deleteProcess = async () => {

	    const procSt = (dsService.PROC_ST || '').trim();

	    // 삭제 가능 상태 체크
	    const deleteableStates = [
	        'I_REQ', 'I_SAV', 'INPUT', 'SAV', 'C_SAV', 'C_REQ', 'RET'
	    ];

	    if (!deleteableStates.includes(procSt)) {
	        gf.alert('삭제 처리가 불가능한 상태입니다.');
	        return;
	    }

	    // 저장 여부 체크
	    if (!dsService.SERVICE_ID) {
	        gf.alert('아직 저장되지 않은 데이터 입니다.');
	        return;
	    }

		const ok = await gf.confirm('삭제하시겠습니까?');
		if (!ok) {
			return;
		}

	    const newDataSet = {
	        dsService: {
	            ...dsService,
	            PROC_ST: 'DEL',
	            JUDGE_ST: 'DEL'
	        },
	        dsNewCar: { ...dsNewCar },
	        dsOwnerInfo,
	        dsOwnerInfo1,
	        dsCarNoDetach,
	        dsPaymentList
	    };

	    // 희망번호판이 있는 경우
	    if (newDataSet.dsNewCar.REQ_CAR_NO) {

	        const reqCarNo = newDataSet.dsNewCar.REQ_CAR_NO;

	        const confirmRelease = await gf.confirm(`선택하신 번호판 ${reqCarNo} 을(를) 미사용 처리 하시겠습니까?`);
			
	        if (confirmRelease) {

	            try {

	                // 번호판 미사용 처리
	                await axios.post('/api/newcar/updateNumplateUseYn', {
	                    serviceId: dsService.SERVICE_ID,
	                    carNo: reqCarNo
	                });

	                // 삭제 데이터에도 반영
	                newDataSet.dsNewCar.REQ_CAR_NO = '';

	            } catch (err) {
	                console.error(err);
	                gf.alert('번호판 미사용 처리 중 오류가 발생했습니다.');
	                return;
	            }
	        }
	    }

	    // 숫자 포맷 정리
	    const requestData = formatNumberData(newDataSet);

	    // 삭제 실행
	    await processService(requestData, 'DEL');
	};
	
	// 상세 조회 공통
	const loadDetail = async (receiptNo) => {
		console.log('loadDetail 진입');

		console.log('owner1', dsOwnerInfo);
		console.log('owner2', dsOwnerInfo1);
		
	    try {

	        const res = await fetch(`/api/newcar/detail/${receiptNo}`);
	        const data = await res.json();
	
	        if (data.success && data.data) {

				const dbData = gf.formatDateFields(data.data);
				
				// 신규등록 데이터 매핑
				const mappedNewCar = mapData(
				    initialDsNewCar,
				    dbData.dsNewCar,
				    newCarMap
				);

				// 결제목록
				const paymentList = Array.isArray(dbData.dsPaymentList)
				    ? dbData.dsPaymentList
				    : [];

				// 번호판대(TNUM) 및 총금액 계산
				const result = getNumplateResult(
				    dbData.dsUserInfo?.COMPANY_ID,
				    mappedNewCar,
				    paymentList
				);
				
				setDsPaymentList(result.dsPaymentList);

				setDsService(
				    mapData(initialDsService, dbData.dsService, serviceMap)
				);

				setDsNewCar(result.dsNewCar);

				setDsOwnerInfo(
				    mapData(initialOwnerInfo, dbData.dsOwnerInfo || {}, ownerMap)
				);

				setDsOwnerInfo1(
				    mapData(initialOwnerInfo1, dbData.dsOwnerInfo1 || {}, ownerMap)
				);
				
	            setDsBranchList(dbData.dsBranchList || []);
	            setDsBaseList(dbData.dsBaseList || []);
	            setDsCarNoDetach(dbData.dsCarNoDetach || {});
				setDsCompanyInfo(dbData.dsCompanyInfo || {});
				setDsWorkCp(dbData.dsWorkCp || {});
				setDsUserInfo(dbData.dsUserInfo || {});
				hasInitializedRef.current = true;
				loadedReceiptNoRef.current = receiptNo;
				loadedDetailOpenKeyRef.current = detailOpenKey;
				
	        }

	    } catch (err) {
			loadedReceiptNoRef.current = '';
			loadedDetailOpenKeyRef.current = '';
	        console.error(err);
	    }
	};

	// 상세조회 후 필수 입력값 강조
	useEffect(() => {
		setRequiredHighlight();
	}, [
		dsUserInfo.MEMBER_GB,
		dsService.PROC_ST,
		activeTab, // 다른 탭으로 이동했다가 돌아와도 남아 있도록
		dsNewCar
	]);
	

	// 공통코드 목록 조회
	// 회사별 설정에 따라 특정 코드만 콤보박스에 표시
	const getCodeList = (codeId) => {

	    let list = codes[codeId] || [];

		// 회사별 코드 필터 정보 조회
	    const filterCodes =
	        COMPANY_POLICY ?.[dsUserInfo.COMPANY_ID]?.[codeId];

	    if (filterCodes) {
	        list = list.filter(item =>
	            filterCodes.includes(item.CODE_ID)
	        );
	    }

	    return list;
	};
	
	// 번호판 종류에 따라 번호판대(TNUM) 금액 및 총금액 변경
	const updateNumplateAmount = (numplateGb) => {

	    const companyId = dsUserInfo.COMPANY_ID;

	    const companyPrice =
	        COMPANY_NUMPLATE_PRICE[companyId] || {};

		const dbFee = dsPaymentList.find(item => item.PAY_KD === 'FEE')?.PAY_AMT;

		const amount = Number(
		    dbFee ??
		    companyPrice[numplateGb] ??
		    companyPrice.DEFAULT ??
		    27500
		);

	    // 번호판대(TNUM) 금액 변경
	    const updatedPaymentList = dsPaymentList.map(item => {

	        if (item.PAY_KD === 'TNUM') {
	            return {
	                ...item,
	                PRE_PAY_AMT: amount,
	                PAY_AMT: amount
	            };
	        }

	        return item;
	    });

	    setDsPaymentList(updatedPaymentList);

	    // 총금액 재계산
	    const totalAmt = updatedPaymentList.reduce((sum, item) => {
	        return sum + Number(item.PAY_AMT || 0);
	    }, 0);

	    setDsNewCar(prev => ({
	        ...prev,
	        TOTAL_AMT: totalAmt
	    }));
	};
	
	// 결제정보 합계 계산
	const calculateTotalAmt = (paymentList) => {
	    return paymentList.reduce(
	        (sum, item) => sum + Number(item.PRE_PAY_AMT || 0),
	        0
	    );
	};
	
	// 번호판 종류에 따른 번호판대(TNUM) 금액 조회
	const getNumplateAmount = (companyId, numplateGb, paymentList) => {

	    const dbAmount = paymentList.find(
	        item => item.PAY_KD === 'TNUM'
	    )?.PRE_PAY_AMT;

	    const companyPrice =
	        COMPANY_NUMPLATE_PRICE[companyId] || {};

	    return Number(
	        dbAmount ??
	        companyPrice[numplateGb] ??
	        companyPrice.DEFAULT ??
	        27500
	    );
	};
	
	// 초기값 적용 순서
	// DB 조회값 → newcarInitial.js 기본값 → COMPANY_DEFAULT(회사별 기본값)
	const initProcess = async () => {
	    hasInitializedRef.current = true;
	    loadedReceiptNoRef.current = '';
	    loadedDetailOpenKeyRef.current = '';

	    // receiptNo 제거
	    navigate(location.pathname, { replace: true, state: {} });

	    // 화면 상태 초기화
	    setDsService(initialDsService);
	    setDsNewCar(initialDsNewCar);
	    setDsOwnerInfo(initialOwnerInfo);
	    setDsOwnerInfo1(initialOwnerInfo1);
	    setDsPaymentList([]);
	    setDsBranchList(initialDsBranchList);
	    setDsBaseList(initialDsBaseList);
	    setDsCompanyInfo({});
	    setDsCarNoDetach(initialDsCarNoDetach);

	    // DB 조회 후 초기값
	    const res = await fetch('/api/newcar/init', {
	        credentials: 'include',
	    });

	    const resData = await res.json();

	    log(resData);

	    if (resData.success) {

	        const {
	            dsService = {},
	            dsNewCar = {},
	            dsOwnerInfo = {},
	            dsOwnerInfo1 = {},
	            dsPaymentList = [],
	            dsBranchList = [],
	            dsBaseList = [],
	            dsCarNoDetach = {},
	            dsCompanyInfo = {},
	            dsUserInfo = {}
	        } = resData.data || {};

	        setDsUserInfo(dsUserInfo);


			// 초기값 병합
			// - DB값을 기준으로 생성
			// - newcarInitial.js에 값이 있는 항목은 DB값보다 우선 적용
			const mergeData = (initValue, dbValue) => {

			    // DB값을 기준으로 생성
			    const merged = { ...(dbValue || {}) };

			    // initial에 값이 있는 항목만 DB값 덮어쓰기
			    Object.keys(initValue || {}).forEach(key => {

			        const value = initValue[key];

			        if (
			            value !== null &&
			            value !== undefined &&
			            value !== ''
			        ) {
			            merged[key] = value;
			        }
			    });

			    return merged;
			};

			// 회사별 기본값
			// 적용 순서
			// 1. DB 조회값
			// 2. newcarInitial.js 기본값
			// 3. COMPANY_DEFAULT (값이 있으면 빈값 포함하여 무조건 적용)
			const companyDefault =
			    COMPANY_DEFAULT[dsUserInfo.COMPANY_ID] || {};

			const mergedService = {
			    ...mergeData(initialDsService, dsService),
			    ...(companyDefault.dsService || {})
			};

			const mergedNewCar = {
			    ...mergeData(initialDsNewCar, dsNewCar),
			    ...(companyDefault.dsNewCar || {})
			};

			const mergedOwnerInfo = {
			    ...mergeData(initialOwnerInfo, dsOwnerInfo),
			    ...(companyDefault.dsOwnerInfo || {})
			};

			const mergedOwnerInfo1 = {
			    ...mergeData(initialOwnerInfo1, dsOwnerInfo1),
			    ...(companyDefault.dsOwnerInfo1 || {})
			};

			const mergedCarNoDetach = {
			    ...mergeData(initialDsCarNoDetach, dsCarNoDetach),
			    ...(companyDefault.dsCarNoDetach || {})
			};
			
			// 번호판 금액 계산에 사용할 결제목록
			// DB에 결제내역이 있으면 사용하고,
			// 없으면 초기 결제목록 사용
			const paymentList = dsPaymentList?.length ? dsPaymentList : initialDsPaymentList;

			// 회사별 번호판 종류에 따른 금액 계산
			// - TNUM(번호판대) 금액 반영
			// - 총금액(TOTAL_AMT) 재계산
			const result = getNumplateResult(
			    dsUserInfo.COMPANY_ID,
			    mergedNewCar,
			    paymentList
			);
			
	        // 최종 세팅
	        setDsService(mergedService);
			setDsNewCar(result.dsNewCar);
	        setDsOwnerInfo(mergedOwnerInfo);
	        setDsOwnerInfo1(mergedOwnerInfo1);
	        setDsCarNoDetach(mergedCarNoDetach);

	        setDsCompanyInfo(dsCompanyInfo || {});
			setDsPaymentList(result.dsPaymentList);

	        setDsBranchList(
	            dsBranchList?.length
	                ? dsBranchList
	                : initialDsBranchList
	        );

	        setDsBaseList(
	            dsBaseList?.length
	                ? dsBaseList
	                : initialDsBaseList
	        );
	    }
	};
	
	/**
	 * 회사별 번호판 종류에 따른 금액 계산
	 * - 번호판대(TNUM) 금액 반영
	 * - 결제목록(PAYMENT) 갱신
	 * - 총금액(TOTAL_AMT) 재계산
	 */
	const getNumplateResult = (companyId, newCar, paymentList) => {

		const numplateAmt = getNumplateAmount(
		    companyId,
		    newCar.NUMPLATE_GB,
		    paymentList
		);

	    const updatedPaymentList = paymentList.map(item => {

	        if (item.PAY_KD === 'TNUM') {
	            return {
	                ...item,
	                PRE_PAY_AMT: numplateAmt,
	                PAY_AMT: numplateAmt
	            };
	        }

	        return item;
	    });

	    return {
	        dsNewCar: {
	            ...newCar,
	            TOTAL_AMT: calculateTotalAmt(updatedPaymentList)
	        },
	        dsPaymentList: updatedPaymentList
	    };
	};
	
	// 목록
	const goToList = () => {

	    const listTab = tabs.find(
	        tab => tab.path === '/newcar/newcar-list'
	    );

	    // 이미 열려있으면 해당 탭으로 이동
	    if (listTab) {
	        switchTab(listTab.id);
	        return;
	    }

	    // 없으면 신규 생성
	    addTab(
	        'new-list',
	        '신규신청현황',
	        '/newcar/newcar-list'
	    );
	};
	
	// 닫기
	const closeFrame = async () => {

		const ok = await gf.confirm('작성 중인 내용은 저장되지 않습니다. 닫으시겠습니까?');
		if (!ok) return;

		// 상태 초기화
		setDsService(initialDsService);
		setDsNewCar(initialDsNewCar);
		setDsOwnerInfo(initialOwnerInfo);
		setDsOwnerInfo1(initialOwnerInfo1);
		setDsPaymentList(initialDsPaymentList);
		setDsBranchList(initialDsBranchList);
		setDsBaseList(initialDsBaseList);
		setDsCarNoDetach(initialDsCarNoDetach);


		// 탭 제거
		removeTab(activeTabId);
	};
	
	
	// 번호선택 버튼 눌렀을 때 체크
	const handleOpenModal = async () => {
		
		console.log("SERVICE_ID : " + dsService.SERVICE_ID);
		
		// 차대번호 체크
		if (!dsNewCar.CARID_NO || dsNewCar.CARID_NO.length !== 17) {
		    gf.alert('차대번호 확인 필요');
		    return;
		}
		
	    // SERVICE_ID 체크
	    if (!dsService.SERVICE_ID) {
	        const ok = await gf.confirm('저장 후 사용 가능합니다. 저장하시겠습니까?');
	        if (ok) {
				await saveProcess();
	        }			
	        return;
	    }
		
	    // 3. 기존 번호 존재 여부
	    let reqCarNo = dsNewCar.REQ_CAR_NO;

	    if (reqCarNo) {
	        const confirmChange = await gf.confirm(`이미 차량번호 ${reqCarNo} 선택됨. 변경하시겠습니까?`);

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
	
	// 채권 인쇄 모달 열기
	const bondPrintProcess = () => {
		const bondYn = dsNewCar.BOND_LINK_YN ?? '';
		
	    if (bondYn === 'Y') {
	        setIsBondReceiptModalOpen(true);
	    } else {
			const width = 670;
			const height = 590;

			const left = (window.screen.width - width) / 2;
			const top = (window.screen.height - height) / 2;

			window.open(
			    'http://211.236.84.168/exploded/RegCivil/bondSch3.jsp',
			    'bondPopup',
			    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
			);
	    }
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
		        loadCd: 'RT_ACC_NM', // 도로명
		        addrInfo: 'ADDR_INFO'
		    }
		},

	    baseOwner: {
	        state: setDsNewCar,
	        fields: {
				addr: 'BASE_ADDRESS',
		        addrDt: 'BASE_ADDRESS_DT',
		        postNo: 'BASE_POST_NO',
		        bubjungCd: 'BASE_BUBJUNG_CD',
				loadCd : 'RT_ACC_NO',
				addrInfo: 'ADDR_INFO2'
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
		
		const isCorp =
		    dsNewCar.REG_GB === 'B' ||
		    dsNewCar.REG_GB === 'C';

		let addrInfo = '';

		if (isCorp) {
			addrInfo =
			    (addr.ROAD_CD ?? '') + 'þ' +
			    String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
			    (addr.HJD_CD ?? '') + 'þ' +
			    (addr.JIHA_YN ?? '0') + 'þ' +
			    (addr.BUILDB_NO ?? '0') + 'þ' +
			    (addr.BUILDS_NO ?? '0') + 'þ' +
			    (addr.ADDR_DT ?? '') + 'þ';
		}
		
		log('addrInfo>>'+addrInfo);
		
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

		    ...(target.fields.loadCd && {
		        [target.fields.loadCd]: addr.ROAD_CD
		    }),
	
			// 공동소유자, 배송인 경우 addrinfo 안 넣음 
		    ...(isCorp && target.fields.addrInfo && {
		        [target.fields.addrInfo]: addrInfo
		    })
		}));
	};

	// input 공통 핸들러
	const handleChange = (e) => {
	    const { name, value, dataset } = e.target;

	    let v = value; // value 변경 필요한 경우 v에 변경된 값 할당해야 오류 안 남

		// 차대번호 입력시 자동으로 대문자 변환
	    if (name === 'CARID_NO') {
	        v = gf.toUpperAlpha(value);
	    }
		
		// 금액 필드 콤마 제거 (입력할 때 나오는 NaN 방지)  
		else if(name === 'BUY_AMT') {
			v = value.replaceAll(',', '');
		}
		
		// 업무구분 변경시
		else if(name === 'TASK_CD' && value === 'LEASE') {

			setDsNewCar(prev => ({
			    ...prev,
			    NTAX_TRGET_CD: '00', // 업무구분 변경 시 비과세대상 초기화
			    NTAX_WHO: 'REPRE', 	// 업무구분 변경 시 비과세대상자 '대표소유자'
			    BOND_DC: 'SELL' 	// 업무구분 변경 시 채권할인여부 '매도'
			}));
		}
		
		// 번호판 변경
		else if (name === 'NUMPLATE_GB') {
		    updateNumplateAmount(value);
		}
		
		// 공동소유자 비율 100 초과 입력 방지
		else if(name === 'RATIO_NO') {
			const num = Number(value);

			if (!isNaN(num)) {
				if(num > 100) {
				    v = '100';
				}
				else if(num < 0) {
					v = '0';
				}
            }
		}
		
		// 배송지 변경 시 배송주소 자동 세팅
		else if (name === 'DELIVERY_GB') {
			const deliveryInfo = (codes['DLADD'] || []).find(
			    item => item.CODE_ID === v
			);
			// '/'으로 나눠서 각각의 컬럼에 넣어줌.
			const [
			    deliveryAddr = '',
				deliveryAddrDt = '',
			    receiveNm = '',
			    receiveTelNo = ''
			] = (deliveryInfo?.CODE_NM || '').split('/');

			setDsCarNoDetach(prev => ({
			    ...prev,
			    DELIVERY_ADDR: deliveryAddr,
				DELIVERY_ADDR_DT: deliveryAddrDt,
			    RECEIVE_NM: receiveNm,
			    RECEIVE_TEL_NO: receiveTelNo
			}));
		}
		
		// 리스 - 소유자 지점 선택
		else if (name === 'OWNER_BRANCH_ID') {

		    const branch = dsBranchList.find(
		        item => String(item.BRANCH_ID) === String(v)
		    );

		    if (branch) {

		        const isCorp =
		            dsNewCar.REG_GB === 'B' ||
		            dsNewCar.REG_GB === 'C';

		        let addrInfo = '';

		        if (isCorp) {
		            addrInfo =
		                (branch.ROAD_CD ?? '') + 'þ' +
		                String(branch.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
		                (branch.HJD_CD ?? '') + 'þ' +
		                'þ' +
		                'þ' +
		                'þ' +
		                (branch.ADDRESS_DT ?? '') + 'þ';
		        }

		        setDsNewCar(prev => ({
		            ...prev,
		            OWNER_BRANCH_ID: v,
		            ADDRESS: branch.ADDRESS,
		            ADDRESS_DT: branch.ADDRESS_DT,
		            POST_NO: branch.POST_NO,
		            BUBJUNG_CD: branch.BUBJUNG_CD,
		            RT_ACC_NM: branch.ROAD_CD,
		            ADDR_INFO: addrInfo
		        }));

		        return;
		    }
		}
		
		// 리스 - 사용본거지 선택
		else if (name === 'BASE_BRANCH_ID') {

		    const base = dsBaseList.find(
		        item => String(item.BASE_ID) === String(v)
		    );

		    if (base) {

		        const isCorp =
		            dsNewCar.REG_GB === 'B' ||
		            dsNewCar.REG_GB === 'C';

		        let addrInfo = '';

		        if (isCorp) {
		            addrInfo =
		                (base.ROAD_CD ?? '') + 'þ' +
		                String(base.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
		                (base.HJD_CD ?? '') + 'þ' +
		                'þ' +
		                'þ' +
		                'þ' +
		                (base.ADDRESS_DT ?? '') + 'þ';
		        }

		        setDsNewCar(prev => ({
		            ...prev,
		            BASE_BRANCH_ID: v,
		            BASE_ADDRESS: base.ADDRESS,
		            BASE_ADDRESS_DT: base.ADDRESS_DT,
		            BASE_POST_NO: base.POST_NO,
		            BASE_BUBJUNG_CD: base.BUBJUNG_CD,
		            RT_ACC_NO: base.ROAD_CD,
		            ADDR_INFO2: addrInfo
		        }));

		        return;
		    }
		}

	    if (dataset.type === 'newcar') {
	        setDsNewCar(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'service') {
	        setDsService(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'owner') {
		    setDsOwnerInfo(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'owner1') {
	        setDsOwnerInfo1(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'detach') {
	        setDsCarNoDetach(prev => ({ ...prev, [name]: v }));
	    } else if (dataset.type === 'company') {
            setDsCompanyInfo(prev => ({ ...prev, [name]: v }));
		}
	};

	// 배송지 주소검색 버튼 활성화 여부
	const canSearchDeliveryAddress = () => {
	    return canEdit() && dsCarNoDetach.DELIVERY_GB === 'INPUT';
	};
	
	const handleBlur = (e) => {

	    const { name, value } = e.target;

	    setDsNewCar(prev => {

	        const next = { ...prev };

	        if (name === 'OWNER_NM' && value.trim() !== '') {
	            next.PAY_NM = prev.OWNER_NM || '';
	        }

	        else if (name === 'MPHONE_NO' && value.trim() !== '') {
	            next.PAY_HP_NO = prev.MPHONE_NO || '';
	        }

	        return next;
	    });
	};
	

	const chekBaseAddr = () => {
		setDsNewCar(prev => ({
		    ...prev,
		    BASE_ADDRESS: dsNewCar.ADDRESS,
			BASE_ADDRESS_DT: dsNewCar.ADDRESS_DT,
			BASE_BUBJUNG_CD: dsNewCar.BUBJUNG_CD,
			RT_ACC_NO: dsNewCar.RT_ACC_NM,
			BASE_POST_NO: dsNewCar.POST_NO,
			ADDR_INFO2: dsNewCar.ADDR_INFO
		}));
	}
	
	// 취득세 카드납부 체크
	const handleCardYnChange = (e) => {

	    const checked = e.target.checked;
	    const cardYn = checked ? 'Y' : 'N';

	    setDsNewCar(prev => {

	        const next = {
	            ...prev,
	            CARD_YN: cardYn
	        };

	        const total = dsPaymentList.reduce((sum, v) => {

	            // 카드납부 시 취득세 제외
	            if (cardYn === 'Y' && v.PAY_KD === 'ACQ') {
	                return sum;
	            }

	            return sum + Number(v.PAY_AMT || 0);

	        }, 0);

	        next.TOTAL_AMT = total;

	        return next;
	    });
	};
	
	// === 기존 화면 ========================
	return (
		<div className="new-reg-container">
			{/* 로딩중 */}
			{isLoading && (
				<div className="loading-overlay">
					<div className="loading-spinner"></div>
				</div>
			)}
		
			{/* Unified Toolbar with Title */}
			<div className="erp-toolbar">
				<div className="toolbar-left">
					<button className="btn-erp light" onClick={goToList}>목록</button>
				</div>
				<div className="toolbar-right">
					{dsUserInfo.MEMBER_GB === 'UA' && (
						<button onClick={showDataSet}>데이터셋조회</button>
					)}
					{/* 신청 버튼 */}
					<button className="btn-erp" disabled={isDisabled()}
					    onClick={isWaCompany(dsUserInfo) && dsUserInfo.MEMBER_GB === 'SU'
					        ? requestWaitProcess
					        : requestProcess}
					>
					    {isWaCompany(dsUserInfo) && dsUserInfo.MEMBER_GB === 'SU'
					        ? '요청'
					        : '신청'
						}
					</button>
					
					<button className="btn-erp" onClick={() => saveProcess()} disabled={isDisabled()}>저장</button>
					<button className="btn-erp" onClick={() => reloadProcess(dsService.SERVICE_ID)}>새로고침</button>
					<button className="btn-erp" onClick={deleteProcess} disabled={!['I_REQ', 'I_SAV', 'INPUT', 'SAV', 'B_REQ', 'C_SAV', 'C_REQ', 'RET'].includes((dsService.PROC_ST || '').trim())}>삭제</button>
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
						<input type="text" id="SERVICE_ID" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} data-type="service" value={dsService.SERVICE_ID} readOnly={isReadOnly(true)} onClick={() => gf.copyText(dsService.SERVICE_ID, '접수번호')} onChange={() => { }} />
					</ErpField>
					<ErpField label="회사명" span={4} htmlFor="COMPANY_NM">
						<input type="text" className="erp-input" id="COMPANY_NM" name="COMPANY_NM" data-type="company" value={dsCompanyInfo.COMPANY_NM ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
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
						<input type="date" className="erp-input" id="JUDGE_DT" name="JUDGE_DT" data-type="service" value={dsService.JUDGE_DT} readOnly={isReadOnly(true)} onChange={() => { }} />
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
					<ErpField label="업무 구분" span={2} htmlFor="TASK_CD" labelWidth="120px">
						<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} options={getCodeList('TASK')} />
					</ErpField>
					<ErpField label="* 차대번호" span={3} htmlFor="CARID_NO">
						<input type="text" className={`erp-input ${!dsNewCar.CARID_NO ? 'highlight-red' : ''}`} id="CARID_NO" name="CARID_NO" value={dsNewCar.CARID_NO} data-type="newcar" onChange={handleChange} readOnly={isReadOnly()} maxLength={17} />
					</ErpField>
					<ErpField label="등록예정일자" span={3} labelWidth="120px" htmlFor="REGIST_DATE">
						<input type="date" className={`erp-input ${!dsNewCar.REGIST_DATE ? 'highlight-red' : ''}`} id="REGIST_DATE" name="REGIST_DATE" value={dsNewCar.REGIST_DATE} data-type="newcar" onChange={handleChange} readOnly={isReadOnly()} />
					</ErpField>
					<ErpField label="임시번호판 상태" span={2} htmlFor="IMSINUM_YN">
						<CommonSelect groupId="IMPST" codes={codes} name="IMSINUM_YN" value={dsNewCar.IMSINUM_YN ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="사용연료" span={2} htmlFor="FUEL_CD" labelWidth="120px">
						<CommonSelect groupId="FUEL" codes={codes} name="FUEL_CD" value={dsNewCar.FUEL_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
				</div>

				<div className="erp-row">
					<ErpField label="번호판지정 요구사항" span={6} labelWidth="120px" htmlFor="NUMPLATE_GB">
						<CommonSelect groupId="NUMGB" codes={codes} name="NUMPLATE_GB" value={dsNewCar.NUMPLATE_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()}
							options={getCodeList('NUMGB')} />
						<CommonSelect groupId="NHOLE" codes={codes} name="HOLE_YN" value={dsCarNoDetach.HOLE_YN ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
						<CommonSelect groupId="NSEAL" codes={codes} name="SEAL_YN" value={dsCarNoDetach.SEAL_YN ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="차량번호 선택" span={3} htmlFor="REQ_CAR_NO">
						<div className="flex-row">
							<input type="text" className={`erp-input ${!dsNewCar.REQ_CAR_NO ? 'red-btn' : ''}`} id="REQ_CAR_NO" name="REQ_CAR_NO" data-type="newcar" value={dsNewCar.REQ_CAR_NO} onChange={handleChange} readOnly={isReadOnly(true)} />
							<button className={`btn-erp sm light ${!dsNewCar.REQ_CAR_NO ? 'btn-shake red-btn' : ''}`} 
								style={{ minWidth: '65px', margin: '0 2px', padding: '13px 8px' }} onClick={handleOpenModal} 
								disabled={isDisabled()}>번호선택</button>
						</div>
					</ErpField>
					<div className="field-group col-3" style={{ borderRight: 'none' }}>
						<div className="flex-row">
							<input type="text" className="erp-input" id="GOVT_TX" name="GOVT_TX" data-type="newcar" value={dsNewCar.GOVT_TX} onChange={handleChange} readOnly={isReadOnly()} />
						</div>
					</div>
				</div>

				<div className="erp-row">
					<ErpField label="등록 차량번호" span={2} labelWidth="120px">
						<span className="value-red">{dsNewCar.CAR_NO}</span>
					</ErpField>
					<ErpField label="최초등록일" span={2}>
						<input type="date" className="erp-input" id="MADE_DT" name="MADE_DT" data-type="newcar" value={dsNewCar.MADE_DT} onChange={handleChange} readOnly={isReadOnly()} />
					</ErpField>
					<ErpField label="차종" span={2}>
						<span className="value-black">{dsNewCar.CAR_NM}</span>
					</ErpField>
					<ErpField label="용도구분" span={2}>
						<CommonSelect groupId="CARUS" codes={codes} name="CAR_US" value={dsNewCar.CAR_US ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="차명" span={2}>
						<span className="value-black">{dsNewCar.CAR_NM}</span>
					</ErpField>
					<ErpField label="형식" span={2} labelWidth="120px">
						<span className="value-black">{dsNewCar.CAR_NM}</span>
					</ErpField>
				</div>

				<div className="erp-row">
					<ErpField label="원동기형식" span={2} labelWidth="120px">
						<span className="value-black">{dsNewCar.FM_NM}</span>
					</ErpField>
					<ErpField label="형식승인번호" span={4} >
						<span className="value-black">{dsNewCar.SPMNNO}</span>
					</ErpField>
					<ErpField label="등록관청" span={2} htmlFor="GOVT_ID">
						<CommonSelect groupId="GOVT" codes={codes} name="GOVT_ID" value={dsService.GOVT_ID ?? ''} data-type="service" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="차령만료일" span={2}>
						<span className="value-black">{dsNewCar.LAST_DT ?? ''}</span>
					</ErpField>
					<ErpField label="공급가액(VAT별도)" span={2} labelWidth="120px">
						<span className="value-red text-right flex-grow" style={{ overflow: 'hidden', marginRight: '5px' }}>{Number(dsNewCar.BUY_AMT || 0).toLocaleString()}</span>
					</ErpField>
				</div>
			</ErpSection>

			{/* Tab Container */}
			<div className="tab-container">
				<div className="tab-header-list">
					<div className="tab-button-group">
						<button className={`tab-btn ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>등록정보</button>
						<button className={`tab-btn ${activeTab === 'delivery' ? 'active' : ''}`} onClick={() => setActiveTab('delivery')}>배송정보</button>
						<button className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>결제정보</button>
					</div>

					<div className="tab-header-extra">
						<label className="tab-checkbox-label">
							<input type="checkbox" checked={isMultiOwner} onChange={e => setIsMultiOwner(e.target.checked)} disabled={isDisabled()} /> 공동소유자 2명
						</label>
					</div>
				</div>
								
				<div className="tab-content">
					{activeTab === 'owner' && (
						<div className="owner-info-section">
							<div className="owner-split-layout">
							<ErpSection title="대표 소유자 정보" className="owner-panel owner-main-panel">
								<div className="erp-row">
									<ErpField label="신규등록 구분" span={6} htmlFor="PROC_CD">
										<CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
									</ErpField>
									<ErpField label="업무구분" required={true} span={6} htmlFor="TASK_CD" labelWidth="110px">
										<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} options={getCodeList('TASK')} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="주문번호" span={6} htmlFor="LINK_ID">
									<input type="text" className="erp-input" id="LINK_ID" name="LINK_ID" data-type="service" value={dsService.LINK_ID ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="계약자명" span={6} htmlFor="CUSTOMER_NM" labelWidth="110px">
										<input type="text" className="erp-input" id="CUSTOMER_NM" name="CUSTOMER_NM" data-type="detach" value={dsCarNoDetach.CUSTOMER_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="등록번호" required={true} span={dsNewCar.REG_GB === 'B' ? 4 : 6} htmlFor="REG_NO">
									    <CommonSelect groupId="REGGB" width="70px" codes={codes} name="REG_GB" value={dsNewCar.REG_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									    <input type="text" className="erp-input" id="REG_NO" name="REG_NO" data-type="newcar" 
												onKeyDown={gf.maskKeyDown} onChange={(e) => { handleChange(e); gf.maskCursor(e); }} readOnly={isReadOnly()}		
												value={gf.mask(dsNewCar.REG_NO, dsNewCar.REG_GB === 'C' ? 'BIZNO' : 'REGNO')} 
										/>
									</ErpField>
	
									{dsNewCar.REG_GB === 'B' && (
									    <ErpField label="사업자번호" required={true} span={2} htmlFor="BIZ_NO">
									        <input type="text" className="erp-input" id="BIZ_NO" name="BIZ_NO" data-type="newcar" value={gf.mask(dsNewCar.BIZ_NO, 'BIZNO')} onKeyDown={gf.maskKeyDown} onChange={(e) => { handleChange(e); gf.maskCursor(e); }} readOnly={isReadOnly()} />
									    </ErpField>
									)}
										
									<ErpField label="대표소유자명" span={4} required={true} htmlFor="OWNER_NM" className="ownerNm-field" labelWidth="110px"
									  	labelExtra={<input type="checkbox" className="erp-label-extra" checked={sameOwnerYn} onChange={handleSameOwnerChange} disabled={isDisabled()} />}>
										{/* 소유자명 = 계약자명 체크 */}
										<input type="text" className="erp-input" id="OWNER_NM" name="OWNER_NM" data-type="newcar" value={dsNewCar.OWNER_NM} onChange={handleChange} readOnly={isReadOnly()} onBlur={handleBlur} />
									</ErpField>
									<ErpField label="대표소유자 비율(%)" span={2} htmlFor="RATIO_NO" className="ratio-field" labelWidth="115px" >
										<input type="text" className="erp-input" id="RATIO_NO" name="RATIO_NO" data-type="newcar" value={dsNewCar.RATIO_NO} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="휴대폰번호" span={4} required={true} htmlFor="MPHONE_NO">
										<input type="text" className="erp-input" id="MPHONE_NO" name="MPHONE_NO" data-type="newcar" value={gf.formatPhoneNo(dsNewCar.MPHONE_NO)} onChange={handleChange} readOnly={isReadOnly()} onBlur={handleBlur} />
									</ErpField>
									<ErpField label="보험사 정보" span={8}>
										<CommonSelect groupId="INSUR" codes={codes} name="INSURER_CD" value={dsNewCar.INSURER_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="date" className="erp-input" id="INSURER_SDT" name="INSURER_SDT" data-type="newcar" value={dsNewCar.INSTALL_DT} onChange={handleChange} readOnly={isReadOnly()} />
										~
										<input type="date" className="erp-input" id="INSURER_EDT" name="INSURER_EDT" data-type="newcar" value={dsNewCar.INSURER_EDT} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="소유자 주소" span={9} required={true} htmlFor="ADDRESS">
										{ isLease ? (
											<CommonSelect codes={codes} name="OWNER_BRANCH_ID" value={dsNewCar.OWNER_BRANCH_ID ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()}
												options={dsBranchList.map(item => ({CODE_ID: item.BRANCH_ID, CODE_NM: item.BRANCH_NM}))}
											 /> 
										) : (
											<button className="btn-erp sm light mL-25" onClick={() => openAddressSearchModal('owner')} disabled={isDisabled()}>주소검색</button>
										)}
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="ADDRESS" name="ADDRESS" data-type="newcar" value={dsNewCar.ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
										<input type="text" className="erp-input text-left" id="ADDRESS_DT" style={{ width: '350px' }} name="ADDRESS_DT" data-type="newcar" value={dsNewCar.ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NM" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="사용 본거지" span={9} required={true} htmlFor="BASE_ADDRESS">
										{ isLease ? (
											<CommonSelect codes={codes} name="BASE_BRANCH_ID" value={dsNewCar.BASE_BRANCH_ID ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} 
												options={dsBaseList.map(item => ({CODE_ID: item.BASE_ID, CODE_NM: item.BASE_NM}))}
											/> 
										) : (
											<>
												<input type="checkbox" style={{ margin: '0 5px' }} disabled={isDisabled()} onClick={chekBaseAddr} />
												<button className="btn-erp sm light" onClick={() => openAddressSearchModal('baseOwner')} disabled={isDisabled()}>주소검색</button>
											</>
										)}
										
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="BASE_ADDRESS" name="BASE_ADDRESS" data-type="newcar" value={dsNewCar.BASE_ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
										<input type="text" className="erp-input text-left" style={{ width: '350px' }} id="BASE_ADDRESS_DT" name="BASE_ADDRESS_DT" data-type="newcar" value={dsNewCar.BASE_ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NO" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>
								</div>
							</ErpSection>

								<ErpSection title="공동 소유자 정보" className="owner-panel owner-co-panel">
									{/* 공동1 */}
									<div className="erp-row">
										<ErpField label="공동소유자명" span={3}>
											<input className="erp-input" name="DEBTOR_NM" data-type="owner" value={dsOwnerInfo?.DEBTOR_NM ?? ''} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
										<ErpField label="전화번호" span={3}>
											<input className="erp-input" name="DEBTOR_TEL_NO" data-type="owner" value={gf.formatPhoneNo(dsOwnerInfo?.DEBTOR_TEL_NO) ?? ''} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
										<ErpField label="등록번호" span={6}>
											<CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_GB" value={dsOwnerInfo.DEBTOR_GB ?? ''} data-type="owner" onChange={handleChange} disabled={isJointOwnerDisabled(true)}/>
											<input className="erp-input" name="DEBTOR_REG_NO" data-type="owner" value={formatRegNo(dsOwnerInfo?.DEBTOR_REG_NO ?? '')} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
									</div>
									<div className="erp-row">
										<ErpField label="사업자번호" span={4}>
											<input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
										<ErpField label="만료일" span={5}>
											<input type="date" className="erp-input" name="EXPIRE_DT" data-type="owner" value={dsOwnerInfo?.EXPIRE_DT ?? ''} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
										<ErpField label="공동소유 비율(%)" span={3} className="ratio-field" labelWidth="115px">
											<input className="erp-input" name="DEBTOR_RATIO" data-type="owner" value={dsOwnerInfo?.DEBTOR_RATIO ?? ''} onChange={handleChange} readOnly={isJointOwnerReadOnly(true)} />
										</ErpField>
									</div>
									<div className="erp-row">
										<ErpField label="공동소유자 주소" span={12}>
											<button className="btn-erp sm light" style={{ marginLeft: '2px' }} onClick={() => openAddressSearchModal('debtor')} disabled={isJointOwnerDisabled(true)}>주소검색</button>
											<input className={`erp-input ${!canEdit() ? 'disabled' : ''}`} name="DEBTOR_ADDR" value={dsOwnerInfo?.DEBTOR_ADDR ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
											<input className="erp-input" name="DEBTOR_ADDR_DT" value={dsOwnerInfo?.DEBTOR_ADDR_DT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
										</ErpField>
									</div>
	
									{/* 공동2 */}
									{isMultiOwner && (
										<>
											<ErpSection title="공동 소유자 2 정보" className="owner-panel owner-co-panel">
											<div className="erp-row">
												<ErpField label="공동소유자명(2)" span={4}>
													<input className="erp-input" name="DEBTOR_NM" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
												</ErpField>
												<ErpField label="사업자번호" span={5}>
													<input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
												</ErpField>
												<ErpField label="공동소유 비율(%)" span={3}>
													<input className="erp-input" name="DEBTOR_RATIO" data-type="owner1" value={dsOwnerInfo1?.DEBTOR_RATIO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
												</ErpField>
											</div>
											<div className="erp-row">
												
												<ErpField label="등록번호(2)" span={6}>
													<CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_REG_GB" value={dsOwnerInfo1.DEBTOR_REG_GB ?? ''} data-type="owner" onChange={handleChange} disabled={isDisabled()} />
													<input className="erp-input" name="DEBTOR_REG_NO" data-type="owner1" value={formatRegNo(dsOwnerInfo1?.DEBTOR_REG_NO ?? '')} onChange={handleChange} readOnly={isReadOnly()} />
												</ErpField>
											</div>
											</ErpSection>
										</>
									)}
								</ErpSection>
							</div>
						</div>
					)}

					{activeTab === 'delivery' && (
						<div className="delivery-info-section">
							<ErpSection title="번호판 배송 정보">

								<div className="erp-row">
									<ErpField label="배송자 정보" span={4} htmlFor="">
										<input type="text" name="INSTALL_NM" id="INSTALL_NM" data-type="detach" placeholder="배송자명" className="erp-input" value={dsCarNoDetach.INSTALL_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										<input type="text" name="INSTALL_TEL_NO" id="INSTALL_TEL_NO" data-type="detach" placeholder="배송자 전화번호" className="erp-input" value={gf.formatPhoneNo(dsCarNoDetach.INSTALL_TEL_NO) ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="배송지 선택" span={8} htmlFor="DELIVERY_GB">
										<CommonSelect groupId="DLVGB" codes={codes} name="DELIVERY_GB" value={dsCarNoDetach.DELIVERY_GB ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} options={getCodeList('DLVGB')} />
										<button className="btn-erp sm light" onClick={() => openAddressSearchModal('delivery')} disabled={!canSearchDeliveryAddress()} style={{margin:'0 1px 0 2px'}}>주소검색</button>
										<input type="text" className={`erp-input flex-grow ${!canEdit() ? 'disabled' : ''}`} id="DELIVERY_ADDR" name="DELIVERY_ADDR" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
										<input type="text" className={`erp-input flex-grow ${!canEdit() ? 'disabled' : ''}`} id="DELIVERY_ADDR_DT" name="DELIVERY_ADDR_DT" data-type="detach" value={dsCarNoDetach.DELIVERY_ADDR_DT ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="배송 예정일" span={4} htmlFor="INSTALL_DT">
										<input type="date" className="erp-input" id="INSTALL_DT" name="INSTALL_DT" data-type="detach" value={dsCarNoDetach.INSTALL_DT ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										<CommonSelect groupId="Time" codes={codes} name="INSTALL_TM" value={dsCarNoDetach.INSTALL_TM ?? ''} data-type="detach" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>
									<ErpField label="수령인 정보" span={5} htmlFor="RECEIVE_NM">
										<input type="text" className="erp-input" id="RECEIVE_NM" name="RECEIVE_NM" data-type="detach" placeholder="성함" value={dsCarNoDetach.RECEIVE_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										<input type="text" className="erp-input" id="RECEIVE_TEL_NO" name="RECEIVE_TEL_NO" data-type="detach" placeholder="연락처" value={gf.formatPhoneNo(dsCarNoDetach.RECEIVE_TEL_NO) ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="소유자명" span={3} htmlFor="CUSTOMER_NM">
										<input type="text" name="CUSTOMER_NM" id="CUSTOMER_NM" data-type="detach" placeholder="고객명" className="erp-input" value={dsCarNoDetach.CUSTOMER_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="배송 메모" span={12} htmlFor="NUM_MEMO_TX">
										<textarea className="erp-input erp-textArea" id="NUM_MEMO_TX" name="NUM_MEMO_TX" data-type="detach" style={{ height: '60px' }} value={dsCarNoDetach.NUM_MEMO_TX ?? ''} onChange={handleChange} readOnly={isReadOnly()}></textarea>
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="메모" span={12} htmlFor="MEMO_TX">
										<textarea className="erp-input erp-textArea" name="MEMO_TX" data-type="newcar" style={{ height: '90px' }} value={dsNewCar.MEMO_TX ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
							</ErpSection>
						</div>
					)}

					{activeTab === 'owner' && (
						<div className="reg-info-section fixed-reg-info-section">
							<ErpSection title="신규등록정보">

								<div className="erp-row">
									<ErpField label="신규등록 구분" span={3}>
										<CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
									</ErpField>

									<ErpField label="업무 구분" span={3}>
										<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} options={getCodeList('TASK')} />
									</ErpField>

									<ErpField label="입금구분" span={3}>
										<CommonSelect groupId="PAYGB" codes={codes} name="PAY_GB" value={dsNewCar.PAY_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="공급가액(VAT별도)" span={3} labelWidth="120px">
										<div className="flex-row">
											<input type="text" className="erp-input text-right" name="BUY_AMT" 
											data-type="newcar" value={Number(dsNewCar.BUY_AMT || 0).toLocaleString()} onChange={handleChange} readOnly={isReadOnly()} />
										</div>
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="비과세대상" span={6} required={true} >
										<CommonSelect groupId="NTTCD" codes={codes} name="NTAX_TRGET_CD" value={dsNewCar.NTAX_TRGET_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<CommonSelect groupId="NTWHO" codes={codes} name="NTAX_WHO" value={dsNewCar.NTAX_WHO ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="비과세대상등급" span={3}>
										<CommonSelect groupId="NTTGR" codes={codes} name="NTAX_TRGET_GR_CD" value={dsNewCar.NTAX_TRGET_GR_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="취득세 카드납부" span={3} labelWidth="120px">
										{/* 카드납부 여부 */}
										  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', margin: '0 5px', fontSize: '13px', cursor: 'pointer' }}>
										  	<input type="checkbox" name="CARD_YN" checked={dsNewCar.CARD_YN === 'Y'} onChange={handleCardYnChange} disabled={isDisabled()}/>
										  	카드납부 
										  </label>
										{/* 카드납부 확인 */}
										  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', margin: '0 5px', fontSize: '13px', cursor: 'pointer', height: '100%', backgroundColor: '#d1d0d0' }}>
										  	<input type="checkbox" name="CARD_PAY_YN" checked={dsNewCar.CARD_PAY_YN === 'Y'} disabled />
										  	카드납부 확인
										  </label>
									</ErpField>

								</div>

								<div className="erp-row">
									<ErpField label="채권할인여부" span={3} required={true} >
										<CommonSelect groupId="BOND" codes={codes} name="BOND_DC" value={dsNewCar.BOND_DC ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="인지세" span={5}>
										<CommonSelect groupId="STAMP" codes={codes} name="STAMP_GB" value={dsNewCar.STAMP_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className="erp-input" name="INJI_NO" data-type="newcar" value={dsNewCar.INJI_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="등록비용사전조회" span={4} labelWidth="120px">
										<div className="flex-row">
											<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.PREREG_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => { }} />
											<span style={{ margin: '0 5px' }}>원</span>
											<button className="btn-erp sm light" disabled={isDisabled()} onClick={preregAmountProcess}>조회</button>
										</div>
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="결제자명" span={3}>
										<input type="text" className="erp-input" name="PAY_NM" data-type="newcar" maxLength={30} value={dsNewCar.PAY_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="휴대폰번호" span={3}>
										<input type="text" className="erp-input" name="PAY_HP_NO" data-type="newcar" value={gf.formatPhoneNo(dsNewCar.PAY_HP_NO) ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="가상계좌" span={6}>
										<CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.VBANK_NO ?? ''} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="신규등록일자" span={3}>
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.NEWCAR_REG_DT ?? ''} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>

									<ErpField label="등록비용" span={3}>
										<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.TOTAL_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>

									<ErpField label="채권금액" span={3}>
										<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.BOND_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>

									<ErpField label="채권납부계좌" span={3} labelWidth="120px">
										<CommonSelect groupId="BANK" codes={codes} name="BOND_BANK_CD" value={dsNewCar.BOND_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.BOND_BANK_NO ?? ''} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="환급계좌" span={5} required={true} >
										<CommonSelect groupId="BANK" codes={codes} name="RT_BANK_CD" value={dsNewCar.RT_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className="erp-input" name="RETURN_NO" data-type="newcar" value={dsNewCar.RETURN_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="환급계좌 예금주" span={4} required={true} labelWidth="110px" >
										<input type="text" className="erp-input" name="RETURN_NM" data-type="newcar" value={dsNewCar.RETURN_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="환급금액" span={3} labelWidth="120px">
										<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.RT_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="등록증 배송지" span={12}>
										<button className="btn-erp sm light" style={{ marginLeft: '2px' }} onClick={() => openAddressSearchModal('carp')} disabled={isDisabled()}>주소 검색</button>
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} name="CARP_ADDRESS" value={dsNewCar.CARP_ADDRESS ?? ''} readOnly={isReadOnly(true)} onChange={() => { }} />
										<input type="text" className="erp-input" style={{ width: '220px' }} name="CARP_ADDRESS_DT" value={dsNewCar.CARP_ADDRESS_DT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} style={{ width: '100px' }} value={dsNewCar.CARP_POST_NO ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
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
										<input type="text" className="erp-input" id="PAY_HP_NO" name="PAY_HP_NO" data-type="newcar" value={gf.formatPhoneNo(dsNewCar.PAY_HP_NO) ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="납부상태" span={4}>
										<CommonSelect groupId="PAYST" codes={codes} name="PAY_ST" value={dsNewCar.PAY_ST ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<button className="btn-erp sm light" style={{ margin: '0 2px' }} onClick={bondPrintProcess} disabled={isDisabled('RECEIPT_PRINT')}>채권 인쇄</button>
										<button className="btn-erp sm light" style={{ marginRight: '2px' }} disabled={isDisabled('RECEIPT_PRINT')} onClick={() => setIsReceiptModalOpen(true)}>납부영수증</button>
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="납부방법" span={4} htmlFor="PAY_ME">
										<div className="flex-row" style={{ width: '100%', justifyContent: 'space-between', paddingRight: '5px' }}>
											<CommonSelect groupId="PAYME" codes={codes} name="PAY_ME" value={dsNewCar.PAY_ME ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										</div>
									</ErpField>
									<ErpField label="가상계좌" span={4} htmlFor="VBANK_CD">
										<CommonSelect groupId="BANK" codes={codes} name="VBANK_CD" value={dsNewCar.VBANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="VBANK_NO" name="VBANK_NO" data-type="newcar" value={dsNewCar.VBANK_NO ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
									</ErpField>
									<ErpField label="총 금액" span={4} htmlFor="TOTAL_AMT">
										<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} id="TOTAL_AMT" name="TOTAL_AMT" data-type="newcar" 
											value={dsNewCar.TOTAL_AMT ? Number(dsNewCar.TOTAL_AMT).toLocaleString() : ''} onChange={handleChange} readOnly={isReadOnly(true)} />
										<span class="wonText">원</span>
									</ErpField>
								</div>

								<div className="erp-row mt-10">
									<div className="ag-theme-alpine" style={{ width: '100%', height: '286px', pointerEvents: !canEdit() ? 'none' : 'auto' }} >
										<AgGridReact
											theme="legacy"
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
				dsUserInfo={dsUserInfo}
				onClose={() => setIsNumplateModalOpen(false)}
				onSelect={(isSucces, carNo) => {

					console.log('선택된 번호:', carNo);


					if (isSucces) {

						const newDsNewCar = {
							...dsNewCar,
							REQ_CAR_NO: carNo
						};

						setDsNewCar(newDsNewCar);
						saveProcess(newDsNewCar, "NUM_SAV");
					}
				}}

			/>

			{/* 주소검색 모달창 */}
			<AddressSearchModal
				isOpen={isAddressModalOpen}
				onClose={() => setIsAddressModalOpen(false)}
				onSelect={handleAddressSelect}
			/>

			{/* 예상금액 확인 모달창 */}
			{isEstimateModalOpen && (() => {
				const estimate = getEstimateResult();
				
				const {
				    buyAmt,
				    acqTax,
				    bond,
				    bondFee,
				    fee,
				    stamp,
				    inji,
				    isCardPay,
				    totalAmt
				} = estimate;
				
				return (
					<div className="estimate-modal-overlay">
						<div className="estimate-modal-container">
							{/* Header */}
							<div className="estimate-modal-header">
								<h3>예상금액 확인</h3>
								<button
									type="button"
									className="estimate-modal-close-btn"
									onClick={() => {
									    setIsEstimateModalOpen(false);
									}}
								>
									✕
								</button>
							</div>

							{/* Body */}
							<div className="estimate-modal-body">
								<table className="estimate-table">
									<tbody>
										<tr>
											<th>취득가액</th>
											<td>{buyAmt.toLocaleString()} 원</td>
										</tr>
										<tr>
											<th>취득세<br />{isCardPay ? '' : '(카드납부 제외)'}</th>
											<td style={isCardPay ? { textDecoration: 'line-through', color: '#868e96' } : {}}>
												{buyAmt.toLocaleString()} 원 × 7% = {acqTax.toLocaleString()} 원 {isCardPay && '(카드납부 제외)'}
											</td>
										</tr>
										<tr>
											<th>채권<br />(채권할인율 10%적용)</th>
											<td>{buyAmt.toLocaleString()} 원 × 20% ×10% = {bond.toLocaleString()} 원</td>
										</tr>
										<tr>
											<th>채권처리수수료</th>
											<td>{bondFee.toLocaleString()} 원</td>
										</tr>
										<tr>
											<th>수수료</th>
											<td>{fee.toLocaleString()} 원</td>
										</tr>
										<tr>
											<th>인지세</th>
											<td>{inji.toLocaleString()} 원</td>
										</tr>
										<tr>
											<th>증지대</th>
											<td>{stamp.toLocaleString()} 원</td>
										</tr>
										<tr className="total-row">
											<th>총 예상금액</th>
											<td>{totalAmt.toLocaleString()} 원</td>
										</tr>
									</tbody>
								</table>

								{estimateMode === 'REQ' && (
								    <div className="estimate-notice">
								        예상금액 {totalAmt.toLocaleString()}원으로 계산되었습니다.
								        가상계좌를 생성하시려면 신청 버튼을 눌러주세요.
								        <br />
								        고객님께서 입금 후 자동으로 관청에 신청 됩니다.
								    </div>
								)}
								
								{estimateMode === 'SAVE' && (
								    <div className="estimate-notice">
								        예상금액 {totalAmt.toLocaleString()}원으로 계산되었습니다.<br />
								        계산금액을 저장하시려면 저장 버튼을 눌러주세요.
								    </div>
								)}
							</div>

							{/* Footer */}
							<div className="estimate-modal-footer">
								<button
									type="button"
									className="btn-erp"
									onClick={handleEstimateConfirm}
								>
									{estimateMode === 'SAVE' ? '저장' : '신청'}
								</button>
								<button
									type="button"
									className="btn-erp light"
									onClick={() => {
									    setIsEstimateModalOpen(false);
									}}
								>
									닫기
								</button>
							</div>
						</div>
					</div>
				);
			})()}
			
			{/* 채권 인쇄 */}
			{isBondReceiptModalOpen  && (
				<BondReceiptModal
					dsService={dsService}
					dsNewCar={dsNewCar}
					dsPaymentList={dsPaymentList}
					dsCompanyInfo={dsCompanyInfo}
					gf={gf}
			        onClose={() => setIsBondReceiptModalOpen(false)}
				/>
			)}
			
			{/* 납부영수증 */}
			{isReceiptModalOpen && (
				<NewCarReceiptModal
					dsService={dsService}
					dsNewCar={dsNewCar}
					dsPaymentList={dsPaymentList}
					dsCompanyInfo={dsCompanyInfo}
					gf={gf}
					onClose={() => setIsReceiptModalOpen(false)}
				/>
			)}
			
		</div>
	);
};

export default NewcarRequest;
