
import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
} from 'react-router-dom';

import PendingRequests from './pages/PendingRequests';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SendDocument from './pages/SendDocument';
import History from './pages/History';
import AuditTrail from './pages/AuditTrail';
import ClientSigning from './pages/ClientSigning';
import Settings from './pages/Settings';
import AdminManagement from './pages/AdminManagement';
import Sidebar from './components/Sidebar';

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem('securesign_admin_user') || 'null'
    );
  } catch {
    return null;
  }
}

function SigningRoute() {
  const { token } = useParams();

  return <ClientSigning invitationToken={token} />;
}

function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem('securesign_token')
  );

  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const [page, setPage] = useState(
    localStorage.getItem('securesign_admin_page') || 'dashboard'
  );

  const [selectedDraftId, setSelectedDraftId] = useState(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

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
    if (nextPage === 'admins' && !isSuperAdmin) {
      return;
    }

    setPage(nextPage);
    localStorage.setItem('securesign_admin_page', nextPage);
  };

  const handleResumeDraft = (draftId) => {
    setSelectedDraftId(draftId);
    navigatePage('send');
  };

  const handleLogin = (loginData) => {
    if (!loginData?.access_token || !loginData?.user) {
      return;
    }

    localStorage.setItem('securesign_token', loginData.access_token);
    localStorage.setItem('securesign_admin_logged_in', 'true');

    localStorage.setItem(
      'securesign_admin_user',
      JSON.stringify(loginData.user)
    );

    localStorage.setItem('securesign_admin_page', 'dashboard');

    setCurrentUser(loginData.user);
    setPage('dashboard');
    setLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('securesign_token');
    localStorage.removeItem('securesign_admin_logged_in');
    localStorage.removeItem('securesign_admin_user');
    localStorage.removeItem('securesign_admin_page');

    setCurrentUser(null);
    setLoggedIn(false);
    setPage('dashboard');
  };

  if (!loggedIn || !currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const pageTitles = {
    dashboard: 'Dashboard',
    send: 'Send Document',
    pending: 'Pending Requests',
    history: 'Document History',
    audit: 'Audit Trail',
    settings: 'Settings',
    admins: 'Admin Management',
  };

  const safePage =
    page === 'admins' && !isSuperAdmin
      ? 'dashboard'
      : page;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activePage={safePage}
        onNavigate={navigatePage}
        onLogout={handleLogout}
        role={currentUser.role}
      />

      <main className="ml-64 min-h-screen min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {pageTitles[safePage] || 'Dashboard'}
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              SecureSign Admin Workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              {(currentUser.name || 'A')
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                {currentUser.name || 'Administrator'}
              </p>

              <p className="text-xs text-slate-500">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        </header>

        <div className="min-w-0">
          {safePage === 'dashboard' && (
            <Dashboard
              onNavigate={navigatePage}
              role={currentUser.role}
            />
          )}

          {safePage === 'send' && (
            <SendDocument
              onBack={() => navigatePage('dashboard')}
              draftId={selectedDraftId}
            />
          )}

          {safePage === 'pending' && (
            <PendingRequests
              onBack={() => navigatePage('dashboard')}
              onResume={handleResumeDraft}
              role={currentUser.role}
            />
          )}

          {safePage === 'history' && (
            <History
              onBack={() => navigatePage('dashboard')}
              role={currentUser.role}
            />
          )}

          {safePage === 'audit' && (
            <AuditTrail
              onBack={() => navigatePage('history')}
            />
          )}

          {safePage === 'settings' && <Settings />}

          {safePage === 'admins' && isSuperAdmin && (
            <AdminManagement />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/sign/:token"
          element={<SigningRoute />}
        />

        <Route
          path="*"
          element={<AdminApp />}
        />
      </Routes>
    </BrowserRouter>
  );
}
