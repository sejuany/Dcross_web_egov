import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NumPlateApp, { NumPlateInventory } from './NumPlateApp';
import NumPlateAppLogin from './NumPlateAppLogin';
import ProcessList from './ProcessList';
import NReqDetail from './NReqDetail';
import ProcessStatus from './ProcessStatus';
import ReturnList from './ReturnList';
import ReturnDetail from './ReturnDetail';

// 번호판 앱 전용 로그인으로 만든 세션만 하위 업무 화면에 접근할 수 있다.
function NumPlateAppGuard({ children }) {
  const { user } = useAuth();
  const loginType = user?.login_GB || user?.LOGIN_GB;
  return loginType === 'NUMPLATE_APP' ? children : <Navigate replace to="/numplateapp/login" />;
}

function PendingPage({ title }) {
  return (
    <section className="numplate-process-page">
      <div className="numplate-page-title"><h1>{title}</h1></div>
      <p className="numplate-empty">준비 중입니다.</p>
    </section>
  );
}

export default function NumPlateAppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<NumPlateAppLogin />} />
      <Route element={<NumPlateAppGuard><NumPlateApp /></NumPlateAppGuard>}>
        {/* 기본 프로세스: 처리목록 → 처리건 입력/심사요청 → 처리결과조회 */}
        <Route index element={<ProcessList />} />
        <Route path="request/:serviceId" element={<NReqDetail />} />
        <Route path="status/:serviceId" element={<ProcessStatus />} />
        <Route path="returns" element={<ReturnList />} />
        <Route path="returns/:serviceId" element={<ReturnDetail />} />
        {/* 아직 이관하지 않은 하단 메뉴는 안내 화면을 표시한다. */}
        <Route path="notifications" element={<PendingPage title="알림센터" />} />
        <Route path="mypage" element={<PendingPage title="마이페이지" />} />
        <Route path="plates" element={<NumPlateInventory />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/numplateapp" />} />
    </Routes>
  );
}
