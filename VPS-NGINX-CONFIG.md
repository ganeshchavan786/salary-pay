# VPS Nginx Configuration — salarypay.vrushaliinfotech.com

## File Location
`/etc/nginx/sites-enabled/salarypay.conf`

## Current Config (with /license-srv/ proxy)

```nginx
server {
    server_name salarypay.vrushaliinfotech.com;

    location / {
        root /var/www/salary-pay;
        index landing.html;
        try_files $uri $uri/ /landing.html;
    }

    location /admin/ {
        alias /var/www/salary-pay/admin-panel/dist/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }

    location /employee/ {
        alias /var/www/salary-pay/employee-app/dist/;
        index index.html;
        try_files $uri $uri/ /employee/index.html;
    }

    location /face/ {
        alias /var/www/salary-pay/pwa-app/dist/;
        index index.html;
        try_files $uri $uri/ /face/index.html;
    }

    # License Server Proxy (CORS fix for landing page registration)
    location /license-srv/ {
        proxy_pass https://license.vrushaliinfotech.com/api/;
        proxy_set_header Host license.vrushaliinfotech.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8401;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/salarypay.vrushaliinfotech.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/salarypay.vrushaliinfotech.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = salarypay.vrushaliinfotech.com) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name salarypay.vrushaliinfotech.com;
    return 404;
}
```

## Important Note
`/license-srv/` location manually added on VPS (09 May 2026).
This proxies landing page registration calls to License Server to bypass CORS.
