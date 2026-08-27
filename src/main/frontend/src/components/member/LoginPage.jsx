import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { getHomePathForUser } from '../../wa/auth/waRouting';
import './Login.css';

const MOBILE_PROVIDER_OPTIONS = [
    { value: '', label: '통신사 선택' },
    { value: 'SKT', label: 'SKT' },
    { value: 'KT', label: 'KT' },
    { value: 'LGU', label: 'LG U+' },
    { value: 'SKTMVNO', label: 'SKT 알뜰폰' },
    { value: 'KTMVNO', label: 'KT 알뜰폰' },
    { value: 'LGUMVNO', label: 'LG U+ 알뜰폰' }
];

const WITHAUTH_CALLBACK_NAME = 'dcrossWithAuthCallback';

const loadWithAuthSdk = (sdkUrl) => new Promise((resolve, reject) => {
    if (typeof window.withAuth_auth === 'function') {
        resolve();
        return;
    }

    const onLoad = () => typeof window.withAuth_auth === 'function'
        ? resolve()
        : reject(new Error('withAuth SDK 함수를 찾을 수 없습니다.'));
    const existing = document.getElementById('withauth-sdk');

    if (existing) {
        existing.addEventListener('load', onLoad, { once: true });
        existing.addEventListener('error', () => reject(new Error('withAuth SDK를 불러오지 못했습니다.')), { once: true });
        return;
    }

    const sixHourTimestamp = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    const script = document.createElement('script');
    script.id = 'withauth-sdk';
    script.async = true;
    script.src = `${sdkUrl}${sdkUrl.includes('?') ? '&' : '?'}ver=20260825&ts=${sixHourTimestamp}`;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => {
        script.remove();
        reject(new Error('withAuth SDK를 불러오지 못했습니다.'));
    }, { once: true });
    document.head.appendChild(script);
});

