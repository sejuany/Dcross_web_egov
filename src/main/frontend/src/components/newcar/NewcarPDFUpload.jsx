import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import './NewcarRequest.css';
import './NewcarPDFUpload.css';

const resultColumns = [
    { key: 'SERVICE_ID', label: '접수번호' },
    { key: 'ORIGINAL_FILE_NAME', label: '파일명' },
    { key: 'CARID_NO', label: '차대번호' },
    { key: 'CAR_NM', label: '차명' },
    { key: 'BUY_AMT', label: '공급가액' },
    { key: 'OWNER_NM', label: '소유자명' },
    { key: 'REG_NO', label: '주민/법인등록번호' },
    { key: 'MADE_DT', label: '제작연월일' },
    { key: 'LAST_DT', label: '최초양도연월일' }
];

const toPreviewRow = (file, data, index) => ({
    ROW_NO: index + 1,
    SERVICE_ID: '',
    ORIGINAL_FILE_NAME: file.name,
    CARID_NO: data.carIdNo || '',
    CAR_NM: data.carName || '',
    BUY_AMT: String(data.supplyAmount || '').replace(/[^0-9]/g, ''),
    OWNER_NM: data.ownerName || '',
    REG_NO: String(data.ownerRegNo || '').replace(/[^0-9]/g, ''),
    MADE_DT: String(data.manufactureDate || '').replace(/[^0-9]/g, ''),
    LAST_DT: String(data.firstTransferDate || '').replace(/[^0-9]/g, ''),
    rawText: data.rawText || ''
});

const NewcarPDFUpload = () => {
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [rows, setRows] = useState([]);
    const [errors, setErrors] = useState([]);
    const [message, setMessage] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const loading = extracting || submitting;

    const selectedFileName = useMemo(() => {
        if (!files.length) {
            return '선택된 파일 없음';
        }

        if (files.length === 1) {
            return files[0].name;
        }

        return `${files[0].name} 외 ${files.length - 1}건`;
    }, [files]);

    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        setFiles(selectedFiles);
        setRows([]);
        setErrors([]);
        setMessage('');
    };

    const handleExtract = async () => {
        if (!files.length) {
            setMessage('PDF 파일을 선택해 주세요.');
            return;
        }

        setExtracting(true);
        setRows([]);
        setErrors([]);
        setMessage('');

        const extractedRows = [];
        const extractErrors = [];

        try {
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const formData = new FormData();
                formData.append('file', file);

                const response = await axios.post('/api/newcar/pdf-extract', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                if (!response.data?.success) {
                    extractErrors.push({
                        row: index + 1,
                        fileName: file.name,
                        carIdNo: '',
                        errors: [response.data?.message || 'PDF 추출에 실패했습니다.']
                    });
                    continue;
                }

                extractedRows.push(toPreviewRow(file, response.data.data || {}, index));
            }

            setRows(extractedRows);
            setErrors(extractErrors);

            if (extractErrors.length) {
                setMessage('일부 PDF 추출에 실패했습니다. 오류 내용을 확인해 주세요.');
            } else {
                setMessage(`${extractedRows.length}건의 PDF 추출이 완료되었습니다. 결과 확인 후 신청해 주세요.`);
            }
        } catch (error) {
            setMessage(error.response?.data?.message || 'PDF 추출 중 오류가 발생했습니다.');
        } finally {
            setExtracting(false);
        }
    };

    const handleSubmit = async () => {
        if (!files.length) {
            setMessage('PDF 파일을 선택해 주세요.');
            return;
        }

        if (!rows.length) {
            setMessage('먼저 PDF 추출을 실행해 주세요.');
            return;
        }

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        setSubmitting(true);
        setErrors([]);
        setMessage('');

        try {
            const response = await axios.post('/api/newcar/pdf-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (!response.data?.success) {
                setMessage(response.data?.message || 'PDF 업로드 신청에 실패했습니다.');
                return;
            }

            const data = response.data.data || {};
            setRows(data.rows || []);
            setErrors(data.errors || []);

            if (data.success) {
                setMessage(`${data.insertCount || 0}건의 제작증 업로드 신청이 완료되었습니다.`);
            } else {
                setMessage('검증 오류가 있어 신규등록 저장을 중단했습니다. 오류 내용을 확인해 주세요.');
            }
        } catch (error) {
            setMessage(error.response?.data?.message || 'PDF 업로드 신청 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setFiles([]);
        setRows([]);
        setErrors([]);
        setMessage('');

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="new-reg-container pdf-upload-container">
            <div className="erp-toolbar">
                <div className="toolbar-left">
                    <span className="toolbar-title">제작증 업로드</span>
                </div>
                <div className="toolbar-right">
                    <button type="button" className="btn-erp light" onClick={handleReset} disabled={loading}>
                        초기화
                    </button>
                </div>
            </div>

            <div className="pdf-upload-content">
                <ErpSection title="PDF 파일">
                    <div className="erp-row">
                        <ErpField label="제작증 PDF" span={12}>
                            <div className="pdf-file-control">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    multiple
                                    className="pdf-file-input"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                />
                                <button type="button" className="btn-erp sm" onClick={handleExtract} disabled={loading}>
                                    {extracting ? '추출중' : 'PDF 추출'}
                                </button>
                                <button type="button" className="btn-erp sm" onClick={handleSubmit} disabled={loading || !rows.length}>
                                    {submitting ? '신청중' : '신청'}
                                </button>
                                <span className="pdf-file-name">{selectedFileName}</span>
                            </div>
                        </ErpField>
                    </div>
                </ErpSection>

                {message && (
                    <div className={`pdf-upload-message ${errors.length ? 'warn' : 'success'}`}>
                        {message}
                    </div>
                )}

                {errors.length > 0 && (
                    <ErpSection title="검증 오류">
                        <div className="pdf-result-table-wrap">
                            <table className="pdf-result-table">
                                <thead>
                                    <tr>
                                        <th>순번</th>
                                        <th>파일명</th>
                                        <th>차대번호</th>
                                        <th>오류내용</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {errors.map(error => (
                                        <tr key={`${error.row}-${error.fileName}`}>
                                            <td>{error.row}</td>
                                            <td className="text-left">{error.fileName}</td>
                                            <td>{error.carIdNo}</td>
                                            <td className="text-left">{(error.errors || []).join(', ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ErpSection>
                )}

                <ErpSection title="처리 결과">
                    <div className="pdf-result-table-wrap">
                        <table className="pdf-result-table">
                            <thead>
                                <tr>
                                    {resultColumns.map(column => (
                                        <th key={column.key}>{column.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={resultColumns.length}>처리 결과가 없습니다.</td>
                                    </tr>
                                ) : (
                                    rows.map((row, rowIndex) => (
                                        <tr key={`${row.SERVICE_ID || row.CARID_NO || rowIndex}-${rowIndex}`}>
                                            {resultColumns.map(column => (
                                                <td key={column.key} className={['ORIGINAL_FILE_NAME', 'CAR_NM', 'OWNER_NM'].includes(column.key) ? 'text-left' : ''}>
                                                    {row[column.key] || ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </ErpSection>
            </div>
        </div>
    );
};

export default NewcarPDFUpload;
