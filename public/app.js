const searchInput = document.querySelector('#search-input');
const genreSelect = document.querySelector('#genre-select');
const genreState = document.querySelector('#genre-state');
const resultState = document.querySelector('#result-state');
const resultSummary = document.querySelector('#result-summary');
const bookGrid = document.querySelector('#book-grid');
const pagination = document.querySelector('#pagination');
const catalogueView = document.querySelector('#catalogue-view');
const detailView = document.querySelector('#detail-view');
const coverTones = ['#496c63', '#b55b42', '#506181', '#927348', '#486259', '#9c4e47'];

const initialParams = new URLSearchParams(window.location.search);
const state = {
  search: initialParams.get('search') || '',
  genre: initialParams.get('genre') || '',
  page: Number(initialParams.get('page')) || 1,
  bookId: initialParams.get('book') || '',
  booksController: null,
  detailController: null,
  searchTimer: null,
};

searchInput.value = state.search;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function makeUrl() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.genre) params.set('genre', state.genre);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.bookId) params.set('book', state.bookId);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

function updateUrl() {
  window.history.pushState({}, '', makeUrl());
}

async function requestJson(path, signal) {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `The request failed (${response.status}).`);
  }
  return body;
}

function showState(container, { kind, title, copy, action, actionLabel }) {
  const isLoading = kind === 'loading';
  container.innerHTML = `
    <div class="state-inner${isLoading ? ' loading-state' : ''}">
      ${isLoading ? '<span class="spinner" aria-hidden="true"></span>' : '<p class="state-kicker">' + (kind === 'empty' ? 'A quiet shelf' : 'A small interruption') + '</p>'}
      <div>
        <p class="state-title">${escapeHtml(title)}</p>
        <p class="state-copy">${escapeHtml(copy)}</p>
        ${action ? `<div class="state-actions"><button class="state-button" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel || 'Try again')}</button></div>` : ''}
      </div>
    </div>`;
  container.hidden = false;
}

function coverMarkup(book, index, extraClass = '') {
  const title = escapeHtml(book.title || 'Untitled');
  const author = escapeHtml(book.author || 'Unknown author');
  const image = book.coverImage
    ? `<img src="${escapeHtml(book.coverImage)}" alt="Cover of ${title}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">`
    : '';
  return `
    <div class="book-cover ${extraClass}" style="--cover-tone:${coverTones[index % coverTones.length]}">
      ${image}
      <div class="cover-fallback" ${image ? 'hidden' : ''}>
        <small>Commonplace Library</small>
        <strong>${title}</strong>
        <small>${author}</small>
      </div>
    </div>`;
}

function bookUrl(bookId) {
  const previous = state.bookId;
  state.bookId = bookId;
  const url = makeUrl();
  state.bookId = previous;
  return url;
}

function renderBooks(books) {
  bookGrid.innerHTML = books.map((book, index) => {
    const genreName = typeof book.genre === 'object' ? book.genre?.name : '';
    return `
      <a class="book-card" href="${escapeHtml(bookUrl(book._id))}" data-book-id="${escapeHtml(book._id)}" style="animation-delay:${Math.min(index * 35, 245)}ms">
        ${coverMarkup(book, index)}
        <div class="book-copy">
          <h3 class="book-title">${escapeHtml(book.title)}</h3>
          <p class="book-author">${escapeHtml(book.author)}</p>
          <span class="book-genre">${escapeHtml(genreName || 'Unclassified')}</span>
        </div>
      </a>`;
  }).join('');
  bookGrid.hidden = false;
}

