const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export function getErrorMessage(error) {
  if (error.status === 401) return 'Your session has expired. Log in again to continue.';
  if (error.status === 403) return 'A librarian account is required to use this page.';
  return error.message || 'The request could not be completed.';
}
