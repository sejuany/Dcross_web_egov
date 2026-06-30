import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { isWaCompanyUser } from '../auth/waRouting';
import '../styles/wa.css';

const MOBILE_PROVIDER_OPTIONS = [
    { value: '', label: '통신사 선택' },
    { value: 'SKT', label: 'SKT' },
    { value: 'KT', label: 'KT' },
    { value: 'LGU', label: 'LG U+' },
    { value: 'SKTMVNO', label: 'SKT 알뜰폰' },
    { value: 'KTMVNO', label: 'KT 알뜰폰' },
    { value: 'LGUMVNO', label: 'LG U+ 알뜰폰' }
];

const WaLoginPage = () => {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [formData, setFormData] = useState({ userId: '', password: '', regNo: '', saveId: false });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [mobileAuthPending, setMobileAuthPending] = useState(null);
    const [mobileAuthMessage, setMobileAuthMessage] = useState('');
    const [mobileAuthStep, setMobileAuthStep] = useState('request');
    const [mobileProviderId, setMobileProviderId] = useState('');
    const [mobileAuthNumber, setMobileAuthNumber] = useState('');

    useEffect(() => {
        axios.get('/api/log/login-enter').catch(() => {});
    }, []);

    useEffect(() => {
        if (!user) return;

        if (isWaCompanyUser(user)) {
            navigate('/wa/home', { replace: true });
        } else {
            navigate('/home', { replace: true });
        }
    }, [navigate, user]);

    const resetMobileAuthState = () => {
        setMobileAuthPending(null);
        setMobileAuthMessage('');
        setMobileAuthStep('request');
        setMobileProviderId('');
        setMobileAuthNumber('');
    };

    const showToast = (message) => {
        setToastMessage(message);
        window.setTimeout(() => setToastMessage(''), 3000);
    };

    const clearServerLogin = async () => {
        try {
            await axios.post('/api/logout', {});
        } catch (error) {
            console.error('[WaLoginPage] logout cleanup failed:', error);
        }
    };

    const completeLogin = async (loginUser) => {
        if (!isWaCompanyUser(loginUser)) {
            await clearServerLogin();
            showToast('WA001 전용 로그인입니다. 일반 ERP 계정은 /login을 이용해주세요.');
            setIsSubmitting(false);
            return;
        }

        login(loginUser);
        showToast('로그인 성공');
        window.setTimeout(() => navigate('/wa/home', { replace: true }), 700);
    };

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const nextValue = name === 'regNo' ? value.replace(/\D/g, '').slice(0, 10) : value;
        resetMobileAuthState();
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : nextValue }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        resetMobileAuthState();

        try {
            const response = await axios.post('/api/login', {
                userId: formData.userId,
                password: formData.password,
                regNo: formData.regNo
            });
            const data = response.data;

            if (!isWaCompanyUser(data.user)) {
                await clearServerLogin();
                showToast('WA001 전용 로그인입니다. 일반 ERP 계정은 /login을 이용해주세요.');
                setIsSubmitting(false);
                return;
            }

            if (data.requiresMobileAuth) {
                setMobileAuthPending({ pendingAuthToken: data.pendingAuthToken, user: data.user });
                setMobileAuthMessage('휴대폰 본인인증이 필요합니다.');
                setIsSubmitting(false);
                return;
            }

            await completeLogin(data.user);
        } catch (error) {
            const message = error.response?.data?.error?.message || error.response?.data?.message || '로그인 실패';
            showToast(`로그인 실패: ${message}`);
            setIsSubmitting(false);
        }
    };

    const handleMobileAuthRequest = async () => {
        if (!mobileAuthPending?.pendingAuthToken) return;
        if (!mobileProviderId) {
            setMobileAuthMessage('통신사를 선택해주세요.');
            return;
        }

        setIsSubmitting(true);
        setMobileAuthMessage('');

        try {
            const response = await axios.post('/api/auth/mobile/request', {
                pendingAuthToken: mobileAuthPending.pendingAuthToken,
                providerId: mobileProviderId
            });

            if (response.data.success) {
                setMobileAuthStep('verify');
                setMobileAuthNumber('');
                setMobileAuthMessage(response.data.message || '인증번호가 발송되었습니다.');
            } else {
                setMobileAuthMessage(response.data.message || response.data.resultMsg || '휴대폰 본인인증 요청에 실패했습니다.');
            }
        } catch (error) {
            setMobileAuthMessage(error.response?.data?.message || '휴대폰 본인인증 요청 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMobileAuthVerify = async () => {
        if (!mobileAuthPending?.pendingAuthToken) return;
        if (!mobileAuthNumber.trim()) {
            setMobileAuthMessage('인증번호를 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setMobileAuthMessage('');

        try {
            const response = await axios.post('/api/auth/mobile/verify', {
                pendingAuthToken: mobileAuthPending.pendingAuthToken,
                authNumber: mobileAuthNumber.trim()
            });

            if (!response.data.success) {
                setMobileAuthMessage(response.data.message || response.data.resultMsg || '인증번호 확인에 실패했습니다.');
                return;
            }

            await completeLogin(response.data.user);
        } catch (error) {
            setMobileAuthMessage(error.response?.data?.message || '인증번호 확인 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="wa-login-page">
            {toastMessage && <div className="wa-toast">{toastMessage}</div>}

            <section className="wa-login-brand">
                <img src="/logo.png" alt="DACOS" />
                <h1>Polestar Registration Desk</h1>
                <p>WA001 Simplified Service</p>
            </section>

            <section className="wa-login-panel">
                <form className="wa-login-form" onSubmit={handleSubmit}>
                    <div className="wa-login-heading">
                        <span>WA001</span>
                        <h2>LOGIN</h2>
                    </div>

                    <label>
                        <span>아이디</span>
                        <input name="userId" value={formData.userId} onChange={handleChange} disabled={isSubmitting} autoComplete="username" required />
                    </label>
                    <label>
                        <span>비밀번호</span>
                        <input name="password" type="password" value={formData.password} onChange={handleChange} disabled={isSubmitting} autoComplete="current-password" required />
                    </label>
                    <label>
                        <span>등록번호</span>
                        <input name="regNo" value={formData.regNo} onChange={handleChange} disabled={isSubmitting} inputMode="numeric" maxLength={10} autoComplete="off" />
                    </label>

                    <button className="wa-login-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'PROCESSING...' : 'LOGIN'}
                    </button>

                    {mobileAuthPending && (
                        <div className="wa-mobile-auth-panel">
                            <strong>휴대폰 본인인증 필요</strong>
                            <p>{mobileAuthMessage}</p>
                            {mobileAuthStep === 'request' ? (
                                <select value={mobileProviderId} onChange={(event) => setMobileProviderId(event.target.value)} disabled={isSubmitting}>
                                    {MOBILE_PROVIDER_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            ) : (
                                <input value={mobileAuthNumber} onChange={(event) => setMobileAuthNumber(event.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" disabled={isSubmitting} />
                            )}
                            <div className="wa-mobile-auth-actions">
                                <button type="button" onClick={mobileAuthStep === 'request' ? handleMobileAuthRequest : handleMobileAuthVerify} disabled={isSubmitting}>
                                    {mobileAuthStep === 'request' ? '인증번호 발송' : '인증번호 확인'}
                                </button>
                                <button type="button" onClick={resetMobileAuthState} disabled={isSubmitting}>다시 입력</button>
                            </div>
                        </div>
                    )}

                    <label className="wa-login-save-id">
                        <input type="checkbox" name="saveId" checked={formData.saveId} onChange={handleChange} disabled={isSubmitting} />
                        <span>아이디 저장</span>
                    </label>
                </form>
            </section>
        </div>
    );
};

export default WaLoginPage;