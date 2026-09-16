const express = require('express');
const { listCandidates, createCandidate, getCandidate } = require('../controllers/candidateController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', listCandidates);
router.post('/', createCandidate);
router.get('/:id', getCandidate);

module.exports = router;
