#!/bin/bash
# ========================================================
# HRMS Linux Auto-Deployment Script
# Optimized for Ubuntu 22.04+
# ========================================================

echo "🚀 Starting HRMS Deployment..."

# 1. System Updates & Dependencies
echo "📦 Installing System Dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nodejs npm nginx git curl

# Install PM2 globally to manage processes
sudo npm install -g pm2

# 2. Project Directory Setup
PROJECT_ROOT=$(pwd)
echo "📂 Project Root: $PROJECT_ROOT"

# 3. Backend Setup
echo "🐍 Setting up Backend..."
cd $PROJECT_ROOT/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
# Check if aiosqlite is installed (essential for our async sqlite)
pip install aiosqlite sqlalchemy uvicorn

# Start Backend with PM2
pm2 delete hrms-backend 2>/dev/null
pm2 start "python3 run_server.py" --name hrms-backend

# 4. Frontend Builds
echo "💻 Building Frontends..."

# Admin Panel
echo "--- Building Admin Panel ---"
cd $PROJECT_ROOT/admin-panel
# VITE_BASE_PATH set करा — /admin/ prefix साठी
echo "VITE_BASE_PATH=/admin/" > .env.local
npm install
npm run build

# Employee App
echo "--- Building Employee App ---"
cd $PROJECT_ROOT/employee-app
npm install
npm run build

# PWA App
echo "--- Building PWA Face App ---"
cd $PROJECT_ROOT/pwa-app
npm install
npm run build

# 5. Nginx Configuration
echo "🌐 Configuring Nginx..."

cat <<'NGINXEOF' | sudo tee /etc/nginx/sites-available/hrms
server {
    listen 80;
    server_name _;

    location / {
        root PROJECT_ROOT_PLACEHOLDER;
        index landing.html;
        try_files $uri $uri/ /landing.html;
    }

    location /admin/ {
        alias PROJECT_ROOT_PLACEHOLDER/admin-panel/dist/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }

    location /employee/ {
        alias PROJECT_ROOT_PLACEHOLDER/employee-app/dist/;
        index index.html;
        try_files $uri $uri/ /employee/index.html;
    }

    location /face/ {
        alias PROJECT_ROOT_PLACEHOLDER/pwa-app/dist/;
        index index.html;
        try_files $uri $uri/ /face/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8401;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /license-srv/ {
        proxy_pass https://license.vrushaliinfotech.com/api/;
        proxy_set_header Host license.vrushaliinfotech.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }
}
NGINXEOF

# PROJECT_ROOT replace करा
sudo sed -i "s|PROJECT_ROOT_PLACEHOLDER|$PROJECT_ROOT|g" /etc/nginx/sites-available/hrms

# Enable the config and restart Nginx
sudo ln -s /etc/nginx/sites-available/hrms /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null
sudo nginx -t && sudo systemctl restart nginx

# 6. Final Status
echo "========================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "Backend: Running on PM2 (hrms-backend)"
echo "Web Port: 80 (Nginx)"
echo "Access at: http://your-vps-ip/"
echo "========================================================"
pm2 status
