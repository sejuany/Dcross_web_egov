import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Building2,
    MapPin,
    Plus,
    RefreshCw,
    Save,
    Trash2,
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import AddressSearchModal from '../../../components/common/AddressSearchModal';
import { gf } from '../../../utils/utils';
import './WaCompanyManage.css';

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
    TEL_NO: '',
    MPHONE_NO: '',
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
    BASE_ID: '',
    NEWCAR_YN: 'Y',
    MORTREG_YN: 'N',
    MORTERS_YN: 'N',
    TRNSNAME_YN: 'N',
    MODIFY_YN: 'N',
    PAYMENT_ME: '',
    USE_YN: 'Y',
};

const USE_OPTIONS = [
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
];

const WORK_OPTIONS = [
    { code: 'Y', name: '사용' },
    { code: 'N', name: '미사용' },
];

const getValue = (obj, ...keys) => {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            return obj[key];
        }
    }

    return '';
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
    BUBJUNG_CD: getValue(data, 'BUBJUNG_CD', 'bubjung_CD', 'bubjungCd'),
    BUBJUNG_NM: getValue(data, 'BUBJUNG_NM', 'bubjung_NM', 'bubjungNm'),
    HJD_CD: getValue(data, 'HJD_CD', 'hjd_CD', 'hjdCd'),
    HJD_NM: getValue(data, 'HJD_NM', 'hjd_NM', 'hjdNm'),
    ROAD_CD: getValue(data, 'ROAD_CD', 'road_CD', 'roadCd'),
    ROAD_NM: getValue(data, 'ROAD_NM', 'road_NM', 'roadNm'),
    ADDR_INFO: getValue(data, 'ADDR_INFO', 'addr_INFO', 'addrInfo'),
});

const normalizeBranch = (row = {}) => ({
    COMPANY_ID: getValue(row, 'COMPANY_ID', 'company_ID', 'companyId'),
    BRANCH_ID: getValue(row, 'BRANCH_ID', 'branch_ID', 'branchId'),
    BRANCH_NM: getValue(row, 'BRANCH_NM', 'branch_NM', 'branchNm'),
    BIZ_NO: getValue(row, 'BIZ_NO', 'biz_NO', 'bizNo'),
    TEL_NO: getValue(row, 'TEL_NO', 'tel_NO', 'telNo'),
    MPHONE_NO: getValue(row, 'MPHONE_NO', 'mphone_NO', 'mphoneNo'),
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
    BASE_ID: getValue(row, 'BASE_ID', 'base_ID', 'baseId'),
    NEWCAR_YN: getValue(row, 'NEWCAR_YN', 'newcar_YN', 'newcarYn') || 'N',
    MORTREG_YN: getValue(row, 'MORTREG_YN', 'mortreg_YN', 'mortregYn') || 'N',
    MORTERS_YN: getValue(row, 'MORTERS_YN', 'morters_YN', 'mortersYn') || 'N',
    TRNSNAME_YN: getValue(row, 'TRNSNAME_YN', 'trnsname_YN', 'trnsnameYn') || 'N',
    MODIFY_YN: getValue(row, 'MODIFY_YN', 'modify_YN', 'modifyYn') || 'N',
    PAYMENT_ME: getValue(row, 'PAYMENT_ME', 'payment_ME', 'paymentMe'),
    USE_YN: getValue(row, 'USE_YN', 'use_YN', 'useYn') || 'Y',
});

const getLoginCompanyId = (user) => {
    return String(
        user?.COMPANY_ID ||
        user?.company_ID ||
        user?.companyId ||
        user?.company_id ||
        ''
    ).trim().toUpperCase();
};

const getLoginId = (user) => {
    return String(
        user?.LOGIN_ID ||
        user?.login_ID ||
        user?.loginId ||
        user?.MEMBER_ID ||
        user?.member_ID ||
        user?.memberId ||
        'WEB'
    ).trim();
};

const getMemberGb = (user) => {
    return String(
        user?.MEMBER_GB ||
        user?.member_GB ||
        user?.memberGb ||
        user?.member_gb ||
        ''
    ).trim().toUpperCase();
};

