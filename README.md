# Intelligent Campus Event Management Platform (MERN)

## Quick Start

### Server
```
cd server
npm install
cp .env.example .env
npm run dev
```

### Client
```
cd client
npm install
npm run dev
```

## Environment Variables (server)
- `MONGODB_URI`
- `JWT_SECRET`
- `CORS_ORIGIN` (for production, set to your frontend URL)
- `PORT` (optional, default 5000)
- `JWT_EXPIRES_IN` (optional, default `7d`)
- `LOG_LEVEL` (optional, default `info`)

Optional email settings:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`
