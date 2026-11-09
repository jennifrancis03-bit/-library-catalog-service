import { useEffect, useState } from 'react';
import { getErrorMessage, requestJson } from '../../api.js';

const EMPTY_BOOK = {
  title: '',
  author: '',
  isbn: '',
  description: '',
  coverImage: '',
  totalCopies: '1',
  availableCopies: '1',
  genre: '',
};
const BOOK_FIELDS = [
  ['title', 'Title'],
  ['author', 'Author'],
  ['isbn', 'ISBN'],
  ['description', 'Description'],
  ['coverImage', 'Cover image URL'],
];

export default function AdminBooksPage() {
  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_BOOK);

  async function loadBooks() {
    setLoading(true);
    setError('');
    try {
      const [bookResult, genreResult] = await Promise.all([
        requestJson('/books?limit=100'),
        requestJson('/genres'),
      ]);
      setBooks(Array.isArray(bookResult.data) ? bookResult.data : []);
      setGenres(Array.isArray(genreResult) ? genreResult : []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBooks(); }, []);

  function editBook(book) {
    setEditingId(book._id);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      description: book.description,
      coverImage: book.coverImage,
      totalCopies: String(book.totalCopies),
      availableCopies: String(book.availableCopies),
      genre: typeof book.genre === 'object' ? book.genre?._id : book.genre,
    });
    setFormError('');
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_BOOK);
    setFormError('');
  }

  async function saveBook(event) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      ...form,
      totalCopies: Number(form.totalCopies),
      availableCopies: Number(form.availableCopies),
    };
    try {
      await requestJson(editingId ? `/books/${encodeURIComponent(editingId)}` : '/books', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      resetForm();
      await loadBooks();
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBook(book) {
    if (!window.confirm(`Delete “${book.title}”?`)) return;
    setError('');
    try {
      await requestJson(`/books/${encodeURIComponent(book._id)}`, { method: 'DELETE' });
      await loadBooks();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  }

  return (
    <section className="admin-content">
      <form className="editor-card" onSubmit={saveBook}>
        <div className="section-heading">
          <h2>{editingId ? 'Edit book' : 'Add a book'}</h2>
          {editingId && <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
        <div className="form-grid">
          {BOOK_FIELDS.map(([name, label]) => (
            <label key={name} className={name === 'description' ? 'wide-field' : ''}>
              {label}
              {name === 'description'
                ? <textarea required value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />
                : <input required value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} />}
            </label>
          ))}
          <label>Total copies<input required type="number" min="0" step="1" value={form.totalCopies} onChange={(event) => setForm({ ...form, totalCopies: event.target.value })} /></label>
          <label>Available copies<input required type="number" min="0" step="1" value={form.availableCopies} onChange={(event) => setForm({ ...form, availableCopies: event.target.value })} /></label>
          <label>Genre
            <select required value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>
              <option value="">Choose a genre</option>
              {genres.map((genre) => <option key={genre._id} value={genre._id}>{genre.name}</option>)}
            </select>
          </label>
        </div>
        {formError && <p className="error-message" role="alert">{formError}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add book'}</button>
      </form>

      <section className="table-card" aria-labelledby="book-table-heading">
        <div className="section-heading"><h2 id="book-table-heading">Catalog books</h2><button className="secondary-button" type="button" onClick={loadBooks}>Refresh</button></div>
        {loading ? <p role="status">Loading books...</p>
          : error ? <p className="error-message" role="alert">{error}</p>
            : books.length === 0 ? <p className="empty-message">No books are in the catalog yet.</p>
              : <div className="table-scroll"><table>
                <thead><tr><th>Title</th><th>Author</th><th>Genre</th><th>Available</th><th>Actions</th></tr></thead>
                <tbody>{books.map((book) => (
                  <tr key={book._id}>
                    <td>{book.title}</td><td>{book.author}</td>
                    <td>{typeof book.genre === 'object' ? book.genre?.name : '—'}</td>
                    <td>{book.availableCopies} / {book.totalCopies}</td>
                    <td className="table-actions">
                      <button className="secondary-button" type="button" onClick={() => editBook(book)}>Edit</button>
                      <button className="danger-button" type="button" onClick={() => deleteBook(book)}>Delete</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>}
      </section>
    </section>
  );
}
