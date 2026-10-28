export const registrationMailGuide = (companyId, carpMailYn) => {
	if (companyId !== 'WA001') return '등록증 및 영수증이 발송됩니다.';
	return carpMailYn === 'Y'
		? '등록증 및 영수증 / 차량대금 계산서가 발송됩니다.'
		: '차량대금 계산서가 발송됩니다.';
};

export const isPolestarWooriLease = (companyId, newCar, dsBaseList) => {
    if (companyId !== 'WA001' || newCar.TASK_CD !== 'LEASE' || newCar.PROC_CD !== 'I') return false;
    const base = dsBaseList.find(item => String(item.BASE_ID) === String(newCar.BASE_BRANCH_ID));
    return base?.COMPANY_ID === 'WA001' && String(base.BASE_NM || '')
        .replace(/주식회사/g, '').replace(/\(.*?\)/g, '').trim() === '우리금융캐피탈';
};

// 리스·이용자명의 리스만 두 주소를 표시하며, 다른 등록구분은 첫 주소만 사용한다.
export const registrationMailAddresses = (newCar) => {
    const addresses = String(newCar.CARP_MAIL ?? '').split(',').map(address => address.trim());
    return newCar.TASK_CD === 'LEASE' && ['I', 'C'].includes(newCar.PROC_CD)
        ? addresses : addresses.slice(0, 1);
};

export const registrationMailByteLength = (value) => new Blob([String(value ?? '')]).size;

// CARP_MAIL은 VARCHAR2(100 Byte)이므로 두 주소 사이의 쉼표도 저장 길이에 포함한다.
export const registrationMailLengthError = (value) => registrationMailByteLength(value) > 100
    ? '등록증 이메일 주소는 쉼표를 포함하여 총 100Byte 이내로 입력해주세요.' : '';

// 도메인 미선택 등 미완성 주소가 다음 단계나 저장으로 넘어가지 않도록 검사한다.
export const registrationMailInputError = (newCar) => {
    const addresses = registrationMailAddresses(newCar);
    for (let index = 0; index < addresses.length; index += 1) {
        const address = addresses[index];
        if (!address) continue;
        const label = index === 0 ? '등록증 이메일 주소' : '등록증 이메일 주소(리스사)';
        if (address.length > 49) return `${label}는 49자 이내로 입력해주세요.`;
        if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(address)) {
            return `${label}의 아이디와 도메인을 확인해주세요.`;
        }
    }
    return registrationMailLengthError(newCar.CARP_MAIL);
};

export const registrationPaperUrl = (judgeDate, carNo) => {
	const date = String(judgeDate || '').replace(/[^0-9]/g, '').slice(2);
	return `/api/newcar/carpaper/download?date=${date}&carNo=${encodeURIComponent(carNo || '')}`;
};
