import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function IdCardUpload() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [data, setData] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('요청 정보를 확인하는 중입니다.');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    axios.get('/api/numplateapp/id-card', { params: { token } })
      .then(({ data: response }) => { setData(response.data); setMessage(''); })
      .catch((error) => setMessage(error.response?.data?.message || '유효하지 않은 신분증 등록 주소입니다.'));
  }, [token]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      imageRef.current = image;
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * canvas.width / rect.width,
      (event.clientY - rect.top) * canvas.height / rect.height];
  };

  const startMask = (event) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.strokeStyle = '#000';
    context.lineWidth = Math.max(18, Math.max(canvasRef.current.width, canvasRef.current.height) * 0.035);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(...point(event));
  };

  const drawMask = (event) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current.getContext('2d');
    context.lineTo(...point(event));
    context.stroke();
  };

  const resetMask = () => {
    const canvas = canvasRef.current;
    if (canvas && imageRef.current) canvas.getContext('2d').drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
  };

  const upload = async () => {
    if (!file) return setMessage('신분증 사진을 선택해 주세요.');
    if (!window.confirm('주민번호 뒷자리를 가린 사진인지 확인하셨습니까?')) return;
    setSaving(true);
    setMessage('');
    const body = new FormData();
    body.append('token', token);
    try {
      const blob = await new Promise((resolve) => canvasRef.current?.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('canvas');
      body.append('file', blob, 'id-card.jpg');
      await axios.post('/api/numplateapp/id-card', body);
      setData({ ...data, UPLOADED: true });
      setFile(null);
      setMessage('신분증 사진을 등록했습니다. 휴대폰에 남은 사진을 삭제해 주세요.');
    } catch (error) {
      setMessage(error.response?.data?.message || '신분증 사진을 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="numplate-login-page">
      <section className="numplate-login-card numplate-id-card-upload">
        <h1>신분증 사진 등록</h1>
        {data && <p>{data.CAR_NO} 차량의 번호판 교체를 위해 신분증 사진을 등록해 주세요.</p>}
        <p className="numplate-photo-guide">주민번호 뒷자리를 반드시 가리고, 촬영한 사진은 등록 완료 후 휴대폰에서도 삭제해 주세요.</p>
        {data && !data.UPLOADED && <>
          {file && <>
            <p className="numplate-photo-guide">사진 위의 주민번호 뒷자리를 손가락으로 문질러 검게 가려 주세요.</p>
            <canvas ref={canvasRef} className="numplate-id-card-canvas" aria-label="신분증 주민번호 마스킹 편집 영역"
              onPointerDown={startMask} onPointerMove={drawMask}
              onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }} />
            <button type="button" className="numplate-secondary-button" onClick={resetMask}>마스킹 지우기</button>
          </>}
          <label className="numplate-photo-button">{file ? '사진 다시 선택' : '신분증 사진 선택'}<input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <button className="numplate-primary-button" type="button" onClick={upload} disabled={saving || !file}>{saving ? '등록 중…' : '사진 등록'}</button>
        </>}
        {data?.UPLOADED && <p className="numplate-status-warning">이미 신분증 사진이 등록되었습니다.</p>}
        {message && <p className="numplate-inline-message" role="status">{message}</p>}
      </section>
    </main>
  );
}