function renderPagination(pageInfo) {
  if (pageInfo.totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  pagination.innerHTML = `
    <button class="page-button" type="button" data-page="${pageInfo.page - 1}" ${pageInfo.page <= 1 ? 'disabled' : ''} aria-label="Previous page">&#8592; Previous</button>
    <span class="page-count">Page ${pageInfo.page} of ${pageInfo.totalPages}</span>
    <button class="page-button" type="button" data-page="${pageInfo.page + 1}" ${pageInfo.page >= pageInfo.totalPages ? 'disabled' : ''} aria-label="Next page">Next &#8594;</button>`;
}

async function loadBooks() {
  if (state.booksController) state.booksController.abort();
  const controller = new AbortController();
  state.booksController = controller;
  state.bookId = '';
  catalogueView.hidden = false;
  detailView.hidden = true;
  searchInput.value = state.search;
  genreSelect.value = state.genre;
  bookGrid.hidden = true;
  bookGrid.setAttribute('aria-busy', 'true');
  resultSummary.textContent = '';
  pagination.innerHTML = '';
  showState(resultState, {
    kind: 'loading',
    title: 'Finding your books',
    copy: 'One moment while we check the shelves.',
  });

  const params = new URLSearchParams({ page: String(state.page), limit: '12' });
  if (state.search) params.set('search', state.search);
  if (state.genre) params.set('genre', state.genre);

  try {
    const result = await requestJson(`/books?${params}`, controller.signal);
    if (controller.signal.aborted) return;
    const books = Array.isArray(result.data) ? result.data : [];
    const total = result.pagination?.total ?? books.length;
    resultState.innerHTML = '';
    resultState.hidden = true;
    bookGrid.setAttribute('aria-busy', 'false');
    if (!books.length) {
      bookGrid.hidden = true;
      resultSummary.textContent = '0 books';
      showState(resultState, {
        kind: 'empty',
        title: 'Nothing on this shelf just yet.',
        copy: state.search || state.genre
          ? 'Try another search or clear a filter to see more of the collection.'
          : 'The catalog is waiting for its first book.',
        action: state.search || state.genre ? 'clear-filters' : '',
        actionLabel: 'Clear filters',
      });
      return;
    }
    resultSummary.textContent = `${total} ${total === 1 ? 'book' : 'books'}`;
    renderBooks(books);
    renderPagination(result.pagination || { page: state.page, totalPages: 0 });
  } catch (error) {
    if (controller.signal.aborted) return;
    bookGrid.hidden = true;
    bookGrid.setAttribute('aria-busy', 'false');
    showState(resultState, {
      kind: 'error',
      title: 'We could not reach the catalog.',
      copy: error.message || 'Check your connection and try again.',
      action: 'retry-books',
    });
  }
}

async function loadGenres() {
  genreSelect.disabled = true;
  genreSelect.innerHTML = '<option value="">Loading genres...</option>';
  genreState.innerHTML = '';
  try {
    const genres = await requestJson('/genres');
    if (!Array.isArray(genres) || genres.length === 0) {
      genreSelect.innerHTML = '<option value="">No genres available</option>';
      genreState.textContent = 'Genres are not available right now.';
      return;
    }
    genreSelect.innerHTML = '<option value="">All genres</option>' + genres.map((genre) => (
      `<option value="${escapeHtml(genre._id)}">${escapeHtml(genre.name)}</option>`
    )).join('');
    genreSelect.value = state.genre;
    genreSelect.disabled = false;
  } catch (error) {
    genreSelect.innerHTML = '<option value="">Genres unavailable</option>';
    genreState.innerHTML = `Could not load genres. <button class="state-button" type="button" data-action="retry-genres">Retry</button>`;
  }
}

function renderDetailState(kind, title, copy, action = '') {
  const actionMarkup = action
    ? `<div class="state-actions"><button class="state-button" type="button" data-action="${action}">Try again</button></div>`
    : '';
  detailView.innerHTML = `
    <a class="back-link detail-back" href="${escapeHtml(bookUrl(''))}" data-action="back-list">&#8592; Back to the collection</a>
    <div class="result-state detail-state">
      <div class="state-inner${kind === 'loading' ? ' loading-state' : ''}">
        ${kind === 'loading' ? '<span class="spinner" aria-hidden="true"></span>' : '<p class="state-kicker">' + (kind === 'missing' ? 'Not found' : 'A small interruption') + '</p>'}
        <div>
          <p class="state-title">${escapeHtml(title)}</p>
          <p class="state-copy">${escapeHtml(copy)}</p>
          ${actionMarkup}
        </div>
      </div>
    </div>`;
}

async function loadDetail() {
  if (state.detailController) state.detailController.abort();
  const controller = new AbortController();
  state.detailController = controller;
  catalogueView.hidden = true;
  detailView.hidden = false;
  renderDetailState('loading', 'Opening the book', 'Just a moment while we turn to the right page.');

  try {
    const book = await requestJson(`/books/${encodeURIComponent(state.bookId)}`, controller.signal);
    if (controller.signal.aborted) return;
    const genreName = typeof book.genre === 'object' ? book.genre?.name : '';
    const copies = Number(book.availableCopies) || 0;
    const toneIndex = [...String(book._id || '')].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    detailView.innerHTML = `
      <a class="back-link detail-back" href="${escapeHtml(bookUrl(''))}" data-action="back-list">&#8592; Back to the collection</a>
      <div class="detail-layout">
        <div class="detail-cover">${coverMarkup(book, toneIndex)}</div>
        <article class="detail-copy">
          <p class="eyebrow"><span class="eyebrow-line"></span>${escapeHtml(genreName || 'From the collection')}</p>
          <h1>${escapeHtml(book.title)}</h1>
          <p class="detail-author">by ${escapeHtml(book.author)}</p>
          <p class="detail-description">${escapeHtml(book.description || 'No description is available for this book.')}</p>
          <div class="detail-meta">
            <div><span class="meta-label">Availability</span><span class="meta-value availability${copies ? '' : ' unavailable'}">${copies ? `${copies} of ${escapeHtml(book.totalCopies)} available` : 'Currently on loan'}</span></div>
            <div><span class="meta-label">ISBN</span><span class="meta-value">${escapeHtml(book.isbn || 'Not listed')}</span></div>
          </div>
        </article>
      </div>`;
  } catch (error) {
    if (controller.signal.aborted) return;
    const missing = /not found/i.test(error.message) || /404/.test(error.message);
    renderDetailState(
      missing ? 'missing' : 'error',
      missing ? 'This book is not on our shelves.' : 'We could not open this book.',
      missing ? 'It may have moved or the link may be out of date. Head back to the collection to keep browsing.' : error.message || 'Check your connection and try again.',
      missing ? '' : 'retry-detail',
    );
  }
}

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  state.search = params.get('search') || '';
  state.genre = params.get('genre') || '';
  state.page = Math.max(1, Number(params.get('page')) || 1);
  state.bookId = params.get('book') || '';
  searchInput.value = state.search;
  if (state.bookId) loadDetail();
  else loadBooks();
}

