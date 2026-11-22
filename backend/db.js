// One shared MongoDB connection (reused between requests; in the cloud, between function calls).
const mongoose = require('mongoose');
const migrate = require('./services/migrate');

mongoose.set('strictQuery', true);
let pending = null;

module.exports = function connect() {
  if (!pending) {
    pending = mongoose
      .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agrihire', { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .then(() => migrate())
      .then(() => console.log('MongoDB connected'))
      .catch(err => { pending = null; throw err; });          // try again on the next request
  }
  return pending;
};
