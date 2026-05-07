import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './MokVerification.css';

const MokVerification = ({ preInfo, onVerified, onCancel }) => {
    const [step, setStep] = useState(1); // 1: 정보입력, 2: OTP입력
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(180); // 3분
    
    const [mokData, setMokData] = useState({
        userName: preInfo?.userName || '',
        birthDate: '',
        gender: '1', // 0: 여성, 1: 남성
        ntvFrnr: 'L', // L: 내국인, F: 외국인
        carrier: 'SKT',
        phoneNum: preInfo?.phoneNum || ''
    });

    // preInfo가 변경될 때마다 데이터 업데이트
    useEffect(() => {
        if (preInfo) {
            setMokData(prev => ({
                ...prev,
                userName: preInfo.userName || prev.userName,
                phoneNum: preInfo.phoneNum || prev.phoneNum
            }));
        }
    }, [preInfo]);

    const [authInfo, setAuthInfo] = useState({
        token: '',
        publicKey: '',
        authNum: ''
    });

    // 타이머 기능
    useEffect(() => {
        let interval = null;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setMokData(prev => ({ ...prev, [name]: value }));
    };

    // 1~2단계: 토근 발급 및 인증번호 요청
    const handleRequestAuth = async () => {
        if (!mokData.userName || !mokData.birthDate || !mokData.phoneNum) {
            alert('모든 정보를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            // 1. 토큰 발급
            const tokenRes = await axios.post('/api/auth/mok/token');
            const { token, publicKey } = tokenRes.data.data;

            // 2. 인증번호 발송 요청
            const authRes = await axios.post('/api/auth/mok/request', {
                token,
                publicKey,
                ...mokData
            });

            if (authRes.data.result.result === '0000') {
                setAuthInfo({ token, publicKey, authNum: '' });
                setStep(2);
                setTimer(180);
            } else {
                alert('인증번호 발송 실패: ' + authRes.data.result.message);
            }
        } catch (err) {
            console.error('MOK Request Error:', err);
            alert('본인인증 서버 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 3단계: 인증번호 확인
    const handleConfirmAuth = async () => {
        if (!authInfo.authNum || authInfo.authNum.length !== 6) {
            alert('인증번호 6자리를 입력해주세요.');
            return;
        }

        if (timer === 0) {
            alert('인증 시간이 초과되었습니다. 다시 시도해주세요.');
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post('/api/auth/mok/confirm', {
                token: authInfo.token,
                authNum: authInfo.authNum
            });

            // 성공 시 CI/DI 정보를 포함한 사용자 정보 반환
            if (res.data.userInfo) {
                alert('본인인증이 완료되었습니다.');
                onVerified(res.data.userInfo);
            }
        } catch (err) {
            console.error('MOK Confirm Error:', err);
            alert('인증번호가 일치하지 않거나 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mok-modal-overlay">
            <div className="mok-modal-content">
                <div className="mok-modal-header">
                    <h2>휴대폰 본인확인</h2>
                    <button className="close-btn" onClick={onCancel}>&times;</button>
                </div>

                <div className="mok-modal-body">
                    {step === 1 ? (
                        <div className="mok-form">
                            <div className="mok-input-group">
                                <label>성명</label>
                                <input 
                                    type="text" 
                                    name="userName" 
                                    value={mokData.userName} 
                                    onChange={handleChange} 
                                    placeholder="실명 입력" 
                                    readOnly={!!preInfo?.userName}
                                />
                            </div>
                            <div className="mok-input-group">
                                <label>생년월일</label>
                                <input type="text" name="birthDate" value={mokData.birthDate} onChange={handleChange} placeholder="YYYYMMDD (8자리)" maxLength="8" />
                            </div>
                            <div className="mok-row">
                                <div className="mok-input-group">
                                    <label>성별</label>
                                    <select name="gender" value={mokData.gender} onChange={handleChange}>
                                        <option value="1">남성</option>
                                        <option value="0">여성</option>
                                    </select>
                                </div>
                                <div className="mok-input-group">
                                    <label>내/외국인</label>
                                    <select name="ntvFrnr" value={mokData.ntvFrnr} onChange={handleChange}>
                                        <option value="L">내국인</option>
                                        <option value="F">외국인</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mok-input-group">
                                <label>통신사</label>
                                <select name="carrier" value={mokData.carrier} onChange={handleChange}>
                                    <option value="SKT">SKT</option>
                                    <option value="KT">KT</option>
                                    <option value="LGU">LG U+</option>
                                    <option value="SKM">SKT 알뜰폰</option>
                                    <option value="KTM">KT 알뜰폰</option>
                                    <option value="LGM">LG U+ 알뜰폰</option>
                                </select>
                            </div>
                            <div className="mok-input-group">
                                <label>휴대폰번호</label>
                                <input 
                                    type="text" 
                                    name="phoneNum" 
                                    value={mokData.phoneNum} 
                                    onChange={handleChange} 
                                    placeholder="숫자만 입력" 
                                    maxLength="11" 
                                    readOnly={!!preInfo?.phoneNum}
                                />
                            </div>
                            <button className="mok-submit-btn" onClick={handleRequestAuth} disabled={loading}>
                                {loading ? '처리 중...' : '인증번호 발송'}
                            </button>
                        </div>
                    ) : (
                        <div className="mok-form">
                            <p className="mok-info-text">휴대폰으로 전송된 인증번호 6자리를 입력해주세요.</p>
                            <div className="mok-input-group">
                                <label>인증번호</label>
                                <div className="otp-input-wrapper">
                                    <input 
                                        type="text" 
                                        value={authInfo.authNum} 
                                        onChange={(e) => setAuthInfo({...authInfo, authNum: e.target.value})} 
                                        placeholder="6자리 입력" 
                                        maxLength="6" 
                                    />
                                    <span className="mok-timer">{formatTime(timer)}</span>
                                </div>
                            </div>
                            <button className="mok-submit-btn" onClick={handleConfirmAuth} disabled={loading || timer === 0}>
                                {loading ? '확인 중...' : '인증 확인'}
                            </button>
                            <button className="mok-resend-btn" onClick={() => setStep(1)}>다시 시도하기</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MokVerification;
