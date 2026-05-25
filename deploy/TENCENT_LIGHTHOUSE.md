# Tencent Cloud Low-Cost Deploy

This project is already suitable for a low-cost phone web app release:
- one Tencent Cloud Lighthouse server
- one domain
- Nginx
- PM2

No separate frontend hosting is required because the Express server already serves `dist/`.

## Recommended spec

For 3 to 20 friends:
- 2 vCPU
- 2 GB RAM
- Ubuntu 22.04
- 40 GB disk is enough for early testing

## 1. Prepare the server

Install base tools:

```bash
sudo apt update
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Upload the project

Recommended directory:

```bash
sudo mkdir -p /opt/smart-closet
sudo chown -R $USER:$USER /opt/smart-closet
```

Then clone or upload the project into:

```bash
/opt/smart-closet
```

## 3. Install and build

```bash
cd /opt/smart-closet
npm install
npm run build
```

## 4. Create production env

Copy the template and edit it:

```bash
cp .env.production.example .env.production
```

Minimum values to change:
- `CORS_ORIGIN=https://your-domain.com`
- `SMS_PROVIDER`
- `DASHSCOPE_API_KEY`
- `TRYON_PROVIDER`

If you deploy the frontend and backend from the same domain, keep:

```env
VITE_API_BASE_URL=
```

## 5. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:3001/api/health
```

## 6. Configure Nginx

Copy the provided config:

```bash
sudo cp deploy/nginx-smart-closet.conf /etc/nginx/sites-available/smart-closet
```

Edit the domain name inside the file, then enable it:

```bash
sudo ln -s /etc/nginx/sites-available/smart-closet /etc/nginx/sites-enabled/smart-closet
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Enable HTTPS

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 8. Backup

This project currently stores data locally:
- `server/data/app.db`
- `server/uploads`

Add the provided backup script:

```bash
chmod +x deploy/backup-smart-closet.sh
```

Example cron job, every day at 3:30 AM:

```bash
crontab -e
```

```cron
30 3 * * * APP_DIR=/opt/smart-closet BACKUP_DIR=/opt/backups/smart-closet /opt/smart-closet/deploy/backup-smart-closet.sh
```

## Cheapest friend-test mode

If this is only for a few trusted friends, the lowest-cost path is:
- keep one Lighthouse server
- keep SQLite
- keep local uploads
- use PM2 instead of Docker

But you should still avoid leaving production on a public fixed dev code.

## Suggested release order

1. Put the site online behind HTTPS.
2. Test on your own phone first.
3. Invite 3 friends.
4. Watch disk usage in `server/uploads`.
5. Only after stable usage, consider moving uploads to COS and SMS to a real provider.
