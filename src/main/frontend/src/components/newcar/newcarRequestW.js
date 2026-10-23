import { initialDsService, initialDsNewCar, initialOwnerInfo, initialOwnerInfo1, initialDsCarNoDetach } from './newcarInitial';
import axios from 'axios';
import { buildCarSpecPatch, resolveBondSearchCriteria } from '../../wa/pages/newcar/newcarCarSpec';
import { AUTO_APPLY_EXEMPTION_TARGET_CODES, EXEMPTION_GRADE_CODES_BY_TARGET, calculateNewcarEstimate, resolveBondPreExemption } from '../../wa/pages/newcar/newcarAmountCalculator';

export const emptyTaxReceipt = {
    GUBUN: '', ETC1: 'N', REG_NO: '', NAME: '', COMPANY_NM: '', PHONE_NO: '',
    ADDR: '', ADDR_DT: '', POST_NO: '', BUSINESS_TYPE: '', INDUSTRY_TYPE: '', MAIL1: '', MAIL2: ''
};
export const gradeTargets = Object.keys(EXEMPTION_GRADE_CODES_BY_TARGET).filter(code => !AUTO_APPLY_EXEMPTION_TARGET_CODES.has(code));
export const exemptionWGrade = (target, current) => {
    if (AUTO_APPLY_EXEMPTION_TARGET_CODES.has(target)) return 'D';
    if (!target || target === '00') return '0';
    return (EXEMPTION_GRADE_CODES_BY_TARGET[target] || []).includes(current) ? current : '';
};
export const estimateWInputs = car => Object.fromEntries([
    'TASK_CD', 'CARID_NO', 'CAR_NM', 'BASE_ADDRESS', 'BUY_AMT', 'NTAX_TRGET_CD', 'NTAX_TRGET_GR_CD',
    'NTAX_WHO', 'BOND_DC', 'CARD_YN', 'NUMPLATE_GB'
].map(name => [name, String(car[name] ?? '').trim()]));

export const loadWCarSpec = async car => {
    if (!car.CAR_NM?.trim()) throw new Error('차량명을 확인해 주세요.');
    const response = await axios.get('/api/newcar/car-spec', { params: { carName: car.CAR_NM } });
    const spec = response.data?.data;
    if (!response.data?.success || !spec) throw new Error(response.data?.message || '차량제원을 찾을 수 없습니다.');
    return { ...buildCarSpecPatch(car, spec), MADE_DT: car.MADE_DT || spec.MADE_DT || '',
        VH_TY_CD: String(spec.MULTI_PURPOSE_YN).toUpperCase() === 'Y' ? '3' : '',
        COLOR_GB: spec.COLOR_GB ?? car.COLOR_GB, SPMNNO: spec.SPMNNO ?? car.SPMNNO,
        LOW_POLLUTION_YN: spec.LOW_POLLUTION_YN ?? car.LOW_POLLUTION_YN };
};

