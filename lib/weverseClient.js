const axios = require('axios');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
require('dotenv').config();

// Fungsi untuk membaca .env secara manual jika diperlukan
function loadEnvManually() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');

      envLines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            process.env[key.trim()] = value.trim();
            logger.debug(`Manually loaded env: ${key.trim()}`);
          }
        }
      });

      return true;
    }
    return false;
  } catch (err) {
    logger.error(`Error manually loading .env: ${err.message}`);
    return false;
  }
}

// Debug .env loading
if (process.env.WEVERSE_EMAIL) {
  logger.debug(`WEVERSE_EMAIL loaded from .env: ${process.env.WEVERSE_EMAIL}`);
} else {
  logger.error('WEVERSE_EMAIL not found in environment variables');
  loadEnvManually();
}

// Weverse public key for RSA encryption
const publicKey = `-----BEGIN RSA PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu/OhimOynajYomJmBsNv
QxSDwekunsp986l7s/zMN/8jHXFlTqT79ZOsOwzVdZcKnkWYXwJg4nhIFpaIsPzk
lQCImp2kfKUJQV3jzw7/Qtq6NrOOh9YBADr+b99SHYcc7E7cDHjGXgWlC5jEI9h8
0R822wBU0HcbODkAQ3uosvFhSq3gLpxwdimesZofkJ5ZbAmGIMj1GEWAfMGA49mx
kv/cDFWry+6FM4mUW6A0301QUg4wK/8n6RrzRj1NUkevZj1smizHeqmBE+0BU5H/
fR9HclErx3LMHlVlxSgEEEjNUx3B0bLO0OHppmEb4B3Tk1O3ZsquYyqZyb2lBTbr
QwIDAQAB
-----END RSA PUBLIC KEY-----`;

