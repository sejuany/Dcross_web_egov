import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import '../../styles/WaNewcarRequest.css';

const WaTaxReceiptModal = ({
	open,
	onClose,
	dsTaxReceipt,
	dsNewCar
}) => {

	const [receiptType, setReceiptType] = useState('');
	const isPrivateBusinessEligible = (
		(
			(dsNewCar?.TASK_CD === 'NORML' && dsNewCar?.PROC_CD === 'I')
			|| (dsNewCar?.TASK_CD === 'LEASE' && dsNewCar?.PROC_CD === 'C')
		)
		&& ['R', 'F'].includes(dsNewCar?.REG_GB)
	);

	useEffect(() => {
		if (open) {
			setReceiptType(dsTaxReceipt?.GUBUN || '');
		}
	}, [open, dsTaxReceipt]);


	if (!open) {
		return null;
	}


	const handleReceiptSelect = (type) => {
		setReceiptType(type);
	};


	return (
		<div className="wa-attach-modal-backdrop">
			<div className="wa-attach-modal">
				{/* header */}
				<div className="wa-attach-modal-header">
					<div>
						<h3>수수료 증빙 정보</h3>
					</div>
					<button
						type="button"
						className="wa-attach-modal-close"
						onClick={onClose}
					>
						<X size={18} />
					</button>
				</div>

				{/* body */}
				<div className="wa-attach-modal-body single">
					<section className="wa-attach-doc-section">
						<div className="wa-form-row">
							<label className="wa-form-label">
								수수료 증빙 정보
							</label>
							<div className="wa-form-control">
								{receiptType === 'CASH' && (
									<div className="wa-receipt-panel">
										<div className="wa-receipt-panel-header">
											<strong>
												현금영수증 정보
											</strong>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												휴대폰번호
											</label>

											<div className="wa-form-control">
												{dsTaxReceipt?.PHONE_NO || '-'}
											</div>
										</div>

										{isPrivateBusinessEligible && (
											<div className="wa-form-row compact">
												<label className="wa-form-label">개인사업자 여부</label>
												<div className="wa-form-control">
													{dsTaxReceipt?.ETC1 === 'Y' ? '예' : '아니오'}
												</div>
											</div>
										)}
									</div>
								)}

								{receiptType === 'TAX' && (
									<div className="wa-receipt-panel">
										<div className="wa-receipt-panel-header">
											<strong>
												세금계산서 정보
											</strong>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												등록번호
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.REG_NO || '-'}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												상호명
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.COMPANY_NM || '-'}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												대표자명
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.NAME || '-'}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												사업장 주소
											</label>
											<div className="wa-form-control">
												{`${dsTaxReceipt?.ADDR || '-'} ${dsTaxReceipt?.ADDR_DT || ''}`}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												업태
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.BUSINESS_TYPE || '-'}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												업종
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.INDUSTRY_TYPE || '-'}
											</div>
										</div>

										{isPrivateBusinessEligible && (
											<div className="wa-form-row compact">
												<label className="wa-form-label">개인사업자 여부</label>
												<div className="wa-form-control">
													{dsTaxReceipt?.ETC1 === 'Y' ? '예' : '아니오'}
												</div>
											</div>
										)}

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												이메일 주소
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.MAIL1 || '-'}
											</div>
										</div>

										<div className="wa-form-row compact">
											<label className="wa-form-label">
												이메일 주소2
											</label>
											<div className="wa-form-control">
												{dsTaxReceipt?.MAIL2 || '-'}
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
};


export default WaTaxReceiptModal;
