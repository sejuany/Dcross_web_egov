import React from 'react';
import { CircleHelp, CreditCard } from 'lucide-react';

const NewcarInfo = () => {

    return (
        <>
			<div className="wa-form-body">
		        {/* 채권 처리 선택 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">채권 처리 선택</label>
	
		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <button type="button" className="wa-option-btn wa-flex">매도(할인)</button>
		                    <button type="button" className="wa-option-btn wa-flex">매입</button>
		                </div>
		            </div>
		        </div>
	
		        {/* 감면 대상 */}
		        <button type="button" className="wa-sub-btn">
		            <CircleHelp size={18} />
		            감면 대상자 해당 시 클릭
		        </button>
	
		        {/* 카드 납부 */}
		        <button type="button" className="wa-sub-btn">
		            <CreditCard size={18} />
		            취득세 카드 납부 시 클릭
		        </button>
	
		        {/* 예상 납부금액 */}
		        <button type="button" className="wa-check-btn">
		            예상납부금액 확인
		        </button>
	
		        <div className="wa-estimate-guide">
		            채권/감면/취득세 카드납부 확인 후 클릭해주세요.
		        </div>
	
		        <hr className="wa-divider" />
	
		        {/* 수수료 증빙 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">수수료 증빙 선택</label>
	
		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <button type="button" className="wa-option-btn wa-flex">현금영수증</button>
		                    <button type="button" className="wa-option-btn wa-flex">세금계산서</button>
		                </div>
		            </div>
		        </div>
	
		        {/* 결제자 연락처 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">결제자 연락처</label>
	
		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <input className="wa-input phone" placeholder="010" />
		                    <span className="wa-dash">-</span>
		                    <input className="wa-input phone" placeholder="1234" />
		                    <span className="wa-dash">-</span>
		                    <input className="wa-input phone" placeholder="5678" />
		                </div>
		            </div>
		        </div>
	
		        {/* 환불정보 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">환불정보</label>
	
		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <select className="wa-select" style={{ width: '170px' }}>
		                        <option>은행 선택</option>
		                    </select>
	
		                    <input className="wa-input wa-flex" placeholder="계좌번호 입력" />
	
		                    <input className="wa-input" style={{ width: '130px' }} placeholder="예금주" />
		                </div>
		            </div>
		        </div>
	
		    </div>
        </>
    );

};

export default NewcarInfo;