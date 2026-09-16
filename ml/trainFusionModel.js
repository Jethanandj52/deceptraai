/**
 * ml/trainFusionModel.js
 * ------------------------
 * Trains the fusion layer that combines the three modality scores
 * (face/voice/text, each 0-100) into a single deception probability.
 *
 * HONESTY NOTE (please read before treating this as a finished FYP result):
 * A real deception-detection fusion model should be trained on a labelled
 * multimodal corpus (e.g. the MDPE dataset referenced in your literature
 * review). No such dataset is available in this environment, and your
 * proposal itself lists "data scarcity" as a known risk (§3.4). To still
 * ship a genuinely *trained* (not hand-picked) fusion layer, this script:
 *
 *   1. Generates a synthetic training set using the same relative modality
 *      importance your proposal specifies (face 40% / voice 35% / text 25%)
 *      plus Gaussian noise, so the "ground truth" labels are not literally
 *      hand-coded to a fixed formula.
 *   2. Trains a real logistic-regression classifier on that data with
 *      batch gradient descent (no shortcuts — see `trainLogReg` below).
 *   3. Saves the learned weights to `ml/model.json`, which `fusionService.js`
 *      loads at request time.
 *
 * Replace `generateSyntheticDataset()` with a loader for a real, labelled
 * dataset (CSV/DB of face/voice/text scores + ground-truth verdicts) as soon
 * as you collect one — the training loop itself does not need to change.
 *
 * Run with: npm run train
 */
const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.join(__dirname, 'model.json');

function randn() {
  // Box-Muller transform for a standard normal sample.
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Builds a synthetic (score, label) dataset reflecting the proposal's stated modality weights. */
function generateSyntheticDataset(n = 6000) {
  const trueWeights = { face: 0.4, voice: 0.35, text: 0.25 };
  const rows = [];

  for (let i = 0; i < n; i++) {
    const face = Math.min(100, Math.max(0, 50 + randn() * 25));
    const voice = Math.min(100, Math.max(0, 50 + randn() * 25));
    const text = Math.min(100, Math.max(0, 50 + randn() * 25));

    const latent =
      trueWeights.face * (face / 100) +
      trueWeights.voice * (voice / 100) +
      trueWeights.text * (text / 100) +
      randn() * 0.08; // measurement noise

    const label = latent > 0.5 ? 1 : 0; // 1 = Deceptive
    rows.push({ x: [face / 100, voice / 100, text / 100], y: label });
  }
  return rows;
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/** Plain batch-gradient-descent logistic regression — genuinely trained, no closed-form shortcut. */
function trainLogReg(data, { epochs = 300, lr = 0.5, l2 = 0.001 } = {}) {
  let w = [0, 0, 0];
  let b = 0;
  const n = data.length;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gw = [0, 0, 0];
    let gb = 0;
    let loss = 0;

    for (const { x, y } of data) {
      const z = w[0] * x[0] + w[1] * x[1] + w[2] * x[2] + b;
      const pred = sigmoid(z);
      const err = pred - y;

      gw[0] += err * x[0];
      gw[1] += err * x[1];
      gw[2] += err * x[2];
      gb += err;

      const eps = 1e-9;
      loss += -(y * Math.log(pred + eps) + (1 - y) * Math.log(1 - pred + eps));
    }

    for (let k = 0; k < 3; k++) {
      w[k] -= lr * (gw[k] / n + l2 * w[k]);
    }
    b -= lr * (gb / n);

    if (epoch % 50 === 0 || epoch === epochs - 1) {
      console.log(`[train] epoch ${epoch}  loss=${(loss / n).toFixed(4)}  w=${w.map((v) => v.toFixed(3))}  b=${b.toFixed(3)}`);
    }
  }

  return { w, b };
}

function evaluate(model, data) {
  let correct = 0;
  for (const { x, y } of data) {
    const z = model.w[0] * x[0] + model.w[1] * x[1] + model.w[2] * x[2] + model.b;
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === y) correct += 1;
  }
  return correct / data.length;
}

function main() {
  console.log('[train] generating synthetic dataset...');
  const dataset = generateSyntheticDataset(6000);
  const splitIdx = Math.floor(dataset.length * 0.85);
  const trainSet = dataset.slice(0, splitIdx);
  const testSet = dataset.slice(splitIdx);

  console.log(`[train] training logistic regression on ${trainSet.length} samples...`);
  const model = trainLogReg(trainSet);

  const acc = evaluate(model, testSet);
  console.log(`[train] hold-out accuracy: ${(acc * 100).toFixed(2)}%`);

  const output = {
    type: 'logistic_regression_fusion',
    features: ['faceScore(0-1)', 'voiceScore(0-1)', 'textScore(0-1)'],
    weights: model.w,
    bias: model.b,
    trainedAt: new Date().toISOString(),
    trainedOn: 'synthetic-dataset-v1 (see ml/trainFusionModel.js header comment)',
    holdoutAccuracy: Number(acc.toFixed(4)),
  };

  fs.writeFileSync(MODEL_PATH, JSON.stringify(output, null, 2));
  console.log(`[train] saved model → ${MODEL_PATH}`);
}

if (require.main === module) {
  main();
}

module.exports = { generateSyntheticDataset, trainLogReg, sigmoid };
