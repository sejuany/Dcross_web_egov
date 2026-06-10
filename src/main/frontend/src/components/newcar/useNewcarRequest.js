import { useState } from 'react';

// TODO 나중에 옮김
// 지금은 NewcarRequest에 두고 사용한다

import {
    initialDsService,
    initialDsNewCar,
    initialOwnerInfo,
    initialOwnerInfo1,
    initialDsBranchList,
    initialDsBaseList,
    initialDsCarNoDetach
} from './newcarInitial';

export const useNewcarRequest = () => {
	
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
	
	

	return {
	    activeTab,
	    setActiveTab,
	    isNumplateModalOpen,
	    setIsNumplateModalOpen,
	    isAddressModalOpen,
	    setIsAddressModalOpen,
	    isEstimateModalOpen,
	    setIsEstimateModalOpen,
	    addressTarget,
	    setAddressTarget,
	    isMultiOwner,
	    setIsMultiOwner,
	    dsUserInfo,
	    setDsUserInfo,
	    codes,
	    setCodes,
	    dsPaymentList,
	    setDsPaymentList,
	    dsService,
	    setDsService,
	    dsNewCar,
	    setDsNewCar,
	    dsOwnerInfo,
	    setDsOwnerInfo,
	    dsOwnerInfo1,
	    setDsOwnerInfo1,
	    dsCarNoDetach,
	    setDsCarNoDetach,
	    dsBranchList,
	    setDsBranchList,
	    dsBaseList,
	    setDsBaseList,
	    dsCompanyInfo,
	    setDsCompanyInfo,
	    dsWorkCp,
	    setDsWorkCp,
		isReceiptModalOpen,
	    setIsReceiptModalOpen
	};
};