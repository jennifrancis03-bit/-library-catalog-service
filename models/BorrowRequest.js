const mongoose = require('mongoose');

const BORROW_DAYS = 14;

const borrowRequestSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'returned', 'late'],
    default: 'pending',
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  dueAt: {
    type: Date,
    default() {
      const requestedAt = this.requestedAt || new Date();
      return new Date(requestedAt.getTime() + BORROW_DAYS * 24 * 60 * 60 * 1000);
    },
    required: true,
  },
  returnedAt: {
    type: Date,
    default: null,
  },
  fine: {
    type: Number,
    min: 0,
    default: 0,
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('BorrowRequest', borrowRequestSchema);
