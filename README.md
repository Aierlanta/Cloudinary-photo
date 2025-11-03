[简体中文](./README.zh-CN.md) ｜ English（当前）

# Random Image API Service

[![wakatime](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d.svg)](https://wakatime.com/badge/user/7dcace4a-8c3d-4c31-8e2c-ca241719b01b/project/a1234166-0f5e-4b15-a40f-bc487950578d)

A random image API service based on Next.js 14, supporting multiple image hosting storage with a complete management panel.

## Preview

### Homepage Preview

<img width="2548" height="1315" alt="image" src="https://github.com/user-attachments/assets/c9f9b5d5-45f6-44c5-8086-286ebe42766d" />

### Dashboard

<img width="2560" height="1316" alt="image" src="https://github.com/user-attachments/assets/05cb8c91-f2ca-425c-ba63-cb6b2163ab5b" />

### Image Management

<img width="2558" height="1314" alt="image" src="https://github.com/user-attachments/assets/3335edca-b09d-45f0-bb45-9ffe1346e27c" />

### Group Management

<img width="2560" height="1321" alt="image" src="https://github.com/user-attachments/assets/95e31a3d-cd33-4dff-abba-e280273ec09d" />

### API Configuration

<img width="2560" height="1312" alt="image" src="https://github.com/user-attachments/assets/1d33cb5b-ee1e-49a6-96e2-781eb030c60d" />

### System Status

<img width="2560" height="1306" alt="image" src="https://github.com/user-attachments/assets/4fdf46e7-54e7-4169-84c6-369179bfd9fc" />

### System Logs

<img width="2556" height="1310" alt="image" src="https://github.com/user-attachments/assets/651e9756-7c76-4f69-b0f3-b3a07d044c30" />

### Backup Management

<img width="2560" height="1306" alt="image" src="https://github.com/user-attachments/assets/a3801ac3-1592-4641-8d5a-d5ca0eb29730" />

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

# Cloudinary image hosting configuration (primary)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# TgState image hosting configuration (optional)
TGSTATE_BASE_URL=https://your-tgstate-domain.com

# Admin authentication
ADMIN_PASSWORD=your_secure_admin_password
```

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

**Function**: Get a random image, supports group filtering and parameter configuration
**Response**: 302 redirect to image URL
**Parameters**:

- `key` - API key (required if authentication is enabled)
- Supports custom parameters (configured via admin panel)
- Example: `?group=wallpaper&category=nature`
- Example with key: `?group=wallpaper&key=your-api-key`

#### Direct Response Endpoint

```http
GET /api/response
```

**Function**: Directly return image data (optional feature)
**Response**: Image binary data
**Use Case**: Suitable for scenarios requiring direct image content retrieval

**Parameters**:

- `key` - API key (required if authentication is enabled)
- `opacity` - Image opacity (0-1.0), 0 for fully transparent, 1 for fully opaque (optional)
- `bgColor` - Background color (optional), supports the following formats:
  - Preset color names: `white` (default), `black`
  - Hexadecimal: `ffffff` or `#ffffff`

**Usage Examples**:

```bash
# Original image (no transparency adjustment)
GET /api/response

# With API Key
GET /api/response?key=your-api-key

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
GET    /api/admin/images           # Get image list (supports pagination, filtering)
POST   /api/admin/images           # Upload images (supports batch upload)
PUT    /api/admin/images/[id]      # Update image information
DELETE /api/admin/images/[id]      # Delete image
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
│   │   │   └── factory.ts     # Service factory
│   │   ├── database/          # Database services
│   │   ├── auth.ts            # Authentication service
│   │   ├── security.ts        # Security middleware
│   │   ├── logger.ts          # Logging service
│   │   └── utils.ts           # Utility functions
│   ├── types/                 # TypeScript type definitions
│   │   ├── models.ts          # Data models
│   │   ├── api.ts             # API types
│   │   ├── errors.ts          # Error types
│   │   └── schemas.ts         # Validation schemas
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

- **Multi-host Architecture**: Supports Cloudinary and TgState
- **Failover**: Automatic service status detection and intelligent switching
- **Unified Interface**: Abstract storage operations for easy extension of new image hosting services

#### Security System (`src/lib/security.ts`)

- **Request Rate Limiting**: Prevent API abuse
- **Parameter Validation**: Strict input validation
- **Access Control**: Role-based permission management

#### Monitoring System (`src/lib/logger.ts`)

- **Structured Logging**: Unified log format
- **Performance Monitoring**: API response time tracking
- **Error Tracking**: Detailed error information logging

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

## Monitoring and Maintenance

### System Monitoring

- **Health Check**: `/api/health` endpoint provides system status
- **Performance Metrics**: API response time and success rate statistics
- **Resource Monitoring**: Database connections, storage usage
- **Error Tracking**: Detailed error logs and stack information

### Data Backup

- **Automatic Backup**: Regular database and configuration backup
- **Manual Backup**: Admin panel supports one-click backup
- **Recovery Mechanism**: Quick data and configuration recovery

### Log Management

- **Structured Logging**: JSON format, easy to analyze
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

**Current Version**: v1.0.1 | **Last Updated**: 2025-11-03

For issues or suggestions, feel free to submit an Issue or Pull Request!