const WaCompanyManage = () => {
    const { user } = useAuth();

    const [topbarHeight, setTopbarHeight] = useState(48);

    const loginCompanyId = useMemo(() => getLoginCompanyId(user), [user]);
    const loginId = useMemo(() => getLoginId(user), [user]);
    const memberGb = useMemo(() => getMemberGb(user), [user]);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [company, setCompany] = useState(EMPTY_COMPANY);
    const [branchList, setBranchList] = useState([]);
    const [selectedBranchIndex, setSelectedBranchIndex] = useState(-1);
    const [branchInput, setBranchInput] = useState(DEFAULT_BRANCH_INPUT);

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressTarget, setAddressTarget] = useState(null);

    const canManageCompany = memberGb === 'CA';

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

    const openAddressSearchModal = (targetKey) => {
        if (targetKey === 'company') {
            setAddressTarget({
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
            });
            setIsAddressModalOpen(true);
            return;
        }

        if (targetKey === 'branch') {
            setAddressTarget({
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
            });
            setIsAddressModalOpen(true);
            return;
        }

        alertMessage('주소검색 대상을 찾을 수 없습니다.');
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

    const handleBranchAddressSearch = () => {
        openAddressSearchModal('branch');
    };

    const loadCompanyDetail = useCallback(async () => {
        if (!loginCompanyId) {
            await alertMessage('로그인 회원사 정보를 확인할 수 없습니다.');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/company/manage/detail', {
                COMPANY_ID: loginCompanyId,
            });

            if (!response.data.success) {
                await alertMessage(response.data.message || '회원사 정보를 조회하지 못했습니다.');
                return;
            }

            const data = response.data.data || {};
            const companyData = normalizeCompany(data.company || {});

            setCompany({
                ...EMPTY_COMPANY,
                ...companyData,
                COMPANY_ID: loginCompanyId,
            });
        } catch (error) {
            console.error('[WaCompanyManage] 회사정보 조회 실패:', error);
            await alertMessage(error.response?.data?.message || '회사정보 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [alertMessage, loginCompanyId]);

    const loadBranchList = useCallback(async () => {
        if (!loginCompanyId) {
            setBranchList([]);
            return;
        }

        try {
            const response = await axios.post('/api/company/branch/manage/list', {
                COMPANY_ID: loginCompanyId,
            });

            if (!response.data.success) {
                setBranchList([]);
                return;
            }

            const list = (response.data.list || []).map(normalizeBranch);
            setBranchList(list);

            if (list.length > 0) {
                setSelectedBranchIndex(0);
                setBranchInput({
                    ...DEFAULT_BRANCH_INPUT,
                    ...list[0],
                    COMPANY_ID: loginCompanyId,
                });
            } else {
                setSelectedBranchIndex(-1);
                setBranchInput({
                    ...DEFAULT_BRANCH_INPUT,
                    COMPANY_ID: loginCompanyId,
                });
            }
        } catch (error) {
            console.error('[WaCompanyManage] SPACE 목록 조회 실패:', error);
            setBranchList([]);
        }
    }, [loginCompanyId]);

    const initPage = useCallback(async () => {
        await loadCompanyDetail();
        await loadBranchList();
    }, [loadBranchList, loadCompanyDetail]);

    useEffect(() => {
        initPage();
    }, [initPage]);

    const handleBranchSelect = (index) => {
        const selected = branchList[index];

        setSelectedBranchIndex(index);
        setBranchInput({
            ...DEFAULT_BRANCH_INPUT,
            ...selected,
            COMPANY_ID: loginCompanyId,
        });
    };

    const handleAddBranch = () => {
        if (!canManageCompany) {
            alertMessage('SPACE 추가 권한이 없습니다.');
            return;
        }

        setSelectedBranchIndex(-1);
        setBranchInput({
            ...DEFAULT_BRANCH_INPUT,
            COMPANY_ID: loginCompanyId,
            NEWCAR_YN: 'Y',
            USE_YN: 'Y',
        });
    };

    const handleBranchChange = (event) => {
        const { name, value } = event.target;

        setBranchInput(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const validateBranch = async () => {
        if (!loginCompanyId) {
            await alertMessage('회원사 ID가 없습니다.');
            return false;
        }

        if (!branchInput.BRANCH_NM.trim()) {
            await alertMessage('SPACE명을 입력해주세요.');
            return false;
        }

        return true;
    };

    const handleSaveBranch = async () => {
        if (!canManageCompany) {
            await alertMessage('SPACE 저장 권한이 없습니다.');
            return;
        }

        if (!(await validateBranch())) {
            return;
        }

        const ok = await confirmMessage('SPACE 정보를 저장합니다.\n\n계속하시겠습니까?', '저장');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...branchInput,
                COMPANY_ID: loginCompanyId,
                BASE_ID: branchInput.BASE_ID || '',
                INS_USER: loginId,
            };

            const response = await axios.post('/api/company/branch/manage/save', payload);

            if (!response.data.success) {
                await alertMessage(response.data.message || 'SPACE정보 저장에 실패했습니다.');
                return;
            }

            await alertMessage('지점정보를 저장했습니다.', '저장');

            await loadBranchList();
        } catch (error) {
            console.error('[WaCompanyManage] 지점 저장 실패:', error);
            await alertMessage(error.response?.data?.message || 'SPACE정보 저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBranch = async () => {
        if (!canManageCompany) {
            await alertMessage('SPACE 삭제 권한이 없습니다.');
            return;
        }

        if (!branchInput.BRANCH_ID) {
            await alertMessage('삭제할 SPACE을 선택해주세요.');
            return;
        }

        const ok = await confirmMessage('선택한 SPACE을 미사용 처리하시겠습니까?', '삭제');

        if (!ok) {
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...branchInput,
                COMPANY_ID: loginCompanyId,
                USE_YN: 'N',
                INS_USER: loginId,
            };

            const response = await axios.post('/api/company/branch/manage/save', payload);

            if (!response.data.success) {
                await alertMessage(response.data.message || 'SPACE 삭제에 실패했습니다.');
                return;
            }

            await alertMessage('지점을 미사용 처리했습니다.', '삭제');

            await loadBranchList();
        } catch (error) {
            console.error('[WaCompanyManage] 지점 삭제 실패:', error);
            await alertMessage(error.response?.data?.message || 'SPACE 삭제 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const handleReload = async () => {
        await initPage();
    };

    if (!canManageCompany) {
        return (
            <div
                className="wa-company-fixed-scroll"
                style={{ '--wa-topbar-height': `${topbarHeight}px` }}
            >
                <div className="wa-company-page">
                    <section className="wa-company-card wa-company-no-auth">
                        <h2>기업관리</h2>
                        <p>현재 권한({memberGb || '-'})은 기업관리 화면을 사용할 수 없습니다.</p>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div
            className="wa-company-fixed-scroll"
            style={{ '--wa-topbar-height': `${topbarHeight}px` }}
        >
            <div className="wa-company-page">
                <div className="wa-company-header">
                    <div>
                        <p className="wa-company-eyebrow">Company Management</p>
                        <h1>기업관리</h1>
                        <p>회사정보와 SPACE 정보를 관리합니다.</p>
                    </div>

                    <div className="wa-company-actions">
                        <button type="button" onClick={handleReload} disabled={loading || saving}>
                            <RefreshCw size={15} />
                            새로고침
                        </button>
                    </div>
                </div>

                <section className="wa-company-card">
                    <div className="wa-company-section-title">
                        <Building2 size={18} />
                        <h2>회원사 정보</h2>
                    </div>

                    <div className="wa-company-info-grid compact">
                        <label>
                            <span>회원사 ID</span>
                            <input value={company.COMPANY_ID} readOnly />
                        </label>

                        <label>
                            <span>회원사명</span>
                            <input value={company.COMPANY_NM} readOnly />
                        </label>

                        <label>
                            <span>사업자번호</span>
                            <input value={company.BIZ_NO} readOnly />
                        </label>

                        <label>
                            <span>법인번호</span>
                            <input value={company.COMPANY_NO} readOnly />
                        </label>

                        <label>
                            <span>대표자명</span>
                            <input value={company.CEO_NM} readOnly />
                        </label>

                        <label>
                            <span>전화번호</span>
                            <input value={company.TEL_NO} readOnly />
                        </label>

                        <label>
                            <span>휴대폰번호</span>
                            <input value={company.MPHONE_NO} readOnly />
                        </label>
                    </div>

                    <div className="wa-company-address-row compact">
                        <label>
                            <span>주소</span>
                            <div className="wa-company-address-box">
                                <input value={company.ADDRESS} readOnly />
                                <input value={company.ADDRESS_DT} readOnly />
                                <input value={company.POST_NO} readOnly />
                            </div>
                        </label>
                    </div>
                </section>

                <section className="wa-company-card">
                    <div className="wa-company-section-header">
                        <div className="wa-company-section-title">
                            <MapPin size={18} />
                            <h2>SPACE 정보</h2>
                        </div>

                        <div className="wa-company-branch-actions">
                            <button type="button" onClick={handleAddBranch} disabled={loading || saving}>
                                <Plus size={15} />
                                SPACE 추가
                            </button>

                            <button type="button" onClick={handleSaveBranch} disabled={loading || saving}>
                                <Save size={15} />
                                저장
                            </button>

                            <button type="button" className="danger" onClick={handleDeleteBranch} disabled={loading || saving}>
                                <Trash2 size={15} />
                                삭제
                            </button>
                        </div>
                    </div>

                    <div className="wa-company-branch-layout">
                        <div className="wa-company-table-wrap">
                            <table className="wa-company-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '70px' }}>번호</th>
                                        <th>SPACE명</th>
                                        <th style={{ width: '150px' }}>전화번호</th>
                                        <th style={{ width: '100px' }}>신규</th>
                                        <th style={{ width: '100px' }}>사용</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branchList.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="empty">
                                                등록된 SPACE이 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        branchList.map((row, index) => (
                                            <tr
                                                key={`${row.BRANCH_ID}-${index}`}
                                                className={selectedBranchIndex === index ? 'selected' : ''}
                                                onClick={() => handleBranchSelect(index)}
                                            >
                                                <td>{index + 1}</td>
                                                <td className="text-left">{row.BRANCH_NM}</td>
                                                <td>{row.TEL_NO}</td>
                                                <td>{row.NEWCAR_YN === 'Y' ? '사용' : '미사용'}</td>
                                                <td>{row.USE_YN === 'Y' ? '사용' : '미사용'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="wa-company-branch-form">
                            <h3>SPACE 상세정보</h3>

                            <div className="wa-company-form-grid">
                                <label>
                                    <span>SPACE ID</span>
                                    <input
                                        name="BRANCH_ID"
                                        value={branchInput.BRANCH_ID}
                                        onChange={handleBranchChange}
                                        placeholder="신규 등록 시 자동생성"
                                        readOnly
                                    />
                                </label>

                                <label>
                                    <span>SPACE 명 *</span>
                                    <input
                                        name="BRANCH_NM"
                                        value={branchInput.BRANCH_NM}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    />
                                </label>

                                <label>
                                    <span>사업자번호</span>
                                    <input
                                        name="BIZ_NO"
                                        value={branchInput.BIZ_NO}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    />
                                </label>

                                <label>
                                    <span>전화번호</span>
                                    <input
                                        name="TEL_NO"
                                        value={branchInput.TEL_NO}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    />
                                </label>

                                <label>
                                    <span>휴대폰번호</span>
                                    <input
                                        name="MPHONE_NO"
                                        value={branchInput.MPHONE_NO}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    />
                                </label>

                                <label>
                                    <span>우편번호</span>
                                    <input
                                        name="POST_NO"
                                        value={branchInput.POST_NO}
                                        readOnly
                                    />
                                </label>

                                <label className="wide">
                                    <span>주소</span>
                                    <div className="wa-company-address-search-row">
                                        <input
                                            name="ADDRESS"
                                            value={branchInput.ADDRESS}
                                            readOnly
                                            placeholder="주소검색으로 입력"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleBranchAddressSearch}
                                            disabled={saving}
                                        >
                                            주소검색
                                        </button>
                                    </div>
                                </label>

                                <label className="wide">
                                    <span>상세주소</span>
                                    <input
                                        name="ADDRESS_DT"
                                        value={branchInput.ADDRESS_DT}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    />
                                </label>

                                <label>
                                    <span>신규등록 사용</span>
                                    <select
                                        name="NEWCAR_YN"
                                        value={branchInput.NEWCAR_YN}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    >
                                        {WORK_OPTIONS.map(item => (
                                            <option key={item.code} value={item.code}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <span>사용여부</span>
                                    <select
                                        name="USE_YN"
                                        value={branchInput.USE_YN}
                                        onChange={handleBranchChange}
                                        disabled={saving}
                                    >
                                        {USE_OPTIONS.map(item => (
                                            <option key={item.code} value={item.code}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

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
};

export default WaCompanyManage;