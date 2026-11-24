import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NumPlateApp, { NumPlateInventory } from './NumPlateApp';
import NumPlateAppLogin from './NumPlateAppLogin';
import NumPlateSessionStatus from './NumPlateSessionStatus';
import ProcessList from './ProcessList';
import NReqDetail from './NReqDetail';
import ProcessStatus from './ProcessStatus';
import ReturnList from './ReturnList';
import ReturnDetail from './ReturnDetail';
import NotificationCenter from './NotificationCenter';
import PushDiagnostics from './PushDiagnostics';
import MyPage from './MyPage';
import IdCardUpload from './IdCardUpload';
import AttachImageList from '../numplate/AttachImageList';
import { isNumPlateUser, isImageManagementUser, numPlateHome } from './numplateAuth';

// 번호판 앱 전용 로그인으로 만든 세션만 하위 업무 화면에 접근할 수 있다.
function NumPlateAppGuard({ children }) {
  const { user, numPlateSessionLoading, numPlateSessionError, retryNumPlateSession } = useAuth();
  const location = useLocation();
  if (numPlateSessionLoading || numPlateSessionError) {
    return <NumPlateSessionStatus loading={numPlateSessionLoading} error={numPlateSessionError} onRetry={retryNumPlateSession} />;
  }
  if (!isNumPlateUser(user)) {
    return <Navigate replace to="/numplateapp/login" state={{ from: location.pathname + location.search }} />;
  }
  const imageRoute = location.pathname.replace(/\/+$/, '') === '/numplateapp/images';
  if (isImageManagementUser(user) !== imageRoute) {
    return <Navigate replace to={numPlateHome(user)} />;
  }
  return children;
}

export default function NumPlateAppRoutes() {
  const { user } = useAuth();
  const company = user?.company_ID || user?.COMPANY_ID;
  const accountWorkCd = company === 'CB057' ? '030' : ['CB307', 'CB407'].includes(company) ? '011' : undefined;
  return (
    <Routes>
      <Route path="login" element={<NumPlateAppLogin />} />
      <Route path="id-card" element={<IdCardUpload />} />
      <Route element={<NumPlateAppGuard><NumPlateApp /></NumPlateAppGuard>}>
        {/* 기본 프로세스: 처리목록 → 처리건 입력/심사요청 → 처리결과조회 */}
        <Route index element={<ProcessList />} />
        <Route path="images" element={<AttachImageList accountWorkCd={accountWorkCd} />} />
        <Route path="request/:serviceId" element={<NReqDetail />} />
        <Route path="status/:serviceId" element={<ProcessStatus />} />
        <Route path="returns" element={<ReturnList />} />
        <Route path="returns/:serviceId" element={<ReturnDetail />} />
        {/* 아직 이관하지 않은 하단 메뉴는 안내 화면을 표시한다. */}
        <Route path="notifications" element={<NotificationCenter />} />
        <Route path="push-test" element={<PushDiagnostics />} />
        <Route path="mypage" element={<MyPage />} />
        <Route path="plates" element={<NumPlateInventory />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/numplateapp" />} />
    </Routes>
  );
}
