import qrcode from "qrcode-generator";

type Env = {
  ADSENSE_CLIENT?: string;
  ADSENSE_SLOT?: string;
};

const MAX_DATA_LENGTH = 2048;
const DEFAULT_SCALE = 8;
const MAX_SCALE = 40;
const DEFAULT_BORDER = 4;
const MAX_BORDER = 20;
const DEFAULT_ERROR_CORRECTION = "M";
const ALLOWED_ERROR_CORRECTION = new Set(["L", "M", "Q", "H"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return landingPage(url, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return healthResponse();
    }

    if (request.method === "GET" && url.pathname === "/robots.txt") {
      return robotsTxt(url);
    }

    if (request.method === "GET" && url.pathname === "/sitemap.xml") {
      return sitemapXml(url);
    }

    if (request.method === "GET" && url.pathname === "/llms.txt") {
      return llmsTxt(url);
    }

    if (request.method === "GET" && url.pathname === "/qr") {
      return qrFromQuery(url);
    }

    if (request.method === "POST" && url.pathname === "/qr") {
      return qrFromBody(request, url);
    }

    return json(
      {
        error: "Not Found",
        hint: "Use GET /qr?data=hello or POST /qr with raw text or JSON {\"data\":\"hello\"}",
      },
      404,
    );
  },
};

function healthResponse(): Response {
  return json({
    service: "icanhazqrcode",
    endpoints: [
      "GET / (landing page with QR form + optional ad slot)",
      "GET /robots.txt",
      "GET /sitemap.xml",
      "GET /llms.txt",
      "GET /qr?data=<text>&scale=8&border=4&ecc=M",
      "POST /qr (text/plain or application/json {data, scale, border, ecc})",
    ],
  });
}

