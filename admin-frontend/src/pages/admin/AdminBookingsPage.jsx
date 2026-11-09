import { useEffect, useState } from 'react';
import { getErrorMessage, requestJson } from '../../api.js';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadBookings() {
    setLoading(true);
    setError('');
    try {
      const result = await requestJson('/api/bookings');
      setBookings(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBookings(); }, []);

  return (
    <section className="table-card">
      <div className="section-heading"><h2>All space bookings</h2><button className="secondary-button" type="button" onClick={loadBookings}>Refresh</button></div>
      {loading ? <p role="status">Loading bookings...</p>
        : error ? <p className="error-message" role="alert">{error}</p>
          : bookings.length === 0 ? <p className="empty-message">There are no space bookings yet.</p>
            : <div className="table-scroll"><table>
              <thead><tr><th>Space</th><th>Patron</th><th>Date</th><th>Start</th><th>End</th></tr></thead>
              <tbody>{bookings.map((booking) => (
                <tr key={booking._id}>
                  <td>{booking.space}</td>
                  <td>{booking.user?.username || booking.user?.email || 'Unknown patron'}</td>
                  <td>{booking.date}</td>
                  <td>{booking.startTime}</td>
                  <td>{booking.endTime}</td>
                </tr>
              ))}</tbody>
            </table></div>}
    </section>
  );
}
