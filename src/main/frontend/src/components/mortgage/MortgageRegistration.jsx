import React, { useState } from 'react';
import axios from 'axios';
import './MortgageRegistration.css';

const MortgageRegistration = () => {
    const [formData, setFormData] = useState({
        carNo: '',
        regNo: '',
        ownerName: '',
        mortgageAmount: 0,
        debtRatio: 100,
        chassisNo: '',
        carName: '',
        carType: '',
        usage: '',
        modelYear: '',
        firstRegDate: ''
    });

    const handleConnect = async () => {
        if (!formData.carNo) {
            alert('차량번호를 입력해주세요.');
            return;
        }
        try {
            // 관청 서버 연계 API 호출
            const response = await axios.post('/api/link', {
                SID: '설정가능여부2',
                CAR_NO: formData.carNo,
                GOVT_ID: 'HAMYA' // 기본값 또는 선택된 관청 ID
            });

            const { errorCode, returnMSG, bLink } = response.data;

            if (errorCode === '0') {
                try {
                    const carData = JSON.parse(returnMSG);
                    // 받아온 데이터로 폼 상태 업데이트
                    setFormData({
                        ...formData,
                        chassisNo: carData.CHASSIS_NO || '',
                        carName: carData.CAR_NAME || '',
                        carType: carData.CAR_TYPE || '',
                        usage: carData.USAGE || '',
                        modelYear: carData.MODEL_YEAR || '',
                        firstRegDate: carData.FIRST_REG_DATE || ''
                    });
                    alert('차량 정보를 성공적으로 가져왔습니다.');
                } catch (parseErr) {
                    console.error('JSON parsing error:', parseErr);
                    alert('받아온 데이터의 형식이 올바르지 않습니다.');
                }
            } else {
                alert(returnMSG || '차량 정보를 가져오는 데 실패했습니다.');
            }
        } catch (err) {
            console.error('Connection error:', err);
            alert('연계 호출 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="mortgage-reg-container">
            {/* Top Action Bar */}
            <div className="action-bar-top">
                <div className="left-actions">
                    <button className="btn-erp btn-list">목록</button>
                </div>
                <div className="right-actions">
                    <button className="btn-erp btn-apply">신청</button>
                    <button className="btn-erp btn-save">저장</button>
                    <button className="btn-erp btn-refresh">새로고침</button>
                    <button className="btn-erp btn-delete">삭제</button>
                    <button className="btn-erp btn-reset">초기화</button>
                    <button className="btn-erp btn-close">닫기</button>
                </div>
            </div>

            {/* Main Information Section */}
            <div className="erp-section">
                <div className="erp-grid">
                    <div className="erp-row">
                        <div className="erp-label">신청구분</div>
                        <div className="erp-value flex-none">
                            <select className="erp-input w-120">
                                <option>저당설정</option>
                            </select>
                        </div>
                        <div className="erp-label">접수번호</div>
                        <div className="erp-value flex-none">
                            <input type="text" className="erp-input disabled w-150" readOnly />
                        </div>
                        <div className="erp-label">신청자명</div>
                        <div className="erp-value flex-none">
                            <input type="text" className="erp-input disabled w-120" value="임세준" readOnly />
                        </div>
                        <div className="erp-label">신청일자</div>
                        <div className="erp-value flex-none">
                            <input type="date" className="erp-input w-150" value="2026-02-06" readOnly />
                        </div>
                    </div>
                    <div className="erp-row">
                        <div className="erp-label">신청상태</div>
                        <div className="erp-value flex-none">
                            <select className="erp-input w-120">
                                <option>입력</option>
                            </select>
                        </div>
                        <div className="erp-label">심사일자</div>
                        <div className="erp-value flex-none">
                            <input type="text" className="erp-input w-150" placeholder="yyyy-mm-dd" />
                        </div>
                        <div className="erp-label">심사상태</div>
                        <div className="erp-value flex-none">
                            <select className="erp-input w-120">
                                <option>선택</option>
                            </select>
                        </div>
                    </div>
                    <div className="erp-row full-width">
                        <div className="erp-label">반려사유</div>
                        <div className="erp-value">
                            <input type="text" className="erp-input" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mortgagee Information */}
            <div className="erp-section-title">● 저당권자 정보</div>
            <div className="erp-section no-padding">
                <table className="erp-table">
                    <thead>
                        <tr>
                            <th>저당권자 성명(상호)</th>
                            <th>등록번호</th>
                            <th>사업자번호</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>(주)다코스</td>
                            <td>1341110449905</td>
                            <td>5948700530</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Mortgage Information */}
            <div className="erp-section-title">● 저당정보</div>
            <div className="erp-section no-padding">
                <div className="mortgage-info-grid">
                    {/* Row 1 */}
                    <div className="grid-cell">
                        <div className="erp-label req">차량번호</div>
                        <div className="erp-value has-btn">
                            <input
                                type="text"
                                className="erp-input w-100"
                                value={formData.carNo}
                                onChange={(e) => setFormData({ ...formData, carNo: e.target.value })}
                            />
                            <button className="btn-erp btn-connect" onClick={handleConnect}>연 계</button>
                        </div>
                    </div>
                    <div className="grid-cell">
                        <div className="erp-label">등록번호</div>
                        <div className="erp-value">
                            <div className="input-with-select">
                                <select className="erp-input w-100">
                                    <option>주민등록번호</option>
                                </select>
                                <input type="text" className="erp-input w-150" />
                            </div>
                        </div>
                    </div>
                    <div className="grid-cell">
                        {/* Empty Zone */}
                    </div>

                    {/* Row 2 */}
                    <div className="grid-cell">
                        <div className="erp-label">저당권 설정자명</div>
                        <div className="erp-value">
                            <input type="text" className="erp-input w-120" />
                        </div>
                    </div>
                    <div className="grid-cell">
                        <div className="erp-label">채권가액(채권최고액)</div>
                        <div className="erp-value align-right">
                            <input type="text" className="erp-input text-right w-120" value="0" /> 원
                        </div>
                    </div>
                    <div className="grid-cell">
                        <div className="erp-label">채무비율(%)</div>
                        <div className="erp-value">
                            <input type="text" className="erp-input text-right w-50" value="100" /> %
                        </div>
                    </div>
                </div>

                <table className="erp-table mt-10">
                    <thead>
                        <tr>
                            <th>차대번호</th>
                            <th>차명</th>
                            <th>차종</th>
                            <th>용도</th>
                            <th>저당건수</th>
                            <th>압류건수</th>
                            <th>공동소유</th>
                            <th>모델연도</th>
                            <th>최초등록일</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{formData.chassisNo}</td>
                            <td>{formData.carName}</td>
                            <td>{formData.carType}</td>
                            <td>{formData.usage}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>{formData.modelYear}</td>
                            <td>{formData.firstRegDate}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Electronic Signature Section */}
            <div className="tab-section mt-20">
                <div className="tab-headers">
                    <div className="tab-header active">소유자 전자서명</div>
                    <div className="tab-header dark">전자서명 추가</div>
                </div>
                <div className="erp-section e-sign-box no-padding">
                    <div className="e-sign-header" style={{ padding: '2px 5px' }}>
                        <div className="right-tools">
                            <button className="btn-erp sm">본인확인</button>
                            <button className="btn-erp sm">전자서명 </button>
                            <button className="btn-erp sm">새로고침</button>
                            <button className="btn-erp sm">결과확인</button>
                        </div>
                    </div>
                    <div className="esign-grid">
                        {/* Row 1 */}
                        <div className="grid-cell">
                            <div className="erp-label">전자적 확인방법</div>
                            <div className="erp-value">
                                <select className="erp-input w-100"><option>MO</option></select>
                            </div>
                        </div>
                        <div className="grid-cell">
                            <div className="erp-label">확인번호</div>
                            <div className="erp-value">
                                <input type="text" className="erp-input disabled w-120" readOnly />
                            </div>
                        </div>
                        <div className="grid-cell">
                            <div className="erp-label">휴대폰번호</div>
                            <div className="erp-value">
                                <div className="multi-field">
                                    <select className="erp-input w-50"><option>선택</option></select>
                                    <input type="text" className="erp-input w-100" />
                                </div>
                            </div>
                        </div>
                        <div className="grid-cell">
                            {/* Empty Zone */}
                        </div>

                        {/* Row 2 */}
                        <div className="grid-cell">
                            <div className="erp-label">본인확인상태</div>
                            <div className="erp-value">
                                <select className="erp-input w-100"><option>대기</option></select>
                            </div>
                        </div>
                        <div className="grid-cell">
                            <div className="erp-label">확인일자</div>
                            <div className="erp-value">
                                <input type="text" className="erp-input disabled w-120" readOnly />
                            </div>
                        </div>
                        <div className="grid-cell">
                            <div className="erp-label">전자서명상태</div>
                            <div className="erp-value">
                                <select className="erp-input w-100"><option>대기</option></select>
                            </div>
                        </div>
                        <div className="grid-cell">
                            <div className="erp-label">서명날짜</div>
                            <div className="erp-value">
                                <input type="text" className="erp-input disabled w-120" readOnly />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Info Section */}
            <div className="erp-section-title mt-20">● 결제정보</div>
            <div className="erp-section payment-section no-padding">
                <div className="payment-layout">
                    <div className="payment-receipt-area">
                        <button className="btn-erp btn-receipt">남부영수증</button>
                    </div>
                    <div className="payment-main-info">
                        <div className="erp-row">
                            <div className="erp-label gray">결제자명</div>
                            <div className="erp-value flex-none">
                                <input type="text" className="erp-input w-150" />
                            </div>
                            <div className="erp-label gray">휴대폰번호</div>
                            <div className="erp-value has-btn flex-none">
                                <input type="text" className="erp-input w-150" />
                                <button className="btn-erp btn-sms">SMS발송</button>
                            </div>
                        </div>
                        <div className="erp-row">
                            <div className="erp-label gray">총 금액</div>
                            <div className="erp-value align-right flex-none">
                                <input type="text" className="erp-input text-right w-150" value="0" /> 원
                            </div>
                            <div className="erp-label gray">가상계좌</div>
                            <div className="erp-value flex-none">
                                <div className="multi-field">
                                    <select className="erp-input sm w-100"><option>선택</option></select>
                                    <input type="text" className="erp-input w-250" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="payment-status-area">
                        <div className="status-item">
                            <div className="status-label">납부방법</div>
                            <div className="status-value">
                                <label className="chk-label"><input type="checkbox" /> 수수료 대납</label>
                                <select className="erp-input sm"><option>계좌이체</option></select>
                            </div>
                        </div>
                        <div className="status-item">
                            <div className="status-label">납부상태</div>
                            <div className="status-value">
                                <select className="erp-input"><option>미입금</option></select>
                            </div>
                        </div>
                    </div>
                </div>

                <table className="erp-table mt-10">
                    <thead>
                        <tr>
                            <th>결제종류</th>
                            <th>전자납부번호(가상계좌번호)</th>
                            <th>결제여부</th>
                            <th>결제금액</th>
                            <th>입금여부</th>
                            <th>결제일시</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="align-left">등록수수료</td>
                            <td></td>
                            <td></td>
                            <td className="align-right">0</td>
                            <td>미입금</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td className="align-left">등록면허세</td>
                            <td></td>
                            <td>납부</td>
                            <td className="align-right">15,000</td>
                            <td>미입금</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td className="align-left">용지대</td>
                            <td></td>
                            <td>납부</td>
                            <td className="align-right">0</td>
                            <td>미입금</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MortgageRegistration;
