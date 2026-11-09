const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  space: {
    type: String,
    required: true,
    trim: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
  },
  startTime: {
    type: String,
    required: true,
    match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  },
  endTime: {
    type: String,
    required: true,
    match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  },
}, {
  timestamps: true,
});

bookingSchema.index({ space: 1, date: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
