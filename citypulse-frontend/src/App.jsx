import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';

import Dashboard from './pages/Dashboard';
import Issues from './pages/Issues';
import CreateIssue from './pages/CreateIssue';
import IssueDetails from './pages/IssueDetails';
import Assignments from './pages/Assignments';
import Feedback from './pages/Feedback';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes Wrapper (Dashboard Layout) */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="issues" element={<Issues />} />
          <Route path="issues/new" element={<CreateIssue />} />
          <Route path="issues/:id" element={<IssueDetails />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="profile" element={<Profile />} />
          {/* We will add other routes here later */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
