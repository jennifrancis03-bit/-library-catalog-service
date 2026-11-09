const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createOverlapFilter, isDate, isTime } = require('../utils/bookingRules');

const router = express.Router();

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

router.post('/', requireAuth, asyncRoute(async (request, response) => {
  const body = request.body;
  const allowedFields = ['space', 'date', 'startTime', 'endTime'];
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).some((field) => !allowedFields.includes(field))
    || allowedFields.some((field) => !Object.prototype.hasOwnProperty.call(body, field))
  ) {
    return response.status(400).json({
      message: 'Request body must contain only space, date, startTime, and endTime.',
    });
  }
  if (typeof body.space !== 'string' || !body.space.trim()) {
    return response.status(400).json({ message: 'space must be a non-empty string.' });
  }
  if (!isDate(body.date) || !isTime(body.startTime) || !isTime(body.endTime)) {
    return response.status(400).json({ message: 'date, startTime, or endTime is invalid.' });
  }
  if (body.startTime >= body.endTime) {
    return response.status(400).json({ message: 'endTime must be later than startTime.' });
  }

  const space = body.space.trim();
  const overlap = await Booking.exists(
    createOverlapFilter(space, body.date, body.startTime, body.endTime),
  );
  if (overlap) {
    return response.status(409).json({
      message: 'This space is already booked during part of that time range.',
    });
  }

  const booking = await Booking.create({
    space,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    user: request.user._id,
  });
  await booking.populate('user', 'username email');
  response.status(201).json({ booking });
}));

router.get('/', requireAuth, requireRole('librarian'), asyncRoute(async (request, response) => {
  const bookings = await Booking.find()
    .populate('user', 'username email')
    .sort({ date: 1, startTime: 1, _id: 1 });
  response.status(200).json({ data: bookings });
}));

module.exports = router;
