import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReceiptContent from './ReceiptContent';
import '../../styles/WaReceipt.css';

const fetchJson = async (url, signal) => {
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`영수증 조회에 실패했습니다. (${response.status})`
		);
	}
	return response.json();
};

const WaPaymentReceiptMulti = () => {
	const [searchParams] = useSearchParams();
	const [receiptList, setReceiptList] = useState([]);
	const [bankCodes, setBankCodes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const serviceIds = useMemo(() => {
		return (searchParams.get('serviceIds') || '').split(',').map(serviceId => serviceId.trim()).filter(Boolean);
	}, [searchParams]);

	useEffect(() => {
		const controller = new AbortController();
		const loadReceipts =
			async () => {
				if (serviceIds.length === 0) {
					setError('출력할 영수증이 없습니다.');
					setLoading(false);
					return;
				}
				setLoading(true);
				setError('');

				try {
					/*
					 * BANK 코드는
					 * 영수증 건마다 조회할 필요가 없으므로
					 * 최초 1회만 조회
					 */
					const bankCodePromise = fetchJson('/api/codes/BANK', controller.signal);

					/*
					 * SERVICE_ID별
					 * 상세정보 + 채권정보 조회
					 */
					const receiptPromises = serviceIds.map(async serviceId => {

						const encodedServiceId = encodeURIComponent(serviceId);
						const [detailResult, bondResult] =
							await Promise.allSettled([fetchJson(`/api/newcar/detail/${encodedServiceId}`, controller.signal),
							fetchJson(
								`/api/newcar/bond-info/${encodedServiceId}`,
								controller.signal
							)
							]);

						if (detailResult.status === 'rejected') {
							throw new Error(`${serviceId} 영수증 조회에 실패했습니다.`);
						}

						const detailResponse = detailResult.value;

						if (!detailResponse.success || !detailResponse.data) {
							throw new Error(detailResponse.message || `${serviceId} 영수증 정보가 없습니다.`);
						}

						let bondInfo = {};

						if (bondResult.status === 'fulfilled' && bondResult.value?.success !== false) {
							bondInfo = bondResult.value?.data || {};
						} else {
							console.error(`${serviceId} 채권정보 조회 실패`, bondResult.reason || bondResult.value?.message);
						}

						return { serviceId, receiptData: detailResponse.data, bondInfo };
					}
					);


					/*
					 * 영수증 전체 조회
					 */
					const [bankResult, receiptResults] = await Promise.all([bankCodePromise, Promise.all(receiptPromises)]);

					if (bankResult?.success !== false) {
						setBankCodes(Array.isArray(bankResult?.codes) ? bankResult.codes : []);
					} else {
						setBankCodes([]);
					}

					setReceiptList(receiptResults);
				} catch (loadError) {
					if (loadError.name !== 'AbortError') {
						console.error('다건 영수증 조회 실패', loadError);
						setError(loadError.message || '영수증 정보를 불러오지 못했습니다.');
					}
				} finally {
					if (!controller.signal.aborted) {
						setLoading(false);
					}
				}
			};

		loadReceipts();

		return () =>
			controller.abort();
	}, [serviceIds]);

	const handlePrint = () => {
		window.print();

	};

	if (loading) {
		return (
			<div className="wa-payment-receipt-wrapper">
				<div className="wa-payment-receipt-page wa-payment-receipt-status">
					영수증 정보를 불러오는 중입니다.
				</div>

			</div>
		);

	}

	if (error) {
		return (
			<div className="wa-payment-receipt-wrapper">
				<div className="wa-payment-receipt-page wa-payment-receipt-status wa-payment-receipt-status-error">
					{error}
				</div>
			</div>
		);

	}

	return (
		<div className="wa-payment-receipt-wrapper wa-payment-receipt-multi">
			{/* 화면에서만 표시 */}
			<div className="wa-payment-receipt-multi-toolbar">
				<div>
					선택한 영수증{' '}
					<strong>
						{receiptList.length}
					</strong>
					건
				</div>

				<button type="button" onClick={handlePrint}>
					전체 인쇄
				</button>
			</div>

			<div className="wa-payment-receipt-multi-list">
				{receiptList.map(
					(
						{
							serviceId,
							receiptData,
							bondInfo
						},
						index
					) => (
						<div key={serviceId} className="wa-payment-receipt-print-item">
							<ReceiptContent
								receiptData={receiptData}
								bondInfo={bondInfo}
								bankCodes={bankCodes}
								showActions={false}
							/>
						</div>
					)
				)}
			</div>
		</div>
	);
};


export default WaPaymentReceiptMulti;