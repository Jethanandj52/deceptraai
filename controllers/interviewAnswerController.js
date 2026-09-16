const asyncHandler = require('express-async-handler');

const InterviewAnswer = require(
  '../models/InterviewAnswer'
);

const Interview = require(
  '../models/Interview'
);

const Question = require(
  '../models/Question'
);

// ======================================================
// SAVE MCQ / PARAGRAPH / VOICE ANSWER
// POST /api/public/interview/:interviewId/answers
// ======================================================

const submitAnswer = asyncHandler(async (req, res) => {
  const {
    interviewId,
  } = req.params;

  const {
    questionId,
    answerType,
    textAnswer,
    selectedOption,
    audioDuration,
  } = req.body;

  // ====================================================
  // Validate session
  // ====================================================

  if (!req.session.interviewId) {
    res.status(401);

    throw new Error(
      'Interview session is not active'
    );
  }

  if (
    String(req.session.interviewId) !==
    String(interviewId)
  ) {
    res.status(403);

    throw new Error(
      'Invalid interview session'
    );
  }

  // ====================================================
  // Validate question
  // ====================================================

  const question = await Question.findById(
    questionId
  );

  if (!question) {
    res.status(404);

    throw new Error(
      'Question not found'
    );
  }

  // ====================================================
  // Validate answer type
  // ====================================================

  const allowedTypes = [
    'MCQ',
    'Paragraph',
    'Voice',
  ];

  if (!allowedTypes.includes(answerType)) {
    res.status(400);

    throw new Error(
      'Invalid answer type'
    );
  }

  // ====================================================
  // Make sure answer type matches question type
  // ====================================================

  if (question.type !== answerType) {
    res.status(400);

    throw new Error(
      'Answer type does not match question type'
    );
  }

  // ====================================================
  // VOICE
  // ====================================================

  if (answerType === 'Voice') {
    if (!req.file) {
      res.status(400);

      throw new Error(
        'Voice recording is required'
      );
    }

    const audioUrl =
      `/uploads/interviews/${req.file.filename}`;

    const answer =
      await InterviewAnswer.findOneAndUpdate(
        {
          interviewId,
          questionId,
        },

        {
          interviewId,

          questionId,

          answerType: 'Voice',

          textAnswer: '',

          selectedOption: '',

          audioUrl,

          audioPath: req.file.path,

          audioMimeType:
            req.file.mimetype,

          audioDuration:
            Number(audioDuration) || 0,

          aiStatus: 'pending',
        },

        {
          new: true,
          upsert: true,
        }
      );

    return res.status(200).json({
      success: true,

      message:
        'Voice answer uploaded successfully',

      answer,
    });
  }

  // ====================================================
  // MCQ
  // ====================================================

  if (answerType === 'MCQ') {
    if (!selectedOption) {
      res.status(400);

      throw new Error(
        'Please select an option'
      );
    }

    const isValidOption =
      question.options.includes(
        selectedOption
      );

    if (!isValidOption) {
      res.status(400);

      throw new Error(
        'Invalid MCQ option'
      );
    }

    const answer =
      await InterviewAnswer.findOneAndUpdate(
        {
          interviewId,
          questionId,
        },

        {
          interviewId,

          questionId,

          answerType: 'MCQ',

          selectedOption,

          textAnswer: '',

          audioUrl: '',

          audioPath: '',

          audioMimeType: '',

          audioDuration: 0,

          aiStatus: 'pending',
        },

        {
          new: true,
          upsert: true,
        }
      );

    return res.status(200).json({
      success: true,

      message:
        'MCQ answer saved successfully',

      answer,
    });
  }

  // ====================================================
  // PARAGRAPH
  // ====================================================

  if (answerType === 'Paragraph') {
    if (
      !textAnswer ||
      !textAnswer.trim()
    ) {
      res.status(400);

      throw new Error(
        'Text answer is required'
      );
    }

    const answer =
      await InterviewAnswer.findOneAndUpdate(
        {
          interviewId,
          questionId,
        },

        {
          interviewId,

          questionId,

          answerType: 'Paragraph',

          textAnswer:
            textAnswer.trim(),

          selectedOption: '',

          audioUrl: '',

          audioPath: '',

          audioMimeType: '',

          audioDuration: 0,

          aiStatus: 'pending',
        },

        {
          new: true,
          upsert: true,
        }
      );

    return res.status(200).json({
      success: true,

      message:
        'Paragraph answer saved successfully',

      answer,
    });
  }
});

module.exports = {
  submitAnswer,
};