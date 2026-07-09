import React, { useEffect, useMemo, useState } from 'react';

import { gf, log } from '../../../../utils/utils';

import LeaseCompanyModal from './LeaseCompanyModal';
import AddressSearch from '../../common/AddressSearch';

const OwnerUserLease = ({
    dsNewCar,
	setDsNewCar,
    handleChange
}) => {
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
	// 법인 등록번호 선택 시 화면 변경 
	const isCorporate = dsNewCar.REG_GB === 'B';
	// 등록번호 종류를 선택한 경우에만 주소 입력을 표시한다.
	// 초기 화면에서는 구매 방식 선택과 기본 정보 입력에 집중할 수 있도록 주소를 숨긴다.
	const showAddress = Boolean(dsNewCar.REG_GB);
	// 리스사 목록 
	const [leaseCompanies, setLeaseCompanies] = useState([]);
	
	useEffect(() => {
		// 리스사 목록 불러오기 
	    gf.getCodeList('ETC..', 'FLEASE')
	        .then(list => setLeaseCompanies(list.split('|')));
	}, []);

    return (
        <>
            {/* 리스사 선택 */}
            <div className="wa-form-row">
                <label className="wa-form-label">리스사 선택</label>

                <div className="wa-form-control">
                    <div className="wa-inline-group">
                        <select
                            className="wa-select wa-flex"
                            name="OWNER_BRANCH_ID"
                            data-type="newcar"
                            value={dsNewCar.OWNER_BRANCH_ID ?? ''}
                            onChange={handleChange}
                        >
                            <option value="">선택</option>
							
							{/* 리스사 목록 */}
							{leaseCompanies.map(company => (
							    <option key={company} value={company}>
							        {company}
							    </option>
							))}

                        </select>

                        <button 
							type="button" className="wa-lease-btn"
							onClick={() => setShowLeaseModal(true)}
						>
                            그 외 캐피탈
                        </button>
                    </div>
                </div>
            </div>
			
			{/* 그 외 캐피탈 선택 모달창 */}
			{showLeaseModal && (
			    <LeaseCompanyModal
			        onClose={() => setShowLeaseModal(false)}
			    />
			)}

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
                    <input
                        className="wa-input"
                        name="OWNER_NM"
                        data-type="newcar"
                        value={dsNewCar.OWNER_NM ?? ''}
                        onChange={handleChange}
                        placeholder="이름을 입력하세요"
                    />
                </div>
            </div>

            {/* 등록번호 */}
            <div className="wa-form-row">
                <label className="wa-form-label">등록번호</label>

                <div className="wa-form-control">
                    <div className="wa-inline-group">
                        <select
                            className="wa-select"
                            name="REG_GB"
                            data-type="newcar"
                            value={dsNewCar.REG_GB ?? ''}
                            onChange={handleChange}
                        >
							<option value="">선택</option>
							<option value="R">주민등록번호</option>
							<option value="F">외국인등록번호</option>
                            <option value="B">법인등록번호</option>
                        </select>

                        <input
                            className="wa-input"
                            name="REG_NO"
                            data-type="newcar"
                            value={dsNewCar.REG_NO ?? ''}
                            onChange={handleChange}
                            placeholder="앞 6자리"
                        />

                        <span className="wa-dash">-</span>

                        <input
                            className="wa-input"
                            placeholder="뒤 7자리"
                            readOnly
                        />
                    </div>
                </div>
            </div>
			
			{/* 사업자등록번호 */}
			{isCorporate && (
			    <div className="wa-form-row">
			        <label className="wa-form-label">
			            사업자등록번호
			        </label>

			        <div className="wa-form-control">
			            <div className="wa-inline-group">

			                <input
			                    className="wa-input"
			                    name="BIZ_NO1"
			                    maxLength={3}
			                    placeholder="앞 3자리"
			                />

			                <span className="wa-dash">-</span>

			                <input
			                    className="wa-input"
			                    name="BIZ_NO2"
			                    maxLength={2}
			                    placeholder="중간 2자리"
			                />

			                <span className="wa-dash">-</span>

			                <input
			                    className="wa-input"
			                    name="BIZ_NO3"
			                    maxLength={5}
			                    placeholder="뒤 5자리"
			                />

			            </div>
			        </div>
			    </div>
			)}
			
            {/* 휴대폰번호 */}
            <div className="wa-form-row">
                <label className="wa-form-label">휴대폰번호</label>

                <div className="wa-form-control">
                    <div className="wa-inline-group">
                        <input
                            className="wa-input phone"
                            name="MPHONE_NO"
                            data-type="newcar"
                            value={dsNewCar.MPHONE_NO ?? ''}
                            onChange={handleChange}
                            placeholder="010-1234-5678"
                        />
                    </div>
                </div>
            </div>
			

			{showAddress && (
					
				<AddressSearch
				    label={isCorporate ? '본점 소재지' : '등본상 주소'}
				    placeholder={
				        isCorporate
				            ? '사업자등록증에 기재된 본점 소재지 입력 (건물, 지번 또는 도로명 검색)'
				            : '건물, 지번 또는 도로명 검색'
				    }
					type="ADDRESS"
					prefix=""
					detailName="ADDRESS_DT"
				    dsNewCar={dsNewCar}
				    setDsNewCar={setDsNewCar}
				    handleChange={handleChange}
				/>
			)}

			{isCorporate && (
				<AddressSearch
				    label="사용본거지"
				    placeholder="자동차보험 가입 시 등록할 주소 입력 (건물, 지번 또는 도로명 검색)"
					type="BASE_ADDRESS"
					prefix="BASE_"
					detailName="BASE_ADDRESS_DT"
				    dsNewCar={dsNewCar}
				    setDsNewCar={setDsNewCar}
				    handleChange={handleChange}
				/>
			)}
			
        </>
    );
};

export default OwnerUserLease;