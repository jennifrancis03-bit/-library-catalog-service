const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const app = require('../express-api-folder/app');
const { requireAuth, requireRole } = require('../middleware/auth');

process.env.JWT_SECRET = 'test-only-library-secret';
process.env.FRONTEND_ORIGIN = 'https://library-catalog-admin.onrender.com';

const servers = [];

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  })));
});

async function startServer(application) {
  const server = application.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function createProtectedApp() {
  const protectedApp = express();
  protectedApp.get('/protected', requireAuth, requireRole('librarian'), (request, response) => {
    response.status(200).json({ username: request.user.username });
  });
  return protectedApp;
}

test('protected route rejects a request without a token', async () => {
  const baseUrl = await startServer(createProtectedApp());
  const response = await fetch(`${baseUrl}/protected`);

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ message: 'Authentication is required.' });
});

test('protected route rejects an invalid token', async () => {
  const baseUrl = await startServer(createProtectedApp());
  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    message: 'Authentication token is invalid or expired.',
  });
});

test('librarian-only route rejects a patron with a valid token', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const userLookup = jest.spyOn(User, 'findById').mockResolvedValue({
    _id: userId,
    username: 'patron-one',
    role: 'patron',
  });
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  const baseUrl = await startServer(createProtectedApp());
  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({
    message: 'You do not have permission to perform this action.',
  });
  expect(userLookup).toHaveBeenCalledTimes(1);
});

test('CORS preflight allows the deployed admin origin with credential support', async () => {
  const baseUrl = await startServer(app);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: process.env.FRONTEND_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

  expect(response.status).toBe(204);
  expect(response.headers.get('access-control-allow-origin')).toBe(process.env.FRONTEND_ORIGIN);
  expect(response.headers.get('access-control-allow-credentials')).toBe('true');
});

test('CORS rejects an unconfigured frontend origin', async () => {
  const baseUrl = await startServer(app);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST',
    },
  });

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({ message: 'This origin is not allowed.' });
});
