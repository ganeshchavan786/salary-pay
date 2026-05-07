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

cat <<EOF | sudo tee /etc/nginx/sites-available/hrms
server {
    listen 80;
    server_name _; # Change this to your domain later

    # Landing Page
    location / {
        root $PROJECT_ROOT;
        index landing.html;
        try_files \$uri \$uri/ /landing.html;
    }

    # Admin Panel
    location /admin/ {
        alias $PROJECT_ROOT/admin-panel/dist/;
        index index.html;
        try_files \$uri \$uri/ /admin/index.html;
    }

    # Employee App
    location /employee/ {
        alias $PROJECT_ROOT/employee-app/dist/;
        index index.html;
        try_files \$uri \$uri/ /employee/index.html;
    }

    # Face PWA App
    location /face/ {
        alias $PROJECT_ROOT/pwa-app/dist/;
        index index.html;
        try_files \$uri \$uri/ /face/index.html;
    }

    # API Proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8401;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

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
