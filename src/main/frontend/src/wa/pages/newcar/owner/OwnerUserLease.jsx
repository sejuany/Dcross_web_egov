import { Search, Users } from 'lucide-react';
import { CircleHelp } from 'lucide-react';
	
const OwnerUserLease = () => {

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
	
	        {/* 리스 종료일 */}
	        <div className="wa-form-row">
	            <label className="wa-form-label">리스 종료일</label>
	
	            <div className="wa-form-control">
	                <div className="wa-inline-group">
	                    <select className="wa-select">
	                        <option>년도</option>
	                    </select>
	
	                    <select className="wa-select">
	                        <option>월</option>
	                    </select>
	
	                    <select className="wa-select">
	                        <option>일</option>
	                    </select>
	                </div>
	            </div>
	        </div>
	
	        <hr className="wa-divider" />
	
	        {/* 대표소유자 */}
	        <div className="wa-form-row">
	            <div className="wa-form-label-wrap">
	                <label className="wa-form-label">대표 소유자명(상호)</label>
	
	                <label className="wa-form-sub-label">
	                    계약자와 동일
	                    <input type="checkbox" />
	                </label>
	            </div>
	
	            <div className="wa-form-control">
	                <input className="wa-input" placeholder="이름을 입력하세요" />
	            </div>
	        </div>
	
	        {/* 등록번호 */}
	        <div className="wa-form-row">
	            <label className="wa-form-label">등록번호</label>
	
	            <div className="wa-form-control">
	                <div className="wa-inline-group">
	                    <select className="wa-select">
	                        <option>법인등록번호</option>
	                    </select>
	
	                    <input className="wa-input" placeholder="앞 6자리" />
	                    <span className="wa-dash">-</span>
	                    <input className="wa-input" placeholder="뒤 7자리" />
	                </div>
	            </div>
	        </div>
	
	        {/* 휴대폰번호 */}
	        <div className="wa-form-row">
	            <label className="wa-form-label">휴대폰번호</label>
	
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
	
	        {/* 본점 소재지 */}
	        <div className="wa-form-row">
	            <div className="wa-form-label-wrap">
	                <label className="wa-form-label">
	                    본점 소재지
	                    <CircleHelp size={14} />
	                </label>
	            </div>
	
	            <div className="wa-form-control">
	                <div className="wa-address-wrap">
	                    <input className="wa-input" placeholder="건물, 지번 또는 도로명 검색" />
	
	                    <button type="button" className="wa-search-btn">
	                        <Search size={18} />
	                    </button>
	                </div>
	
	                <input className="wa-input" placeholder="상세주소 입력" />
	            </div>
	        </div>
	
	        {/* 사업장 소재지 */}
	        <div className="wa-form-row">
	            <div className="wa-form-label-wrap">
	                <label className="wa-form-label">
	                    사업장 소재지
	                    <CircleHelp size={14} />
	                </label>
	
	                <label className="wa-form-sub-label">
	                    본점 소재지와 동일
	                    <input type="checkbox" />
	                </label>
	            </div>
	
	            <div className="wa-form-control">
	                <div className="wa-address-wrap">
	                    <input
	                        className="wa-input"
	                        placeholder="건물, 지번 또는 도로명 검색 (지점 등 본점 소재지와 같으면 체크, 다르면 입력)"
	                    />
	
	                    <button type="button" className="wa-search-btn">
	                        <Search size={18} />
	                    </button>
	                </div>
	
	                <input className="wa-input" placeholder="상세주소 입력" />
	            </div>
	        </div>
	    </>
    );

};

export default OwnerUserLease;