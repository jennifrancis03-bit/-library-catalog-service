import { useEffect, useState } from 'react';
import { getErrorMessage, requestJson } from './api.js';
import AdminBooksPage from './pages/admin/AdminBooksPage.jsx';
import AdminBorrowRequestsPage from './pages/admin/AdminBorrowRequestsPage.jsx';
import AdminBookingsPage from './pages/admin/AdminBookingsPage.jsx';

const pages = {
  '#/books': { title: 'Books', component: AdminBooksPage },
  '#/borrow-requests': { title: 'Borrow requests', component: AdminBorrowRequestsPage },
  '#/bookings': { title: 'Space bookings', component: AdminBookingsPage },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState({ loading: true, error: '' });
  const [hash, setHash] = useState(window.location.hash || '#/books');
  const page = pages[hash] || pages['#/books'];
  const PageComponent = page.component;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/books');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    requestJson('/api/users/profile')
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch((error) => {
        if (active) setAuthState({ loading: false, error: getErrorMessage(error) });
      })
      .finally(() => {
        if (active) setAuthState((current) => ({ ...current, loading: false }));
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
      window.location.assign('/login?returnTo=%2Fadmin%2F');
    } catch (error) {
      setAuthState((current) => ({ ...current, error: getErrorMessage(error) }));
    }
  }

  if (authState.loading) return <main className="status-panel" role="status">Checking librarian access...</main>;
  if (authState.error && !user) {
    return (
      <main className="status-panel">
        <p className="error-message" role="alert">{authState.error}</p>
        <a className="button-link" href="/login?returnTo=%2Fadmin%2F">Log in</a>
      </main>
    );
  }
  if (user?.role !== 'librarian') {
    return (
      <main className="status-panel">
        <h1>Access restricted</h1>
        <p className="error-message" role="alert">A librarian account is required to use the admin panel.</p>
        <a className="button-link" href="/">Return to the catalog</a>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="#/books">COMMONPLACE <span>LIBRARY ADMIN</span></a>
        <nav aria-label="Admin pages">
          <a href="#/books" aria-current={hash === '#/books' ? 'page' : undefined}>Books</a>
          <a href="#/borrow-requests" aria-current={hash === '#/borrow-requests' ? 'page' : undefined}>Borrow requests</a>
          <a href="#/bookings" aria-current={hash === '#/bookings' ? 'page' : undefined}>Bookings</a>
        </nav>
        <div className="admin-user">
          <span>{user.username}</span>
          <button type="button" className="secondary-button" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="admin-main">
        <div className="page-heading">
          <p className="eyebrow">Librarian workspace</p>
          <h1>{page.title}</h1>
        </div>
        <PageComponent />
      </main>
    </div>
  );
}
