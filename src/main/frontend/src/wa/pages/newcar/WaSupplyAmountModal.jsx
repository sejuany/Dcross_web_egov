import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Download, LoaderCircle, Upload, X } from 'lucide-react';

import { gf } from '../../../utils/utils';
import { calculateNewcarEstimate, resolveBondPreExemption } from './newcarAmountCalculator';
import { buildCarSpecPatch, resolveBondSearchCriteria } from './newcarCarSpec';

const TEMPLATE_FILE_NAME = '폴스타_공급가액_수정_양식.xlsx';
const PAY_KINDS = new Set(['ACQ', 'BFEE', 'BOND', 'FEE', 'INJI', 'SPARE', 'STAMP', 'TNUM', 'UNUM', 'UREG']);
const STATUS = {
    WAITING: 'WAITING',
    CALCULATING: 'CALCULATING',
    CALCULATED: 'CALCULATED',
    APPLIED: 'APPLIED',
    FAILED: 'FAILED'
};

const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message || error?.message || fallback
);

const formatTotalAmount = amount => `총 예상납부금액 ${Number(amount || 0).toLocaleString()}원`;

/** 상세 화면과 같은 기준정보와 계산기를 사용해 한 건의 반영값만 만든다. */
export const calculateSupplyAmountRow = async (row, taxInfo, codes) => {
    const detailResponse = await axios.get(`/api/newcar/detail/${encodeURIComponent(row.serviceId)}`);
    const detail = detailResponse.data?.data;
    if (!detail?.dsNewCar) throw new Error('신규등록 상세정보가 없습니다.');

    const baseNewCar = { ...detail.dsNewCar, BUY_AMT: row.buyAmt };
    const carName = String(baseNewCar.CAR_NM ?? '').trim();
    const baseAddress = String(baseNewCar.BASE_ADDRESS ?? '').trim();
    if (!carName) throw new Error('차량명이 없습니다.');
    if (!baseAddress) throw new Error('사용본거지 주소가 없습니다.');
    if (!baseNewCar.BOND_DC) throw new Error('채권 처리 방식이 없습니다.');

    const carSpecResponse = await axios.get('/api/newcar/car-spec', { params: { carName } });
    const carSpec = carSpecResponse.data?.data;
    if (!carSpec) throw new Error('차량제원 조회 결과가 없습니다.');

    const carSpecPatch = buildCarSpecPatch(baseNewCar, carSpec);
    const estimateNewCar = { ...baseNewCar, ...carSpecPatch, TM_TAX_INFO: taxInfo };
    const bondSearch = resolveBondSearchCriteria(estimateNewCar);
    const preExemption = resolveBondPreExemption(estimateNewCar, codes);
    const bondRateInfo = preExemption.exempt
        ? {
            BOND_RATE: 0,
            AREA: bondSearch.area,
            BOND_GB: 'N',
            FULL_EXEMPT_YN: 'Y'
        }
        : (await axios.get('/api/newcar/bond-rate', {
            params: {
                baseAddress: bondSearch.area,
                carGb: bondSearch.carGb,
                baseValue: bondSearch.baseValue
            }
        })).data?.data;

    if (!bondRateInfo || bondRateInfo.BOND_RATE === undefined || bondRateInfo.BOND_RATE === null) {
        throw new Error('공채 매입률 조회 결과가 없습니다.');
    }

    const calculatedNewCar = {
        ...estimateNewCar,
        BOND_RATE: bondRateInfo.BOND_RATE,
        BOND_AREA: bondRateInfo.AREA ?? '',
        BOND_GB: bondRateInfo.BOND_GB ?? '',
        BOND_FULL_EXEMPT_YN: bondRateInfo.FULL_EXEMPT_YN ?? 'N',
        BOND_RATE_BASE1: bondRateInfo.BASE1 ?? '',
        BOND_RATE_BASE2: bondRateInfo.BASE2 ?? '',
        BOND_SEARCH_CAR_GB: bondSearch.carGb,
        BOND_SEARCH_BASE_VALUE: bondSearch.baseValue
    };
    const calculation = calculateNewcarEstimate({
        dsNewCar: calculatedNewCar,
        dsPaymentList: detail.dsPaymentList || [],
        dsWorkCp: detail.dsWorkCp || {},
        codes
    });

    return {
        totalAmt: calculation.totalAmt,
        applyRow: {
            serviceId: row.serviceId,
            linkId: row.linkId,
            carIdNo: row.carIdNo,
            buyAmt: row.buyAmt,
            standardAmt: calculation.taxableStandard,
            preregAmt: calculation.totalAmt,
            totalAmt: calculation.totalAmt,
            bondAmt: calculation.bond,
            ntaxApplyCode: calculation.ntaxApplyCode,
            payments: calculation.updatedPaymentList
                .filter(payment => PAY_KINDS.has(payment.PAY_KD))
                .map(payment => ({
                    payKd: payment.PAY_KD,
                    prePayAmt: payment.PRE_PAY_AMT,
                    payAmt: payment.PAY_AMT,
                    realAloan: payment.REAL_ALOAN ?? 0
                }))
        }
    };
};

