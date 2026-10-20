const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const requireLibrarian = [requireAuth, requireRole('librarian')];

// Keep the catalog handlers in app.js while running authorization before them.
router.post('/', ...requireLibrarian, (request, response, next) => next());
router.put('/:id', ...requireLibrarian, (request, response, next) => next());
router.delete('/:id', ...requireLibrarian, (request, response, next) => next());

module.exports = router;
