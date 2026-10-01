import React, { useRef, useState } from 'react';
import axios from 'axios';
import { LoaderCircle, Upload, X } from 'lucide-react';

import { gf } from '../../../utils/utils';
import { calculateNewcarEstimate, resolveBondPreExemption } from './newcarAmountCalculator';
import { buildCarSpecPatch, resolveBondSearchCriteria } from './newcarCarSpec';

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

const COMPARISON_COLUMNS = [
    { key: 'linkId', label: '주문 번호' },
    { key: 'carIdNo', label: 'VIN' },
    { key: 'model', label: '모델' },
    { key: 'modelYear', label: '연식' },
    { key: 'engine', label: '엔진' },
    { key: 'carPackage', label: '패키지' },
    { key: 'registDate', label: '차량 등록일', date: true },
    { key: 'directYn', label: '차량 등록 방법' },
    { key: 'spaceGb', label: '스페이스' },
    { key: 'spaceNm', label: '담당 Specialist' },
    { key: 'ownerNm', label: '계약자' },
    { key: 'buyAmt', label: '공급가액', amount: true }
];

const formatComparisonValue = (value, column) => {
    if (value === null || value === undefined || value === '') return '-';

    if (column.date) {
        const digits = String(value).replace(/\D/g, '').slice(0, 8);

        return digits.length === 8
            ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
            : value;
    }

    return column.amount
        ? Number(value).toLocaleString('ko-KR')
        : value;
};

// 엑셀 신규등록과 동일한 기준으로 변경 후 차량의 친환경 감면 대상 여부를 판정한다.
const resolveUploadedEcoYn = (carName, carPackage, engine) => {
    const normalizedCarName = String(carName ?? '').replace(/\s+/g, '').toUpperCase();
    const normalizedPackage = String(carPackage ?? '').toUpperCase();
    const normalizedEngine = String(engine ?? '').toUpperCase();

    if (normalizedCarName.includes('POLESTAR4')) {
        return normalizedPackage.includes('PERFORMANCE') ? 'N' : 'Y';
    }
    if (normalizedCarName.includes('POLESTAR3')) {
        return normalizedEngine.includes('REAR') ? 'Y' : 'N';
    }
    return 'Y';
};

