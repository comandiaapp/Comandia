const path = require('path');

require('dotenv').config();

const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  brevoApiKey: process.env.BREVO_API_KEY,
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  mpAccessToken: process.env.MP_ACCESS_TOKEN,
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET,
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
};

module.exports = env;
