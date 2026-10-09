require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;

async function start() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Set it in your environment or .env file.');
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`Library Catalog API listening on port ${port}.`);
  });
}

start().catch((error) => {
  console.error('API startup failed:', error);
  process.exitCode = 1;
});
