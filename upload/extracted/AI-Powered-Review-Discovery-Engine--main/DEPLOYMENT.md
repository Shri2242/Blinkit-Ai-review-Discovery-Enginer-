# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- A server with at least 2GB RAM (4GB recommended for AI features)
- Domain name (optional, for HTTPS)

## Quick Start (Production)

1. Clone the repository
2. Copy `.env.production.example` to `.env.production`
3. Fill in all environment variables (especially passwords and API keys)
4. Run: `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`
5. Run database migrations:
   `docker compose -f docker-compose.prod.yml exec api node packages/database/dist/migrate.js`
6. Access the application at `http://your-server-ip`

## HTTPS Setup (with Let's Encrypt)

1. Install certbot on the host
2. Get certificates: `certbot certonly --standalone -d yourdomain.com`
3. Update `nginx.conf` to use SSL (see comments in the config)
4. Mount cert volumes in `docker-compose.prod.yml`

## Monitoring

- Health check: `GET /api/v1/health`
- Docker logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Database backup: `docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres review_engine > backup.sql`

## Common Issues

- **Embeddings model download**: First embedding generation downloads ~30MB model. Allow time on first run.
- **Memory**: AI processing can be memory-intensive. Monitor with `docker stats`.
- **Rate limits**: Nginx limits API to 30 req/s and auth to 5 req/min by default.
