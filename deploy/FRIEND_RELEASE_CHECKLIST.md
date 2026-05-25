# Friend Release Checklist

This is the lowest-cost release path for a small trusted group.

## Before server purchase

- Prepare one domain name.
- Prepare Tencent Cloud Lighthouse with Ubuntu 22.04.
- Decide whether login is:
  - temporary trusted-mode login
  - real SMS login

## Lowest-cost recommended mode

For 3 to 10 friends, keep:
- one Lighthouse server
- SQLite
- local uploads
- PM2
- Nginx

Do not add COS, CDN, or Kubernetes yet.

## Must-fix before sending the link

- `CORS_ORIGIN` must be your real domain.
- `DEV_LOGIN_CODE` must not stay public if outsiders can access the site.
- `DASHSCOPE_API_KEY` must be set on the server only.
- HTTPS must be enabled.
- `server/data` and `server/uploads` must be backed up.

## Nice-to-have, but can wait

- Real SMS provider
- Object storage for uploads
- Better PWA icons
- Cookie-based auth instead of localStorage token

## First internal test

Test on your own phone:
- open homepage
- login
- upload one reference photo
- upload one clothing image
- generate single-item try-on
- generate one look preview
- reopen on mobile browser and confirm the session still works

## Invite-friends phase

Invite only a few trusted friends first.

Recommended order:
1. 2 friends
2. 5 friends
3. 10 friends

Watch:
- disk space
- upload speed
- login failures
- try-on failure messages

## If something breaks

Quick rollback:
- restore the last backup in `server/data`
- restore `server/uploads`
- restart PM2 app
