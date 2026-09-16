const asyncHandler = require('express-async-handler');
const Question = require('../models/Question');

// ======================================================
// LIST QUESTIONS
// GET /api/questions
// PRIVATE
// ======================================================

const listQuestions = asyncHandler(async (req, res) => {
  const filter = {
    createdBy: req.user._id,
  };

  if (req.query.category) {
    filter.category = req.query.category;
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  const questions = await Question.find(filter)
    .sort({ createdAt: -1 });

  res.status(200).json(questions);
});

// ======================================================
// CREATE QUESTION
// POST /api/questions
// PRIVATE
// ======================================================

const createQuestion = asyncHandler(async (req, res) => {
  const {
    text,
    category,
    type,
    options,
  } = req.body;

  // ------------------------------------------
  // Question text validation
  // ------------------------------------------

  if (!text || !text.trim()) {
    res.status(400);
    throw new Error('Question text is required');
  }

  // ------------------------------------------
  // Question type
  // ------------------------------------------

  const questionType = type || 'Paragraph';

  const allowedTypes = [
    'MCQ',
    'Paragraph',
    'Voice',
  ];

  if (!allowedTypes.includes(questionType)) {
    res.status(400);
    throw new Error('Invalid question type');
  }

  // ------------------------------------------
  // Options
  // ------------------------------------------

  let questionOptions = [];

  if (questionType === 'MCQ') {
    questionOptions = Array.isArray(options)
      ? options
          .map((option) => String(option).trim())
          .filter(Boolean)
      : [];

    if (questionOptions.length < 2) {
      res.status(400);
      throw new Error(
        'MCQ questions must have at least 2 options'
      );
    }
  }

  // ------------------------------------------
  // Create question
  // ------------------------------------------

  const question = await Question.create({
    text: text.trim(),

    category: category || 'General',

    type: questionType,

    options: questionOptions,

    createdBy: req.user._id,
  });

  res.status(201).json(question);
});

// ======================================================
// DELETE QUESTION
// DELETE /api/questions/:id
// PRIVATE
// ======================================================

const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user._id,
  });

  if (!question) {
    res.status(404);
    throw new Error('Question not found');
  }

  res.status(200).json({
    id: req.params.id,
    deleted: true,
  });
});

module.exports = {
  listQuestions,
  createQuestion,
  deleteQuestion,
};