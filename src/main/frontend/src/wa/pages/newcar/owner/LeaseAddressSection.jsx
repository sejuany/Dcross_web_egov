import React, { useId, useRef, useState } from 'react';
import axios from 'axios';

import { gf } from '../../../../utils/utils';
import LeaseAddressEditModal from './LeaseAddressEditModal';

const LeaseAddressSection = ({ dsService, dsNewCar, dsOwnerInfo, setDsNewCar }) => {
	const id = useId();
	const requestRef = useRef(null);
	const [showModal, setShowModal] = useState(false);
	const isUserLease = dsNewCar.PROC_CD === 'C';
	const addresses = isUserLease ? [
		{
			key: 'head',
			label: '리스 본점 소재지',
			address: dsOwnerInfo.DEBTOR_ADDR,
			detail: dsOwnerInfo.DEBTOR_ADDR_DT,
			postNo: dsOwnerInfo.DEBTOR_ROAD_CD
		}
	] : [
		{
			key: 'head',
			label: '리스 본점 소재지',
			address: dsNewCar.ADDRESS,
			detail: dsNewCar.ADDRESS_DT,
			postNo: dsNewCar.POST_NO
		},
		{
			key: 'base',
			label: '리스 사용본거지',
			address: dsNewCar.BASE_ADDRESS,
			detail: dsNewCar.BASE_ADDRESS_DT,
			postNo: dsNewCar.BASE_POST_NO
		}
	];

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

	return (
		<>
			{addresses.map(({ key, label, address, detail, postNo }) => (
				<div className={`wa-form-row wa-lease-address-row${isUserLease ? ' wa-lease-user-address-row' : ''}`} key={key}>
					<div className="wa-form-label-wrap">
						<label className="wa-form-label" htmlFor={`${id}-${key}`}>{label}</label>
						{(isUserLease || key === 'base') && (
							<button
								ref={requestRef}
								type="button"
								className="wa-lease-address-request"
								disabled={!dsNewCar.BASE_BRANCH_ID}
								onClick={() => setShowModal(true)}
							>
								주소 수정 요청
							</button>
						)}
					</div>
					<div className="wa-lease-address-fields">
						<input
							id={`${id}-${key}`}
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
				</div>
			))}
			{showModal && (
				<LeaseAddressEditModal
					dsNewCar={dsNewCar}
					dsOwnerInfo={dsOwnerInfo}
					onConfirm={notifyAddressChange}
					onClose={() => {
						setShowModal(false);
						requestRef.current?.focus();
					}}
				/>
			)}
		</>
	);
};

export default LeaseAddressSection;
