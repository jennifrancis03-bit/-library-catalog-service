import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminBooksPage from '../pages/admin/AdminBooksPage.jsx';

describe('AdminBooksPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/books?limit=100') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              _id: 'book-1',
              title: 'The Dispossessed',
              author: 'Ursula K. Le Guin',
              genre: { name: 'Science Fiction' },
              availableCopies: 2,
              totalCopies: 5,
            }],
          }),
        };
      }
      if (url === '/genres') {
        return { ok: true, status: 200, json: async () => [] };
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the book, its genre, and its available-copy count from the API', async () => {
    render(<AdminBooksPage />);

    expect(await screen.findByText('The Dispossessed')).not.toBeNull();
    expect(screen.getByText('Ursula K. Le Guin')).not.toBeNull();
    expect(screen.getByText('Science Fiction')).not.toBeNull();
    expect(screen.getByText('2 / 5')).not.toBeNull();
  });
});
