[简体中文](./README.zh-CN.md) ｜ English（当前）

# Random Image API Service

[![wakatime](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d.svg)](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d)

A random image API service based on Next.js 14, supporting multiple image hosting storage with a complete management panel.

## Preview

### Homepage Preview

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/765a5a93-91f7-4bc0-ab0f-0f746af2dbd0" />

### Dashboard

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/c7549fd8-14fe-4d05-a7df-9628f07196bc" />

### Image update

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/87454195-8540-4c2a-89a4-c563ba2659fa" />

### Image Management

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/d53f7d6f-2db8-48b5-a268-1d6b0f764c99" />

### Group Management

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/673c3579-7216-41bb-a035-5d3da4c21c54" />

### API Configuration

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/131a06d1-bf36-4d00-8135-d73d00abf978" />

### System Status

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/bef3ce59-bd05-4942-a9fc-235f0f93c0ed" />

### System Logs

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/3c6beb52-76a9-4305-8bd3-ba514aae57b2" />

### Backup Management

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/e95e146f-6c07-4b3f-bab3-2093fd35c622" />

### Security Management

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/5a82b929-6103-486b-9077-7cf482f059c6" />


## Quick Start

### Requirements

- Node.js 22+
- MySQL 8.0+
- npm or yarn package manager

### Environment Variables Configuration

Create a `.env.local` file and configure the following environment variables:

```env
# Database configuration
DATABASE_URL="mysql://username:password@host:port/database"

# Server configuration
# Optional, defaults to 3000 if not set
PORT=3000

# Cloudinary image hosting configuration (primary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# TgState image hosting configuration (optional, third-party service)
TGSTATE_BASE_URL=https://your-tgstate-domain.com
# TgState image proxy URL (optional, for faster access or CDN acceleration)
# If configured, API will return image URLs using the proxy address
# TGSTATE_PROXY_URL=https://tg-img.your-domain.com
# Or use Cloudflare Worker as reverse proxy:
# TGSTATE_PROXY_URL=https://tg-proxy.workers.dev

# Telegram direct image hosting configuration (recommended; no extra backend required)
# Supports multiple Bot Tokens (comma-separated) for load balancing and rate limit mitigation
TELEGRAM_BOT_TOKENS=token1,token2,token3
# Or a single Bot Token
# TELEGRAM_BOT_TOKEN=your_bot_token
# Optional: specify the target chat_id for uploads (defaults to the bot's Saved Messages)
# TELEGRAM_CHAT_ID=your_chat_id

# Host toggles (optional; default to enabled when not set)
CLOUDINARY_ENABLE=true
TGSTATE_ENABLE=false
TELEGRAM_ENABLE=true

# Admin authentication
ADMIN_PASSWORD=your_secure_admin_password

# Session security (optional, auto-generated if not set)
# SESSION_SECRET=your_random_secret_key_for_session_signing
```

#### Enable/Disable image hosts on demand (New)

Control which hosts are enabled via environment variables. Defaults to enabled when not set:

```env
# Host toggles (enabled by default if not set)
CLOUDINARY_ENABLE=true
TGSTATE_ENABLE=false
TELEGRAM_ENABLE=true
```

- Set to `false` to disable a host (e.g., enable TgState only: `CLOUDINARY_ENABLE=false`).
- When all hosts are `false`, upload APIs return `503 No image hosting service enabled`.
- The multi-host manager registers only enabled services; selectable providers and defaults follow accordingly.

### Installation and Deployment

#### Development Environment

```bash
# 1. Clone the project
git clone https://github.com/Aierlanta/Cloudinary-photo.git
cd Cloudinary-photo

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local file and fill in your configuration

# 4. Initialize database
npx prisma generate
npx prisma migrate dev

# 5. Start development server
npm run dev
```

#### Production Environment

```bash
# 1. Build the project
npm run build

# 2. Start production server
npm run start

# Or use the quick start script
chmod +x fast-start.sh
./fast-start.sh
```

## API Documentation

### Public API

#### API Key Authentication (Optional)

If API Key authentication is enabled in the admin panel, all public API requests must include the `key` parameter:

