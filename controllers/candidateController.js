const asyncHandler = require('express-async-handler');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');

// @desc   List all candidates created by the logged-in recruiter
// @route  GET /api/candidates
// @access Private
const listCandidates = asyncHandler(async (req, res) => {
  const candidates = await Candidate.find({ createdBy: req.user._id }).sort({ createdAt: -1 });

  // Attach a quick interview count + last interview date for the table view.
  const withStats = await Promise.all(
    candidates.map(async (c) => {
      const interviews = await Interview.find({ candidate: c._id }).sort({ createdAt: -1 }).limit(1);
      const count = await Interview.countDocuments({ candidate: c._id });
      return {
        ...c.toObject(),
        interviewCount: count,
        lastInterviewDate: interviews[0]?.createdAt || null,
      };
    })
  );

  res.json(withStats);
});

// @desc   Create a candidate
// @route  POST /api/candidates
// @access Private
const createCandidate = asyncHandler(async (req, res) => {
  const { name, email, position, experience, notes } = req.body;

  if (!name || !email || !position) {
    res.status(400);
    throw new Error('name, email, and position are required');
  }

  const candidate = await Candidate.create({
    name,
    email,
    position,
    experience,
    notes,
    createdBy: req.user._id,
  });

  res.status(201).json(candidate);
});

// @desc   Get one candidate + their interview history
// @route  GET /api/candidates/:id
// @access Private
const getCandidate = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!candidate) {
    res.status(404);
    throw new Error('Candidate not found');
  }

  const interviews = await Interview.find({ candidate: candidate._id })
    .sort({ createdAt: -1 })
    .select('position type status overallScore createdAt completedAt linkToken');

  res.json({ candidate, interviews });
});

module.exports = { listCandidates, createCandidate, getCandidate };
