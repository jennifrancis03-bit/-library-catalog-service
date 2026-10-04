const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  author: {
    type: String,
    required: true,
    trim: true,
  },
  isbn: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  coverImage: {
    type: String,
    required: true,
    trim: true,
  },
  totalCopies: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator(value) {
        return Number.isInteger(value);
      },
      message: 'totalCopies must be a whole number.',
    },
  },
  availableCopies: {
    type: Number,
    required: true,
    min: 0,
    validate: [
      {
        validator(value) {
          return Number.isInteger(value);
        },
        message: 'availableCopies must be a whole number.',
      },
      {
        validator(value) {
          return value <= this.totalCopies;
        },
        message: 'availableCopies cannot exceed totalCopies.',
      },
    ],
  },
  genre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Book', bookSchema);
