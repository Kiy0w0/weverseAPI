const NodeCache = require('node-cache');
const logger = require('./logger');

// Standard TTL: 5 menit
const DEFAULT_TTL = 300;

class Cache {
  constructor(ttlSeconds = DEFAULT_TTL) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });

    // Log ketika cache dihapus
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache expired for key: ${key}`);
    });

    // Log statistik cache setiap jam
    const statsInterval = setInterval(() => {
      const stats = this.cache.getStats();
      logger.info(`Cache stats - keys: ${stats.keys}, hits: ${stats.hits}, misses: ${stats.misses}, hitRate: ${stats.hitRate}%`);
    }, 3600000); // 1 jam

    // Prevent this interval from keeping the process alive (especially during tests)
    if (statsInterval.unref) {
      statsInterval.unref();
    }
  }

  get(key) {
    const value = this.cache.get(key);
    if (value) {
      logger.debug(`Cache hit for key: ${key}`);
      return value;
    }
    logger.debug(`Cache miss for key: ${key}`);
    return null;
  }

  set(key, value, ttl = DEFAULT_TTL) {
    logger.debug(`Setting cache for key: ${key}`);
    return this.cache.set(key, value, ttl);
  }

  delete(key) {
    logger.debug(`Deleting cache for key: ${key}`);
    return this.cache.del(key);
  }

  flush() {
    logger.info('Flushing entire cache');
    return this.cache.flushAll();
  }

  // Utilitas untuk mendapatkan cache key format standar
  static generateKey(namespace, identifier) {
    return `${namespace}:${identifier}`;
  }
}

module.exports = new Cache(); 