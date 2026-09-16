const express = require('express');

const {
  createInterview,
  listInterviews,
  getInterview,
  getDashboardStats,
  getInterviewsChart,
  getAssessmentDistribution,
  sendInterviewEmail,
} = require('../controllers/interviewController');

const {
  protect,
} = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get(
  '/',
  listInterviews
);

router.post(
  '/',
  createInterview
);

router.get(
  '/stats/summary',
  getDashboardStats
);

router.get(
  '/stats/chart',
  getInterviewsChart
);

router.get(
  '/stats/distribution',
  getAssessmentDistribution
);

router.post(
  '/:id/send-email',
  sendInterviewEmail
);

router.get(
  '/:id',
  getInterview
);

module.exports = router;