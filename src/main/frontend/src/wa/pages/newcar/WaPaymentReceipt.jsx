import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import '../../styles/WaReceipt.css';

const toAmount = value => {
    const amount = Number(String(value ?? 0).replace(/,/g, ''));
    return Number.isFinite(amount) ? amount : 0;
};

const formatAmount = value => `${toAmount(value).toLocaleString('ko-KR')} 원`;

const fetchJson = async (url, signal) => {
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(`영수증 조회에 실패했습니다. (${response.status})`);
    }
    return response.json();
};

const ReceiptTable = ({ rows, totalRow, noteTitle = '비고' }) => (
    <table className='receipt-table'>
        <thead>
            <tr>
                <th>항목별</th>
                <th>금액</th>
                <th>{noteTitle}</th>
            </tr>
        </thead>
        <tbody>
            {rows.map(row => (
                <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatAmount(row.amount)}</td>
                    <td>{row.note}</td>
                </tr>
            ))}
            <tr className='receipt-row-total'>
                <td>{totalRow.label}</td>
                <td>{formatAmount(totalRow.amount)}</td>
                <td>{totalRow.note}</td>
            </tr>
        </tbody>
    </table>
);

const WaPaymentReceipt = () => {
    const { serviceId } = useParams();
    const [receiptData, setReceiptData] = useState(null);
    const [bondInfo, setBondInfo] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();

        const loadReceipt = async () => {
            if (!serviceId) {
                setError('접수번호가 없습니다.');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError('');

            try {
                const encodedServiceId = encodeURIComponent(serviceId);
                const [detailResult, bondResult] = await Promise.allSettled([
                    fetchJson(`/api/newcar/detail/${encodedServiceId}`, controller.signal),
                    fetchJson(`/api/newcar/bond-info/${encodedServiceId}`, controller.signal)
                ]);

                if (detailResult.status === 'rejected') {
                    throw detailResult.reason;
                }

                const detailResponse = detailResult.value;
                if (!detailResponse.success || !detailResponse.data) {
                    throw new Error(detailResponse.message || '영수증 정보가 없습니다.');
                }

                setReceiptData(detailResponse.data);

                if (bondResult.status === 'fulfilled' && bondResult.value.success !== false) {
                    setBondInfo(bondResult.value.data || {});
                } else {
                    setBondInfo({});
                    console.error('채권정보 조회 실패', bondResult.reason || bondResult.value?.message);
                }
            } catch (loadError) {
                if (loadError.name !== 'AbortError') {
                    console.error('영수증 조회 실패', loadError);
                    setError(loadError.message || '영수증 정보를 불러오지 못했습니다.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        loadReceipt();
        return () => controller.abort();
    }, [serviceId]);

    if (loading || error || !receiptData) {
        return (
            <div className='receipt-wrapper'>
                <div className={`receipt-page receipt-status ${error ? 'receipt-status-error' : ''}`}>
                    {error || (loading ? '영수증 정보를 불러오는 중입니다.' : '영수증 정보가 없습니다.')}
                </div>
            </div>
        );
    }

    const dsService = receiptData.dsService || {};
    const dsNewCar = receiptData.dsNewCar || {};
    const dsCompanyInfo = receiptData.dsCompanyInfo || {};
    const paymentList = Array.isArray(receiptData.dsPaymentList) ? receiptData.dsPaymentList : [];
    const getPayAmount = payKind => paymentList
        .filter(item => item.PAY_KD === payKind)
        .reduce((sum, item) => sum + toAmount(item.PAY_AMT), 0);

    const taxAmounts = {
        acq: getPayAmount('ACQ'),
        ureg: getPayAmount('UREG'),
        inji: getPayAmount('INJI'),
        stamp: getPayAmount('STAMP')
    };
    const taxTotal = Object.values(taxAmounts).reduce((sum, amount) => sum + amount, 0);
    const feeAmounts = {
        fee: getPayAmount('FEE'),
        numplate: getPayAmount('TNUM'),
        bondFee: getPayAmount('BFEE')
    };
    const feeTotal = Object.values(feeAmounts).reduce((sum, amount) => sum + amount, 0);

    const bondPurchaseAmount = toAmount(bondInfo.FIELD16);
    const bondSaleAmount = toAmount(bondInfo.FIELD23);
    const prepaidInterestAmount = toAmount(bondInfo.FIELD24);
    const hasBondDetail = ['FIELD16', 'FIELD23', 'FIELD24']
        .some(field => bondInfo[field] !== null && bondInfo[field] !== undefined && bondInfo[field] !== '');
    const bondTotal = hasBondDetail
        ? bondPurchaseAmount - bondSaleAmount + prepaidInterestAmount
        : getPayAmount('BOND');
    const calculatedTotal = taxTotal + feeTotal + bondTotal;
    const hasSavedTotal = dsNewCar.TOTAL_AMT !== null
        && dsNewCar.TOTAL_AMT !== undefined
        && dsNewCar.TOTAL_AMT !== '';
    const finalSettlementAmount = hasSavedTotal ? toAmount(dsNewCar.TOTAL_AMT) : calculatedTotal;

    const taxRows = [
        { label: '취득세', amount: taxAmounts.acq, note: `차량 공급가액(${formatAmount(dsNewCar.BUY_AMT)}) 기준` },
        { label: '등록면허세', amount: taxAmounts.ureg, note: '차량 등록에 따른 법정 면허세' },
        { label: '인지세', amount: taxAmounts.inji, note: '국가 수입인지' },
        { label: '증지대', amount: taxAmounts.stamp, note: '지자체 등록 수수료' }
    ];
    const feeRows = [
        { label: '등록 대행 수수료', amount: feeAmounts.fee, note: '' },
        { label: '번호판 비용', amount: feeAmounts.numplate, note: '' },
        { label: '채권 처리 대행 수수료', amount: feeAmounts.bondFee, note: '' }
    ];
    const bondRows = [
        { label: '채권 매입 금액', amount: bondPurchaseAmount, note: '의무 매입 채권 금액' },
        { label: '채권 매도 금액', amount: bondSaleAmount, note: '채권 즉시 매도 금액' },
        { label: '선급 이자', amount: prepaidInterestAmount, note: '채권 즉시 매도 선급이자' }
    ];

    return (
        <div className='receipt-wrapper'>
            <div className='receipt-page'>
                <div className='receipt-title-top'>DACOS</div>
                <div className='receipt-title-main'>통합 납부 영수증</div>

                <div className='receipt-blue-box'>
                    <div className='receipt-blue-box-inner'>
                        <div className='receipt-info-text'>
                            <div>
                                고객명(상호): {dsNewCar.OWNER_NM || dsCompanyInfo.COMPANY_NM || '-'}
                            </div>
                            <div>
                                차량번호: {dsNewCar.CAR_NO || dsNewCar.REQ_CAR_NO || '-'}
                                <span className='receipt-vin-text'>
                                    (차대번호: {dsNewCar.CARID_NO || '-'})
                                </span>
                            </div>
                            <div>접수번호: {dsService.SERVICE_ID || serviceId}</div>
                        </div>

                        <div className='receipt-total-section'>
                            <div className='receipt-total-label'>최종 정산 합계</div>
                            <div className='receipt-total-value'>
                                {formatAmount(finalSettlementAmount)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='receipt-section-title'>1. 세금 내역</div>
                <ReceiptTable
                    rows={taxRows}
                    totalRow={{
                        label: '세금 합계 (A)',
                        amount: taxTotal,
                        note: '취득세 + 등록면허세 + 인지세 + 증지대'
                    }}
                />

                <div className='receipt-section-title'>
                    2. 수수료 내역 (세금계산서/현금영수증 발행)
                </div>
                <ReceiptTable
                    rows={feeRows}
                    noteTitle={'비고 (VAT 포함)'}
                    totalRow={{
                        label: '수수료 합계 (B)',
                        amount: feeTotal,
                        note: '등록 + 번호판 + 채권 처리 수수료'
                    }}
                />
                <div className='receipt-section-title'>3. 채권 내역</div>
                <ReceiptTable
                    rows={bondRows}
                    totalRow={{
                        label: '채권 합계 (C)',
                        amount: bondTotal,
                        note: '매입금액 - 매도금액 + 선급이자'
                    }}
                />
                <div className='receipt-section-title'>4. 최종 정산 내역</div>
                <div className='receipt-final-box'>
                    <div className='receipt-final-row'>
                        <span>고객 입금 금액</span>
                        <span>{formatAmount(dsNewCar.PREREG_AMT)}</span>
                    </div>
                    <div className='receipt-final-row'>
                        <span>등록 금액</span>
                        <span>{formatAmount(finalSettlementAmount)}</span>
                    </div>
                    <div className='receipt-final-row receipt-refund-amount'>
                        <span>환불 금액</span>
                        <span>{formatAmount(dsNewCar.RT_AMT)}</span>
                    </div>
                </div>

                <div className='receipt-footer'>
                    <div>전자납부번호로 각 세금 항목의 납부 여부를 확인할 수 있습니다.</div>
                    <div>
                        취득세(등록면허세) 납부 확인은 위택스(www.wetax.go.kr)에서
                        전자납부번호로 확인 및 출력이 가능합니다.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaPaymentReceipt;