export const calculateWEstimate = async (data, codes) => {
    const car = data.dsNewCar;
    if (!car.BASE_ADDRESS?.trim()) throw new Error('사용본거지 주소를 입력해 주세요.');
    if (!(Number(car.BUY_AMT) > 0)) throw new Error('공급가액을 입력해 주세요.');
    if (!car.BOND_DC) throw new Error('채권할인여부를 선택해 주세요.');
    if (!car.NTAX_TRGET_CD || (gradeTargets.includes(car.NTAX_TRGET_CD) && !car.NTAX_TRGET_GR_CD)
        || (gradeTargets.includes(car.NTAX_TRGET_CD) && car.NTAX_TRGET_GR_CD === '0')) throw new Error('비과세대상과 등급을 선택해 주세요.');
    const [spec, taxResponse] = await Promise.all([loadWCarSpec(car), axios.get('/api/newcar/tax-info')]);
    if (!taxResponse.data?.success || !taxResponse.data?.data) throw new Error('신규등록 세율정보를 찾을 수 없습니다.');
    const newCar = { ...car, ...spec, TM_TAX_INFO: taxResponse.data.data };
    const criteria = resolveBondSearchCriteria(newCar);
    const exemption = resolveBondPreExemption(newCar, codes);
    const bond = exemption.exempt ? { BOND_RATE: 0, AREA: criteria.area, BOND_GB: 'N', FULL_EXEMPT_YN: 'Y' }
        : (await axios.get('/api/newcar/bond-rate', { params: { baseAddress: criteria.area, carGb: criteria.carGb, baseValue: criteria.baseValue } })).data?.data;
    if (bond?.BOND_RATE === undefined || bond?.BOND_RATE === null) throw new Error('공채 매입률을 찾을 수 없습니다.');
    Object.assign(newCar, { BOND_RATE: bond.BOND_RATE, BOND_AREA: bond.AREA, BOND_GB: bond.BOND_GB,
        BOND_FULL_EXEMPT_YN: bond.FULL_EXEMPT_YN || 'N', BOND_SEARCH_CAR_GB: criteria.carGb, BOND_SEARCH_BASE_VALUE: criteria.baseValue });
    const result = calculateNewcarEstimate({ dsNewCar: newCar, dsPaymentList: data.dsPaymentList, dsWorkCp: data.dsWorkCp, codes });
    if (result.missingRequirements.length) throw new Error(`계산 기준정보를 확인해 주세요: ${result.missingRequirements.map(value =>
        ({ 'TM_TAX rates': '유효 세율', 'bond purchase rate': '공채 매입률', 'TUSE/SBOND discount rate': '공채 할인율' }[value] || value.replace(/\([^)]*\)/g, ''))).join(', ')}`);
    return { ...result, car: newCar, inputs: estimateWInputs(newCar) };
};
export const fieldLabels = {
    TASK_CD: '업무구분', CARID_NO: '차대번호', REGIST_DATE: '등록예정일자', NUMPLATE_GB: '번호판지정 요구사항',
    HOLE_YN: '천공 여부', SEAL_YN: '봉인 여부', BUY_AMT: '공급가액', LINK_ID: '주문번호', CUSTOMER_NM: '계약자명',
    REG_GB: '등록구분', REG_NO: '등록번호', BIZ_NO: '사업자번호', OWNER_NM: '대표소유자명', RATIO_NO: '대표소유자 비율',
    MPHONE_NO: '휴대폰번호', ADDRESS: '소유자주소', BASE_ADDRESS: '사용본거지', NTAX_TRGET_CD: '비과세대상',
    NTAX_TRGET_GR_CD: '비과세대상등급', NTAX_WHO: '비과세대상자', CARD_YN: '취득세카드납부', BOND_DC: '채권할인여부',
    PAY_NM: '결제자명', PAY_HP_NO: '결제자 휴대폰번호', RT_BANK_CD: '환급은행', RETURN_NO: '환급계좌', RETURN_NM: '환급계좌예금주',
    CARP_ADDRESS: '등록증 배송지', DEBTOR_GB: '공동소유자 등록구분', DEBTOR_NM: '공동소유자명', DEBTOR_TEL_NO: '공동소유자 전화번호',
    DEBTOR_REG_NO: '공동소유자 등록번호', DEBTOR_BIZ_NO: '공동소유자 사업자번호', DEBTOR_RATIO: '공동소유자비율',
    ADDRESS_DT: '소유자 상세주소', POST_NO: '소유자 우편번호', DEBTOR_ADDR: '공동소유자 주소',
    DEBTOR_ADDR_DT: '공동소유자 상세주소', DEBTOR_ROAD_CD: '공동소유자 우편번호',
    MADE_YY: '연식', CAR_CC: '배기량', GETIN_NO: '승차정원', CAR_KD: '차종', CAR_CD: '차량구분', CAR_KD_CD: '차종코드',
    FM_NM: '형식', FOM_NM: '제원형식', FUEL_CD: '사용연료', COLOR_GB: '원동기형식', SPMNNO: '형식승인번호',
    LENGTH: '길이', WIDTH: '너비', HEIGHT: '높이', MAX_CAP: '최대적재량', TOTAL_CAP: '총중량',
    CAR_US_KD: '차체형태', MULTI_PURPOSE_YN: '다목적 여부', VH_TY_CD: '차체구분', ECO_YN: '친환경 여부',
    VHCTY_ASORT_CODE: '차종구분', LOW_POLLUTION_YN: '저공해차 여부'
};
const digits = value => String(value ?? '').replace(/\D/g, '');
export const formatWPhoneNo = value => {
    const number = digits(value);
    const prefix = number.startsWith('02') ? 2 : 3;
    const middle = number.length > prefix + 7 ? 4 : 3;
    return [number.slice(0, prefix), number.slice(prefix, prefix + middle), number.slice(prefix + middle)].filter(Boolean).join('-');
};
export const formatWBusinessNo = value => {
    const number = digits(value);
    return [number.slice(0, 3), number.slice(3, 5), number.slice(5)].filter(Boolean).join('-');
};
const blank = value => value === null || value === undefined || String(value).trim() === '';
const date = value => {
    const text = String(value || '');
    return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : text.slice(0, 10);
};
export const canEditW = (service = {}) =>
    ['INPUT', 'SAV', 'C_REQ', 'C_SAV', 'I_REQ', 'I_SAV', 'W_REQ', 'RET', 'DEL'].includes(service.PROC_ST)
    && (!service.JUDGE_ST || ['RET', 'DEL'].includes(service.PROC_ST));

