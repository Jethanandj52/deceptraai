const asyncHandler = require("express-async-handler");

const User = require("../models/User");

const generateToken = require("../utils/generateToken");

const sendEmail = require("../utils/sendEmail");

// ======================================================
// GENERATE 6 DIGIT OTP
// ======================================================

const generateOTP = () => {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
};

// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

const register = asyncHandler(async (req, res) => {
  const {
    name,
    companyName,
    email,
    password,
  } = req.body;

  // Check required fields
  if (
    !name ||
    !companyName ||
    !email ||
    !password
  ) {
    res.status(400);

    throw new Error(
      "Please provide name, company name, email, and password"
    );
  }

  // Password validation
  if (password.length < 6) {
    res.status(400);

    throw new Error(
      "Password must be at least 6 characters"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  // Check existing user
  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    res.status(409);

    throw new Error(
      "An account with this email already exists"
    );
  }

  // Generate OTP
  const otp = generateOTP();

  const otpExpires = new Date(
    Date.now() + 10 * 60 * 1000
  );

  // Create user
  const user = await User.create({
    name: name.trim(),
    companyName: companyName.trim(),
    email: normalizedEmail,
    password,
    otp,
    otpExpires,
    otpPurpose: "signup",
    isEmailVerified: false,
  });

  // Send OTP email
  await sendEmail({
    to: normalizedEmail,

    subject:
      "DeceptionAI - Verify Your Email",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        padding: 30px;
        background: #f8fafc;
      ">

        <h2 style="color: #2563eb;">
          Welcome to DeceptionAI
        </h2>

        <p>
          Hello ${user.name},
        </p>

        <p>
          Thank you for creating your DeceptionAI
          account.
        </p>

        <p>
          Your verification OTP is:
        </p>

        <div style="
          margin: 25px 0;
          padding: 20px;
          text-align: center;
          background: white;
          border-radius: 12px;
        ">

          <h1 style="
            letter-spacing: 8px;
            color: #2563eb;
          ">
            ${otp}
          </h1>

        </div>

        <p>
          This OTP will expire in
          <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not create this account,
          please ignore this email.
        </p>

        <hr />

        <p style="color: #64748b;">
          DeceptionAI<br />
          AI-Powered Interview Assessment Platform
        </p>

      </div>
    `,
  });

  res.status(201).json({
    message:
      "Account created successfully. OTP sent to your email.",
    email: normalizedEmail,
  });
});

// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

const login = asyncHandler(async (req, res) => {
  const {
    email,
    password,
  } = req.body;

  if (!email || !password) {
    res.status(400);

    throw new Error(
      "Please provide email and password"
    );
  }

  const normalizedEmail =
    email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (
    !user ||
    !(await user.comparePassword(password))
  ) {
    res.status(401);

    throw new Error(
      "Invalid email or password"
    );
  }

  // Email verification check
  if (!user.isEmailVerified) {
    res.status(403);

    throw new Error(
      "Please verify your email before logging in"
    );
  }

  res.status(200).json({
    ...user.toSafeObject(),
    token: generateToken(user._id),
  });
});

// ======================================================
// FORGOT PASSWORD
// POST /api/auth/forgot-password
// ======================================================

const forgotPassword = asyncHandler(
  async (req, res) => {
    const { email } = req.body;

    if (!email) {
      res.status(400);

      throw new Error(
        "Please provide your email"
      );
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    // Do not reveal whether account exists
    if (!user) {
      res.status(200).json({
        message:
          "If an account exists with this email, an OTP has been sent.",
      });

      return;
    }

    // Generate OTP
    const otp = generateOTP();

    const otpExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.otpPurpose = "forgot-password";

    user.resetPasswordVerified = false;

    await user.save();

    // Send email
    await sendEmail({
      to: normalizedEmail,

      subject:
        "DeceptionAI - Password Reset OTP",

      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 30px;
          background: #f8fafc;
        ">

          <h2 style="color: #2563eb;">
            Reset Your DeceptionAI Password
          </h2>

          <p>
            Hello ${user.name},
          </p>

          <p>
            We received a request to reset
            your password.
          </p>

          <p>
            Your password reset OTP is:
          </p>

          <div style="
            margin: 25px 0;
            padding: 20px;
            text-align: center;
            background: white;
            border-radius: 12px;
          ">

            <h1 style="
              letter-spacing: 8px;
              color: #2563eb;
            ">
              ${otp}
            </h1>

          </div>

          <p>
            This OTP will expire in
            <strong>10 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset,
            please ignore this email.
          </p>

        </div>
      `,
    });

    res.status(200).json({
      message:
        "If an account exists with this email, an OTP has been sent.",
      email: normalizedEmail,
    });
  }
);

// ======================================================
// VERIFY OTP
// POST /api/auth/verify-otp
// ======================================================

const verifyOTP = asyncHandler(
  async (req, res) => {
    const {
      email,
      otp,
      purpose,
    } = req.body;

    if (!email || !otp || !purpose) {
      res.status(400);

      throw new Error(
        "Email, OTP and purpose are required"
      );
    }

    if (
      !["signup", "forgot-password"].includes(
        purpose
      )
    ) {
      res.status(400);

      throw new Error(
        "Invalid OTP purpose"
      );
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(404);

      throw new Error(
        "User not found"
      );
    }

    if (!user.otp) {
      res.status(400);

      throw new Error(
        "No OTP found. Please request a new OTP."
      );
    }

    // Check expiry
    if (
      !user.otpExpires ||
      user.otpExpires < new Date()
    ) {
      user.otp = null;
      user.otpExpires = null;
      user.otpPurpose = null;

      await user.save();

      res.status(400);

      throw new Error(
        "OTP has expired. Please request a new OTP."
      );
    }

    // Check OTP
    if (user.otp !== otp.toString()) {
      res.status(400);

      throw new Error(
        "Invalid OTP"
      );
    }

    // Check OTP purpose
    if (user.otpPurpose !== purpose) {
      res.status(400);

      throw new Error(
        "Invalid OTP purpose"
      );
    }

    // ==================================================
    // SIGNUP OTP
    // ==================================================

    if (purpose === "signup") {
      user.isEmailVerified = true;

      user.otp = null;
      user.otpExpires = null;
      user.otpPurpose = null;

      await user.save();

      res.status(200).json({
        message:
          "Email verified successfully. You can now login.",
        verified: true,
      });

      return;
    }

    // ==================================================
    // FORGOT PASSWORD OTP
    // ==================================================

    if (purpose === "forgot-password") {
      user.resetPasswordVerified = true;

      user.otp = null;
      user.otpExpires = null;
      user.otpPurpose = null;

      await user.save();

      res.status(200).json({
        message:
          "OTP verified successfully.",
        email: normalizedEmail,
        verified: true,
      });

      return;
    }
  }
);

// ======================================================
// RESEND OTP
// POST /api/auth/resend-otp
// ======================================================

const resendOTP = asyncHandler(
  async (req, res) => {
    const {
      email,
      purpose,
    } = req.body;

    if (!email || !purpose) {
      res.status(400);

      throw new Error(
        "Email and purpose are required"
      );
    }

    if (
      !["signup", "forgot-password"].includes(
        purpose
      )
    ) {
      res.status(400);

      throw new Error(
        "Invalid OTP purpose"
      );
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(404);

      throw new Error(
        "User not found"
      );
    }

    const otp = generateOTP();

    const otpExpires = new Date(
      Date.now() + 10 * 60 * 1000
    );

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.otpPurpose = purpose;

    if (purpose === "forgot-password") {
      user.resetPasswordVerified = false;
    }

    await user.save();

    const subject =
      purpose === "signup"
        ? "DeceptionAI - New Verification OTP"
        : "DeceptionAI - Password Reset OTP";

    await sendEmail({
      to: normalizedEmail,

      subject,

      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: auto;
          padding: 30px;
          background: #f8fafc;
        ">

          <h2 style="color: #2563eb;">
            DeceptionAI
          </h2>

          <p>
            Your new OTP is:
          </p>

          <div style="
            margin: 25px 0;
            padding: 20px;
            text-align: center;
            background: white;
            border-radius: 12px;
          ">

            <h1 style="
              letter-spacing: 8px;
              color: #2563eb;
            ">
              ${otp}
            </h1>

          </div>

          <p>
            This OTP will expire in
            <strong>10 minutes</strong>.
          </p>

        </div>
      `,
    });

    res.status(200).json({
      message:
        "New OTP sent successfully.",
    });
  }
);

// ======================================================
// RESET PASSWORD
// POST /api/auth/reset-password
// ======================================================

const resetPassword = asyncHandler(
  async (req, res) => {
    const {
      email,
      password,
      confirmPassword,
    } = req.body;

    if (
      !email ||
      !password ||
      !confirmPassword
    ) {
      res.status(400);

      throw new Error(
        "Please provide email, password and confirm password"
      );
    }

    if (password.length < 6) {
      res.status(400);

      throw new Error(
        "Password must be at least 6 characters"
      );
    }

    if (password !== confirmPassword) {
      res.status(400);

      throw new Error(
        "Passwords do not match"
      );
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(404);

      throw new Error(
        "User not found"
      );
    }

    // OTP must be verified first
    if (!user.resetPasswordVerified) {
      res.status(400);

      throw new Error(
        "Please verify the OTP before resetting your password"
      );
    }

    // Update password
    user.password = password;

    // Reset verification flag
    user.resetPasswordVerified = false;

    await user.save();

    res.status(200).json({
      message:
        "Password reset successfully. You can now login.",
    });
  }
);

// ======================================================
// CURRENT USER
// GET /api/auth/me
// ======================================================

const me = asyncHandler(
  async (req, res) => {
    res.status(200).json(
      req.user.toSafeObject
        ? req.user.toSafeObject()
        : req.user
    );
  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resendOTP,
  resetPassword,
  me,
};