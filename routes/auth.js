const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  clearAuthCookie,
  createToken,
  setAuthCookie,
} = require('../middleware/auth');

const router = express.Router();

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response)).catch(next);
  };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

function validateCredentials(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }
  const unsupported = Object.keys(body).find((field) => !fields.includes(field));
  if (unsupported) {
    return `${unsupported} is not an allowed field.`;
  }
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return `${field} must be a non-empty string.`;
    }
  }
  return null;
}

router.post('/register', asyncRoute(async (request, response) => {
  const error = validateCredentials(request.body, ['username', 'email', 'password']);
  if (error) {
    return response.status(400).json({ message: error });
  }

  const { username, email, password } = request.body;
  if (username.trim().length < 3 || username.trim().length > 40) {
    return response.status(400).json({ message: 'username must be between 3 and 40 characters.' });
  }
  if (password.length < 8) {
    return response.status(400).json({ message: 'password must be at least 8 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return response.status(400).json({ message: 'email must be a valid email address.' });
  }

  const user = await User.create({ username, email, password });
  return response.status(201).json({ user: publicUser(user) });
}));

router.post('/login', asyncRoute(async (request, response) => {
  const error = validateCredentials(request.body, ['email', 'password']);
  if (error) {
    return response.status(400).json({ message: error });
  }

  const user = await User.findOne({ email: request.body.email.trim().toLowerCase() })
    .select('+password');
  if (!user || !(await user.verifyPassword(request.body.password))) {
    return response.status(401).json({ message: 'Email or password is incorrect.' });
  }

  const token = createToken(user);
  setAuthCookie(response, token);
  return response.status(200).json({ user: publicUser(user) });
}));

router.post('/logout', (request, response) => {
  clearAuthCookie(response);
  response.status(200).json({ message: 'Logged out.' });
});

router.use((error, request, response, next) => {
  if (error instanceof jwt.JsonWebTokenError) {
    return response.status(401).json({ message: 'Authentication token is invalid.' });
  }
  return next(error);
});

module.exports = router;
