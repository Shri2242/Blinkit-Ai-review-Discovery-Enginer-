#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — First-time project setup
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "🔧 Review Discovery Engine — Setup"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Run: npm install -g pnpm"; exit 1; }

echo "✅ Node.js $(node --version)"
echo "✅ pnpm $(pnpm --version)"
echo ""

# Copy .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created .env from .env.example — fill in your API keys"
else
  echo "📝 .env already exists, skipping"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start infrastructure:  docker compose -f infrastructure/docker/docker-compose.yml up -d"
echo "  2. Run migrations:        pnpm db:migrate"
echo "  3. Seed demo data:        pnpm db:seed"
echo "  4. Start development:     pnpm dev"
