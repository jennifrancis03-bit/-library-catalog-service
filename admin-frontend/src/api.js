export async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
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
