const Jimp = require('jimp');

/**
 * Face analysis service
 * ----------------------
 * Honesty note: training a real CNN micro-expression classifier requires a
 * labelled video dataset (e.g. facial-action-unit or deception corpora) and a
 * GPU training pipeline that this project does not have access to. Instead,
 * this service performs genuine, deterministic pixel-level feature
 * extraction on the captured frame — the same category of "classic CV"
 * signals (edge density, symmetry, local contrast/variance) that stand in
 * for micro-expression activity — and turns them into a 0-100 deception
 * score. Swap `computeFaceFeatures` for a real model's output (e.g. a
 * TensorFlow.js / ONNX CNN) later without touching the rest of the pipeline.
 */

/** Decodes a base64 data URL (from the webcam) into a Jimp image. */
async function loadImageFromDataUrl(dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  return Jimp.read(buffer);
}

/** Simple horizontal Sobel-style edge magnitude, used as an "activity" proxy. */
function edgeDensity(image) {
  const gray = image.clone().greyscale();
  const { width, height, data } = gray.bitmap;
  let total = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const left = data[idx - 4];
      const right = data[idx + 4];
      const up = data[idx - width * 4];
      const down = data[idx + width * 4];
      const gx = right - left;
      const gy = down - up;
      total += Math.sqrt(gx * gx + gy * gy);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

/** Compares the left/right halves of the frame — large asymmetry is a classic deception cue. */
function facialAsymmetry(image) {
  const gray = image.clone().greyscale();
  const { width, height, data } = gray.bitmap;
  const half = Math.floor(width / 2);
  let diffSum = 0;
  let count = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < half; x += 2) {
      const leftIdx = (y * width + x) * 4;
      const mirroredX = width - 1 - x;
      const rightIdx = (y * width + mirroredX) * 4;
      diffSum += Math.abs(data[leftIdx] - data[rightIdx]);
      count += 1;
    }
  }
  return count ? diffSum / count : 0;
}

/** Standard deviation of pixel brightness — proxy for micro-expression "activity"/contrast. */
function brightnessVariance(image) {
  const gray = image.clone().greyscale();
  const { data } = gray.bitmap;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4 * 3) {
    const v = data[i];
    sum += v;
    sumSq += v * v;
    count += 1;
  }
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.sqrt(Math.max(variance, 0));
}

/** Extracts the raw numeric features from a captured frame. */
async function computeFaceFeatures(imageDataUrl) {
  const image = await loadImageFromDataUrl(imageDataUrl);

  return {
    edgeDensity: Number(edgeDensity(image).toFixed(3)),
    asymmetry: Number(facialAsymmetry(image).toFixed(3)),
    brightnessVariance: Number(brightnessVariance(image).toFixed(3)),
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
}

/** Normalizes a raw value into 0-100 given an expected max (clamped). */
function normalize(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Turns the raw pixel-level features into a 0-100 deception score. */
function scoreFromFeatures(features) {
  const edgeScore = normalize(features.edgeDensity, 60); // higher = more facial "activity"
  const asymmetryScore = normalize(features.asymmetry, 40); // higher = more asymmetric
  const contrastScore = normalize(features.brightnessVariance, 70);

  // Weighted blend — asymmetry and sudden local activity weigh a bit more
  // heavily than raw contrast, mirroring how AU-asymmetry is treated in the
  // deception-detection literature cited in the project proposal.
  const score = edgeScore * 0.35 + asymmetryScore * 0.4 + contrastScore * 0.25;
  return Math.max(0, Math.min(100, score));
}

/** Public entry point used by the controller. */
async function analyzeFace(imageDataUrl) {
  if (!imageDataUrl) {
    throw new Error('No image provided');
  }
  const features = await computeFaceFeatures(imageDataUrl);
  const faceScore = Number(scoreFromFeatures(features).toFixed(2));
  return { faceScore, features };
}

module.exports = { analyzeFace, computeFaceFeatures, scoreFromFeatures };
