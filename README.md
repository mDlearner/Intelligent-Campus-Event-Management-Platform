# Intelligent Campus Event Management Platform

A full-stack MERN campus events platform for discovering events, registration, profile management, notifications, and admin/club workflows.

## Stack

- Frontend: React, Vite, Tailwind CSS, React Router, React Query, Vitest
- Backend: Node.js, Express, MongoDB, Mongoose, JWT auth, Zod
- Email: Resend (primary when configured) with SMTP fallback

## Monorepo Structure

- client: React app
- server: Express API
- package.json (root): workspace scripts to run both apps together

## Quick Start

1. Install dependencies

```bash
npm install
npm install --prefix client
npm install --prefix server
```

2. Configure backend environment

```bash
cd server
cp .env.example .env
```

3. Run both frontend and backend from root

```bash
cd ..
npm run dev
```

Default local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## Available Scripts

From root:

- npm run dev: starts server and client together
- npm run dev:server: starts backend only
- npm run dev:client: starts frontend only
- npm run build: builds frontend
- npm run test: runs backend and frontend tests

From client:

- npm run dev
- npm run test
- npm run build

From server:

- npm run dev
- npm run test

## Backend Environment Variables

Required:

- MONGODB_URI
- JWT_SECRET
- CORS_ORIGIN

General:

- PORT (default 5000)
- JWT_EXPIRES_IN (default 7d)
- LOG_LEVEL (default info)
- DNS_RESULT_ORDER (recommended ipv4first)

SMTP settings (fallback provider):

- SMTP_HOST
- SMTP_PORT (default 587)
- SMTP_FAMILY (default 4)
- SMTP_USER
- SMTP_PASS
- SMTP_SECURE (true or false)
- SMTP_FROM
- SMTP_CONNECTION_TIMEOUT_MS
- SMTP_GREETING_TIMEOUT_MS
- SMTP_SOCKET_TIMEOUT_MS
- EMAIL_SEND_TIMEOUT_MS
- VERIFICATION_RECIPIENT
- OTP_BACKGROUND_DISPATCH

Resend settings (primary provider when configured):

- RESEND_API_KEY
- RESEND_FROM

## Email Delivery Behavior

- If RESEND_API_KEY and RESEND_FROM are set, email is sent through Resend.
- If Resend is not configured, SMTP is used.
- SMTP supports IPv4-first host resolution and timeout controls for stability.

## Current Features

- Auth flows: register, login, OTP verification, resend OTP, profile updates
- Role-aware access for student, club, and admin actions
- Event discovery with:
	- Search
	- Category filtering
	- Active and ended event views
	- Infinite scroll and load-more fallback
- Event registration and QR pass view in dashboard
- Notifications and user dashboard metrics
- Mobile-focused UI improvements:
	- Hamburger menu with slide panel
	- Better spacing under fixed navbar
	- Search field sync improvements between navbar and events page
	- Compact mobile cards and footer layout

## Testing

Run all tests:

```bash
npm run test
```

Run frontend tests only:

```bash
npm run test --prefix client
```

Run backend tests only:

```bash
npm run test --prefix server
```

## Production Notes

- Set CORS_ORIGIN to your deployed frontend domain.
- Use strong JWT secrets and rotate credentials if exposed.
- Configure at least one email provider before enabling production OTP flows.
- For custom domains, ensure DNS records are correct and SSL provisioning has completed.
