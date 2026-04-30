import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignupTerm.css';

const SignupTerm = () => {
    const navigate = useNavigate();
    
    const [agreed, setAgreed] = useState({
        require1: false, 
        require2: false, 
        require3: false, 
        require4: false, 
        optional: false  
    });

    const [isAllAgreed, setIsAllAgreed] = useState(false);

    const handleCheck = (name) => {
        const updated = { ...agreed, [name]: !agreed[name] };
        setAgreed(updated);
        const allChecked = Object.values(updated).every(val => val === true);
        setIsAllAgreed(allChecked);
    };

    const handleAllCheck = () => {
        const newState = !isAllAgreed;
        setIsAllAgreed(newState);
        setAgreed({
            require1: newState,
            require2: newState,
            require3: newState,
            require4: newState,
            optional: newState
        });
    };

    const handleNext = () => {
        const { require1, require2, require3, require4 } = agreed;
        if (require1 && require2 && require3 && require4) {
            // 스크립트의 agreeValue=YY 또는 YN 로직 반영하여 데이터 전달 가능
            const agreeValue = agreed.optional ? 'YY' : 'YN';
            navigate('/signup-form', { state: { agreeValue } });
        } else {
            alert("개인정보의 수집∙이용 필수 항목을 체크해주세요.\n동의하시지 않는 경우 회원가입이 제한됩니다.");
        }
    };

    return (
        <div className="term-wrapper">
            <div className="term-header">
                <h3><span className="bullet"></span> 개인정보 수집∙이용 동의</h3>
                <button className="btn-close" onClick={() => navigate('/login')}>닫기[F9]</button>
            </div>

            <div className="term-content">
                {/* 1. 개인정보의 수집∙이용 목적 */}
                <div className="term-section">
                    <div className="section-title">
                        <span>1. 개인정보의 수집∙이용 목적 (필수)</span>
                        <label className="check-label">
                            <input type="checkbox" checked={agreed.require1} onChange={() => handleCheck('require1')} /> 동의 <span className="text-red">(필수)</span>
                        </label>
                    </div>
                    <div className="term-box">
                        자동차 기업지원 포탈 시스템은 다음의 목적을 위해 개인정보를 수집 및 이용합니다.<br/>
                        수집된 개인정보는 정해진 목적 이외의 용도로는 이용되지 않으며, 수집목적이 변경될 경우 사전에 이용자에게 알리고 동의를 받습니다.<br/><br/>
                        (1) 사용자정보관리<br/>
                        &nbsp;&nbsp;&nbsp;사용자등록, 제한적 본인 확인절차에 따른 본인확인, 개인식별, 부정이용방지, 비인가 사용방지, 분쟁조정을 위한 기록보존, 고지사항 전달 등을 목적으로 개인정보를 처리<br/>
                        (2) 자동차 기본사항 조회 및 온라인 자동차 등록 서비스 제공
                    </div>
                </div>

                {/* 2. 수집하는 개인정보 항목 (필수) */}
                <div className="term-section">
                    <div className="section-title">
                        <span>2. 수집하는 개인정보 항목 (필수)</span>
                        <label className="check-label">
                            <input type="checkbox" checked={agreed.require2} onChange={() => handleCheck('require2')} /> 동의 <span className="text-red">(필수)</span>
                        </label>
                    </div>
                    <div className="term-box">
                        (1) 사용자 정보 : 등록구분, 아이디, 패스워드, 성명, 생년월일, 성별, 내/외국인 구분, 전화번호, 인증구분<br/>
                        (2) 자동차 등록 신청정보 : 차량번호, 차대번호, 본인확인방법, 주소<br/>
                        (3) 서비스 이용과정에서 자동으로 생성되어 수집될 수 있는 정보 : IP주소, 서비스 이용기록, 방문기록, 불량 이용기록 등<br/><br/>
                        <strong>&lt; 고유식별번호 처리를 위한 고지 사항 &gt;</strong><br/>
                        주민등록번호(외국인등록번호)를 처리함을 고지합니다.
                    </div>
                    <table className="term-table">
                        <thead>
                            <tr>
                                <th>개인정보 처리목적</th>
                                <th>개인정보 항목</th>
                                <th>수집근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>이전등록신청</td>
                                <td>주민등록번호, 외국인등록번호</td>
                                <td>자동차등록규칙 제33조제1항</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 3. 수집하는 개인정보 항목 (선택) */}
                <div className="term-section">
                    <div className="section-title">
                        <span>3. 수집하는 개인정보 항목 (선택)</span>
                        <label className="check-label">
                            <input type="checkbox" checked={agreed.optional} onChange={() => handleCheck('optional')} /> 동의 <span className="text-blue">(선택)</span>
                        </label>
                    </div>
                    <div className="term-box">
                        (1) 사용자정보 : 휴대전화번호<br/>
                        (2) 자동차등록 신청정보 : 신용카드정보, 비과세대상여부
                    </div>
                </div>

                {/* 4. 개인정보의 보유 및 이용기간 (필수) */}
                <div className="term-section">
                    <div className="section-title">
                        <span>4. 개인정보의 보유 및 이용기간 (필수)</span>
                        <label className="check-label">
                            <input type="checkbox" checked={agreed.require3} onChange={() => handleCheck('require3')} /> 동의 <span className="text-red">(필수)</span>
                        </label>
                    </div>
                    <div className="term-box">
                        자동차 기업지원 포탈 시스템은 법령에 따른 개인정보 보유∙이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유∙이용기간 내에서 개인정보를 처리∙보유합니다.<br/>
                        각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.<br/><br/>
                        (1) 회원 가입 및 관리 : 자동차 기업지원 포탈 서비스 탈퇴 시까지<br/>
                        (2) 자동차 등록(신규, 이전, 저당권) 민원사무 처리 : 수집∙이용에 관한 동의일로부터 1개월<br/>
                        (3) 자동차 등록 신청
                    </div>
                    <table className="term-table">
                        <thead>
                            <tr>
                                <th>해당 개인정보</th>
                                <th>보유 기간</th>
                                <th>근거</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>사용자 정보</td>
                                <td>미 접속 기간 1년까지</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td>자동차 등록 신청정보</td>
                                <td>등록신청 접수일로부터 3년 (신규등록 시 5년)</td>
                                <td>자동차등록령 제7조(등록서류의 보존∙관리)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* 5. 동의 거부 권리 및 불이익 (필수) */}
                <div className="term-section">
                    <div className="section-title">
                        <span>5. 동의 거부 권리 및 동의 거부 시 불이익 (필수)</span>
                        <label className="check-label">
                            <input type="checkbox" checked={agreed.require4} onChange={() => handleCheck('require4')} /> 동의 <span className="text-red">(필수)</span>
                        </label>
                    </div>
                    <div className="term-box">
                        이용자는 개인정보 수집 및 이용 등에 대한 동의에 거부할 권리가 있으며, 동의 거부 시 회원가입이 제한됩니다.
                    </div>
                </div>
            </div>

            <div className="term-footer">
                <p>전체 동의는 필수 및 선택정보에 대한 동의가 포함되어 있으며, 개별적으로 동의를 선택할 수 있습니다.<br/>
                   선택항목에 대한 동의를 거부하는 경우에도 서비스 이용이 가능합니다.</p>
                <div className="footer-controls">
                    <label className="all-check">
                        <input type="checkbox" checked={isAllAgreed} onChange={handleAllCheck} /> 전체동의
                    </label>
                    <button className="btn-next" onClick={handleNext}>다음</button>
                </div>
            </div>
        </div>
    );
};

export default SignupTerm;