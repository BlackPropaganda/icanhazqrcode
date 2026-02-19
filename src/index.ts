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
    .meme {
      margin-top: 0.8rem;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #dbe4ef;
      background: #f8fafc;
    }
    .meme img {
      width: 100%;
      display: block;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }
    .meme figcaption {
      margin: 0;
      padding: 0.55rem 0.75rem;
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 0.82rem;
      color: #344054;
      border-top: 1px solid #dbe4ef;
      background: #fff;
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
      <figure class="meme">
        <img src="data:image/jpeg;base64,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" alt="A cute cat meme that says icanhazcheeseburger" loading="lazy" decoding="async">
        <figcaption>icanhazcheeseburger</figcaption>
      </figure>
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