function landingPage(url: URL, env: Env): Response {
  const adClient = safeAdClient(env.ADSENSE_CLIENT);
  const adSlot = safeAdSlot(env.ADSENSE_SLOT);
  const adEnabled = Boolean(adClient && adSlot);
  const adMarkup = adEnabled ? adUnitMarkup(adClient!, adSlot!) : fallbackAdMarkup();
  const adScript = adClient ? adsenseScriptMarkup(adClient) : "";
  const adMeta = adClient ? adsenseMetaMarkup(adClient) : "";
  const siteUrl = `${url.protocol}//${url.host}`;
  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I generate a QR code from the API?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Use GET /qr?data=your-text. Optional parameters are scale, border, and ecc.",
        },
      },
      {
        "@type": "Question",
        name: "What are the input limits?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Data is limited to ${MAX_DATA_LENGTH} characters. Scale is 1 to ${MAX_SCALE}. Border is 0 to ${MAX_BORDER}.`,
        },
      },
    ],
  });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Icanhazqrcode | Free QR Code Generator API</title>
  <meta name="description" content="Generate QR code SVGs instantly. Use Icanhazqrcode from a browser or API with simple GET and POST requests.">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${siteUrl}/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Icanhazqrcode | Free QR Code Generator API">
  <meta property="og:description" content="Fast QR code generation with a tiny API. Get SVG output in one request.">
  <meta property="og:url" content="${siteUrl}/">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Icanhazqrcode">
  <meta name="twitter:description" content="Simple QR code API with instant SVG output.">
  ${adMeta}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script type="application/ld+json">${faqSchema}</script>
  ${adScript}
  <style>
    :root {
      --ink: #1d212b;
      --paper: #fffdf8;
      --accent: #0f766e;
      --accent-soft: #99f6e4;
      --surface: #ffffff;
      --line: #d9d4ca;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", ui-sans-serif, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 8% 10%, #fef3c7 0 22%, transparent 23%),
        radial-gradient(circle at 96% 85%, #bfdbfe 0 18%, transparent 19%),
        linear-gradient(145deg, #fffaf0, #f9fafb);
      min-height: 100vh;
    }
    .wrap {
      width: min(960px, calc(100% - 2rem));
      margin: 2rem auto;
      display: grid;
      gap: 1rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 8px 30px rgba(18, 24, 40, 0.08);
      padding: 1rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.6rem, 5vw, 2.6rem);
      letter-spacing: -0.04em;
    }
    .sub {
      margin: 0.5rem 0 0;
      font-size: 1rem;
      color: #364152;
      max-width: 70ch;
    }
    form {
      display: grid;
      gap: 0.8rem;
      margin-top: 0.8rem;
    }
    label {
      font-size: 0.9rem;
      font-weight: 500;
    }
    input, select, button {
      width: 100%;
      font: inherit;
      border-radius: 10px;
      border: 1px solid #cfd8e3;
      padding: 0.68rem 0.75rem;
      background: #fff;
    }
    .row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.7rem;
    }
    button {
      border: none;
      color: #fff;
      background: linear-gradient(100deg, #0f766e, #0e7490);
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { filter: brightness(1.03); }
    .out {
      display: grid;
      gap: 0.65rem;
      margin-top: 0.8rem;
      align-items: start;
    }
    #qr-img {
      max-width: min(360px, 100%);
      border: 1px solid #ddd6ca;
      border-radius: 10px;
      background: #fff;
      padding: 0.5rem;
      display: none;
    }
    #link {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.87rem;
      word-break: break-all;
    }
    .ad-label {
      margin: 0 0 0.6rem;
      font-size: 0.74rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5f6b7a;
    }
    .ad-fallback {
      font-size: 0.94rem;
      color: #344054;
      padding: 0.8rem;
      border: 1px dashed #9ca3af;
      border-radius: 12px;
      background: #f8fafc;
    }
    h2 {
      margin: 0 0 0.45rem;
      font-size: 1.2rem;
      letter-spacing: -0.02em;
    }
    .copy {
      margin: 0;
      color: #344054;
      line-height: 1.45;
    }
    .list {
      margin: 0.5rem 0 0;
      padding-left: 1rem;
      color: #344054;
    }
    .list li { margin-bottom: 0.34rem; }
    .api-box {
      margin-top: 0.6rem;
      padding: 0.7rem 0.8rem;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.82rem;
      overflow-x: auto;
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .row { grid-template-columns: 1fr; }
      .wrap { margin: 1rem auto; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Icanhazqrcode</h1>
      <p class="sub">Drop in text, URL, or anything short. This page makes a QR instantly and can be called as an API.</p>
      <form id="qr-form">
        <div>
          <label for="data">Data</label>
          <input id="data" name="data" required maxlength="${MAX_DATA_LENGTH}" placeholder="https://example.com/hello">
        </div>
        <div class="row">
          <div>
            <label for="scale">Scale</label>
            <input id="scale" name="scale" type="number" min="1" max="${MAX_SCALE}" value="${DEFAULT_SCALE}">
          </div>
          <div>
            <label for="border">Border</label>
            <input id="border" name="border" type="number" min="0" max="${MAX_BORDER}" value="${DEFAULT_BORDER}">
          </div>
          <div>
            <label for="ecc">Error Correction</label>
            <select id="ecc" name="ecc">
              <option value="L">L</option>
              <option value="M" selected>M</option>
              <option value="Q">Q</option>
              <option value="H">H</option>
            </select>
          </div>
        </div>
        <button type="submit">Generate QR</button>
      </form>
      <div class="out">
        <img id="qr-img" alt="Generated QR code">
        <a id="link" href="/qr?data=hello">/qr?data=hello</a>
      </div>
    </section>
    <aside class="card">
      <p class="ad-label">Support This Project</p>
      ${adMarkup}
    </aside>
    <section class="card">
      <h2>How To Use</h2>
      <p class="copy">Use the form above for quick generation, or call the API directly from scripts, apps, and bots.</p>
      <div class="api-box">GET ${siteUrl}/qr?data=hello-world&scale=8&border=4&ecc=M</div>
      <div class="api-box">POST ${siteUrl}/qr with text/plain body or JSON {"data":"hello-world"}</div>
    </section>
    <section class="card">
      <h2>Restrictions</h2>
      <ul class="list">
        <li>Input length is capped at ${MAX_DATA_LENGTH} characters.</li>
        <li>Scale must be an integer from 1 to ${MAX_SCALE}.</li>
        <li>Border must be an integer from 0 to ${MAX_BORDER}.</li>
        <li>Error correction level must be one of L, M, Q, or H.</li>
      </ul>
    </section>
    <section class="card">
      <h2>Limitations</h2>
      <ul class="list">
        <li>Output format is SVG only.</li>
        <li>No long-term storage of generated QR content.</li>
        <li>No availability SLA; this is a hobby service.</li>
        <li>Do not submit secrets, passwords, or private tokens.</li>
      </ul>
    </section>
  </main>
  <script>
    const form = document.getElementById("qr-form");
    const img = document.getElementById("qr-img");
    const link = document.getElementById("link");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const params = new URLSearchParams({
        data: String(data.get("data") || ""),
        scale: String(data.get("scale") || "${DEFAULT_SCALE}"),
        border: String(data.get("border") || "${DEFAULT_BORDER}"),
        ecc: String(data.get("ecc") || "${DEFAULT_ERROR_CORRECTION}"),
      });
      const path = "/qr?" + params.toString();
      img.src = path;
      img.style.display = "block";
      link.href = path;
      link.textContent = path;
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function robotsTxt(url: URL): Response {
  const origin = `${url.protocol}//${url.host}`;
  const body = `User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function sitemapXml(url: URL): Response {
  const origin = `${url.protocol}//${url.host}`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
  </url>
</urlset>`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function llmsTxt(url: URL): Response {
  const origin = `${url.protocol}//${url.host}`;
  const body = `# Icanhazqrcode

> Lightweight QR code generation service for quick conversion of text and URLs into SVG QR codes.

This is a hobby project and public utility API. It supports browser and API usage.

## API

- [Landing page](${origin}/): Interactive form with examples and usage information.
- [Health endpoint](${origin}/health): Service metadata and endpoint list.
- [Generate QR with GET](${origin}/qr?data=hello-world): Returns SVG bytes.
- [Generate QR with POST](${origin}/qr): Accepts \`text/plain\` body or JSON payload.

## Restrictions

- Input data max length: ${MAX_DATA_LENGTH} characters.
- \`scale\`: integer from 1 to ${MAX_SCALE}.
- \`border\`: integer from 0 to ${MAX_BORDER}.
- \`ecc\`: one of \`L\`, \`M\`, \`Q\`, \`H\`.

## Limitations

- Output format is SVG only.
- No long-term storage of generated QR content.
- No uptime SLA; best-effort service.
- Do not submit secrets, passwords, tokens, or private data.

## Crawling and AI usage policy

- Public pages are intended to be crawlable.
- Crawler controls are declared in \`/robots.txt\`.
- This \`/llms.txt\` file is informational context for LLM tools, not an access-control mechanism.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function safeAdClient(value: string | undefined): string | null {
  if (!value) return null;
  return /^ca-pub-\d{10,20}$/.test(value) ? value : null;
}

function safeAdSlot(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{5,20}$/.test(value) ? value : null;
}

function adsenseScriptMarkup(adClient: string): string {
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}" crossorigin="anonymous"></script>`;
}

function adsenseMetaMarkup(adClient: string): string {
  return `<meta name="google-adsense-account" content="${adClient}">`;
}

function adUnitMarkup(adClient: string, adSlot: string): string {
  return `<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="${adClient}"
     data-ad-slot="${adSlot}"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`;
}

function fallbackAdMarkup(): string {
  return `<div class="ad-fallback">
    Ads are not configured yet. Replace this with your sponsor link, donation URL, or merch CTA until ad inventory is live.
  </div>`;
}

function qrFromQuery(url: URL): Response {
  const data = url.searchParams.get("data");
  if (!data) {
    return badRequest("Missing required query parameter: data");
  }

  const options = parseOptions({
    scale: url.searchParams.get("scale"),
    border: url.searchParams.get("border"),
    ecc: url.searchParams.get("ecc"),
  });

  if ("error" in options) {
    return badRequest(options.error);
  }

  return buildQrResponse(data, options);
}

async function qrFromBody(request: Request, url: URL): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  let data: string | null = null;

  let scale = url.searchParams.get("scale");
  let border = url.searchParams.get("border");
  let ecc = url.searchParams.get("ecc");

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    if (!body || typeof body !== "object") {
      return badRequest("JSON body must be an object");
    }

    const payload = body as Record<string, unknown>;
    if (typeof payload.data === "string") {
      data = payload.data;
    }

    if (typeof payload.scale === "number" || typeof payload.scale === "string") {
      scale = String(payload.scale);
    }

    if (typeof payload.border === "number" || typeof payload.border === "string") {
      border = String(payload.border);
    }

    if (typeof payload.ecc === "string") {
      ecc = payload.ecc;
    }
  } else {
    data = await request.text();
  }

  if (!data) {
    return badRequest("Missing data in request body");
  }

  const options = parseOptions({ scale, border, ecc });
  if ("error" in options) {
    return badRequest(options.error);
  }

  return buildQrResponse(data, options);
}