const LoginPage = () => {
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
        axios.get('/api/log/login-enter').catch(() => {
            // Login-enter logging should not block the login screen.
        });
    }, []);

    useEffect(() => {
        if (user) {
            navigate(getHomePathForUser(user), { replace: true });
        }
    }, [navigate, user]);

    useEffect(() => () => {
        delete window[WITHAUTH_CALLBACK_NAME];
    }, []);

    const resetMobileAuthState = () => {
        setMobileAuthPending(null);
        setMobileAuthMessage('');
        setMobileAuthStep('request');
        setMobileProviderId('');
        setMobileAuthNumber('');
    };

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const nextValue = name === 'regNo' ? value.replace(/\D/g, '').slice(0, 10) : value;
        resetMobileAuthState();
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : nextValue }));
    };

    const showToast = (message) => {
        setToastMessage(message);
        window.setTimeout(() => setToastMessage(''), 3000);
    };

    const handleWithAuthLogin = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const response = await axios.post('/api/auth/withauth/token', {});
            const { accessToken, sdkUrl, success, message } = response.data;

            if (!success || !accessToken || !sdkUrl) {
                throw new Error(message || '간편인증을 시작하지 못했습니다.');
            }

            await loadWithAuthSdk(sdkUrl);
            window[WITHAUTH_CALLBACK_NAME] = async (result) => {
                if (String(result?.resultCode) !== '200') {
                    showToast(result?.resultMessage || '간편인증이 취소되었거나 실패했습니다.');
                    delete window[WITHAUTH_CALLBACK_NAME];
                    return;
                }

                const transactionToken = result?.resMessage?.token;
                if (!transactionToken) {
                    showToast('간편인증 결과 토큰을 받지 못했습니다.');
                    delete window[WITHAUTH_CALLBACK_NAME];
                    return;
                }

                setIsSubmitting(true);
                try {
                    const verifyResponse = await axios.post('/api/auth/withauth/verify', {
                        token: transactionToken
                    });
                    if (!verifyResponse.data.success) {
                        throw new Error(verifyResponse.data.message || '간편인증 결과 확인에 실패했습니다.');
                    }
                    completeLogin(verifyResponse.data.user);
                } catch (error) {
                    showToast(error.response?.data?.message || error.message || '간편인증 로그인에 실패했습니다.');
                } finally {
                    setIsSubmitting(false);
                    delete window[WITHAUTH_CALLBACK_NAME];
                }
            };

            window.withAuth_auth(accessToken, 'Y', WITHAUTH_CALLBACK_NAME);
        } catch (error) {
            showToast(error.response?.data?.message || error.message || '간편인증을 시작하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeLogin = (loginUser) => {
        login(loginUser);
        showToast('로그인 성공');
        window.setTimeout(() => navigate(getHomePathForUser(loginUser), { replace: true }), 700);
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

            if (data.requiresMobileAuth) {
                setMobileAuthPending({ pendingAuthToken: data.pendingAuthToken, user: data.user });
                setMobileAuthMessage('휴대폰 본인인증이 필요합니다.');
                setIsSubmitting(false);
                return;
            }

            completeLogin(data.user);
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

            completeLogin(response.data.user);
        } catch (error) {
            setMobileAuthMessage(error.response?.data?.message || '인증번호 확인 중 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {toastMessage && <div className="toast-notification">{toastMessage}</div>}
            <div className="login-container">
                <div className="login-left">
                    <div className="brand-content">
                        <Link className="login-logo-switch" to="/numplateapp/login" aria-label="번호판 매니저 로그인으로 이동">
                            <img src="/logo.png" alt="DACOS" className="main-logo" />
                        </Link>
                        <p className="brand-tagline">Dream Of All Car Online Service</p>

                        <div className="notice-box">
                            <p>본 시스템은 인가된 사용자만 접근할 수 있습니다.</p>
                            <p>인가되지 않은 접근은 즉시 차단되며 관련 법규에 따라 처벌받을 수 있습니다.</p>
                            <p>시스템 이용 기록은 보안 감사 목적으로 사용됩니다.</p>
                        </div>
                    </div>
                </div>

                <div className="login-right">
                    <div className="form-wrapper">
                        <h1 className="welcome-text">WELCOME!</h1>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <input type="text" name="userId" placeholder="아이디" value={formData.userId} onChange={handleChange} disabled={isSubmitting} autoComplete="username" required />
                            </div>
                            <div className="input-group">
                                <input type="password" name="password" placeholder="비밀번호" value={formData.password} onChange={handleChange} disabled={isSubmitting} autoComplete="current-password" required />
                            </div>
                            <div className="input-group">
                                <input type="text" name="regNo" className="reg-no-input" placeholder="등록번호(주민번호 7자리 / 사업자번호 10자리)" value={formData.regNo} onChange={handleChange} disabled={isSubmitting} inputMode="numeric" pattern="[0-9]*" maxLength={10} autoComplete="off" autoCorrect="off" spellCheck={false} />
                            </div>
                            <div className="form-footer">
                                <label className="checkbox-container">
                                    <input type="checkbox" name="saveId" checked={formData.saveId} onChange={handleChange} disabled={isSubmitting} />
                                    <span className="checkmark" />
                                    아이디 저장
                                </label>
                            </div>
                            <button type="submit" className="login-btn" disabled={isSubmitting}>
                                {isSubmitting ? 'PROCESSING...' : 'LOGIN'}
                            </button>

                            {isSubmitting && (
                                <div className="login-progress" role="status" aria-live="polite">
                                    <div className="login-progress-track">
                                        <div className="login-progress-bar" />
                                    </div>
                                    <p>로그인 처리중입니다.</p>
                                </div>
                            )}

                            {!mobileAuthPending && (
                                <div className="withauth-login-section">
                                    <div className="login-method-divider"><span>또는</span></div>
                                    <button
                                        type="button"
                                        className="withauth-login-btn"
                                        onClick={handleWithAuthLogin}
                                        disabled={isSubmitting}
                                    >                                        
                                        간편인증 로그인
                                    </button>
                                    <p className="withauth-login-help">카카오·네이버 등 간편인증서를 선택할 수 있습니다.</p>
                                </div>
                            )}

                            {mobileAuthPending && (
                                <div className="mobile-auth-panel" role="status" aria-live="polite">
                                    <strong>휴대폰 본인인증 필요</strong>
                                    <p>{mobileAuthMessage}</p>
                                    {mobileAuthStep === 'request' ? (
                                        <div className="mobile-auth-fields">
                                            <select className="mobile-auth-control" value={mobileProviderId} onChange={(e) => setMobileProviderId(e.target.value)} disabled={isSubmitting}>
                                                {MOBILE_PROVIDER_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="mobile-auth-fields">
                                            <input className="mobile-auth-control" type="text" inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" value={mobileAuthNumber} onChange={(e) => setMobileAuthNumber(e.target.value.replace(/\D/g, ''))} disabled={isSubmitting} />
                                        </div>
                                    )}

                                    <div className="mobile-auth-actions">
                                        <button type="button" className="mobile-auth-btn primary" onClick={mobileAuthStep === 'request' ? handleMobileAuthRequest : handleMobileAuthVerify} disabled={isSubmitting}>
                                            {mobileAuthStep === 'request' ? '인증번호 발송' : '인증번호 확인'}
                                        </button>
                                        <button type="button" className="mobile-auth-btn" onClick={resetMobileAuthState} disabled={isSubmitting}>다시 입력</button>
                                    </div>
                                </div>
                            )}

                            <div className="signup-guide">
                                <span>아직 계정이 없으신가요?</span>
                                <button type="button" className="signup-link-btn" disabled={isSubmitting} onClick={() => navigate('/signup')}>
                                    회원가입
                                </button>
                            </div>

                            
                        </form>
                    </div>
					
					<div className="login-policy">
						<a
						    href="/policy"
						    target="_blank"
						    rel="noopener noreferrer"
						    className="footer5-link"
						>
						    개인정보 처리방침
						</a>
				    </div>
                </div>
            </div>
        </>
    );
};

export default LoginPage;