```bash
# Without API Key (when authentication is disabled)
GET /api/random

# With API Key (when authentication is enabled)
GET /api/random?key=your-api-key

# Combine with other parameters
GET /api/random?group=wallpaper&key=your-api-key
```

**Configuration**:

- Go to Admin Panel → API Configuration → API Key Authentication
- Enable API Key authentication
- Generate or enter a custom API key
- All API requests will require the `key` parameter

**Error Responses**:

- `401 Unauthorized` - Missing API key when authentication is enabled
- `401 Unauthorized` - Invalid API key

#### Random Image Endpoint

```http
GET /api/random
```

**Function**: Get a random image, supports group/provider filtering, orientation filtering, and parameter configuration  
**Response**: 302 redirect to image URL  
**Parameters**:

- `key` - API key (required if authentication is enabled)
- `group`/custom params - Mapped in admin panel
- provider-mapped params - Mapped in admin panel to restrict candidate storage providers (optional)
- `orientation` - `landscape` | `portrait` | `square` (optional; filters by stored width/height/orientation)
- Example: `?group=wallpaper&orientation=landscape`
- Example with key: `?group=wallpaper&key=your-api-key`
- Example (provider-mapped): `?src=fast` (when `src` is configured as a provider parameter in admin panel)

#### Direct Response Endpoint

```http
GET /api/response
```

**Function**: Directly return image data (optional feature)
**Response**: Image binary data
**Use Case**: Suitable for scenarios requiring direct image content retrieval

**Parameters**:

- `key` - API key (required if authentication is enabled)
- `group`/custom params - Mapped in admin panel (same mapping rules as `/api/random`)
- provider-mapped params - Mapped in admin panel to restrict candidate storage providers (optional)
- `opacity` - Image opacity (0-1.0), 0 for fully transparent, 1 for fully opaque (optional)
- `bgColor` - Background color (optional), supports the following formats:
  - Preset color names: `white` (default), `black`
  - Hexadecimal: `ffffff` or `#ffffff`
- `orientation` - `landscape` | `portrait` | `square` (optional; works with random selection)
- `width` / `height` - Resize output; if only one is provided, aspect ratio is preserved
- `fit` - Resize mode when width/height are both present: `cover` (default) | `contain`

**Usage Examples**:

```bash
# Original image (no transparency adjustment)
GET /api/response

# With API Key
GET /api/response?key=your-api-key

# Prefer landscape images
GET /api/response?orientation=landscape

# Resize to 800x600 with cover fit
GET /api/response?width=800&height=600&fit=cover

# 50% opacity with white background
GET /api/response?opacity=0.5&bgColor=white

# 80% opacity with black background and API key
GET /api/response?opacity=0.8&bgColor=black&key=your-api-key

# 30% opacity with custom color background
GET /api/response?opacity=0.3&bgColor=ff6b6b
```

**Notes**:

- Transparency processing converts images to JPEG format (quality 90)
- When using transparency parameters, prefetch cache is not used, response time may be slightly longer
- If `bgColor` is not specified, white background is used by default

- Prefetch (Updated)

  - After each successful response, prefetch the next random image and keep it in a single in-memory slot
  - The slot is keyed by the same filter condition (e.g., group mapping). On hit it returns instantly and the slot is consumed (cleared), then a new prefetch starts in the background
  - No TTL. The cache lives in the process memory and is lost on restarts/scale-to-zero. The first request after a restart is a cold start
  - Response headers: `X-Transfer-Mode` (`buffered` | `prefetch`), `X-Image-Size`
  - Prefetch failures do not affect the current request, only logged

- Transport compatibility (New)

  - Cloudinary assets are downloaded via Cloudinary; non-Cloudinary assets are fetched from the database URL
  - `4xx` (except `429`) errors are not retried; failures fall back to URL fetch
  - All fetches use `fetch(..., { cache: 'no-store' })` to avoid Next.js data cache 2MB limits

- Deployment note (Replit autoscale)
  - The single-slot cache lives in the process memory; when the app scales to zero or restarts, the cache is lost and the first request becomes a cold start
  - With multiple instances, each instance maintains its own single-slot cache; they are not shared

#### System Status Endpoint

```http
GET /api/status
GET /api/health
```

**Function**: System health check and status monitoring
**Response**: System status information in JSON format

