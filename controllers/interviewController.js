const asyncHandler = require('express-async-handler');
const crypto = require('crypto');

const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');

const {
  sendInterviewInvitation,
} = require('../services/emailService');

function generateLinkToken() {
  return crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase();
}

// @desc Create interview
// @route POST /api/interviews
// @access Private
const createInterview = asyncHandler(async (req, res) => {
  const {
    candidateId,
    position,
    type,
    questions,
    settings,
    expiresInDays,
  } = req.body;

  if (
    !candidateId ||
    !position ||
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    res.status(400);
    throw new Error(
      'candidateId, position, and at least one question are required'
    );
  }

  const candidate = await Candidate.findOne({
    _id: candidateId,
    createdBy: req.user._id,
  });

  if (!candidate) {
    res.status(404);
    throw new Error('Candidate not found');
  }

  const linkExpiresAt = new Date();

  linkExpiresAt.setDate(
    linkExpiresAt.getDate() +
      (Number(expiresInDays) || 2)
  );

  const interviewQuestions = questions.map(
    (question, index) => {
      // Backward compatibility:
      // If old frontend sends a string, still support it.
      if (typeof question === 'string') {
        return {
          text: question,
          type: 'Paragraph',
          options: [],
          order: index,
        };
      }

      return {
        text: question.text,
        type: question.type || 'Paragraph',
        options:
          question.type === 'MCQ'
            ? question.options || []
            : [],
        order: index,
      };
    }
  );

  const interview = await Interview.create({
    candidate: candidate._id,

    position,

    type: type || 'General',

    questions: interviewQuestions,

    settings: {
      cameraRequired:
        settings?.cameraRequired ?? true,

      micRequired:
        settings?.micRequired ?? true,

      fullscreenRequired:
        settings?.fullscreenRequired ?? false,

      faceAnalysis:
        settings?.faceAnalysis ?? true,

      voiceAnalysis:
        settings?.voiceAnalysis ?? true,

      textAnalysis:
        settings?.textAnalysis ?? true,

      autoRecording:
        settings?.autoRecording ?? true,

      durationMinutes:
        settings?.durationMinutes ?? 30,
    },

    linkToken: generateLinkToken(),

    linkExpiresAt,

    createdBy: req.user._id,
  });

  res.status(201).json(interview);
});

// @desc List interviews
// @route GET /api/interviews
// @access Private
const listInterviews = asyncHandler(async (req, res) => {
  const filter = {
    createdBy: req.user._id,
  };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const interviews = await Interview.find(filter)
    .sort({ createdAt: -1 })
    .populate(
      'candidate',
      'name email position'
    )
    .select('-answers');

  res.json(interviews);
});

// @desc Get interview
// @route GET /api/interviews/:id
// @access Private
const getInterview = asyncHandler(async (req, res) => {
  const interview =
    await Interview.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    }).populate(
      'candidate',
      'name email position experience'
    );

  if (!interview) {
    res.status(404);
    throw new Error('Interview not found');
  }

  res.json(interview);
});

// @desc Dashboard summary
// @route GET /api/interviews/stats/summary
// @access Private
const getDashboardStats = asyncHandler(async (req, res) => {
  const owner = {
    createdBy: req.user._id,
  };

  const [
    total,
    completed,
    pending,
    inProgress,
  ] = await Promise.all([
    Interview.countDocuments(owner),

    Interview.countDocuments({
      ...owner,
      status: 'Completed',
    }),

    Interview.countDocuments({
      ...owner,
      status: 'Pending',
    }),

    Interview.countDocuments({
      ...owner,
      status: 'InProgress',
    }),
  ]);

  const completedDocs =
    await Interview.find({
      ...owner,
      status: 'Completed',
    }).select('overallScore');

  const avgScore = completedDocs.length
    ? Math.round(
        completedDocs.reduce(
          (sum, d) =>
            sum + (d.overallScore || 0),
          0
        ) / completedDocs.length
      )
    : 0;

  res.json({
    totalInterviews: total,
    completed,
    pending,
    inProgress,
    avgAssessment: avgScore,
    completionRate: total
      ? Math.round(
          (completed / total) * 100
        )
      : 0,
  });
});

// @desc Chart data
// @route GET /api/interviews/stats/chart
// @access Private
const getInterviewsChart = asyncHandler(
  async (req, res) => {
    const days = Math.min(
      Number(req.query.days) || 7,
      90
    );

    const since = new Date();

    since.setDate(
      since.getDate() - (days - 1)
    );

    since.setHours(0, 0, 0, 0);

    const interviews =
      await Interview.find({
        createdBy: req.user._id,
        createdAt: {
          $gte: since,
        },
      }).select('createdAt');

    const buckets = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(since);

      d.setDate(
        d.getDate() + i
      );

      const key =
        d.toISOString().slice(0, 10);

      buckets[key] = 0;
    }

    interviews.forEach((iv) => {
      const key =
        iv.createdAt
          .toISOString()
          .slice(0, 10);

      if (key in buckets) {
        buckets[key] += 1;
      }
    });

    const data = Object.entries(
      buckets
    ).map(([date, count]) => ({
      date,
      count,
    }));

    res.json(data);
  }
);

// @desc Assessment distribution
// @route GET /api/interviews/stats/distribution
// @access Private
const getAssessmentDistribution =
  asyncHandler(async (req, res) => {
    const completed =
      await Interview.find({
        createdBy: req.user._id,
        status: 'Completed',
      }).select('overallScore');

    if (!completed.length) {
      return res.json({
        low: 0,
        moderate: 0,
        high: 0,
        total: 0,
      });
    }

    let low = 0;
    let moderate = 0;
    let high = 0;

    completed.forEach(
      ({ overallScore }) => {
        if (overallScore < 40) {
          low += 1;
        } else if (overallScore < 70) {
          moderate += 1;
        } else {
          high += 1;
        }
      }
    );

    const total = completed.length;

    res.json({
      low: Math.round(
        (low / total) * 100
      ),

      moderate: Math.round(
        (moderate / total) * 100
      ),

      high: Math.round(
        (high / total) * 100
      ),

      total,
    });
  });

// @desc Send interview invitation email
// @route POST /api/interviews/:id/send-email
// @access Private
const sendInterviewEmail =
  asyncHandler(async (req, res) => {
    const interview =
      await Interview.findOne({
        _id: req.params.id,
        createdBy: req.user._id,
      }).populate(
        'candidate',
        'name email position'
      );

    if (!interview) {
      res.status(404);
      throw new Error(
        'Interview not found'
      );
    }

    if (!interview.candidate?.email) {
      res.status(400);
      throw new Error(
        'Candidate email not found'
      );
    }

    const frontendUrl =
      process.env.CORS_ORIGIN ||
      'http://localhost:3000';

    const interviewLink =
      `${frontendUrl}/home`;

    await sendInterviewInvitation({
      candidateName:
        interview.candidate.name,

      candidateEmail:
        interview.candidate.email,

      position:
        interview.position,

      token:
        interview.linkToken,

      interviewLink,
    });

    res.json({
      success: true,
      message:
        `Interview invitation sent to ${interview.candidate.email}`,

      email:
        interview.candidate.email,
    });
  });

module.exports = {
  createInterview,
  listInterviews,
  getInterview,
  getDashboardStats,
  getInterviewsChart,
  getAssessmentDistribution,
  sendInterviewEmail,
};