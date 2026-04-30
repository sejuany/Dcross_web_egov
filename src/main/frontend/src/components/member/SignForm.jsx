import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignForm.css';
import axios from 'axios';

const REG_GB_MASTER = [
    { code: 'A', name: '협회' },
    { code: 'C', name: '기업' },
    { code: 'D', name: '배송업체' },
    { code: 'M', name: '멀티기업' },
    { code: 'R', name: '관계사' },
];

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
    const [isIdChecked, setIsIdChecked] = useState(false);
    const [serviceAgreed, setServiceAgreed] = useState(false);
    const [regGbOptions, setRegGbOptions] = useState([]);
    const [associationOptions, setAssociationOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);

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

        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'loginId') {
            setIsIdChecked(false);
        }
    };

    const resetDetailForm = () => {
        setCompanySearched(false);
        setIsIdChecked(false);
        setServiceAgreed(false);
        setRegGbOptions([]);
        setAssociationOptions([]);
        setBranchOptions([]);

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
            loginGb: 'P',
            registNo: '',
            registNoSecond: '',
        }));
    };

    const handleSearchCompany = async () => {
        if (!formData.searchCompanyId.trim()) {
            alert('조회할 회원사 ID를 입력해주세요.');
            return;
        }

        try {
            const params = {
                COMPANY_ID: formData.searchCompanyId.trim()
            };

            const response = await axios.post('/api/company/search', params);

            if (response.data.success) {
                const info = response.data.companyInfo;

                if (!info) {
                    alert('회원사 정보를 찾을 수 없습니다.');
                    return;
                }

                const companyId = formData.searchCompanyId.trim().toUpperCase();
                const regOptions = getRegGbOptionsByCompanyId(companyId);

                if (regOptions.length === 0) {
                    setCompanySearched(false);
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

                if (autoRegGb) {
                    const result = await fetchCompanySelectOptions(companyId);
                    associationList = result.associationList;
                }

                const associationExists = associationList.some(item =>
                    String(item.CODE_CD || item.codeCd || '') === String(associationId)
                );

                setFormData(prev => ({
                    ...prev,
                    searchCompanyId: companyId,
                    regGb: autoRegGb,
                    associationId: associationExists ? associationId : '',
                    branchId: '',
                    sangsaId: '',
                }));

                setCompanySearched(true);
            } else {
                setCompanySearched(false);
                alert(response.data.message || '회원사 조회에 실패했습니다.');
            }
        } catch (error) {
            console.error('회원사 조회 실패:', error);
            setCompanySearched(false);
            alert('회원사 조회 중 오류가 발생했습니다.');
        }
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

        setAssociationOptions([]);
        setBranchOptions([]);

        if (!value) {
            return;
        }

        const result = await fetchCompanySelectOptions(companyId);

        const associationExists = result.associationList.some(item =>
            String(item.CODE_CD || item.codeCd || '') === String(companyInfo.associationId)
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

    const handleSubmit = async () => {
        if (!companySearched) {
            alert('먼저 회원사 ID를 조회해주세요.');
            return;
        }

        if (!formData.regGb) {
            alert('등록구분을 선택해주세요.');
            return;
        }

        if (!formData.associationId) {
            alert('협회/기업을 선택해주세요.');
            return;
        }

        if (!formData.branchId) {
            alert('지점을 선택해주세요.');
            return;
        }

        if (!formData.loginId.trim()) {
            alert('사용자 아이디를 입력해주세요.');
            return;
        }

        if (!isIdChecked) {
            alert('사용자 아이디 중복확인을 해주세요.');
            return;
        }

		const password = formData.passWd;

		if (!password.trim()) {
		    alert('비밀번호를 입력해주세요.');
		    return;
		}

		const passwordCheck = validatePassword(password);

		if (!passwordCheck.valid) {
		    alert(passwordCheck.message);
		    return;
		}

        if (!formData.passWdConfirm.trim()) {
            alert('비밀번호 확인을 입력해주세요.');
            return;
        }

        if (formData.passWd !== formData.passWdConfirm) {
            alert('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        if (!formData.memberNm.trim()) {
            alert('성명을 입력해주세요.');
            return;
        }

        const mphoneNo = formData.mphoneNo.trim();
        const telNo = formData.telNo.trim();

        if (!mphoneNo) {
            alert('휴대폰번호를 입력해주세요.');
            return;
        }

        if (!/^\d+$/.test(mphoneNo)) {
            alert('휴대폰번호는 숫자만 입력해주세요.');
            return;
        }

        if (!telNo) {
            alert('전화번호를 입력해주세요.');
            return;
        }

        if (!/^\d+$/.test(telNo)) {
            alert('전화번호는 숫자만 입력해주세요.');
            return;
        }

        if (formData.loginGb !== 'C') {
            if (!formData.registNo.trim()) {
                alert('등록번호 앞자리를 입력해주세요.');
                return;
            }

            if (!formData.registNoSecond.trim()) {
                alert('등록번호 뒷자리 첫 번째 숫자를 입력해주세요.');
                return;
            }

            if (!/^\d{6}$/.test(formData.registNo.trim())) {
                alert('등록번호 앞자리는 숫자 6자리로 입력해주세요.');
                return;
            }

            if (!/^\d{1}$/.test(formData.registNoSecond.trim())) {
                alert('등록번호 뒷자리는 첫 번째 숫자 1자리만 입력해주세요.');
                return;
            }
        }

        if (!serviceAgreed) {
            alert('서비스 이용 신청에 동의해주세요.');
            return;
        }

        const confirmSave = window.confirm(
            '입력된 내용으로 회원등록을 신청합니다.\n\n계속하시겠습니까?'
        );

        if (!confirmSave) {
            alert('회원신청을 취소하였습니다.');
            return;
        }

        const companyId = formData.searchCompanyId.trim().toUpperCase();
        const firstCompanyChar = companyId.substring(0, 1);

        let registNo = '';

        if (formData.loginGb !== 'C') {
            registNo = `${formData.registNo}${formData.registNoSecond}`;
        } else {
            registNo = companyInfo.bizNo;
        }

        let memberGb = '';

        if (formData.memberGb === 'U' && formData.regGb === 'C') {
            memberGb = 'CU';
        } else {
            memberGb = `${firstCompanyChar}${formData.memberGb}`;
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
            BRANCH_ID: formData.branchId,
            SANGSA_ID: formData.sangsaId || '',
            MEMBER_NM: formData.memberNm.trim(),
            MEMBER_GB: memberGb,
            TEL_NO: telNo,
            MPHONE_NO: mphoneNo
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

    return (
        <div className="sign-page-container">
            <div className="sign-card">
                <div className="sign-header">
                    <h3>
                        <span className="square-icon"></span>
                        회원가입 정보입력
                    </h3>
                    <div className="header-actions">
                        <button className="btn-f-key" onClick={handleSearchCompany}>조회[F2]</button>
                        <button className="btn-f-key" onClick={() => navigate('/login')}>닫기[F9]</button>
                    </div>
                </div>

                <div className="sign-body">
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
                                placeholder="회원사 ID를 입력하세요"
                                className="company-id-input"
                            />

                            <button className="btn-search-main" onClick={handleSearchCompany}>검색</button>

                            <label>법인명</label>
                            <input
                                type="text"
                                readOnly
                                className="read-only company-name-input"
                                value={companyInfo.companyNm}
                            />
                        </div>
                    </section>

                    <section className={`info-section ${!companySearched ? 'section-disabled' : ''}`}>
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
                                                <option key={item.CODE_CD || item.codeCd} value={item.CODE_CD || item.codeCd}>
                                                    {item.CODE_NM || item.codeNm}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            name="branchId"
                                            value={formData.branchId}
                                            onChange={handleChange}
                                            disabled={!companySearched || !formData.regGb || branchOptions.length === 0}
                                        >
                                            <option value="">지점</option>
                                            {branchOptions.map(item => (
                                                <option key={item.CODE_CD || item.codeCd} value={item.CODE_CD || item.codeCd}>
                                                    {item.CODE_NM || item.codeNm}
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

                    <section className={`info-section ${!companySearched ? 'section-disabled' : ''}`}>
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
                </div>

                <div className={`sign-footer ${!companySearched ? 'section-disabled' : ''}`}>
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
            </div>
        </div>
    );
};

export default SignForm;