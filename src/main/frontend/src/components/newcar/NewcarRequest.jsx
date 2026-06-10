import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom'; // 페이지 이동
import { useTabs } from '../../context/TabContext'; // 전역 탭 

// 외부 라이브러리
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';

// 공통 컴포넌트
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { gf, log, mapData } from '../../utils/utils'; // 공통 유틸 함수
import CommonSelect from '../common/CommonSelect';	  // 콤보박스 세팅
import NumberPlateModal from './NumPlateSelectModal'; // 번호판 모달
import AddressSearchModal from '../common/AddressSearchModal';  // 주소검색 모달
import NewCarReceiptModal from './NewCarReceiptModal';	// 영수증 모달

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
    'TASK_CD',
    'REG_GB',
    'REG_NO',
    'OWNER_NM',
    'RATIO_NO',
    'MPHONE_NO',
    'ADDRESS',
    'ADDRESS_DT',
    'RT_ACC_NM',
    'BASE_ADDRESS',
    'BASE_ADDRESS_DT',
    'RT_ACC_NO',
    'NTAX_TRGET_CD',
    'NTAX_WHO',
    'BOND_DC',
    'RT_BANK_CD',
    'RETURN_NO',
    'RETURN_NM'
];

// 실제 신청 검증용 필수 입력 항목
const REQUIRED_FIELDS = [
    { name: 'TASK_CD', label: '업무구분', tab: 'owner' },
    { name: 'CARID_NO', label: '차대번호', tab: 'owner' },
    { name: 'REG_GB', label: '등록구분', tab: 'owner' },
    { name: 'REG_NO', label: '등록번호', tab: 'owner' },
    { name: 'OWNER_NM', label: '성명(상호)', tab: 'owner' },
    { name: 'RATIO_NO', label: '소유비율', tab: 'owner' },
    { name: 'MPHONE_NO', label: '핸드폰번호', tab: 'owner' },
    { name: 'ADDRESS', label: '소유자 주소', tab: 'owner' },
    { name: 'ADDRESS_DT', label: '소유자 상세주소', tab: 'owner' },
    { name: 'RT_ACC_NM', label: '소유자 성명', tab: 'owner' },
    { name: 'BASE_ADDRESS', label: '사용본거지 주소', tab: 'owner' },
    { name: 'BASE_ADDRESS_DT', label: '사용본거지 상세주소', tab: 'owner' },
    { name: 'RT_ACC_NO', label: '사용본거지 연락처', tab: 'owner' },
    { name: 'NUMPLATE_GB', label: '번호판종류', tab: 'owner' },
    { name: 'PAY_GB', label: '결제구분', tab: 'owner' },
    { name: 'BUY_AMT', label: '구입가액', tab: 'owner' },
    { name: 'NTAX_TRGET_CD', label: '비과세대상', tab: 'owner' },
    { name: 'BOND_DC', label: '채권할인여부', tab: 'owner' },
    { name: 'RT_BANK_CD', label: '환급계좌 은행', tab: 'owner' },
    { name: 'RETURN_NO', label: '환급계좌번호', tab: 'owner' },
    { name: 'RETURN_NM', label: '환급예금주', tab: 'owner' }
];

