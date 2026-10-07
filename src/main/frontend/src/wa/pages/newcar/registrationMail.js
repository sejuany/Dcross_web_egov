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

export const registrationPaperUrl = (judgeDate, carNo) => {
	const date = String(judgeDate || '').replace(/[^0-9]/g, '').slice(2);
	return `/api/newcar/carpaper/download?date=${date}&carNo=${encodeURIComponent(carNo || '')}`;
};