export const normalizeWData = (data = {}) => {
    const normalizeOwner = (defaults, owner = {}) => ({ ...defaults, ...owner,
        DEBTOR_REG_NO: owner.DEBTOR_REG_NO ?? owner.REG_NO ?? '',
        DEBTOR_BIZ_NO: owner.DEBTOR_BIZ_NO ?? owner.BIZ_NO ?? '',
        DEBTOR_TEL_NO: owner.DEBTOR_TEL_NO ?? owner.DSIGN_HP_NO ?? '' });
    return {
        ...data,
        dsService: { ...initialDsService, ...data.dsService, REQUEST_DT: date(data.dsService?.REQUEST_DT), JUDGE_DT: date(data.dsService?.JUDGE_DT) },
        dsNewCar: { ...initialDsNewCar, FUEL_CD: '', NUMPLATE_GB: '', CARP_MAIL: '',
            LOW_POLLUTION_YN: '', LOW_POLLUTION_KD: '', LOW_POLLUTION_NO: '', ...data.dsNewCar,
            ...(AUTO_APPLY_EXEMPTION_TARGET_CODES.has(String(data.dsNewCar?.NTAX_TRGET_CD)) ? { NTAX_TRGET_GR_CD: 'D' } : {}),
            MADE_DT: date(data.dsNewCar?.MADE_DT), REGIST_DATE: date(data.dsNewCar?.REGIST_DATE) },
        dsOwnerInfo: normalizeOwner(initialOwnerInfo, data.dsOwnerInfo),
        dsOwnerInfo1: normalizeOwner(initialOwnerInfo1, data.dsOwnerInfo1),
        dsCarNoDetach: { ...initialDsCarNoDetach, HOLE_YN: '02', SEAL_YN: '02', ...data.dsCarNoDetach },
        dsTaxReceipt: { ...emptyTaxReceipt, ...data.dsTaxReceipt },
        dsPaymentList: data.dsPaymentList || [],
        dsCompanyInfo: data.dsCompanyInfo || {}, dsUserInfo: data.dsUserInfo || {}
    };
};

