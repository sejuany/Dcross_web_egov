import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './MemberPasswordCheck.css';

const MemberPasswordCheck = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!password.trim()) {
            alert('현재 비밀번호를 입력하세요.');
            return;
        }

        try {
            setLoading(true);

            const res = await axios.post('/api/member/verify-password', {
                PASS_WD: password
            });

            if (res.data?.success) {
                alert(res.data?.message || '비밀번호 확인이 완료되었습니다.');
                navigate('/mypage/member-edit');
            } else {
                alert(res.data?.message || '비밀번호가 일치하지 않습니다.');
            }
        } catch (err) {
            console.error('[MemberPasswordCheck] verify error:', err);
            alert('비밀번호 확인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="member-password-page">
            <div className="member-password-box">
                <div className="member-password-header">
                    <h2>회원정보수정</h2>
                    <p>회원정보를 수정하려면 현재 비밀번호를 먼저 확인해주세요.</p>
                </div>

                <form onSubmit={handleSubmit} className="member-password-form">
                    <div className="form-row">
                        <label htmlFor="currentPassword">현재 비밀번호</label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="현재 비밀번호 입력"
                            autoFocus
                        />
                    </div>

                    <div className="button-row">
                        <button type="submit" className="btn-confirm" disabled={loading}>
                            {loading ? '확인 중...' : '확인'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MemberPasswordCheck;