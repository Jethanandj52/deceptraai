const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGO_URI from the environment.
 * Exits the process if the connection fails, since the API is unusable without a DB.
 */
async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/deceptra';
    const conn = await mongoose.connect(uri);
    console.log(`[mongo] connected → ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[mongo] connection error: ${err.message}`);
    process.exit(1);
  }
}

module.exports = connectDB;
