const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Format log
const { combine, timestamp, printf, colorize, align } = winston.format;

// Custom format untuk log
const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

const transports = [];
const exceptionHandlers = [];
const rejectionHandlers = [];

// Determine environment
const isVercel = process.env.VERCEL === '1';

// Always add Console transport (Important for Vercel logs)
transports.push(new winston.transports.Console({
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    logFormat
  )
}));

// Only add File transports if NOT on Vercel (read-only filesystem)
if (!isVercel) {
  const logDir = 'logs';
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    transports.push(new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }));
    transports.push(new winston.transports.File({ filename: path.join(logDir, 'combined.log') }));

    exceptionHandlers.push(new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }));
    rejectionHandlers.push(new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }));
  } catch (err) {
    console.error('Failed to setup file logging:', err.message);
  }
}

// Konfigurasi logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    logFormat
  ),
  transports: transports,
  exceptionHandlers: exceptionHandlers,
  rejectionHandlers: rejectionHandlers
});

module.exports = logger;