/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found — ${req.originalUrl}`));
}

/** Centralized JSON error handler. Keeps stack traces out of production responses. */
function errorHandler(err, req, res, next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || 'Server error',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

module.exports = { notFound, errorHandler };
