import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
    return (
        <div className="dashboard-container">
            {/* Action Buttons */}
            <div className="action-bar">
                <div className="btn-group-left">
                    <button className="btn primary">목록</button>
                </div>
                <div className="btn-group-right">
                    <button className="btn outline">DS 출력</button>
                    <button className="btn outline">정보수정</button>
                    <button className="btn blue">신청</button>
                    <button className="btn blue">저장</button>
                    <button className="btn blue">새로고침</button>
                    <button className="btn blue">삭제</button>
                    <button className="btn blue">초기화</button>
                    <button className="btn blue">닫기</button>
                </div>
            </div>

            {/* Main Form Sections */}
            <div className="form-sections">
                {/* Registration Info */}
                <section className="form-section">
                    <div className="section-grid">
                        <div className="form-item">
                            <label>신청구분</label>
                            <select><option>신규등록</option></select>
                        </div>
                        <div className="form-item">
                            <label>접수번호</label>
                            <input type="text" readOnly />
                        </div>
                        <div className="form-item">
                            <label>신청자명</label>
                            <input type="text" value="임세준" readOnly />
                        </div>
                        <div className="form-item">
                            <label>신청부서</label>
                            <select><option>전체</option></select>
                        </div>
                        <div className="form-item">
                            <label>신청일자</label>
                            <input type="date" value="2026-02-06" />
                        </div>
                        <div className="form-item">
                            <label>신청상태</label>
                            <select><option>입력</option></select>
                        </div>
                        <div className="form-item">
                            <label>심사일자</label>
                            <input type="text" placeholder="yyyy-mm-dd" readOnly />
                        </div>
                        <div className="form-item">
                            <label>심사상태</label>
                            <select><option>선택</option></select>
                        </div>
                        <div className="form-item">
                            <label>배정상태</label>
                            <select><option>선택</option></select>
                        </div>
                    </div>
                    <div className="form-item full-width">
                        <label>반려사유</label>
                        <input type="text" className="reason-input" />
                    </div>
                </section>

                {/* Car Info */}
                <section className="form-section">
                    <h4 className="section-title">*자동차 정보</h4>
                    <div className="section-grid four-cols">
                        <div className="form-item">
                            <label>업무 구분</label>
                            <select><option>선태</option></select>
                        </div>
                        <div className="form-item">
                            <label>증사매체</label>
                            <select><option>선택</option></select>
                        </div>
                        <div className="form-item">
                            <label>* 차대번호</label>
                            <div className="input-with-button">
                                <input type="text" />
                            </div>
                        </div>
                        <div className="form-item">
                            <label>임시번호판 상태</label>
                            <select><option>미지정</option></select>
                        </div>
                        <div className="form-item">
                            <label>사용연료</label>
                            <select><option>선택</option></select>
                        </div>
                    </div>
                </section>

                {/* Bottom Tabs Section */}
                <section className="bottom-tabs-section">
                    <div className="inner-tabs">
                        <div className="inner-tab active">소유자정보</div>
                        <div className="inner-tab">배송정보</div>
                        <div className="inner-tab">신규등록정보</div>
                        <div className="inner-tab">결제정보</div>
                    </div>
                    <div className="tab-content-box">
                        <div className="owner-info">
                            <div className="sub-title">● 대표소유자 정보</div>
                            <div className="owner-grid">
                                <div className="form-item">
                                    <label>신규등록 구분</label>
                                    <select><option>신조차 신규</option></select>
                                </div>
                                <div className="form-item">
                                    <label>업무구분</label>
                                    <select><option>중지예정</option></select>
                                </div>
                                <div className="form-item">
                                    <label>임차자기권함</label>
                                    <input type="text" />
                                </div>
                                <div className="form-item">
                                    <label>임차자기일자</label>
                                    <input type="date" />
                                </div>
                                <div className="form-item">
                                    <label>* 등록번호</label>
                                    <div className="input-split">
                                        <select><option>법인등록번호</option></select>
                                        <input type="text" />
                                    </div>
                                </div>
                                <div className="form-item">
                                    <label>성명(상호)</label>
                                    <input type="text" />
                                </div>
                                <div className="form-item">
                                    <label>사업자등록번호</label>
                                    <input type="text" />
                                </div>
                                <div className="form-item">
                                    <label>비율(%)</label>
                                    <input type="text" value="100" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
