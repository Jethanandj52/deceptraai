const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ['Technical', 'Behavioral', 'HR', 'General'],
      default: 'General',
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Question', questionSchema);