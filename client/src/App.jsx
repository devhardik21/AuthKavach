import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import RegisterPage from './pages/RegisterPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import Navbar from './components/Navbar';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(10, 22, 10, 0.95)',
            color: '#e8f5e9',
            border: '1px solid rgba(0,255,65,0.25)',
            fontFamily: "'Space Grotesk', monospace",
            fontSize: '13px',
            backdropFilter: 'blur(10px)',
          },
          success: {
            iconTheme: { primary: '#00ff41', secondary: '#080d08' },
          },
          error: {
            iconTheme: { primary: '#ff3b3b', secondary: '#080d08' },
          },
        }}
      />
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth-success" element={<AuthSuccessPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
