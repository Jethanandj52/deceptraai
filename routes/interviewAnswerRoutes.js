const express = require('express');

const {
  submitAnswer,
} = require(
  '../controllers/interviewAnswerController'
);

const uploadAudio = require(
  '../middleware/uploadAudio'
);

const router = express.Router();

// ======================================================
// Submit answer
// ======================================================

router.post(
  '/:interviewId/answers',

  uploadAudio.single('audio'),

  submitAnswer
);

module.exports = router;