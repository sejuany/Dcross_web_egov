import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignForm.css';
import axios from 'axios';
import { gf } from '../../utils/utils';

const REG_GB_MASTER = [
    { code: 'A', name: '협회' },
    { code: 'C', name: '기업' },
    { code: 'D', name: '배송업체' },
    { code: 'M', name: '멀티기업' },
    { code: 'R', name: '관계사' },
    { code: 'W', name: '웹버전 사용기업' },
];

const SIGNUP_FORM_TYPE = {
    NONE: 'NONE',
    DEFAULT: 'DEFAULT',
    SPECIAL: 'SPECIAL',
};

/*
    특수기업 업무권한
    CA = 기업 관리자
    BA = 지점 관리자
    SA = 팀 관리자
    SU = 팀 사용자

    조건:
    CA: BRANCH_ID = '1' 고정, SANGSA_ID 없음
    BA: BRANCH_ID 선택, SANGSA_ID 없음
    SA: BRANCH_ID 선택, SANGSA_ID 선택
    SU: BRANCH_ID 선택, SANGSA_ID 선택
*/
const SPECIAL_MEMBER_GB_OPTIONS = [
    { code: 'CA', name: '기업 관리자' },
    { code: 'BA', name: '지점 관리자' },
    { code: 'SA', name: '팀 관리자' },
    { code: 'SU', name: '팀 사용자' },
];

const isSpecialMemberGb = (memberGb) => {
    return ['CA', 'BA', 'SA', 'SU'].includes(memberGb);
};

const needBranchByMemberGb = (memberGb) => {
    return ['BA', 'SA', 'SU'].includes(memberGb);
};

const needSangsaByMemberGb = (memberGb) => {
    return ['SA', 'SU'].includes(memberGb);
};

const getSignupFormTypeByCompanyId = async (companyId) => {
    const normalizedCompanyId = String(companyId || '').trim().toUpperCase();

    const isSpecial = await gf.isSpecialCompany(normalizedCompanyId);

    return isSpecial
        ? SIGNUP_FORM_TYPE.SPECIAL
        : SIGNUP_FORM_TYPE.DEFAULT;
};

const getRegGbOptionsByCompanyId = (companyId) => {
    const firstChar = (companyId || '').trim().substring(0, 1).toUpperCase();

    if (firstChar === 'A') {
        return REG_GB_MASTER.filter(item => item.code === 'A');
    }

    if (firstChar === 'C') {
        return REG_GB_MASTER.filter(item => item.code === 'C');
    }

    return REG_GB_MASTER.filter(item => item.code === firstChar);
};

const formatBizNo = (bizNo) => {
    const onlyNumber = String(bizNo || '').replace(/\D/g, '');

    if (onlyNumber.length !== 10) {
        return bizNo || '';
    }

    return `${onlyNumber.substring(0, 3)}-${onlyNumber.substring(3, 5)}-${onlyNumber.substring(5)}`;
};

const getCodeValue = (item) => {
    return item?.CODE_CD || item?.codeCd || item?.BRANCH_ID || item?.branchId || item?.SANGSA_ID || item?.sangsaId || '';
};

const getCodeName = (item) => {
    return item?.CODE_NM || item?.codeNm || item?.BRANCH_NM || item?.branchNm || item?.SANGSA_NM || item?.sangsaNm || '';
};

