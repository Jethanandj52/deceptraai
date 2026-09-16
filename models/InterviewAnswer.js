const mongoose = require('mongoose');

const interviewAnswerSchema = new mongoose.Schema(
  {
    // ------------------------------------------
    // Interview
    // ------------------------------------------

    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },

    // ------------------------------------------
    // Question
    // ------------------------------------------

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },

    // ------------------------------------------
    // Candidate
    // ------------------------------------------

    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      default: null,
    },

    // ------------------------------------------
    // Answer Type
    // ------------------------------------------

    answerType: {
      type: String,

      enum: [
        'MCQ',
        'Paragraph',
        'Voice',
      ],

      required: true,
    },

    // ------------------------------------------
    // Text Answer
    // MCQ / Paragraph
    // ------------------------------------------

    textAnswer: {
      type: String,
      default: '',
    },

    // ------------------------------------------
    // Selected MCQ option
    // ------------------------------------------

    selectedOption: {
      type: String,
      default: '',
    },

    // ------------------------------------------
    // Voice Audio
    // ------------------------------------------

    audioUrl: {
      type: String,
      default: '',
    },

    audioPath: {
      type: String,
      default: '',
    },

    audioMimeType: {
      type: String,
      default: '',
    },

    audioDuration: {
      type: Number,
      default: 0,
    },

    // ------------------------------------------
    // AI Analysis
    // ------------------------------------------

    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ------------------------------------------
    // AI Processing Status
    // ------------------------------------------

    aiStatus: {
      type: String,

      enum: [
        'pending',
        'processing',
        'completed',
        'failed',
      ],

      default: 'pending',
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'InterviewAnswer',
  interviewAnswerSchema
);