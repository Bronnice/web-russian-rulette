# SSL/HTTPS Setup Instructions

## Problem
When deploying to a server with HTTPS, WebSocket connections fail with the error:
```
SecurityError: Failed to construct 'WebSocket': An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.
```

## Solution
The application now automatically detects HTTPS and uses secure WebSocket (`wss://`) connections.

## Server Setup Options

### Option 1: Use a Reverse Proxy (Recommended)
Most production deployments use a reverse proxy like **Nginx** or **Apache** to handle SSL/TLS termination.

#### Nginx Configuration Example:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 2: Direct SSL in Node.js
If you want Node.js to handle SSL directly, create an `ssl` directory with certificates:

1. Create the ssl directory:
```bash
mkdir ssl
```

2. Generate self-signed certificates (for development):
```bash
openssl req -nodes -new -x509 -keyout ssl/key.pem -out ssl/cert.pem -days 365
```

3. For production, use certificates from a Certificate Authority like:
   - **Let's Encrypt** (free): https://letsencrypt.org/
   - **Certbot**: https://certbot.eff.org/

4. Place your certificates in the `ssl` directory:
   - `ssl/key.pem` - Private key
   - `ssl/cert.pem` - Certificate

The server will automatically detect and use these certificates.

### Option 3: Cloud Platform SSL
If deploying to platforms like:
- **Heroku**: SSL is automatically handled
- **Vercel/Netlify**: SSL is automatically handled
- **AWS/Azure/GCP**: Configure SSL in load balancer or application gateway

No additional configuration needed - the platform handles SSL termination.

## Verification

After setup, verify the connection:
1. Open browser console (F12)
2. Look for: `Connecting to WebSocket: wss://yourdomain.com`
3. Should see: `WebSocket connected successfully`

## Troubleshooting

### Still getting connection errors?
1. Check if SSL certificates are valid and not expired
2. Ensure WebSocket upgrade headers are properly configured
3. Check firewall rules allow WebSocket connections
4. Verify the port is accessible from the internet

### Mixed Content Warnings?
Ensure all resources (CSS, JS, images) are loaded over HTTPS or use relative URLs.