### Admin API (Requires Authentication)

#### Image Management

```http
GET    /api/admin/images                  # Get image list (supports pagination, filtering)
POST   /api/admin/images                  # Upload images (supports batch upload)
POST   /api/admin/images/import-urls      # Batch import external image URLs for the custom provider
PUT    /api/admin/images/[id]             # Update image information
DELETE /api/admin/images/[id]             # Delete image
```

#### Group Management

```http
GET    /api/admin/groups           # Get group list
POST   /api/admin/groups           # Create group
PUT    /api/admin/groups/[id]      # Update group information
DELETE /api/admin/groups/[id]      # Delete group
```

#### System Configuration

```http
GET    /api/admin/config           # Get API configuration
PUT    /api/admin/config           # Update API configuration
GET    /api/admin/settings         # Get system settings
PUT    /api/admin/settings         # Update system settings
```

#### Storage Management

```http
GET    /api/admin/storage          # Get storage configuration
PUT    /api/admin/storage          # Update storage configuration
GET    /api/admin/image-hosts      # Get image host status
POST   /api/admin/multi-host       # Multi-host operations
```

#### System Monitoring

```http
GET    /api/admin/stats            # Get system statistics
GET    /api/admin/logs             # Get system logs
GET    /api/admin/health           # Get detailed health status
POST   /api/admin/backup           # Create data backup
```

#### Security Management (New in v1.4.0)

```http
GET    /api/admin/security/stats           # Get access statistics
GET    /api/admin/security/banned-ips      # Get banned IP list
POST   /api/admin/security/banned-ips      # Ban an IP address
DELETE /api/admin/security/banned-ips      # Unban an IP address
GET    /api/admin/security/rate-limits     # Get IP rate limit configuration
POST   /api/admin/security/rate-limits     # Set IP rate limit
DELETE /api/admin/security/rate-limits     # Remove IP rate limit
GET    /api/admin/security/ip-info         # Get IP information and statistics
```

## CDN Configuration Recommendations

- **Goals**

  - Keep `/api/response` uncached at the browser/CDN to preserve randomness.
  - Reduce latency by leveraging the server-side in-memory prefetch (already implemented). Do NOT rely on edge cache for this route.

- **Required settings**

  - Respect origin headers: `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0`.
  - Add a bypass/disable-cache rule for path: `/api/response*`.
  - Optional: if your CDN supports it, enforce `Surrogate-Control: no-store` at the edge to avoid accidental caching by surrogate layers.

- **Provider playbooks**

  - **Cloudflare**
    - Cache Rule or Page Rule: condition `URI Path` matches `/api/response*`.
    - Actions: `Cache level = Bypass`, `Origin Cache Control = On`, `Edge TTL = 0`. Do not transform caching headers.
  - **Vercel**
    - The route sets `dynamic = 'force-dynamic'`, so Vercel will not edge-cache it.
    - If an external CDN/proxy sits in front of Vercel, still add a bypass rule for `/api/response*` there.
  - **AWS CloudFront**
    - Behavior for `/api/response*`: `Cache policy = CachingDisabled` (or custom with TTL 0 and honor origin), suitable `Origin request policy`.
  - **Nginx / Reverse Proxy**

    - Example:

      ```nginx
      location /api/response {
          expires off;
          add_header Cache-Control "no-cache, no-store, must-revalidate" always;
          add_header Pragma "no-cache" always;
          add_header Expires "0" always;
          proxy_pass http://your_upstream;
      }
      ```

  - **Fastly / Akamai**
    - Fastly VCL: for `/api/response*` set `beresp.http.Surrogate-Control = "no-store"` and `beresp.ttl = 0s`.
    - Akamai: configure property behavior to respect origin `no-store` and disable cache for the path.

- **Troubleshooting**
  - If you still observe repeated images from cache:
    - Inspect response/edge headers (e.g., `CF-Cache-Status`, `X-Cache`, `Age`).
    - Disable any worker/transform that rewrites caching headers.
    - Ensure the URL is not rewritten to bypass your cache rule.

## Features

### Core Features