const getStatusView = status => {
    if (status === STATUS.CALCULATING) {
        return <span className="wa-grid-status progress"><LoaderCircle size={12} className="wa-spin" /> 계산중</span>;
    }
    if (status === STATUS.CALCULATED) return <span className="wa-grid-status done">확인완료</span>;
    if (status === STATUS.APPLIED) return <span className="wa-grid-status done">수정완료</span>;
    if (status === STATUS.FAILED) return <span className="wa-grid-status reject">실패</span>;
    return <span className="wa-grid-status ready">대기중</span>;
};

const WaSupplyAmountModal = ({ open, onClose, onTemplateDownload, onApplied }) => {
    const fileInputRef = useRef(null);
    const [rows, setRows] = useState(null);
    const [phase, setPhase] = useState('IDLE');
    const [message, setMessage] = useState('');
    const busy = phase === 'CALCULATING' || phase === 'APPLYING';

    const closeResult = () => {
        if (busy) return;
        setRows(null);
        setPhase('IDLE');
        setMessage('');
    };

    const handleTemplateDownload = () => {
        onClose();
        onTemplateDownload(TEMPLATE_FILE_NAME);
    };

    const handleUpload = async event => {
        const file = event.target?.files?.[0];
        if (!file) return;

        onClose();
        setPhase('CALCULATING');
        setRows([]);
        setMessage('엑셀 파일과 신청 건을 확인하고 있습니다.');

        try {
            const formData = new FormData();
            formData.append('file', file);
            const previewResponse = await axios.post('/api/newcar/supply-amount-upload', formData);
            const preview = previewResponse.data?.data;
            if (!preview?.results?.length) throw new Error('매칭 결과가 없습니다.');
            setMessage('');

            // React state와 별도로 같은 배열을 갱신해 순차 처리 결과가 섞이지 않게 한다.
            const workingRows = preview.results.map(result => ({
                ...result,
                status: result.success ? STATUS.WAITING : STATUS.FAILED,
                note: result.reason || ''
            }));
            setRows([...workingRows]);

            const matchedRows = workingRows.filter(row => row.status === STATUS.WAITING);
            let taxInfo;
            let codes;
            if (matchedRows.length) {
                const [taxInfoResponse, codeData, detailCodeData] = await Promise.all([
                    axios.get('/api/newcar/tax-info'),
                    gf.getCodes(['NTTCD']),
                    gf.getCodeDetails(['TUSE'])
                ]);
                taxInfo = taxInfoResponse.data?.data;
                if (!taxInfo) throw new Error('신규등록 NTTCD/TUSE 조회 결과가 없습니다.');
                codes = { ...codeData, TUSE: detailCodeData?.TUSE || [] };
            }

            const applyRows = [];
            // 한 건이 실패해도 다음 건을 계속 계산해 마지막에 전체 결과를 보여준다.
            for (const row of matchedRows) {
                const index = workingRows.findIndex(item => item.row === row.row);
                workingRows[index] = { ...workingRows[index], status: STATUS.CALCULATING, note: '' };
                setRows([...workingRows]);

                try {
                    const calculated = await calculateSupplyAmountRow(row, taxInfo, codes);
                    applyRows.push(calculated.applyRow);
                    workingRows[index] = {
                        ...workingRows[index],
                        status: STATUS.CALCULATED,
                        totalAmt: calculated.totalAmt,
                        note: '공급가액 수정 가능'
                    };
                } catch (error) {
                    workingRows[index] = {
                        ...workingRows[index],
                        status: STATUS.FAILED,
                        note: getErrorMessage(error, '금액 계산 중 오류가 발생했습니다.')
                    };
                }
                setRows([...workingRows]);
            }

            if (workingRows.some(row => row.status === STATUS.FAILED)) {
                setPhase('FAILED');
                setMessage('일부 항목을 확인해 주세요. 공급가액은 수정되지 않았습니다.');
                return;
            }

            setPhase('APPLYING');
            await axios.post('/api/newcar/supply-amount-apply', applyRows);
            setRows(workingRows.map(row => ({
                ...row,
                status: STATUS.APPLIED,
                note: formatTotalAmount(row.totalAmt)
            })));
            setPhase('SUCCESS');
            setMessage('공급가액과 계산 금액을 모두 수정했습니다.');
            try {
                await onApplied?.();
            } catch (refreshError) {
                // 수정은 이미 완료됐으므로 목록 재조회 실패를 처리 실패로 바꾸지 않는다.
                console.error('공급가액 수정 후 목록 조회 실패:', refreshError);
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error, '공급가액 수정 중 오류가 발생했습니다.');
            setRows(current => (current || []).map(row => (
                row.status === STATUS.CALCULATED || row.status === STATUS.WAITING
                    ? { ...row, status: STATUS.FAILED, note: errorMessage }
                    : row
            )));
            setPhase('FAILED');
            setMessage(`${errorMessage} 공급가액은 수정되지 않았습니다.`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const totalCount = rows?.length || 0;
    const completeCount = rows?.filter(row => [STATUS.CALCULATED, STATUS.APPLIED].includes(row.status)).length || 0;
    const failureCount = rows?.filter(row => row.status === STATUS.FAILED).length || 0;
    const summary = phase === 'SUCCESS'
        ? `전체 성공 · 전체 ${totalCount}건 · 수정 ${totalCount}건`
        : phase === 'APPLYING'
            ? `전체 수정중 · 전체 ${totalCount}건 · 확인완료 ${completeCount}건`
        : busy
            ? `계산 진행중 · 전체 ${totalCount}건 · 확인완료 ${completeCount}건 · 실패 ${failureCount}건`
            : `일부 항목 확인 필요 · 전체 ${totalCount}건 · 확인완료 ${completeCount}건 · 실패 ${failureCount}건`;

    return (
        <>
            {open && (
                <div className="wa-request-modal-backdrop" role="presentation" onMouseDown={onClose}>
                    <section
                        className="wa-action-confirm-frame"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wa-supply-amount-title"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <header className="wa-action-confirm-header">
                            <strong id="wa-supply-amount-title">공급가액 수정</strong>
                            <button type="button" className="wa-request-modal-close" onClick={onClose} aria-label="닫기">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="wa-action-confirm-content">
                            공급가액 수정 엑셀 양식을 다운로드하거나 작성한 엑셀 파일을 업로드해주세요.
                        </div>
                        <footer className="wa-action-confirm-footer">
                            <button type="button" className="wa-status-action outline" onClick={handleTemplateDownload}>
                                <Download size={15} />
                                <span>양식 다운로드</span>
                            </button>
                            <button type="button" className="wa-status-action primary" onClick={() => fileInputRef.current?.click()}>
                                <Upload size={15} />
                                <span>공급가액 수정 업로드</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                hidden
                                aria-label="공급가액 엑셀 파일"
                                accept=".xlsx,.xls"
                                onChange={handleUpload}
                            />
                        </footer>
                    </section>
                </div>
            )}

            {rows !== null && (
                <div className="wa-request-modal-backdrop" role="presentation" onMouseDown={closeResult}>
                    <section
                        className="wa-action-confirm-frame"
                        style={{ width: 'min(780px, calc(100vw - 32px))' }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wa-supply-amount-result-title"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <header className="wa-action-confirm-header">
                            <strong id="wa-supply-amount-result-title">공급가액 수정 결과</strong>
                            <button type="button" className="wa-request-modal-close" onClick={closeResult} disabled={busy} aria-label="닫기">
                                <X size={18} />
                            </button>
                        </header>
                        <div className={phase === 'SUCCESS' || busy ? 'wa-status-notice' : 'wa-status-error'}>
                            {summary}{message ? `\n${message}` : ''}
                        </div>
                        <div className="wa-status-table-scroll" style={{ maxHeight: '55vh' }}>
                            <table className="wa-status-table" style={{ width: '100%', minWidth: '700px' }}>
                                <colgroup>
                                    <col style={{ width: '52px' }} />
                                    <col style={{ width: '100px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '90px' }} />
                                    <col />
                                </colgroup>
                                <thead>
                                    <tr><th>행</th><th>주문번호</th><th>차대번호</th><th>결과</th><th>비고</th></tr>
                                </thead>
                                <tbody>
                                    {rows.map(row => (
                                        <tr key={`${row.row}-${row.linkId}-${row.carIdNo}`}>
                                            <td>{row.row}</td>
                                            <td>{row.linkId || '-'}</td>
                                            <td>{row.carIdNo || '-'}</td>
                                            <td>{getStatusView(row.status)}</td>
                                            <td style={{ whiteSpace: 'normal', textAlign: 'left' }}>{row.note || '-'}</td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr><td colSpan="5" className="wa-status-empty">{message || '처리 결과가 없습니다.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <footer className="wa-action-confirm-footer">
                            <button type="button" className="wa-status-action primary" onClick={closeResult} disabled={busy}>
                                {busy ? <><LoaderCircle size={15} className="wa-spin" /> 처리 중</> : '확인'}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export default WaSupplyAmountModal;
