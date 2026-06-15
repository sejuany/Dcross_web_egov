import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import AddressSearchModal from '../common/AddressSearchModal';
import { gf } from '../../utils/utils';
import './CompanyManage.css';

const EMPTY_COMPANY = {
    COMPANY_ID: '',
    COMPANY_NM: '',
    BIZ_NO: '',
    COMPANY_NO: '',
    CEO_NM: '',
    TEL_NO: '',
    MPHONE_NO: '',
    ADDRESS: '',
    ADDRESS_DT: '',
    POST_NO: '',
    RT_BANK_CD: '',
    RT_ACC_NO: '',
    RT_ACC_NM: '',
    ASSOCIATION_ID: '',
    BUBJUNG_CD: '',
    BUBJUNG_NM: '',
    HJD_CD: '',
    HJD_NM: '',
    ROAD_CD: '',
    ROAD_NM: '',
    ADDR_INFO: '',
};

const DEFAULT_BASE_ADDR_INPUT = {
    COMPANY_ID: '',
    BASE_ID: '',
    BASE_NM: '',
    BIZ_NO: '',
    POST_NO: '',
    ADDRESS: '',
    ADDRESS_DT: '',
    BUBJUNG_CD: '',
    BUBJUNG_NM: '',
    HJD_CD: '',
    HJD_NM: '',
    ROAD_CD: '',
    ROAD_NM: '',
    ADDR_INFO: '',
};

const DEFAULT_BRANCH_INPUT = {
    COMPANY_ID: '',
    BRANCH_ID: '',
    BRANCH_NM: '',
    BIZ_NO: '',
    POST_NO: '',
    ADDRESS: '',
    ADDRESS_DT: '',
    BUBJUNG_CD: '',
    BUBJUNG_NM: '',
    HJD_CD: '',
    HJD_NM: '',
    ROAD_CD: '',
    ROAD_NM: '',
    ADDR_INFO: '',
    TEL_NO: '',
    MPHONE_NO: '',
    BASE_ID: '',
    NEWCAR_YN: 'N',
    MORTREG_YN: 'N',
    MORTERS_YN: 'N',
    TRNSNAME_YN: 'N',
    MODIFY_YN: 'N',
    PAYMENT_ME: '',
    USE_YN: 'Y',
};

const DEFAULT_SANGSA_INPUT = {
    COMPANY_ID: '',
    BRANCH_ID: '',
    SANGSA_ID: '',
    SANGSA_NM: '',
    BIZ_NO: '',
    POST_NO: '',
    ADDRESS: '',
    ADDRESS_DT: '',
    BUBJUNG_CD: '',
    BUBJUNG_NM: '',
    HJD_CD: '',
    HJD_NM: '',
    ROAD_CD: '',
    ROAD_NM: '',
    ADDR_INFO: '',
    TEL_NO: '',
    MPHONE_NO: '',
    NEWCAR_YN: 'N',
    MORTREG_YN: 'N',
    MORTERS_YN: 'N',
    TRNSNAME_YN: 'N',
    PAYMENT_ME: '',
    USE_YN: 'Y',
};

