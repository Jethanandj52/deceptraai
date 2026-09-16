const os = require('os');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const wav = require('node-wav');

/**
 * Voice analysis service
 * -----------------------
 * Browsers record audio as webm/ogg (Opus), not WAV, regardless of what
 * Blob `type` the frontend sets on it. To get real PCM samples we can run
 * signal-processing on, we transcode whatever the client sends to a mono
 * 16kHz WAV file using ffmpeg, then decode it with `node-wav`.
 *
 * If ffmpeg is not installed on the host (FFMPEG_AVAILABLE=false), we fall
 * back to a coarse byte-statistics heuristic on the raw upload — clearly
 * lower fidelity, but keeps the endpoint functional without a system
 * dependency. Install ffmpeg and set FFMPEG_AVAILABLE=true for accurate
 * pitch/energy features.
 */

const TMP_DIR = os.tmpdir();

function ffmpegAvailable() {
  return String(process.env.FFMPEG_AVAILABLE).toLowerCase() === 'true';
}

/** Transcodes an in-memory audio buffer to mono 16kHz WAV on disk, returns the WAV path. */
function transcodeToWav(buffer) {
  return new Promise((resolve, reject) => {
    const inPath = path.join(TMP_DIR, `deceptra-in-${randomUUID()}`);
    const outPath = path.join(TMP_DIR, `deceptra-out-${randomUUID()}.wav`);
    fs.writeFileSync(inPath, buffer);

    ffmpeg(inPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .on('error', (err) => {
        cleanup([inPath, outPath]);
        reject(err);
      })
      .on('end', () => {
        cleanup([inPath]);
        resolve(outPath);
      })
      .save(outPath);
  });
}

function cleanup(paths) {
  for (const p of paths) {
    fs.unlink(p, () => {});
  }
}

/** Root-mean-square energy per frame. */
function frameRMS(samples, frameSize) {
  const rms = [];
  for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
    let sumSq = 0;
    for (let j = 0; j < frameSize; j++) sumSq += samples[i + j] * samples[i + j];
    rms.push(Math.sqrt(sumSq / frameSize));
  }
  return rms;
}

/** Zero-crossing rate per frame — a rough proxy for pitch/voicing changes. */
function frameZCR(samples, frameSize) {
  const zcr = [];
  for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
    let crossings = 0;
    for (let j = 1; j < frameSize; j++) {
      if ((samples[i + j - 1] >= 0) !== (samples[i + j] >= 0)) crossings += 1;
    }
    zcr.push(crossings / frameSize);
  }
  return zcr;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function stdDev(arr) {
  const m = mean(arr);
  return arr.length ? Math.sqrt(mean(arr.map((v) => (v - m) ** 2))) : 0;
}

/** Extracts real DSP features from decoded PCM samples. */
function computeFeaturesFromSamples(samples, sampleRate) {
  const frameSize = Math.round(sampleRate * 0.03); // ~30ms frames
  const rms = frameRMS(samples, frameSize);
  const zcr = frameZCR(samples, frameSize);

  return {
    durationSec: Number((samples.length / sampleRate).toFixed(2)),
    meanEnergy: Number(mean(rms).toFixed(5)),
    energyVariance: Number(stdDev(rms).toFixed(5)),
    meanZcr: Number(mean(zcr).toFixed(5)),
    zcrVariance: Number(stdDev(zcr).toFixed(5)),
  };
}

/** Low-fidelity fallback used only when ffmpeg is unavailable on the host. */
function computeFeaturesFromRawBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  const n = Math.min(bytes.length, 200000);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    sum += bytes[i];
    sumSq += bytes[i] * bytes[i];
  }
  const mean_ = sum / n;
  const variance = sumSq / n - mean_ * mean_;

  return {
    durationSec: null,
    meanEnergy: Number((mean_ / 255).toFixed(5)),
    energyVariance: Number((Math.sqrt(Math.max(variance, 0)) / 255).toFixed(5)),
    meanZcr: null,
    zcrVariance: null,
    fallback: true,
  };
}

function normalize(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Turns DSP features into a 0-100 deception score. Higher stress-variance → higher score. */
function scoreFromFeatures(features) {
  if (features.fallback) {
    const energyScore = normalize(features.energyVariance, 0.25);
    return Math.max(0, Math.min(100, energyScore));
  }

  const energyVarScore = normalize(features.energyVariance, 0.08);
  const zcrVarScore = normalize(features.zcrVariance, 0.05);
  const meanEnergyScore = normalize(features.meanEnergy, 0.3);

  // High variance in energy/ZCR (shaky, inconsistent delivery) and elevated
  // mean energy (louder/tenser voice) both push the score up.
  const score = energyVarScore * 0.45 + zcrVarScore * 0.35 + meanEnergyScore * 0.2;
  return Math.max(0, Math.min(100, score));
}

/** Public entry point used by the controller. `fileBuffer` is the raw upload from multer. */
async function analyzeVoice(fileBuffer) {
  if (!fileBuffer || !fileBuffer.length) {
    throw new Error('No audio file provided');
  }

  if (!ffmpegAvailable()) {
    const features = computeFeaturesFromRawBytes(fileBuffer);
    const voiceScore = Number(scoreFromFeatures(features).toFixed(2));
    return { voiceScore, features };
  }

  let wavPath;
  try {
    wavPath = await transcodeToWav(fileBuffer);
    const wavBuffer = fs.readFileSync(wavPath);
    const decoded = wav.decode(wavBuffer);
    const samples = decoded.channelData[0];
    const features = computeFeaturesFromSamples(samples, decoded.sampleRate);
    const voiceScore = Number(scoreFromFeatures(features).toFixed(2));
    return { voiceScore, features };
  } catch (err) {
    // Transcode/decoding failed (e.g. ffmpeg missing at runtime) — fall back gracefully.
    const features = computeFeaturesFromRawBytes(fileBuffer);
    const voiceScore = Number(scoreFromFeatures(features).toFixed(2));
    return { voiceScore, features };
  } finally {
    if (wavPath) cleanup([wavPath]);
  }
}

module.exports = { analyzeVoice, computeFeaturesFromSamples, scoreFromFeatures };
