const express = require('express');
const mongoose = require('mongoose');
const Book = require('./models/Book');
const Genre = require('./models/Genre');

const app = express();
const BOOK_FIELDS = [
  'title',
  'author',
  'isbn',
  'description',
  'coverImage',
  'totalCopies',
  'availableCopies',
  'genre',
];
const GENRE_FIELDS = ['name', 'slug'];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function requireBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.');
  }

  const unsupported = Object.keys(body).find((field) => !fields.includes(field));
  if (unsupported) {
    throw new ApiError(400, `${unsupported} is not an allowed field.`);
  }

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      throw new ApiError(400, `${field} is required.`);
    }
  }
}

function validateStringFields(body, fields) {
  for (const field of fields) {
    if (typeof body[field] !== 'string') {
      throw new ApiError(400, `${field} must be a string.`);
    }
    if (!body[field].trim()) {
      throw new ApiError(400, `${field} must not be empty.`);
    }
    body[field] = body[field].trim();
  }
}

function validateGenreBody(body) {
  requireBody(body, GENRE_FIELDS);
  validateStringFields(body, GENRE_FIELDS);
  body.slug = body.slug.toLowerCase();
}

function validateBookBody(body) {
  requireBody(body, BOOK_FIELDS);
  validateStringFields(body, [
    'title',
    'author',
    'isbn',
    'description',
    'coverImage',
  ]);

  for (const field of ['totalCopies', 'availableCopies']) {
    if (typeof body[field] !== 'number' || !Number.isInteger(body[field])) {
      throw new ApiError(400, `${field} must be a whole number.`);
    }
    if (body[field] < 0) {
      throw new ApiError(400, `${field} must be at least 0.`);
    }
  }

  if (body.availableCopies > body.totalCopies) {
    throw new ApiError(400, 'availableCopies cannot exceed totalCopies.');
  }
  if (typeof body.genre !== 'string' || !mongoose.isValidObjectId(body.genre)) {
    throw new ApiError(400, 'genre must be a valid MongoDB ObjectId.');
  }
}

function parsePositiveInteger(value, field, defaultValue, maximum) {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, `${field} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiError(400, `${field} must be a safe positive integer.`);
  }
  if (maximum && parsed > maximum) {
    throw new ApiError(400, `${field} must not exceed ${maximum}.`);
  }
  return parsed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireExistingGenre(genreId) {
  const genre = await Genre.findById(genreId);
  if (!genre) {
    throw new ApiError(400, 'genre must reference an existing genre.');
  }
}

async function requireUniqueGenre(body, currentId) {
  const query = { $or: [{ name: body.name }, { slug: body.slug }] };
  if (currentId) {
    query._id = { $ne: currentId };
  }
  const duplicate = await Genre.findOne(query);
  if (duplicate) {
    const field = duplicate.name === body.name ? 'name' : 'slug';
    throw new ApiError(400, `${field} must be unique.`);
  }
}

app.disable('x-powered-by');
app.use(express.json());

app.get('/genres', asyncRoute(async (request, response) => {
  const genres = await Genre.find().sort({ name: 1 });
  response.status(200).json(genres);
}));

app.get('/genres/:id', asyncRoute(async (request, response) => {
  const genre = mongoose.isValidObjectId(request.params.id)
    ? await Genre.findById(request.params.id)
    : null;
  if (!genre) {
    throw new ApiError(404, 'Genre not found.');
  }
  response.status(200).json(genre);
}));

app.post('/genres', asyncRoute(async (request, response) => {
  validateGenreBody(request.body);
  await requireUniqueGenre(request.body);
  const genre = await Genre.create(request.body);
  response.status(201).json(genre);
}));

app.put('/genres/:id', asyncRoute(async (request, response) => {
  validateGenreBody(request.body);
  const genreId = mongoose.isValidObjectId(request.params.id)
    ? request.params.id
    : null;
  const currentGenre = genreId ? await Genre.findById(genreId) : null;
  if (!currentGenre) {
    throw new ApiError(404, 'Genre not found.');
  }
  await requireUniqueGenre(request.body, currentGenre._id);
  Object.assign(currentGenre, request.body);
  await currentGenre.save();
  response.status(200).json(currentGenre);
}));

app.delete('/genres/:id', asyncRoute(async (request, response) => {
  const genre = mongoose.isValidObjectId(request.params.id)
    ? await Genre.findById(request.params.id)
    : null;
  if (!genre) {
    throw new ApiError(404, 'Genre not found.');
  }
  if (await Book.exists({ genre: genre._id })) {
    throw new ApiError(409, 'Genre cannot be deleted while books reference it.');
  }
  await genre.deleteOne();
  response.status(204).end();
}));

app.get('/books', asyncRoute(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 'page', 1);
  const limit = parsePositiveInteger(request.query.limit, 'limit', 10, 100);
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    throw new ApiError(400, 'page and limit produce an unsafe result offset.');
  }
  const filter = {};

  if (request.query.genre !== undefined) {
    if (
      typeof request.query.genre !== 'string'
      || !mongoose.isValidObjectId(request.query.genre)
    ) {
      throw new ApiError(400, 'genre must be a valid MongoDB ObjectId.');
    }
    await requireExistingGenre(request.query.genre);
    filter.genre = request.query.genre;
  }

  if (request.query.search !== undefined) {
    if (typeof request.query.search !== 'string') {
      throw new ApiError(400, 'search must be a string.');
    }
    const search = request.query.search.trim();
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: expression }, { author: expression }];
    }
  }

  const [books, total] = await Promise.all([
    Book.find(filter)
      .populate('genre')
      .sort({ title: 1, _id: 1 })
      .skip(offset)
      .limit(limit),
    Book.countDocuments(filter),
  ]);
  response.status(200).json({
    data: books,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

app.get('/books/:id', asyncRoute(async (request, response) => {
  const book = mongoose.isValidObjectId(request.params.id)
    ? await Book.findById(request.params.id).populate('genre')
    : null;
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }
  response.status(200).json(book);
}));

app.post('/books', asyncRoute(async (request, response) => {
  validateBookBody(request.body);
  await requireExistingGenre(request.body.genre);
  const book = await Book.create(request.body);
  response.status(201).json(await book.populate('genre'));
}));

app.put('/books/:id', asyncRoute(async (request, response) => {
  validateBookBody(request.body);
  const bookId = mongoose.isValidObjectId(request.params.id)
    ? request.params.id
    : null;
  const book = bookId ? await Book.findById(bookId) : null;
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }
  await requireExistingGenre(request.body.genre);
  Object.assign(book, request.body);
  await book.save();
  response.status(200).json(await book.populate('genre'));
}));

app.delete('/books/:id', asyncRoute(async (request, response) => {
  const book = mongoose.isValidObjectId(request.params.id)
    ? await Book.findById(request.params.id)
    : null;
  if (!book) {
    throw new ApiError(404, 'Book not found.');
  }
  await book.deleteOne();
  response.status(204).end();
}));

app.use((request, response) => {
  response.status(404).json({ message: 'Endpoint not found.' });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ message: 'Request body must be valid JSON.' });
  }

  if (error instanceof ApiError) {
    return response.status(error.status).json({ message: error.message });
  }

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    const field = error.path || Object.keys(error.errors || {})[0] || 'input';
    return response.status(400).json({ message: `${field} is invalid.` });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'value';
    return response.status(400).json({ message: `${field} must be unique.` });
  }

  console.error('API request failed:', error);
  return response.status(500).json({ message: 'Internal server error.' });
});

module.exports = app;
