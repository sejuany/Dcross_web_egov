import React from 'react';
import { ChevronRight, FileText } from 'lucide-react';

const ConfirmInfo = () => {

    return (
        <>
			<div className="wa-confirm-body">
		
		        {/* 소유자 정보 */}
		        <div className="wa-confirm-card">
		
		            <div className="wa-confirm-title">
		                소유자 정보
		                <ChevronRight size={18} />
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>대표소유자명</span>
		                <strong>홍길동</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>등록번호</span>
		                <strong>970304-2012345</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>등본상 주소</span>
		                <strong>서울시 은평구 ...</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>공동소유비율</span>
		                <strong>70%</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>휴대폰번호</span>
		                <strong>010-6678-0470</strong>
		            </div>
		
		        </div>
		
		        {/* 자동차 정보 */}
		        <div className="wa-confirm-card">
		
		            <div className="wa-confirm-title">
		                자동차 정보
		                <ChevronRight size={18} />
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>저공해 차량 여부</span>
		                <strong>미해당</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>다목적 차량 여부</span>
		                <strong>미해당</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>SPACE</span>
		                <strong>스페이스 서울</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>번호판 종류</span>
		                <strong>전기</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>선택 번호</span>
		                <strong>123가4567</strong>
		            </div>
		
		        </div>
		
		        {/* 신규등록 정보 */}
		        <div className="wa-confirm-card">
		
		            <div className="wa-confirm-title">
		                신규등록 정보
		                <ChevronRight size={18} />
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>채권처리</span>
		                <strong>매도</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>감면여부</span>
		                <strong>비감면</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>취득세 카드납부</span>
		                <strong>미선택</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>납부총액</span>
		                <strong>4,278,949원</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>결제자 연락처</span>
		                <strong>010-6678-0470</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>수수료 증빙</span>
		                <strong>현금영수증</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>환불정보</span>
		                <strong>신한은행 110-456-789012 / 홍길동</strong>
		            </div>
		        </div>
				
				{/* 첨부 서류 */}
				<button type="button" className="wa-attach-btn">
				    <FileText size={18} />
				    첨부 서류 업로드
				</button>
		
		    </div>
        </>
    );

};

export default ConfirmInfo;