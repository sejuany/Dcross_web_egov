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
	                <p>렌트 차량의 등록은 렌터카 회사로 문의하시기 바랍니다.</p>
	                <p>프로세스는 지금 완료하겠습니다.</p>
	
	                <br />
	
	                <p>해당 데이터는 직접등록 건으로 처리되며,</p>
	                <p>판매 데이터는 저장됩니다.</p>
	            </div>
	        </div>
		</div>
    );
};

export default OwnerCorporate;