// 주민등록번호 / 법인등록번호 포맷팅 (123456-1234567)
const formatRegNo = (value) => {
	if (!value) return '';
	const num = String(value).replace(/\D/g, '').slice(0, 13);
	if (num.length <= 6) return num;
	return `${num.slice(0, 6)}-${num.slice(6, 13)}`;
};


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

	// ===== State 선언 =====
	// dsService 		: 현재 화면 데이터 객체
	// setDsService 	: dsService를 변경하는 함수
	// initialDsService : 초기값이 담긴 객체
	const [dsService, setDsService] = useState(initialDsService);           // 신청 기본정보
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);             // 신규등록 정보
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);      // 공동소유자1 정보
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo1);   // 공동소유자2 정보
	const [showOwnerPanel, setShowOwnerPanel] = useState(false); 			// 공동소유자 open 여부
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialDsCarNoDetach); // 번호판 배송 정보
	const [dsBranchList, setDsBranchList] = useState(initialDsBranchList); // 지점 목록
	const [dsBaseList, setDsBaseList] = useState(initialDsBaseList);       // 관청 목록
	const [dsCompanyInfo, setDsCompanyInfo] = useState({});
	const [dsWorkCp, setDsWorkCp] = useState({});
	const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false); 	// 영수증 모달창

	// 훅(hook) 세팅
	const location = useLocation();
	const navigate = useNavigate(); // 페이지이동
	const { tabs, activeTabId, removeTab } = useTabs(); // 탭 관리
	
	// Param
	const receiptNo = location.state?.receiptNo ?? '';
	const detailOpenKey = location.state?.detailOpenKey ?? '';
	const hasInitializedRef = useRef(false);
	const loadedReceiptNoRef = useRef('');
	const loadedDetailOpenKeyRef = useRef('');
	const hasLoadedCodesRef = useRef(false);
	
	// 결제관리 코드명 변환
	const payKdMap = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };

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
		}, 0);
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

		const procSt = (dsService.PROC_ST ?? '').trim();
		const judgeSt = (dsService.JUDGE_ST ?? '').trim();
		 
		// SC 사용자는 INPUT 상태에서 조회만 가능
		if (
		    procSt === 'INPUT' && dsUserInfo.MEMBER_GB === 'SU'
		) {
		    return false;
		}
		
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
		if (hasLoadedCodesRef.current) {
			return;
		}

		const loadCodes = async () => {
			const codeData = await gf.getCodes(['SGB', 'PR_ST', 'JG_ST', 'NEWGB', 'DELIV', 'TASK', 'BOND', 'NTTCD', 'NTTGR', 'NTACD', 'NTWHO', 'STAGB', 'DLVGB',
				'REGGB', 'NUMGB', 'CARM', 'FRTAX', 'GOVT', 'PAYME', 'PAYGB', 'INSUR', 'NUMST', 'IMPST',
				'PAYKD', 'PAYME', 'PAYOP', 'PAYST', 'PAYTP', 'BANK', 'FUEL', 'CARUS', 'NHOLE', 'NSEAL'
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
	

	// 공동소유비율 수정시
	useEffect(() => {
	    console.log('RATIO_NO 변경', dsNewCar.RATIO_NO);
		setShowOwnerPanel(
		    Number(dsNewCar?.RATIO_NO) < 100
		);
	}, [dsNewCar.RATIO_NO]);

	// 신청 버튼 클릭 시 (예상금액 모달창 오픈)
	const requestProcess = () => {
		// 신청 전 유효성 체크
		const msg = validateRequest();

		// 유효성 오류
		if (msg) {
			alert(msg);
			return;
		}

		// SA는 신청대기 상태만 신청 가능
		if (dsUserInfo.MEMBER_GB === 'SA' && dsService.PROC_ST !== 'W_REQ') {
		    alert('신청대기 상태만 신청 가능합니다.');
		    return;
		}

		// SA만 예상금액 모달 표시
		if (dsUserInfo.MEMBER_GB === 'SA') {
		    setIsEstimateModalOpen(true);
		    return;
		}
		
		// 그 외는 바로 신청 처리
	    confirmRequestProcess();
	};

	// SC가 요청 눌렀을 때 신청대기로 변경
	const requestWaitProcess = () => {

		// 필수 입력값 체크
		const validMsg = validateRequest();

		if (validMsg) {
			alert(validMsg);
			return;
		}

	    const newDataSet = {
	        dsService: {
	            ...dsService,
	            PROC_ST: 'W_REQ'
	        },
	        dsNewCar: { ...dsNewCar },
	        dsOwnerInfo,
	        dsOwnerInfo1,
	        dsCarNoDetach,
	        dsPaymentList: [...dsPaymentList]
	    };

	    setDsService(prev => ({
	        ...prev,
	        PROC_ST: 'W_REQ'
	    }));

	    processService(newDataSet, "REQ");
	};

	// 필수 입력값 강조 (SU)
	const setRequiredHighlight = () => {
		const memberGb = dsUserInfo?.MEMBER_GB;
		const procSt = dsService?.PROC_ST ?? '';

		if(!['SA', 'SU'].includes(memberGb) || !['SAV', 'C_REQ'].includes(procSt)) {
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
	const confirmRequestProcess = () => {
		
		const isSaUser = dsUserInfo.MEMBER_GB === 'SA';

		// 저장용 데이터셋
		const newDataSet = {
		    dsService: { ...dsService },
		    dsNewCar: { ...dsNewCar },
		    dsOwnerInfo,
			dsOwnerInfo1,
		    dsCarNoDetach,
		    dsPaymentList: [...dsPaymentList]
		};
		
		if(isSaUser) {
			setIsEstimateModalOpen(false);

			// 예상금액 계산
			const buyAmt = Number(gf.onlyNumber(String(dsNewCar.BUY_AMT || '0')));

			// 1. 취득세 (원 단위 절사 -> 10원 단위 정문화)
			const rawAcqTax = buyAmt * 0.07;
			const acqTax = Math.floor(rawAcqTax / 10) * 10;

			// 2. 채권 실부담금 (원 단위 절사 -> 10원 단위 정문화)
			const rawBond = buyAmt * 0.20 * 0.10;
			const bond = Math.floor(rawBond / 10) * 10;

			// 3. 채권 대행 수수료 (10원 미만 버림 처리)
			const rawBondFee = (buyAmt * 0.003) + 800;
			const bondFee = Math.floor(rawBondFee / 10) * 10;

			const fee = 27500;
			const stamp = 2500;
			const inji = 3000;
			const isCardPay = dsNewCar.CARD_YN === 'Y';
			const totalAmt = isCardPay
				? bond + fee + stamp + inji + bondFee
				: acqTax + bond + fee + stamp + inji + bondFee;

			// 신차 정보 데이터 업그레이드
			const updatedNewCar = {
				...dsNewCar,
				PREREG_AMT: totalAmt,
				TOTAL_AMT: totalAmt
			};

			// 결제정보 리스트 업데이트
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

			// React 화면 상태에 반영
			setDsNewCar(updatedNewCar);
			setDsPaymentList(updatedPaymentList);
			
			newDataSet.dsNewCar = updatedNewCar;
			newDataSet.dsPaymentList = updatedPaymentList;
			
			// 후납
			if (newDataSet.dsNewCar.PAY_GB === "A") {
			    newDataSet.dsService.PROC_ST = "REQ";
			}
			// 선납
			else {
			    newDataSet.dsService.PROC_ST = "P_REQ";
			}
		} 
		
		else if (dsUserInfo.MEMBER_GB === 'SU') {
			alert('신청 권한이 없습니다.');
			return;
		}
		else {
			newDataSet.dsService.PROC_ST = "REQ";
		    newDataSet.dsService.JUDGE_ST = "S_REQ";
		}
		
		setDsService(prev => ({
		    ...prev,
		    PROC_ST: newDataSet.dsService.PROC_ST,
		    JUDGE_ST: newDataSet.dsService.JUDGE_ST
		}));

		processService(newDataSet, "REQ");

		return;
	};

	// 필수 입력 정보 체크 
	const validateRequiredFields = () => {

		const emptyField = REQUIRED_FIELDS.find(
			field => !dsNewCar[field.name]
		);

		if (emptyField) {
			focusField(emptyField.name, emptyField.tab);
			return `${emptyField.label}을(를) 입력해주세요.`;
		}

		return '';
	}; 

	// TODO 일단 이건 나중에 더 추가한다.
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
			if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 && dsNewCar.RATIO_NO + dsOwnerInfo.DEBTOR_RATIO !== 100) {
				focusField('DEBTOR_RATIO', 'owner');
				return '대표소유자 + 공동소유자 비율을 확인해주세요 둘의 합은 100%이어야 합니다.';				
			}
			else {
				// 공동소유자2명인 경우 총합이 100이 안되는지 확인
				if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 
				 && dsOwnerInfo1.DEBTOR_RATIO > 0 && dsOwnerInfo1.DEBTOR_RATIO <= 100 
				 && dsNewCar.RATIO_NO + dsOwnerInfo.DEBTOR_RATIO + dsOwnerInfo1.DEBTOR_RATIO !== 100) {
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


	// 저장
	const saveProcess = (newDsNewCar = null) => {
	
		// 저장은 차대번호만 체크
		if (gf.Check(dsNewCar.CARID_NO, '차대번호', 17)) {
			alert('차대번호를 확인해주세요.');
			return;
		}

		// 저장 시 사용할 요청 데이터 생성
		// 비동기 데이터 처리시 원본 객체를 직접 참조하는 경우,
		// 저장 데이터가 의도치 않게 변경될 수 있음
		const newDataSet = {
		    dsService: { ...dsService },

		    // 전달받은 신규 차량 데이터 우선 사용
		    dsNewCar: newDsNewCar
		        ? { ...newDsNewCar }
		        : { ...dsNewCar },

		    dsOwnerInfo,
			dsOwnerInfo1,
		    dsCarNoDetach,
		    dsPaymentList: [...dsPaymentList]
		};

	    const { PROC_ST, JUDGE_ST } = dsService;
		const userGb = dsUserInfo.MEMBER_GB;
		log("userGb : " + userGb);

	    // 1. 일반 저장 상태 처리
		// 입력, 등록요청, 신청대기, 저장일 때 저장 가능 
	    if (["INPUT", "C_REQ", "W_REQ", "SAV"].includes(PROC_ST)) {
			
			// 최초 저장(INPUT) 또는 AD가 등록요청(C_REQ) 상태에서 저장할 때는 상태 유지, SU가 저장할 때는 저장으로 변경
			if (PROC_ST === "INPUT" || PROC_ST === "C_REQ" && userGb === "SU") {
				newDataSet.dsService.PROC_ST = "SAV";
				
			    setDsService(prev => ({
			        ...prev,
			        PROC_ST: "SAV"
			    }));
			}
	    }

		log("저장 요청 데이터:");
		log(newDataSet);
	    // 저장 실행
	    processService(newDataSet, "SAV");
	};
	
	const processService = async (newDataSet, proc) => {

		log('저장전 dsNewCar');
		log(dsNewCar);
		
	    try {

	        // 저장 요청
	        const res = await axios.post('/api/newcar/process', newDataSet);
	        log(res);
			
	        // 성공
	        if (res.data.success) {
				
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
				else {
					completeMsg = "저장되었습니다.";
				}

				alert(completeMsg);

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
	}, [dsUserInfo.MEMBER_GB, dsService.PROC_ST]);
	
	// 초기화
	const initProcess = async () => {
		hasInitializedRef.current = true;
		loadedReceiptNoRef.current = '';
		loadedDetailOpenKeyRef.current = '';

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
		setDsCompanyInfo({});
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
			    dsCarNoDetach = {},
				dsCompanyInfo = {},
				dsUserInfo = {}
			} = resData.data || {};
			
			setDsUserInfo(dsUserInfo); // 사용자 정보는 별도 세팅(변경X)

			// [setter, 초기값, DB값]
			const initDataList = {
			    dsService: [setDsService, initialDsService, dsService],
			    dsNewCar: [setDsNewCar, initialDsNewCar, dsNewCar],
			    dsOwnerInfo: [setDsOwnerInfo, initialOwnerInfo, dsOwnerInfo],
			    dsOwnerInfo1: [setDsOwnerInfo1, initialOwnerInfo1, dsOwnerInfo1],
			    dsCarNoDetach: [setDsCarNoDetach, initialDsCarNoDetach, dsCarNoDetach],
			    dsCompanyInfo: [setDsCompanyInfo, {}, dsCompanyInfo],
			    dsPaymentList: [setDsPaymentList, initialDsPaymentList, dsPaymentList],
			    dsBranchList: [setDsBranchList, initialDsBranchList, dsBranchList],
			    dsBaseList: [setDsBaseList, initialDsBaseList, dsBaseList]
			};

			// 응답 데이터가 있으면 DB값 우선 사용, 없거나 '', null, undefined 이면 초기값 사용
			Object.values(initDataList).forEach(([setter, initValue, dbValue]) => {

			    if (Array.isArray(initValue)) {
			        setter(dbValue?.length ? dbValue : initValue);
			        return;
			    }

			    const mergedData = { ...initValue };

			    Object.keys(dbValue || {}).forEach(key => {

			        const value = dbValue[key];

			        if (
			            value !== null &&
			            value !== undefined &&
			            value !== ''
			        ) {
			            mergedData[key] = value;
			        }
			    });

			    setter(mergedData);
			});
		}
		
	};
	
	
	// 닫기
	const closeFrame = () => {

		if (!window.confirm('작성 중인 내용은 저장되지 않습니다. 닫으시겠습니까?')) {
		    return;
		}

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
			    String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00' + 'þ' +
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
			dsNewCar.NTAX_TRGET_CD = '00'; // 업무구분 변경 시 비과세대상 초기화
			dsNewCar.NTAX_WHO = 'REPRE'; // 업무구분 변경 시 비과세대상자 '대표소유자'
			dsNewCar.BOND_DC = 'SELL' // 업무구분 변경 시 채권할인여부 '매도'
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
	    } else if (dataset.type === 'company') {
            setDsCompanyInfo(prev => ({ ...prev, [name]: value }));
        }
	};
	
	// 사용본거지 주소 체크해서 소유자 주소 갖고 오기
	const handleServiceIdCopy = async () => {
		const serviceId = (dsService.SERVICE_ID ?? '').trim();

		if (!serviceId) {
			return;
		}

		try {
			await navigator.clipboard.writeText(serviceId);
		} catch (err) {
			const textarea = document.createElement('textarea');
			textarea.value = serviceId;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
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
						}}
					>데이터셋조회</button>
					
					{/* 신청 버튼 */}
					<button className="btn-erp" disabled={isDisabled()}
					  onClick={dsUserInfo.MEMBER_GB === 'SU' ? requestWaitProcess : requestProcess}>
					    {dsUserInfo.MEMBER_GB === 'SU' ? '요청' : '신청'}
					</button>
					
					<button className="btn-erp" onClick={() => saveProcess()} disabled={isDisabled()}>저장</button>
					<button className="btn-erp" onClick={reloadProcess} >새로고침</button>
					<button className="btn-erp" onClick={deleteProcess} disabled={(dsService.PROC_ST ?? '').trim() === 'REQ'}>삭제</button>
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
						<input type="text" id="SERVICE_ID" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} data-type="service" value={dsService.SERVICE_ID} readOnly={isReadOnly(true)} onClick={handleServiceIdCopy} onChange={() => { }} />
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
					<ErpField label="업무 구분" span={3} htmlFor="TASK_CD">
						<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="* 차대번호" span={3} labelWidth="120px" htmlFor="CARID_NO">
						<input type="text" className="erp-input highlight-red" id="CARID_NO" name="CARID_NO" value={dsNewCar.CARID_NO} data-type="newcar" onChange={handleChange} readOnly={isReadOnly()} maxLength={17} />
					</ErpField>
					<ErpField label="등록예정일자" span={3} labelWidth="120px" htmlFor="REGIST_DATE">
						<input type="date" className="erp-input highlight-red" id="REGIST_DATE" name="REGIST_DATE" value={dsNewCar.REGIST_DATE} data-type="newcar" onChange={handleChange} readOnly={isReadOnly()} />
					</ErpField>
					<ErpField label="임시번호판 상태" span={3} labelWidth="120px" htmlFor="IMSINUM_YN">
						<CommonSelect groupId="IMPST" codes={codes} name="IMSINUM_YN" value={dsNewCar.IMSINUM_YN ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="사용연료" span={2} htmlFor="FUEL_CD">
						<CommonSelect groupId="FUEL" codes={codes} name="FUEL_CD" value={dsNewCar.FUEL_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
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
					<ErpField label="등록예정일자" span={2}>
						<span className="value-black">
							{/* {dsNewCar.MADE_DT} */}
							<input type="date" className="erp-input" id="MADE_DT" name="MADE_DT" data-type="newcar" value={dsNewCar.MADE_DT} onChange={handleChange} readOnly={isReadOnly()} />
						</span>
					</ErpField>
					<ErpField label="차종/용도구분" span={2}>
						<span className="value-black">{dsNewCar.CAR_KD}</span>
					</ErpField>
					<div className="field-group col-1" span={2}>
						<CommonSelect groupId="CARUS" codes={codes} name="CAR_US" value={dsNewCar.CAR_US ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
					</div>
					<ErpField label="차명" span={3}>
						<span className="value-black">{dsNewCar.CAR_NM}</span>
					</ErpField>
				</div>

				<div className="erp-row">
					<ErpField label="원동기형식" span={2}>
						<span className="value-black">{dsNewCar.FM_NM}</span>
					</ErpField>
					<ErpField label="형식승인번호" span={3} labelWidth="120px">
						<span className="value-black">{dsNewCar.SPMNNO}</span>
					</ErpField>
					<ErpField label="등록관청" span={2} htmlFor="GOVT_ID">
						<CommonSelect groupId="GOVT" codes={codes} name="GOVT_ID" value={dsService.GOVT_ID ?? ''} data-type="service" onChange={handleChange} disabled={isDisabled()} />
					</ErpField>
					<ErpField label="차령만료일" span={2}>
						<span className="value-black">{dsNewCar.LAST_DT ?? ''}</span>
					</ErpField>
					<ErpField label="취득가액" span={3}>
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

					{showOwnerPanel && (
						<div className="tab-header-extra">
							<label className="tab-checkbox-label">
								<input type="checkbox" checked={isMultiOwner} onChange={e => setIsMultiOwner(e.target.checked)} disabled={isDisabled()} /> 공동소유자 2명
							</label>
						</div>
					)}
				</div>
								
				<div className="tab-content">
					{activeTab === 'owner' && (
						<div className="owner-info-section">
							<div className="owner-split-layout">
							<ErpSection title="대표 소유자 정보" className="owner-panel owner-main-panel">
								<div className="erp-row">
									<ErpField label="신규등록 구분" span={6} htmlFor="PROC_CD">
										<CommonSelect groupId="NEWGB" codes={codes} name="PROC_CD" value={dsNewCar.PROC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>
									<ErpField label="업무구분" required={true} span={6} htmlFor="TASK_CD">
										<CommonSelect groupId="TASK" codes={codes} name="TASK_CD" value={dsNewCar.TASK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>
										
								</div>
								<div className="erp-row">
									<ErpField label="주문번호" span={6} htmlFor="LINK_ID">
									<input type="text" className="erp-input" id="LINK_ID" name="LINK_ID" data-type="service" value={dsService.LINK_ID ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="고객명" span={6} htmlFor="LINK_ID">
										<input type="text" className="erp-input" id="LINK_ID" name="LINK_ID" data-type="service" value={dsService.LINK_ID ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="등록번호" required={true} span={5} htmlFor="REG_NO">
										<CommonSelect groupId="REGGB" codes={codes} name="REG_GB" value={dsNewCar.REG_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className="erp-input" id="REG_NO" name="REG_NO" data-type="newcar" value={formatRegNo(dsNewCar.REG_NO ?? '')} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="성명(상호)" span={4} required={true} htmlFor="OWNER_NM">
										<input type="text" className="erp-input" id="OWNER_NM" name="OWNER_NM" data-type="newcar" value={dsNewCar.OWNER_NM} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="비율(%)" span={3} htmlFor="RATIO_NO">
										<input type="text" className="erp-input" id="RATIO_NO" name="RATIO_NO" data-type="newcar" value={dsNewCar.RATIO_NO} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="휴대폰번호" span={4} htmlFor="MPHONE_NO">
										<input type="text" className="erp-input" id="MPHONE_NO" name="MPHONE_NO" data-type="newcar" value={dsNewCar.MPHONE_NO} onChange={handleChange} readOnly={isReadOnly()} />
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
										<button className="btn-erp sm light mL-24" onClick={() => openAddressSearchModal('owner')} disabled={isDisabled()}>주소검색</button>
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="ADDRESS" name="ADDRESS" data-type="newcar" value={dsNewCar.ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
										<input type="text" className="erp-input text-left" id="ADDRESS_DT" style={{ width: '350px' }} name="ADDRESS_DT" data-type="newcar" value={dsNewCar.ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NM" name="RT_ACC_NM" data-type="newcar" value={dsNewCar.RT_ACC_NM} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>
								</div>
								<div className="erp-row">
									<ErpField label="사용 본거지" span={9} required={true} htmlFor="BASE_ADDRESS">
										<input type="checkbox" style={{ margin: '0 5px' }} disabled={isDisabled()} onClick={chekBaseAddr} />
										<button className="btn-erp sm light" onClick={() => openAddressSearchModal('baseOwner')} disabled={isDisabled()}>주소검색</button>
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="BASE_ADDRESS" name="BASE_ADDRESS" data-type="newcar" value={dsNewCar.BASE_ADDRESS} readOnly={isReadOnly(true)} onChange={handleChange} />
										<input type="text" className="erp-input text-left" style={{ width: '350px' }} id="BASE_ADDRESS_DT" name="BASE_ADDRESS_DT" data-type="newcar" value={dsNewCar.BASE_ADDRESS_DT} onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="RT_ACC_NO" name="RT_ACC_NO" data-type="newcar" value={dsNewCar.RT_ACC_NO} readOnly={isReadOnly(true)} onChange={handleChange} />
									</ErpField>
								</div>
							</ErpSection>

							{showOwnerPanel && (
								<ErpSection title="공동 소유자 정보" className="owner-panel owner-co-panel">
									{/* 공동1 */}
									<div className="erp-row">
										<ErpField label="성명(상호)" span={3}>
											<input className="erp-input" name="DEBTOR_NM" data-type="owner" value={dsOwnerInfo?.DEBTOR_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
										<ErpField label="전화번호" span={3}>
											<input className="erp-input" name="DEBTOR_TEL_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_TEL_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
										<ErpField label="등록번호" span={6}>
											<CommonSelect groupId="REGGB" codes={codes} name="DEBTOR_GB" value={dsOwnerInfo.DEBTOR_GB ?? ''} data-type="owner" onChange={handleChange} disabled={isDisabled()}/>
											<input className="erp-input" name="DEBTOR_REG_NO" data-type="owner" value={formatRegNo(dsOwnerInfo?.DEBTOR_REG_NO ?? '')} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
									</div>
									<div className="erp-row">
										<ErpField label="사업자번호" span={4}>
											<input className="erp-input" name="DEBTOR_BIZ_NO" data-type="owner" value={dsOwnerInfo?.DEBTOR_BIZ_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
										<ErpField label="만료일" span={5}>
											<input type="date" className="erp-input" name="EXPIRE_DT" data-type="owner" value={dsOwnerInfo?.EXPIRE_DT ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
										<ErpField label="공동소유 비율(%)" span={3}>
											<input className="erp-input" name="DEBTOR_RATIO" data-type="owner" value={dsOwnerInfo?.DEBTOR_RATIO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										</ErpField>
									</div>
									<div className="erp-row">
										<ErpField label="공동소유자 주소" span={12}>
											<button className="btn-erp sm light" style={{ marginLeft: '2px' }} onClick={() => openAddressSearchModal('debtor')} disabled={isDisabled()}>주소검색</button>
											<input className={`erp-input ${!canEdit() ? 'disabled' : ''}`} name="DEBTOR_ADDR" value={dsOwnerInfo?.DEBTOR_ADDR ?? ''} readOnly={isReadOnly(true)} onChange={handleChange} />
											<input className="erp-input" name="DEBTOR_ADDR_DT" value={dsOwnerInfo?.DEBTOR_ADDR_DT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
										</ErpField>
									</div>
	
									{/* 공동2 */}
									{isMultiOwner && (
										<>
											<ErpSection title="공동 소유자 2 정보" className="owner-panel owner-co-panel">
											<div className="erp-row">
												<ErpField label="성명(상호)(2)" span={4}>
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
							)}
							</div>
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
										<input type="text" name="INSTALL_NM" id="INSTALL_NM" data-type="detach" placeholder="배송자명" className="erp-input" value={dsCarNoDetach.INSTALL_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
										<input type="text" name="INSTALL_TEL_NO" id="INSTALL_TEL_NO" data-type="detach" placeholder="배송자 전화번호" className="erp-input" value={dsCarNoDetach.INSTALL_TEL_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
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
									<ErpField label="비과세대상" span={4} required={true} >
										<CommonSelect groupId="NTTCD" codes={codes} name="NTAX_TRGET_CD" value={dsNewCar.NTAX_TRGET_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<CommonSelect groupId="NTWHO" codes={codes} name="NTAX_WHO" value={dsNewCar.NTAX_WHO ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="비과세대상등급" span={4}>
										<CommonSelect groupId="NTTGR" codes={codes} name="NTAX_TRGET_GR_CD" value={dsNewCar.NTAX_TRGET_GR_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="취득세 카드납부" span={4}>
												<label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', marginLeft: '10px', fontSize: '13px', cursor: 'pointer' }}>
												<input
													type="checkbox"
													name="CARD_YN"
													checked={dsNewCar.CARD_YN === 'Y'}
													onChange={e => {
														const checked = e.target.checked;
														const cardYn = checked ? 'Y' : 'N';
														setDsNewCar(prev => {
															const next = { ...prev, CARD_YN: cardYn };
															const total = dsPaymentList.reduce((sum, v) => {
																if (cardYn === 'Y' && v.PAY_KD === 'ACQ') {
																	return sum;
																}
																return sum + Number(v.PAY_AMT || 0);
															}, 0);
															next.TOTAL_AMT = total;
															return next;
														});
													}}
													disabled={isDisabled()}
												/>
												카드납부
											</label>
										{/* <CommonSelect groupId="NTACD" codes={codes} name="NTAX_APPLC_CD" value={dsNewCar.NTAX_APPLC_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled(true)} /> */}
										{/* 파일럿 이후에 추가 */}
										<input type="text" className="erp-input" name="" data-type="newcar" value='' onChange={handleChange} readOnly={isReadOnly(true)} />
										<input type="text" className="erp-input" name="" data-type="newcar" value='' onChange={handleChange} readOnly={isReadOnly(true)} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="채권할인여부" span={3} required={true} >
										<CommonSelect groupId="BOND" codes={codes} name="BOND_DC" value={dsNewCar.BOND_DC ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
									</ErpField>

									<ErpField label="인지세" span={4}>
										<CommonSelect groupId="STAMP" codes={codes} name="STAMP_GB" value={dsNewCar.STAMP_GB ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className="erp-input" name="INJI_NO" data-type="newcar" value={dsNewCar.INJI_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="등록비용사전조회" span={5}>
										<div className="flex-row">
											<input type="text" className={`erp-input text-right ${!canEdit() ? 'disabled' : ''}`} value={Number(dsNewCar.PREREG_AMT || 0).toLocaleString()} readOnly={isReadOnly(true)} onChange={() => { }} />
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

									<ErpField label="채권납부계좌" span={3}>
										<CommonSelect groupId="BANK" codes={codes} name="BOND_BANK_CD" value={dsNewCar.BOND_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} value={dsNewCar.BOND_BANK_NO ?? ''} readOnly={isReadOnly(true)} onChange={() => { }} />
									</ErpField>
								</div>

								<div className="erp-row">
									<ErpField label="환급계좌" span={5} required={true} >
										<CommonSelect groupId="BANK" codes={codes} name="RT_BANK_CD" value={dsNewCar.RT_BANK_CD ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<input type="text" className="erp-input" name="RETURN_NO" data-type="newcar" value={dsNewCar.RETURN_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="환급계좌 예금주" span={4} required={true} >
										<input type="text" className="erp-input" name="RETURN_NM" data-type="newcar" value={dsNewCar.RETURN_NM ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>

									<ErpField label="환급금액" span={3}>
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
										<input type="text" className="erp-input" id="PAY_HP_NO" name="PAY_HP_NO" data-type="newcar" value={dsNewCar.PAY_HP_NO ?? ''} onChange={handleChange} readOnly={isReadOnly()} />
									</ErpField>
									<ErpField label="납부상태" span={4}>
										<CommonSelect groupId="PAYST" codes={codes} name="PAY_ST" value={dsNewCar.PAY_ST ?? ''} data-type="newcar" onChange={handleChange} disabled={isDisabled()} />
										<button className="btn-erp sm light" style={{ margin: '0 2px' }} disabled={isDisabled()}>채권 인쇄</button>
										<button className="btn-erp sm light" style={{ marginRight: '2px' }} disabled={isDisabled()} onClick={() => setIsReceiptModalOpen(true)}>납부영수증</button>
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
										<input type="text" className={`erp-input ${!canEdit() ? 'disabled' : ''}`} id="TOTAL_AMT" name="TOTAL_AMT" data-type="newcar" value={dsNewCar.TOTAL_AMT ?? ''} onChange={handleChange} readOnly={isReadOnly(true)} />
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

			{/* 예상금액 확인 모달창 */}
			{isEstimateModalOpen && (() => {
				const buyAmt = Number(gf.onlyNumber(String(dsNewCar.BUY_AMT || '0')));
				// 1. 취득세 (원 단위 절사 -> 10원 단위 정문화)
				// 기존: Math.floor(buyAmt * 0.07);
				const rawAcqTax = buyAmt * 0.07;
				const acqTax = Math.floor(rawAcqTax / 10) * 10;

				// 2. 채권 실부담금 (원 단위 절사 -> 10원 단위 정문화)
				// 기존: Math.floor(buyAmt * 0.20 * 0.10);
				const rawBond = buyAmt * 0.20 * 0.10;
				const bond = Math.floor(rawBond / 10) * 10;

				// 3. 채권 대행 수수료 (10원 미만 버림 처리)
				// 기존: Math.floor(buyAmt * 0.003) + 800;
				const rawBondFee = (buyAmt * 0.003) + 800;
				const bondFee = Math.floor(rawBondFee / 10) * 10;
				const fee = 27500;
				const stamp = 2500;
				const inji = 3000;
				const isCardPay = dsNewCar.CARD_YN === 'Y';
				const totalAmt = isCardPay
					? bond + fee + stamp + inji + bondFee
					: acqTax + bond + fee + stamp + inji + bondFee;

				return (
					<div className="estimate-modal-overlay">
						<div className="estimate-modal-container">
							{/* Header */}
							<div className="estimate-modal-header">
								<h3>예상금액 확인</h3>
								<button
									type="button"
									className="estimate-modal-close-btn"
									onClick={() => setIsEstimateModalOpen(false)}
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

								<div className="estimate-notice">
									예상금액 {totalAmt.toLocaleString()}원으로 계산되었습니다. 가상계좌를 생성하시려면 신청 버튼을 눌러주세요.<br />
									고객님께서 입금 후 자동으로 관청에 신청 됩니다.
								</div>
							</div>

							{/* Footer */}
							<div className="estimate-modal-footer">
								<button
									type="button"
									className="btn-erp"
									onClick={confirmRequestProcess}
								>
									신청
								</button>
								<button
									type="button"
									className="btn-erp light"
									onClick={() => setIsEstimateModalOpen(false)}
								>
									닫기
								</button>
							</div>
						</div>
					</div>
				);
			})()}
			
			{/* 채권 인쇄 */}
			
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
