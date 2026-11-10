import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { History, X } from 'lucide-react';
import axios from 'axios';

const NumplateSelectionHistory = ({ dsService }) => {
	const [actionHistoryModal, setActionHistoryModal] = useState({
		open: false,
		tab: 'history',
		loading: false,
		error: '',
		rows: [],
		imageError: false
	});
	const [reportImageErrors, setReportImageErrors] = useState({});

	const NUMPLATE_ACTION_LABELS = {
		NUMBER_CLICK: '번호 선택',
		CONFIRM_OPEN: '확인창 열림',
		CONFIRM_CANCEL: '확인창 취소',
		CONFIRM_REQUEST: '확정 요청',
		CONFIRM_SUCCESS: '확정 성공',
		CONFIRM_FAILURE: '확정 실패'
	};

	const handleOpenActionHistory = async () => {
		setReportImageErrors({});
		if (!dsService?.SERVICE_ID) {
			setActionHistoryModal({ open: true, tab: 'history', loading: false, error: '', rows: [], imageError: false });
			return;
		}
		setActionHistoryModal({ open: true, tab: 'history', loading: true, error: '', rows: [], imageError: false });
		try {
			const { data } = await axios.get('/api/newcar/numplate-selection/actions', {
				params: { serviceId: dsService.SERVICE_ID }
			});
			setActionHistoryModal({
				open: true,
				tab: 'history',
				loading: false,
				error: '',
				rows: Array.isArray(data?.list) ? data.list : [],
				imageError: false
			});
		} catch (e) {
			setActionHistoryModal({
				open: true,
				tab: 'history',
				loading: false,
				error: e.response?.data?.message || '이력을 불러오지 못했습니다.',
				rows: [],
				imageError: false
			});
		}
	};

	const closeActionHistoryModal = () => {
		setReportImageErrors({});
		setActionHistoryModal(prev => ({ ...prev, open: false }));
	};

	const actionHistoryRows = actionHistoryModal.rows.filter(row => row.EVENT_CD !== 'ERROR_REPORT');
	const errorReportRows = actionHistoryModal.rows.filter(row => row.EVENT_CD === 'ERROR_REPORT');

	return (
		<>
			<div className="wa-carinfo-history-bar">
				<button
					type="button"
					className="wa-carinfo-history-btn"
					onClick={handleOpenActionHistory}
				>
					<History size={15} />
					번호판선택이력
				</button>
			</div>
			{actionHistoryModal.open && createPortal(
				<div
					className="wa-request-modal-backdrop wa-numplate-history-backdrop"
					role="presentation"
					onMouseDown={closeActionHistoryModal}
				>
					<section
						className="wa-action-confirm-frame wa-numplate-history-modal"
						role="dialog"
						aria-modal="true"
						aria-labelledby="wa-numplate-history-title"
						onMouseDown={e => e.stopPropagation()}
					>
						<header className="wa-action-confirm-header">
							<strong id="wa-numplate-history-title">번호 선택 이력</strong>
							<button
								type="button"
								className="wa-request-modal-close"
								onClick={closeActionHistoryModal}
								aria-label="닫기"
							>
								<X size={18} />
							</button>
						</header>
						<div className="wa-numplate-history-tabs" role="tablist">
							<button
								type="button"
								role="tab"
								aria-selected={actionHistoryModal.tab === 'history'}
								className={`wa-numplate-history-tab ${actionHistoryModal.tab === 'history' ? 'active' : ''}`}
								onClick={() => setActionHistoryModal(prev => ({ ...prev, tab: 'history' }))}
							>
								이력
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={actionHistoryModal.tab === 'report'}
								className={`wa-numplate-history-tab ${actionHistoryModal.tab === 'report' ? 'active' : ''}`}
								onClick={() => setActionHistoryModal(prev => ({ ...prev, tab: 'report', imageError: false }))}
							>
								오류제출{errorReportRows.length > 0 ? ` (${errorReportRows.length})` : ''}
							</button>
						</div>
						<div className="wa-numplate-history-content">
							{actionHistoryModal.loading ? (
								<div className="wa-numplate-history-state">이력을 불러오는 중입니다.</div>
							) : actionHistoryModal.error ? (
								<div className="wa-numplate-history-state error">{actionHistoryModal.error}</div>
							) : actionHistoryModal.tab === 'report' ? (
								errorReportRows.length > 0 ? (
									<div className="wa-numplate-report-view">
										<div className="wa-numplate-report-list">
											{errorReportRows.map((row, idx) => {
												const seqNo = row.REPORT_SEQ_NO || String(idx + 1).padStart(2, '0');
												const imageKey = row.ACTION_ID || idx;
												const imageFailed = !!reportImageErrors[imageKey];
												const imageSrc = `/api/newcar/numplate-selection/report-image?serviceId=${encodeURIComponent(dsService?.SERVICE_ID || '')}&seq=${seqNo}&v=${row.ACTION_ID || 0}`;

												return (
													<div key={row.ACTION_ID || idx} className="wa-numplate-report-item">
														<div className="wa-numplate-report-meta">
															<span className="wa-numplate-report-seq">#{seqNo} ({idx + 1}차 제출)</span>
															<span>제출일시: {row.INS_DATE || '-'}</span>
															{row.CAR_NO && row.CAR_NO !== '-' && <span>선택하려던 번호: {row.CAR_NO}</span>}
														</div>
														{dsService?.SERVICE_ID && !imageFailed && (
															<div className="wa-numplate-report-image-box">
																<a href={imageSrc} target="_blank" rel="noopener noreferrer" title="새 창에서 원본 보기">
																	<img
																		src={imageSrc}
																		alt={`고객 오류제출 캡쳐 화면 #${seqNo}`}
																		onError={() => setReportImageErrors(prev => ({ ...prev, [imageKey]: true }))}
																	/>
																</a>
															</div>
														)}
														{imageFailed && <p role="status">캡쳐 이미지를 불러오지 못했습니다.</p>}
														<pre className="wa-numplate-report-detail">{row.DETAIL_TX || '-'}</pre>
													</div>
												);
											})}
										</div>
									</div>
								) : (
									<div className="wa-numplate-history-state">조회된 오류제출 내역이 없습니다.</div>
								)
							) : (
								<div className="wa-numplate-history-table-wrap">
									<table className="wa-numplate-history-table">
										<thead>
											<tr>
												<th>일시</th>
												<th>상태</th>
											</tr>
										</thead>
										<tbody>
											{actionHistoryRows.length > 0 ? (
												actionHistoryRows.map(row => (
													<tr key={row.ACTION_ID}>
														<td>{row.INS_DATE || '-'}</td>
														<td>
															<span className={`wa-numplate-event-badge event-${String(row.EVENT_CD || '').toLowerCase()}`}>
																{NUMPLATE_ACTION_LABELS[row.EVENT_CD] || row.EVENT_CD || '-'}
															</span>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td colSpan={2} className="wa-numplate-history-empty">
														조회된 이력이 없습니다.
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							)}
						</div>
						<footer className="wa-action-confirm-footer">
							<button
								type="button"
								className="wa-status-action primary"
								onClick={closeActionHistoryModal}
							>
								확인
							</button>
						</footer>
					</section>
				</div>,
				document.body
			)}
		</>
	);
};

export default NumplateSelectionHistory;
