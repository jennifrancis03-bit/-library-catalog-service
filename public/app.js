const searchInput = document.querySelector('#search-input');
const genreSelect = document.querySelector('#genre-select');
const genreState = document.querySelector('#genre-state');
const resultState = document.querySelector('#result-state');
const resultSummary = document.querySelector('#result-summary');
const bookGrid = document.querySelector('#book-grid');
const pagination = document.querySelector('#pagination');
const catalogueView = document.querySelector('#catalogue-view');
const detailView = document.querySelector('#detail-view');
const featureView = document.querySelector('#feature-view');
const authNav = document.querySelector('#auth-nav');
const readingListCount = document.querySelector('#reading-list-count');
const coverTones = ['#496c63', '#b55b42', '#506181', '#927348', '#486259', '#9c4e47'];

const initialParams = new URLSearchParams(window.location.search);
function readStoredReadingList() {
  try {
    const stored = JSON.parse(window.localStorage.getItem('commonplace-reading-list') || '[]');
    return Array.isArray(stored)
      ? stored.filter((book) => book && typeof book.id === 'string' && typeof book.title === 'string')
      : [];
  } catch (error) {
    console.error('Could not read the saved reading list:', error);
    return [];
  }
}

const state = {
  search: initialParams.get('search') || '',
  genre: initialParams.get('genre') || '',
  page: Number(initialParams.get('page')) || 1,
  bookId: initialParams.get('book') || '',
  booksController: null,
  detailController: null,
  searchTimer: null,
  currentUser: null,
  authStatus: 'loading',
  authError: '',
  readingList: readStoredReadingList(),
  readingListMessage: '',
  booking: { space: '', date: '', startTime: '', endTime: '' },
};

searchInput.value = state.search;
readingListCount.textContent = String(state.readingList.length);

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

async function requestJson(path, signal, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `The request failed (${response.status}).`);
    error.status = response.status;
    throw error;
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
    const alreadySaved = state.readingList.some((savedBook) => savedBook.id === book._id);
    return `
      <article class="book-card" style="animation-delay:${Math.min(index * 35, 245)}ms">
        <a class="book-card-link" href="${escapeHtml(bookUrl(book._id))}" data-book-id="${escapeHtml(book._id)}">
          ${coverMarkup(book, index)}
          <div class="book-copy">
            <h3 class="book-title">${escapeHtml(book.title)}</h3>
            <p class="book-author">${escapeHtml(book.author)}</p>
            <span class="book-genre">${escapeHtml(genreName || 'Unclassified')}</span>
          </div>
        </a>
        <button class="reading-list-button" type="button" data-action="add-book"
          data-book-id="${escapeHtml(book._id)}"
          data-book-title="${escapeHtml(book.title)}"
          data-book-author="${escapeHtml(book.author)}"
          data-book-cover="${escapeHtml(book.coverImage || '')}"
          data-book-genre="${escapeHtml(genreName || 'Unclassified')}" ${alreadySaved ? 'disabled' : ''}>${alreadySaved ? 'On your reading list' : 'Add to reading list'}</button>
      </article>`;
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
          <button class="reading-list-button detail-reading-list-button" type="button" data-action="add-book"
            data-book-id="${escapeHtml(book._id)}"
            data-book-title="${escapeHtml(book.title)}"
            data-book-author="${escapeHtml(book.author)}"
            data-book-cover="${escapeHtml(book.coverImage || '')}"
            data-book-genre="${escapeHtml(genreName || 'Unclassified')}">Add to reading list</button>
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

function updateAuthNavigation() {
  authNav.innerHTML = state.currentUser
    ? `<span class="user-greeting">Hello, ${escapeHtml(state.currentUser.username || state.currentUser.email)}</span>
       <button class="nav-button" type="button" data-action="logout">Log out</button>`
    : '<a class="header-link" href="/login" data-route>Log in</a><a class="header-link" href="/register" data-route>Register</a>';
  readingListCount.textContent = String(state.readingList.length);
}

function storeReadingList() {
  try {
    window.localStorage.setItem('commonplace-reading-list', JSON.stringify(state.readingList));
    state.readingListMessage = '';
  } catch (error) {
    console.error('Could not save the reading list:', error);
    state.readingListMessage = 'Your browser could not save the reading list. Check your storage settings and try again.';
  }
  readingListCount.textContent = String(state.readingList.length);
}

function renderReadingList() {
  const books = state.readingList;
  const content = books.length
    ? `<div class="saved-book-list">${books.map((book, index) => `
        <article class="saved-book">
          ${coverMarkup(book, index, 'saved-book-cover')}
          <div class="saved-book-copy">
            <h2>${escapeHtml(book.title)}</h2>
            <p>${escapeHtml(book.author || 'Unknown author')}</p>
            <span class="book-genre">${escapeHtml(book.genre || 'Unclassified')}</span>
          </div>
          <button class="reading-list-button remove-reading-list-button" type="button" data-action="remove-book" data-book-id="${escapeHtml(book.id)}">Remove</button>
        </article>`).join('')}</div>
        <button class="state-button clear-list-button" type="button" data-action="clear-list">Clear reading list</button>`
    : '<div class="empty-reading-list"><p class="state-title">Your reading list is empty.</p><p class="state-copy">Add a book from the collection and it will be saved here.</p><a class="state-button" href="/" data-route>Browse the collection</a></div>';
  featureView.innerHTML = `
    <p class="eyebrow"><span class="eyebrow-line"></span>Your saved shelf</p>
    <h1 class="feature-title">Reading list</h1>
    <p class="feature-intro">Keep the stories you want to come back to.</p>
    <p class="form-feedback" role="status" aria-live="polite">${escapeHtml(state.readingListMessage)}</p>
    ${content}`;
}

