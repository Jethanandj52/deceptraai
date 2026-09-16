require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const session = require("express-session");
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
// DATABASE
// ======================================================

connectDB();

// ======================================================
// CORS
// ======================================================

// Frontend is running on:
// http://localhost:3000
//
// If you also want to allow Vite default port 5173,
// put both in .env:
//
// CORS_ORIGIN=http://localhost:3000,http://localhost:5173

const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ======================================================
// SESSION
// ======================================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "deceptionai_session_secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      // Localhost development
      secure: false,

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
    process.env.NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

// ======================================================
// STATIC UPLOADS
// ======================================================
//
// Uploaded files can be accessed from:
//
// http://localhost:8000/uploads/filename
//
// Folder:
// uploads/
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
// GET    /api/public/interview
// POST   /api/public/interview/send-code
// POST   /api/public/interview/verify
// POST   /api/public/interview/start
// POST   /api/public/interview/answer
// POST   /api/public/interview/complete
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
// Your publicInterviewController already handles answers:
//
// POST /api/public/interview/answer
//
// Mounting another answer system on the same prefix can
// cause conflicts between two different architectures.
//
// ======================================================

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
// START SERVER
// ======================================================

const PORT =
  process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(
    `[server] DeceptionAI API listening on http://localhost:${PORT}`
  );

  console.log(
    `[server] Allowed CORS origins: ${allowedOrigins.join(", ")}`
  );
});