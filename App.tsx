import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Devices from './pages/Devices';
import Dashboard from './pages/Dashboard';
import { getAuthToken } from './services/api';

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = getAuthToken();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route 
            path="/devices" 
            element={
              <ProtectedRoute>
                <Devices />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/:deviceId" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;