function renderAuthForm(kind) {
  const isRegister = kind === 'register';
  const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '';
  const authNotice = state.authError
    ? `<p class="form-feedback" role="alert">${escapeHtml(state.authError)}</p>`
    : '';
  featureView.innerHTML = `
    <div class="form-panel">
      <p class="eyebrow"><span class="eyebrow-line"></span>Commonplace Library account</p>
      <h1 class="feature-title">${isRegister ? 'Join the library.' : 'Welcome back.'}</h1>
      <p class="feature-intro">${isRegister ? 'Create an account to keep your place in the reading room.' : 'Sign in to continue to your library.'}</p>
      ${authNotice}
      <form id="${isRegister ? 'register' : 'login'}-form" class="feature-form">
        ${isRegister ? '<label>Username<input name="username" type="text" minlength="3" maxlength="40" autocomplete="username" required></label>' : ''}
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" minlength="${isRegister ? '8' : '1'}" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required></label>
        <input name="returnTo" type="hidden" value="${escapeHtml(returnTo)}">
        <p class="form-feedback" data-form-feedback role="alert" hidden></p>
        <button class="primary-button" type="submit">${isRegister ? 'Create account' : 'Log in'}</button>
      </form>
      <p class="form-switch">${isRegister ? 'Already a member?' : 'New to the library?'}
        <a href="${isRegister ? '/login' : '/register'}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}" data-route>${isRegister ? 'Log in' : 'Register'}</a>
      </p>
    </div>`;
}

function renderBookingForm() {
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  featureView.innerHTML = `
    <div class="form-panel booking-panel">
      <p class="eyebrow"><span class="eyebrow-line"></span>Reserve a place</p>
      <h1 class="feature-title">Book a space.</h1>
      <p class="feature-intro">Choose a space and a time for your next visit.</p>
      <form id="booking-form" class="feature-form">
        <label>Space
          <select name="space" required>
            <option value="">Choose a space</option>
            <option value="Quiet Reading Room" ${state.booking.space === 'Quiet Reading Room' ? 'selected' : ''}>Quiet Reading Room</option>
            <option value="Study Room" ${state.booking.space === 'Study Room' ? 'selected' : ''}>Study Room</option>
            <option value="Community Hall" ${state.booking.space === 'Community Hall' ? 'selected' : ''}>Community Hall</option>
            <option value="Computer Station" ${state.booking.space === 'Computer Station' ? 'selected' : ''}>Computer Station</option>
          </select>
        </label>
        <label>Date<input name="date" type="date" min="${minDate}" value="${escapeHtml(state.booking.date)}" required></label>
        <div class="time-fields">
          <label>Start time<input name="startTime" type="time" value="${escapeHtml(state.booking.startTime)}" required></label>
          <label>End time<input name="endTime" type="time" value="${escapeHtml(state.booking.endTime)}" required></label>
        </div>
        <p class="form-feedback" data-form-feedback role="status" aria-live="polite" hidden></p>
        <button class="primary-button" type="submit">Save booking details</button>
        <p class="form-hint">This form saves your details in this page only. Booking submission will be connected next week.</p>
      </form>
    </div>`;
}

function renderFeaturePage(route) {
  featureView.hidden = false;
  catalogueView.hidden = true;
  detailView.hidden = true;
  if (route === '/login' || route === '/register') {
    renderAuthForm(route.slice(1));
  } else if (route === '/booking') {
    renderBookingForm();
  } else if (route === '/reading-list') {
    renderReadingList();
  }
}

