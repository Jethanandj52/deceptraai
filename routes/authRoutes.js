const express = require("express");

const {
  register,
  login,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
  me,
} = require("../controllers/authController");

const {
  protect,
} = require("../middleware/auth");

const router = express.Router();

// ======================================================
// AUTH ROUTES
// ======================================================

// Signup
router.post(
  "/register",
  register
);

// Login
router.post(
  "/login",
  login
);

// Forgot Password
router.post(
  "/forgot-password",
  forgotPassword
);

// Verify OTP
router.post(
  "/verify-otp",
  verifyOTP
);

// Resend OTP
router.post(
  "/resend-otp",
  resendOTP
);

// Reset Password
router.post(
  "/reset-password",
  resetPassword
);

// Current User
router.get(
  "/me",
  protect,
  me
);

module.exports = router;