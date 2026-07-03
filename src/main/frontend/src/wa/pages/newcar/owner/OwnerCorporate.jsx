import { Search, Users } from 'lucide-react';
import { CircleHelp } from 'lucide-react';
	
const OwnerCorporate = () => {

    return (
		    <>
		        {/* 대표소유자 */}
		        <div className="wa-form-row">
		            <div className="wa-form-label-wrap">
		                <label className="wa-form-label">대표소유자 상호명</label>

		                <label className="wa-form-sub-label">
		                    계약자와 동일
		                    <input type="checkbox" />
		                </label>
		            </div>

		            <div className="wa-form-control">
		                <input className="wa-input" placeholder="상호명을 입력하세요" />
		            </div>
		        </div>

		        {/* 법인등록번호 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">법인등록번호</label>

		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <input className="wa-input" placeholder="앞 6자리" />
		                    <span className="wa-dash">-</span>
		                    <input className="wa-input" placeholder="뒤 7자리" />
		                </div>
		            </div>
		        </div>

		        {/* 사업자등록번호 */}
		        <div className="wa-form-row">
		            <label className="wa-form-label">사업자등록번호</label>

		            <div className="wa-form-control">
		                <div className="wa-inline-group">
		                    <input className="wa-input" placeholder="앞 3자리" />
		                    <span className="wa-dash">-</span>
		                    <input className="wa-input" placeholder="중간 2자리" />
		                    <span className="wa-dash">-</span>
		                    <input className="wa-input" placeholder="뒤 5자리" />
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

		        {/* 공동명의 */}
		        <button type="button" className="wa-joint-btn">
		            <Users size={18} className="wa-joint-icon" />
		            공동 명의 시 클릭
		        </button>
	        </>
	    );

	};

	export default OwnerCorporate;