function navigate(path) {
  window.history.pushState({}, '', path);
  readUrl();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function allowedReturnPath(value) {
  return ['/booking', '/reading-list', '/'].includes(value) ? value : '/';
}

function readUrl() {
  const route = window.location.pathname.replace(/\/+$/, '') || '/';
  if (route === '/login' || route === '/register' || route === '/booking' || route === '/reading-list') {
    if (route === '/booking' && state.authStatus === 'loading') {
      featureView.hidden = false;
      catalogueView.hidden = true;
      detailView.hidden = true;
      featureView.innerHTML = '<div class="form-panel"><p class="state-copy" role="status">Checking your sign-in status...</p></div>';
      updateAuthNavigation();
      return;
    }
    if (route === '/booking' && state.authStatus === 'ready' && !state.currentUser) {
      window.history.replaceState({}, '', `/login?returnTo=${encodeURIComponent('/booking')}`);
      renderFeaturePage('/login');
      return;
    }
    renderFeaturePage(route);
    updateAuthNavigation();
    return;
  }

  if (route !== '/') {
    window.history.replaceState({}, '', '/');
  }
  const params = new URLSearchParams(window.location.search);
  state.search = params.get('search') || '';
  state.genre = params.get('genre') || '';
  state.page = Math.max(1, Number(params.get('page')) || 1);
  state.bookId = params.get('book') || '';
  searchInput.value = state.search;
  featureView.hidden = true;
  catalogueView.hidden = false;
  updateAuthNavigation();
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
  const routeLink = event.target.closest('a[data-route]');
  if (routeLink) {
    event.preventDefault();
    navigate(routeLink.getAttribute('href'));
    return;
  }

  const bookLink = event.target.closest('a.book-card-link[data-book-id]');
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
  if (action === 'add-book') {
    const button = event.target.closest('[data-action="add-book"]');
    const book = {
      id: button.dataset.bookId,
      title: button.dataset.bookTitle,
      author: button.dataset.bookAuthor,
      coverImage: button.dataset.bookCover,
      genre: button.dataset.bookGenre,
    };
    if (!state.readingList.some((savedBook) => savedBook.id === book.id)) {
      state.readingList.push(book);
      storeReadingList();
    } else {
      state.readingListMessage = 'That book is already on your reading list.';
    }
    button.textContent = state.readingList.some((savedBook) => savedBook.id === book.id)
      ? 'On your reading list'
      : 'Add to reading list';
    button.disabled = true;
  } else if (action === 'remove-book') {
    const bookId = event.target.closest('[data-action="remove-book"]').dataset.bookId;
    state.readingList = state.readingList.filter((book) => book.id !== bookId);
    state.readingListMessage = 'Book removed from your reading list.';
    storeReadingList();
    if (window.location.pathname === '/reading-list') renderReadingList();
    updateAuthNavigation();
  } else if (action === 'clear-list') {
    state.readingList = [];
    state.readingListMessage = 'Your reading list has been cleared.';
    storeReadingList();
    renderReadingList();
    updateAuthNavigation();
  } else if (action === 'logout') {
    requestJson('/api/auth/logout', undefined, { method: 'POST' })
      .then(() => {
        state.currentUser = null;
        state.authError = '';
        updateAuthNavigation();
        navigate('/');
      })
      .catch((error) => {
        console.error('Could not log out:', error);
        authNav.insertAdjacentHTML('beforeend', `<span class="nav-error" role="alert">${escapeHtml(error.message)}</span>`);
      });
  } else if (action === 'back-list') {
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

function captureBookingForm(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  state.booking = {
    space: values.space,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime,
  };
  return state.booking;
}

document.addEventListener('input', (event) => {
  if (event.target.closest('#booking-form')) captureBookingForm(event.target.form);
});

document.addEventListener('change', (event) => {
  if (event.target.closest('#booking-form')) captureBookingForm(event.target.form);
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'login-form' || form.id === 'register-form') {
    event.preventDefault();
    const feedback = form.querySelector('[data-form-feedback]');
    const submitButton = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form).entries());
    const isRegister = form.id === 'register-form';
    let accountCreated = false;
    submitButton.disabled = true;
    submitButton.textContent = isRegister ? 'Creating account...' : 'Signing in...';
    feedback.hidden = true;

    try {
      if (isRegister) {
        await requestJson('/api/auth/register', undefined, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: values.username,
            email: values.email,
            password: values.password,
          }),
        });
        accountCreated = true;
      }

      const result = await requestJson('/api/auth/login', undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      if (!result.user) throw new Error('The server did not return an account profile.');
      state.currentUser = result.user;
      state.authStatus = 'ready';
      state.authError = '';
      updateAuthNavigation();
      const destination = allowedReturnPath(values.returnTo);
      navigate(destination);
    } catch (error) {
      feedback.textContent = accountCreated
        ? `Your account was created, but automatic sign-in failed: ${error.message} Please log in.`
        : error.message || 'We could not complete your request. Please try again.';
      feedback.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = isRegister ? 'Create account' : 'Log in';
    }
  } else if (form.id === 'booking-form') {
    event.preventDefault();
    const values = captureBookingForm(form);
    const feedback = form.querySelector('[data-form-feedback]');
    feedback.hidden = false;
    if (values.endTime <= values.startTime) {
      feedback.textContent = 'End time must be later than start time.';
      feedback.setAttribute('role', 'alert');
      return;
    }
    feedback.setAttribute('role', 'status');
    feedback.textContent = `Details captured locally: ${values.space} on ${values.date}, ${values.startTime}–${values.endTime}. No booking was submitted.`;
  }
});

async function loadAuth() {
  try {
    state.currentUser = await requestJson('/api/users/profile');
  } catch (error) {
    state.currentUser = null;
    if (error.status !== 401) {
      state.authError = `We could not verify your sign-in status: ${error.message}`;
      console.error('Could not load the current user profile:', error);
    }
  }
  state.authStatus = 'ready';
  updateAuthNavigation();
  readUrl();
}

window.addEventListener('popstate', readUrl);

loadGenres();
loadAuth();