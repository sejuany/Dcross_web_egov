import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

import '../../styles/WaReceipt.css';

const BOND_CERTIFICATE_URL = 'http://211.236.84.168/exploded/RegCivil/bondSch3.jsp';

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

const formatDate = value => {
    const digits = String(value || '').replace(/\D/g, '');

    if (digits.length < 8) {
        return value || '-';
    }

    return `${digits.substring(0, 4)}년 ${digits.substring(4, 6)}월 ${digits.substring(6, 8)}일`;
};

const ReceiptTable = ({ rows, totalRow, amountTitle = '금액' }) => (
    <table className='wa-payment-receipt-table'>
        <thead>
            <tr>
                <th>항목별</th>
                <th>{amountTitle}</th>
            </tr>
        </thead>
        <tbody>
            {rows.map(row => (
                <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatAmount(row.amount)}</td>
                </tr>
            ))}
            <tr className='wa-payment-receipt-row-total'>
                <td>{totalRow.label}</td>
                <td>{formatAmount(totalRow.amount)}</td>
            </tr>
        </tbody>
    </table>
);

const WaPaymentReceipt = () => {
    const { serviceId } = useParams();
    const [receiptData, setReceiptData] = useState(null);
    const [bondInfo, setBondInfo] = useState({});
    const [bankCodes, setBankCodes] = useState([]);
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
                const [detailResult, bondResult, bankCodeResult] = await Promise.allSettled([
                    fetchJson(`/api/newcar/detail/${encodedServiceId}`, controller.signal),
                    fetchJson(`/api/newcar/bond-info/${encodedServiceId}`, controller.signal),
                    fetchJson('/api/codes/BANK', controller.signal)
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

                if (bankCodeResult.status === 'fulfilled' && bankCodeResult.value.success !== false) {
                    setBankCodes(Array.isArray(bankCodeResult.value.codes) ? bankCodeResult.value.codes : []);
                } else {
                    setBankCodes([]);
                    console.error('은행코드 조회 실패', bankCodeResult.reason || bankCodeResult.value?.message);
                }
            } catch (loadError) {
                if (loadError.name !== 'AbortError') {
                    console.error('채권 영수증 조회 실패', loadError);
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
            <div className='wa-payment-receipt-wrapper'>
                <div className={`wa-payment-receipt-page wa-payment-receipt-status ${error ? 'wa-payment-receipt-status-error' : ''}`}>
                    {error || (loading ? '영수증 정보를 불러오는 중입니다.' : '영수증 정보가 없습니다.')}
                </div>
            </div>
        );
    }

    const dsService = receiptData.dsService || {};
    const dsNewCar = receiptData.dsNewCar || {};
    const dsCompanyInfo = receiptData.dsCompanyInfo || {};
    const paymentList = Array.isArray(receiptData.dsPaymentList) ? receiptData.dsPaymentList : [];
    const isBondBuy = String(dsNewCar.BOND_DC || '').trim().toUpperCase() === 'BUY';
    const bondActionLabel = isBondBuy ? '매입' : '매도';

    const getPayAmount = payKind => paymentList
        .filter(item => item.PAY_KD === payKind)
        .reduce((sum, item) => sum + toAmount(item.PAY_AMT), 0);
    const getElectronicPaymentNo = payKind => paymentList
        .find(item => item.PAY_KD === payKind)?.VBANK_NO || '-';
    const bondPayment = paymentList.find(item => item.PAY_KD === 'BOND') || {};

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

    const bondAmounts = {
        purchase: toAmount(bondInfo.FIELD16),
        financeFee: toAmount(bondInfo.FIELD18),
        sale: toAmount(bondInfo.FIELD23),
        prepaidInterest: toAmount(bondInfo.FIELD24),
        incomeTax: toAmount(bondInfo.FIELD25),
        residentTax: toAmount(bondInfo.FIELD26),
        handlingFee: toAmount(bondInfo.FIELD27),
        customerBurden: toAmount(bondInfo.FIELD28)
    };
    const buyBondAmounts = {
        assessed: toAmount(bondPayment.REAL_ALOAN),
        paid: toAmount(bondPayment.PAY_AMT)
    };
    const hasBondTotal = bondInfo.FIELD28 !== null
        && bondInfo.FIELD28 !== undefined
        && bondInfo.FIELD28 !== '';
    const sellBondTotal = hasBondTotal
        ? bondAmounts.customerBurden
        : toAmount(dsNewCar.BOND_AMT) || getPayAmount('BOND');
    const bondTotal = isBondBuy ? buyBondAmounts.paid : sellBondTotal;
    const calculatedTotal = taxTotal + feeTotal + bondTotal;
    const finalSettlementAmount = dsNewCar.TOTAL_AMT !== null
        && dsNewCar.TOTAL_AMT !== undefined
        && dsNewCar.TOTAL_AMT !== ''
        ? toAmount(dsNewCar.TOTAL_AMT)
        : calculatedTotal;
    const customerName = dsNewCar.OWNER_NM || dsCompanyInfo.COMPANY_NM || '-';
    const carNumber = dsNewCar.CAR_NO || dsNewCar.REQ_CAR_NO || '-';
    const receiptDate = bondInfo.NAPBU_DT || dsNewCar.REGIST_DATE;
    const bondBankCode = String(dsNewCar.BOND_BANK_CD || bondInfo.BANK_CODE || '').trim();
    const bondBankName = bankCodes.find(code => (
        String(code.CODE_ID || '').trim() === bondBankCode
    ))?.CODE_NM || '-';

    const taxRows = [
        { label: '취득세', amount: taxAmounts.acq },
        { label: '등록면허세', amount: taxAmounts.ureg },
        { label: '인지세', amount: taxAmounts.inji },
        { label: '증지대', amount: taxAmounts.stamp }
    ];
    const feeRows = [
        { label: '등록 대행 수수료', amount: feeAmounts.fee },
        { label: '번호판 비용', amount: feeAmounts.numplate },
        { label: '채권 처리 대행 수수료', amount: feeAmounts.bondFee }
    ];
    const sellBondRows = [
        { label: '(1) 채권금액', amount: bondAmounts.purchase },
        { label: '(2) 선급이자', amount: bondAmounts.prepaidInterest },
        { label: '(3) 소득(법인)세', amount: bondAmounts.incomeTax },
        { label: '(4) 주민세', amount: bondAmounts.residentTax },
        { label: '(5) 채권 처리 대행 수수료', amount: bondAmounts.handlingFee },
        { label: '(6) 금융결제원 수수료', amount: bondAmounts.financeFee },
        { label: '(7) 매도금액', amount: bondAmounts.sale },
        { label: '납부일자', displayValue: formatDate(receiptDate) }
    ];
    const sellBondTotalFormula = '{(1)+(3)+(4)+(5)+(6)} - {(2)+(7)}';

    const handleDownloadPdf = async () => {
        const element = document.querySelector('.wa-payment-receipt-pdf');

        if (!element) {
            return;
        }

        const worker = html2pdf()
            .set({
                margin: [5, 5, 5, 5],
                filename: `${dsNewCar.CAR_NO || dsNewCar.REQ_CAR_NO || dsService.SERVICE_ID}_납부영수증.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(element)
            .toCanvas()
            .then(function fitReceiptToSinglePage() {
                const sourceCanvas = this.prop.canvas;
                const pageRatio = this.prop.pageSize?.inner?.ratio || (287 / 200);
                const singlePageHeight = Math.floor(sourceCanvas.width * pageRatio);

                if (sourceCanvas.height <= singlePageHeight) {
                    return;
                }

                const fittedCanvas = document.createElement('canvas');
                const context = fittedCanvas.getContext('2d');
                const scale = singlePageHeight / sourceCanvas.height;
                const fittedWidth = Math.floor(sourceCanvas.width * scale);
                const offsetX = Math.floor((sourceCanvas.width - fittedWidth) / 2);

                fittedCanvas.width = sourceCanvas.width;
                fittedCanvas.height = singlePageHeight;
                context.fillStyle = '#fff';
                context.fillRect(0, 0, fittedCanvas.width, fittedCanvas.height);
                context.drawImage(
                    sourceCanvas,
                    0,
                    0,
                    sourceCanvas.width,
                    sourceCanvas.height,
                    offsetX,
                    0,
                    fittedWidth,
                    singlePageHeight
                );

                this.prop.canvas = fittedCanvas;
            });

        await worker.toPdf().save();
    };

    const handlePrint = () => window.print();

    return (
        <div className='wa-payment-receipt-wrapper'>
            <div className='wa-payment-receipt-page'>
                <div className='wa-payment-receipt-title-row'>
                    <div>
                        <div className='wa-payment-receipt-title'>통합 납부 영수증</div>
                        <div className='wa-payment-receipt-number'>주문번호: {dsService.LINK_ID || '-'}</div>
                    </div>
                    <div className='wa-payment-receipt-actions'>
                        {isBondBuy && (
                            <a
                                className='wa-payment-receipt-action-button'
                                href={BOND_CERTIFICATE_URL}
                                target='_blank'
                                rel='noopener noreferrer'
                            >
                                채권매입확인증
                            </a>
                        )}
                        <button type='button' onClick={handleDownloadPdf}>PDF 생성</button>
                        <button type='button' onClick={handlePrint}>인쇄</button>
                    </div>
                </div>

                <div className='wa-payment-receipt-pdf'>
                    <div className='wa-payment-receipt-summary'>
                        <div className='wa-payment-receipt-customer'>
                            <div>고객명(상호): <strong>{customerName}</strong></div>
                            <div>차량번호: <strong>{carNumber}</strong></div>
                            <div>차대번호: <strong>{dsNewCar.CARID_NO || '-'}</strong></div>
                        </div>
                        <div className='wa-payment-receipt-total'>
                            <span>납부금액 (최종 정산 합계)</span>
                            <strong>{formatAmount(finalSettlementAmount)}</strong>
                        </div>
                    </div>

                    <div className='wa-payment-receipt-payment-grid'>
                        <div>
                            <span>취득세 전자납부번호</span>
                            <strong>{getElectronicPaymentNo('ACQ')}</strong>
                        </div>
                        <div>
                            <span>등록면허세 전자납부번호</span>
                            <strong>{getElectronicPaymentNo('UREG')}</strong>
                        </div>
                    </div>

                    <div className='wa-payment-receipt-tax-fee-grid'>
                        <section className='wa-payment-receipt-section'>
                            <div className='wa-payment-receipt-section-title'>1. 세금 내역</div>
                            <ReceiptTable
                                rows={taxRows}
                                totalRow={{
                                    label: '세금 합계 (A)',
                                    amount: taxTotal
                                }}
                            />
                        </section>

                        <section className='wa-payment-receipt-section'>
                            <div className='wa-payment-receipt-section-title'>2. 수수료 내역</div>
                            <ReceiptTable
                                rows={feeRows}
                                amountTitle='금액 (VAT포함)'
                                totalRow={{
                                    label: '수수료 합계 (B)',
                                    amount: feeTotal
                                }}
                            />
                            <div className='wa-payment-receipt-issuance-note'>* 세금계산서 / 현금영수증 발행 목록</div>
                        </section>
                    </div>

                    <div className='wa-payment-receipt-section-title'>3. 채권 {bondActionLabel} 내역 ({bondBankName})</div>
                    <div className='wa-payment-receipt-bond-meta'>
                        <div>
                            <span>채권발행번호</span>
                            <strong>{bondInfo.BND_ISU_NO || '-'}</strong>
                        </div>
                        <div>
                            <span>증서번호</span>
                            <strong>{bondInfo.BND_MNG_NO || '-'}</strong>
                        </div>
                    </div>
                    <div className='wa-payment-receipt-bond-grid'>
                        {isBondBuy ? (
                            <>
                                <div className='wa-payment-receipt-bond-cell'>
                                    <span>채권금액</span>
                                    <strong>{formatAmount(buyBondAmounts.assessed)}</strong>
                                </div>
                                <div className='wa-payment-receipt-bond-cell'>
                                    <span>처리일자</span>
                                    <strong>{formatDate(bondInfo.NAPBU_DT)}</strong>
                                </div>
                                <div className='wa-payment-receipt-bond-cell wa-payment-receipt-bond-cell-wide'>
                                    <span>수납금액(본인부담액)</span>
                                    <strong>{formatAmount(buyBondAmounts.paid)}</strong>
                                </div>
                            </>
                        ) : (
                            <>
                                {sellBondRows.map(row => (
                                    <div className='wa-payment-receipt-bond-cell' key={row.label}>
                                        <span>{row.label}</span>
                                        <strong>{row.displayValue ?? formatAmount(row.amount)}</strong>
                                    </div>
                                ))}
                                <div className='wa-payment-receipt-bond-total'>
                                    <span>
                                        본인부담금 합계 (C)
                                        <small>{sellBondTotalFormula}</small>
                                    </span>
                                    <strong>{formatAmount(bondTotal)}</strong>
                                </div>
                            </>
                        )}
                    </div>

                    <div className='wa-payment-receipt-section-title'>4. 최종 정산 내역</div>
                    <div className='wa-payment-receipt-final-box'>
                        <div><span>고객 입금 금액</span><strong>{formatAmount(dsNewCar.PREREG_AMT)}</strong></div>
                        <div><span>등록 금액</span><strong>{formatAmount(finalSettlementAmount)}</strong></div>
                        <div className='wa-payment-receipt-refund'><span>환불 금액</span><strong>{formatAmount(dsNewCar.RT_AMT)}</strong></div>
                    </div>

                    <div className='wa-payment-receipt-date'>{formatDate(receiptDate)}</div>
                    <div className='wa-payment-receipt-footer'>
                        취득세(등록면허세) 납부 확인은 위택스(www.wetax.go.kr)에서 전자납부번호로 확인 및 출력이 가능합니다.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaPaymentReceipt;
