const asyncHandler = require('express-async-handler');

const Interview = require('../models/Interview');

const Candidate = require('../models/Candidate');

const {
  sendVerificationCodeEmail,
} = require('../services/emailService');

const {
  analyzeFace,
} = require('../services/faceService');

const {
  analyzeVoice,
} = require('../services/voiceService');

const {
  analyzeText,
} = require('../services/textService');

const {
  fuseScores,
} = require('../services/fusionService');


// ==========================================
// Get authenticated interview from session
// ==========================================

async function getAuthenticatedInterview(
  req,
  res
) {
  if (!req.session || !req.session.interviewId) {
    res.status(401);

    throw new Error(
      'Please verify your email first'
    );
  }

  const interview =
    await Interview.findById(
      req.session.interviewId
    ).populate(
      'candidate',
      'name email position'
    );

  if (!interview) {
    res.status(404);

    throw new Error(
      'Interview not found'
    );
  }

  // Check interview expiry

  if (
    interview.linkExpiresAt &&
    interview.linkExpiresAt < new Date() &&
    interview.status !== 'Completed'
  ) {
    interview.status = 'Expired';

    interview.linkStatus = 'Expired';

    await interview.save();

    res.status(410);

    throw new Error(
      'This interview has expired'
    );
  }

  return interview;
}


// ==========================================
// GET /interview
// ==========================================

const getInvitation =
  asyncHandler(async (req, res) => {
    res.json({
      available: true,

      message:
        'Please enter your email to continue',
    });
  });


// ==========================================
// POST /interview/send-code
// ==========================================

const sendVerificationCode =
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      res.status(400);

      throw new Error(
        'Email is required'
      );
    }

    const normalizedEmail =
      email.trim().toLowerCase();


    // Find candidate by email

    const candidate =
      await Candidate.findOne({
        email: normalizedEmail,
      });

    if (!candidate) {
      res.status(404);

      throw new Error(
        'No candidate found with this email'
      );
    }


    // Find latest active interview

    const interview =
      await Interview.findOne({
        candidate: candidate._id,

        status: {
          $in: [
            'Pending',
            'InProgress',
          ],
        },
      }).sort({
        createdAt: -1,
      });


    if (!interview) {
      res.status(404);

      throw new Error(
        'No active interview found for this email'
      );
    }


    // Check interview expiry

    if (
      interview.linkExpiresAt &&
      interview.linkExpiresAt < new Date()
    ) {
      interview.status = 'Expired';

      interview.linkStatus = 'Expired';

      await interview.save();

      res.status(410);

      throw new Error(
        'This interview has expired'
      );
    }


    // Generate 6 digit verification code

    const verificationCode =
      Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();


    // Save code

    interview.verificationCode =
      verificationCode;

    interview.verificationCodeExpiresAt =
      new Date(
        Date.now() +
        10 * 60 * 1000
      );


    await interview.save();


    // Send code to candidate email

    await sendVerificationCodeEmail({
      candidateName:
        candidate.name,

      candidateEmail:
        candidate.email,

      verificationCode,
    });


    res.json({
      success: true,

      message:
        'Verification code sent to your email',
    });
  });


// ==========================================
// POST /interview/verify
// ==========================================

