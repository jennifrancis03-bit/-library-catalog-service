const jwt = require('jsonwebtoken');
const User = require('../models/User');

const TOKEN_COOKIE = 'library_token';
const TOKEN_MAX_AGE_SECONDS = 15 * 60;

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required to use authentication.');
  }
  return process.env.JWT_SECRET;
}

function readCookie(request, name) {
  const cookies = request.headers.cookie || '';
  const prefix = `${name}=`;
  const value = cookies.split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function setAuthCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}${secure}`,
  );
}

function clearAuthCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`,
  );
}

function createToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: TOKEN_MAX_AGE_SECONDS },
  );
}

function requireAuth(request, response, next) {
  const authorization = request.get('authorization');
  const bearerToken = authorization && authorization.match(/^Bearer\s+(.+)$/i);
  const token = readCookie(request, TOKEN_COOKIE)
    || (bearerToken ? bearerToken[1] : null);

  if (!token) {
    return response.status(401).json({ message: 'Authentication is required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return response.status(401).json({ message: 'Authentication token is invalid or expired.' });
    }
    return next(error);
  }

  if (!payload || typeof payload.sub !== 'string') {
    return response.status(401).json({ message: 'Authentication token is invalid.' });
  }

  User.findById(payload.sub)
    .then((user) => {
      if (!user) {
        return response.status(401).json({ message: 'Authentication token is invalid.' });
      }
      request.user = user;
      return next();
    })
    .catch(next);
}

function requireRole(role) {
  return (request, response, next) => {
    if (!request.user || request.user.role !== role) {
      return response.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

module.exports = {
  TOKEN_COOKIE,
  TOKEN_MAX_AGE_SECONDS,
  clearAuthCookie,
  createToken,
  getJwtSecret,
  requireAuth,
  requireRole,
  setAuthCookie,
};
