
import React, { useId, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import { gf } from '../../../../utils/utils';

// 그 외 캐피탈 모달창
import LeaseCompanyModal from './LeaseCompanyModal';
import LeaseAddressEditModal from './LeaseAddressEditModal';
import AddressSearch from '../../common/AddressSearch';
// 분리 입력 (주민번호, 사업자번호, 휴대폰 등)
import SplitInput from '../../common/SplitInput';
import PrivateBusinessChoice from './PrivateBusinessChoice';

// 주소 기능
import useAddressHandler from '../../../../hooks/useAddressHandler';

const LeaseAddressFields = ({ id, label, address, detail, postNo }) => (
	<div className="wa-lease-address-fields">
		<input
			id={id}
			className="wa-input wa-lease-address"
			value={address ?? ''}
			disabled
		/>
		<input
			className="wa-input wa-lease-address"
			aria-label={`${label} 상세주소`}
			placeholder="상세주소"
			value={detail ?? ''}
			disabled
		/>
		<input
			className="wa-input wa-lease-address"
			aria-label={`${label} 우편번호`}
			placeholder="우편번호"
			value={postNo ?? ''}
			disabled
		/>
	</div>
);

const OwnerLease = ({
	dsService,
	dsNewCar,
	setDsNewCar,
	dsOwnerInfo,
	dsCarNoDetach,
	dsBaseList,
	setDsOwnerInfo,
    ownerType,
    onOwnerTypeChange,
	handleChange,
	onSave
}) => {
	const addressId = useId();
	const addressRequestRef = useRef(null);
	const [showAddressEditModal, setShowAddressEditModal] = useState(false);
	// 그 외 리스사 모달창
	const [showLeaseModal, setShowLeaseModal] = useState(false);
	// 자주 사용하는 리스사
	const LEASE_COMPANIES = [
	    '우리금융캐피탈', '산은캐피탈', '비엔케이캐피탈', '엔에이치농협캐피탈', '케이비캐피탈', '오릭스캐피탈', '하나캐피탈'
	];
	// 주소 기능 추가
	const {
		handleLeaseCompany,
		handleAddressSelect,
		handleSameAddress,
		handleClearAddress
	} = useAddressHandler({ dsNewCar, dsBaseList, setDsNewCar, setDsOwnerInfo });

	const notifyAddressChange = async ({ target, address, detail, postNo }) => {
		if (!dsService.SERVICE_ID) {
			await gf.alert('리스 신청건을 먼저 저장해 주세요.');
			return false;
		}

		try {
			const response = await axios.post('/api/newcar/lease-address-change/notify', {
				SERVICE_ID: dsService.SERVICE_ID,
				BASE_BRANCH_ID: dsNewCar.BASE_BRANCH_ID,
				TARGET: target,
				ADDRESS: address,
				ADDRESS_DT: detail,
				POST_NO: postNo
			});
			setDsNewCar(prev => ({ ...prev, MEMO_TX: response.data.data.MEMO_TX }));
		} catch (error) {
			await gf.alert(error.response?.data?.message || '리스 주소 수정 요청을 등록하지 못했습니다.');
			return false;
		}

		await gf.alert('요청이 완료되었습니다.');
		return true;
	};
	
	// 계약자와 동일
	const handleSameCustomer = (e) => {

	    setDsOwnerInfo(prev => ({
	        ...prev,
	        DEBTOR_NM: e.target.checked
	            ? (dsCarNoDetach.CUSTOMER_NM ?? '')
	            : ''
	    }));

	};

	// 선택된 리스사 정보를 화면 표시용 형식으로 변환한다.
	const currentCompany = useMemo(() => {

	    // 선택된 지점(BASE_ID)과 일치하는 리스사 조회
	    const base = dsBaseList.find(item =>
	        String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID)
	    );
		
	    if (!base) {
	        return null;
	    }

	    // 화면 표시를 위해 회사명에서 '주식회사'와 지점명(괄호)을 제거
	    return {
	        BASE_ID: base.BASE_ID,
	        BASE_NM: base.BASE_NM.replace(/주식회사/g, '').replace(/\(.*?\)/g, '').trim(),
			BASE_CD: base.BASE_CD
	    };

	}, [dsBaseList, dsNewCar.BASE_BRANCH_ID]);
	

	// 자주 사용하는 리스사 (본점만)
	const leaseCompanies = useMemo(() => {

	    return LEASE_COMPANIES
	        .map(company => {

				const headOffice = dsBaseList.find(item =>
				    item.BASE_NM.includes('(본점)') &&
				    (
				        item.BASE_NM.includes(company) ||
				        company.includes(item.BASE_NM.replace(/주식회사/g, '').replace(/\(.*?\)/g, '').trim())
				    )
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
						    value={String(dsNewCar.BASE_BRANCH_ID ?? '')}
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
			
			{currentCompany?.BASE_NM !== '직접입력' && (
				<>
					<div className="wa-form-row wa-lease-address-row">
						<label className="wa-form-label" htmlFor={`${addressId}-head-office`}>리스 본점 소재지</label>
						<LeaseAddressFields
							id={`${addressId}-head-office`}
							label="리스 본점 소재지"
							address={dsNewCar.ADDRESS}
							detail={dsNewCar.ADDRESS_DT}
							postNo={dsNewCar.POST_NO}
						/>
					</div>
					<div className="wa-form-row wa-lease-address-row">
						<div className="wa-form-label-wrap">
							<label className="wa-form-label" htmlFor={`${addressId}-base`}>리스 사용본거지</label>
							<button
								ref={addressRequestRef}
								type="button"
								className="wa-lease-address-request"
								disabled={!dsNewCar.BASE_BRANCH_ID}
								onClick={() => setShowAddressEditModal(true)}
							>
								주소 수정 요청
							</button>
						</div>
						<LeaseAddressFields
							id={`${addressId}-base`}
							label="리스 사용본거지"
							address={dsNewCar.BASE_ADDRESS}
							detail={dsNewCar.BASE_ADDRESS_DT}
							postNo={dsNewCar.BASE_POST_NO}
						/>
					</div>
					{showAddressEditModal && (
						<LeaseAddressEditModal
							dsNewCar={dsNewCar}
							onConfirm={notifyAddressChange}
							onClose={() => {
								setShowAddressEditModal(false);
								addressRequestRef.current?.focus();
							}}
						/>
					)}
				</>
			)}

			{/* 직접입력 리스사는 TR_NEWCAR의 기존 법인/주소 컬럼에 저장한다. */}
			{currentCompany?.BASE_NM === '직접입력' && (
				<>
					<h3 className="wa-form-section-title">리스사 직접입력 정보</h3>

					<div className="wa-form-row">
					    <label className="wa-form-label">리스사명</label>
					    <div className="wa-form-control">
					        <input
					            className="wa-input"
					            autoComplete="off"
					            name="OWNER_NM"
					            data-type="newcar"
					            value={dsNewCar.OWNER_NM ?? ''}
					            onChange={handleChange}
					            placeholder="리스사명을 입력하세요"
					            maxLength={50}
					        />
					    </div>
					</div>

					<div className="wa-form-row">
					    <label className="wa-form-label">리스사 법인등록번호</label>
					    <div className="wa-form-control">
					        <div className="wa-inline-group">
					            <SplitInput
					                value={dsNewCar.REG_NO}
					                lengths={[6, 7]}
					                inputClassName="wa-number-center"
					                onChange={value => setDsNewCar(prev => ({ ...prev, REG_GB: 'B', REG_NO: value }))}
					            />
					        </div>
					    </div>
					</div>

					<div className="wa-form-row">
					    <label className="wa-form-label">리스사 사업자등록번호</label>
					    <div className="wa-form-control">
					        <div className="wa-inline-group">
					            <SplitInput
					                value={dsNewCar.BIZ_NO}
					                lengths={[3, 2, 5]}
					                inputClassName="wa-number-center"
					                placeholders={['000', '00', '00000']}
					                onChange={value => setDsNewCar(prev => ({ ...prev, BIZ_NO: value }))}
					            />
					        </div>
					    </div>
					</div>

					<AddressSearch
					    label="리스사 본점 주소"
					    placeholder="건물, 지번 또는 도로명 검색"
					    type="ADDRESS"
					    detailName="ADDRESS_DT"
					    postName="POST_NO"
					    dsNewCar={dsNewCar}
					    handleChange={handleChange}
					    onSelect={handleAddressSelect}
					    onClear={handleClearAddress}
					    addressMaxLength={70}
					    detailMaxLength={70}
					/>

					<AddressSearch
					    label="리스사 사용본거지"
					    sameLabel="본점 주소"
					    placeholder="건물, 지번 또는 도로명 검색"
					    type="BASE_ADDRESS"
					    detailName="BASE_ADDRESS_DT"
					    postName="BASE_POST_NO"
					    dsNewCar={dsNewCar}
					    handleChange={handleChange}
					    showSameCheckbox
					    onSelect={handleAddressSelect}
					    onClear={handleClearAddress}
					    onSameChange={handleSameAddress}
					    addressMaxLength={70}
					    detailMaxLength={70}
					/>
				</>
			)}
			
			{/* 그 외 캐피탈 선택 모달창 */}
			{showLeaseModal && (
				<LeaseCompanyModal
					dsService={dsService}
					dsNewCar={dsNewCar}
				    dsBaseList={dsBaseList}
					handleChange={handleChange}
				    onSelect={baseId => handleLeaseCompany(baseId)}
				    onClose={() => setShowLeaseModal(false)}
					onSave={onSave}
				/>
			)}

			<hr className="wa-divider" />
			<h3 className="wa-form-section-title">리스 계약자 정보</h3>

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
	                    autoComplete="off"
	                    name="DEBTOR_NM"
	                    data-type="owner"
	                    value={dsOwnerInfo.DEBTOR_NM ?? ''}
	                    onChange={handleChange}
	                    placeholder="이름을 입력하세요"
	                />

			    </div>

			</div>
            <PrivateBusinessChoice label="리스 계약자 구분" value={ownerType} onChange={onOwnerTypeChange} />

			{ownerType && (
			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 계약자 등록번호
			    </label>
			    <div className="wa-form-control">
			        <div className="wa-inline-group">
						<select
						    className="wa-select"
						    name="DEBTOR_GB"
						    data-type="owner"
						    value={dsOwnerInfo.DEBTOR_GB ?? ''}
						    onChange={handleChange}
						>
						    <option value="">선택</option>
						    {ownerType !== 'CORPORATE' && <option value="R">주민등록번호</option>}
						    {ownerType !== 'CORPORATE' && <option value="F">외국인등록번호</option>}
						    {(!ownerType || ownerType === 'CORPORATE') && <option value="B">사업자번호</option>}
						</select>

						{dsOwnerInfo.DEBTOR_GB === 'B' ? (
						    <SplitInput
								key={dsOwnerInfo.DEBTOR_GB}
						        value={dsOwnerInfo.DEBTOR_BIZ_NO}
						        lengths={[3, 2, 5]}
						        placeholders={['000', '00', '00000']}
								inputClassName="wa-number-center"
						        onChange={value =>
						            setDsOwnerInfo(prev => ({
						                ...prev,
						                DEBTOR_BIZ_NO: value
						            }))
						        }
						    />
						) : (
						    <SplitInput
								key={dsOwnerInfo.DEBTOR_GB}
						        value={dsOwnerInfo.DEBTOR_REG_NO}
						        lengths={[6, 7]}
								maskLast={['R', 'F'].includes(dsOwnerInfo.DEBTOR_GB)}
						        onChange={value =>
						            setDsOwnerInfo(prev => ({
						                ...prev,
						                DEBTOR_REG_NO: value
						            }))
						        }
						    />
						)}

			        </div>
			    </div>
			</div>
			)}

			<div className="wa-form-row">
			    <label className="wa-form-label">
			        리스 계약자 휴대폰번호
			    </label>
			    <div className="wa-form-control">
					<div className="wa-inline-group">
						<SplitInput
						    value={dsOwnerInfo.DEBTOR_TEL_NO}
						    lengths={[3, 4, 4]}
							fixedValues={['010']}
							placeholders={['010', '0000', '0000']}
							inputClassName="wa-number-center"
						    onChange={value =>
						        setDsOwnerInfo(prev => ({
						            ...prev,
						            DEBTOR_TEL_NO: value
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
