import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoginPage from '../features/login/LoginPage';
import VerifyEmailPage from '../features/login/VerifyEmailPage';
import HomePage from '../features/home/HomePage';
import ProjectPage from '../features/project/ProjectPage';
import SprintsPage from '../features/sprint/SprintsPage';
import IssuesBoard from '../features/issues/IssuesBoard';
import ReflectionPage from '../features/reflection/ReflectionPage';
import SprintManagerPage from '../features/sprintManager/SprintManagerPage';
import PlanningPage from '../features/planning/PlanningPage';
import SprintSubLayout from '../features/sprint/components/SprintSubLayout';
import TaskDetailPage from '../features/planning/taskDetail/TaskDetailPage';
import ProfilePage from '../features/profile/ProfilePage';
import AppearancePage from '../features/settings/AppearancePage';
import PlanPage from '../features/settings/PlanPage';
import IssueUniversePage from '../features/issueUniverse/IssueUniversePage';
import TimelinePage from '../features/timeline/TimelinePage';
import TimeReportPage from '../features/time/TimeReportPage';
import { useAuth } from '../features/auth/hooks/useAuth';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate transition="none" to="/login" />;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="projects" element={<HomePage />} />
        <Route path="project/:projectId/sprints" element={<SprintsPage />} />
        <Route path="project/:projectId/timeline" element={<TimelinePage />} />
        <Route path="project/:projectId/tiempo" element={<TimeReportPage />} />
        <Route path="project/:projectId/universe" element={<IssueUniversePage />} />
        <Route path="project/:projectId" element={<ProjectPage />} />
        <Route path="sprint/:id">
          <Route index element={<SprintManagerPage />} />
          <Route element={<SprintSubLayout />}>
            <Route path="planning" element={<PlanningPage />} />
            <Route path="issues" element={<IssuesBoard />} />
            <Route path="reflection" element={<ReflectionPage />} />
          </Route>
        </Route>
        <Route path="sprint/:sprintId/planning/task/:taskId" element={<TaskDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings/apariencia" element={<AppearancePage />} />
        <Route path="settings/plan" element={<PlanPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
