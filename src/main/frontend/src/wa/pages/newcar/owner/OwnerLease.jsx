

import { Search, Users } from 'lucide-react';

const OwnerLease = () => {

    return (
		<>
		    {/* 리스사 선택 */}
		    <div className="wa-form-row">
		        <label className="wa-form-label">리스사 선택</label>
		
		        <div className="wa-form-control">
		            <div className="wa-inline-group">
		                <select className="wa-select wa-flex">
		                    <option>선택</option>
		                </select>
		
		                <button type="button" className="wa-lease-btn">
		                    그 외 캐피탈
		                </button>
		            </div>
		        </div>
		    </div>
		
		    {/* 이용자명 */}
		    <div className="wa-form-row">
		        <div className="wa-form-label-wrap">
		            <label className="wa-form-label">이용자명</label>
		
		            <label className="wa-form-sub-label">
		                계약자와 동일
		                <input type="checkbox" />
		            </label>
		        </div>
		
		        <div className="wa-form-control">
		            <input className="wa-input" placeholder="이름을 입력하세요" />
		        </div>
		    </div>
		
		    {/* 이용자 휴대폰번호 */}
		    <div className="wa-form-row">
		        <label className="wa-form-label">이용자 휴대폰번호</label>
		
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
		</>
    );

};

export default OwnerLease;