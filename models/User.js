const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ==================================================
    // USER INFORMATION
    // ==================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // ==================================================
    // OTP
    // ==================================================

    otp: {
      type: String,
      default: null,
    },

    otpExpires: {
      type: Date,
      default: null,
    },

    otpPurpose: {
      type: String,
      enum: [
        "signup",
        "forgot-password",
        null,
      ],
      default: null,
    },

    // ==================================================
    // EMAIL VERIFICATION
    // ==================================================

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ==================================================
    // PASSWORD RESET VERIFICATION
    // ==================================================

    resetPasswordVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// HASH PASSWORD
// ======================================================

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(
    this.password,
    salt
  );

  next();
});

// ======================================================
// COMPARE PASSWORD
// ======================================================

userSchema.methods.comparePassword = function (
  candidatePassword
) {
  return bcrypt.compare(
    candidatePassword,
    this.password
  );
};

// ======================================================
// SAFE USER OBJECT
// ======================================================

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    companyName: this.companyName,
    email: this.email,
    isEmailVerified: this.isEmailVerified,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model(
  "User",
  userSchema
);