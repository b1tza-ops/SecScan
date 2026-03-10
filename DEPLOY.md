# Deployment Guide

## Prerequisites
- Ubuntu VPS with Docker and Docker Compose installed
- Domain pointing to your server's IP

## Quick Start

### 1. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
```

### 2. Clone and configure
```bash
cd /opt/apps/securityscan
cp .env.example .env
nano .env   # Fill in all values
```

### 3. SSL Certificate (first time)
```bash
# Start nginx in HTTP-only mode first
docker compose up -d nginx certbot

# Get certificate
make ssl-init DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com
```

### 4. Launch all services
```bash
make build
make up
make logs
```

### 5. Stripe Setup
1. Create products in Stripe Dashboard
2. Copy price IDs to .env
3. Set webhook endpoint: `https://yourdomain.com/api/subscription/webhook`
4. Select events: `checkout.session.completed`, `customer.subscription.deleted`

### 6. Create admin user
```bash
make db-shell
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

## Useful Commands
```bash
make logs          # View all logs
make ps            # Service status
make shell-backend # Shell into backend
make db-shell      # PostgreSQL shell
make restart       # Restart all services
make deploy        # Pull + rebuild + restart
```
