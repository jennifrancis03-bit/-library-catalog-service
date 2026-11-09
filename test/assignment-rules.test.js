const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const BorrowRequest = require('../models/BorrowRequest');
const Booking = require('../models/Booking');
const { calculateFine } = require('../utils/borrowRules');
const {
  createOverlapFilter,
  hasTimeOverlap,
  isDate,
  isTime,
} = require('../utils/bookingRules');

const hour = 60 * 60 * 1000;
const dueAt = new Date('2026-01-01T10:00:00.000Z');

test('borrow request model has required references, lifecycle fields, and a 14-day default due date', () => {
  const requestedAt = new Date('2026-01-01T10:00:00.000Z');
  const borrowRequest = new BorrowRequest({
    book: new mongoose.Types.ObjectId(),
    user: new mongoose.Types.ObjectId(),
    requestedAt,
  });

  assert.equal(BorrowRequest.schema.path('book').options.ref, 'Book');
  assert.equal(BorrowRequest.schema.path('user').options.ref, 'User');
  assert.deepEqual(BorrowRequest.schema.path('status').enumValues, ['pending', 'approved', 'returned', 'late']);
  assert.equal(borrowRequest.dueAt.getTime() - requestedAt.getTime(), 14 * 24 * 60 * 60 * 1000);
  assert.equal(borrowRequest.fine, 0);
  assert.equal(borrowRequest.returnedAt, null);
});

test('booking model references a patron and stores all required reservation fields', () => {
  assert.equal(Booking.schema.path('user').options.ref, 'User');
  for (const field of ['space', 'date', 'startTime', 'endTime']) {
    assert.equal(Booking.schema.path(field).isRequired, true);
  }
});

test('fine is zero on time and charges $0.25 per late day, rounding partial days up', () => {
  assert.equal(calculateFine(dueAt, dueAt), 0);
  assert.equal(calculateFine(dueAt, new Date(dueAt.getTime() + 1)), 0.25);
  assert.equal(calculateFine(dueAt, new Date(dueAt.getTime() + 24 * hour)), 0.25);
  assert.equal(calculateFine(dueAt, new Date(dueAt.getTime() + 24 * hour + 1)), 0.5);
  assert.equal(calculateFine(dueAt, new Date(dueAt.getTime() + 5 * 24 * hour)), 1.25);
});

test('booking overlap detects both partial-overlap directions and containment', () => {
  const existing = { startTime: '10:00', endTime: '11:00' };
  assert.equal(hasTimeOverlap(existing, { startTime: '09:30', endTime: '10:30' }), true);
  assert.equal(hasTimeOverlap(existing, { startTime: '10:30', endTime: '11:30' }), true);
  assert.equal(hasTimeOverlap(existing, { startTime: '10:15', endTime: '10:45' }), true);
  assert.equal(hasTimeOverlap(existing, { startTime: '09:00', endTime: '12:00' }), true);
  assert.equal(hasTimeOverlap(existing, { startTime: '09:00', endTime: '10:00' }), false);
  assert.equal(hasTimeOverlap(existing, { startTime: '11:00', endTime: '12:00' }), false);
});

test('Mongo booking overlap filter includes same space/date and strict interval intersection', () => {
  assert.deepEqual(
    createOverlapFilter('Study Room', '2026-11-09', '10:30', '11:30'),
    {
      space: 'Study Room',
      date: '2026-11-09',
      startTime: { $lt: '11:30' },
      endTime: { $gt: '10:30' },
    },
  );
});

test('booking date and time validation rejects invalid formats and calendar dates', () => {
  assert.equal(isDate('2026-11-09'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('09-11-2026'), false);
  assert.equal(isTime('23:59'), true);
  assert.equal(isTime('24:00'), false);
  assert.equal(isTime('9:30'), false);
});