export const requiredWFields = data => {
    const n = data.dsNewCar || {};
    const fields = [
        ...['TASK_CD', 'CARID_NO', 'REGIST_DATE', 'NUMPLATE_GB', 'BUY_AMT', 'REG_GB', 'REG_NO', 'OWNER_NM',
            'RATIO_NO', 'MPHONE_NO', 'ADDRESS', 'BASE_ADDRESS', 'NTAX_TRGET_CD', 'CARD_YN', 'BOND_DC',
            'PAY_NM', 'PAY_HP_NO', 'RT_BANK_CD', 'RETURN_NO', 'RETURN_NM', 'CARP_ADDRESS'].map(name => ['dsNewCar', name]),
        ['dsService', 'LINK_ID'], ['dsCarNoDetach', 'CUSTOMER_NM'], ['dsCarNoDetach', 'HOLE_YN'], ['dsCarNoDetach', 'SEAL_YN']
    ];
    if (n.REG_GB === 'B') fields.push(['dsNewCar', 'BIZ_NO']);
    if (gradeTargets.includes(n.NTAX_TRGET_CD)) fields.push(['dsNewCar', 'NTAX_TRGET_GR_CD']);
    if (n.NTAX_TRGET_CD && n.NTAX_TRGET_CD !== '00') fields.push(['dsNewCar', 'NTAX_WHO']);
    if (Number(n.RATIO_NO) < 100) {
        ['dsOwnerInfo', 'dsOwnerInfo1'].forEach((key, index) => {
            const owner = data[key] || {};
            if (index === 0 || Number(owner.DEBTOR_RATIO) > 0 || owner.DEBTOR_NM) {
                ['DEBTOR_GB', 'DEBTOR_NM', 'DEBTOR_TEL_NO', 'DEBTOR_REG_NO', 'DEBTOR_RATIO'].forEach(name => fields.push([key, name]));
                if (owner.DEBTOR_GB === 'B') fields.push([key, 'DEBTOR_BIZ_NO']);
            }
        });
    }
    return fields;
};

