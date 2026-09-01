/**
 * EHAS Session Configuration
 * Session secret read from environment variable.
 */

require('dotenv').config();

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'ehas-default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

module.exports = sessionConfig;
