require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const session = require("express-session");
const MongoStore = require("connect-mongo");
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
// TRUST PROXY
// ======================================================
//
// Required for secure cookies behind Vercel's HTTPS proxy.
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
// Local example:
//
// CORS_ORIGIN=http://localhost:3000
//
// Vite example:
//
// CORS_ORIGIN=http://localhost:5173
//
// Production example:
//
// CORS_ORIGIN=https://your-frontend.vercel.app
//
// Multiple origins:
//
// CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://your-frontend.vercel.app
//

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without Origin header,
      // such as Postman/server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `CORS policy: Origin ${origin} is not allowed`
        )
      );
    },

    credentials: true,
  })
);

// ======================================================
// SESSION
// ======================================================
//
// IMPORTANT FOR VERCEL:
//
// Do NOT use the default express-session MemoryStore
// for production.
//
// MongoDB is used as the session store so that the
// session survives between Vercel serverless invocations.
//
// Candidate interview flow:
//
// verify
//   ↓
// req.session.interviewId
//   ↓
// MongoDB session store
//   ↓
// start
//
// This keeps the verified interview session available.
//

const isProduction =
  process.env.NODE_ENV === "production";

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "deceptionai_session_secret",

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,

      collectionName: "sessions",

      ttl: 30 * 60,
    }),

    cookie: {
      httpOnly: true,

      // HTTPS is used by Vercel.
      secure: isProduction,

      // Required for frontend/backend on different
      // Vercel domains.
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
// Session is used to identify the verified interview.
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
// Mounting another answer system on the same prefix
// can cause conflicts between two architectures.
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
// Vercel imports the Express app below.
//
// Localhost DOES need app.listen().
//

const PORT =
  process.env.PORT || 8000;

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(
      `[server] DeceptionAI API listening on http://localhost:${PORT}`
    );

    console.log(
      `[server] Allowed CORS origins: ${allowedOrigins.join(
        ", "
      )}`
    );
  });
}

// ======================================================
// VERCEL EXPORT
// ======================================================

module.exports = app;