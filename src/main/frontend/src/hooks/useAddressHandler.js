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
    setDsNewCar,
    setDsOwnerInfo
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

	    const ownerBase = dsBaseList.find(item =>
	        String(item.BASE_ID) === String(baseId)
	    );

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

	    setDsNewCar(prev => {

	        const next = {
	            ...prev,
	            BASE_BRANCH_ID: ownerBase.BASE_ID
	        };

	        // 소유자 주소 = 본점
	        next.ADDRESS = ownerBase.ADDRESS;
	        next.ADDRESS_DT = ownerBase.ADDRESS_DT;
	        next.POST_NO = ownerBase.POST_NO;
	        next.BUBJUNG_CD = ownerBase.BUBJUNG_CD;
	        next.RT_ACC_NM = ownerBase.ROAD_CD;

	        // 사용본거지 = 창원 우선
	        setBaseAddress(next, useBase, isCorp(next.REG_GB));

	        return next;
	    });
	};

	return {
	    handleAddressSelect,
	    handleSameAddress,
	    handleLeaseCompany
	};
};

export default useAddressHandler;