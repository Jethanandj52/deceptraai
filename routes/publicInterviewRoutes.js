const express = require('express');

const {
  getInvitation,

  sendVerificationCode,

  verifyCandidate,

  startInterview,

  submitAnswer,

  completeInterview,
} = require(
  '../controllers/publicInterviewController'
);

const upload =
  require('../middleware/upload');

const router =
  express.Router();


// Open interview page
router.get(
  '/',
  getInvitation
);


// Send verification code
router.post(
  '/send-code',
  sendVerificationCode
);


// Verify code
router.post(
  '/verify',
  verifyCandidate
);


// Start interview
router.post(
  '/start',
  startInterview
);


// Submit answer
router.post(
  '/answer',

  upload.single('audio'),

  submitAnswer
);


// Complete interview
router.post(
  '/complete',
  completeInterview
);


module.exports = router;