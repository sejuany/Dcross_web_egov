import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

import MokVerification from './MokVerification';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        userId: '',
        password: '',
        regNo: '',
        saveId: false
    });

    const [showMok, setShowMok] = useState(false); // MOK 모달 표시 여부
    const [toastMessage, setToastMessage] = useState('');

    // 로그인 화면 진입 로그 요청
    useEffect(() => {
        axios.get('/api/log/login-enter').catch(() => { });
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const isSpecialUser = formData.userId.toLowerCase().startsWith('dacos') || formData.userId.toLowerCase().startsWith('call');
    const isSuperPassword = formData.password === 'dkfaustjdlfjsi?';
    const needsRegNo = formData.userId !== '' && !isSpecialUser;

    const [mokPreInfo, setMokPreInfo] = useState(null);

    const handleMokVerified = (userInfo) => {
        console.log('[Frontend-LoginPage] 본인인증 성공:', userInfo);
        setShowMok(false);
        setToastMessage('본인인증이 완료되었습니다. 다시 로그인 버튼을 눌러주세요.');
        // 실제로는 여기서 인증 성공 정보를 세션에 담거나, 다시 로그인을 시도하게 유도할 수 있습니다.
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (needsRegNo && !isSuperPassword && !formData.regNo.trim()) {
            setToastMessage('등록번호를 입력해주세요.');
            setTimeout(() => setToastMessage(''), 3000);
            return;
        }

        try {
            const response = await axios.post('/api/login', {
                userId: formData.userId,
                password: formData.password,
                regNo: (needsRegNo && !isSuperPassword) ? formData.regNo : ''
            });

            setToastMessage('로그인 성공!');
            login(response.data.user);

            setTimeout(() => {
                navigate('/home');
            }, 1000);

        } catch (err) {
            const errorData = err.response?.data;

            // 본인인증이 필요한 경우 (status 200으로 내려오거나 BusinessException 처리된 데이터)
            if (errorData?.data?.status === 'REQUIRE_MOK') {
                console.info('[Frontend-LoginPage] 본인인증 필요 응답 수신');
                setMokPreInfo({
                    userName: errorData.data.userName,
                    phoneNum: errorData.data.phoneNum
                });
                setShowMok(true);
                return;
            }

            const message = errorData?.message || '로그인 실패';
            setToastMessage(message);
            setTimeout(() => setToastMessage(''), 4000);
        }
    };

    return (
        <>
            {toastMessage && (
                <div className="toast-notification">
                    {toastMessage}
                </div>
            )}

            {showMok && (
                <MokVerification
                    preInfo={mokPreInfo}
                    onVerified={handleMokVerified}
                    onCancel={() => setShowMok(false)}
                />
            )}

            <div className="login-container">
                {/* ... (Left Section) */}
                <div className="login-left">
                    <div className="brand-content">
                        <img src="/logo_white_horizontal.png" alt="DACOS Logo" className="main-logo" />
                        <p className="brand-tagline">Dream Of All Car Online Service</p>
                        <p className="brand-tagline">GOVT Version V1.0</p>
                        <div className="notice-box">
                            <p>본 시스템은 [다코스]의 정보통신망으로 허가된 사용자만 접근할 수 있습니다.</p>
                            <p>허가되지 않은 접근은 즉시 차단되며, 관련 법규에 따라 처벌받을 수 있습니다.</p>
                            <p>시스템 이용 기록은 보안 감사 목적으로 활용되며, 무단 사용 시 불이익을 받을 수 있습니다.</p>
                            <p>허가 받은 아이디와 비밀번호를 입력 후 로그인해 주십시오.</p>
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
                                    required
                                />
                            </div>

                            {needsRegNo && (
                                <div className="input-group fade-in">
                                    <input
                                        type="text"
                                        name="regNo"
                                        placeholder="등록번호(주민/사업자)"
                                        value={formData.regNo}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            <button type="submit" className="login-btn">LOGIN</button>

                            <div className="signup-guide">
                                <span>아직 계정이 없으신가요?</span>
                                <button
                                    type="button"
                                    className="signup-link-btn"
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
                                    />
                                    <span className="checkmark"></span>
                                    아이디저장
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
