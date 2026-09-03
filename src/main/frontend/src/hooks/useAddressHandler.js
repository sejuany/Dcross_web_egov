import { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { gf } from '../utils/utils';

/* =========================================================
 * Hook > 신규등록 주소 처리
 *
 * - 주소검색 결과 적용
 * - 동일주소 처리
 * - 리스사 선택 시 사용본거지 자동 설정
 * ========================================================= */

// 법인 여부
const isCorp = regGb =>
    regGb === 'B' ||
    regGb === 'C';

const useAddressHandler = ({
    dsNewCar,
    dsBaseList,
	dsOwnerInfo,
    setDsNewCar,
    setDsOwnerInfo,
    setDsCarNoDetach
}) => {

			
	// 사용본거지 주소 저장
	const setBaseAddress = (next, addr, corp) => {
	    next.BASE_ADDRESS = addr.ADDRESS ?? addr.ADDR;
	    next.BASE_ADDRESS_DT = addr.ADDRESS_DT ?? addr.ADDR_DT ?? '';
	    next.BASE_POST_NO = addr.POST_NO;
	    next.BASE_BUBJUNG_CD = addr.BUBJUNG_CD;
	    next.RT_ACC_NO = addr.ROAD_CD;

	    if (!corp) {
	        return;
	    }

	    next.ADDR_INFO2 =
	        (addr.ROAD_CD ?? '') + 'þ' +
	        String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
	        (addr.HJD_CD ?? '') + 'þ' +
	        (addr.JIHA_YN ?? '0') + 'þ' +
	        (addr.BUILDB_NO ?? '0') + 'þ' +
	        (addr.BUILDS_NO ?? '0') + 'þ' +
	        (addr.ADDRESS_DT ?? addr.ADDR_DT ?? '') + 'þ';
	};

	// 주소 선택 처리
	const handleAddressSelect = (type, addr) => {
		
		// 법인이거나 사업자인 경우 
	    const corp = isCorp(dsNewCar.REG_GB);
		// 일반등록인 경우
		const isNORML = dsNewCar.TASK_CD === 'NORML' ? true : false;

	    // 공동명의 주소
	    if (type === 'DEBTOR_ADDR') {
	        setDsOwnerInfo(prev => ({
	            ...prev,
	            DEBTOR_ADDR: addr.ADDR,
	            DEBTOR_POST_NO: addr.POST_NO,
	            DEBTOR_BUBJUNG_CD: addr.BUBJUNG_CD,
	            DEBTOR_ROAD_CD: addr.ROAD_CD
	        }));

	        return;
	    }
		// 번호판 배송지
		else if (type === 'DELIVERY_ADDR') {

		    setDsCarNoDetach(prev => ({
		        ...prev,
		        DELIVERY_ADDR: addr.ADDR,
		        DELIVERY_ADDR_DT: addr.ADDRESS_DT ?? addr.ADDR_DT ?? '',
		        DELIVERY_POST_NO: addr.POST_NO
		    }));

		    return;
		}
		// 등록증 배송지
		else if (type === 'CARP_ADDRESS') {

		    setDsNewCar(prev => ({
				...prev,
		        CARP_ADDRESS: addr.ADDR,
		        //CARP_ADDRESS_DT:  addr.ADDRESS_DT ?? addr.ADDR_DT ?? '',
		        CARP_POST_NO: addr.POST_NO
		    }));

		    return;
		}

		const addrInfo = corp ? (addr.ROAD_CD ?? '') + 'þ' +
	          String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
	          (addr.HJD_CD ?? '') + 'þ' +
	          (addr.JIHA_YN ?? '0') + 'þ' +
	          (addr.BUILDB_NO ?? '0') + 'þ' +
	          (addr.BUILDS_NO ?? '0') + 'þþ' : '';	
		
		addr.ADDR_INFO = addrInfo;
			
		console.log("addrInfo >>"+addrInfo);

	    setDsNewCar(prev => {

	        const next = { ...prev };

	        switch (type) {

	            case 'ADDRESS':
	                next.ADDRESS = addr.ADDR;
	                next.POST_NO = addr.POST_NO;
	                next.BUBJUNG_CD = addr.BUBJUNG_CD;
	                next.RT_ACC_NM = addr.ROAD_CD;
	                next.ADDR_INFO = addrInfo;

	                if (!corp) {
	                    setBaseAddress(next, addr, false);
	                }
	                break;

	            case 'BASE_ADDRESS':
	                setBaseAddress(next, addr, corp);
	                break;

	            default:
	                break;
	        }

	        return next;
	    });
	};

	// 동일주소 체크
	const handleSameAddress = e => {

	    const checked = e.target.checked;
	    const corp = isCorp(dsNewCar.REG_GB);

	    setDsNewCar(prev => {

	        const next = { ...prev };

	        if (checked) {

	            setBaseAddress(next, {
	                ADDRESS: prev.ADDRESS,
	                ADDRESS_DT: prev.ADDRESS_DT,
	                POST_NO: prev.POST_NO,
	                BUBJUNG_CD: prev.BUBJUNG_CD,
	                ROAD_CD: prev.RT_ACC_NM,
	                HJD_CD: prev.HJD_CD,
	                JIHA_YN: prev.JIHA_YN,
	                BUILDB_NO: prev.BUILDB_NO,
	                BUILDS_NO: prev.BUILDS_NO
	            }, corp);

	        } else {

	            next.BASE_ADDRESS = '';
	            next.BASE_ADDRESS_DT = '';
	            next.BASE_POST_NO = '';
	            next.BASE_BUBJUNG_CD = '';
	            next.RT_ACC_NO = '';
	            next.ADDR_INFO2 = '';
	        }

	        return next;
	    });
	};

			
	// 리스사 선택 처리
	const handleLeaseCompany = baseId => {

	    const ownerBase = dsBaseList.find(item =>
	        String(item.BASE_ID) === String(baseId)
	    );

		
	    if (!ownerBase) {
	        return;
	    }

	    const company = ownerBase.BASE_NM
					.replace(/주식회사/g, '')
			        .replace(/\(.*?\)/g, '')
			        .trim();

	    const baseList = dsBaseList.filter(item =>
	        item.BASE_NM.includes(company)
	    );

		// 사용본거지
		// 1순위 : 본점을 제외한 다른 지역
		// 2순위 : 본점
		const headOffice = baseList.find(item => item.BASE_NM.includes('(본점)'));

		const otherBranch = baseList.find(item =>
		    !item.BASE_NM.includes('(본점)')
		);

		const useBase = otherBranch || headOffice || ownerBase;

	    // 공통으로 변경되는 신규등록 정보
	    const nextNewCar = {
	        ...dsNewCar,
	        BASE_BRANCH_ID: ownerBase.BASE_ID
	    };

	    // 이용자명의 리스(공동소유자)
	    if (dsNewCar.PROC_CD === 'C') {

	        setDsNewCar(nextNewCar);

	        // 직접입력
	        if (company === '직접입력') {

	            const nextOwnerInfo = {
	                ...dsOwnerInfo,
	                DEBTOR_GB: 'B',
	                DEBTOR_REG_NO: '',
	                DEBTOR_BIZ_NO: '',
	                DEBTOR_ADDR: '',
	                DEBTOR_ADDR_DT: '',
	                DEBTOR_ROAD_CD: ''
	            };

	            setDsOwnerInfo(nextOwnerInfo);

	            return {
	                dsNewCar: nextNewCar,
	                dsOwnerInfo: nextOwnerInfo
	            };
	        }

	        const nextOwnerInfo = {
	            ...dsOwnerInfo,
	            DEBTOR_NM: company,
	            DEBTOR_GB: 'B',
	            DEBTOR_REG_NO: ownerBase.ROAD_NM,
	            DEBTOR_BIZ_NO: ownerBase.BIZ_NO,
	            DEBTOR_ADDR: ownerBase.ADDRESS,
	            DEBTOR_ADDR_DT: ownerBase.ADDRESS_DT,
	            DEBTOR_ROAD_CD: ownerBase.POST_NO
	        };

	        setDsOwnerInfo(nextOwnerInfo);

	        return {
	            dsNewCar: nextNewCar,
	            dsOwnerInfo: nextOwnerInfo
	        };
	    }

	    // 일반 리스
	    if (dsNewCar.PROC_CD === 'I') {

	        const addrInfo = useBase.ADDR_INFO ?? '';

	        // 직접입력
	        if (company === '직접입력') {
	            Object.assign(nextNewCar, {
	                REG_GB: 'B',
	                REG_NO: '',
	                BIZ_NO: '',
	                ADDRESS: '',
	                ADDRESS_DT: '',
	                POST_NO: '',
	                BUBJUNG_CD: '',
	                RT_ACC_NM: '',
	                ADDR_INFO: '',
	                BASE_ADDRESS: '',
	                BASE_ADDRESS_DT: '',
	                BASE_POST_NO: '',
	                BASE_BUBJUNG_CD: '',
	                RT_ACC_NO: '',
	                ADDR_INFO2: ''
	            });

	            setDsNewCar(nextNewCar);

	            return {
	                dsNewCar: nextNewCar
	            };
	        }

			console.log(nextNewCar);
	        nextNewCar.OWNER_NM = company;
	        nextNewCar.BIZ_NO = ownerBase.BIZ_NO ?? '';
	        nextNewCar.REG_GB = 'B';
	        nextNewCar.REG_NO = ownerBase.ROAD_NM;

	        nextNewCar.ADDRESS = ownerBase.ADDRESS;
	        nextNewCar.ADDRESS_DT = ownerBase.ADDRESS_DT;
	        nextNewCar.POST_NO = ownerBase.POST_NO;
			nextNewCar.RT_ACC_NM = ownerBase.ROAD_CD;
			nextNewCar.BUBJUNG_CD = ownerBase.BUBJUNG_CD;

			console.log(useBase);
	        nextNewCar.BASE_ADDRESS = useBase.ADDRESS;
	        nextNewCar.BASE_ADDRESS_DT = useBase.ADDRESS_DT;
	        nextNewCar.BASE_POST_NO = useBase.POST_NO;
			nextNewCar.RT_ACC_NO = useBase.ROAD_CD;
	        nextNewCar.ADDR_INFO2 = addrInfo;

	        setDsNewCar(nextNewCar);

	        return {
	            dsNewCar: nextNewCar
	        };
	    }
	};

	
	// 주소 초기화
	// 등본상 주소지에서 x 버튼 누르면, 화면에 안 보이는 소유자주소+사용본거지 주소 한 번에 지워지도록 함
	const handleClearAddress = type => {
		console.log("type : " + type);
	    const corp = isCorp(dsNewCar.REG_GB);

	    if (type === 'DEBTOR_ADDR') {
	        setDsOwnerInfo(prev => ({
	            ...prev,
	            DEBTOR_ADDR: '',
	            DEBTOR_ADDR_DT: '',
	            DEBTOR_POST_NO: '',
	            DEBTOR_BUBJUNG_CD: '',
	            DEBTOR_ROAD_CD: ''
	        }));
	        return;
	    }

	    // 번호판 배송지
	    if (type === 'DELIVERY_ADDR') {
	        setDsCarNoDetach(prev => ({
	            ...prev,
	            DELIVERY_ADDR: '',
	            //DELIVERY_ADDR_DT: '',
	            DELIVERY_POST_NO: '',
	            RECEIVE_NM: '',
	            RECEIVE_TEL_NO: ''
	        }));
	        return;
	    }
		
		// 등록증 배송지
	    if (type === 'CARP_ADDRESS') {
	        setDsNewCar(prev => ({
	            ...prev,
	            CARP_ADDRESS: '',
	            CARP_ADDRESS_DT: '',
	            CARP_POST_NO: ''
	        }));
	        return;
	    }


	    setDsNewCar(prev => {

	        const next = { ...prev };

			switch (type) {

	            case 'ADDRESS':

	                next.ADDRESS = '';
	                //next.ADDRESS_DT = '';
	                next.POST_NO = '';
	                next.BUBJUNG_CD = '';
	                next.RT_ACC_NM = '';
	                next.ADDR_INFO = '';

	                // 개인은 사용본거지도 같이 삭제
	                if (!isCorp) {
	                    next.BASE_ADDRESS = '';
	                    //next.BASE_ADDRESS_DT = '';
	                    next.BASE_POST_NO = '';
	                    next.BASE_BUBJUNG_CD = '';
	                    next.RT_ACC_NO = '';
	                    next.ADDR_INFO2 = '';
	                }
	                break;

	            case 'BASE_ADDRESS':

	                next.BASE_ADDRESS = '';
	                //next.BASE_ADDRESS_DT = '';
	                next.BASE_POST_NO = '';
	                next.BASE_BUBJUNG_CD = '';
	                next.RT_ACC_NO = '';
	                next.ADDR_INFO2 = '';
	                break;
	            default:
	                break;
	        }

	        return next;
	    });
	};

	return {
		handleAddressSelect,
		handleSameAddress,
		handleLeaseCompany,
		handleClearAddress
	};
};

export default useAddressHandler;
