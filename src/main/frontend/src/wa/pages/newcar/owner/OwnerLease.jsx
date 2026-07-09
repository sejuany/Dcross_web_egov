
import React, { useState, useEffect } from 'react';

import { gf, log } from '../../../../utils/utils';
import LeaseCompanyModal from './LeaseCompanyModal';


const OwnerLease = ({
    dsNewCar,
    handleChange,
}) => {
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
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

			    <label className="wa-form-label">
			        리스사 선택
			    </label>

			    <div className="wa-form-control">

			        <div className="wa-inline-group">

			            <select
			                className="wa-select wa-flex"
			                name="LEASE_COMPANY"
			                data-type="newcar"
			                value={dsNewCar.LEASE_COMPANY ?? ''}
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
			                type="button"
			                className="wa-lease-btn"
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

            {/* 이용자명 */}
			<div className="wa-form-row">

			    <div className="wa-form-label-wrap">

			        <label className="wa-form-label">
			            리스 계약자명
			        </label>

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
			            placeholder="리스 계약자명을 입력하세요"
			        />

			    </div>

			</div>
			
			{/* 등록번호 */}
			<div className="wa-form-row">

			    <label className="wa-form-label">
			        리스 계약자 등록번호
			    </label>

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
			                <option value="C">사업자등록번호</option>
			            </select>

			            {dsNewCar.REG_GB === 'C' ? (
			                <>
			                    <input
			                        className="wa-input"
			                        placeholder="앞 3자리"
			                    />

			                    <span className="wa-dash">-</span>

			                    <input
			                        className="wa-input"
			                        placeholder="중간 2자리"
			                    />

			                    <span className="wa-dash">-</span>

			                    <input
			                        className="wa-input"
			                        placeholder="뒤 5자리"
			                    />
			                </>
			            ) : (
			                <>
			                    <input
			                        className="wa-input"
			                        placeholder="앞 6자리"
			                    />

			                    <span className="wa-dash">-</span>

			                    <input
			                        className="wa-input"
			                        placeholder="뒤 7자리"
			                    />
			                </>
			            )}

			        </div>

			    </div>

			</div>
			
			{/* 휴대폰번호 */}
			<div className="wa-form-row">

			    <label className="wa-form-label">
			        리스 계약자 휴대폰번호
			    </label>

			    <div className="wa-form-control">

			        <div className="wa-inline-group">

			            <input
			                className="wa-input"
			                name="MPHONE_NO1"
			                maxLength={3}
			                placeholder="010"
			            />

			            <span className="wa-dash">-</span>

			            <input
			                className="wa-input"
			                name="MPHONE_NO2"
			                maxLength={4}
			                placeholder="1234"
			            />

			            <span className="wa-dash">-</span>

			            <input
			                className="wa-input"
			                name="MPHONE_NO3"
			                maxLength={4}
			                placeholder="5678"
			            />

			        </div>

			    </div>

			</div>
        </>
    );
};

export default OwnerLease;