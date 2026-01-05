const Joi = require('joi');
const logger = require('./logger');

// Skema untuk validasi permintaan
const schemas = {
  // Validasi untuk login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  // Validasi untuk query parameter pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    size: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('artist', 'fan', 'all').optional()
  }),

  // Validasi untuk community ID
  communityId: Joi.object({
    communityId: Joi.string().required()
  }),

  // Validasi untuk post ID
  postId: Joi.object({
    postId: Joi.string().required()
  })
};

// Middleware untuk validasi request body
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({ error: error.details[0].message });
    }

    next();
  };
};

// Middleware untuk validasi request params
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);

    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({ error: error.details[0].message });
    }

    next();
  };
};

// Middleware untuk validasi request query
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);

    if (error) {
      logger.warn(`Validation error: ${error.details[0].message}`);
      return res.status(400).json({ error: error.details[0].message });
    }

    // Assign nilai yang sudah divalidasi dan default kembali ke req.query
    req.query = value;
    next();
  };
};

module.exports = {
  schemas,
  validateBody,
  validateParams,
  validateQuery
}; 