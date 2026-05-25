# Cloudflare Named Tunnel Upgrade

Use this when you want a fixed domain instead of a temporary `trycloudflare.com` URL.

## Requirements

- A domain name you control
- The domain added to Cloudflare
- Windows app machine stays online

## Recommended result

Example:

```text
https://closet.your-domain.com
```

## Steps

### 1. Log in to Cloudflare from cloudflared

```powershell
cloudflared tunnel login
```

This opens a browser window. Authorize the domain you want to use.

### 2. Create a named tunnel

```powershell
cloudflared tunnel create smart-closet
```

### 3. Create DNS record

```powershell
cloudflared tunnel route dns smart-closet closet.your-domain.com
```

### 4. Create local config

Save this as:

```text
%USERPROFILE%\.cloudflared\config.yml
```

Example:

```yaml
tunnel: smart-closet
credentials-file: C:\Users\YOUR_USER\.cloudflared\<generated-id>.json

ingress:
  - hostname: closet.your-domain.com
    service: http://127.0.0.1:3001
  - service: http_status:404
```

### 5. Run the tunnel

```powershell
cloudflared tunnel run smart-closet
```

## Notes

- Named tunnel gives you a stable domain.
- It is much better than a quick tunnel for repeated friend testing.
- Your local PC still needs to stay online.