- **Random Image API**: Fast random image retrieval with group/provider filtering support (via admin-mapped parameters)
- **Multi-host Storage**: Support for Cloudinary, TgState, Telegram, and a custom external URL provider, with automatic failover between enabled hosts
- **Management Panel**: Complete web-based admin interface for image and group management
- **Admin Route History**: Track and display recently visited admin routes for quick navigation
- **IP Location Badge**: Display IP geolocation in admin security views
- **API Key Authentication**: Optional API key authentication for public endpoints
- **Image Processing**: Support for transparency adjustment and background color customization
- **Prefetch Cache**: Single-slot in-memory cache for improved response time
- **Security Management** (v1.4.0): Access logging, IP banning, and rate limiting
- **Internationalization**: Support for English and Chinese languages
- **Theme System**: Dark/light mode with system preference detection
- **Backup & Restore**: Automated database backup with one-click restore functionality

### Security Features

- **Access Control**: Role-based admin authentication with session tokens
- **Rate Limiting**: Configurable rate limits per IP address
- **IP Banning**: Block malicious IPs with automatic or manual banning
- **Access Logging**: Detailed access logs with IP tracking and statistics
- **Sensitive Data Redaction**: Mask secrets in logs and error outputs (e.g., API keys, Telegram bot tokens)
- **Session Security**: HMAC-SHA256 signed session tokens for enhanced security

## Project Architecture

### Directory Structure

```text
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/             # Admin panel pages
│   │   │   ├── images/        # Image management page
│   │   │   ├── groups/        # Group management page
│   │   │   ├── config/        # API configuration page
│   │   │   ├── storage/       # Storage management page
│   │   │   ├── security/      # Security management page (v1.4.0)
│   │   │   ├── logs/          # Log viewing page
│   │   │   └── status/        # System status page
│   │   ├── api/               # API routes
│   │   │   ├── random/        # Random image API
│   │   │   ├── response/      # Direct response API
│   │   │   ├── admin/         # Admin API
│   │   │   └── health/        # Health check API
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Homepage
│   ├── components/            # React components
│   │   ├── admin/             # Admin panel components
│   │   ├── ui/                # Base UI components
│   │   └── ErrorBoundary.tsx  # Error boundary
│   ├── lib/                   # Core business logic
│   │   ├── storage/           # Storage services
│   │   │   ├── base.ts        # Storage interface definition
│   │   │   ├── cloudinary.ts  # Cloudinary service
│   │   │   ├── tgstate.ts     # TgState service
│   │   │   ├── manager.ts     # Multi-host manager
│   │   │   ├── factory.ts     # Service factory
│   │   │   └── config.ts      # Storage configuration (v1.2.1)
│   │   ├── database/          # Database services
│   │   ├── auth.ts            # Authentication service
│   │   ├── security.ts        # Security middleware
│   │   ├── access-tracking.ts # Access logging (v1.4.0)
│   │   ├── ip-management.ts   # IP management (v1.4.0)
│   │   ├── backup.ts          # Backup service
│   │   ├── logger.ts          # Logging service
│   │   ├── image-utils.ts     # Image utility functions
│   │   └── utils.ts           # Utility functions
│   ├── types/                 # TypeScript type definitions
│   │   ├── models.ts          # Data models
│   │   ├── api.ts             # API types
│   │   ├── errors.ts          # Error types
│   │   └── schemas.ts         # Validation schemas
│   ├── i18n/                  # Internationalization (v1.0.0)
│   │   ├── locales/           # Language files
│   │   │   ├── en.ts          # English translations
│   │   │   └── zh.ts          # Chinese translations
│   │   ├── context.tsx        # Locale context
│   │   └── types.ts           # i18n types
│   ├── hooks/                 # React Hooks
│   └── middleware.ts          # Next.js middleware
├── prisma/                    # Database
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── tests/                     # Test files
├── scripts/                   # Build scripts
├── fast-start.sh              # Quick start script
└── Configuration files
    ├── next.config.js         # Next.js configuration
    ├── tailwind.config.ts     # Tailwind configuration
    ├── jest.config.js         # Jest configuration
    └── tsconfig.json          # TypeScript configuration
```

### Core Module Description

#### Storage System (`src/lib/storage/`)