searchInput.addEventListener('input', () => {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    updateUrl();
    loadBooks();
  }, 400);
});

genreSelect.addEventListener('change', () => {
  window.clearTimeout(state.searchTimer);
  state.search = searchInput.value.trim();
  state.genre = genreSelect.value;
  state.page = 1;
  updateUrl();
  loadBooks();
});

document.addEventListener('click', (event) => {
  const bookLink = event.target.closest('[data-book-id]');
  if (bookLink) {
    event.preventDefault();
    window.clearTimeout(state.searchTimer);
    state.bookId = bookLink.dataset.bookId;
    updateUrl();
    loadDetail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const pageButton = event.target.closest('[data-page]');
  if (pageButton && !pageButton.disabled) {
    state.page = Number(pageButton.dataset.page);
    updateUrl();
    loadBooks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'back-list') {
    event.preventDefault();
    state.bookId = '';
    updateUrl();
    loadBooks();
  } else if (action === 'retry-books') {
    loadBooks();
  } else if (action === 'retry-detail') {
    loadDetail();
  } else if (action === 'retry-genres') {
    loadGenres();
  } else if (action === 'clear-filters') {
    window.clearTimeout(state.searchTimer);
    state.search = '';
    state.genre = '';
    state.page = 1;
    searchInput.value = '';
    genreSelect.value = '';
    updateUrl();
    loadBooks();
  }
});

window.addEventListener('popstate', readUrl);

loadGenres();
if (state.bookId) loadDetail();
else loadBooks();