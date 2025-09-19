# HTTP/2 Setup Guide

This guide explains how to configure HTTP/2 for your FileFlow backend application.

## Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```bash
# HTTP/2 Configuration
HTTP2_ENABLED=true
SSL_ENABLED=false

# SSL/TLS Configuration (required for production HTTP/2)
# SSL_CERT_PATH=/path/to/your/certificate.crt
# SSL_KEY_PATH=/path/to/your/private.key
```

### Development Setup (HTTP/2 without SSL)

For development, you can run HTTP/2 without SSL:

```bash
HTTP2_ENABLED=true
SSL_ENABLED=false
```



## SSL Certificate Generation

### Self-signed Certificate (Development)

```bash
# Create certificates directory
mkdir -p FileFlowBe/certs
cd FileFlowBe/certs

# Generate private key and certificate in one command
openssl req -nodes -new -x509 -keyout server.key -out server.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Or generate them separately:
# openssl genrsa -out server.key 2048
# openssl req -new -x509 -key server.key -out server.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Environment Variables with Proper Paths

For your project structure, use these paths in your `.env` file:

```bash
# HTTP/2 Configuration
HTTP2_ENABLED=true
SSL_ENABLED=true

# SSL/TLS Configuration (relative to project root)
SSL_CERT_PATH=./certs/server.crt
SSL_KEY_PATH=./certs/server.key

openssl req -nodes -new -x509 -keyout server.key -out server.crt -days 365

```
### Alternative Paths

You can also use absolute paths:

```bash
# Windows
SSL_CERT_PATH=C:\Users\ASUS\OneDrive\Desktop\projects\fileflow\FileFlowBe\certs\server.crt
SSL_KEY_PATH=C:\Users\ASUS\OneDrive\Desktop\projects\fileflow\FileFlowBe\certs\server.key

# Linux/Mac
SSL_CERT_PATH=/home/user/projects/fileflow/FileFlowBe/certs/server.crt
SSL_KEY_PATH=/home/user/projects/fileflow/FileFlowBe/certs/server.key
```
### Let's Encrypt (Production)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com
```

## Testing HTTP/2

### Using curl

```bash
# Test HTTP/2
curl --http2 -v https://localhost:3000

# Test with HTTP/1.1 fallback
curl --http1.1 -v https://localhost:3000
```

### Using browser

1. Open Developer Tools (F12)
2. Go to Network tab
3. Look for "Protocol" column
4. Should show "h2" for HTTP/2 requests

## Browser Support

Most modern browsers support HTTP/2, but they require HTTPS in production:
- Chrome: ✅ (requires HTTPS)
- Firefox: ✅ (requires HTTPS)
- Safari: ✅ (requires HTTPS)
- Edge: ✅ (requires HTTPS)

## Benefits of HTTP/2

1. **Multiplexing**: Multiple requests over a single connection
2. **Server Push**: Server can push resources proactively
3. **Header Compression**: Reduces overhead with HPACK
4. **Binary Protocol**: More efficient than HTTP/1.1 text protocol
5. **Stream Prioritization**: Better resource loading order

## Troubleshooting

### Common Issues

1. **HTTP/2 not working**: Ensure SSL is enabled in production
2. **Certificate errors**: Check certificate paths and permissions
3. **Browser compatibility**: Some browsers require HTTPS for HTTP/2

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

This will show detailed server startup information including HTTP/2 status.
