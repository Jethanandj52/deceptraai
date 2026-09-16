const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

/** Protects a route: requires a valid `Authorization: Bearer <token>` header. */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized — no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized — user no longer exists');
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized — invalid or expired token');
  }
});

module.exports = { protect };
