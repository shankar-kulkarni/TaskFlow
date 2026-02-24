# Set working directories
cd C:\vscode\SaaS\Task\services\task-service

# Check .env
Write-Host "Checking .env..."
Get-Content .env

# Install dependencies and build backend
npm install
npx prisma generate
npm run build

# Seed database
npx prisma db seed

# Start Docker services
cd infrastructure
docker-compose up -d --build

# Check Docker status
docker ps
docker network ls

# Build frontend
cd ..\..\..\clients\web
npm install
npm run build