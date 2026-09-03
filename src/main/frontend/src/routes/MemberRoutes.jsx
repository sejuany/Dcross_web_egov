import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import Layout from '../components/layout/Layout';
import SignupTerm from '../components/member/SignupTerm';
import SignForm from '../components/member/SignForm';
import MemberPasswordCheck from '../components/member/MemberPasswordCheck';
import MemberEdit from '../components/member/MemberEdit';
import Policy from '../components/member/Policy';

const MemberRoutes = (
  <>
    <Route path="/signup" element={<SignupTerm />} />
    <Route path="/signup-form" element={<SignForm />} />
	{/* 개인정보 처리방침 */}
	<Route path="/policy" element={<Policy />} />

    <Route
      path="/mypage/member-password-check"
      element={
        <ProtectedRoute>
          <Layout>
            <MemberPasswordCheck />
          </Layout>
        </ProtectedRoute>
      }
    />

    <Route
      path="/mypage/member-edit"
      element={
        <ProtectedRoute>
          <Layout>
            <MemberEdit />
          </Layout>
        </ProtectedRoute>
      }
    />
  </>
);

export default MemberRoutes;