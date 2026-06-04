import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CompanyUserManage.css';

import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { useAuth } from '../../context/AuthContext';

ModuleRegistry.registerModules([AllCommunityModule]);

const MEMBER_GB_OPTIONS = [
    { code: 'T', name: '전체' },
    { code: 'A', name: '관리자' },
    { code: 'U', name: '사용자' },
];

const USE_YN_OPTIONS = [
    { code: 'A', name: '전체' },
    { code: 'W', name: '대기' },
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
    { code: 'R', name: '반려' },
];

const USE_YN_EDIT_OPTIONS = [
    { code: 'W', name: '대기' },
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
    { code: 'R', name: '반려' },
];

const LOGIN_GB_OPTIONS = [
    { code: 'C', name: '법인용' },
    { code: 'P', name: '개인용' },
    { code: 'H', name: '휴대폰' },
];

const YES_NO_OPTIONS = [
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
];

const PERM_OPTIONS = [
    { code: 'C', name: '등록' },
    { code: 'R', name: '읽기' },
];

const WORK_ITEMS = [
    {
        key: 'NEWCAR',
        title: '신규등록',
        useField: 'NEWCAR_USE',
        permField: 'NEWCAR_PERM',
        branchField: 'NEWCAR_YN',
        workCd: '010',
    },
    {
        key: 'TRNSNAME',
        title: '이전등록',
        useField: 'TRNSNAME_USE',
        permField: 'TRNSNAME_PERM',
        branchField: 'TRNSNAME_YN',
        workCd: '011',
    },
    {
        key: 'MORTREG',
        title: '저당설정',
        useField: 'MORTREG_USE',
        permField: 'MORTREG_PERM',
        branchField: 'MORTREG_YN',
        workCd: '000',
    },
    {
        key: 'MORTERS',
        title: '저당말소',
        useField: 'MORTERS_USE',
        permField: 'MORTERS_PERM',
        branchField: 'MORTERS_YN',
        workCd: '001',
    },
    {
        key: 'MODIFY',
        title: '변경등록',
        useField: 'MODIFY_USE',
        permField: 'MODIFY_PERM',
        branchField: 'MODIFY_YN',
        workCd: '030',
    },
];

const getToday = () => {
    const date = new Date();
    return date.toISOString().slice(0, 10);
};

const addDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
};

const compactDate = (value) => String(value || '').replaceAll('-', '');

const formatDate = (value) => {
    const text = String(value || '').replace(/\D/g, '');

    if (text.length !== 8) {
        return value || '';
    }

    return `${text.substring(0, 4)}-${text.substring(4, 6)}-${text.substring(6, 8)}`;
};

const formatBizNo = (value) => {
    const text = String(value || '').replace(/\D/g, '');

    if (text.length !== 10) {
        return value || '';
    }

    return `${text.substring(0, 3)}-${text.substring(3, 5)}-${text.substring(5)}`;
};

const getValue = (item, ...keys) => {
    for (const key of keys) {
        if (item && item[key] !== undefined && item[key] !== null) {
            return item[key];
        }
    }

    return '';
};

const getMemberGbName = (memberGb) => {
    const value = String(memberGb || '');

    if (!value) {
        return '';
    }

    const last = value.substring(value.length - 1);

    if (last === 'A') {
        return '관리자';
    }

    if (last === 'U' || last === 'C') {
        return '사용자';
    }

    return value;
};

const getUseYnName = (useYn) => {
    const found = USE_YN_OPTIONS.find(item => item.code === useYn);
    return found ? found.name : useYn || '';
};

const createEmptyDetail = () => ({
    LOGIN_ID: '',
    MEMBER_ID: '',
    MEMBER_NM: '',
    MEMBER_GB: '',
    USE_YN: 'W',
    TEL_NO: '',
    MPHONE_NO: '',
    LOGIN_GB: 'P',
    REGIST_NO: '',
    BIRTH_NO: '',
    SEX_NO: '',
    BIZ_NO: '',
    COMPANY_ID: '',
    ASSOCIATION_ID: '',
    BRANCH_ID: '',
    SANGSA_ID: '',
});

const createDefaultWorkPerms = () => ({
    NEWCAR_USE: 'N',
    NEWCAR_PERM: 'R',
    TRNSNAME_USE: 'N',
    TRNSNAME_PERM: 'R',
    MORTREG_USE: 'N',
    MORTREG_PERM: 'R',
    MORTERS_USE: 'N',
    MORTERS_PERM: 'R',
    MODIFY_USE: 'N',
    MODIFY_PERM: 'R',
});

const getStoredUser = () => {
    try {
        const raw = sessionStorage.getItem('user');

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.error('[CompanyUserManage] sessionStorage user 파싱 실패:', error);
        return null;
    }
};

