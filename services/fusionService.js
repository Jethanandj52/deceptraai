const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, '..', 'ml', 'model.json');

// Fallback weights (matches the proposal's stated 40/35/25 split) used only
// if `npm run train` has not been run yet and ml/model.json doesn't exist.
const FALLBACK_MODEL = {
  type: 'fixed_weights_fallback',
  weights: [0.4, 0.35, 0.25],
  bias: -0.5,
};

function loadModel() {
  try {
    const raw = fs.readFileSync(MODEL_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return FALLBACK_MODEL;
  }
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function confidenceLabel(probability) {
  const distanceFromMid = Math.abs(probability - 0.5) * 2; // 0 (uncertain) → 1 (certain)
  if (distanceFromMid > 0.6) return 'High';
  if (distanceFromMid > 0.25) return 'Medium';
  return 'Low';
}

/**
 * Combines the three 0-100 modality scores into a final verdict using the
 * trained logistic-regression fusion model (see ml/trainFusionModel.js).
 */
function fuseScores(faceScore, voiceScore, textScore) {
  const model = loadModel();
  const [w1, w2, w3] = model.weights;
  const bias = model.bias ?? 0;

  const x1 = faceScore / 100;
  const x2 = voiceScore / 100;
  const x3 = textScore / 100;

  const z = w1 * x1 + w2 * x2 + w3 * x3 + bias;
  const probability = sigmoid(z);

  const finalScore = Number((probability * 100).toFixed(2));
  const result = probability >= 0.5 ? 'Deceptive' : 'Truthful';
  const confidence = confidenceLabel(probability);

  return {
    finalScore,
    result,
    confidence,
    modelType: model.type,
    modelWeights: { face: w1, voice: w2, text: w3, bias },
  };
}

module.exports = { fuseScores, loadModel };
