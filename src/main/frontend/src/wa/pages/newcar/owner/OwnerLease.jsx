
import React, { useMemo, useState, useEffect } from 'react';

import { gf, log } from '../../../../utils/utils';

// 그 외 캐피탈 모달창
import LeaseCompanyModal from './LeaseCompanyModal';
// 분리 입력 (주민번호, 사업자번호, 휴대폰 등)
import SplitInput from '../../common/SplitInput';

// 주소 기능
import useAddressHandler from '../../../../hooks/useAddressHandler';

const OwnerLease = ({
	dsNewCar,
	setDsNewCar,
	dsCarNoDetach,
	dsBaseList,
	setDsOwnerInfo,
	handleChange
}) => {
	// 외국인등록번호 선택 시 최종확인 단계에서 첨부해야 하는 서류를 안내한다.
	const showForeignerGuide = dsNewCar.REG_GB === 'F';
	// 법인 등록번호 선택 시 화면 변경 
		const isCorporate = dsNewCar.REG_GB === 'B';
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
	// 자주 사용하는 리스사
	const LEASE_COMPANIES = [
	    '우리금융캐피탈', '산은캐피탈', 'BNK캐피탈', 'NH농협캐피탈', 'KB캐피탈', '오릭스캐피탈',
	    '하나캐피탈'
	];
	// 주소 기능 추가
	const { handleLeaseCompany } = useAddressHandler({ dsNewCar, dsBaseList, setDsNewCar, setDsOwnerInfo });
	
	// 계약자와 동일
	const handleSameCustomer = (e) => {

	    setDsNewCar(prev => ({
	        ...prev,
	        OWNER_NM: e.target.checked
	            ? (dsCarNoDetach.CUSTOMER_NM ?? '')
	            : ''
	    }));

	};

	// 현재 선택된 리스사
	const currentCompany = useMemo(() => {

	    const base = dsBaseList.find(item =>
	        String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID)
	    );
		
	    if (!base) {
	        return null;
	    }

	    return {
	        BASE_ID: base.BASE_ID,
	        BASE_NM: base.BASE_NM.replace(/\(.*\)/, '').trim()
	    };

	}, [dsBaseList, dsNewCar.BASE_BRANCH_ID]);


	// 자주 사용하는 리스사 (본점만)
	const leaseCompanies = useMemo(() => {

	    return LEASE_COMPANIES
	        .map(company => {

	            const headOffice = dsBaseList.find(item =>
	                item.BASE_NM.includes(company) &&
	                item.BASE_NM.includes('(본점)')
	            );

	            return headOffice
	                ? {
	                    BASE_ID: headOffice.BASE_ID,
	                    BASE_NM: company
	                }
	                : null;

	        })
	        .filter(Boolean);

	}, [dsBaseList]);


	// Select 표시 목록
	const selectCompanies = useMemo(() => {

	    const list = [...leaseCompanies];

	    if (
	        currentCompany &&
	        !list.some(item => String(item.BASE_ID) === String(currentCompany.BASE_ID))
	    ) {
	        list.unshift(currentCompany);
	    }

	    return list;

	}, [leaseCompanies, currentCompany]);
	
	
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
						    value={dsNewCar.BASE_BRANCH_ID ?? ''}
						    onChange={e => handleLeaseCompany(e.target.value)}
						>
						    <option value="">선택</option>

							{selectCompanies.map(item => (
							    <option
							        key={item.BASE_ID}
							        value={item.BASE_ID}
							    >
							        {item.BASE_NM}
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
				    dsBaseList={dsBaseList}
				    onSelect={baseId => handleLeaseCompany(baseId)}
				    onClose={() => setShowLeaseModal(false)}
				/>
			)}

            {/* 이용자명 */}
			<div className="wa-form-row">

			    <div className="wa-form-label-wrap">

			        <label className="wa-form-label">리스 계약자명</label>

					<label className="wa-form-sub-label">
			            계약자와 동일
			            <input type="checkbox" onChange={handleSameCustomer} />
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
						    <option value="C">사업자번호</option>
						</select>

						{dsNewCar.REG_GB === 'C' ? (
						    <SplitInput
						        value={dsNewCar.BIZ_NO}
						        lengths={[3, 2, 5]}
						        placeholders={['123', '45', '67890']}
						        onChange={value =>
						            setDsNewCar(prev => ({
						                ...prev,
						                BIZ_NO: value
						            }))
						        }
						    />
						) : (
						    <SplitInput
						        value={dsNewCar.REG_NO}
						        lengths={[6, 7]}
						        onChange={value =>
						            setDsNewCar(prev => ({
						                ...prev,
						                REG_NO: value
						            }))
						        }
						    />
						)}

			        </div>

					{showForeignerGuide && (
					    <div className="wa-guide-text">
					        *최종확인 페이지에서 외국인 등록증을 첨부하여 주십시오.
					    </div>
					)}
			    </div>
			</div>

			{/* 휴대폰번호 */}
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 계약자 등록번호
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<SplitInput
						    value={dsNewCar.MPHONE_NO}
						    lengths={[3, 4, 4]}
						    placeholders={['010', '1234', '5678']}
						    onChange={value =>
						        setDsNewCar(prev => ({
						            ...prev,
						            MPHONE_NO: value
						        }))
						    }
						/>
			        </div>
			    </div>
			</div>
			
        </>
    );
};

export default OwnerLease;