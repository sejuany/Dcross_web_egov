import { CircleAlert } from 'lucide-react';

const OwnerCorporate = () => {

    return (
		<div className="owner-corporate-box">
	        <div className="owner-corporate-info">
	            <CircleAlert
	                className="owner-corporate-icon"
	                size={24}
	            />
	
	            <div className="owner-corporate-text">
					<p>렌트 차량 등록은 렌터카 회사로 문의해 주시기 바랍니다.</p>
					<p>현재 프로세스는 종료되며, 해당 건은 직접등록으로 처리됩니다.</p>
					<br/>
					<b>'확인'</b><p className="inline-p">을 누르면 판매 데이터가 저장됩니다.</p>
	            </div>
	        </div>
		</div>
    );
};

export default OwnerCorporate;