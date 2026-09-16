require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const path = require("path");

const connectDB = require("./config/db");

// ======================================================
// ROUTES
// ======================================================

const authRoutes = require("./routes/authRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const questionRoutes = require("./routes/questionRoutes");
const interviewRoutes = require("./routes/interviewRoutes");

const publicInterviewRoutes = require(
  "./routes/publicInterviewRoutes"
);

// IMPORTANT:
// interviewAnswerRoutes is NOT used here because
// publicInterviewController already handles:
//
// /answer
// /complete
//
// const interviewAnswerRoutes = require(
//   "./routes/interviewAnswerRoutes"
// );

// ======================================================
// ERROR HANDLING
// ======================================================

const {
  notFound,
  errorHandler,
} = require("./middleware/errorHandler");

// ======================================================
// APP
// ======================================================

const app = express();

// ======================================================
// ENVIRONMENT
// ======================================================

const isProduction =
  process.env.NODE_ENV === "production";

// ======================================================
// TRUST PROXY
// ======================================================
//
// Required when running behind Vercel's HTTPS proxy.
// This allows secure cookies to work correctly.
//

app.set("trust proxy", 1);

// ======================================================
// DATABASE
// ======================================================

connectDB();

// ======================================================
// CORS
// ======================================================
//
// Supported:
//
// http://localhost:3000
// http://localhost:5173
//
// Plus production frontend from:
//
// CORS_ORIGIN=https://your-frontend.vercel.app
//
// Multiple origins:
//
// CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://your-frontend.vercel.app
//

const allowedOrigins = (
  process.env.CORS_ORIGIN || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Always allow local development.
const localOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsOrigins = [
  ...new Set([
    ...localOrigins,
    ...allowedOrigins,
  ]),
];

console.log(
  "[server] CORS allowed origins:",
  corsOrigins
);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without Origin header.
      //
      // Examples:
      // Postman
      // server-to-server requests
      // direct browser navigation
      //
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log(
        `[CORS] Blocked origin: ${origin}`
      );

      // Do not throw a CORS error.
      // Simply don't allow the origin.
      return callback(null, false);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ======================================================
// SESSION
// ======================================================
//
// IMPORTANT FOR VERCEL:
//
// Do NOT use the default MemoryStore in production.
//
// MongoDB is used as the session store.
//
// Flow:
//
// verify
//    ↓
// req.session.interviewId
//    ↓
// MongoDB session store
//    ↓
// start
//
// This allows the verified interview session to survive
// between Vercel serverless invocations.
//

// ======================================================
// VALIDATE SESSION ENVIRONMENT
// ======================================================

if (!process.env.SESSION_SECRET) {
  console.warn(
    "[session] WARNING: SESSION_SECRET is not set."
  );
}

if (!process.env.MONGO_URI) {
  console.warn(
    "[session] WARNING: MONGO_URI is not set."
  );
}

// ======================================================
// MONGO SESSION STORE
// ======================================================
//
// connect-mongo v4+ / v5 / v6 uses:
//
// MongoStore.create({...})
//
// The current package documentation uses this syntax.
//

const mongoStore = MongoStore.create({
  mongoUrl: process.env.MONGO_URI,

  collectionName: "sessions",

  ttl: 30 * 60,

  // MongoDB automatically removes expired sessions.
  autoRemove: "native",
});

// ======================================================
// EXPRESS SESSION
// ======================================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "deceptionai_session_secret",

    resave: false,

    saveUninitialized: false,

    store: mongoStore,

    cookie: {
      httpOnly: true,

      // Vercel uses HTTPS.
      secure: isProduction,

      // Frontend and backend are on different domains
      // in production.
      //
      // Example:
      //
      // frontend.vercel.app
      // backend.vercel.app
      //
      // Therefore SameSite=None is required.
      sameSite: isProduction
        ? "none"
        : "lax",

      // 30 minutes.
      maxAge: 30 * 60 * 1000,
    },
  })
);

// ======================================================
// BODY PARSER
// ======================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ======================================================
// LOGGER
// ======================================================

app.use(
  morgan(
    isProduction
      ? "combined"
      : "dev"
  )
);

// ======================================================
// STATIC UPLOADS
// ======================================================
//
// Local:
//
// http://localhost:8000/uploads/filename
//
// IMPORTANT:
//
// Vercel serverless filesystem is NOT persistent.
//
// This route is kept for local development and
// compatibility with existing code.
//

app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// ======================================================
// ROOT ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    name: "DeceptionAI API",
    status: "ok",
    message: "API is running successfully",
  });
});

// ======================================================
// AUTH ROUTES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);

// ======================================================
// CANDIDATE ROUTES
// ======================================================

app.use(
  "/api/candidates",
  candidateRoutes
);

// ======================================================
// QUESTION ROUTES
// ======================================================

app.use(
  "/api/questions",
  questionRoutes
);

// ======================================================
// INTERVIEW ROUTES
// ======================================================

app.use(
  "/api/interviews",
  interviewRoutes
);

// ======================================================
// PUBLIC INTERVIEW ROUTES
// ======================================================
//
// Public interview flow:
//
// GET
// /api/public/interview
//
// POST
// /api/public/interview/send-code
//
// POST
// /api/public/interview/verify
//
// POST
// /api/public/interview/start
//
// POST
// /api/public/interview/answer
//
// POST
// /api/public/interview/complete
//
// Session identifies the verified interview.
//

app.use(
  "/api/public/interview",
  publicInterviewRoutes
);

// ======================================================
// IMPORTANT
// ======================================================
//
// DO NOT mount interviewAnswerRoutes here.
//
// publicInterviewController already handles:
//
// POST /api/public/interview/answer
// POST /api/public/interview/complete
//
// Mounting another answer system can cause conflicts.
//
// const interviewAnswerRoutes = require(
//   "./routes/interviewAnswerRoutes"
// );
//
// app.use(
//   "/api/public/interview",
//   interviewAnswerRoutes
// );

// ======================================================
// 404 HANDLER
// ======================================================

app.use(notFound);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(errorHandler);

// ======================================================
// LOCAL SERVER
// ======================================================
//
// Vercel does NOT need app.listen().
//
// Local development DOES need app.listen().
//
// Vercel imports:
//
// module.exports = app
//

const PORT =
  process.env.PORT || 8000;

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(
      `[server] DeceptionAI API listening on http://localhost:${PORT}`
    );

    console.log(
      `[server] Allowed CORS origins: ${corsOrigins.join(
        ", "
      )}`
    );
  });
}

// ======================================================
// VERCEL EXPORT
// ======================================================

module.exports = app;