import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

/** 기존 DisNumplateInfoDT.do와 songjangInput.jsp의 폐번호판 촬영·등록 화면. */
export default function ReturnDetail() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`/api/numplateapp/returns/${encodeURIComponent(serviceId)}`)
      .then(({ data }) => setDetail(data.data))
      .catch((error) => setMessage(error.response?.data?.message || '반납 처리 건을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [serviceId]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const selectPhoto = (event) => {
    const selected = event.target.files?.[0] || null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : '');
    setMessage('');
  };

  const upload = async () => {
    if (!file) {
      setMessage('절단된 폐번호판 사진을 촬영하거나 선택해 주세요.');
      return;
    }
    if (!window.confirm('절단된 폐번호판 사진이 맞습니까?\n등록 후 반납목록에서 사라집니다.')) return;
    setLoading(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      await axios.post(`/api/numplateapp/returns/${encodeURIComponent(serviceId)}/photo`, body);
      navigate('/numplateapp/returns', { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message || '폐번호판 사진을 등록하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!detail) return <section className="numplate-process-page"><p className="numplate-inline-message" role="alert">{message || (loading ? '불러오는 중…' : '반납 처리 건이 없습니다.')}</p></section>;

  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title">
        <div><h1>폐번호판 사진등록</h1><span>{serviceId}</span></div>
        <button type="button" onClick={() => navigate('/numplateapp/returns')}>목록</button>
      </div>

      <div className="numplate-return-summary">
        <strong>{detail.CAR_NO || '-'}</strong>
        <span>{detail.BUY_NM || '-'}</span>
        <small>신규번호 {detail.POST_CAR_NO || '-'}</small>
      </div>

      <div className="numplate-return-photo">
        <h2>폐번호판 사진촬영</h2>
        <p>반드시 절단된 폐번호판 사진을 업로드하세요.<br />업로드 후 반납목록에서 사라집니다.</p>
        {preview && <img src={preview} alt="선택한 폐번호판 미리보기" />}
        <label className="numplate-photo-button">
          {file ? '다시 촬영하기' : '사진 촬영하기'}
          <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={selectPhoto} />
        </label>
        {message && <p className="numplate-inline-message" role="alert">{message}</p>}
        <button className="numplate-primary-button" type="button" onClick={upload} disabled={loading || !file}>{loading ? '등록 중…' : '폐번호판 사진 등록'}</button>
      </div>
    </section>
  );
}