const verifyCandidate =
  asyncHandler(async (req, res) => {
    const {
      email,
      verificationCode,
    } = req.body;

    if (!email || !verificationCode) {
      res.status(400);

      throw new Error(
        'Email and verification code are required'
      );
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Find candidate
    const candidate =
      await Candidate.findOne({
        email: normalizedEmail,
      });

    if (!candidate) {
      res.status(401);

      throw new Error(
        'Invalid email or verification code'
      );
    }

    // Find interview using candidate + code
    const interview =
      await Interview.findOne({
        candidate: candidate._id,
        verificationCode:
          verificationCode.trim(),
      }).populate(
        'candidate',
        'name email position'
      );

    if (!interview) {
      res.status(401);

      throw new Error(
        'Invalid verification code'
      );
    }

    // Check code expiry
    if (
      !interview.verificationCodeExpiresAt ||
      interview.verificationCodeExpiresAt < new Date()
    ) {
      res.status(410);

      throw new Error(
        'Verification code has expired'
      );
    }

    // Check completed interview
    if (interview.status === 'Completed') {
      res.status(409);

      throw new Error(
        'This interview has already been completed'
      );
    }

    // ==========================================
    // SAVE INTERVIEW IN SESSION
    // ==========================================

    req.session.interviewId =
      interview._id.toString();

    req.session.candidateId =
      candidate._id.toString();

    // Remove used verification code
    interview.verificationCode = null;

    interview.verificationCodeExpiresAt = null;

    await interview.save();

    // ==========================================
    // IMPORTANT:
    // Explicitly save session before response
    // ==========================================

    req.session.save((err) => {
      if (err) {
        console.error(
          'Session save error:',
          err
        );

        return res.status(500).json({
          message:
            'Failed to create interview session',
        });
      }

      return res.json({
        verified: true,

        candidateName:
          interview.candidate.name,

        position:
          interview.position,
      });
    });
  });

// ==========================================
// Start interview
// ==========================================

const startInterview =
  asyncHandler(async (req, res) => {
    const interview =
      await getAuthenticatedInterview(
        req,
        res
      );


    if (
      interview.status === 'Completed'
    ) {
      res.status(409);

      throw new Error(
        'This interview has already been completed'
      );
    }


    if (
      interview.status === 'Expired'
    ) {
      res.status(410);

      throw new Error(
        'This interview has expired'
      );
    }


    interview.status =
      'InProgress';


    interview.linkStatus =
      interview.linkStatus === 'Active'
        ? 'Opened'
        : 'InProgress';


    await interview.save();


    const questions =
      interview.questions
        .sort(
          (a, b) =>
            a.order - b.order
        )
        .map((q) => ({
          index: q.order,

          text: q.text,

          type:
            q.type ||
            'Paragraph',

          options:
            q.options || [],
        }));


    res.json({
      questions,

      durationMinutes:
        interview.settings
          .durationMinutes,
    });
  });


// ==========================================
// Submit answer
// ==========================================

const submitAnswer =
  asyncHandler(async (req, res) => {
    const interview =
      await getAuthenticatedInterview(
        req,
        res
      );


    if (
      interview.status !==
      'InProgress'
    ) {
      res.status(409);

      throw new Error(
        'Interview is not currently in progress'
      );
    }


    const {
      questionIndex,
      image,
      transcript,
      answer,
      selectedOption,
    } = req.body;


    const idx =
      Number(questionIndex);


    const question =
      interview.questions.find(
        (q) =>
          q.order === idx
      );


    if (!question) {
      res.status(400);

      throw new Error(
        'Unknown questionIndex for this interview'
      );
    }


    const {
      faceAnalysis,
      voiceAnalysis,
      textAnalysis,
    } = interview.settings;


    // Face

    let faceScore = 50;


    if (
      faceAnalysis &&
      image
    ) {
      const result =
        await analyzeFace(
          image
        );

      faceScore =
        result.faceScore;
    }


    // Voice

    let voiceScore = 50;


    if (
      voiceAnalysis &&
      req.file
    ) {
      const result =
        await analyzeVoice(
          req.file.buffer
        );

      voiceScore =
        result.voiceScore;
    }


    // Text

    const finalTranscript =
      transcript ||
      answer ||
      selectedOption ||
      '';


    let textScore = 50;


    if (
      textAnalysis &&
      finalTranscript.trim()
    ) {
      const result =
        analyzeText(
          finalTranscript
        );

      textScore =
        result.textScore;
    }


    // Fusion

    const {
      finalScore,
    } = fuseScores(
      faceScore,
      voiceScore,
      textScore
    );


    const flagged =
      faceScore > 70 ||
      voiceScore > 70 ||
      textScore > 70;


    // Replace existing answer

    interview.answers =
      interview.answers.filter(
        (a) =>
          a.questionIndex !== idx
      );


    // Save answer

    interview.answers.push({
      questionIndex: idx,

      questionText:
        question.text,

      questionType:
        question.type ||
        'Paragraph',

      answer:
        answer ||
        selectedOption ||
        transcript ||
        '',

      selectedOption:
        selectedOption ||
        '',

      transcript:
        transcript ||
        '',

      faceScore,

      voiceScore,

      textScore,

      combinedScore:
        finalScore,

      flagged,

      answeredAt:
        new Date(),
    });


    await interview.save();


    res.json({
      received: true,

      questionIndex: idx,
    });
  });


// ==========================================
// Complete interview
// ==========================================

const completeInterview =
  asyncHandler(async (req, res) => {
    const interview =
      await getAuthenticatedInterview(
        req,
        res
      );


    if (
      !interview.answers.length
    ) {
      res.status(400);

      throw new Error(
        'Cannot complete an interview with no answered questions'
      );
    }


    const avg = (key) =>
      interview.answers.reduce(
        (sum, answer) =>
          sum + answer[key],

        0
      ) /
      interview.answers.length;


    const {
      finalScore,
    } = fuseScores(
      avg('faceScore'),

      avg('voiceScore'),

      avg('textScore')
    );


    interview.overallScore =
      finalScore;


    interview.status =
      'Completed';


    interview.linkStatus =
      'Completed';


    interview.completedAt =
      new Date();


    await interview.save();


    // Destroy interview session

    req.session.destroy(
      (err) => {
        if (err) {
          console.error(
            'Session destroy error:',
            err
          );
        }
      }
    );


    res.json({
      completed: true,
    });
  });


module.exports = {
  getInvitation,

  sendVerificationCode,

  verifyCandidate,

  startInterview,

  submitAnswer,

  completeInterview,
};