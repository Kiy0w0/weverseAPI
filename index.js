require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger');

// Verifikasi variabel lingkungan dari .env
if (process.env.WEVERSE_EMAIL && process.env.WEVERSE_PASSWORD) {
  logger.info('Credentials found in environment variables');
} else {
  logger.warn('No credentials found in environment variables, checking .env file');
  try {
    const envPath = path.resolve(__dirname, '.env');
    const envExists = fs.existsSync(envPath);
    logger.info(`.env file ${envExists ? 'exists' : 'does not exist'} at ${envPath}`);
    if (envExists) {
      // Coba load ulang .env
      require('dotenv').config({ path: envPath });
    }

    // Jika masih tidak tersedia, gunakan nilai hardcoded untuk pengujian
    // Jika masih tidak tersedia, log peringatan
    if (!process.env.WEVERSE_EMAIL || !process.env.WEVERSE_PASSWORD) {
      logger.warn('WEVERSE_EMAIL or WEVERSE_PASSWORD not found. Authentication may fail.');
    }
  } catch (error) {
    logger.error(`Error checking .env file: ${error.message}`);
  }
}

const weverseClient = require('./lib/weverseClient');
const cache = require('./lib/cache');
const { schemas, validateBody, validateParams, validateQuery } = require('./lib/validator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(helmet());
app.use(cors());

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => process.env.NODE_ENV === 'development'
});

app.use('/api', limiter);

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  const start = new Date();

  res.on('finish', () => {
    const duration = new Date() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Swagger UI setup with CDN support for Vercel
if (fs.existsSync(path.join(__dirname, 'swagger.yaml'))) {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
  const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css";

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCssUrl: CSS_URL,
    customSiteTitle: "Weverse API Docs"
  }));
  logger.info('Swagger UI available at /api-docs');
}

// Authentication middleware
const checkAuth = (req, res, next) => {
  if (!weverseClient.token) {
    logger.warn('Unauthenticated request rejected');
    return res.status(401).json({ error: 'Not authenticated with Weverse' });
  }
  next();
};

