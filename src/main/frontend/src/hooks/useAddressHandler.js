import { useEffect, useState, useMemo, useCallback } from 'react';

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

	    const corp = isCorp(dsNewCar.REG_GB);

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

	    const addrInfo = corp
	        ? (addr.ROAD_CD ?? '') + 'þ' +
	          String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00þ' +
	          (addr.HJD_CD ?? '') + 'þ' +
	          (addr.JIHA_YN ?? '0') + 'þ' +
	          (addr.BUILDB_NO ?? '0') + 'þ' +
	          (addr.BUILDS_NO ?? '0') + 'þþ'
	        : '';

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

		const ownerBase = dsBaseList.find(item => {
		    return String(item.BASE_ID) === String(baseId);
		});

		
	    if (!ownerBase) {
	        return;
	    }

	    const company = ownerBase.BASE_NM.replace(/\(.*\)$/, '').trim();

	    const baseList = dsBaseList.filter(item =>
	        item.BASE_NM.includes(company)
	    );

	    const useBase =
	        baseList.find(item => item.BASE_NM.includes('(창원)')) ||
	        ownerBase;
			
		// 리스사 선택
		setDsNewCar(prev => ({
		    ...prev,
		    BASE_BRANCH_ID: ownerBase.BASE_ID
		}));

		// 이용자명의 리스(공동소유자) 주소 설정
		setDsOwnerInfo(prev => {
		    const next = {
		    ...prev,
			DEBTOR_NM: ownerBase.BASE_NM.replace(/\(.*\)$/, '').trim(),
			DEBTOR_GB: "B",
			DEBTOR_REG_NO: ownerBase.ROAD_NM,
			DEBTOR_BIZ_NO: ownerBase.BIZ_NO,
		    DEBTOR_ADDR: ownerBase.ADDRESS,
		    DEBTOR_ADDR_DT: ownerBase.ADDRESS_DT,
		    DEBTOR_ROAD_CD: ownerBase.POST_NO
			};
			
			console.log(next);   // 여기서는 B가 찍힐 것
			return next;
		});
	};
	
	// 주소 초기화
	// 등본상 주소지에서 x 버튼 누르면, 화면에 안 보이는 소유자주소+사용본거지 주소 한 번에 지워지도록 함
	const handleClearAddress = type => {
		console.log("type : " + type);
	    const corp = isCorp(dsNewCar.REG_GB);

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