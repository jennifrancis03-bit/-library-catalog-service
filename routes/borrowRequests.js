const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const BorrowRequest = require('../models/BorrowRequest');
const { requireAuth, requireRole } = require('../middleware/auth');
const { calculateFine } = require('../utils/borrowRules');

const router = express.Router();

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function isObjectBody(body) {
  return body && typeof body === 'object' && !Array.isArray(body);
}

async function restoreBorrowStatus(borrowRequest, previousStatus, returnedAt) {
  const rollback = await BorrowRequest.updateOne(
    {
      _id: borrowRequest._id,
      status: 'returned',
      returnedAt,
    },
    {
      $set: { status: previousStatus, returnedAt: null, fine: 0 },
    },
  );
  if (rollback.modifiedCount !== 1) {
    throw new Error('Could not roll back a failed return update.');
  }
}

router.post('/', requireAuth, asyncRoute(async (request, response) => {
  if (!isObjectBody(request.body) || Object.keys(request.body).some((key) => key !== 'bookId')) {
    return response.status(400).json({ message: 'Request body must contain only bookId.' });
  }
  if (typeof request.body.bookId !== 'string' || !mongoose.isValidObjectId(request.body.bookId)) {
    return response.status(400).json({ message: 'bookId must be a valid book ID.' });
  }

  const book = await Book.findOneAndUpdate(
    { _id: request.body.bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true },
  );
  if (!book) {
    const exists = await Book.exists({ _id: request.body.bookId });
    return response.status(exists ? 409 : 404).json({
      message: exists ? 'This book has no available copies.' : 'Book not found.',
    });
  }

  try {
    const borrowRequest = await BorrowRequest.create({
      book: book._id,
      user: request.user._id,
    });
    await borrowRequest.populate('book', 'title author');
    return response.status(201).json({ borrowRequest });
  } catch (error) {
    try {
      await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: 1 } });
    } catch (rollbackError) {
      console.error('Could not roll back inventory after creating a borrow request failed:', rollbackError);
      return response.status(500).json({
        message: 'The request could not be saved and inventory rollback failed.',
      });
    }
    throw error;
  }
}));

router.get('/', requireAuth, requireRole('librarian'), asyncRoute(async (request, response) => {
  const borrowRequests = await BorrowRequest.find()
    .populate('book', 'title author isbn')
    .populate('user', 'username email')
    .sort({ requestedAt: -1, _id: -1 });
  response.status(200).json({ data: borrowRequests });
}));

router.patch('/:id', requireAuth, requireRole('librarian'), asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ message: 'Borrow request ID is invalid.' });
  }
  if (
    !isObjectBody(request.body)
    || Object.keys(request.body).some((key) => key !== 'status')
    || !['pending', 'approved', 'returned', 'late'].includes(request.body.status)
  ) {
    return response.status(400).json({
      message: 'Request body must contain a valid status and cannot set fine or other fields.',
    });
  }

  const borrowRequest = await BorrowRequest.findById(request.params.id);
  if (!borrowRequest) {
    return response.status(404).json({ message: 'Borrow request not found.' });
  }
  if (borrowRequest.status === 'returned') {
    return response.status(409).json({ message: 'A returned borrow request cannot be changed.' });
  }

  const previousStatus = borrowRequest.status;
  const nextStatus = request.body.status;
  const returnedAt = nextStatus === 'returned' ? new Date() : null;
  const fine = returnedAt ? calculateFine(borrowRequest.dueAt, returnedAt) : 0;
  const updatedRequest = await BorrowRequest.findOneAndUpdate(
    { _id: borrowRequest._id, status: { $ne: 'returned' } },
    { $set: { status: nextStatus, returnedAt, fine } },
    { new: true, runValidators: true },
  );
  if (!updatedRequest) {
    return response.status(409).json({ message: 'This borrow request has already been returned.' });
  }

  if (nextStatus === 'returned') {
    const book = await Book.findById(updatedRequest.book);
    if (!book) {
      try {
        await restoreBorrowStatus(updatedRequest, previousStatus, returnedAt);
      } catch (rollbackError) {
        console.error('Could not restore a borrow request after its book was removed:', rollbackError);
        return response.status(500).json({
          message: 'The return could not be completed and its status rollback failed.',
        });
      }
      return response.status(409).json({ message: 'The borrowed book no longer exists.' });
    }

    try {
      const restoredBook = await Book.findOneAndUpdate(
        { _id: book._id, availableCopies: { $lt: book.totalCopies } },
        { $inc: { availableCopies: 1 } },
        { new: true },
      );
      if (!restoredBook) {
        try {
          await restoreBorrowStatus(updatedRequest, previousStatus, returnedAt);
        } catch (rollbackError) {
          console.error('Could not restore a borrow request after inventory validation failed:', rollbackError);
          return response.status(500).json({
            message: 'The return could not be completed and its status rollback failed.',
          });
        }
        return response.status(409).json({ message: 'Book availability cannot be restored safely.' });
      }
    } catch (error) {
      try {
        await restoreBorrowStatus(updatedRequest, previousStatus, returnedAt);
      } catch (rollbackError) {
        console.error('Could not restore a borrow request after a failed inventory update:', rollbackError);
        return response.status(500).json({
          message: 'The return could not be completed and its status rollback failed.',
        });
      }
      throw error;
    }
  }

  await updatedRequest.populate('book', 'title author isbn');
  await updatedRequest.populate('user', 'username email');
  response.status(200).json({ borrowRequest: updatedRequest });
}));

module.exports = router;