const pickUserObject = (user) => {
    if (!user || typeof user !== 'object') {
        return {};
    }

    return (
        user.data ||
        user.user ||
        user.loginUser ||
        user.authUser ||
        user.userInfo ||
        user.member ||
        user.result ||
        user
    );
};

function CompanyUserManage() {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const { user } = useAuth();

    const [searchForm, setSearchForm] = useState({
        COMPANY_ID: '',
        BRANCH_ID: '',
        MEMBER_NM: '',
        ST_DATE: addDays(-3000),
        ED_DATE: getToday(),
        USE_YN: 'A',
        MEMBER_GB: 'T',
    });

    const [companyOptions, setCompanyOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([
        { CODE_CD: '', CODE_NM: '전체' },
    ]);

    const [userList, setUserList] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [detail, setDetail] = useState(createEmptyDetail());
    const [workPerms, setWorkPerms] = useState(createDefaultWorkPerms());
    const [branchWorkInfo, setBranchWorkInfo] = useState({});

    const selectedUser = selectedIndex >= 0 ? userList[selectedIndex] : null;

    const selectedLoginGb = detail.LOGIN_GB || 'P';
    const isCorporateLogin = selectedLoginGb === 'C';

	const getLoginInfo = () => {
	    const contextUser = pickUserObject(user);
	    const storageUser = pickUserObject(getStoredUser());

	    const source = contextUser && Object.keys(contextUser).length > 0
	        ? contextUser
	        : storageUser;

	    return {
	        LOGIN_ID:
	            source.LOGIN_ID ||
	            source.LoginID ||
	            source.loginId ||
	            source.login_ID ||
	            source.login_id ||
	            source.userId ||
	            source.USER_ID ||
	            source.MEMBER_ID ||
	            source.memberId ||
	            source.member_ID ||
	            '',

	        COMPANY_ID:
	            source.COMPANY_ID ||
	            source.CompanyID ||
	            source.companyId ||
	            source.company_ID ||
	            source.company_id ||
	            source.COMPANYID ||
	            source.COMPANY_CD ||
	            source.companyCd ||
	            source.company_CD ||
	            '',

	        USER_AUTH:
	            source.UserAuth ||
	            source.USER_AUTH ||
	            source.userAuth ||
	            source.user_AUTH ||
	            source.user_auth ||
	            source.MEMBER_GB ||
	            source.memberGb ||
	            source.member_GB ||
	            source.member_gb ||
	            source.AUTH_CD ||
	            source.authCd ||
	            source.auth_CD ||
	            '',

	        MEMBER_GB:
	            source.MEMBER_GB ||
	            source.memberGb ||
	            source.member_GB ||
	            source.member_gb ||
	            source.UserAuth ||
	            source.USER_AUTH ||
	            source.userAuth ||
	            source.user_AUTH ||
	            '',

	        LOGIN_GB:
	            source.LOGIN_GB ||
	            source.loginGb ||
	            source.login_GB ||
	            source.login_gb ||
	            '',

	        BRANCH_ID:
	            source.BRANCH_ID ||
	            source.BranchID ||
	            source.branchId ||
	            source.branch_ID ||
	            source.branch_id ||
	            '',

	        SANGSA_ID:
	            source.SANGSA_ID ||
	            source.SangsaID ||
	            source.sangsaId ||
	            source.sangsa_ID ||
	            source.sangsa_id ||
	            '',

	        ASSOCIATION_ID:
	            source.ASSOCIATION_ID ||
	            source.associationId ||
	            source.association_ID ||
	            source.association_id ||
	            '',
	    };
	};

    const isCompanyAdmin = () => {
        const loginInfo = getLoginInfo();
        const userAuth = String(loginInfo.USER_AUTH || '').toUpperCase();

        return userAuth === 'UA' || userAuth === 'UU';
    };

    const canSelectCompany = isCompanyAdmin();

    const getLoginId = () => {
        const loginInfo = getLoginInfo();
        return loginInfo.LOGIN_ID || 'WEB';
    };

    const resetPageState = () => {
        setCompanyOptions([]);
        setBranchOptions([{ CODE_CD: '', CODE_NM: '전체' }]);
        setUserList([]);
        setSelectedIndex(-1);
        setDetail(createEmptyDetail());
        setWorkPerms(createDefaultWorkPerms());
        setBranchWorkInfo({});
        setSearchForm({
            COMPANY_ID: '',
            BRANCH_ID: '',
            MEMBER_NM: '',
            ST_DATE: addDays(-3000),
            ED_DATE: getToday(),
            USE_YN: 'A',
            MEMBER_GB: 'T',
        });
    };

    const selectedMemberRole = useMemo(() => {
        const memberGb = detail.MEMBER_GB || '';
        const last = memberGb.substring(memberGb.length - 1);

        if (last === 'A') {
            return 'A';
        }

        if (last === 'U' || last === 'C') {
            return 'U';
        }

        return 'U';
    }, [detail.MEMBER_GB]);

    const memberColumnDefs = useMemo(() => [
        {
            headerName: '순번',
            valueGetter: 'node.rowIndex + 1',
            width: 70,
            minWidth: 70,
            maxWidth: 80,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
        },
        {
            headerName: '소속',
            field: 'CBS_NM',
            flex: 1.8,
            minWidth: 220,
        },
        {
            headerName: '업무권한',
            field: 'MEMBER_GB',
            flex: 0.8,
            minWidth: 95,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
            valueFormatter: params => getMemberGbName(params.value),
        },
        {
            headerName: '회원 ID',
            field: 'LOGIN_ID',
            flex: 1,
            minWidth: 120,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
        },
        {
            headerName: '회원명',
            field: 'MEMBER_NM',
            flex: 1,
            minWidth: 110,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
        },
        {
            headerName: '전화번호',
            field: 'TEL_NO',
            flex: 1.1,
            minWidth: 135,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
        },
        {
            headerName: '휴대폰번호',
            field: 'MPHONE_NO',
            flex: 1.2,
            minWidth: 145,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
        },
        {
            headerName: '사용여부',
            field: 'USE_YN',
            flex: 0.8,
            minWidth: 100,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
            cellRenderer: params => {
                const value = params.value || '';
                const name = getUseYnName(value);

                return (
                    <span className={`cum-ag-status status-${value}`}>
                        {name}
                    </span>
                );
            },
        },
        {
            headerName: '신청일자',
            field: 'INS_DATE',
            flex: 1,
            minWidth: 115,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
            valueFormatter: params => formatDate(params.value),
        },
        {
            headerName: '승인일자',
            field: 'CONFIRM_DT',
            flex: 1,
            minWidth: 115,
            cellClass: 'cum-ag-center',
            headerClass: 'cum-ag-center',
            valueFormatter: params => formatDate(params.value),
        },
    ], []);

    const loadBranchOptions = async (selectedCompanyId) => {
        const loginInfo = getLoginInfo();
        const companyId = isCompanyAdmin()
            ? selectedCompanyId
            : loginInfo.COMPANY_ID;

        if (!companyId) {
            setBranchOptions([{ CODE_CD: '', CODE_NM: '전체' }]);
            return;
        }

        try {
            const response = await axios.post('/api/company/branch-list', {
                COMPANY_ID: companyId,
            });

            const list = response.data.list || response.data.data || [];

            setBranchOptions([
                { CODE_CD: '', CODE_NM: '전체' },
                ...list,
            ]);
        } catch (error) {
            console.error('지점 목록 조회 실패:', error);
            setBranchOptions([{ CODE_CD: '', CODE_NM: '전체' }]);
        }
    };

    const loadCompanyOptions = async () => {
        const loginInfo = getLoginInfo();
        const isAdmin = isCompanyAdmin();

        if (!loginInfo.COMPANY_ID) {
            console.error('[CompanyUserManage] COMPANY_ID 없음:', {
                authUser: user,
                sessionUser: getStoredUser(),
                loginInfo,
            });
            alert('로그인 회원사 정보를 확인할 수 없습니다.');
            return null;
        }

        try {
            const param = isAdmin
                ? { USE_YN: 'Y' }
                : { USE_YN: 'Y', COMPANY_ID: loginInfo.COMPANY_ID };

            const response = await axios.post('/api/company/list', param);
            const list = response.data.list || response.data.data || [];

            let companies = list.map(item => ({
                COMPANY_ID: getValue(item, 'COMPANY_ID', 'companyId', 'COMPANY_CD'),
                COMPANY_NM: getValue(item, 'COMPANY_NM', 'companyNm', 'COMPANY_NAME'),
            })).filter(item => item.COMPANY_ID);

            if (!isAdmin) {
                companies = companies.filter(item =>
                    String(item.COMPANY_ID).toLowerCase() ===
                    String(loginInfo.COMPANY_ID).toLowerCase()
                );

                if (companies.length === 0) {
                    companies = [
                        {
                            COMPANY_ID: loginInfo.COMPANY_ID,
                            COMPANY_NM: loginInfo.COMPANY_ID,
                        },
                    ];
                }
            }

            if (isAdmin) {
                const existsLoginCompany = companies.some(item =>
                    String(item.COMPANY_ID).toLowerCase() ===
                    String(loginInfo.COMPANY_ID).toLowerCase()
                );

                if (!existsLoginCompany) {
                    companies = [
                        {
                            COMPANY_ID: loginInfo.COMPANY_ID,
                            COMPANY_NM: loginInfo.COMPANY_ID,
                        },
                        ...companies,
                    ];
                }
            }

            const defaultCompanyId = loginInfo.COMPANY_ID;

            const nextSearchForm = {
                COMPANY_ID: defaultCompanyId,
                BRANCH_ID: '',
                MEMBER_NM: '',
                ST_DATE: addDays(-3000),
                ED_DATE: getToday(),
                USE_YN: 'A',
                MEMBER_GB: 'T',
            };

            setCompanyOptions(companies);
            setSearchForm(nextSearchForm);

            await loadBranchOptions(defaultCompanyId);

            return nextSearchForm;
        } catch (error) {
            console.error('회원사 목록 조회 실패:', error);

            const nextSearchForm = {
                COMPANY_ID: loginInfo.COMPANY_ID,
                BRANCH_ID: '',
                MEMBER_NM: '',
                ST_DATE: addDays(-3000),
                ED_DATE: getToday(),
                USE_YN: 'A',
                MEMBER_GB: 'T',
            };

            setCompanyOptions([
                {
                    COMPANY_ID: loginInfo.COMPANY_ID,
                    COMPANY_NM: loginInfo.COMPANY_ID,
                },
            ]);
            setSearchForm(nextSearchForm);

            await loadBranchOptions(loginInfo.COMPANY_ID);

            return nextSearchForm;
        }
    };

    const makeSearchPayload = (override = {}) => {
        const loginInfo = getLoginInfo();
        const isAdmin = isCompanyAdmin();

        const merged = {
            ...searchForm,
            ...override,
        };

        const companyId = isAdmin
            ? merged.COMPANY_ID
            : loginInfo.COMPANY_ID;

        if (!companyId) {
            console.error('[CompanyUserManage] 조회 COMPANY_ID 없음:', {
                loginInfo,
                searchForm,
                override,
                authUser: user,
                sessionUser: getStoredUser(),
            });
            alert('로그인 회원사 정보를 확인할 수 없습니다.');
            return null;
        }

        const payload = {
            COMPANY_ID: companyId,
            BRANCH_ID: merged.BRANCH_ID,
            MEMBER_NM: String(merged.MEMBER_NM || '').trim(),
            USE_YN: merged.USE_YN,
            MEMBER_GB: merged.MEMBER_GB,
            ST_DATE: compactDate(merged.ST_DATE),
            ED_DATE: compactDate(merged.ED_DATE),
        };

        if (payload.MEMBER_NM) {
            payload.ST_DATE = '20170101';
        }

        return payload;
    };

    const loadUserWork = async (targetUser) => {
        const defaultPerms = createDefaultWorkPerms();

        if (!targetUser.COMPANY_ID || !targetUser.MEMBER_ID) {
            setWorkPerms(defaultPerms);
            setBranchWorkInfo({});
            return;
        }

        try {
            const [workRes, branchWorkRes] = await Promise.all([
                axios.post('/api/company/user/work', {
                    COMPANY_ID: targetUser.COMPANY_ID,
                    MEMBER_ID: targetUser.MEMBER_ID,
                }),
                axios.post('/api/company/user/branch-work', {
                    COMPANY_ID: targetUser.COMPANY_ID,
                    BRANCH_ID: targetUser.BRANCH_ID,
                }),
            ]);

            const workList = workRes.data.list || [];
            const nextPerms = { ...defaultPerms };

            workList.forEach(item => {
                const workCd = getValue(item, 'WORK_CD', 'workCd');
                const useYn = getValue(item, 'USE_YN', 'useYn') || 'N';
                const permGb = getValue(item, 'PERM_GB', 'permGb') || 'R';

                const target = WORK_ITEMS.find(work => work.workCd === workCd);

                if (target) {
                    nextPerms[target.useField] = useYn;
                    nextPerms[target.permField] = permGb;
                }
            });

            setWorkPerms(nextPerms);
            setBranchWorkInfo(branchWorkRes.data.data || {});
        } catch (error) {
            console.error('회원 업무권한 조회 실패:', error);
            setWorkPerms(defaultPerms);
            setBranchWorkInfo({});
            alert(error.response?.data?.message || '회원 업무권한 조회 중 오류가 발생했습니다.');
        }
    };

    const selectUser = async (userRow, index) => {
        const registNo = String(getValue(userRow, 'REGIST_NO', 'registNo') || '').replace(/\D/g, '');
        const loginGb = getValue(userRow, 'LOGIN_GB', 'loginGb') || 'P';

        const nextDetail = {
            LOGIN_ID: getValue(userRow, 'LOGIN_ID', 'loginId'),
            MEMBER_ID: getValue(userRow, 'MEMBER_ID', 'memberId'),
            MEMBER_NM: getValue(userRow, 'MEMBER_NM', 'memberNm'),
            MEMBER_GB: getValue(userRow, 'MEMBER_GB', 'memberGb'),
            USE_YN: getValue(userRow, 'USE_YN', 'useYn') || 'W',
            TEL_NO: getValue(userRow, 'TEL_NO', 'telNo'),
            MPHONE_NO: getValue(userRow, 'MPHONE_NO', 'mphoneNo'),
            LOGIN_GB: loginGb,
            REGIST_NO: registNo,
            BIRTH_NO: loginGb === 'C' ? '' : registNo.substring(0, 6),
            SEX_NO: loginGb === 'C' ? '' : registNo.substring(6, 7),
            BIZ_NO: loginGb === 'C' ? registNo : '',
            COMPANY_ID: getValue(userRow, 'COMPANY_ID', 'companyId'),
            ASSOCIATION_ID: getValue(userRow, 'ASSOCIATION_ID', 'associationId'),
            BRANCH_ID: getValue(userRow, 'BRANCH_ID', 'branchId'),
            SANGSA_ID: getValue(userRow, 'SANGSA_ID', 'sangsaId'),
        };

        setSelectedIndex(index);
        setDetail(nextDetail);

        await loadUserWork(nextDetail);
    };

    const handleSearch = async (override = {}) => {
        const payload = makeSearchPayload(override);

        if (!payload) {
            return;
        }

        try {
            const response = await axios.post('/api/company/user/list', payload);
            const list = response.data.list || response.data.data || [];

            const normalized = list.map(item => {
                const branchNm = getValue(item, 'BRANCH_NM', 'branchNm');
                const sangsaNm = getValue(item, 'SANGSA_NM', 'sangsaNm');

                return {
                    ...item,
                    CBS_NM: sangsaNm ? `${branchNm}(${sangsaNm})` : branchNm,
                };
            });

            setUserList(normalized);
            setSelectedIndex(-1);
            setDetail(createEmptyDetail());
            setWorkPerms(createDefaultWorkPerms());
            setBranchWorkInfo({});

            if (normalized.length > 0) {
                await selectUser(normalized[0], 0);
            }
        } catch (error) {
            console.error('회원 목록 조회 실패:', error);
            alert(error.response?.data?.message || '회원 목록 조회 중 오류가 발생했습니다.');
        }
    };

    useEffect(() => {
        const init = async () => {
            if (!user && !getStoredUser()) {
                resetPageState();
                return;
            }

            setUserList([]);
            setSelectedIndex(-1);
            setDetail(createEmptyDetail());
            setWorkPerms(createDefaultWorkPerms());
            setBranchWorkInfo({});

            const nextSearchForm = await loadCompanyOptions();

            if (nextSearchForm) {
                await handleSearch(nextSearchForm);
            }
        };

        init();

        // 로그인 사용자 변경 때만 초기화
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleSearchChange = async (e) => {
        const { name, value } = e.target;

        if (name === 'COMPANY_ID' && !isCompanyAdmin()) {
            return;
        }

        if (name === 'COMPANY_ID') {
            const nextForm = {
                ...searchForm,
                COMPANY_ID: value,
                BRANCH_ID: '',
            };

            setSearchForm(nextForm);
            await loadBranchOptions(value);
            return;
        }

        setSearchForm(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleDetailChange = (e) => {
        const { name, value } = e.target;

        setDetail(prev => {
            const next = {
                ...prev,
                [name]: value,
            };

            if (name === 'LOGIN_GB') {
                if (value === 'C') {
                    next.BIRTH_NO = '';
                    next.SEX_NO = '';
                    next.BIZ_NO = prev.REGIST_NO || '';
                } else {
                    const registNo = String(prev.REGIST_NO || '').replace(/\D/g, '');
                    next.BIRTH_NO = registNo.substring(0, 6);
                    next.SEX_NO = registNo.substring(6, 7);
                    next.BIZ_NO = '';
                }
            }

            return next;
        });
    };

    const isWorkAvailable = (item) => {
        if (!selectedUser) {
            return false;
        }

        const branchUseYn = getValue(branchWorkInfo, 'USE_YN', 'useYn');

        if (branchUseYn && branchUseYn !== 'Y') {
            return false;
        }

        const value = getValue(branchWorkInfo, item.branchField, item.branchField.toLowerCase());

        if (!value) {
            return true;
        }

        return value === 'Y';
    };

    const handleWorkChange = (field, value) => {
        setWorkPerms(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleReload = async () => {
        setUserList([]);
        setSelectedIndex(-1);
        setDetail(createEmptyDetail());
        setWorkPerms(createDefaultWorkPerms());
        setBranchWorkInfo({});

        const nextSearchForm = await loadCompanyOptions();

        if (nextSearchForm) {
            await handleSearch(nextSearchForm);
        }
    };

    const buildSavePayload = (pwdResetYn = 'N') => {
        let registNo = '';

        if (detail.LOGIN_GB === 'C') {
            const bizNo = String(detail.BIZ_NO || '').replace(/\D/g, '');

            if (bizNo.length < 10) {
                alert('법인용 등록번호는 사업자번호 10자리 이상이어야 합니다.');
                return null;
            }

            registNo = bizNo;
        } else {
            const birthNo = String(detail.BIRTH_NO || '').replace(/\D/g, '');
            const sexNo = String(detail.SEX_NO || '').replace(/\D/g, '');

            if (`${birthNo}${sexNo}`.length < 7) {
                alert('개인용/휴대폰 등록번호는 최소 7자리입니다.');
                return null;
            }

            registNo = `${birthNo}${sexNo}`;
        }

        const memberPrefix = String(detail.MEMBER_GB || '').substring(0, 1);
        const nextMemberGb = `${memberPrefix}${selectedMemberRole}`;
        const loginId = getLoginId();

        return {
            memberInfo: {
                LOGIN_ID: detail.LOGIN_ID,
                LOGIN_GB: detail.LOGIN_GB,
                REGIST_NO: registNo,

                ASSOCIATION_ID: detail.ASSOCIATION_ID,
                COMPANY_ID: detail.COMPANY_ID,
                BRANCH_ID: detail.BRANCH_ID,
                SANGSA_ID: detail.SANGSA_ID || '',
                MEMBER_ID: detail.MEMBER_ID,
                MEMBER_GB: nextMemberGb,
                MEMBER_NM: detail.MEMBER_NM,
                TEL_NO: detail.TEL_NO,
                MPHONE_NO: detail.MPHONE_NO,
                USE_YN: detail.USE_YN,
                INS_USER: loginId,
                PWD_RESET_YN: pwdResetYn,
            },
            workInfo: {
                ...workPerms,
            },
        };
    };

    const handlePasswordReset = async () => {
        if (!selectedUser) {
            alert('패스워드를 초기화할 회원을 선택해주세요.');
            return;
        }

        const confirmReset = window.confirm(
            `선택한 회원 [${detail.LOGIN_ID}]의 패스워드가 'a1234567'로 초기화됩니다.\n\n계속하시겠습니까?`
        );

        if (!confirmReset) {
            return;
        }

        try {
            const loginId = getLoginId();

            await axios.post('/api/company/user/password-reset', {
                LOGIN_ID: detail.LOGIN_ID,
                UPD_USER: loginId,
            });

            const savePayload = buildSavePayload('Y');

            if (!savePayload) {
                return;
            }

            await axios.post('/api/company/user/update', savePayload);

            alert("패스워드가 'a1234567'로 초기화되었습니다.");
            await handleSearch();
        } catch (error) {
            console.error('패스워드 초기화 실패:', error);
            alert(error.response?.data?.message || '패스워드 초기화 중 오류가 발생했습니다.');
        }
    };

    const handleSave = async () => {
        if (!selectedUser) {
            alert('저장할 회원을 선택해주세요.');
            return;
        }

        if (!detail.LOGIN_ID) {
            alert('사용자 ID가 없습니다.');
            return;
        }

        if (!detail.MEMBER_NM) {
            alert('성명이 없습니다.');
            return;
        }

        const confirmSave = window.confirm('회원 권한정보를 저장하시겠습니까?');

        if (!confirmSave) {
            return;
        }

        const payload = buildSavePayload('N');

        if (!payload) {
            return;
        }

        try {
            await axios.post('/api/company/user/update', payload);

            alert('회원의 권한정보를 수정하였습니다.');
            await handleSearch();
        } catch (error) {
            console.error('회원 권한정보 저장 실패:', error);
            alert(error.response?.data?.message || '회원 권한정보 저장 중 오류가 발생했습니다.');
        }
    };

    const renderRadioGroup = ({ name, value, options, onChange, disabled = false }) => {
        return (
            <div className="cum-radio-group">
                {options.map(option => (
                    <label key={option.code}>
                        <input
                            type="radio"
                            name={name}
                            value={option.code}
                            checked={value === option.code}
                            onChange={onChange}
                            disabled={disabled}
                        />
                        <span>{option.name}</span>
                    </label>
                ))}
            </div>
        );
    };

    return (
        <div className="cum-page">
            <div className="cum-card">
                <div className="cum-header">
                    <h3>
                        <span className="cum-square-icon"></span>
                        회원관리
                    </h3>

                    <div className="cum-header-actions">
                        <button type="button" onClick={() => handleSearch()}>조회[F2]</button>
                        <button type="button" onClick={handleSave}>저장[F4]</button>
                        <button type="button" onClick={handleReload}>초기화[F8]</button>
                        <button type="button" onClick={() => navigate(-1)}>닫기[F9]</button>
                    </div>
                </div>

                <div className="cum-body">
                    <section className="cum-search-section">
                        <div className="cum-search-grid">
                            <div className="cum-field">
                                <label>회원사</label>
                                <select
                                    name="COMPANY_ID"
                                    value={searchForm.COMPANY_ID}
                                    onChange={handleSearchChange}
                                    disabled={!canSelectCompany}
                                    title={!canSelectCompany ? '일반 회원사는 자기 회원사만 조회 가능합니다.' : ''}
                                >
                                    {companyOptions.map(item => (
                                        <option key={item.COMPANY_ID} value={item.COMPANY_ID}>
                                            {item.COMPANY_NM}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="cum-field">
                                <label>지점</label>
                                <select
                                    name="BRANCH_ID"
                                    value={searchForm.BRANCH_ID}
                                    onChange={handleSearchChange}
                                >
                                    {(branchOptions.length > 0 ? branchOptions : [{ CODE_CD: '', CODE_NM: '전체' }]).map(item => (
                                        <option
                                            key={getValue(item, 'CODE_CD', 'codeCd')}
                                            value={getValue(item, 'CODE_CD', 'codeCd')}
                                        >
                                            {getValue(item, 'CODE_NM', 'codeNm')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="cum-field">
                                <label>회원명</label>
                                <input
                                    name="MEMBER_NM"
                                    value={searchForm.MEMBER_NM}
                                    onChange={handleSearchChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch();
                                        }
                                    }}
                                />
                            </div>

                            <div className="cum-field cum-date-field">
                                <label>신청일자</label>
                                <div className="cum-date-range">
                                    <input
                                        type="date"
                                        name="ST_DATE"
                                        value={searchForm.ST_DATE}
                                        onChange={handleSearchChange}
                                    />
                                    <span>~</span>
                                    <input
                                        type="date"
                                        name="ED_DATE"
                                        value={searchForm.ED_DATE}
                                        onChange={handleSearchChange}
                                    />
                                </div>
                            </div>

                            <div className="cum-field cum-wide">
                                <label>사용여부</label>
                                {renderRadioGroup({
                                    name: 'searchUseYn',
                                    value: searchForm.USE_YN,
                                    options: USE_YN_OPTIONS,
                                    onChange: (e) => setSearchForm(prev => ({ ...prev, USE_YN: e.target.value })),
                                })}
                            </div>

                            <div className="cum-field cum-wide">
                                <label>업무권한</label>
                                {renderRadioGroup({
                                    name: 'searchMemberGb',
                                    value: searchForm.MEMBER_GB,
                                    options: MEMBER_GB_OPTIONS,
                                    onChange: (e) => setSearchForm(prev => ({ ...prev, MEMBER_GB: e.target.value })),
                                })}
                            </div>
                        </div>
                    </section>

                    <section className="cum-section">
                        <div className="cum-section-title">
                            <span></span>
                            회원 리스트
                            <em>{userList.length}건</em>
                        </div>

                        <div className="cum-ag-grid-wrap ag-theme-alpine">
						<AgGridReact
						    ref={gridRef}
						    rowData={userList}
						    columnDefs={memberColumnDefs}
						    defaultColDef={{
						        sortable: true,
						        resizable: true,
						        suppressMovable: true,
						    }}
						    rowSelection="single"
						    suppressRowClickSelection={true}
						    onRowClicked={async (event) => {
						        if (!event.data) {
						            return;
						        }

						        await selectUser(event.data, event.rowIndex);
						    }}
						    overlayNoRowsTemplate="<span class='cum-ag-empty'>조회된 회원이 없습니다.</span>"
						/>
                        </div>
                    </section>

                    <section className="cum-section">
                        <div className="cum-section-title">
                            <span></span>
                            회원 기본정보
                        </div>

                        <div className="cum-form-table">
                            <div className="cum-form-row">
                                <div className="cum-form-field">
                                    <label>* 사용자 ID</label>
                                    <input value={detail.LOGIN_ID} readOnly />
                                </div>

                                <div className="cum-form-field">
                                    <label>업무 권한</label>
                                    {renderRadioGroup({
                                        name: 'detailMemberGb',
                                        value: selectedMemberRole,
                                        options: MEMBER_GB_OPTIONS.filter(item => item.code !== 'T'),
                                        onChange: (e) => {
                                            const prefix = String(detail.MEMBER_GB || '').substring(0, 1);
                                            setDetail(prev => ({
                                                ...prev,
                                                MEMBER_GB: `${prefix}${e.target.value}`,
                                            }));
                                        },
                                        disabled: !selectedUser || detail.MEMBER_GB === 'SU',
                                    })}
                                </div>

                                <div className="cum-form-field">
                                    <label>사용 여부</label>
                                    {renderRadioGroup({
                                        name: 'detailUseYn',
                                        value: detail.USE_YN,
                                        options: USE_YN_EDIT_OPTIONS,
                                        onChange: (e) => setDetail(prev => ({ ...prev, USE_YN: e.target.value })),
                                        disabled: !selectedUser,
                                    })}
                                </div>
                            </div>

                            <div className="cum-form-row">
                                <div className="cum-form-field">
                                    <label>성명</label>
                                    <input value={detail.MEMBER_NM} readOnly />
                                </div>

                                <div className="cum-form-field">
                                    <label>* 전화번호</label>
                                    <input value={detail.TEL_NO} readOnly />
                                </div>

                                <div className="cum-form-field">
                                    <label>핸드폰번호</label>
                                    <input value={detail.MPHONE_NO} readOnly />
                                </div>
                            </div>

                            <div className="cum-form-row">
                                <div className="cum-form-field login-gb-field">
                                    <label>인증 구분</label>
                                    {renderRadioGroup({
                                        name: 'detailLoginGb',
                                        value: detail.LOGIN_GB,
                                        options: LOGIN_GB_OPTIONS,
                                        onChange: handleDetailChange,
                                        disabled: !selectedUser,
                                    })}
                                </div>

                                <div className="cum-form-field regist-field">
                                    <label>* 로그인 등록번호</label>
                                    {isCorporateLogin ? (
                                        <input
                                            name="BIZ_NO"
                                            value={formatBizNo(detail.BIZ_NO)}
                                            onChange={(e) => {
                                                const onlyNumber = e.target.value.replace(/\D/g, '');

                                                setDetail(prev => ({
                                                    ...prev,
                                                    BIZ_NO: onlyNumber,
                                                    REGIST_NO: onlyNumber,
                                                }));
                                            }}
                                            disabled={!selectedUser}
                                            maxLength={12}
                                        />
                                    ) : (
                                        <div className="cum-regist-row">
                                            <input
                                                name="BIRTH_NO"
                                                value={detail.BIRTH_NO}
                                                onChange={handleDetailChange}
                                                disabled={!selectedUser}
                                                maxLength={6}
                                            />
                                            <span>-</span>
                                            <input
                                                name="SEX_NO"
                                                value={detail.SEX_NO}
                                                onChange={handleDetailChange}
                                                disabled={!selectedUser}
                                                maxLength={1}
                                            />
                                            <em>******</em>
                                        </div>
                                    )}
                                </div>

                                <div className="cum-guide-text">
                                    법인용(사업자번호), 개인용/휴대폰(주민번호 7자리)
                                </div>
                            </div>

                            <div className="cum-password-row">
                                <button type="button" onClick={handlePasswordReset} disabled={!selectedUser}>
                                    패스워드 초기화
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="cum-section">
                        <div className="cum-section-title">
                            <span></span>
                            회원 권한정보
                        </div>

                        <div className="cum-work-grid">
                            {WORK_ITEMS.map(item => {
                                const available = isWorkAvailable(item);

                                return (
                                    <div className={`cum-work-card ${!available ? 'disabled' : ''}`} key={item.key}>
                                        <div className="cum-work-title">{item.title}</div>

                                        <div className="cum-work-line">
                                            <label>사용</label>
                                            {renderRadioGroup({
                                                name: `${item.key}_USE`,
                                                value: workPerms[item.useField],
                                                options: YES_NO_OPTIONS,
                                                onChange: (e) => handleWorkChange(item.useField, e.target.value),
                                                disabled: !selectedUser || !available,
                                            })}
                                        </div>

                                        <div className="cum-work-line">
                                            <label>권한</label>
                                            {renderRadioGroup({
                                                name: `${item.key}_PERM`,
                                                value: workPerms[item.permField],
                                                options: PERM_OPTIONS,
                                                onChange: (e) => handleWorkChange(item.permField, e.target.value),
                                                disabled: !selectedUser || !available || workPerms[item.useField] === 'N',
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default CompanyUserManage;