class WeverseClient {
  constructor() {
    // Base URL for Weverse API
    this.baseUrl = 'https://weverse.io/api';
    this.token = process.env.WEVERSE_API_TOKEN || null;
    this.refreshToken = null;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://weverse.io',
        'Referer': 'https://weverse.io/'
      },
      timeout: 10000,
      withCredentials: true
    });

    // If we have a token from env, use it directly
    if (this.token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      logger.info('Using API token from environment variables');
    }

    // Add interceptors for logging
    this.axiosInstance.interceptors.request.use(request => {
      logger.debug(`Request to ${request.url}: ${JSON.stringify(request.data || {})}`);
      if (request.headers) {
        logger.debug(`Request headers: ${JSON.stringify(request.headers)}`);
      }
      return request;
    });

    this.axiosInstance.interceptors.response.use(
      response => {
        logger.debug(`Response from ${response.config.url}: ${response.status}`);
        if (response.headers && response.headers['set-cookie']) {
          logger.debug(`Got cookies: ${response.headers['set-cookie']}`);
        }
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data || {})}`);
          logger.error(`Error response headers: ${JSON.stringify(error.response.headers || {})}`);
        } else if (error.request) {
          logger.error(`API Error: No response received - ${error.message}`);
        } else {
          logger.error(`API Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  async login(email, password) {
    try {
      logger.info(`Attempting to login with email: ${email}`);

      // Step 1: Get the initialization data
      logger.debug('Getting initialization data');
      const initResponse = await axios.get('https://account.weverse.io/api/v3/web/login/initialize', {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://weverse.io',
          'Referer': 'https://weverse.io/'
        }
      });
      logger.debug(`Initialization response: ${JSON.stringify(initResponse.data)}`);

      // Step 2: Encrypt the password using RSA public key
      logger.debug('Encrypting password with RSA public key');
      const key = forge.pki.publicKeyFromPem(publicKey);
      const encryptedPassword = forge.util.encode64(key.encrypt(password, 'RSA-OAEP'));

      // Step 3: Login with credentials
      logger.debug('Logging in with credentials');
      const loginResponse = await axios.post('https://account.weverse.io/api/v3/web/login/secure', {
        email: email,
        password: encryptedPassword,
        client_id: 'weverse-app',
        client_secret: 'a6ba69b8d6f15ab3e6b6bca8051fe6ec',
        grant_type: 'password'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://weverse.io',
          'Referer': 'https://weverse.io/'
        }
      });

      logger.debug(`Login response status: ${loginResponse.status}`);
      logger.debug(`Login response data: ${JSON.stringify(loginResponse.data)}`);

      if (loginResponse.data.access_token) {
        this.token = loginResponse.data.access_token;
        this.refreshToken = loginResponse.data.refresh_token;

        // Update axios instance headers with the token
        this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        logger.info('Login successful, token obtained');
        return true;
      } else {
        logger.error('Failed to obtain token');
        return false;
      }
    } catch (error) {
      logger.error(`Login failed: ${error.message}`);
      // Display detailed error for debugging
      if (error.response) {
        logger.error(`Error response: ${JSON.stringify(error.response.data || {})}`);
        logger.error(`Error response status: ${error.response.status}`);
        logger.error(`Error response headers: ${JSON.stringify(error.response.headers || {})}`);
      }
      return false;
    }
  }

  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        logger.error('No refresh token available');
        return false;
      }

      logger.debug('Refreshing access token...');
      const response = await axios.post('https://account.weverse.io/api/v3/web/token', {
        grant_type: 'refresh_token',
        client_id: 'weverse-app',
        client_secret: 'a6ba69b8d6f15ab3e6b6bca8051fe6ec',
        refresh_token: this.refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://weverse.io',
          'Referer': 'https://weverse.io/'
        }
      });

      if (response.data.access_token) {
        this.token = response.data.access_token;
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
        }

        // Update axios instance headers with the new token
        this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        logger.info('Access token refreshed successfully');
        return true;
      } else {
        logger.error('Failed to refresh access token');
        return false;
      }
    } catch (error) {
      logger.error(`Error refreshing access token: ${error.message}`);
      if (error.response) {
        logger.error(`Error response: ${JSON.stringify(error.response.data || {})}`);
      }
      return false;
    }
  }

  async getCommunities() {
    try {
      logger.info('Getting communities');
      // Use the correct endpoint for communities
      const response = await this.axiosInstance.get('/v1/communities');
      return response.data;
    } catch (error) {
      logger.error(`Failed to get communities: ${error.message}`);
      if (error.response && error.response.status === 401) {
        // Try to refresh token if the error is due to unauthorized access
        logger.debug('Attempting to refresh token due to 401 error');
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) {
          // Try the request again
          return this.getCommunities();
        }
      }
      throw new Error(`Failed to get communities: ${error.message}`);
    }
  }

  async getPost(postId) {
    try {
      logger.info(`Getting post details: ${postId}`);
      const response = await this.axiosInstance.get(`/v1/post/${postId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get post: ${error.message}`);
      if (error.response && error.response.status === 401) {
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) return this.getPost(postId);
      }
      throw new Error(`Failed to get post: ${error.message}`);
    }
  }

  async getNotifications(page = 1, size = 20) {
    try {
      logger.info(`Getting notifications, page: ${page}, size: ${size}`);
      const response = await this.axiosInstance.get('/v1/notification', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get notifications: ${error.message}`);
      if (error.response && error.response.status === 401) {
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) return this.getNotifications(page, size);
      }
      throw new Error(`Failed to get notifications: ${error.message}`);
    }
  }

  async getPosts(communityId, page = 1, size = 20, type = 'all') {
    try {
      logger.info(`Getting posts for community: ${communityId}, page: ${page}, size: ${size}, type: ${type}`);
      // Use the correct endpoint for posts
      const params = {
        page,
        size,
        sort: 'RECENT'
      };

      if (type && type !== 'all') {
        params.type = type.toUpperCase();
      }

      const response = await this.axiosInstance.get(`/v1/community/${communityId}/posts`, { params });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get posts: ${error.message}`);
      if (error.response && error.response.status === 401) {
        // Try to refresh token if the error is due to unauthorized access
        logger.debug('Attempting to refresh token due to 401 error');
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) {
          // Try the request again
          return this.getPosts(communityId, page, size, type);
        }
      }
      throw new Error(`Failed to get posts: ${error.message}`);
    }
  }

  async getArtists(communityId) {
    try {
      logger.info(`Getting artists for community: ${communityId}`);
      // Use the correct endpoint for artists
      const response = await this.axiosInstance.get(`/v1/community/${communityId}/artists`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get artists: ${error.message}`);
      if (error.response && error.response.status === 401) {
        // Try to refresh token if the error is due to unauthorized access
        logger.debug('Attempting to refresh token due to 401 error');
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) {
          // Try the request again
          return this.getArtists(communityId);
        }
      }
      throw new Error(`Failed to get artists: ${error.message}`);
    }
  }

  async getMedia(postId) {
    try {
      logger.info(`Getting media for post: ${postId}`);
      // Use the correct endpoint for media
      const response = await this.axiosInstance.get(`/v1/post/${postId}/media`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get media: ${error.message}`);
      if (error.response && error.response.status === 401) {
        // Try to refresh token if the error is due to unauthorized access
        logger.debug('Attempting to refresh token due to 401 error');
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) {
          // Try the request again
          return this.getMedia(postId);
        }
      }
      throw new Error(`Failed to get media: ${error.message}`);
    }
  }

  async getComments(postId, page = 1, size = 20) {
    try {
      logger.info(`Getting comments for post: ${postId}, page: ${page}, size: ${size}`);
      // Use the correct endpoint for comments
      const response = await this.axiosInstance.get(`/v1/post/${postId}/comments`, {
        params: {
          page,
          size,
          sort: 'RECENT'
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to get comments: ${error.message}`);
      if (error.response && error.response.status === 401) {
        // Try to refresh token if the error is due to unauthorized access
        logger.debug('Attempting to refresh token due to 401 error');
        const refreshSuccessful = await this.refreshAccessToken();
        if (refreshSuccessful) {
          // Try the request again
          return this.getComments(postId, page, size);
        }
      }
      throw new Error(`Failed to get comments: ${error.message}`);
    }
  }
}

const weverseClient = new WeverseClient();

// Auto-login on startup if credentials are available
(async () => {
  // Check if we already have a token - if so, no need to login
  if (weverseClient.token) {
    logger.info('Using existing token from environment variables');
    return;
  }

  // Coba load .env lagi dengan path relatif jika kredensial tidak ditemukan
  if (!process.env.WEVERSE_EMAIL || !process.env.WEVERSE_PASSWORD) {
    try {
      const path = require('path');
      require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
      logger.debug('Trying to load .env from relative path');
    } catch (err) {
      logger.error(`Error loading .env from relative path: ${err.message}`);
    }

    // Periksa jika variabel diatur secara manual dalam aplikasi
    // Untuk pengujian, kita bisa set nilai default jika tidak ada di .env
    // Check if variables are manually set
    // For testing, strictly rely on .env or environment variables
    if (!process.env.WEVERSE_EMAIL || !process.env.WEVERSE_PASSWORD) {
      logger.warn('Missing WEVERSE_EMAIL or WEVERSE_PASSWORD in environment');
    }
  }

  if (process.env.WEVERSE_EMAIL && process.env.WEVERSE_PASSWORD) {
    logger.info(`Auto-login with email: ${process.env.WEVERSE_EMAIL}`);
    try {
      logger.debug(`Credentials from .env: ${process.env.WEVERSE_EMAIL}, password length: ${process.env.WEVERSE_PASSWORD.length}`);
      const success = await weverseClient.login(process.env.WEVERSE_EMAIL, process.env.WEVERSE_PASSWORD);
      if (success) {
        logger.info('Auto-login successful');
      } else {
        logger.error('Auto-login failed');
      }
    } catch (error) {
      logger.error(`Auto-login error: ${error.message}`);
    }
  } else {
    logger.warn('No credentials found in .env file');
    // Tampilkan daftar variabel lingkungan yang tersedia (tanpa nilai sensitif)
    const envKeys = Object.keys(process.env).filter(key => !key.toLowerCase().includes('password'));
    logger.debug(`Environment variables available: ${envKeys.join(', ')}`);
  }
})();

module.exports = weverseClient; 