- **Multi-host Architecture**: Supports Cloudinary, TgState, Telegram, and a custom external URL provider
- **Failover**: Automatic service status detection and intelligent switching
- **Unified Interface**: Abstract storage operations for easy extension of new image hosting services
- **Dynamic Configuration** (v1.2.0): Enable/disable storage providers via environment variables
- **Proxy Support** (v1.3.0): TgState proxy URL for CDN acceleration

#### Security System (`src/lib/security.ts`, `src/lib/ip-management.ts`)

- **Request Rate Limiting**: Prevent API abuse with configurable per-IP limits
- **IP Banning** (v1.4.0): Automatic and manual IP blocking
- **Access Tracking** (v1.4.0): Comprehensive access logging with statistics
- **Parameter Validation**: Strict input validation
- **Access Control**: Role-based permission management
- **Session Security** (v1.2.4): HMAC-SHA256 signed session tokens

#### Monitoring System (`src/lib/logger.ts`)

- **Structured Logging**: Unified log format
- **Performance Monitoring**: API response time tracking
- **Error Tracking**: Detailed error information logging
- **Access Analytics** (v1.4.0): IP-based access statistics and trends

#### Backup System (`src/lib/backup.ts`)

- **Automated Backups**: Scheduled database backups
- **One-click Restore**: Quick database restoration from backups
- **Atomic Operations** (v1.4.5): Ensures data consistency during restore
- **Error Recovery**: Enhanced error handling and rollback mechanisms

## Development Commands

```bash
# Development related
npm run dev              # Start development server (localhost:3000)
npm run build            # Build production version
npm run start            # Start production server
npm run lint             # ESLint code check
npm run type-check       # TypeScript type check

# Testing related
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report

# Database related
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Run database migration (development)
npx prisma migrate deploy # Run database migration (production)
npx prisma studio        # Open Prisma Studio database management interface

# Production deployment
./fast-start.sh          # Quick start script (production)
```

## Advanced Configuration

### Multi-host Configuration

The project supports multi-host architecture, providing higher availability and fault tolerance:

#### Cloudinary

- **Advantages**: Professional image CDN service, global nodes, strong image processing capabilities
- **Configuration**: Requires Cloud Name, API Key, and API Secret
- **Usage**: Recommended for production environment

#### TgState

- **Advantages**: Free image hosting service based on Telegram, no censorship restrictions
- **Project URL**: [TgState GitHub](https://github.com/csznet/tgState)
- **Configuration**: Requires deploying TgState service and obtaining access token

#### Custom External URL Provider

- **Use Case**: Manage existing external image URLs (CDN, object storage, or third-party hosts) without uploading files again
- **Configuration**: No additional credentials required; uses the original image URLs as-is
- **Usage**: In the admin image management page, select the "custom external URL" provider and use the "Batch import image URLs" panel to import TXT/JSON content

## Monitoring and Maintenance

### Health Monitoring

- **Health Check**: `/api/health` endpoint provides system status
- **Performance Metrics**: API response time and success rate statistics
- **Resource Monitoring**: Database connections, storage usage
- **Error Tracking**: Detailed error logs and stack information

### Security Monitoring (v1.4.0)

- **Access Statistics**: Real-time access counts and trends
- **IP Tracking**: Monitor IP addresses and access patterns
- **Rate Limit Monitoring**: Track rate limit violations
- **Banned IP Management**: View and manage blocked IP addresses

### Data Backup

- **Automatic Backup**: Scheduled database backups with configurable intervals
- **Manual Backup**: Admin panel supports one-click backup
- **Recovery Mechanism**: Quick data and configuration recovery with atomic operations
- **Backup Status**: Real-time backup status and history tracking

### Log Management

- **Structured Logging**: JSON format, easy to analyze
- **Access Logs** (v1.4.0): Detailed request logs with IP and endpoint information
- **Log Rotation**: Automatic cleanup of expired logs
- **Log Query**: Admin panel supports log search and filtering

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - Powerful React framework
- [Prisma](https://www.prisma.io/) - Modern database toolkit
- [Cloudinary](https://cloudinary.com/) - Professional image cloud service
- [TgState](https://github.com/csznet/tgState) - Open-source Telegram image hosting service
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

**Current Version**: v1.13.5 | **Last Updated**: 2025-12-13

For issues or suggestions, feel free to submit an Issue or Pull Request!
