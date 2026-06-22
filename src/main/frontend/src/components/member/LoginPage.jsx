import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        userId: '',
        password: '',
        regNo: '',
        saveId: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [mobileAuthPending, setMobileAuthPending] = useState(null);
    const [mobileAuthMessage, setMobileAuthMessage] = useState('');

    useEffect(() => {
        axios.get('/api/log/login-enter').catch(() => {
            // Login-enter logging should not block the login screen.
        });
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setMobileAuthPending(null);
        setMobileAuthMessage('');
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setMobileAuthPending(null);
        setMobileAuthMessage('');

        try {
            const response = await axios.post('/api/login', {
                userId: formData.userId,
                password: formData.password,
                regNo: formData.regNo
            });

            const data = response.data;

            if (data.requiresMobileAuth) {
                setMobileAuthPending({
                    pendingAuthToken: data.pendingAuthToken,
                    user: data.user
                });
                setMobileAuthMessage('휴대폰 본인인증이 필요합니다.');
                setIsSubmitting(false);
                return;
            }

            login(data.user);
            showToast('로그인 성공!');

            setTimeout(() => {
                navigate('/home');
            }, 1000);
        } catch (err) {
            const message = err.response?.data?.error?.message || err.response?.data?.message || '로그인 실패';
            showToast(`로그인 실패: ${message}`);
            setIsSubmitting(false);
        }
    };

    const handleMobileAuthRequest = async () => {
        if (!mobileAuthPending?.pendingAuthToken) return;

        setIsSubmitting(true);
        setMobileAuthMessage('');

        try {
            const response = await axios.post('/api/auth/mobile/request', {
                pendingAuthToken: mobileAuthPending.pendingAuthToken
            });

            setMobileAuthMessage(response.data.message || '휴대폰 본인인증 준비 응답을 받았습니다.');
        } catch (err) {
            const message = err.response?.data?.message || '휴대폰 본인인증 준비 중 오류가 발생했습니다.';
            setMobileAuthMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetMobileAuthPending = () => {
        setMobileAuthPending(null);
        setMobileAuthMessage('');
    };

    return (
        <>
            {toastMessage && (
                <div className="toast-notification">
                    {toastMessage}
                </div>
            )}
            <div className="login-container">
                <div className="login-left">
                    <div className="brand-content">
                        <img src="/logo.png" alt="DACOS Logo" className="main-logo" />
                        <p className="brand-tagline">Dream Of All Car Online Service</p>
                        <p className="brand-tagline">GOVT Version V1.0</p>
                        <div className="notice-box">
                            <p>본 시스템은 허가된 사용자만 접근할 수 있습니다.</p>
                            <p>허가되지 않은 접근은 즉시 차단되며 관련 법규에 따라 처벌받을 수 있습니다.</p>
                            <p>시스템 이용 기록은 보안 감사 목적으로 사용됩니다.</p>
                            <p>허가받은 아이디와 비밀번호를 입력 후 로그인해 주십시오.</p>
                        </div>
                    </div>
                </div>

                <div className="login-right">
                    <div className="form-wrapper">
                        <h1 className="welcome-text">WELCOME!</h1>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="userId"
                                    placeholder="아이디"
                                    value={formData.userId}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="비밀번호"
                                    value={formData.password}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <input
                                    type="password"
                                    name="regNo"
                                    placeholder="등록번호(주민/사업자)"
                                    value={formData.regNo}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <button type="submit" className="login-btn" disabled={isSubmitting}>
                                {isSubmitting ? 'PROCESSING...' : 'LOGIN'}
                            </button>

                            {isSubmitting && (
                                <div className="login-progress" role="status" aria-live="polite">
                                    <div className="login-progress-track">
                                        <div className="login-progress-bar"></div>
                                    </div>
                                    <p>로그인 처리중입니다.</p>
                                </div>
                            )}

                            {mobileAuthPending && (
                                <div className="mobile-auth-panel" role="status" aria-live="polite">
                                    <strong>휴대폰 본인인증 필요</strong>
                                    <p>{mobileAuthMessage}</p>
                                    <div className="mobile-auth-actions">
                                        <button
                                            type="button"
                                            className="mobile-auth-btn primary"
                                            onClick={handleMobileAuthRequest}
                                            disabled={isSubmitting}
                                        >
                                            본인인증 시작
                                        </button>
                                        <button
                                            type="button"
                                            className="mobile-auth-btn"
                                            onClick={resetMobileAuthPending}
                                            disabled={isSubmitting}
                                        >
                                            다시 입력
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="signup-guide">
                                <span>아직 계정이 없으신가요?</span>
                                <button
                                    type="button"
                                    className="signup-link-btn"
                                    disabled={isSubmitting}
                                    onClick={() => navigate('/signup')}
                                >
                                    회원가입
                                </button>
                            </div>

                            <div className="form-footer">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        name="saveId"
                                        checked={formData.saveId}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                    <span className="checkmark"></span>
                                    아이디 저장
                                </label>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LoginPage;
