import React from 'react';

export default function NumPlateSessionStatus({ loading, error, onRetry }) {
  return (
    <main className="numplate-login-page">
      <section className="numplate-login-card" aria-busy={loading}>
        <p role={error ? 'alert' : 'status'}>{loading ? '로그인 상태를 확인하고 있습니다.' : error}</p>
        {!loading && error && <button className="numplate-primary-button" type="button" onClick={onRetry}>다시 확인</button>}
      </section>
    </main>
  );
}
