import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { removeAuthToken } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === '/';

  const handleLogout = () => {
    removeAuthToken();
    navigate('/');
  };

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => navigate('/devices')}
            >
              <div className="bg-primary-600 p-2 rounded-lg text-white">
                <ShieldCheck size={24} />
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">ParentGuard</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/devices')}
                className={`p-2 rounded-md transition-colors ${location.pathname === '/devices' ? 'text-primary-600 bg-primary-50' : 'text-slate-500 hover:text-slate-700'}`}
                title="Devices"
              >
                <Smartphone size={20} />
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;