const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, (request, response) => {
  const { id, username, email, role, createdAt, updatedAt } = request.user;
  response.status(200).json({
    id,
    username,
    email,
    role,
    createdAt,
    updatedAt,
  });
});

module.exports = router;
