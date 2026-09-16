const multer = require('multer');

// Keep uploads in memory — files are small (single audio clips) and processed
// immediately, so there is no need to persist them to disk.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB safety cap for the audio file
    fieldSize: 8 * 1024 * 1024, // 8MB — base64 webcam frames are sent as a text field, not a file
  },
});

module.exports = upload;
