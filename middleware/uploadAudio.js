const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ======================================================
// Upload directory
// ======================================================

const uploadDir = path.join(
  __dirname,
  '..',
  'uploads',
  'interviews'
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ======================================================
// Storage
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname) || '.webm';

    const uniqueName =
      `voice-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${extension}`;

    cb(null, uniqueName);
  },
});

// ======================================================
// File filter
// ======================================================

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.mimetype.startsWith('audio/')
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Only audio files are allowed'
      ),
      false
    );
  }
};

// ======================================================
// Multer
// ======================================================

const uploadAudio = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

module.exports = uploadAudio;