export const validateW = (data, action = 'SAVE') => {
    const n = data.dsNewCar || {};
    const error = (key, name, message) => ({ key, name, message });
    if (!/^[A-Z0-9]{17}$/.test(n.CARID_NO || '')) return error('dsNewCar', 'CARID_NO', '차대번호 17자리를 확인해 주세요.');
    const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (n.CARP_MAIL && !email(n.CARP_MAIL)) return error('dsNewCar', 'CARP_MAIL', '등록증 이메일 주소를 확인해 주세요.');
    if (action !== 'REQUEST') return null;
    for (const [key, name] of requiredWFields(data)) {
        if (blank(data[key]?.[name])) return error(key, name, `${fieldLabels[name]}를(을) 입력해 주세요.`);
    }
    if (!(Number(n.BUY_AMT) > 0)) return error('dsNewCar', 'BUY_AMT', '공급가액은 0보다 커야 합니다.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.REGIST_DATE) || Number.isNaN(Date.parse(n.REGIST_DATE))) return error('dsNewCar', 'REGIST_DATE', '등록예정일자를 확인해 주세요.');
    if (!['Y', 'N'].includes(n.CARD_YN)) return error('dsNewCar', 'CARD_YN', '취득세 카드납부 여부를 확인해 주세요.');
    const activeOwners = [data.dsOwnerInfo, data.dsOwnerInfo1].filter(o => o && (Number(o.DEBTOR_RATIO) > 0 || o.DEBTOR_NM));
    const ratio = Number(n.RATIO_NO);
    if (!(ratio > 0 && ratio <= 100) || activeOwners.some(o => !(Number(o.DEBTOR_RATIO) > 0))
        || ratio + activeOwners.reduce((sum, o) => sum + Number(o.DEBTOR_RATIO), 0) !== 100) {
        return error('dsNewCar', 'RATIO_NO', '대표·공동소유자 비율의 합계는 100%이어야 합니다.');
    }
    for (const [key, name] of requiredWFields(data)) {
        const value = data[key]?.[name];
        if (name.endsWith('REG_NO')) {
            const gb = data[key][key === 'dsNewCar' ? 'REG_GB' : 'DEBTOR_GB'];
            if (digits(value).length !== (gb === 'C' ? 10 : 13)) return error(key, name, `${fieldLabels[name]} 자릿수를 확인해 주세요.`);
        }
        if (name.endsWith('BIZ_NO') && digits(value).length !== 10) return error(key, name, `${fieldLabels[name]} 10자리를 확인해 주세요.`);
        if (['MPHONE_NO', 'PAY_HP_NO', 'DEBTOR_TEL_NO'].includes(name) && !/^\d{9,11}$/.test(digits(value))) return error(key, name, `${fieldLabels[name]}를 확인해 주세요.`);
    }
    if (gradeTargets.includes(n.NTAX_TRGET_CD) && n.NTAX_TRGET_GR_CD === '0') return error('dsNewCar', 'NTAX_TRGET_GR_CD', '비과세대상등급을 선택해 주세요.');
    const t = data.dsTaxReceipt || {};
    if (t.GUBUN === 'TAX') {
        for (const [name, label] of Object.entries({ REG_NO: '사업자번호', COMPANY_NM: '상호명', NAME: '대표자명', ADDR: '주소', BUSINESS_TYPE: '업태', INDUSTRY_TYPE: '업종', MAIL1: '이메일' })) {
            if (blank(t[name])) return error('dsTaxReceipt', name, `세금계산서 ${label}를 입력해 주세요.`);
        }
        if (digits(t.REG_NO).length !== 10 || !email(t.MAIL1) || (t.MAIL2 && !email(t.MAIL2))) return error('dsTaxReceipt', 'REG_NO', '세금계산서 사업자번호와 이메일을 확인해 주세요.');
    } else if (t.GUBUN === 'CASH') {
        if (t.REG_NO ? digits(t.REG_NO).length !== 10 : !/^\d{9,11}$/.test(digits(t.PHONE_NO))) return error('dsTaxReceipt', 'PHONE_NO', '현금영수증 휴대폰번호 또는 사업자번호를 확인해 주세요.');
    } else if (t.GUBUN) return error('dsTaxReceipt', 'GUBUN', '증빙 종류를 확인해 주세요.');
    return null;
};

export const pdfWChanges = (current, extracted) => {
    if (extracted.rawText !== undefined && !String(extracted.rawText || '').trim()) {
        throw new Error('이 PDF에는 추출할 수 있는 텍스트가 없습니다. 텍스트가 포함된 원본 PDF로 다시 업로드해 주세요.');
    }
    const vin = String(extracted.carIdNo || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{17}$/.test(vin)) throw new Error('제작증에서 유효한 차대번호를 찾지 못했습니다.');
    if (current.CARID_NO && current.CARID_NO !== vin) throw new Error('현재 신청과 제작증의 차대번호가 다릅니다.');
    const owners = extracted.owners || [];
    if (owners.length > 3) throw new Error('소유자가 3명을 초과하는 제작증은 담당자에게 확인해 주세요.');
    const owner = owners[0] || {};
    const values = {
        CARID_NO: vin, CAR_NM: extracted.carName, BUY_AMT: digits(extracted.supplyAmount), OWNER_NM: owner.name || extracted.ownerName,
        REG_NO: digits(owner.regNo || extracted.ownerRegNo), ADDRESS: owner.address || extracted.ownerAddress,
        ADDRESS_DT: owner.addressDetail, POST_NO: owner.postNo,
        MADE_DT: date(extracted.manufactureDate), REGIST_DATE: date(extracted.firstTransferDate)
    };
    const changes = { dsNewCar: Object.fromEntries(Object.entries(values).filter(([key, value]) => !blank(value))) };
    if (owners.length > 1) {
        Object.assign(changes.dsNewCar, { REG_GB: 'R', RATIO_NO: '0' });
        owners.slice(1).forEach((joint, index) => {
            changes[index ? 'dsOwnerInfo1' : 'dsOwnerInfo'] = {
                DEBTOR_GB: 'R', DEBTOR_NM: joint.name || '', DEBTOR_REG_NO: digits(joint.regNo), DEBTOR_RATIO: '0',
                DEBTOR_ADDR: joint.address || '', DEBTOR_ADDR_DT: joint.addressDetail || '', DEBTOR_ROAD_CD: joint.postNo || ''
            };
        });
    }
    return changes;
};