// Cache middleware
const cacheMiddleware = (namespace) => {
  return (req, res, next) => {
    const key = cache.constructor.generateKey(
      namespace,
      `${req.originalUrl || req.url}`
    );

    const cachedData = cache.get(key);

    if (cachedData) {
      logger.debug(`Serving cached response for ${req.originalUrl}`);
      return res.json(cachedData);
    }

    // Override res.json to cache the response before sending
    const originalJson = res.json;
    res.json = function (data) {
      if (res.statusCode === 200) {
        cache.set(key, data);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// API Routes
const apiRouter = express.Router();

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Weverse API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Auth routes
apiRouter.post('/auth/login', validateBody(schemas.login), async (req, res) => {
  const { email, password } = req.body;

  try {
    logger.info(`Login attempt for user: ${email}`);
    logger.debug(`Login request body: ${JSON.stringify(req.body)}`);

    const success = await weverseClient.login(email, password);

    if (success) {
      logger.info(`Login successful for user: ${email}`);
      logger.debug(`Token obtained: ${weverseClient.token ? 'yes' : 'no'}`);
      res.json({ message: 'Authentication successful' });
    } else {
      logger.warn(`Login failed for user: ${email}`);
      res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Community routes
apiRouter.get('/communities', checkAuth, cacheMiddleware('communities'), async (req, res) => {
  try {
    logger.info('Getting communities');
    const communities = await weverseClient.getCommunities();
    res.json(communities);
  } catch (error) {
    logger.error(`Failed to get communities: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Post routes
apiRouter.get(
  '/posts/:postId',
  checkAuth,
  validateParams(schemas.postId),
  cacheMiddleware('post'),
  async (req, res) => {
    try {
      const { postId } = req.params;
      logger.info(`Getting post: ${postId}`);
      const post = await weverseClient.getPost(postId);
      res.json(post);
    } catch (error) {
      logger.error(`Failed to get post: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

apiRouter.get(
  '/communities/:communityId/posts',
  checkAuth,
  validateParams(schemas.communityId),
  validateQuery(schemas.pagination),
  cacheMiddleware('posts'),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const { page, size, type } = req.query;

      logger.info(`Getting posts for community: ${communityId}, page: ${page}, size: ${size}, type: ${type}`);
      const posts = await weverseClient.getPosts(communityId, page, size, type);
      res.json(posts);
    } catch (error) {
      logger.error(`Failed to get posts: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Export routes
apiRouter.get(
  '/communities/:communityId/export',
  checkAuth,
  validateParams(schemas.communityId),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const limit = 50; // Export last 50 posts

      logger.info(`Exporting data for community: ${communityId}`);

      const posts = await weverseClient.getPosts(communityId, 1, limit);

      const exportData = {
        exported_at: new Date().toISOString(),
        community_id: communityId,
        record_count: posts.data ? posts.data.length : 0,
        data: posts.data || []
      };

      const filename = `weverse_export_${communityId}_${Date.now()}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);
    } catch (error) {
      logger.error(`Failed to export data: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// RSS Feed route
apiRouter.get(
  '/communities/:communityId/rss',
  checkAuth,
  validateParams(schemas.communityId),
  cacheMiddleware('rss'),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const RSS = require('rss'); // Lazy load

      logger.info(`Generating RSS feed for community: ${communityId}`);

      // Get community info (for feed title) and posts
      // Parallelize requests for performance
      const [communityData, postsData] = await Promise.all([
        // We might need a specific getCommunityDetails method, but for now we can try to find it from getCommunities list
        // or just use generic title. Let's just fetch posts for now and use ID if header missing.
        // Or better, fetch communities list to find the name.
        weverseClient.getCommunities(),
        weverseClient.getPosts(communityId, 1, 20)
      ]);

      const community = communityData.find(c => c.id === communityId) || { name: `Community ${communityId}` };
      const posts = postsData.data || [];

      const feed = new RSS({
        title: `Weverse - ${community.name}`,
        description: `Latest posts from ${community.name} on Weverse`,
        feed_url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        site_url: 'https://weverse.io',
        image_url: community.logoUrl || '',
        language: 'en',
        pubDate: new Date(),
      });

      posts.forEach(post => {
        let title = post.body ? post.body.substring(0, 50) + (post.body.length > 50 ? '...' : '') : 'New Post';
        // If it's an artist post, maybe prefix?
        // Assuming post structure has artist info or we map it. 
        // For simplified implementation:

        feed.item({
          title: title,
          description: post.body || 'No content',
          url: `https://weverse.io/${community.name.toLowerCase().replace(/\s+/g, '')}/artist/${post.id}`, // Approximate URL
          guid: post.id,
          date: post.createdAt || new Date(),
          author: post.artist ? post.artist.name : 'Artist'
        });
      });

      res.set('Content-Type', 'application/xml');
      res.send(feed.xml());

    } catch (error) {
      logger.error(`Failed to generate RSS: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

apiRouter.get(
  '/communities/:communityId/artists',
  checkAuth,
  validateParams(schemas.communityId),
  cacheMiddleware('artists'),
  async (req, res) => {
    try {
      const { communityId } = req.params;

      logger.info(`Getting artists for community: ${communityId}`);
      const artists = await weverseClient.getArtists(communityId);
      res.json(artists);
    } catch (error) {
      logger.error(`Failed to get artists: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Media routes
apiRouter.get(
  '/posts/:postId/media',
  checkAuth,
  validateParams(schemas.postId),
  cacheMiddleware('media'),
  async (req, res) => {
    try {
      const { postId } = req.params;

      logger.info(`Getting media for post: ${postId}`);
      const media = await weverseClient.getMedia(postId);
      res.json(media);
    } catch (error) {
      logger.error(`Failed to get media: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Comment routes
apiRouter.get(
  '/posts/:postId/comments',
  checkAuth,
  validateParams(schemas.postId),
  validateQuery(schemas.pagination),
  cacheMiddleware('comments'),
  async (req, res) => {
    try {
      const { postId } = req.params;
      const { page, size } = req.query;

      logger.info(`Getting comments for post: ${postId}, page: ${page}, size: ${size}`);
      const comments = await weverseClient.getComments(postId, page, size);
      res.json(comments);
    } catch (error) {
      logger.error(`Failed to get comments: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Notification routes
apiRouter.get(
  '/notifications',
  checkAuth,
  validateQuery(schemas.pagination),
  async (req, res) => {
    try {
      const { page, size } = req.query;
      logger.info(`Getting notifications, page: ${page}, size: ${size}`);
      const notifications = await weverseClient.getNotifications(page, size);
      res.json(notifications);
    } catch (error) {
      logger.error(`Failed to get notifications: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Widget route (HTML)
apiRouter.get(
  '/widgets/latest/:communityId',
  checkAuth,
  validateParams(schemas.communityId),
  cacheMiddleware('widget'),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const posts = await weverseClient.getPosts(communityId, 1, 1);
      const post = posts.data && posts.data.length > 0 ? posts.data[0] : null;

      if (!post) {
        return res.send('<div style="font-family: sans-serif; color: #666;">No posts found</div>');
      }

      const artistName = post.artist ? post.artist.name : 'Artist';
      const avatarUrl = post.artist ? post.artist.profileImageUrl : '';
      const content = post.body || 'No text content';
      const date = new Date(post.createdAt).toLocaleDateString();

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .widget {
              background: rgba(255, 255, 255, 0.8);
              backdrop-filter: blur(10px);
              border-radius: 16px;
              padding: 16px;
              border: 1px solid rgba(255, 255, 255, 0.3);
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .header { display: flex; align-items: center; margin-bottom: 12px; }
            .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 12px; }
            .name { font-weight: bold; color: #333; }
            .date { font-size: 0.8em; color: #666; }
            .content { font-size: 0.95em; line-height: 1.4; color: #444; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
          </style>
        </head>
        <body>
          <div class="widget">
            <div class="header">
              ${avatarUrl ? `<img src="${avatarUrl}" class="avatar" />` : ''}
              <div>
                <div class="name">${artistName}</div>
                <div class="date">${date}</div>
              </div>
            </div>
            <div class="content">${content}</div>
          </div>
        </body>
        </html>
      `;

      res.send(html);
    } catch (error) {
      logger.error(`Failed to generate widget: ${error.message}`);
      res.status(500).send('Failed to generate widget');
    }
  }
);

// Calendar route (iCal)
apiRouter.get(
  '/communities/:communityId/calendar',
  checkAuth,
  validateParams(schemas.communityId),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      // Using posts as events for now as specific calendar endpoint is obscure
      const posts = await weverseClient.getPosts(communityId, 1, 20);

      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//WeverseAPI//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:Weverse Community ${communityId}`
      ].join('\r\n');

      if (posts.data) {
        posts.data.forEach(post => {
          const startDate = new Date(post.createdAt);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration default

          const formatTime = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

          icsContent += '\r\n' + [
            'BEGIN:VEVENT',
            `UID:${post.id}@weverse.api`,
            `DTSTAMP:${formatTime(new Date())}`,
            `DTSTART:${formatTime(startDate)}`,
            `DTEND:${formatTime(endDate)}`,
            `SUMMARY:New Post by ${post.artist ? post.artist.name : 'Artist'}`,
            `DESCRIPTION:${(post.body || '').substring(0, 50).replace(/\n/g, ' ')}...`,
            `URL:https://weverse.io`,
            'END:VEVENT'
          ].join('\r\n');
        });
      }

      icsContent += '\r\nEND:VCALENDAR';

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="weverse-calendar-${communityId}.ics"`);
      res.send(icsContent);
    } catch (error) {
      logger.error(`Failed to generate calendar: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Cache management endpoints
apiRouter.delete('/cache/flush', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }

  cache.flush();
  logger.info('Cache flushed');
  res.json({ message: 'Cache successfully flushed' });
});

// API status endpoint
apiRouter.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount API router
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  logger.warn(`Not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);

    // Auto login if credentials provided
    if (process.env.WEVERSE_EMAIL && process.env.WEVERSE_PASSWORD) {
      logger.info('Auto-login credentials found, attempting to log in');
    } else {
      logger.warn('No auto-login credentials found in .env');
    }
  });
}

module.exports = app; 