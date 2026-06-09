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

    // 로그인 화면 진입 로그 요청 (백엔드 로그에 "로그인 화면에 들어왔음" 출력용)
    useEffect(() => {
        axios.get('/api/log/login-enter').catch(() => {
            // 조용히 실패 (로그용이므로 사용자 알림 불필요)
        });
    }, []);

    // 토스트 메시지 상태
    const [toastMessage, setToastMessage] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('[Frontend-LoginPage] 로그인 버튼 클릭. 로그인 폼 제출 시작');
        try {
            console.log(`[Frontend-LoginPage] 서버(/api/login)로 데이터 전송 시도 - userId: ${formData.userId}`);
            const response = await axios.post('/api/login', {
                userId: formData.userId,
                password: formData.password,
                regNo: formData.regNo
            });
            console.log('[Frontend-LoginPage] 서버로부터 정상 응답 수신:', response.data);

            setToastMessage('로그인 성공!');
            console.log('[Frontend-LoginPage] login Context 함수 호출 전');
            login(response.data.user);
            console.log('[Frontend-LoginPage] login Context 함수 호출 후. /home 으로 네비게이션 예약');

            setTimeout(() => {
                navigate('/home');
            }, 1000); // 토스트 보여주려고 잠시 대기

        } catch (err) {
            console.error('[Frontend-LoginPage] 로그인 처리 중 에러 발생 (서버 에러 응답 또는 네트워크 문제):', err);
            if (err.response) {
                console.error('[Frontend-LoginPage] 에러 응답 데이터:', err.response.data);
                console.error('[Frontend-LoginPage] 에러 응답 상태 코드:', err.response.status);
            } else if (err.request) {
                console.error('[Frontend-LoginPage] 요청은 전송되었으나 응답을 받지 못함 (CORS, 백엔드 다운, 프록시 문제 등):', err.request);
            } else {
                console.error('[Frontend-LoginPage] 요청 설정 중 에러 발생:', err.message);
            }
            
            const message = err.response?.data?.error?.message || '로그인 실패';
            setToastMessage(`로그인 실패: ${message}`);
            setTimeout(() => setToastMessage(''), 3000);
        }
    };

    return (
        <>
            {toastMessage && (
                <div className="toast-notification">
                    {toastMessage}
                </div>
            )}
            <div className="login-container">
                {/* Left Section: Branding */}
                <div className="login-left">
                    <div className="brand-content">
                        <img src="/logo.png" alt="DACOS Logo" className="main-logo" />
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

                {/* Right Section: Login Form */}
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
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="regNo"
                                    placeholder="등록번호(주민/사업자)"
                                    value={formData.regNo}
                                    onChange={handleChange}
                                />
                            </div>

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
