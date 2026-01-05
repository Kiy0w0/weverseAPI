# Weverse API Wrapper (Unofficial)

![Node.jsCI](https://github.com/kiy0w0/weverse-api/actions/workflows/node.js.yml/badge.svg)
![Node Version](https://img.shields.io/badge/node-18%2B-green)
![License](https://img.shields.io/badge/license-MIT-blue)

A robust, Vercel-ready Node.js wrapper for the Weverse API. Designed for developers, streamers, and data archivists who want to integrate Weverse content into their applications, Discord bots, or OBS overlays.

> **Disclaimer**: This is an unofficial API wrapper. Weverse endpoints are subject to change without notice. Use responsibly and at your own risk.

##  Key Features

- **Vercel Ready**: fully optimized for Serverless deployment (Vercel, AWS Lambda).
- **RSS Feed Generator**: Convert community posts into RSS feeds for Feedly, Inoreader, or Discord bots.
- **Post Calendar**: Generate `.ics` calendar files to subscribe to artist updates in Google Calendar.
- **Smart Widgets**: Beautiful HTML widgets for OBS overlays or Notion embeds with Glassmorphism design.
- **Data Export**: Download community posts as JSON for archiving or analysis.
- **Engagement**: Fetch comments and user notifications.
- **Security**: RSA encryption login, no hardcoded credentials, and Helmet/Rate-Limit protection.
- **Performance**: Built-in in-memory caching (`node-cache`) to respect API limits.

##  Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Weverse Account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kiy0w0/weverse-api.git
   cd weverse-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   **Required Variables:**
   ```env
   # Your Weverse Account Credentials
   WEVERSE_EMAIL=your_email@example.com
   WEVERSE_PASSWORD=your_password
   
   # Server Config
   NODE_ENV=development
   PORT=3001
   ```

### Running Locally

Start the development server:
```bash
npm run dev
```

The server will start at `http://localhost:3001`.

### Testing

Run the comprehensive test suite (Unit & Integration tests):
```bash
npm test
```

## Deployment

### Deploy to Vercel

This project is pre-configured for Vercel.

1. Fork this repository.
2. Log in to [Vercel](https://vercel.com/) and create a "New Project".
3. Import your forked repository.
4. In the **Environment Variables** section, add:
   - `WEVERSE_EMAIL`: Your email
   - `WEVERSE_PASSWORD`: Your password
5. Click **Deploy**.

## API Endpoints

Explore the interactive Swagger documentation at `/api-docs` when running locally.

### Integrations
- **RSS Feed**: `GET /api/communities/{id}/rss`
- **Calendar**: `GET /api/communities/{id}/calendar`
- **Widget**: `GET /api/widgets/latest/{id}`
- **Export**: `GET /api/communities/{id}/export`

### Core
- **Posts**: `GET /api/communities/{id}/posts?type=artist`
- **Single Post**: `GET /api/posts/{postId}`
- **Comments**: `GET /api/posts/{postId}/comments`
- **Notifications**: `GET /api/notifications`

##  Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📫 Contact

Created by **[@kiy0w0](https://github.com/kiy0w0)** - feel free to contact me!

Project Link: [https://github.com/kiy0w0/weverse-api](https://github.com/kiy0w0/weverse-api)
