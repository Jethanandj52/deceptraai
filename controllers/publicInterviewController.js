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

async function getAuthenticatedInterview(req, res) {
  if (!req.session || !req.session.interviewId) {
    res.status(401);

    throw new Error(
      'Please verify your email first'
    );
  }

  console.log(
    '[PUBLIC INTERVIEW] Session interviewId:',
    req.session.interviewId
  );

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

  console.log(
    '[PUBLIC INTERVIEW] Loaded interview:',
    interview._id.toString(),
    '| status:',
    interview.status,
    '| linkStatus:',
    interview.linkStatus,
    '| answers:',
    interview.answers.length
  );

  // ==========================================
  // Check interview expiry
  // ==========================================

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


    // ==========================================
    // Find candidate
    // ==========================================

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


    // ==========================================
    // Find latest active interview
    // ==========================================

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


    // ==========================================
    // Check interview expiry
    // ==========================================

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


    // ==========================================
    // Generate 6 digit verification code
    // ==========================================

    const verificationCode =
      Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();


    // ==========================================
    // Save verification code
    // ==========================================

    interview.verificationCode =
      verificationCode;

    interview.verificationCodeExpiresAt =
      new Date(
        Date.now() +
        10 * 60 * 1000
      );


    await interview.save();


    // ==========================================
    // Send verification email
    // ==========================================

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


    // ==========================================
    // Find candidate
    // ==========================================

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


    // ==========================================
    // Find interview
    // ==========================================

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


    // ==========================================
    // Check code expiry
    // ==========================================

    if (
      !interview.verificationCodeExpiresAt ||
      interview.verificationCodeExpiresAt < new Date()
    ) {
      res.status(410);

      throw new Error(
        'Verification code has expired'
      );
    }


    // ==========================================
    // Check completed interview
    // ==========================================

    if (
      interview.status === 'Completed'
    ) {
      res.status(409);

      throw new Error(
        'This interview has already been completed'
      );
    }


    // ==========================================
    // Save interview in session
    // ==========================================

    req.session.interviewId =
      interview._id.toString();

    req.session.candidateId =
      candidate._id.toString();


    console.log(
      '[VERIFY] Session interviewId set to:',
      req.session.interviewId
    );


    // ==========================================
    // Remove used verification code
    // ==========================================

    interview.verificationCode = null;

    interview.verificationCodeExpiresAt = null;

    await interview.save();


    // ==========================================
    // Explicitly save session
    // ==========================================

    req.session.save((err) => {
      if (err) {
        console.error(
          '[VERIFY] Session save error:',
          err
        );

        return res.status(500).json({
          message:
            'Failed to create interview session',
        });
      }

      console.log(
        '[VERIFY] Session saved successfully'
      );

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
// POST /interview/start
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


    // ==========================================
    // Set interview status
    // ==========================================

    interview.status =
      'InProgress';


    interview.linkStatus =
      interview.linkStatus === 'Active'
        ? 'Opened'
        : 'InProgress';


    await interview.save();


    console.log(
      '[START] Interview:',
      interview._id.toString(),
      '| status:',
      interview.status,
      '| linkStatus:',
      interview.linkStatus
    );


    // ==========================================
    // Prepare questions
    // ==========================================

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
// POST /interview/answer
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


    // ==========================================
    // Find question
    // ==========================================

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


    // ==========================================
    // Face Analysis
    // ==========================================

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


    // ==========================================
    // Voice Analysis
    // ==========================================

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


    // ==========================================
    // Text Analysis
    // ==========================================

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


    // ==========================================
    // Fusion
    // ==========================================

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


    // ==========================================
    // Remove previous answer
    // ==========================================

    interview.answers =
      interview.answers.filter(
        (a) =>
          a.questionIndex !== idx
      );


    // ==========================================
    // Save answer
    // ==========================================

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


    console.log(
      '[ANSWER] Interview:',
      interview._id.toString(),
      '| question:',
      idx,
      '| total answers:',
      interview.answers.length
    );


    res.json({
      received: true,

      questionIndex: idx,
    });
  });


// ==========================================
// POST /interview/complete
// ==========================================

const completeInterview =
  asyncHandler(async (req, res) => {
    const interview =
      await getAuthenticatedInterview(
        req,
        res
      );


    console.log(
      '[COMPLETE] Interview ID:',
      interview._id.toString()
    );

    console.log(
      '[COMPLETE] Status BEFORE:',
      interview.status
    );

    console.log(
      '[COMPLETE] LinkStatus BEFORE:',
      interview.linkStatus
    );

    console.log(
      '[COMPLETE] Answers BEFORE:',
      interview.answers.length
    );


    // ==========================================
    // Prevent empty submission
    // ==========================================

    if (
      !interview.answers.length
    ) {
      res.status(400);

      throw new Error(
        'Cannot complete an interview with no answered questions'
      );
    }


    // ==========================================
    // Calculate averages
    // ==========================================

    const avg = (key) =>
      interview.answers.reduce(
        (sum, answer) =>
          sum +
          Number(answer[key] || 0),

        0
      ) /
      interview.answers.length;


    // ==========================================
    // Final multimodal score
    // ==========================================

    const {
      finalScore,
    } = fuseScores(
      avg('faceScore'),

      avg('voiceScore'),

      avg('textScore')
    );


    // ==========================================
    // Update interview
    // ==========================================

    interview.overallScore =
      finalScore;

    interview.status =
      'Completed';

    interview.linkStatus =
      'Completed';

    interview.completedAt =
      new Date();


    // ==========================================
    // Save interview
    // ==========================================

    await interview.save();


    console.log(
      '[COMPLETE] Interview SAVED:',
      interview._id.toString()
    );

    console.log(
      '[COMPLETE] Status AFTER:',
      interview.status
    );

    console.log(
      '[COMPLETE] LinkStatus AFTER:',
      interview.linkStatus
    );

    console.log(
      '[COMPLETE] Answers AFTER:',
      interview.answers.length
    );

    console.log(
      '[COMPLETE] OverallScore:',
      interview.overallScore
    );

    console.log(
      '[COMPLETE] CompletedAt:',
      interview.completedAt
    );


    // ==========================================
    // VERIFY DATABASE SAVE
    // ==========================================

    const savedInterview =
      await Interview.findById(
        interview._id
      ).select(
        'status linkStatus completedAt overallScore answers'
      );


    console.log(
      '[COMPLETE] DATABASE VERIFY:',
      savedInterview
        ? {
            id:
              savedInterview._id.toString(),

            status:
              savedInterview.status,

            linkStatus:
              savedInterview.linkStatus,

            completedAt:
              savedInterview.completedAt,

            overallScore:
              savedInterview.overallScore,

            answers:
              savedInterview.answers.length,
          }
        : 'Interview not found after save'
    );


    // ==========================================
    // Destroy interview session
    // ==========================================

    req.session.destroy(
      (err) => {
        if (err) {
          console.error(
            '[COMPLETE] Session destroy error:',
            err
          );
        } else {
          console.log(
            '[COMPLETE] Interview session destroyed'
          );
        }
      }
    );


    // ==========================================
    // Response
    // ==========================================

    res.json({
      completed: true,

      interviewId:
        interview._id.toString(),

      status:
        interview.status,

      overallScore:
        interview.overallScore,
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