const DEFAULT_SERVICE_ROWS = [
    {
        WORK_CD: '010',
        WORK_NM: '신규등록',
        PERM_GB: 'N',
        PAYMENT_GB: 'B',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'GUN',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
    {
        WORK_CD: '000',
        WORK_NM: '저당설정',
        PERM_GB: 'N',
        PAYMENT_GB: 'B',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'GUN',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
    {
        WORK_CD: '001',
        WORK_NM: '저당해지',
        PERM_GB: 'N',
        PAYMENT_GB: 'B',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'GUN',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
    {
        WORK_CD: '011',
        WORK_NM: '이전등록',
        PERM_GB: 'N',
        PAYMENT_GB: 'B',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'GUN',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
    {
        WORK_CD: '030',
        WORK_NM: '변경등록',
        PERM_GB: 'N',
        PAYMENT_GB: 'B',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'GUN',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
    {
        WORK_CD: '910',
        WORK_NM: '원부조회',
        PERM_GB: 'N',
        PAYMENT_GB: 'A',
        PAYMENT_OP: 'Y',
        PAYMENT_TP: 'MON',
        FEE: '',
        GOVT_ID: 'HAMAN',
        POINT_COMMON_USE: 'N',
        POINT_SANGSA_USE: 'N',
        USE_YN: 'Y',
    },
];

const FALLBACK_BANK_OPTIONS = [
    { CODE_ID: '', CODE_NM: '선택' },
    { CODE_ID: '004', CODE_NM: '국민은행' },
    { CODE_ID: '011', CODE_NM: '농협은행' },
    { CODE_ID: '020', CODE_NM: '우리은행' },
    { CODE_ID: '081', CODE_NM: '하나은행' },
    { CODE_ID: '088', CODE_NM: '신한은행' },
];

const USE_OPTIONS = [
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
];

const PAYMENT_GB_OPTIONS = [
    { code: 'B', name: '선납' },
    { code: 'A', name: '후납' },
];

const PAYMENT_OP_OPTIONS = [
    { code: 'Y', name: '납부' },
    { code: 'N', name: '면제' },
];

const PAYMENT_TP_OPTIONS = [
    { code: 'GUN', name: '건별' },
    { code: 'MON', name: '월별' },
];

const POINT_COMMON_OPTIONS = [
    { code: 'N', name: '미사용' },
    { code: 'A', name: '공용' },
    { code: 'B', name: '지점별' },
];

const POINT_SANGSA_OPTIONS = [
    { code: 'N', name: '미사용' },
    { code: 'Y', name: '사용' },
];

const WORK_YN_OPTIONS = [
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
];

const BRANCH_WORK_FIELDS = [
    { workCd: '010', label: '신규등록', field: 'NEWCAR_YN' },
    { workCd: '011', label: '이전등록', field: 'TRNSNAME_YN' },
    { workCd: '000', label: '저당설정', field: 'MORTREG_YN' },
    { workCd: '001', label: '저당말소', field: 'MORTERS_YN' },
    { workCd: '030', label: '변경등록', field: 'MODIFY_YN' },
];

const getValue = (obj, ...keys) => {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
    }

    return '';
};

const getCodeId = (item) => {
    return getValue(item, 'CODE_ID', 'codeId', 'code_ID', 'CODE_CD', 'codeCd');
};

const getCodeName = (item) => {
    return getValue(item, 'CODE_NM', 'codeNm', 'code_NM', 'CODE_NAME', 'codeName');
};

const normalizeCompany = (data = {}) => ({
    COMPANY_ID: getValue(data, 'COMPANY_ID', 'company_ID', 'companyId'),
    COMPANY_NM: getValue(data, 'COMPANY_NM', 'company_NM', 'companyNm'),
    BIZ_NO: getValue(data, 'BIZ_NO', 'biz_NO', 'bizNo'),
    COMPANY_NO: getValue(data, 'COMPANY_NO', 'company_NO', 'companyNo'),
    CEO_NM: getValue(data, 'CEO_NM', 'ceo_NM', 'ceoNm'),
    TEL_NO: getValue(data, 'TEL_NO', 'tel_NO', 'telNo'),
    MPHONE_NO: getValue(data, 'MPHONE_NO', 'mphone_NO', 'mphoneNo'),
    ADDRESS: getValue(data, 'ADDRESS', 'address'),
    ADDRESS_DT: getValue(data, 'ADDRESS_DT', 'address_DT', 'addressDt'),
    POST_NO: getValue(data, 'POST_NO', 'post_NO', 'postNo'),
    RT_BANK_CD: getValue(data, 'RT_BANK_CD', 'rt_BANK_CD', 'rtBankCd'),
    RT_ACC_NO: getValue(data, 'RT_ACC_NO', 'rt_ACC_NO', 'rtAccNo'),
    RT_ACC_NM: getValue(data, 'RT_ACC_NM', 'rt_ACC_NM', 'rtAccNm'),
    ASSOCIATION_ID: getValue(data, 'ASSOCIATION_ID', 'association_ID', 'associationId'),
    BUBJUNG_CD: getValue(data, 'BUBJUNG_CD', 'bubjung_CD', 'bubjungCd'),
    BUBJUNG_NM: getValue(data, 'BUBJUNG_NM', 'bubjung_NM', 'bubjungNm'),
    HJD_CD: getValue(data, 'HJD_CD', 'hjd_CD', 'hjdCd'),
    HJD_NM: getValue(data, 'HJD_NM', 'hjd_NM', 'hjdNm'),
    ROAD_CD: getValue(data, 'ROAD_CD', 'road_CD', 'roadCd'),
    ROAD_NM: getValue(data, 'ROAD_NM', 'road_NM', 'roadNm'),
    ADDR_INFO: getValue(data, 'ADDR_INFO', 'addr_INFO', 'addrInfo'),
});

const normalizeBaseAddr = (row = {}) => ({
    COMPANY_ID: getValue(row, 'COMPANY_ID', 'company_ID', 'companyId'),
    BASE_ID: getValue(row, 'BASE_ID', 'base_ID', 'baseId'),
    BASE_NM: getValue(row, 'BASE_NM', 'base_NM', 'baseNm'),
    BIZ_NO: getValue(row, 'BIZ_NO', 'biz_NO', 'bizNo'),
    POST_NO: getValue(row, 'POST_NO', 'post_NO', 'postNo'),
    ADDRESS: getValue(row, 'ADDRESS', 'address'),
    ADDRESS_DT: getValue(row, 'ADDRESS_DT', 'address_DT', 'addressDt'),
    BUBJUNG_CD: getValue(row, 'BUBJUNG_CD', 'bubjung_CD', 'bubjungCd'),
    BUBJUNG_NM: getValue(row, 'BUBJUNG_NM', 'bubjung_NM', 'bubjungNm'),
    HJD_CD: getValue(row, 'HJD_CD', 'hjd_CD', 'hjdCd'),
    HJD_NM: getValue(row, 'HJD_NM', 'hjd_NM', 'hjdNm'),
    ROAD_CD: getValue(row, 'ROAD_CD', 'road_CD', 'roadCd'),
    ROAD_NM: getValue(row, 'ROAD_NM', 'road_NM', 'roadNm'),
    ADDR_INFO: getValue(row, 'ADDR_INFO', 'addr_INFO', 'addrInfo'),
});

const normalizeBranch = (row = {}) => ({
    COMPANY_ID: getValue(row, 'COMPANY_ID', 'company_ID', 'companyId'),
    BRANCH_ID: getValue(row, 'BRANCH_ID', 'branch_ID', 'branchId'),
    BRANCH_NM: getValue(row, 'BRANCH_NM', 'branch_NM', 'branchNm'),
    BIZ_NO: getValue(row, 'BIZ_NO', 'biz_NO', 'bizNo'),
    POST_NO: getValue(row, 'POST_NO', 'post_NO', 'postNo'),
    ADDRESS: getValue(row, 'ADDRESS', 'address'),
    ADDRESS_DT: getValue(row, 'ADDRESS_DT', 'address_DT', 'addressDt'),
    BUBJUNG_CD: getValue(row, 'BUBJUNG_CD', 'bubjung_CD', 'bubjungCd'),
    BUBJUNG_NM: getValue(row, 'BUBJUNG_NM', 'bubjung_NM', 'bubjungNm'),
    HJD_CD: getValue(row, 'HJD_CD', 'hjd_CD', 'hjdCd'),
    HJD_NM: getValue(row, 'HJD_NM', 'hjd_NM', 'hjdNm'),
    ROAD_CD: getValue(row, 'ROAD_CD', 'road_CD', 'roadCd'),
    ROAD_NM: getValue(row, 'ROAD_NM', 'road_NM', 'roadNm'),
    ADDR_INFO: getValue(row, 'ADDR_INFO', 'addr_INFO', 'addrInfo'),
    TEL_NO: getValue(row, 'TEL_NO', 'tel_NO', 'telNo'),
    MPHONE_NO: getValue(row, 'MPHONE_NO', 'mphone_NO', 'mphoneNo'),
    BASE_ID: getValue(row, 'BASE_ID', 'base_ID', 'baseId'),
    NEWCAR_YN: getValue(row, 'NEWCAR_YN', 'newcar_YN', 'newcarYn') || 'N',
    MORTREG_YN: getValue(row, 'MORTREG_YN', 'mortreg_YN', 'mortregYn') || 'N',
    MORTERS_YN: getValue(row, 'MORTERS_YN', 'morters_YN', 'mortersYn') || 'N',
    TRNSNAME_YN: getValue(row, 'TRNSNAME_YN', 'trnsname_YN', 'trnsnameYn') || 'N',
    MODIFY_YN: getValue(row, 'MODIFY_YN', 'modify_YN', 'modifyYn') || 'N',
    PAYMENT_ME: getValue(row, 'PAYMENT_ME', 'payment_ME', 'paymentMe'),
    USE_YN: getValue(row, 'USE_YN', 'use_YN', 'useYn') || 'Y',
});

const normalizeSangsa = (row = {}) => ({
    COMPANY_ID: getValue(row, 'COMPANY_ID', 'company_ID', 'companyId'),
    BRANCH_ID: getValue(row, 'BRANCH_ID', 'branch_ID', 'branchId'),
    SANGSA_ID: getValue(row, 'SANGSA_ID', 'sangsa_ID', 'sangsaId'),
    SANGSA_NM: getValue(row, 'SANGSA_NM', 'sangsa_NM', 'sangsaNm'),
    BIZ_NO: getValue(row, 'BIZ_NO', 'biz_NO', 'bizNo'),
    POST_NO: getValue(row, 'POST_NO', 'post_NO', 'postNo'),
    ADDRESS: getValue(row, 'ADDRESS', 'address'),
    ADDRESS_DT: getValue(row, 'ADDRESS_DT', 'address_DT', 'addressDt'),
    BUBJUNG_CD: getValue(row, 'BUBJUNG_CD', 'bubjung_CD', 'bubjungCd'),
    BUBJUNG_NM: getValue(row, 'BUBJUNG_NM', 'bubjung_NM', 'bubjungNm'),
    HJD_CD: getValue(row, 'HJD_CD', 'hjd_CD', 'hjdCd'),
    HJD_NM: getValue(row, 'HJD_NM', 'hjd_NM', 'hjdNm'),
    ROAD_CD: getValue(row, 'ROAD_CD', 'road_CD', 'roadCd'),
    ROAD_NM: getValue(row, 'ROAD_NM', 'road_NM', 'roadNm'),
    ADDR_INFO: getValue(row, 'ADDR_INFO', 'addr_INFO', 'addrInfo'),
    TEL_NO: getValue(row, 'TEL_NO', 'tel_NO', 'telNo'),
    MPHONE_NO: getValue(row, 'MPHONE_NO', 'mphone_NO', 'mphoneNo'),
    BASE_ID: getValue(row, 'BASE_ID', 'base_ID', 'baseId'),
    NEWCAR_YN: getValue(row, 'NEWCAR_YN', 'newcar_YN', 'newcarYn') || 'N',
    MORTREG_YN: getValue(row, 'MORTREG_YN', 'mortreg_YN', 'mortregYn') || 'N',
    MORTERS_YN: getValue(row, 'MORTERS_YN', 'morters_YN', 'mortersYn') || 'N',
    TRNSNAME_YN: getValue(row, 'TRNSNAME_YN', 'trnsname_YN', 'trnsnameYn') || 'N',
    PAYMENT_ME: getValue(row, 'PAYMENT_ME', 'payment_ME', 'paymentMe'),
    USE_YN: getValue(row, 'USE_YN', 'use_YN', 'useYn') || 'Y',
});

const getServiceWorkName = (workCd) => {
    switch (String(workCd || '')) {
        case '010':
            return '신규등록';
        case '000':
            return '저당설정';
        case '001':
            return '저당해지';
        case '011':
            return '이전등록';
        case '030':
            return '변경등록';
        case '910':
            return '원부조회';
        default:
            return workCd || '';
    }
};

const normalizeServiceRow = (row = {}) => {
    const workCd = getValue(row, 'WORK_CD', 'work_CD', 'workCd');

    return {
        WORK_CD: workCd,
        WORK_NM: getServiceWorkName(workCd),
        COMPANY_ID: getValue(row, 'COMPANY_ID', 'company_ID', 'companyId'),
        PERM_GB: getValue(row, 'PERM_GB', 'perm_GB', 'permGb', 'USE_YN', 'use_YN', 'useYn') || 'N',
        PAYMENT_GB: getValue(row, 'PAYMENT_GB', 'payment_GB', 'paymentGb') || '',
        PAYMENT_OP: getValue(row, 'PAYMENT_OP', 'payment_OP', 'paymentOp') || '',
        PAYMENT_TP: getValue(row, 'PAYMENT_TP', 'payment_TP', 'paymentTp') || '',
        FEE: String(getValue(row, 'FEE', 'fee') || ''),
        GOVT_ID: getValue(row, 'GOVT_ID', 'govt_ID', 'govtId') || 'HAMAN',
        POINT_COMMON_USE: getValue(row, 'POINT_COMMON_USE', 'point_COMMON_USE', 'pointCommonUse') || 'N',
        POINT_SANGSA_USE: getValue(row, 'POINT_SANGSA_USE', 'point_SANGSA_USE', 'pointSangsaUse') || 'N',
        USE_YN: getValue(row, 'USE_YN', 'use_YN', 'useYn') || 'Y',
    };
};

const mergeServiceRows = (apiRows = []) => {
    const normalizedRows = apiRows.map(normalizeServiceRow);

    return DEFAULT_SERVICE_ROWS.map(defaultRow => {
        const found = normalizedRows.find(row => row.WORK_CD === defaultRow.WORK_CD);

        if (!found) {
            return { ...defaultRow };
        }

        return {
            ...defaultRow,
            ...found,
            WORK_NM: defaultRow.WORK_NM,
        };
    });
};

function CompanyManage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const baseNameRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [isSpecialCompany, setIsSpecialCompany] = useState(false);

    const [companyOptions, setCompanyOptions] = useState([]);
    const [bankOptions, setBankOptions] = useState(FALLBACK_BANK_OPTIONS);

    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [company, setCompany] = useState(EMPTY_COMPANY);

    const [baseAddrList, setBaseAddrList] = useState([]);
    const [selectedBaseIndex, setSelectedBaseIndex] = useState(-1);
    const [baseAddrInput, setBaseAddrInput] = useState(DEFAULT_BASE_ADDR_INPUT);

    const [serviceRows, setServiceRows] = useState(DEFAULT_SERVICE_ROWS);
    const [companyWorkList, setCompanyWorkList] = useState([]);
    const [branchBaseList, setBranchBaseList] = useState([]);

    const [branchList, setBranchList] = useState([]);
    const [selectedBranchIndex, setSelectedBranchIndex] = useState(-1);
    const [branchInput, setBranchInput] = useState(DEFAULT_BRANCH_INPUT);

    const [sangsaList, setSangsaList] = useState([]);
    const [selectedSangsaIndex, setSelectedSangsaIndex] = useState(-1);
    const [sangsaInput, setSangsaInput] = useState(DEFAULT_SANGSA_INPUT);

    const [branchPopupOpen, setBranchPopupOpen] = useState(false);
    const [sangsaPopupOpen, setSangsaPopupOpen] = useState(false);

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressTarget, setAddressTarget] = useState(null);

    const loginCompanyId = getValue(user, 'COMPANY_ID', 'company_ID', 'companyId');
    const loginBranchId = getValue(user, 'BRANCH_ID', 'branch_ID', 'branchId');
    const loginId = getValue(user, 'LOGIN_ID', 'login_ID', 'loginId', 'MEMBER_ID', 'member_ID', 'memberId');
    const userAuth = String(getValue(user, 'MEMBER_GB', 'member_GB', 'memberGb', 'USER_AUTH', 'userAuth') || '').toUpperCase();

    const isDacos = String(loginCompanyId || '').toUpperCase() === 'DACOS';

    const isAdmin =
        userAuth === 'UC' ||
        String(userAuth || '').startsWith('UA') ||
        isDacos;

    const isSpecialCompanyAdmin = userAuth === 'CA';
    const isSpecialBranchAdmin = userAuth === 'BA';
    const isSpecialNoAuth = ['SA', 'SU'].includes(userAuth);

    const canEditCompanyInfo = !isSpecialCompany || isSpecialCompanyAdmin || isDacos;
    const canEditBaseAddr = !isSpecialCompany || isSpecialCompanyAdmin || isDacos;
    const canEditBranchInfo = isSpecialCompanyAdmin || isSpecialBranchAdmin;
    const canEditSangsaInfo = isSpecialCompanyAdmin || isSpecialBranchAdmin;

    const getAllowedBranchWorks = () => {
        return BRANCH_WORK_FIELDS.filter(work => {
            const found = companyWorkList.find(item => String(item.WORK_CD) === work.workCd);
            return String(found?.PERM_GB || found?.USE_YN || '').toUpperCase() === 'Y';
        });
    };

    const getSelectedBranchBase = () => {
        return branchBaseList.find(item => String(item.BASE_ID) === String(branchInput.BASE_ID)) || null;
    };

    const handleBranchBaseChange = (e) => {
        const baseId = e.target.value;

        setBranchInput(prev => ({
            ...prev,
            BASE_ID: baseId,
        }));
    };

    const alertMessage = useCallback(async (message, title = '알림') => {
        if (gf?.alert) {
            await gf.alert(message, title);
            return;
        }

        alert(message);
    }, []);

    const confirmMessage = useCallback(async (message, title = '확인') => {
        if (gf?.confirm) {
            return await gf.confirm(message, title);
        }

        return window.confirm(message);
    }, []);

    const getCurrentCompanyId = () => {
        return selectedCompanyId || company.COMPANY_ID || loginCompanyId;
    };

    const resetScreen = () => {
        setCompany(EMPTY_COMPANY);
        setBaseAddrList([]);
        setSelectedBaseIndex(-1);
        setBaseAddrInput(DEFAULT_BASE_ADDR_INPUT);
        setServiceRows(DEFAULT_SERVICE_ROWS);
        setCompanyWorkList([]);
        setBranchBaseList([]);

        setBranchList([]);
        setSelectedBranchIndex(-1);
        setBranchInput(DEFAULT_BRANCH_INPUT);

        setSangsaList([]);
        setSelectedSangsaIndex(-1);
        setSangsaInput(DEFAULT_SANGSA_INPUT);
    };

    const loadBankOptions = useCallback(async () => {
        try {
            if (!gf?.getCodeDetails) {
                setBankOptions(FALLBACK_BANK_OPTIONS);
                return;
            }

            const codes = await gf.getCodeDetails(['BANK']);
            const list = codes?.BANK || [];

            if (!Array.isArray(list) || list.length === 0) {
                setBankOptions(FALLBACK_BANK_OPTIONS);
                return;
            }

            setBankOptions([
                { CODE_ID: '', CODE_NM: '선택' },
                ...list,
            ]);
        } catch (error) {
            console.error('[CompanyManage] 은행 코드 조회 실패:', error);
            setBankOptions(FALLBACK_BANK_OPTIONS);
        }
    }, []);

    const loadCompanyOptions = useCallback(async () => {
        try {
            const response = await axios.post('/api/company/manage/company-options', {
                USE_YN: 'Y',
            });

            if (!response.data.success) {
                setCompanyOptions([]);
                return;
            }

            setCompanyOptions(response.data.list || []);
        } catch (error) {
            console.error('[CompanyManage] 회원사 콤보 조회 실패:', error);
            setCompanyOptions([]);
        }
    }, []);

    const loadSangsaList = useCallback(async (companyId, branchId) => {
        if (!companyId || !branchId) {
            setSangsaList([]);
            setSelectedSangsaIndex(-1);
            setSangsaInput(DEFAULT_SANGSA_INPUT);
            return;
        }

        try {
            const response = await axios.post('/api/company/sangsa/list', {
                COMPANY_ID: companyId,
                BRANCH_ID: branchId,
            });

            if (!response.data.success) {
                setSangsaList([]);
                return;
            }

            const list = (response.data.list || []).map(normalizeSangsa);

            setSangsaList(list);
            setSelectedSangsaIndex(-1);
            setSangsaInput({
                ...DEFAULT_SANGSA_INPUT,
                COMPANY_ID: companyId,
                BRANCH_ID: branchId,
            });
        } catch (error) {
            console.error('[CompanyManage] 영업팀 목록 조회 실패:', error);
            setSangsaList([]);
        }
    }, []);

    const loadBranchList = useCallback(async (companyId) => {
        if (!companyId) {
            setBranchList([]);
            return;
        }

        try {
            const response = await axios.post('/api/company/branch/manage/list', {
                COMPANY_ID: companyId,
                BRANCH_ID: isSpecialBranchAdmin ? loginBranchId : '',
            });

            if (!response.data.success) {
                setBranchList([]);
                return;
            }

            const list = (response.data.list || []).map(normalizeBranch);
            setBranchList(list);

            if (list.length > 0) {
                setSelectedBranchIndex(0);
                setBranchInput(list[0]);
                await loadSangsaList(companyId, list[0].BRANCH_ID);
            } else {
                setSelectedBranchIndex(-1);
                setBranchInput({
                    ...DEFAULT_BRANCH_INPUT,
                    COMPANY_ID: companyId,
                    BRANCH_ID: isSpecialBranchAdmin ? loginBranchId : '',
                });
                setSangsaList([]);
                setSangsaInput({
                    ...DEFAULT_SANGSA_INPUT,
                    COMPANY_ID: companyId,
                    BRANCH_ID: isSpecialBranchAdmin ? loginBranchId : '',
                });
            }
        } catch (error) {
            console.error('[CompanyManage] 지점 목록 조회 실패:', error);
            setBranchList([]);
        }
    }, [isSpecialBranchAdmin, loginBranchId, loadSangsaList]);

    const loadCompanyDetail = useCallback(async (companyId) => {
        if (!companyId) {
            resetScreen();
            return;
        }

        setLoading(true);

        try {
            let special = false;

            if (gf?.isSpecialCompany) {
                special = await gf.isSpecialCompany(companyId);
            }

            setIsSpecialCompany(special);

            const response = await axios.post('/api/company/manage/detail', {
                COMPANY_ID: companyId,
            });

            if (!response.data.success) {
                resetScreen();
                await alertMessage(response.data.message || '기업관리 상세 조회에 실패했습니다.');
                return;
            }

            const data = response.data.data || {};
            const companyData = normalizeCompany(data.company || {});
            const baseRows = Array.isArray(data.baseAddrList) ? data.baseAddrList : [];
            const serviceList = Array.isArray(data.serviceList) ? data.serviceList : [];

            setCompany({
                ...EMPTY_COMPANY,
                ...companyData,
                COMPANY_ID: companyId,
            });

            const normalizedBaseRows = baseRows.map(normalizeBaseAddr);
            const normalizedServiceRows = serviceList.map(normalizeServiceRow);

            setBaseAddrList(normalizedBaseRows);
            setBranchBaseList(normalizedBaseRows);
            setCompanyWorkList(normalizedServiceRows);
            setSelectedBaseIndex(-1);
            setBaseAddrInput(DEFAULT_BASE_ADDR_INPUT);

            if (isDacos) {
                setServiceRows(mergeServiceRows(serviceList));
            } else {
                setServiceRows(DEFAULT_SERVICE_ROWS);
            }

            if (special && !['SA', 'SU'].includes(userAuth)) {
                await loadBranchList(companyId);
            } else {
                setBranchList([]);
                setSangsaList([]);
            }
        } catch (error) {
            console.error('[CompanyManage] 기업관리 상세 조회 실패:', error);
            resetScreen();
            await alertMessage(error.response?.data?.message || '기업관리 상세 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [alertMessage, isDacos, loadBranchList, userAuth]);

    const initPage = useCallback(async () => {
        if (!loginCompanyId) {
            resetScreen();
            await alertMessage('로그인 회원사 정보를 확인할 수 없습니다.');
            return;
        }

        await loadBankOptions();

        if (isAdmin) {
            await loadCompanyOptions();
        }

        setSelectedCompanyId(loginCompanyId);
        await loadCompanyDetail(loginCompanyId);
    }, [
        loginCompanyId,
        isAdmin,
        loadBankOptions,
        loadCompanyOptions,
        loadCompanyDetail,
        alertMessage,
    ]);

    useEffect(() => {
        initPage();
    }, [initPage]);

    const handleCompanySelectChange = async (e) => {
        const companyId = e.target.value;

        setSelectedCompanyId(companyId);

        if (!companyId) {
            resetScreen();
            return;
        }

        await loadCompanyDetail(companyId);
    };

    const handleCompanyChange = (e) => {
        const { name, value } = e.target;

        setCompany(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleBaseAddrChange = (e) => {
        const { name, value } = e.target;

        setBaseAddrInput(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleBranchChange = (e) => {
        const { name, value } = e.target;

        setBranchInput(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSangsaChange = (e) => {
        const { name, value } = e.target;

        setSangsaInput(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleServiceChange = (index, name, value) => {
        setServiceRows(prev => {
            const next = [...prev];

            next[index] = {
                ...next[index],
                [name]: value,
            };

            return next;
        });
    };

    const handleBaseAddrSelect = (index) => {
        const selected = baseAddrList[index];

        setSelectedBaseIndex(index);
        setBaseAddrInput({
            ...DEFAULT_BASE_ADDR_INPUT,
            ...selected,
        });
    };

    const handleBranchSelect = async (index) => {
        const selected = branchList[index];
        const companyId = getCurrentCompanyId();

        setSelectedBranchIndex(index);
        setBranchInput({
            ...DEFAULT_BRANCH_INPUT,
            ...selected,
        });

        await loadSangsaList(companyId, selected.BRANCH_ID);
    };

    const handleSangsaSelect = (index) => {
        const selected = sangsaList[index];

        setSelectedSangsaIndex(index);
        setSangsaInput({
            ...DEFAULT_SANGSA_INPUT,
            ...selected,
        });
    };

    const handleAddBaseAddr = () => {
        if (!canEditBaseAddr) {
            alertMessage('사용본거지 수정 권한이 없습니다.');
            return;
        }

        setSelectedBaseIndex(-1);
        setBaseAddrInput({
            ...DEFAULT_BASE_ADDR_INPUT,
            COMPANY_ID: selectedCompanyId || company.COMPANY_ID,
            BIZ_NO: company.BIZ_NO,
        });

        setTimeout(() => {
            baseNameRef.current?.focus();
        }, 0);
    };

    const handleAddBranch = () => {
        if (!isSpecialCompanyAdmin) {
            alertMessage('지점 추가는 기업 관리자만 가능합니다.');
            return;
        }

        const companyId = getCurrentCompanyId();

        setSelectedBranchIndex(-1);
        setBranchInput({
            ...DEFAULT_BRANCH_INPUT,
            COMPANY_ID: companyId,
        });

        setSangsaList([]);
        setSelectedSangsaIndex(-1);
        setSangsaInput({
            ...DEFAULT_SANGSA_INPUT,
            COMPANY_ID: companyId,
        });
    };

	const handleAddSangsa = () => {
	    if (!canEditSangsaInfo) {
	        alertMessage('영업팀 추가 권한이 없습니다.');
	        return;
	    }

	    const branchId = isSpecialBranchAdmin
	        ? loginBranchId
	        : branchInput.BRANCH_ID;

	    if (!branchId) {
	        alertMessage('먼저 지점을 선택해주세요.');
	        return;
	    }

	    setSelectedSangsaIndex(-1);
	    setSangsaInput({
	        ...DEFAULT_SANGSA_INPUT,
	        COMPANY_ID: getCurrentCompanyId(),
	        BRANCH_ID: branchId,
	        SANGSA_ID: '',
	        SANGSA_NM: '',
	        TEL_NO: '',
	        USE_YN: 'Y',
	    });
	};

    const handleApplyBaseAddr = async () => {
        if (!canEditBaseAddr) {
            await alertMessage('사용본거지 수정 권한이 없습니다.');
            return;
        }

        if (!baseAddrInput.BASE_NM.trim()) {
            await alertMessage('사용본거지명을 입력해주세요.');
            return;
        }

        setBaseAddrList(prev => {
            const next = [...prev];

            const applyRow = {
                ...baseAddrInput,
                COMPANY_ID: selectedCompanyId || company.COMPANY_ID,
                BIZ_NO: baseAddrInput.BIZ_NO || company.BIZ_NO,
            };

            if (selectedBaseIndex >= 0) {
                next[selectedBaseIndex] = applyRow;
            } else {
                next.push(applyRow);
            }

            return next;
        });

        await alertMessage('사용본거지 내용이 화면에 적용되었습니다.\n저장 버튼을 눌러야 최종 저장됩니다.');
    };

    const handleDeleteBaseAddr = async () => {
        if (!canEditBaseAddr) {
            await alertMessage('사용본거지 삭제 권한이 없습니다.');
            return;
        }

        if (selectedBaseIndex < 0) {
            await alertMessage('삭제할 사용본거지를 선택해주세요.');
            return;
        }

        const ok = await confirmMessage('선택된 사용본거지를 삭제하시겠습니까?\n저장 버튼을 눌러야 최종 반영됩니다.');

        if (!ok) {
            return;
        }

        setBaseAddrList(prev => prev.filter((_, index) => index !== selectedBaseIndex));
        setSelectedBaseIndex(-1);
        setBaseAddrInput(DEFAULT_BASE_ADDR_INPUT);
    };

    const makeAddrInfo = (addr) => {
        return (
            (addr.ROAD_CD ?? '') + 'þ' +
            String(addr.BUBJUNG_CD ?? '').substring(0, 8) + '00' + 'þ' +
            (addr.HJD_CD ?? '') + 'þ' +
            (addr.JIHA_YN ?? '0') + 'þ' +
            (addr.BUILDB_NO ?? '0') + 'þ' +
            (addr.BUILDS_NO ?? '0') + 'þ' +
            (addr.ADDR_DT ?? '') + 'þ'
        );
    };

    const addressTargetMap = {
        company: {
            state: setCompany,
            fields: {
                addr: 'ADDRESS',
                addrDt: 'ADDRESS_DT',
                postNo: 'POST_NO',
                bubjungCd: 'BUBJUNG_CD',
                bubjungNm: 'BUBJUNG_NM',
                hjdCd: 'HJD_CD',
                hjdNm: 'HJD_NM',
                roadCd: 'ROAD_CD',
                roadNm: 'ROAD_NM',
                addrInfo: 'ADDR_INFO',
            },
        },
        baseAddr: {
            state: setBaseAddrInput,
            fields: {
                addr: 'ADDRESS',
                addrDt: 'ADDRESS_DT',
                postNo: 'POST_NO',
                bubjungCd: 'BUBJUNG_CD',
                bubjungNm: 'BUBJUNG_NM',
                hjdCd: 'HJD_CD',
                hjdNm: 'HJD_NM',
                roadCd: 'ROAD_CD',
                roadNm: 'ROAD_NM',
                addrInfo: 'ADDR_INFO',
            },
        },
        branch: {
            state: setBranchInput,
            fields: {
                addr: 'ADDRESS',
                addrDt: 'ADDRESS_DT',
                postNo: 'POST_NO',
                bubjungCd: 'BUBJUNG_CD',
                bubjungNm: 'BUBJUNG_NM',
                hjdCd: 'HJD_CD',
                hjdNm: 'HJD_NM',
                roadCd: 'ROAD_CD',
                roadNm: 'ROAD_NM',
                addrInfo: 'ADDR_INFO',
            },
        },
        sangsa: {
            state: setSangsaInput,
            fields: {
                addr: 'ADDRESS',
                addrDt: 'ADDRESS_DT',
                postNo: 'POST_NO',
                bubjungCd: 'BUBJUNG_CD',
                bubjungNm: 'BUBJUNG_NM',
                hjdCd: 'HJD_CD',
                hjdNm: 'HJD_NM',
                roadCd: 'ROAD_CD',
                roadNm: 'ROAD_NM',
                addrInfo: 'ADDR_INFO',
            },
        },
    };

    const openAddressSearchModal = (targetKey) => {
        const target = addressTargetMap[targetKey];

        if (!target) {
            alertMessage('주소검색 대상을 찾을 수 없습니다.');
            return;
        }

        setAddressTarget(target);
        setIsAddressModalOpen(true);
    };

    const handleAddressSelect = (addr) => {
        const target = addressTarget;

        if (!target || !addr) {
            return;
        }

        const fields = target.fields || {};
        const addrInfo = makeAddrInfo(addr);

        target.state(prev => ({
            ...prev,

            ...(fields.addr && {
                [fields.addr]: addr.ADDR || '',
            }),

            ...(fields.addrDt && {
                [fields.addrDt]: addr.ADDR_DT || '',
            }),

            ...(fields.postNo && {
                [fields.postNo]: addr.POST_NO || '',
            }),

            ...(fields.bubjungCd && {
                [fields.bubjungCd]: addr.BUBJUNG_CD || '',
            }),

            ...(fields.bubjungNm && {
                [fields.bubjungNm]: addr.BUBJUNG_NM || '',
            }),

            ...(fields.hjdCd && {
                [fields.hjdCd]: addr.HJD_CD || '',
            }),

            ...(fields.hjdNm && {
                [fields.hjdNm]: addr.HJD_NM || '',
            }),

            ...(fields.roadCd && {
                [fields.roadCd]: addr.ROAD_CD || '',
            }),

            ...(fields.roadNm && {
                [fields.roadNm]: addr.ROAD_NM || '',
            }),

            ...(fields.addrInfo && {
                [fields.addrInfo]: addrInfo,
            }),
        }));

        setIsAddressModalOpen(false);
        setAddressTarget(null);
    };

    const handleCompanyAddressSearch = () => {
        openAddressSearchModal('company');
    };

    const handleBaseAddressSearch = () => {
        openAddressSearchModal('baseAddr');
    };

    const handleBranchAddressSearch = () => {
        openAddressSearchModal('branch');
    };

    const handleSangsaAddressSearch = () => {
        openAddressSearchModal('sangsa');
    };

    const validateBeforeSave = async () => {
        if (!getCurrentCompanyId()) {
            await alertMessage('회원사 ID가 없습니다.');
            return false;
        }

        if (!company.COMPANY_NM.trim()) {
            await alertMessage('회원사명을 입력해주세요.');
            return false;
        }

        if (!company.BIZ_NO.trim()) {
            await alertMessage('사업자번호를 입력해주세요.');
            return false;
        }

        return true;
    };

    const handleSaveDefault = async () => {
        if (!(await validateBeforeSave())) {
            return;
        }

        const ok = await confirmMessage('회원사정보를 저장합니다.\n\n계속하시겠습니까?', '저장');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const companyId = getCurrentCompanyId();

            const payload = {
                company: {
                    ...company,
                    COMPANY_ID: companyId,
                    INS_USER: loginId,
                },
                baseAddrList: baseAddrList.map(row => ({
                    ...row,
                    COMPANY_ID: companyId,
                    INS_USER: loginId,
                })),
                serviceList: isDacos
                    ? serviceRows.map(row => ({
                        ...row,
                        COMPANY_ID: companyId,
                        INS_USER: loginId,
                    }))
                    : null,
            };

            const response = await axios.post('/api/company/manage/save', payload);

            if (!response.data.success) {
                await alertMessage(response.data.message || '회원사정보 저장에 실패했습니다.');
                return;
            }

            await alertMessage('회원사정보를 저장했습니다.', '저장');

            await loadCompanyDetail(companyId);
        } catch (error) {
            console.error('[CompanyManage] 저장 실패:', error);
            await alertMessage(error.response?.data?.message || '회원사정보 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSpecialCompanyInfo = async () => {
        if (isSpecialBranchAdmin) {
            await alertMessage('회사정보는 읽기 전용입니다.\n지점/영업팀 정보는 각 관리 팝업에서 저장해주세요.');
            return;
        }

        if (!(await validateBeforeSave())) {
            return;
        }

        const ok = await confirmMessage('회원사 정보를 저장합니다.\n\n계속하시겠습니까?', '저장');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const companyId = getCurrentCompanyId();

            const response = await axios.post('/api/company/manage/save', {
                company: {
                    ...company,
                    COMPANY_ID: companyId,
                    INS_USER: loginId,
                },
                baseAddrList: canEditBaseAddr
                    ? baseAddrList.map(row => ({
                        ...row,
                        COMPANY_ID: companyId,
                        INS_USER: loginId,
                    }))
                    : null,
                serviceList: null,
            });

            if (!response.data.success) {
                await alertMessage(response.data.message || '회사정보 저장에 실패했습니다.');
                return;
            }

            await alertMessage('회사정보를 저장했습니다.', '저장');
            await loadCompanyDetail(companyId);
        } catch (error) {
            console.error('[CompanyManage] 특수회원사 회사정보 저장 실패:', error);
            await alertMessage(error.response?.data?.message || '회사정보 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBranch = async () => {
        const companyId = getCurrentCompanyId();

        if (!canEditBranchInfo) {
            await alertMessage('지점정보 저장 권한이 없습니다.');
            return;
        }

        if (!branchInput.BRANCH_NM.trim()) {
            await alertMessage('지점명을 입력해주세요.');
            return;
        }

        if (!branchInput.BASE_ID) {
            await alertMessage('사용본거지를 선택해주세요.');
            return;
        }

        const ok = await confirmMessage('지점정보를 저장합니다.\n\n계속하시겠습니까?', '저장');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const branchPayload = {
                ...branchInput,
                COMPANY_ID: companyId,
                INS_USER: loginId,
            };

            if (isSpecialBranchAdmin) {
                branchPayload.BRANCH_ID = loginBranchId;
            }

            const response = await axios.post('/api/company/branch/manage/save', branchPayload);

            if (!response.data.success) {
                await alertMessage(response.data.message || '지점정보 저장에 실패했습니다.');
                return;
            }

            await alertMessage('지점정보를 저장했습니다.', '저장');

            await loadBranchList(companyId);
        } catch (error) {
            console.error('[CompanyManage] 지점정보 저장 실패:', error);
            await alertMessage(error.response?.data?.message || '지점정보 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSangsa = async () => {
        const companyId = getCurrentCompanyId();

        if (!canEditSangsaInfo) {
            await alertMessage('영업팀 저장 권한이 없습니다.');
            return;
        }

        if (!sangsaInput.SANGSA_NM.trim()) {
            await alertMessage('영업팀명을 입력해주세요.');
            return;
        }

        const branchId = isSpecialBranchAdmin
            ? loginBranchId
            : branchInput.BRANCH_ID || sangsaInput.BRANCH_ID;

        if (!branchId) {
            await alertMessage('영업팀을 저장할 지점을 선택해주세요.');
            return;
        }

        const ok = await confirmMessage('영업팀 정보를 저장합니다.\n\n계속하시겠습니까?', '저장');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const hasSangsaId = !!String(sangsaInput.SANGSA_ID || '').trim();

			const sangsaPayload = {
			    COMPANY_ID: companyId,
			    BRANCH_ID: branchId,
			    SANGSA_ID: sangsaInput.SANGSA_ID,
			    SANGSA_NM: sangsaInput.SANGSA_NM,
			    TEL_NO: sangsaInput.TEL_NO,
			    USE_YN: sangsaInput.USE_YN || 'Y',
			    INS_USER: loginId,
			};
			
            const response = hasSangsaId
                ? await axios.post('/api/company/sangsa/update', sangsaPayload)
                : await axios.post('/api/company/sangsa/save', sangsaPayload);

            if (!response.data.success) {
                await alertMessage(response.data.message || '영업팀 저장에 실패했습니다.');
                return;
            }

            await alertMessage('영업팀 정보를 저장했습니다.', '저장');

            await loadSangsaList(companyId, branchId);
        } catch (error) {
            console.error('[CompanyManage] 영업팀 저장 실패:', error);
            await alertMessage(error.response?.data?.message || '영업팀 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (isSpecialCompany) {
            if (isSpecialNoAuth) {
                await alertMessage('기업관리 권한이 없습니다.');
                return;
            }

            await handleSaveSpecialCompanyInfo();
            return;
        }

        await handleSaveDefault();
    };

    const handleReload = async () => {
        const companyId = getCurrentCompanyId();

        if (!companyId) {
            await alertMessage('조회할 회원사가 없습니다.');
            return;
        }

        await loadCompanyDetail(companyId);
    };

    const handleClose = () => {
        navigate('/home');
    };

    const handleCompanyHistory = async () => {
        await alertMessage('회원사 이력 화면은 추후 연결 예정입니다.');
    };

    const handleBranchManage = async () => {
        if (!getCurrentCompanyId()) {
            await alertMessage('회원사를 선택해주세요.');
            return;
        }

        if (isSpecialCompany && isSpecialNoAuth) {
            await alertMessage('현재 권한은 지점관리를 사용할 수 없습니다.');
            return;
        }

        await loadBranchList(getCurrentCompanyId());
        setBranchPopupOpen(true);
    };

    const handleSangsaManage = async () => {
        if (!getCurrentCompanyId()) {
            await alertMessage('회원사를 선택해주세요.');
            return;
        }

        if (isSpecialCompany && isSpecialNoAuth) {
            await alertMessage('현재 권한은 영업팀관리를 사용할 수 없습니다.');
            return;
        }

        await loadBranchList(getCurrentCompanyId());

        const branchId = isSpecialBranchAdmin
            ? loginBranchId
            : branchInput.BRANCH_ID || branchList[0]?.BRANCH_ID || '';

        if (branchId) {
            await loadSangsaList(getCurrentCompanyId(), branchId);
        }

        setSangsaPopupOpen(true);
    };

    const renderCompanyBasicSection = ({ readOnly = false } = {}) => {
        const disabled = loading || saving || readOnly;

        return (
            <ErpSection title="회원사 기본정보">
                <div className="company-manage-form-grid">
                    <ErpField label="회원사명" required>
                        <input type="text" name="COMPANY_NM" value={company.COMPANY_NM} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>

                    <ErpField label="사업자번호" required>
                        <input type="text" name="BIZ_NO" value={company.BIZ_NO} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>

                    <ErpField label="법인번호">
                        <input type="text" name="COMPANY_NO" value={company.COMPANY_NO} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>

                    <ErpField label="대표자명">
                        <input type="text" name="CEO_NM" value={company.CEO_NM} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>

                    <ErpField label="전화번호">
                        <input type="text" name="TEL_NO" value={company.TEL_NO} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>

                    <ErpField label="휴대폰번호">
                        <input type="text" name="MPHONE_NO" value={company.MPHONE_NO} onChange={handleCompanyChange} disabled={disabled} />
                    </ErpField>
                </div>

                <div className="company-manage-address-row">
                    <ErpField label="주소">
                        <div className="company-manage-address-box">
                            <input type="text" name="ADDRESS" value={company.ADDRESS} onChange={handleCompanyChange} readOnly disabled={disabled} />
                            <input type="text" name="ADDRESS_DT" value={company.ADDRESS_DT} onChange={handleCompanyChange} placeholder="상세주소" disabled={disabled} />
                            <input type="text" name="POST_NO" value={company.POST_NO} onChange={handleCompanyChange} readOnly disabled={disabled} className="company-manage-post-no" />
                            <button type="button" onClick={handleCompanyAddressSearch} disabled={disabled}>주소검색</button>
                        </div>
                    </ErpField>
                </div>
            </ErpSection>
        );
    };

    const renderRefundSection = ({ readOnly = false } = {}) => (
        <ErpSection title="환불계좌 정보">
            <div className="company-manage-form-grid company-manage-refund-grid">
                <ErpField label="환불 은행명">
                    <select name="RT_BANK_CD" value={company.RT_BANK_CD} onChange={handleCompanyChange} disabled={loading || saving || readOnly}>
                        {bankOptions.map((item, index) => (
                            <option key={`${getCodeId(item)}-${index}`} value={getCodeId(item)}>
                                {getCodeName(item)}
                            </option>
                        ))}
                    </select>
                </ErpField>

                <ErpField label="환불 계좌번호">
                    <input type="text" name="RT_ACC_NO" value={company.RT_ACC_NO} onChange={handleCompanyChange} disabled={loading || saving || readOnly} />
                </ErpField>

                <ErpField label="예금주">
                    <input type="text" name="RT_ACC_NM" value={company.RT_ACC_NM} onChange={handleCompanyChange} disabled={loading || saving || readOnly} />
                </ErpField>
            </div>
        </ErpSection>
    );

    const renderBaseAddrSection = ({ readOnly = false } = {}) => (
        <ErpSection title="사용본거지">
            {!readOnly && (
                <div className="company-manage-section-actions">
                    <button type="button" onClick={handleAddBaseAddr} disabled={loading || saving}>추가</button>
                    <button type="button" onClick={handleApplyBaseAddr} disabled={loading || saving}>적용</button>
                    <button type="button" onClick={handleDeleteBaseAddr} disabled={loading || saving}>삭제</button>
                </div>
            )}

            <div className="company-manage-base-layout">
                <div className="company-manage-table-wrap">
                    <table className="company-manage-table">
                        <thead>
                            <tr>
                                <th style={{ width: '60px' }}>번호</th>
                                <th style={{ width: '160px' }}>본거지명</th>
                                <th>주소</th>
                                <th style={{ width: '180px' }}>상세주소</th>
                            </tr>
                        </thead>
                        <tbody>
                            {baseAddrList.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="company-manage-empty-cell">등록된 사용본거지가 없습니다.</td>
                                </tr>
                            ) : (
                                baseAddrList.map((item, index) => (
                                    <tr
                                        key={`${item.BASE_ID || 'NEW'}-${index}`}
                                        className={selectedBaseIndex === index ? 'selected' : ''}
                                        onClick={() => handleBaseAddrSelect(index)}
                                    >
                                        <td>{index + 1}</td>
                                        <td>{item.BASE_NM}</td>
                                        <td className="company-manage-text-left">{item.ADDRESS}</td>
                                        <td className="company-manage-text-left">{item.ADDRESS_DT}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="company-manage-base-input">
                    <div className="company-manage-base-input-row">
                        <label>본거지명</label>
                        <input ref={baseNameRef} type="text" name="BASE_NM" value={baseAddrInput.BASE_NM} onChange={handleBaseAddrChange} disabled={loading || saving || readOnly} />
                    </div>

					<div className="company-manage-base-input-row">
					    <label>주소</label>
					    <div className="company-manage-popup-address-row">
					        <input
					            type="text"
					            name="ADDRESS"
					            value={baseAddrInput.ADDRESS}
					            onChange={handleBaseAddrChange}
					            readOnly
					            disabled={loading || saving || readOnly}
					        />
					        {!readOnly && (
					            <button
					                type="button"
					                onClick={handleBaseAddressSearch}
					                disabled={loading || saving}
					            >
					                주소검색
					            </button>
					        )}
					    </div>
					</div>

                    <div className="company-manage-base-input-row">
                        <label>상세주소</label>
                        <input type="text" name="ADDRESS_DT" value={baseAddrInput.ADDRESS_DT} onChange={handleBaseAddrChange} disabled={loading || saving || readOnly} />
                    </div>

                    <div className="company-manage-base-input-row">
                        <label>우편번호</label>
                        <input type="text" name="POST_NO" value={baseAddrInput.POST_NO} onChange={handleBaseAddrChange} readOnly disabled={loading || saving || readOnly} />
                    </div>
                </div>
            </div>
        </ErpSection>
    );

    const renderServiceSection = () => {
        if (!isDacos) {
            return null;
        }

        return (
            <ErpSection title="서비스 설정">
                <div className="company-manage-table-wrap">
                    <table className="company-manage-table company-manage-service-table">
                        <thead>
                            <tr>
                                <th style={{ width: '110px' }}>업무</th>
                                <th style={{ width: '95px' }}>사용여부</th>
                                <th style={{ width: '95px' }}>납부구분</th>
                                <th style={{ width: '95px' }}>납부/면제</th>
                                <th style={{ width: '95px' }}>납부방식</th>
                                <th style={{ width: '100px' }}>수수료</th>
                                <th style={{ width: '120px' }}>공용포인트</th>
                                <th style={{ width: '120px' }}>상사포인트</th>
                                <th style={{ width: '120px' }}>관청</th>
                            </tr>
                        </thead>
                        <tbody>
                            {serviceRows.map((row, index) => (
                                <tr key={row.WORK_CD}>
                                    <td>{row.WORK_NM}</td>
                                    <td>
                                        <select value={row.PERM_GB} onChange={(e) => handleServiceChange(index, 'PERM_GB', e.target.value)} disabled={loading || saving}>
                                            {USE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={row.PAYMENT_GB} onChange={(e) => handleServiceChange(index, 'PAYMENT_GB', e.target.value)} disabled={loading || saving}>
                                            {PAYMENT_GB_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={row.PAYMENT_OP} onChange={(e) => handleServiceChange(index, 'PAYMENT_OP', e.target.value)} disabled={loading || saving}>
                                            {PAYMENT_OP_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={row.PAYMENT_TP} onChange={(e) => handleServiceChange(index, 'PAYMENT_TP', e.target.value)} disabled={loading || saving}>
                                            {PAYMENT_TP_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <input type="text" value={row.FEE} onChange={(e) => handleServiceChange(index, 'FEE', e.target.value.replace(/[^0-9]/g, ''))} disabled={loading || saving} />
                                    </td>
                                    <td>
                                        <select value={row.POINT_COMMON_USE} onChange={(e) => handleServiceChange(index, 'POINT_COMMON_USE', e.target.value)} disabled={loading || saving}>
                                            {POINT_COMMON_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select value={row.POINT_SANGSA_USE} onChange={(e) => handleServiceChange(index, 'POINT_SANGSA_USE', e.target.value)} disabled={loading || saving}>
                                            {POINT_SANGSA_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <input type="text" value={row.GOVT_ID} onChange={(e) => handleServiceChange(index, 'GOVT_ID', e.target.value)} disabled={loading || saving} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ErpSection>
        );
    };

    const renderDefaultCompanyManage = () => (
        <>
            {renderCompanyBasicSection({ readOnly: false })}
            {renderRefundSection({ readOnly: false })}
            {renderBaseAddrSection({ readOnly: false })}
            {renderServiceSection()}
        </>
    );

    const renderSpecialNoAuth = () => (
        <ErpSection title="기업관리">
            <div className="company-manage-no-auth">
                현재 권한({userAuth})은 기업관리 화면을 사용할 수 없습니다.
            </div>
        </ErpSection>
    );

    const renderSpecialCompanyManage = () => {
        if (isSpecialNoAuth) {
            return renderSpecialNoAuth();
        }

        return (
            <>
                {renderCompanyBasicSection({ readOnly: isSpecialBranchAdmin })}
                {renderRefundSection({ readOnly: isSpecialBranchAdmin })}
                {renderBaseAddrSection({ readOnly: isSpecialBranchAdmin })}
            </>
        );
    };

    const renderBranchPopup = () => {
        if (!branchPopupOpen) {
            return null;
        }

        return (
            <div className="company-manage-popup-backdrop">
                <div className="company-manage-popup company-manage-popup-large">
                    <div className="company-manage-popup-header">
                        <div>
                            <h3>지점관리</h3>
                            <p>
                                {isSpecialCompanyAdmin
                                    ? '전체 지점을 추가하거나 수정할 수 있습니다.'
                                    : '내 지점 정보만 수정할 수 있습니다.'}
                            </p>
                        </div>
                        <button type="button" onClick={() => setBranchPopupOpen(false)}>×</button>
                    </div>

                    <div className="company-manage-popup-body">
                        <div className="company-manage-popup-left">
                            <div className="company-manage-popup-list-header">
                                <strong>지점 목록</strong>
                                {isSpecialCompanyAdmin && (
                                    <button type="button" onClick={handleAddBranch}>+ 지점 추가</button>
                                )}
                            </div>

                            <div className="company-manage-table-wrap company-manage-popup-table-wrap">
                                <table className="company-manage-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '180px' }}>지점명</th>
                                            <th>주소</th>
                                            <th style={{ width: '90px' }}>사용</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branchList.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="company-manage-empty-cell">조회된 지점이 없습니다.</td>
                                            </tr>
                                        ) : (
                                            branchList.map((item, index) => (
                                                <tr
                                                    key={`${item.COMPANY_ID}-${item.BRANCH_ID}-${index}`}
                                                    className={selectedBranchIndex === index ? 'selected' : ''}
                                                    onClick={() => handleBranchSelect(index)}
                                                >
                                                    <td>{item.BRANCH_NM}</td>
                                                    <td className="company-manage-text-left">{item.ADDRESS} {item.ADDRESS_DT}</td>
                                                    <td>{item.USE_YN === 'Y' ? '사용' : '미사용'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="company-manage-popup-right">
                            <div className="company-manage-popup-form-title">지점 상세정보</div>

                            <div className="company-manage-popup-form-grid">
                                <label>지점명</label>
                                <input name="BRANCH_NM" value={branchInput.BRANCH_NM} onChange={handleBranchChange} disabled={loading || saving || !canEditBranchInfo} />

                                <label>사업자번호</label>
                                <input name="BIZ_NO" value={branchInput.BIZ_NO} onChange={handleBranchChange} disabled={loading || saving || !canEditBranchInfo} />

                                <label>전화번호</label>
                                <input name="TEL_NO" value={branchInput.TEL_NO} onChange={handleBranchChange} disabled={loading || saving || !canEditBranchInfo} />

                                <label>주소</label>
                                <div className="company-manage-popup-address-row">
                                    <input
                                        name="ADDRESS"
                                        value={branchInput.ADDRESS}
                                        onChange={handleBranchChange}
                                        readOnly
                                        disabled={loading || saving || !canEditBranchInfo}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBranchAddressSearch}
                                        disabled={loading || saving || !canEditBranchInfo}
                                    >
                                        주소검색
                                    </button>
                                </div>

                                <label>상세주소</label>
                                <input
                                    name="ADDRESS_DT"
                                    value={branchInput.ADDRESS_DT}
                                    onChange={handleBranchChange}
                                    disabled={loading || saving || !canEditBranchInfo}
                                />

                                <label>우편번호</label>
                                <input
                                    name="POST_NO"
                                    value={branchInput.POST_NO}
                                    readOnly
                                    disabled={loading || saving || !canEditBranchInfo}
                                />

                                <label>사용본거지</label>
                                <select
                                    name="BASE_ID"
                                    value={branchInput.BASE_ID || ''}
                                    onChange={handleBranchBaseChange}
                                    disabled={loading || saving || !canEditBranchInfo}
                                >
                                    <option value="">선택</option>
                                    {branchBaseList.map(item => (
                                        <option key={item.BASE_ID} value={item.BASE_ID}>
                                            {item.BASE_NM}
                                        </option>
                                    ))}
                                </select>

                                <label>본거지주소</label>
                                <input
                                    value={getSelectedBranchBase()?.ADDRESS || ''}
                                    readOnly
                                    disabled
                                />

                                <label>본거지상세</label>
                                <input
                                    value={getSelectedBranchBase()?.ADDRESS_DT || ''}
                                    readOnly
                                    disabled
                                />

                                <label>본거지우편</label>
                                <input
                                    value={getSelectedBranchBase()?.POST_NO || ''}
                                    readOnly
                                    disabled
                                />

                                <label>사용여부</label>
                                <select name="USE_YN" value={branchInput.USE_YN} onChange={handleBranchChange} disabled={loading || saving || !canEditBranchInfo}>
                                    {USE_OPTIONS.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                                </select>
                            </div>

                            <div className="company-manage-popup-form-title company-manage-branch-work-title">서비스사용선택</div>
                            <div className="company-manage-branch-work-grid">
                                {getAllowedBranchWorks().length === 0 ? (
                                    <div className="company-manage-branch-work-empty">
                                        이 회원사에 사용 가능한 서비스가 없습니다.
                                    </div>
                                ) : (
                                    getAllowedBranchWorks().map(work => (
                                        <div className="company-manage-branch-work-item" key={work.workCd}>
                                            <span>{work.label}</span>
                                            <select
                                                value={branchInput[work.field] || 'N'}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    setBranchInput(prev => ({
                                                        ...prev,
                                                        [work.field]: value,
                                                    }));
                                                }}
                                                disabled={loading || saving || !canEditBranchInfo}
                                            >
                                                <option value="Y">사용</option>
                                                <option value="N">미사용</option>
                                            </select>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="company-manage-popup-footer">
                        <button type="button" className="company-manage-btn-popup-main" onClick={handleSaveBranch} disabled={!canEditBranchInfo || saving}>저장</button>
                        <button type="button" onClick={() => setBranchPopupOpen(false)}>닫기</button>
                    </div>
                </div>
            </div>
        );
    };

	const renderSangsaPopup = () => {
	    if (!sangsaPopupOpen) {
	        return null;
	    }

	    return (
	        <div className="company-manage-popup-backdrop">
	            <div className="company-manage-popup company-manage-popup-large company-manage-sangsa-simple-popup">
	                <div className="company-manage-popup-header">
	                    <div>
	                        <h3>영업팀관리</h3>
	                        <p>
	                            {isSpecialCompanyAdmin
	                                ? '지점을 선택한 뒤 해당 지점의 팀을 관리합니다.'
	                                : '내 지점의 팀만 추가하거나 수정할 수 있습니다.'}
	                        </p>
	                    </div>
	                    <button type="button" onClick={() => setSangsaPopupOpen(false)}>×</button>
	                </div>

	                <div className="company-manage-popup-body company-manage-sangsa-simple-body">
	                    <div className="company-manage-popup-left">
	                        {isSpecialCompanyAdmin && (
	                            <div className="company-manage-popup-branch-filter">
	                                <label>지점 선택</label>
	                                <select
	                                    value={branchInput.BRANCH_ID}
	                                    onChange={async (e) => {
	                                        const branchId = e.target.value;
	                                        const index = branchList.findIndex(item => String(item.BRANCH_ID) === String(branchId));

	                                        if (index >= 0) {
	                                            await handleBranchSelect(index);
	                                        } else {
	                                            setSangsaList([]);
	                                            setSelectedSangsaIndex(-1);
	                                            setSangsaInput(DEFAULT_SANGSA_INPUT);
	                                        }
	                                    }}
	                                >
	                                    <option value="">지점 선택</option>
	                                    {branchList.map(item => (
	                                        <option key={item.BRANCH_ID} value={item.BRANCH_ID}>
	                                            {item.BRANCH_NM}
	                                        </option>
	                                    ))}
	                                </select>
	                            </div>
	                        )}

	                        <div className="company-manage-popup-list-header">
	                            <strong>영업팀 목록</strong>
	                            <button type="button" onClick={handleAddSangsa}>
	                                + 팀 추가
	                            </button>
	                        </div>

	                        <div className="company-manage-table-wrap company-manage-popup-table-wrap">
	                            <table className="company-manage-table">
	                                <thead>
	                                    <tr>
	                                        <th>팀명</th>
	                                        <th style={{ width: '170px' }}>전화번호</th>
	                                        <th style={{ width: '90px' }}>사용</th>
	                                    </tr>
	                                </thead>
	                                <tbody>
	                                    {sangsaList.length === 0 ? (
	                                        <tr>
	                                            <td colSpan="3" className="company-manage-empty-cell">
	                                                조회된 영업팀이 없습니다.
	                                            </td>
	                                        </tr>
	                                    ) : (
	                                        sangsaList.map((item, index) => (
	                                            <tr
	                                                key={`${item.COMPANY_ID}-${item.BRANCH_ID}-${item.SANGSA_ID}-${index}`}
	                                                className={selectedSangsaIndex === index ? 'selected' : ''}
	                                                onClick={() => handleSangsaSelect(index)}
	                                            >
	                                                <td>{item.SANGSA_NM}</td>
	                                                <td>{item.TEL_NO}</td>
	                                                <td>{item.USE_YN === 'Y' ? '사용' : '미사용'}</td>
	                                            </tr>
	                                        ))
	                                    )}
	                                </tbody>
	                            </table>
	                        </div>
	                    </div>

	                    <div className="company-manage-popup-right company-manage-sangsa-simple-detail">
	                        <div className="company-manage-popup-form-title">영업팀 상세정보</div>

	                        <div className="company-manage-popup-form-grid company-manage-sangsa-simple-form-grid">
	                            <label>팀명</label>
	                            <input
	                                name="SANGSA_NM"
	                                value={sangsaInput.SANGSA_NM}
	                                onChange={handleSangsaChange}
	                                disabled={loading || saving || !canEditSangsaInfo}
	                                placeholder="팀명을 입력하세요"
	                            />

	                            <label>전화번호</label>
	                            <input
	                                name="TEL_NO"
	                                value={sangsaInput.TEL_NO}
	                                onChange={handleSangsaChange}
	                                disabled={loading || saving || !canEditSangsaInfo}
	                                placeholder="예: 02-1234-5678"
	                            />

	                            <label>사용여부</label>
	                            <select
	                                name="USE_YN"
	                                value={sangsaInput.USE_YN || 'Y'}
	                                onChange={handleSangsaChange}
	                                disabled={loading || saving || !canEditSangsaInfo}
	                            >
	                                {USE_OPTIONS.map(item => (
	                                    <option key={item.code} value={item.code}>
	                                        {item.name}
	                                    </option>
	                                ))}
	                            </select>
	                        </div>
	                    </div>
	                </div>

	                <div className="company-manage-popup-footer">
	                    <button
	                        type="button"
	                        className="company-manage-btn-popup-main"
	                        onClick={handleSaveSangsa}
	                        disabled={!canEditSangsaInfo || saving}
	                    >
	                        저장
	                    </button>
	                    <button type="button" onClick={() => setSangsaPopupOpen(false)}>
	                        닫기
	                    </button>
	                </div>
	            </div>
	        </div>
	    );
	};

    return (
        <div className="company-manage-page">
            <div className="company-manage-toolbar">
                <div className="company-manage-toolbar-left">
                    <span className="company-manage-toolbar-title">기업관리</span>

                    <div className="company-manage-select-box">
                        <label>회원사</label>

                        {isAdmin ? (
                            <select value={selectedCompanyId} onChange={handleCompanySelectChange} disabled={loading || saving}>
                                <option value="">선택</option>
                                {companyOptions.map(item => (
                                    <option key={item.COMPANY_ID} value={item.COMPANY_ID}>
                                        {item.COMPANY_NM}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input type="text" value={selectedCompanyId || company.COMPANY_ID} readOnly />
                        )}
                    </div>
                </div>

                <div className="company-manage-toolbar-right">
                    <button type="button" onClick={handleCompanyHistory} disabled={loading || saving}>
                        회원사 이력
                    </button>

                    {(isSpecialCompanyAdmin || isSpecialBranchAdmin) && (
                        <>
                            <button type="button" onClick={handleBranchManage} disabled={loading || saving}>
                                지점관리
                            </button>
                            <button type="button" onClick={handleSangsaManage} disabled={loading || saving}>
                                영업팀관리
                            </button>
                        </>
                    )}

                    <button type="button" onClick={handleSave} disabled={loading || saving || (isSpecialCompany && isSpecialNoAuth)}>
                        저장[F4]
                    </button>
                    <button type="button" onClick={handleReload} disabled={loading || saving}>
                        새로고침[F5]
                    </button>
                    <button type="button" onClick={handleClose} disabled={saving}>
                        닫기[F9]
                    </button>
                </div>
            </div>

            {(loading || saving) && (
                <div className="company-manage-status">
                    {saving ? '저장 중입니다...' : '조회 중입니다...'}
                </div>
            )}

            <div className="company-manage-content">
                {isSpecialCompany ? renderSpecialCompanyManage() : renderDefaultCompanyManage()}
            </div>

            {renderBranchPopup()}
            {renderSangsaPopup()}

            <AddressSearchModal
                isOpen={isAddressModalOpen}
                onClose={() => {
                    setIsAddressModalOpen(false);
                    setAddressTarget(null);
                }}
                onSelect={handleAddressSelect}
            />
        </div>
    );
}

export default CompanyManage;