const validatePassword = (password) => {
    const value = String(password || '');

    if (value.length < 8) {
        return {
            valid: false,
            message: '비밀번호를 확인하세요. 비밀번호는 8자 이상입니다.'
        };
    }

    if (/\s/.test(value)) {
        return {
            valid: false,
            message: '공백은 비밀번호에 포함될 수 없습니다.'
        };
    }

    const hasAlpha = /[A-Za-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[`~!@#$%^&*()_\-+=[\]{}\\|;:'",<.>/?]/.test(value);

    if (!hasAlpha || !hasNumber || !hasSpecial) {
        return {
            valid: false,
            message: '비밀번호에는 영문과 특수문자/숫자가 포함되어야 합니다.'
        };
    }

    return {
        valid: true,
        message: ''
    };
};

const validateEmail = (email) => {
    const value = String(email || '').trim();

    if (!value) {
        return {
            valid: false,
            message: '이메일을 입력해주세요.'
        };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value)) {
        return {
            valid: false,
            message: '이메일 형식이 올바르지 않습니다.'
        };
    }

    return {
        valid: true,
        message: ''
    };
};

const SignForm = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        searchCompanyId: '',
        regGb: '',
        memberGb: 'U',
        associationId: '',
        branchId: '',
        sangsaId: '',
        loginId: '',
        passWd: '',
        passWdConfirm: '',
        memberNm: '',
        telNo: '',
        mphoneNo: '',
        memberMail: '',
        loginGb: 'P',
        registNo: '',
        registNoSecond: '',
    });

    const [companyInfo, setCompanyInfo] = useState({
        companyNm: '',
        bizNo: '',
        address: '',
        addressDt: '',
        postNo: '',
        companyNo: '',
        associationId: ''
    });

    const [companySearched, setCompanySearched] = useState(false);
    const [signupFormType, setSignupFormType] = useState(SIGNUP_FORM_TYPE.NONE);

    const [isIdChecked, setIsIdChecked] = useState(false);
    const [serviceAgreed, setServiceAgreed] = useState(false);
    const [regGbOptions, setRegGbOptions] = useState([]);
    const [associationOptions, setAssociationOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);

    const [sangsaOptions, setSangsaOptions] = useState([]);
    const [selectedSangsaName, setSelectedSangsaName] = useState('');
    const [sangsaModalOpen, setSangsaModalOpen] = useState(false);
    const [sangsaSearchKeyword, setSangsaSearchKeyword] = useState('');
    const [sangsaSearchBranchId, setSangsaSearchBranchId] = useState('');

    const isSpecialForm = signupFormType === SIGNUP_FORM_TYPE.SPECIAL;
    const isDefaultForm = signupFormType === SIGNUP_FORM_TYPE.DEFAULT;

    const getAssociationName = () => {
        const found = associationOptions.find(item =>
            String(getCodeValue(item)) === String(formData.associationId)
        );

        return found ? getCodeName(found) : formData.associationId;
    };

    const getBranchName = (branchId) => {
        const found = branchOptions.find(item =>
            String(getCodeValue(item)) === String(branchId)
        );

        return found ? getCodeName(found) : branchId;
    };

    const resetSangsaState = () => {
        setSelectedSangsaName('');
        setSangsaOptions([]);
        setSangsaModalOpen(false);
        setSangsaSearchKeyword('');
        setSangsaSearchBranchId('');
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'loginGb') {
            if (value === 'C') {
                setFormData(prev => ({
                    ...prev,
                    loginGb: value,
                    registNo: companyInfo.bizNo || '',
                    registNoSecond: '',
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    loginGb: value,
                    registNo: '',
                    registNoSecond: '',
                }));
            }
            return;
        }

        if (name === 'memberGb') {
            setFormData(prev => {
                const next = {
                    ...prev,
                    memberGb: value,
                };

                if (value === 'CA') {
                    next.branchId = '1';
                    next.sangsaId = '';
                } else if (value === 'BA') {
                    next.branchId = '';
                    next.sangsaId = '';
                } else if (value === 'SA' || value === 'SU') {
                    next.branchId = '';
                    next.sangsaId = '';
                }

                return next;
            });

            resetSangsaState();
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'loginId') {
            setIsIdChecked(false);
        }
    };

    const resetDetailForm = () => {
        setCompanySearched(false);
        setSignupFormType(SIGNUP_FORM_TYPE.NONE);
        setIsIdChecked(false);
        setServiceAgreed(false);
        setRegGbOptions([]);
        setAssociationOptions([]);
        setBranchOptions([]);
        resetSangsaState();

        setCompanyInfo({
            companyNm: '',
            bizNo: '',
            address: '',
            addressDt: '',
            postNo: '',
            companyNo: '',
            associationId: ''
        });

        setFormData(prev => ({
            ...prev,
            regGb: '',
            memberGb: 'U',
            associationId: '',
            branchId: '',
            sangsaId: '',
            loginId: '',
            passWd: '',
            passWdConfirm: '',
            memberNm: '',
            telNo: '',
            mphoneNo: '',
            memberMail: '',
            loginGb: 'P',
            registNo: '',
            registNoSecond: '',
        }));
    };

    const fetchCompanySelectOptions = async (companyId) => {
        try {
            const params = {
                COMPANY_ID: companyId
            };

            const [associationRes, branchRes] = await Promise.all([
                axios.post('/api/company/association-list', params),
                axios.post('/api/company/branch-list', params)
            ]);

            const associationList = associationRes.data.success ? (associationRes.data.list || []) : [];
            const branchList = branchRes.data.success ? (branchRes.data.list || []) : [];

            setAssociationOptions(associationList);
            setBranchOptions(branchList);

            if (!associationRes.data.success) {
                alert(associationRes.data.message || '협회/기업 목록 조회에 실패했습니다.');
            }

            if (!branchRes.data.success) {
                alert(branchRes.data.message || '지점 목록 조회에 실패했습니다.');
            }

            return {
                associationList,
                branchList
            };

        } catch (error) {
            console.error('협회/기업, 지점 목록 조회 실패:', error);
            setAssociationOptions([]);
            setBranchOptions([]);
            alert('협회/기업, 지점 목록 조회 중 오류가 발생했습니다.');

            return {
                associationList: [],
                branchList: []
            };
        }
    };

    const fetchSangsaList = async ({ branchId, keyword }) => {
        const companyId = formData.searchCompanyId.trim().toUpperCase();

        if (!companyId) {
            alert('회원사 ID가 없습니다.');
            return [];
        }

        try {
            const response = await axios.post('/api/company/sangsa/list', {
                COMPANY_ID: companyId,
                BRANCH_ID: branchId || '',
                KEYWORD: keyword || ''
            });

            if (!response.data.success) {
                setSangsaOptions([]);
                alert(response.data.message || '영업팀 목록 조회에 실패했습니다.');
                return [];
            }

            const list = response.data.list || [];
            setSangsaOptions(list);

            return list;

        } catch (error) {
            console.error('영업팀 목록 조회 실패:', error);
            setSangsaOptions([]);
            alert('영업팀 목록 조회 중 오류가 발생했습니다.');
            return [];
        }
    };

    const handleBranchChange = (e) => {
        const branchId = e.target.value;

        setFormData(prev => ({
            ...prev,
            branchId,
            sangsaId: '',
        }));

        setSelectedSangsaName('');
        setSangsaOptions([]);
        setSangsaSearchKeyword('');
        setSangsaSearchBranchId('');
    };

    const openSangsaModal = async () => {
        if (!formData.branchId) {
            alert('회원가입할 지점을 먼저 선택해주세요.');
            return;
        }

        setSangsaSearchKeyword('');
        setSangsaSearchBranchId(formData.branchId || '');
        setSangsaModalOpen(true);

        await fetchSangsaList({
            branchId: formData.branchId,
            keyword: ''
        });
    };

    const closeSangsaModal = () => {
        setSangsaModalOpen(false);
        setSangsaSearchKeyword('');
        setSangsaSearchBranchId('');
    };

    const handleSearchSangsa = async () => {
        await fetchSangsaList({
            branchId: sangsaSearchBranchId,
            keyword: sangsaSearchKeyword.trim()
        });
    };

    const handleSelectSangsa = (item) => {
        const branchId = item.BRANCH_ID || item.branchId || '';
        const sangsaId = item.SANGSA_ID || item.sangsaId || getCodeValue(item);
        const sangsaName = item.SANGSA_NM || item.sangsaNm || getCodeName(item);

        if (!sangsaId) {
            alert('영업팀 ID가 없습니다.');
            return;
        }

        if (String(branchId) !== String(formData.branchId)) {
            alert('회원가입 화면에서 선택한 지점의 영업팀만 선택할 수 있습니다.');
            return;
        }

        setFormData(prev => ({
            ...prev,
            sangsaId: String(sangsaId)
        }));

        setSelectedSangsaName(sangsaName || String(sangsaId));
        closeSangsaModal();
    };

    const handleSearchCompany = async () => {
        if (!formData.searchCompanyId.trim()) {
            alert('조회할 회원사 ID를 입력해주세요.');
            return;
        }

        try {
            const companyId = formData.searchCompanyId.trim().toUpperCase();

            const params = {
                COMPANY_ID: companyId
            };

            const response = await axios.post('/api/company/search', params);

            if (!response.data.success) {
                setCompanySearched(false);
                setSignupFormType(SIGNUP_FORM_TYPE.NONE);
                alert(response.data.message || '회원사 조회에 실패했습니다.');
                return;
            }

            const info = response.data.companyInfo;

            if (!info) {
                setCompanySearched(false);
                setSignupFormType(SIGNUP_FORM_TYPE.NONE);
                alert('회원사 정보를 찾을 수 없습니다.');
                return;
            }

            const formType = await getSignupFormTypeByCompanyId(companyId);
            const regOptions = getRegGbOptionsByCompanyId(companyId);

            if (regOptions.length === 0) {
                setCompanySearched(false);
                setSignupFormType(SIGNUP_FORM_TYPE.NONE);
                setRegGbOptions([]);
                alert(`회원사 ID [${companyId}]에 맞는 등록구분을 찾을 수 없습니다.`);
                return;
            }

            const associationId = info.ASSOCIATION_ID || info.associationId || '';

            setCompanyInfo({
                companyNm: info.COMPANY_NM || info.companyNm || '',
                bizNo: info.BIZ_NO || info.bizNo || '',
                address: info.ADDRESS || info.address || '',
                addressDt: info.ADDRESS_DT || info.addressDt || '',
                postNo: info.POST_NO || info.postNo || '',
                companyNo: info.COMPANY_NO || info.companyNo || '',
                associationId: associationId,
            });

            setRegGbOptions(regOptions);

            const autoRegGb = regOptions.length === 1 ? regOptions[0].code : '';

            let associationList = [];
            let branchList = [];

            if (autoRegGb) {
                const result = await fetchCompanySelectOptions(companyId);
                associationList = result.associationList;
                branchList = result.branchList;
            }

            const associationExists = associationList.some(item =>
                String(getCodeValue(item)) === String(associationId)
            );

            setFormData(prev => ({
                ...prev,
                searchCompanyId: companyId,
                regGb: autoRegGb,
                associationId: associationExists ? associationId : '',
                branchId: '',
                sangsaId: '',
                memberGb: formType === SIGNUP_FORM_TYPE.SPECIAL ? 'SU' : 'U',
                loginGb: 'P',
                registNo: '',
                registNoSecond: '',
                loginId: '',
                passWd: '',
                passWdConfirm: '',
                memberNm: '',
                telNo: '',
                mphoneNo: '',
                memberMail: '',
            }));

            setIsIdChecked(false);
            setServiceAgreed(false);
            resetSangsaState();
            setCompanySearched(true);
            setSignupFormType(formType);

        } catch (error) {
            console.error('회원사 조회 실패:', error);
            setCompanySearched(false);
            setSignupFormType(SIGNUP_FORM_TYPE.NONE);
            alert('회원사 조회 중 오류가 발생했습니다.');
        }
    };

    const handleRegGbChange = async (e) => {
        const value = e.target.value;
        const companyId = formData.searchCompanyId.trim().toUpperCase();

        setFormData(prev => ({
            ...prev,
            regGb: value,
            associationId: '',
            branchId: '',
            sangsaId: '',
        }));

        resetSangsaState();
        setAssociationOptions([]);
        setBranchOptions([]);

        if (!value) {
            return;
        }

        const result = await fetchCompanySelectOptions(companyId);

        const associationExists = result.associationList.some(item =>
            String(getCodeValue(item)) === String(companyInfo.associationId)
        );

        setFormData(prev => ({
            ...prev,
            associationId: associationExists ? companyInfo.associationId : '',
        }));
    };

    const handleCheckDuplicate = async () => {
        if (!companySearched) {
            alert('먼저 회원사 ID를 조회해주세요.');
            return;
        }

        const loginId = formData.loginId.trim();

        if (!loginId) {
            alert('사용자 아이디를 입력해주세요.');
            return;
        }

        if (loginId.length < 6 || loginId.length > 12) {
            alert('사용자 아이디는 6~12자리로 입력해주세요.');
            return;
        }

        try {
            const response = await axios.post('/api/member/check-id', {
                LOGIN_ID: loginId
            });

            if (!response.data.success) {
                setIsIdChecked(false);
                alert(response.data.message || '아이디 중복확인에 실패했습니다.');
                return;
            }

            if (response.data.available) {
                setIsIdChecked(true);
                alert('사용 가능한 아이디입니다.');
            } else {
                setIsIdChecked(false);
                alert('이미 사용 중인 아이디입니다.');
            }

        } catch (error) {
            console.error('아이디 중복확인 실패:', error);
            setIsIdChecked(false);
            alert('아이디 중복확인 중 오류가 발생했습니다.');
        }
    };

    const validateDefaultForm = () => {
        if (!formData.regGb) {
            alert('등록구분을 선택해주세요.');
            return false;
        }

        if (!formData.associationId) {
            alert('협회/기업을 선택해주세요.');
            return false;
        }

        if (!formData.branchId) {
            alert('지점을 선택해주세요.');
            return false;
        }

        return true;
    };

    const validateSpecialForm = () => {
        if (!formData.regGb) {
            alert('회원사 등록구분 정보가 없습니다. 회원사 ID를 다시 조회해주세요.');
            return false;
        }

        if (!formData.associationId) {
            alert('회원사 협회/기업 정보가 없습니다. 회원사 ID를 다시 조회해주세요.');
            return false;
        }

        if (!formData.memberGb || !isSpecialMemberGb(formData.memberGb)) {
            alert('업무권한을 선택해주세요.');
            return false;
        }

        const emailCheck = validateEmail(formData.memberMail);

        if (!emailCheck.valid) {
            alert(emailCheck.message);
            return false;
        }

        if (formData.memberGb === 'CA') {
            return true;
        }

        if (formData.memberGb === 'BA') {
            if (!formData.branchId) {
                alert('지점을 선택해주세요.');
                return false;
            }

            return true;
        }

        if (formData.memberGb === 'SA' || formData.memberGb === 'SU') {
            if (!formData.branchId) {
                alert('지점을 선택해주세요.');
                return false;
            }

            if (!formData.sangsaId) {
                alert('영업팀을 선택해주세요.');
                return false;
            }

            return true;
        }

        return true;
    };

    const validateCommonMemberForm = () => {
        if (!formData.loginId.trim()) {
            gf.alert('사용자 아이디를 입력해주세요.');
            return false;
        }

        if (!isIdChecked) {
            gf.alert('사용자 아이디 중복확인을 해주세요.');
            return false;
        }

        const password = formData.passWd;

        if (!password.trim()) {
            gf.alert('비밀번호를 입력해주세요.');
            return false;
        }

        const passwordCheck = validatePassword(password);

        if (!passwordCheck.valid) {
            gf.alert(passwordCheck.message);
            return false;
        }

        if (!formData.passWdConfirm.trim()) {
            gf.alert('비밀번호 확인을 입력해주세요.');
            return false;
        }

        if (formData.passWd !== formData.passWdConfirm) {
            gf.alert('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return false;
        }

        if (!formData.memberNm.trim()) {
            gf.alert('성명을 입력해주세요.');
            return false;
        }

        const mphoneNo = formData.mphoneNo.trim();
        const telNo = formData.telNo.trim();

        if (!mphoneNo) {
            gf.alert('휴대폰번호를 입력해주세요.');
            return false;
        }

        if (!/^\d+$/.test(mphoneNo)) {
            gf.alert('휴대폰번호는 숫자만 입력해주세요.');
            return false;
        }

        if (!telNo) {
            gf.alert('전화번호를 입력해주세요.');
            return false;
        }

        if (!/^\d+$/.test(telNo)) {
            gf.alert('전화번호는 숫자만 입력해주세요.');
            return false;
        }

        if (formData.loginGb !== 'C') {
            if (!formData.registNo.trim()) {
                gf.alert('등록번호 앞자리를 입력해주세요.');
                return false;
            }

            if (!formData.registNoSecond.trim()) {
                gf.alert('등록번호 뒷자리 첫 번째 숫자를 입력해주세요.');
                return false;
            }

            if (!/^\d{6}$/.test(formData.registNo.trim())) {
                gf.alert('등록번호 앞자리는 숫자 6자리로 입력해주세요.');
                return false;
            }

            if (!/^\d{1}$/.test(formData.registNoSecond.trim())) {
                gf.alert('등록번호 뒷자리는 첫 번째 숫자 1자리만 입력해주세요.');
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!companySearched) {
            alert('먼저 회원사 ID를 조회해주세요.');
            return;
        }

        if (isDefaultForm && !validateDefaultForm()) {
            return;
        }

        if (isSpecialForm && !validateSpecialForm()) {
            return;
        }

        if (!validateCommonMemberForm()) {
            return;
        }

        if (!serviceAgreed) {
            gf.alert('서비스 이용 신청에 동의해주세요.');
            return;
        }
        
        const confirmSave = await gf.confirm('입력된 내용으로 회원등록을 신청합니다.\n\n계속하시겠습니까?');

        if (!confirmSave) {
            gf.alert('회원신청을 취소하였습니다.');
            return;
        }

        const companyId = formData.searchCompanyId.trim().toUpperCase();
        const firstCompanyChar = companyId.substring(0, 1);
        const isSpecialCompany = await gf.isSpecialCompany(companyId);

        let registNo = '';

        if (formData.loginGb !== 'C') {
            registNo = `${formData.registNo}${formData.registNoSecond}`;
        } else {
            registNo = companyInfo.bizNo;
        }

        let memberGb = '';

        if (isSpecialCompany) {
            memberGb = formData.memberGb;
        } else {
            memberGb = `${firstCompanyChar}${formData.memberGb}`;
        }

        let branchId = formData.branchId;
        let sangsaId = formData.sangsaId || '';

        if (isSpecialCompany) {
            if (memberGb === 'CA') {
                branchId = '1';
                sangsaId = '';
            }

            if (memberGb === 'BA') {
                sangsaId = '';
            }
        }

        const payload = {
            LOGIN_ID: formData.loginId.trim(),
            PASS_WD: formData.passWd,
            LOGIN_GB: formData.loginGb,
            REGIST_NO: registNo,

            MEMBER_ID: formData.loginId.trim(),
            REG_GB: formData.regGb,
            ASSOCIATION_ID: formData.associationId,
            COMPANY_ID: companyId,
            BRANCH_ID: branchId,
            SANGSA_ID: sangsaId,
            MEMBER_NM: formData.memberNm.trim(),
            MEMBER_GB: memberGb,
            TEL_NO: formData.telNo.trim(),
            MPHONE_NO: formData.mphoneNo.trim(),
            MEMBER_MAIL: isSpecialCompany ? formData.memberMail.trim() : '',

            SIGNUP_FORM_TYPE: signupFormType
        };

        try {
            const response = await axios.post('/api/member/signup', payload);

            if (response.data.success) {
                alert('회원가입 신청이 완료되었습니다.');
                navigate('/login');
            } else {
                alert(response.data.message || '회원가입 신청에 실패했습니다.');
            }
        } catch (error) {
            console.error('회원가입 신청 실패:', error);
            alert(error.response?.data?.message || '회원가입 신청 중 오류가 발생했습니다.');
        }
    };

    const renderSearchSection = () => {
        return (
            <section className="search-section">
                <div className="search-box">
                    <label>회원사 ID</label>
                    <input
                        type="text"
                        name="searchCompanyId"
                        value={formData.searchCompanyId}
                        onChange={(e) => {
                            handleChange(e);

                            if (companySearched) {
                                resetDetailForm();
                                setFormData(prev => ({
                                    ...prev,
                                    searchCompanyId: e.target.value
                                }));
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearchCompany();
                            }
                        }}
                        placeholder="회원사 ID를 입력하세요"
                        className="company-id-input"
                    />

                    <button className="btn-search-main" onClick={handleSearchCompany}>
                        검색
                    </button>

                    <label>법인명</label>
                    <input
                        type="text"
                        readOnly
                        className="read-only company-name-input"
                        value={companyInfo.companyNm}
                    />
                </div>
            </section>
        );
    };

    const renderCompanyInfoSection = () => {
        return (
            <section className="info-section">
                <div className="section-header">회원사 신청정보</div>
                <div className="form-rows">
                    <div className="form-row split">
                        <div className="field">
                            <label className="req">등록구분</label>
                            <select
                                name="regGb"
                                value={formData.regGb}
                                onChange={handleRegGbChange}
                                disabled={!companySearched || regGbOptions.length === 0}
                            >
                                <option value="">선택</option>
                                {regGbOptions.map(item => (
                                    <option key={item.code} value={item.code}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="field">
                            <label className="req">업무권한</label>
                            <div className="radio-group">
                                <label>
                                    <input
                                        type="radio"
                                        name="memberGb"
                                        value="A"
                                        checked={formData.memberGb === 'A'}
                                        onChange={handleChange}
                                        disabled={!companySearched}
                                    />
                                    관리자
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="memberGb"
                                        value="U"
                                        checked={formData.memberGb === 'U'}
                                        onChange={handleChange}
                                        disabled={!companySearched}
                                    />
                                    사용자
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="field">
                            <label className="req">협회/지점</label>
                            <div className="inline-selects">
                                <select
                                    name="associationId"
                                    value={formData.associationId}
                                    onChange={handleChange}
                                    disabled={!companySearched || !formData.regGb || associationOptions.length === 0}
                                >
                                    <option value="">협회/기업</option>
                                    {associationOptions.map(item => (
                                        <option key={getCodeValue(item)} value={getCodeValue(item)}>
                                            {getCodeName(item)}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    name="branchId"
                                    value={formData.branchId}
                                    onChange={handleBranchChange}
                                    disabled={!companySearched || !formData.regGb || branchOptions.length === 0}
                                >
                                    <option value="">지점</option>
                                    {branchOptions.map(item => (
                                        <option key={getCodeValue(item)} value={getCodeValue(item)}>
                                            {getCodeName(item)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-row split">
                        <div className="field">
                            <label>법인번호</label>
                            <input type="text" readOnly className="read-only" value={companyInfo.companyNo} />
                        </div>
                        <div className="field">
                            <label>사업자번호</label>
                            <input type="text" readOnly className="read-only" value={companyInfo.bizNo} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="field">
                            <label>주소</label>
                            <div className="address-group">
                                <input type="text" className="addr-l read-only" readOnly value={companyInfo.address} />
                                <input type="text" className="addr-m read-only" readOnly value={companyInfo.addressDt} />
                                <input type="text" className="addr-s read-only" readOnly value={companyInfo.postNo} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    };

    const renderSpecialSignupForm = () => {
        return (
            <>
                <section className="info-section">
                    <div className="section-header">특정 회원사 전용 신청정보</div>
                    <div className="form-rows">
                        <div className="form-row split">
                            <div className="field">
                                <label>회원사명</label>
                                <input
                                    type="text"
                                    readOnly
                                    className="read-only"
                                    value={companyInfo.companyNm}
                                />
                            </div>

                            <div className="field">
                                <label>사업자번호</label>
                                <input
                                    type="text"
                                    readOnly
                                    className="read-only"
                                    value={formatBizNo(companyInfo.bizNo)}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="field special-auth-only-field">
                                <label className="req">권한</label>
                                <div className="special-auth-only-group">
                                    {SPECIAL_MEMBER_GB_OPTIONS.map(item => (
                                        <label
                                            key={item.code}
                                            className={`special-auth-chip ${formData.memberGb === item.code ? 'active' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="memberGb"
                                                value={item.code}
                                                checked={formData.memberGb === item.code}
                                                onChange={handleChange}
                                                disabled={!companySearched}
                                            />
                                            <span>{item.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="field special-email-field">
                                <label className="req">이메일</label>
                                <input
                                    type="text"
                                    name="memberMail"
                                    value={formData.memberMail}
                                    onChange={handleChange}
                                    className="special-email-input"
                                    placeholder="이메일을 입력해주세요"
                                    disabled={!companySearched}
                                />
                            </div>
                        </div>

                        {needBranchByMemberGb(formData.memberGb) && (
                            <div className="form-row">
                                <div className="field">
                                    <label className="req">지점</label>
                                    <div className="inline-selects">
                                        <input
                                            type="text"
                                            readOnly
                                            className="read-only"
                                            value={getAssociationName()}
                                        />

                                        <select
                                            name="branchId"
                                            value={formData.branchId}
                                            onChange={handleBranchChange}
                                            disabled={!companySearched || branchOptions.length === 0}
                                        >
                                            <option value="">지점 선택</option>
                                            {branchOptions.map(item => (
                                                <option key={getCodeValue(item)} value={getCodeValue(item)}>
                                                    {getCodeName(item)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {needSangsaByMemberGb(formData.memberGb) && formData.branchId && (
                            <div className="form-row">
                                <div className="field">
                                    <label className="req">영업팀</label>
                                    <div className="input-with-btn">
                                        <input
                                            type="text"
                                            readOnly
                                            className="read-only"
                                            value={selectedSangsaName}
                                            placeholder="영업팀을 선택해주세요"
                                        />
                                        <button
                                            type="button"
                                            className="btn-inner"
                                            onClick={openSangsaModal}
                                        >
                                            검색
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-row">
                            <div className="field">
                                <label>주소</label>
                                <div className="address-group">
                                    <input type="text" className="addr-l read-only" readOnly value={companyInfo.address} />
                                    <input type="text" className="addr-m read-only" readOnly value={companyInfo.addressDt} />
                                    <input type="text" className="addr-s read-only" readOnly value={companyInfo.postNo} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {renderMemberBasicInfoSection()}
                {renderFooter()}
                {renderSangsaModal()}
            </>
        );
    };

    const renderMemberBasicInfoSection = () => {
        return (
            <section className="info-section">
                <div className="section-header">회원기본정보</div>
                <div className="form-rows">
                    <div className="form-row split">
                        <div className="field">
                            <label className="req">사용자 ID</label>
                            <div className="input-with-btn">
                                <input
                                    type="text"
                                    name="loginId"
                                    value={formData.loginId}
                                    onChange={handleChange}
                                    placeholder="6~12자리 영문, 숫자"
                                    disabled={!companySearched}
                                />
                                <button
                                    type="button"
                                    className="btn-inner"
                                    onClick={handleCheckDuplicate}
                                    disabled={!companySearched}
                                >
                                    중복확인
                                </button>
                            </div>
                        </div>

                        <div className="field">
                            <label className="req">성명</label>
                            <input
                                type="text"
                                name="memberNm"
                                value={formData.memberNm}
                                onChange={handleChange}
                                disabled={!companySearched}
                            />
                        </div>
                    </div>

                    <div className="form-row split">
                        <div className="field">
                            <label className="req">비밀번호</label>
                            <input
                                type="password"
                                name="passWd"
                                value={formData.passWd}
                                onChange={handleChange}
                                placeholder="8자 이상 영문+숫자+특수문자"
                                disabled={!companySearched}
                            />
                        </div>

                        <div className="field">
                            <label className="req">비밀번호 확인</label>
                            <input
                                type="password"
                                name="passWdConfirm"
                                value={formData.passWdConfirm}
                                onChange={handleChange}
                                placeholder="비밀번호 재입력"
                                disabled={!companySearched}
                            />
                        </div>
                    </div>

                    <div className="form-row split">
                        <div className="field">
                            <label className="req">휴대폰번호</label>
                            <input
                                type="text"
                                name="mphoneNo"
                                value={formData.mphoneNo}
                                onChange={handleChange}
                                placeholder="'-' 제외 입력"
                                disabled={!companySearched}
                            />
                        </div>

                        <div className="field">
                            <label className="req">전화번호</label>
                            <input
                                type="text"
                                name="telNo"
                                value={formData.telNo}
                                onChange={handleChange}
                                placeholder="'-' 제외 입력"
                                disabled={!companySearched}
                            />
                        </div>
                    </div>

                    <div className="form-row split">
                        <div className="field">
                            <label className="req">인증 구분</label>
                            <div className="radio-group">
                                <label>
                                    <input
                                        type="radio"
                                        name="loginGb"
                                        value="C"
                                        checked={formData.loginGb === 'C'}
                                        onChange={handleChange}
                                        disabled={!companySearched}
                                    />
                                    법인
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="loginGb"
                                        value="P"
                                        checked={formData.loginGb === 'P'}
                                        onChange={handleChange}
                                        disabled={!companySearched}
                                    />
                                    개인
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="loginGb"
                                        value="H"
                                        checked={formData.loginGb === 'H'}
                                        onChange={handleChange}
                                        disabled={!companySearched}
                                    />
                                    휴대폰
                                </label>
                            </div>
                        </div>

                        <div className="field">
                            <label className="req">등록번호</label>

                            {formData.loginGb === 'C' ? (
                                <input
                                    type="text"
                                    name="registNo"
                                    value={formatBizNo(companyInfo.bizNo)}
                                    disabled={!companySearched}
                                    readOnly
                                />
                            ) : (
                                <div className="reg-no-row">
                                    <input
                                        type="text"
                                        name="registNo"
                                        value={formData.registNo}
                                        onChange={handleChange}
                                        className="reg-f"
                                        placeholder="앞자리"
                                        maxLength={6}
                                        disabled={!companySearched}
                                    />
                                    <span className="dash">-</span>
                                    <input
                                        type="password"
                                        name="registNoSecond"
                                        value={formData.registNoSecond}
                                        onChange={handleChange}
                                        className="reg-b"
                                        maxLength={1}
                                        disabled={!companySearched}
                                    />
                                    <span className="masking">******</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        );
    };

    const renderDefaultSignupForm = () => {
        return (
            <>
                {renderCompanyInfoSection()}
                {renderMemberBasicInfoSection()}
                {renderFooter()}
            </>
        );
    };

    const renderFooter = () => {
        return (
            <div className="sign-footer">
                <label className="agreement">
                    <input
                        type="checkbox"
                        checked={serviceAgreed}
                        onChange={(e) => setServiceAgreed(e.target.checked)}
                        disabled={!companySearched}
                    />
                    <span>서비스 이용에 대하여 신청합니다.</span>
                </label>

                <div className="footer-btns">
                    <button
                        className="btn-final-submit"
                        onClick={handleSubmit}
                        disabled={!companySearched}
                    >
                        신 청
                    </button>
                </div>
            </div>
        );
    };

    const renderSangsaModal = () => {
        if (!sangsaModalOpen) {
            return null;
        }

        return (
            <div className="sangsa-modal-backdrop">
                <div className="sangsa-modal">
                    <div className="sangsa-modal-header">
                        <h4>영업팀 검색</h4>
                        <button type="button" onClick={closeSangsaModal}>×</button>
                    </div>

                    <div className="sangsa-modal-body">
                        <div className="sangsa-search-top-row">
                            <select
                                className="sangsa-branch-select"
                                value={sangsaSearchBranchId}
                                onChange={(e) => setSangsaSearchBranchId(e.target.value)}
                            >
                                <option value="">전체 지점</option>
                                {branchOptions.map(item => (
                                    <option key={getCodeValue(item)} value={getCodeValue(item)}>
                                        {getCodeName(item)}
                                    </option>
                                ))}
                            </select>

                            <input
                                className="sangsa-search-input"
                                type="text"
                                value={sangsaSearchKeyword}
                                onChange={(e) => setSangsaSearchKeyword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearchSangsa();
                                    }
                                }}
                                placeholder="영업팀 ID 또는 영업팀명 검색"
                            />

                            <button
                                type="button"
                                className="btn-sangsa-search"
                                onClick={handleSearchSangsa}
                            >
                                검색
                            </button>
                        </div>

                        <div className="sangsa-list-box">
                            {sangsaOptions.length === 0 ? (
                                <div className="sangsa-empty">조회된 영업팀이 없습니다.</div>
                            ) : (
                                <table className="sangsa-table">
                                    <thead>
                                        <tr>
                                            <th>지점</th>
                                            <th>영업팀명</th>
                                            <th>사업자번호</th>
                                            <th>선택</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sangsaOptions.map((item, index) => {
                                            const branchId = item.BRANCH_ID || item.branchId || '';
                                            const sangsaId = item.SANGSA_ID || item.sangsaId || getCodeValue(item);
                                            const sangsaNm = item.SANGSA_NM || item.sangsaNm || getCodeName(item);
                                            const bizNo = item.BIZ_NO || item.bizNo || '';
                                            const branchName = getBranchName(branchId);
                                            const canSelect = String(branchId) === String(formData.branchId);

                                            return (
                                                <tr key={`${branchId}-${sangsaId}-${index}`}>
                                                    <td>{branchName}</td>
                                                    <td className="sangsa-name-cell">{sangsaNm}</td>
                                                    <td>{formatBizNo(bizNo)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-sangsa-select"
                                                            onClick={() => handleSelectSangsa(item)}
                                                            disabled={!canSelect}
                                                            title={!canSelect ? '회원가입 화면에서 선택한 지점의 영업팀만 선택할 수 있습니다.' : ''}
                                                        >
                                                            선택
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="sangsa-modal-footer">
                        <button type="button" onClick={closeSangsaModal}>
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSignupFormByType = () => {
        if (!companySearched || signupFormType === SIGNUP_FORM_TYPE.NONE) {
            return null;
        }

        if (isSpecialForm) {
            return renderSpecialSignupForm();
        }

        return renderDefaultSignupForm();
    };

    return (
        <div className="sign-page-container">
            <div className="sign-card">
                <div className="sign-header">
                    <h3>
                        <span className="square-icon"></span>
                        회원가입 정보입력
                    </h3>
                    <div className="header-actions">
                        <button className="btn-f-key" onClick={handleSearchCompany}>
                            조회[F2]
                        </button>
                        <button className="btn-f-key" onClick={() => navigate('/login')}>
                            닫기[F9]
                        </button>
                    </div>
                </div>

                <div className="sign-body">
                    {renderSearchSection()}
                    {renderSignupFormByType()}
                </div>
            </div>
        </div>
    );
};

export default SignForm;