const express = require('express');
const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const User = require('../models/User');
const bookingsRouter = require('../routes/bookings');

process.env.JWT_SECRET = 'test-only-library-secret';

let server;

afterEach(async () => {
  jest.restoreAllMocks();
  if (server) {
    const currentServer = server;
    server = null;
    await new Promise((resolve, reject) => {
      currentServer.close((error) => (error ? reject(error) : resolve()));
      currentServer.closeAllConnections();
    });
  }
});

test('booking endpoint rejects a conflicting time range without creating a booking', async () => {
  const userId = '507f1f77bcf86cd799439011';
  jest.spyOn(User, 'findById').mockResolvedValue({ _id: userId, role: 'patron' });
  const overlapLookup = jest.spyOn(Booking, 'exists')
    .mockResolvedValue({ _id: 'existing-booking' });
  const bookingCreate = jest.spyOn(Booking, 'create').mockRejectedValue(
    new Error('A conflicting booking must not be created.'),
  );

  const application = express();
  application.use(express.json());
  application.use('/api/bookings', bookingsRouter);
  server = application.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const serverUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  const response = await fetch(`${serverUrl}/api/bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      space: 'Study Room',
      date: '2026-11-20',
      startTime: '10:30',
      endTime: '11:30',
    }),
  });

  expect(response.status).toBe(409);
  await expect(response.json()).resolves.toEqual({
    message: 'This space is already booked during part of that time range.',
  });
  expect(overlapLookup).toHaveBeenCalledWith({
    space: 'Study Room',
    date: '2026-11-20',
    startTime: { $lt: '11:30' },
    endTime: { $gt: '10:30' },
  });
  expect(bookingCreate).not.toHaveBeenCalled();
});
