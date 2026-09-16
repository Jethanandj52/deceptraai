const Sentiment = require('sentiment');

const sentiment = new Sentiment();

/**
 * Text analysis service
 * -----------------------
 * Mirrors the "TextBlob + linguistic analysis" pipeline described in the
 * project proposal: sentiment polarity plus classic deception-linguistics
 * cues — negation density, scarcity of first-person pronouns, and filler
 * words — computed directly from the statement text (real NLP, not a
 * placeholder).
 */

const NEGATIONS = ["n't", 'not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nowhere'];
const FIRST_PERSON = ['i', 'me', 'my', 'mine', 'myself'];
const FILLERS = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'honestly', 'literally', 'sort of', 'kind of'];

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function countOccurrences(tokens, list) {
  return tokens.filter((t) => list.includes(t)).length;
}

function countPhrases(lowerText, phrases) {
  return phrases.reduce((acc, phrase) => {
    const matches = lowerText.match(new RegExp(`\\b${phrase}\\b`, 'g'));
    return acc + (matches ? matches.length : 0);
  }, 0);
}

/** Extracts raw linguistic features from a statement. */
function computeTextFeatures(statement) {
  const clean = statement.trim();
  const lower = clean.toLowerCase();
  const tokens = tokenize(clean);
  const wordCount = tokens.length || 1;

  const { score, comparative } = sentiment.analyze(clean);
  const negationCount = countOccurrences(tokens, NEGATIONS);
  const firstPersonCount = countOccurrences(tokens, FIRST_PERSON);
  const fillerCount = countPhrases(lower, FILLERS);

  return {
    wordCount,
    sentimentScore: score,
    sentimentComparative: Number(comparative.toFixed(4)),
    negationDensity: Number((negationCount / wordCount).toFixed(4)),
    firstPersonRatio: Number((firstPersonCount / wordCount).toFixed(4)),
    fillerDensity: Number((fillerCount / wordCount).toFixed(4)),
  };
}

function normalize(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/**
 * Turns linguistic features into a 0-100 deception score.
 * Deception-linguistics research (see literature review) associates lying
 * with MORE negations/fillers and FEWER first-person pronouns — so a low
 * `firstPersonRatio` pushes the score up, not down.
 */
function scoreFromFeatures(features) {
  const negationScore = normalize(features.negationDensity, 0.12);
  const fillerScore = normalize(features.fillerDensity, 0.1);
  const distancingScore = normalize(0.08 - features.firstPersonRatio, 0.08); // inverted
  const negativitySkew = features.sentimentComparative < 0 ? normalize(-features.sentimentComparative, 0.6) : 0;

  const score =
    negationScore * 0.35 + fillerScore * 0.25 + distancingScore * 0.25 + negativitySkew * 0.15;
  return Math.max(0, Math.min(100, score));
}

/** Public entry point used by the controller. */
function analyzeText(statement) {
  if (!statement || !statement.trim()) {
    throw new Error('No statement provided');
  }
  const features = computeTextFeatures(statement);
  const textScore = Number(scoreFromFeatures(features).toFixed(2));
  return { textScore, features };
}

module.exports = { analyzeText, computeTextFeatures, scoreFromFeatures };
