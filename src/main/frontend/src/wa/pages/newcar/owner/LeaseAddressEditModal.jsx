import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { gf } from '../../../../utils/utils';
import AddressSearch from '../../common/AddressSearch';
import '../../../styles/LeaseCompanyModal.css';

const CHANGE_REASONS = {
	'address-change': '본점(지점) 주소 변경',
	'branch-closed': '폐점으로 타 지점 입력',
	other: '기타'
};

const LeaseAddressEditModal = ({ dsNewCar, onClose, onConfirm }) => {
	const id = useId();
	const closeButtonRef = useRef(null);
	const [target, setTarget] = useState('head');
	const [draft, setDraft] = useState(null);
	const [reason, setReason] = useState('');
	const [otherReason, setOtherReason] = useState('');
	const [confirming, setConfirming] = useState(false);
	const addresses = [
		{
			key: 'head',
			label: '본점 소재지',
			address: dsNewCar.ADDRESS,
			detail: dsNewCar.ADDRESS_DT,
			postNo: dsNewCar.POST_NO
		},
		{
			key: 'base',
			label: '사용본거지',
			address: dsNewCar.BASE_ADDRESS,
			detail: dsNewCar.BASE_ADDRESS_DT,
			postNo: dsNewCar.BASE_POST_NO
		}
	];

	useEffect(() => {
		closeButtonRef.current?.focus();
	}, []);

	const handleConfirm = async () => {
		if (!reason) {
			await gf.alert('변경사유를 선택해 주세요.');
			return;
		}

		const savedAddress = addresses.find(item => item.key === target);
		const address = draft?.address?.trim() ?? '';
		const detail = draft?.detail?.trim() ?? '';
		const postNo = String(draft?.postNo ?? '').trim();
		if (!address || (
			address === (savedAddress.address ?? '').trim() &&
			detail === (savedAddress.detail ?? '').trim() &&
			postNo === String(savedAddress.postNo ?? '').trim()
		)) {
			await gf.alert('변경할 주소를 입력해 주세요.');
			return;
		}

		if (reason === 'other' && !otherReason.trim()) {
			await gf.alert('사유를 입력해 주세요.');
			return;
		}

		const reasonText = reason === 'other' ? `기타 (${otherReason.trim()})` : CHANGE_REASONS[reason];
		const addressText = [postNo && `(${postNo})`, address, detail].filter(Boolean).join(' ');
		setConfirming(true);
		try {
			const confirmed = await gf.confirm(
				`${savedAddress.label}: ${addressText}\n변경사유: ${reasonText}\n\n변경하시겠습니까?`,
				'리스 주소 수정 확인',
				{ okText: '예', cancelText: '아니오' }
			);
			if (!confirmed) return;

			if (await onConfirm({ target, address, detail, postNo, reason: reasonText })) {
				onClose();
			}
		} finally {
			setConfirming(false);
		}
	};

	const handleDialogKeyDown = (event) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			if (!confirming) onClose();
		}

		if (event.key === 'Tab') {
			const controls = event.currentTarget.querySelectorAll('button:enabled, input:enabled, select:enabled');
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (event.target === (event.shiftKey ? first : last)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			}
		}
	};

	return (
		<div className="wa-modal-overlay">
			<section
				className="wa-lease-modal wa-lease-address-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${id}-title`}
				onKeyDown={handleDialogKeyDown}
			>
				<div className="wa-lease-modal-header">
					<span id={`${id}-title`}>리스 주소 수정</span>
					<button ref={closeButtonRef} type="button" className="wa-modal-close" aria-label="닫기" onClick={onClose} disabled={confirming}>
						<X size={20} />
					</button>
				</div>

				<div className="wa-lease-modal-body">
					<div className="wa-lease-address-guide">
						<strong>입력하신 주소는 확인을 거쳐 변경됩니다.</strong>
						<p>사용본거지의 경우, 기존 주소와 동일한 지점의 변경된 주소를 입력해 주세요.</p>
						<p>※ 다른 지점의 주소를 입력한 경우, 반영되지 않습니다.</p>
					</div>

					<div role="radiogroup" aria-label="변경할 주소">
						{addresses.map(({ key, label, ...savedAddress }) => {
							const selected = target === key;
							return (
								<div className="wa-lease-edit-address" key={key}>
									<label className="wa-lease-edit-target">
										<input
											type="radio"
											name={`${id}-target`}
											checked={selected}
											onChange={() => {
												setTarget(key);
												setDraft(null);
											}}
										/>
										{label}
									</label>
									<fieldset className="wa-lease-edit-fields" disabled={!selected}>
										<AddressSearch
											key={selected ? 'editing' : 'saved'}
											addressLabel={`${label} 주소`}
											placeholder="건물, 지번 또는 도로명 검색"
											type="address"
											detailName="detail"
											postName="postNo"
											addressMaxLength={70}
											detailMaxLength={70}
											data={selected && draft ? draft : savedAddress}
											onAddressFocus={() => setDraft(current => current ?? {})}
											handleChange={({ target: { name, value } }) => {
												setDraft(current => ({ ...(current ?? savedAddress), [name]: value }));
											}}
											onSelect={(_, result) => setDraft({ address: result.ADDR, postNo: result.POST_NO })}
											onClear={() => setDraft({})}
											confirmMissingDetail={false}
										/>
									</fieldset>
								</div>
							);
						})}
					</div>

					<div className="wa-lease-edit-footer">
						<label htmlFor={`${id}-reason`}>변경사유</label>
						<div className="wa-lease-edit-reason">
							<select id={`${id}-reason`} className="wa-select" value={reason} onChange={event => setReason(event.target.value)}>
								<option value="">선택</option>
								{Object.entries(CHANGE_REASONS).map(([value, label]) => (
									<option key={value} value={value}>{label}</option>
								))}
							</select>
							{reason === 'other' && (
								<input
									type="text"
									className="wa-input"
									aria-label="기타 변경사유"
									placeholder="사유를 입력해 주세요."
									value={otherReason}
									onChange={event => setOtherReason(event.target.value)}
								/>
							)}
						</div>
						<button type="button" className="wa-primary-btn" onClick={handleConfirm} disabled={confirming}>확인</button>
					</div>
				</div>
			</section>
		</div>
	);
};

export default LeaseAddressEditModal;
