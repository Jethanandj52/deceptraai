const express = require('express');

const {
  listQuestions,
  createQuestion,
  deleteQuestion,
} = require('../controllers/questionController');

const {
  protect,
} = require('../middleware/auth');

const router = express.Router();

// All question routes require authentication
router.use(protect);

router.get('/', listQuestions);

router.post('/', createQuestion);

router.delete('/:id', deleteQuestion);

module.exports = router;