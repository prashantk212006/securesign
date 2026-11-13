
import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
} from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SendDocument from './pages/SendDocument';
import History from './pages/History';
import AuditTrail from './pages/AuditTrail';
import ClientSigning from './pages/ClientSigning';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';

function SigningRoute() {
  const { token } = useParams();
  return <ClientSigning invitationToken={token} />;
}

function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem('securesign_token')
  );

  const [page, setPage] = useState(
    localStorage.getItem('securesign_admin_page') || 'dashboard'
  );

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });

    document.querySelectorAll('[data-page-scroll]').forEach((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
  }, [page]);

  const navigatePage = (nextPage) => {
    setPage(nextPage);
    localStorage.setItem('securesign_admin_page', nextPage);
  };

  const handleLogin = (loginData) => {
    if (!loginData?.access_token) {
      return;
    }

    localStorage.setItem('securesign_token', loginData.access_token);
    localStorage.setItem('securesign_admin_logged_in', 'true');

    if (loginData.user) {
      localStorage.setItem(
        'securesign_admin_user',
        JSON.stringify(loginData.user)
      );
    }

    localStorage.setItem('securesign_admin_page', 'dashboard');
    setPage('dashboard');
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('securesign_token');
    localStorage.removeItem('securesign_admin_logged_in');
    localStorage.removeItem('securesign_admin_user');
    localStorage.removeItem('securesign_admin_page');

    setLoggedIn(false);
    setPage('dashboard');
  };

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const pageTitles = {
    dashboard: 'Dashboard',
    send: 'Send Document',
    history: 'Document History',
    audit: 'Audit Trail',
    settings: 'Settings',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activePage={page}
        onNavigate={navigatePage}
        onLogout={handleLogout}
      />

      <main className="ml-64 min-h-screen min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {pageTitles[page] || 'Dashboard'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              SecureSign Admin Workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              A
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Administrator
              </p>
              <p className="text-xs text-slate-500">Admin account</p>
            </div>
          </div>
        </header>

        <div className="min-w-0">
          {page === 'dashboard' && (
            <Dashboard onNavigate={navigatePage} />
          )}

          {page === 'send' && (
            <SendDocument onBack={() => navigatePage('dashboard')} />
          )}

          {page === 'history' && (
            <History onBack={() => navigatePage('dashboard')} />
          )}

          {page === 'audit' && (
            <AuditTrail onBack={() => navigatePage('history')} />
          )}

          {page === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign/:token" element={<SigningRoute />} />
        <Route path="*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}
