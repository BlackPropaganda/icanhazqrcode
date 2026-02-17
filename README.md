# Icanhazqrcode (Cloudflare Worker)

A simple HTTP QR service just for fun.

## Endpoints

- `GET /`: Landing page (QR form + one ad slot with fallback).
- `GET /health`: Service metadata.
- `GET /robots.txt`: Basic crawler policy + sitemap location.
- `GET /sitemap.xml`: Sitemap for landing page indexing.
- `GET /llms.txt`: LLM-oriented, human-readable usage/context metadata.
- `GET /qr?data=<text>&scale=8&border=4&ecc=M`: Returns `image/svg+xml` QR bytes.
- `POST /qr`: Accepts:
  - `application/json`: `{ "data": "hello", "scale": 8, "border": 4, "ecc": "M" }`
  - `text/plain`: raw text body

## Parameter rules

- `data` max length: 2048 chars
- `scale`: integer `1..40`
- `border`: integer `0..20`
- `ecc`: `L`, `M`, `Q`, or `H`

## Run locally

```bash
npm install
npm run dev
```

Then test:

```bash
curl "http://127.0.0.1:8787/qr?data=icanhazqrcode" -o qr.svg
```

## Deploy

```bash
npm run deploy
```

## Optional: Enable AdSense on Landing Page

In `wrangler.toml`, set:

```toml
[vars]
ADSENSE_CLIENT = "ca-pub-1234567890123456"
ADSENSE_SLOT = "1234567890"
```

If either var is missing or invalid, the page shows a non-intrusive fallback card instead of ad script.
