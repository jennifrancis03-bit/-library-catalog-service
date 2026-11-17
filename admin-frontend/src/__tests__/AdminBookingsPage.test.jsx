import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AdminBookingsPage from '../pages/admin/AdminBookingsPage.jsx';

describe('AdminBookingsPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/bookings') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{
              _id: 'booking-1',
              space: 'Study Room A',
              user: { username: 'reader-one' },
              date: '2026-11-20',
              startTime: '10:30',
              endTime: '11:30',
            }],
          }),
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders a booking returned by the API with patron and time details', async () => {
    render(<AdminBookingsPage />);

    expect(await screen.findByText('Study Room A')).not.toBeNull();
    expect(screen.getByText('reader-one')).not.toBeNull();
    expect(screen.getByText('2026-11-20')).not.toBeNull();
    expect(screen.getByText('10:30')).not.toBeNull();
    expect(screen.getByText('11:30')).not.toBeNull();
  });
});
