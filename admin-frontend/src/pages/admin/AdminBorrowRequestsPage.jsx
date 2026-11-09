import { useEffect, useState } from 'react';
import { getErrorMessage, requestJson } from '../../api.js';

const STATUSES = ['pending', 'approved', 'late', 'returned'];

export default function AdminBorrowRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const result = await requestJson('/api/borrow-requests');
      const data = Array.isArray(result.data) ? result.data : [];
      setRequests(data);
      setSelectedStatuses(Object.fromEntries(data.map((item) => [item._id, item.status])));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRequests(); }, []);

  async function updateStatus(request) {
    setUpdatingId(request._id);
    setError('');
    try {
      await requestJson(`/api/borrow-requests/${encodeURIComponent(request._id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: selectedStatuses[request._id] }),
      });
      await loadRequests();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <section className="table-card">
      <div className="section-heading"><h2>Borrow requests</h2><button className="secondary-button" type="button" onClick={loadRequests}>Refresh</button></div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {loading ? <p role="status">Loading borrow requests...</p>
        : requests.length === 0 ? <p className="empty-message">There are no borrow requests yet.</p>
          : <div className="table-scroll"><table>
            <thead><tr><th>Book</th><th>Patron</th><th>Requested</th><th>Due</th><th>Status</th><th>Fine</th><th>Update</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request._id}>
                <td>{request.book?.title || 'Book removed'}</td>
                <td>{request.user?.username || request.user?.email || 'Unknown patron'}</td>
                <td>{request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : '—'}</td>
                <td>{request.dueAt ? new Date(request.dueAt).toLocaleDateString() : '—'}</td>
                <td>
                  <select
                    aria-label={`Status for ${request.book?.title || 'borrow request'}`}
                    value={selectedStatuses[request._id] || request.status}
                    disabled={request.status === 'returned'}
                    onChange={(event) => setSelectedStatuses({ ...selectedStatuses, [request._id]: event.target.value })}
                  >
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td>${Number(request.fine || 0).toFixed(2)}</td>
                <td><button className="primary-button small-button" type="button" disabled={request.status === 'returned' || updatingId === request._id || selectedStatuses[request._id] === request.status} onClick={() => updateStatus(request)}>{updatingId === request._id ? 'Saving...' : 'Save'}</button></td>
              </tr>
            ))}</tbody>
          </table></div>}
    </section>
  );
}
