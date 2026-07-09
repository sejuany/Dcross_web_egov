import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    RefreshCw,
    Save,
    RotateCcw,
    UsersRound,
    ShieldCheck,
} from 'lucide-react';

import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { useAuth } from '../../../context/AuthContext';
import { gf } from '../../../utils/utils';
import './WaCompanyUserManage.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const WA_MEMBER_GB_OPTIONS = [
    { code: 'T', name: '전체' },
    { code: 'CA', name: 'Admin' },
    { code: 'BA', name: 'Super sp' },
    { code: 'SU', name: 'sp' },
];

const WA_MEMBER_GB_EDIT_OPTIONS = [
    { code: 'CA', name: 'Admin' },
    { code: 'BA', name: 'Super sp' },
    { code: 'SU', name: 'sp' },
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

const getStoredUser = () => {
    try {
        const raw = sessionStorage.getItem('user');

        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.error('[WaCompanyUserManage] sessionStorage user 파싱 실패:', error);
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

const getUseYnName = (useYn) => {
    const value = String(useYn || '').toUpperCase();

    if (value === 'A') return '전체';
    if (value === 'W') return '대기';
    if (value === 'Y') return '사용';
    if (value === 'N') return '미사용';
    if (value === 'R') return '반려';

    return '';
};

const getWaMemberGbName = (memberGb) => {
    const value = String(memberGb || '').toUpperCase();

    if (value === 'CA') return 'Admin';
    if (value === 'BA') return 'Super sp';
    if (value === 'SU') return 'sp';

    return value;
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
    MEMBER_MAIL: '',
});

const createDefaultWorkPerms = () => ({
    NEWCAR_USE: 'N',
    NEWCAR_PERM: 'R',

    // WA 화면에서는 신규등록만 보여준다.
    // 다만 기존 /api/company/user/update 저장 구조 호환을 위해 나머지 서비스는 기본값으로 같이 보낸다.
    TRNSNAME_USE: 'N',
    TRNSNAME_PERM: 'R',
    MORTREG_USE: 'N',
    MORTREG_PERM: 'R',
    MORTERS_USE: 'N',
    MORTERS_PERM: 'R',
    MODIFY_USE: 'N',
    MODIFY_PERM: 'R',
});

function WaCompanyUserManage() {
    const gridRef = useRef(null);
    const { user } = useAuth();

    const [topbarHeight, setTopbarHeight] = useState(48);

    const [searchForm, setSearchForm] = useState({
        BRANCH_ID: '',
        MEMBER_NM: '',
        ST_DATE: addDays(-3000),
        ED_DATE: getToday(),
        USE_YN: 'A',
        MEMBER_GB: 'T',
    });

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

    const getLoginInfo = useCallback(() => {
        const contextUser = pickUserObject(user);
        const storageUser = pickUserObject(getStoredUser());

        const source = contextUser && Object.keys(contextUser).length > 0
            ? contextUser
            : storageUser;

        return {
            LOGIN_ID:
                source.LOGIN_ID ||
                source.loginId ||
                source.login_ID ||
                source.userId ||
                source.USER_ID ||
                source.MEMBER_ID ||
                source.memberId ||
                '',

            COMPANY_ID:
                source.COMPANY_ID ||
                source.companyId ||
                source.company_ID ||
                source.company_id ||
                source.COMPANYID ||
                source.COMPANY_CD ||
                '',

            MEMBER_GB:
                source.MEMBER_GB ||
                source.memberGb ||
                source.member_GB ||
                source.member_gb ||
                source.UserAuth ||
                source.USER_AUTH ||
                '',

            BRANCH_ID:
                source.BRANCH_ID ||
                source.branchId ||
                source.branch_ID ||
                source.branch_id ||
                '',

            SANGSA_ID:
                source.SANGSA_ID ||
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
    }, [user]);

    const loginInfo = useMemo(() => getLoginInfo(), [getLoginInfo]);
    const loginCompanyId = String(loginInfo.COMPANY_ID || '').trim().toUpperCase();
    const loginMemberGb = String(loginInfo.MEMBER_GB || '').trim().toUpperCase();

    const canManageUser = loginMemberGb === 'CA';

    useEffect(() => {
        const updateTopbarHeight = () => {
            const topbar = document.querySelector('.wa-topbar');
            const height = topbar?.getBoundingClientRect?.().height || 48;
            setTopbarHeight(Math.ceil(height));
        };

        updateTopbarHeight();
        window.addEventListener('resize', updateTopbarHeight);

        let observer;

        if (window.ResizeObserver) {
            const topbar = document.querySelector('.wa-topbar');

            if (topbar) {
                observer = new ResizeObserver(updateTopbarHeight);
                observer.observe(topbar);
            }
        }

        return () => {
            window.removeEventListener('resize', updateTopbarHeight);

            if (observer) {
                observer.disconnect();
            }
        };
    }, []);

    const getLoginId = () => {
        return loginInfo.LOGIN_ID || 'WEB';
    };

    const loadBranchOptions = useCallback(async () => {
        if (!loginCompanyId) {
            setBranchOptions([{ CODE_CD: '', CODE_NM: '전체' }]);
            return;
        }

        try {
            const response = await axios.post('/api/company/branch-list', {
                COMPANY_ID: loginCompanyId,
            });

            const list = response.data.list || response.data.data || [];

            setBranchOptions([
                { CODE_CD: '', CODE_NM: '전체' },
                ...list,
            ]);
        } catch (error) {
            console.error('[WaCompanyUserManage] SPACE 목록 조회 실패:', error);
            setBranchOptions([{ CODE_CD: '', CODE_NM: '전체' }]);
        }
    }, [loginCompanyId]);

    const makeSearchPayload = useCallback((override = {}) => {
        const merged = {
            ...searchForm,
            ...override,
        };

        if (!loginCompanyId) {
            alert('로그인 회원사 정보를 확인할 수 없습니다.');
            return null;
        }

        return {
            COMPANY_ID: loginCompanyId,
            BRANCH_ID: merged.BRANCH_ID || '',
            SANGSA_ID: '',
            MEMBER_NM: String(merged.MEMBER_NM || '').trim(),
            USE_YN: merged.USE_YN,
            MEMBER_GB: merged.MEMBER_GB,
            ST_DATE: merged.MEMBER_NM ? '20170101' : compactDate(merged.ST_DATE),
            ED_DATE: compactDate(merged.ED_DATE),
        };
    }, [loginCompanyId, searchForm]);

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
                    BRANCH_ID: targetUser.BRANCH_ID,
                    SANGSA_ID: targetUser.SANGSA_ID || '',
                }),
                axios.post('/api/company/user/branch-work', {
                    COMPANY_ID: targetUser.COMPANY_ID,
                    BRANCH_ID: targetUser.BRANCH_ID,
                    SANGSA_ID: targetUser.SANGSA_ID || '',
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
            console.error('[WaCompanyUserManage] 회원 업무권한 조회 실패:', error);
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
            MEMBER_MAIL: getValue(userRow, 'MEMBER_MAIL', 'memberMail', 'member_mail'),
        };

        setSelectedIndex(index);
        setDetail(nextDetail);

        await loadUserWork(nextDetail);
    };

    const handleSearch = useCallback(async (override = {}) => {
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
            console.error('[WaCompanyUserManage] 회원 목록 조회 실패:', error);
            alert(error.response?.data?.message || '회원 목록 조회 중 오류가 발생했습니다.');
        }
    }, [makeSearchPayload]);

    const initPage = useCallback(async () => {
        if (!user && !getStoredUser()) {
            setUserList([]);
            setSelectedIndex(-1);
            setDetail(createEmptyDetail());
            setWorkPerms(createDefaultWorkPerms());
            setBranchWorkInfo({});
            return;
        }

        if (!loginCompanyId) {
            alert('로그인 회원사 정보를 확인할 수 없습니다.');
            return;
        }

        await loadBranchOptions();
        await handleSearch();
    }, [handleSearch, loadBranchOptions, loginCompanyId, user]);

    useEffect(() => {
        initPage();
    }, [initPage]);

    const handleSearchChange = (event) => {
        const { name, value } = event.target;

        setSearchForm(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleDetailChange = (event) => {
        const { name, value } = event.target;

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

        const value = getValue(
            branchWorkInfo,
            item.branchField,
            item.branchField.toLowerCase(),
            item.branchField.replace('_YN', '_yn')
        );

        if (!value) {
            return true;
        }

        return String(value).toUpperCase() === 'Y';
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

        await loadBranchOptions();
        await handleSearch();
    };

    const buildSavePayload = (pwdResetYn = 'N') => {
        if (!selectedUser) {
            alert('저장할 회원을 선택해주세요.');
            return null;
        }

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

        const canEditRole = WA_MEMBER_GB_EDIT_OPTIONS.some(item => item.code === detail.MEMBER_GB);

        if (!canEditRole) {
            alert('WA에서 사용할 수 없는 업무권한입니다.');
            return null;
        }

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
                MEMBER_GB: detail.MEMBER_GB,
                MEMBER_NM: detail.MEMBER_NM,
                TEL_NO: detail.TEL_NO,
                MPHONE_NO: detail.MPHONE_NO,
                MEMBER_MAIL: detail.MEMBER_MAIL || '',
                USE_YN: detail.USE_YN,
                INS_USER: getLoginId(),
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

        const confirmReset = await gf.confirm(
            `선택한 회원 [${detail.LOGIN_ID}]의 패스워드가 'a1234567'로 초기화됩니다.\n\n계속하시겠습니까?`
        );

        if (!confirmReset) {
            return;
        }

        try {
            await axios.post('/api/company/user/password-reset', {
                LOGIN_ID: detail.LOGIN_ID,
                UPD_USER: getLoginId(),
                COMPANY_ID: detail.COMPANY_ID,
                BRANCH_ID: detail.BRANCH_ID,
                SANGSA_ID: detail.SANGSA_ID || '',
                MEMBER_GB: detail.MEMBER_GB,
            });

            const savePayload = buildSavePayload('Y');

            if (!savePayload) {
                return;
            }

            await axios.post('/api/company/user/update', savePayload);

            alert("패스워드가 'a1234567'로 초기화되었습니다.");
            await handleSearch();
        } catch (error) {
            console.error('[WaCompanyUserManage] 패스워드 초기화 실패:', error);
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

        const confirmSave = await gf.confirm('회원 권한정보를 저장하시겠습니까?');

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
            console.error('[WaCompanyUserManage] 회원 권한정보 저장 실패:', error);
            alert(error.response?.data?.message || '회원 권한정보 저장 중 오류가 발생했습니다.');
        }
    };

    const renderRadioGroup = ({ name, value, options, onChange, disabled = false }) => {
        return (
            <div className="wum-radio-group">
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

    const memberColumnDefs = useMemo(() => [
        {
            headerName: '번호',
            valueGetter: 'node.rowIndex + 1',
            width: 70,
            minWidth: 70,
            maxWidth: 80,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
        },
        {
            headerName: 'SPACE',
            field: 'CBS_NM',
            flex: 1.5,
            minWidth: 180,
        },
        {
            headerName: '업무권한',
            field: 'MEMBER_GB',
            flex: 0.9,
            minWidth: 110,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
            valueFormatter: params => getWaMemberGbName(params.value),
        },
        {
            headerName: '회원 ID',
            field: 'LOGIN_ID',
            flex: 1,
            minWidth: 120,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
        },
        {
            headerName: '회원명',
            field: 'MEMBER_NM',
            flex: 0.9,
            minWidth: 100,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
        },
        {
            headerName: '휴대폰번호',
            field: 'MPHONE_NO',
            flex: 1.1,
            minWidth: 130,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
        },
        {
            headerName: '이메일주소',
            field: 'MEMBER_MAIL',
            flex: 1.5,
            minWidth: 180,
        },
        {
            headerName: '사용여부',
            field: 'USE_YN',
            flex: 0.8,
            minWidth: 95,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
            cellRenderer: params => {
                const value = params.value || '';
                const name = getUseYnName(value);

                return (
                    <span className={`wum-ag-status status-${value}`}>
                        {name}
                    </span>
                );
            },
        },
        {
            headerName: '가입일자',
            field: 'INS_DATE',
            flex: 0.9,
            minWidth: 110,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
            valueFormatter: params => formatDate(params.value),
        },
        {
            headerName: '승인일자',
            field: 'CONFIRM_DT',
            flex: 0.9,
            minWidth: 110,
            cellClass: 'wum-ag-center',
            headerClass: 'wum-ag-center',
            valueFormatter: params => formatDate(params.value),
        },
    ], []);

    if (!canManageUser) {
        return (
            <div
                className="wum-fixed-scroll"
                style={{ '--wa-topbar-height': `${topbarHeight}px` }}
            >
                <div className="wum-page">
                    <section className="wum-card wum-no-auth">
                        <h2>기업사용자관리</h2>
                        <p>현재 권한({loginMemberGb || '-'})은 기업사용자관리 화면을 사용할 수 없습니다.</p>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div
            className="wum-fixed-scroll"
            style={{ '--wa-topbar-height': `${topbarHeight}px` }}
        >
            <div className="wum-page">
                <div className="wum-header-card">
                    <div>
                        <p className="wum-eyebrow">WA Company User Management</p>
                        <h1>기업사용자관리</h1>
                        <p>현재 로그인한 회원사의 사용자 권한과 사용 상태를 관리합니다.</p>
                    </div>

                    <div className="wum-header-actions">
                        <button type="button" onClick={() => handleSearch()}>
                            <UsersRound size={15} />
                            조회
                        </button>
                        <button type="button" onClick={handleSave}>
                            <Save size={15} />
                            저장
                        </button>
                        <button type="button" onClick={handleReload}>
                            <RefreshCw size={15} />
                            새로고침
                        </button>
                    </div>
                </div>

                <section className="wum-card">
                    <div className="wum-section-title">
                        <ShieldCheck size={18} />
                        <h2>검색 조건</h2>
                    </div>

                    <div className="wum-search-grid">
                        <label>
                            <span>SPACE</span>
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
                        </label>

                        <label>
                            <span>회원명</span>
                            <input
                                name="MEMBER_NM"
                                value={searchForm.MEMBER_NM}
                                onChange={handleSearchChange}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        handleSearch();
                                    }
                                }}
                            />
                        </label>

                        <label className="date">
                            <span>신청일자</span>
                            <div className="wum-date-range">
                                <input
                                    type="date"
                                    name="ST_DATE"
                                    value={searchForm.ST_DATE}
                                    onChange={handleSearchChange}
                                />
                                <em>~</em>
                                <input
                                    type="date"
                                    name="ED_DATE"
                                    value={searchForm.ED_DATE}
                                    onChange={handleSearchChange}
                                />
                            </div>
                        </label>

						<div className="wum-search-radio wum-search-use-filter">
						    <span>사용여부</span>
						    {renderRadioGroup({
						        name: 'searchUseYn',
						        value: searchForm.USE_YN,
						        options: USE_YN_OPTIONS,
						        onChange: (event) => setSearchForm(prev => ({ ...prev, USE_YN: event.target.value })),
						    })}
						</div>

						<div className="wum-search-radio wum-search-role-filter">
						    <span>업무권한</span>
						    {renderRadioGroup({
						        name: 'searchMemberGb',
						        value: searchForm.MEMBER_GB,
						        options: WA_MEMBER_GB_OPTIONS,
						        onChange: (event) => setSearchForm(prev => ({ ...prev, MEMBER_GB: event.target.value })),
						    })}
						</div>
                    </div>
                </section>

                <section className="wum-card">
                    <div className="wum-section-header">
                        <div className="wum-section-title">
                            <UsersRound size={18} />
                            <h2>회원 리스트</h2>
                            <em>{userList.length}건</em>
                        </div>
                    </div>

                    <div className="wum-ag-grid-wrap ag-theme-alpine">
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
                            overlayNoRowsTemplate="<span class='wum-ag-empty'>조회된 회원이 없습니다.</span>"
                        />
                    </div>
                </section>

                <section className="wum-card">
                    <div className="wum-section-title">
                        <ShieldCheck size={18} />
                        <h2>회원 기본정보</h2>
                    </div>

                    <div className="wum-detail-grid">
                        <label>
                            <span>사용자 ID</span>
                            <input value={detail.LOGIN_ID} readOnly />
                        </label>

                        <label>
                            <span>성명</span>
                            <input value={detail.MEMBER_NM} readOnly />
                        </label>

                        <label>
                            <span>전화번호</span>
                            <input value={detail.TEL_NO} readOnly />
                        </label>

                        <label>
                            <span>휴대폰번호</span>
                            <input value={detail.MPHONE_NO} readOnly />
                        </label>

                        <label className="wide">
                            <span>이메일</span>
                            <input
                                name="MEMBER_MAIL"
                                value={detail.MEMBER_MAIL || ''}
                                onChange={handleDetailChange}
                                disabled={!selectedUser}
                                placeholder="이메일을 입력해주세요"
                            />
                        </label>

                        <div className="wum-detail-radio wide">
                            <span>업무권한</span>
                            {renderRadioGroup({
                                name: 'detailMemberGb',
                                value: detail.MEMBER_GB,
                                options: WA_MEMBER_GB_EDIT_OPTIONS,
                                onChange: (event) => {
                                    setDetail(prev => ({
                                        ...prev,
                                        MEMBER_GB: event.target.value,
                                    }));
                                },
                                disabled: !selectedUser,
                            })}
                        </div>

                        <div className="wum-detail-radio wide">
                            <span>사용여부</span>
                            {renderRadioGroup({
                                name: 'detailUseYn',
                                value: detail.USE_YN,
                                options: USE_YN_EDIT_OPTIONS,
                                onChange: (event) => setDetail(prev => ({ ...prev, USE_YN: event.target.value })),
                                disabled: !selectedUser,
                            })}
                        </div>

                        <div className="wum-detail-radio wide">
                            <span>인증구분</span>
                            {renderRadioGroup({
                                name: 'LOGIN_GB',
                                value: detail.LOGIN_GB,
                                options: LOGIN_GB_OPTIONS,
                                onChange: handleDetailChange,
                                disabled: !selectedUser,
                            })}
                        </div>

                        <label className="wide">
                            <span>로그인 등록번호</span>
                            {isCorporateLogin ? (
                                <input
                                    name="BIZ_NO"
                                    value={formatBizNo(detail.BIZ_NO)}
                                    onChange={(event) => {
                                        const onlyNumber = event.target.value.replace(/\D/g, '');

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
                                <div className="wum-regist-row">
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
                        </label>

                        <div className="wum-password-action wide">
                            <button type="button" onClick={handlePasswordReset} disabled={!selectedUser}>
                                <RotateCcw size={14} />
                                패스워드 초기화
                            </button>
                            <p>법인용은 사업자번호, 개인용/휴대폰은 주민번호 앞 7자리 기준입니다.</p>
                        </div>
                    </div>
                </section>

                <section className="wum-card">
                    <div className="wum-section-title">
                        <ShieldCheck size={18} />
                        <h2>회원 권한정보</h2>
                    </div>

                    <div className="wum-work-grid single">
                        {WORK_ITEMS.map(item => {
                            const available = isWorkAvailable(item);

                            return (
                                <div className={`wum-work-card ${!available ? 'disabled' : ''}`} key={item.key}>
                                    <div className="wum-work-title">{item.title}</div>

                                    <div className="wum-work-line">
                                        <label>사용</label>
                                        {renderRadioGroup({
                                            name: `${item.key}_USE`,
                                            value: workPerms[item.useField],
                                            options: YES_NO_OPTIONS,
                                            onChange: (event) => handleWorkChange(item.useField, event.target.value),
                                            disabled: !selectedUser || !available,
                                        })}
                                    </div>

                                    <div className="wum-work-line">
                                        <label>권한</label>
                                        {renderRadioGroup({
                                            name: `${item.key}_PERM`,
                                            value: workPerms[item.permField],
                                            options: PERM_OPTIONS,
                                            onChange: (event) => handleWorkChange(item.permField, event.target.value),
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
    );
}

export default WaCompanyUserManage;