function buildQrResponse(
  data: string,
  options: { scale: number; border: number; ecc: "L" | "M" | "Q" | "H" },
): Response {
  if (data.length > MAX_DATA_LENGTH) {
    return badRequest(`Data too long. Max length is ${MAX_DATA_LENGTH} characters.`);
  }

  let svg: string;
  try {
    const qr = qrcode(0, options.ecc);
    qr.addData(data);
    qr.make();
    svg = qr.createSvgTag({
      cellSize: options.scale,
      margin: options.border,
      scalable: false,
      alt: "Icanhazqrcode",
      title: "Icanhazqrcode",
    });
  } catch {
    return badRequest("Unable to encode QR for the provided input and options");
  }

  const body = new TextEncoder().encode(svg);
  const etag = `W/\"${simpleHash(svg)}\"`;

  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-length": String(body.byteLength),
      "cache-control": "public, max-age=300",
      etag,
      "x-content-type-options": "nosniff",
    },
  });
}

function parseOptions(input: {
  scale: string | null;
  border: string | null;
  ecc: string | null;
}): { scale: number; border: number; ecc: "L" | "M" | "Q" | "H" } | { error: string } {
  const scale = parseIntOrDefault(input.scale, DEFAULT_SCALE);
  const border = parseIntOrDefault(input.border, DEFAULT_BORDER);
  const eccRaw = (input.ecc ?? DEFAULT_ERROR_CORRECTION).toUpperCase();

  if (!Number.isInteger(scale) || scale <= 0 || scale > MAX_SCALE) {
    return { error: `scale must be an integer between 1 and ${MAX_SCALE}` };
  }

  if (!Number.isInteger(border) || border < 0 || border > MAX_BORDER) {
    return { error: `border must be an integer between 0 and ${MAX_BORDER}` };
  }

  if (!ALLOWED_ERROR_CORRECTION.has(eccRaw)) {
    return { error: "ecc must be one of: L, M, Q, H" };
  }

  return {
    scale,
    border,
    ecc: eccRaw as "L" | "M" | "Q" | "H",
  };
}

function parseIntOrDefault(input: string | null, fallback: number): number {
  if (input === null || input.trim() === "") {
    return fallback;
  }

  return Number.parseInt(input, 10);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function simpleHash(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}
