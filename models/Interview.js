const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
    },

    questionText: {
      type: String,
      required: true,
    },

    questionType: {
      type: String,
      enum: ['MCQ', 'Paragraph', 'Voice'],
      default: 'Paragraph',
    },

    answer: {
      type: String,
      default: '',
    },

    selectedOption: {
      type: String,
      default: '',
    },

    transcript: {
      type: String,
      default: '',
    },

    faceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    voiceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    textScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    combinedScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },

    flagged: {
      type: Boolean,
      default: false,
    },

    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const interviewQuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ['MCQ', 'Paragraph', 'Voice'],
      default: 'Paragraph',
    },

    options: {
      type: [String],
      default: [],
    },

    order: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
    },

    position: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        'Technical',
        'HR',
        'Behavioral',
        'General',
      ],
      default: 'General',
    },

    questions: {
      type: [interviewQuestionSchema],
      default: [],
    },

    settings: {
      cameraRequired: {
        type: Boolean,
        default: true,
      },

      micRequired: {
        type: Boolean,
        default: true,
      },

      fullscreenRequired: {
        type: Boolean,
        default: false,
      },

      faceAnalysis: {
        type: Boolean,
        default: true,
      },

      voiceAnalysis: {
        type: Boolean,
        default: true,
      },

      textAnalysis: {
        type: Boolean,
        default: true,
      },

      autoRecording: {
        type: Boolean,
        default: true,
      },

      durationMinutes: {
        type: Number,
        default: 30,
      },
    },

    // Keep this for existing interview records.
    // It is NO LONGER used in the public interview URL.
    linkToken: {
      type: String,
      required: true,
      unique: true,
    },

    // New email verification code
    verificationCode: {
      type: String,
      default: null,
    },

    // Verification code expiry
    verificationCodeExpiresAt: {
      type: Date,
      default: null,
    },

    linkStatus: {
      type: String,
      enum: [
        'Active',
        'Opened',
        'InProgress',
        'Completed',
        'Expired',
      ],
      default: 'Active',
    },

    linkExpiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        'Pending',
        'InProgress',
        'Completed',
        'Expired',
      ],
      default: 'Pending',
    },

    answers: {
      type: [answerSchema],
      default: [],
    },

    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

interviewSchema.index({
  createdBy: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  'Interview',
  interviewSchema
);