/** 상세 화면과 같은 기준정보와 계산기를 사용해 한 건의 반영값만 만든다. */
export const calculateSupplyAmountRow = async (row, taxInfo, codes) => {
    const detailResponse = await axios.get(`/api/newcar/detail/${encodeURIComponent(row.serviceId)}`);
    const detail = detailResponse.data?.data;
    if (!detail?.dsNewCar) throw new Error('신규등록 상세정보가 없습니다.');

    const uploadedCarName = [row.after?.model, row.after?.engine]
        .filter(Boolean)
        .join(' ')
        .trim();
	const uploadedCarPackage = String(row.after?.carPackage ?? detail.dsNewCar.CAR_PACKAGE ?? '').trim();
	const uploadedEngine = String(row.after?.engine ?? '').trim();   
    const baseNewCar = {
        ...detail.dsNewCar,
        BUY_AMT: row.buyAmt,
        // 엑셀에서 모델/엔진이 바뀌었으면 변경 후 제원 기준으로 금액을 계산한다.
		CAR_NM: uploadedCarName || detail.dsNewCar.CAR_NM,
		CAR_PACKAGE: uploadedCarPackage,
		ECO_YN: resolveUploadedEcoYn(
		            uploadedCarName || detail.dsNewCar.CAR_NM,
		            uploadedCarPackage,
		            uploadedEngine
		)
    };
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

const getStatusView = (status, note = '') => {
    if (status === STATUS.CALCULATING) {
        return <span className="wa-grid-status progress"><LoaderCircle size={12} className="wa-spin" /> 계산중</span>;
    }
    if (status === STATUS.CALCULATED) return <span className="wa-grid-status done">확인완료</span>;
    if (status === STATUS.APPLIED) return <span className="wa-grid-status done">수정완료</span>;
    if (status === STATUS.FAILED) {
        return (
            <div className="wa-supply-amount-result-error">
                <span className="wa-grid-status reject">실패</span>
                {note && <small>{note}</small>}
            </div>
        );
    }
    if (status === 'CHANGED') return <span className="wa-grid-status reject">수정</span>;
    if (status === 'UNCHANGED') return <span className="wa-grid-status done">미수정</span>;
    return <span className="wa-grid-status ready">대기중</span>;
};

const WaSupplyAmountModal = ({ open, onClose, onApplied }) => {
    const fileInputRef = useRef(null);
    const [rows, setRows] = useState(null);
    const [phase, setPhase] = useState('IDLE');
    const [message, setMessage] = useState('');
    const busy = phase === 'UPLOADING' || phase === 'APPLYING';

    const closeResult = () => {
        if (busy) return;
        setRows(null);
        setPhase('IDLE');
        setMessage('');
    };

    const handleUpload = async event => {
        const file = event.target?.files?.[0];
        if (!file) return;

        onClose();
        setPhase('UPLOADING');
        setRows([]);
        setMessage('엑셀 파일과 기존 저장 데이터를 비교하고 있습니다.');

        try {
            const formData = new FormData();
            formData.append('file', file);
            const previewResponse = await axios.post('/api/newcar/supply-amount-upload', formData);
            const preview = previewResponse.data?.data;
            if (!preview?.results?.length) throw new Error('매칭 결과가 없습니다.');
            setMessage('');

            const comparisonRows = preview.results.map(result => ({
                ...result,
                status: result.success ? (result.changed ? 'CHANGED' : 'UNCHANGED') : STATUS.FAILED,
                note: result.reason || (result.changed ? '공급가액 변경' : '변경 없음')
            }));
            setRows(comparisonRows);
            setPhase('PREVIEW');
            setMessage('변경 내용을 확인해 주세요.');
        } catch (error) {
            const errorMessage = getErrorMessage(error, '공급가액 수정 중 오류가 발생했습니다.');
            setRows(current => (current || []).map(row => ({ ...row, status: STATUS.FAILED, note: errorMessage })));
            setPhase('FAILED');
            setMessage(`${errorMessage} 공급가액은 수정되지 않았습니다.`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const totalCount = rows?.length || 0;
    const changedCount = rows?.filter(row => row.status === 'CHANGED').length || 0;
    const unchangedCount = rows?.filter(row => row.status === 'UNCHANGED').length || 0;
    const failureCount = rows?.filter(row => row.status === STATUS.FAILED).length || 0;
	const sucessCount = rows?.filter(row => row.status === STATUS.APPLIED).length || 0;
    const summary = busy
        ? `${phase === 'APPLYING' ? '반영 진행중' : '비교 진행중'} · 전체 ${totalCount}건`
        : `수정 ${changedCount + sucessCount}건 · 미수정 ${unchangedCount}건 · 오류 ${failureCount}건`;

    // 확인 버튼에서만 실제 DB 반영을 수행한다. 업로드/비교 단계에서는 DB를 변경하지 않는다.
    const handleApply = async () => {
        const changedRows = (rows || []).filter(row => row.status === 'CHANGED');
        if (!changedRows.length) {
            closeResult();
            return;
        }

        setPhase('APPLYING');
        setMessage('변경 이력 저장 및 금액 재계산 결과를 반영하고 있습니다.');
        try {
            const [taxInfoResponse, codeData, detailCodeData] = await Promise.all([
                axios.get('/api/newcar/tax-info'),
                gf.getCodes(['NTTCD']),
                gf.getCodeDetails(['TUSE'])
            ]);
            const taxInfo = taxInfoResponse.data?.data;
            if (!taxInfo) throw new Error('신규등록 NTTCD/TUSE 조회 결과가 없습니다.');
            const codes = { ...codeData, TUSE: detailCodeData?.TUSE || [] };

            const payload = [];
            for (const row of changedRows) {
                try {
                    const calculated = await calculateSupplyAmountRow(row, taxInfo, codes);
                    payload.push({
                        ...calculated.applyRow,
                        before: row.before,
                        after: row.after,
                        changedFields: row.changedFields
                    });
                } catch (error) {
                    const errorMessage = getErrorMessage(error, '금액 계산에 실패했습니다.');
                    setRows(current => current.map(item => (
                        item.linkId === row.linkId
                            ? { ...item, status: STATUS.FAILED, note: errorMessage }
                            : item
                    )));
                    setPhase('PREVIEW');
                    setMessage(`[${row.linkId}] ${errorMessage}`);
                    return;
                }
            }

            await axios.post('/api/newcar/supply-amount-apply', payload);
            setRows(current => current.map(row => (
                row.status === 'CHANGED' ? { ...row, status: STATUS.APPLIED, note: '반영 완료' } : row
            )));
            setPhase('APPLIED');
            setMessage('변경된 데이터가 저장되었습니다.');
            await onApplied?.();
        } catch (error) {
            const errorMessage = getErrorMessage(error, '데이터 수정 반영 중 오류가 발생했습니다.');
            const failedLinkId = errorMessage.match(/\[([^\]]+)\]/)?.[1];
            if (failedLinkId) {
                setRows(current => current.map(row => (
                    row.linkId === failedLinkId
                        ? { ...row, status: STATUS.FAILED, note: errorMessage.replace(/^\[[^\]]+\]\s*/, '') }
                        : row
                )));
            }
            setPhase('PREVIEW');
            setMessage(errorMessage);
        }
    };

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
                            <strong id="wa-supply-amount-title">데이터 수정</strong>
                            <button type="button" className="wa-request-modal-close" onClick={onClose} aria-label="닫기">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="wa-action-confirm-content">
                            수정된 엑셀 파일을 업로드해주세요.
                        </div>
                        <footer className="wa-action-confirm-footer">
							{/* 
                            <button type="button" className="wa-status-action outline" onClick={handleTemplateDownload}>
								<Download size={15} />
                                <span>양식 다운로드</span>
                            </button>
							*/}
                            <button type="button" className="wa-status-action primary" onClick={() => fileInputRef.current?.click()}>
                                <Upload size={15} />
                                <span>데이터 수정 업로드</span>
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
                        style={{ width: 'min(980px, calc(100vw - 32px))' }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wa-supply-amount-result-title"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <header className="wa-action-confirm-header">
                            <strong id="wa-supply-amount-result-title">데이터 수정 확인</strong>
                            <button type="button" className="wa-request-modal-close" onClick={closeResult} disabled={busy} aria-label="닫기">
                                <X size={18} />
                            </button>
                        </header>
                        <div className={phase === 'PREVIEW' || busy ? 'wa-status-notice' : 'wa-status-error'}>
                            {summary}{message ? `\n${message}` : ''}
                        </div>
                        <div className="wa-status-table-scroll" style={{ maxHeight: '55vh' }}>
                            <table className="wa-status-table wa-supply-amount-comparison-table" style={{ width: '100%', minWidth: '1650px' }}>
                                <thead>
                                    <tr>
                                        <th>순번</th>
                                        {COMPARISON_COLUMNS.map(column => <th key={column.key}>{column.label}</th>)}
                                        <th className="wa-supply-amount-result-column">결과</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={`${row.row}-${row.linkId}-${row.carIdNo}`}>
                                            <td>{index + 1}</td>
                                            {COMPARISON_COLUMNS.map(column => {
                                                const value = column.key === 'linkId' || column.key === 'carIdNo'
                                                    ? row[column.key]
                                                    : row.after?.[column.key] ?? row[column.key];
                                                const changed = row.changedFields?.includes(column.key);
                                                return (
                                                    <td key={column.key} className={changed ? 'wa-supply-amount-changed' : ''}>
                                                        {formatComparisonValue(value, column)}
                                                    </td>
                                                );
                                            })}
                                            <td className="wa-supply-amount-result-column">{getStatusView(row.status, row.note)}</td>
                                        </tr>
                                    ))}
                                    {!rows.length && (
                                        <tr><td colSpan={COMPARISON_COLUMNS.length + 2} className="wa-status-empty">{message || '처리 결과가 없습니다.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <footer className="wa-action-confirm-footer wa-supply-amount-result-footer">
                            <span className="wa-supply-amount-apply-message">
                                {phase === 'APPLIED' ? '데이터 수정이 완료되었습니다.' : '위 내용으로 데이터를 수정합니다.'}
                            </span>
                            <div className="wa-supply-amount-result-actions">
                                {phase !== 'APPLIED' && (
                                    <button type="button" className="wa-status-action outline" onClick={closeResult} disabled={busy}>취소</button>
                                )}
                                <button type="button" className="wa-status-action primary" onClick={phase === 'APPLIED' ? closeResult : handleApply} disabled={busy}>
                                    {busy ? <><LoaderCircle size={15} className="wa-spin" /> {phase === 'APPLYING' ? '반영 중' : '비교 중'}</> : phase === 'APPLIED' ? '닫기' : '확인'}
                                </button>
                            </div>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};

export default WaSupplyAmountModal;
