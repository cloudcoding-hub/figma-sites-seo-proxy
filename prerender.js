#!/usr/bin/env node

/**
 * Figma Sites Pre-renderer with Cloudflare KV Upload
 *
 * Renders Figma Sites pages and uploads them to Cloudflare KV
 * for the SEO proxy worker to serve.
 *
 * Usage:
 *   node prerender.js --figma-url https://web.yourdomain.com --canonical https://yourdomain.com
 *   Or just: node prerender.js (uses .env file)
 */

// Load environment variables from .env file
require("dotenv").config();

const puppeteer = require("puppeteer");
const { execSync } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { URL } = require("url");

// Configuration
const CONFIG = {
  // Pages to render (add your pages here)
  pages: [
    "/",
    "/what-is-timeblocking",
    "/beta-subscribe",
    // '/about',
    // '/features',
    // '/pricing',
    // '/contact',
    // Add more pages as needed
  ],

  // Rendering options
  viewport: { width: 1280, height: 800 },
  waitUntil: "networkidle2",
  timeout: 60000,
  additionalWait: 3000,

  // Local output directory (for backup/debugging)
  outputDir: "./dist",

  // KV namespace binding name (must match wrangler.toml)
  kvNamespace: "PRERENDER_CACHE",
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    figmaUrl: process.env.FIGMA_SITE_URL || null, // Default from .env
    canonical: process.env.MAIN_DOMAIN || null, // Default from .env
    output: CONFIG.outputDir,
    pages: null,
    skipUpload: false, // Skip KV upload (just generate files)
    kvNamespaceId: process.env.KV_NAMESPACE_ID || null, // Default from .env
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--figma-url":
      case "-f":
        options.figmaUrl = args[++i];
        break;
      case "--canonical":
      case "-c":
        options.canonical = args[++i];
        break;
      case "--output":
      case "-o":
        options.output = args[++i];
        break;
      case "--pages":
      case "-p":
        options.pages = args[++i].split(",").map((p) => p.trim());
        break;
      case "--skip-upload":
        options.skipUpload = true;
        break;
      case "--kv-namespace-id":
        options.kvNamespaceId = args[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Figma Sites Pre-renderer with Cloudflare KV Upload

Usage:
  node prerender.js [options]
  
  If no options provided, reads from .env file
  Command line options override .env values

Required (or set in .env):
  -f, --figma-url      Figma Sites subdomain (e.g., https://web.yourdomain.com)
  -c, --canonical      Main domain for canonical tags (e.g., https://yourdomain.com)

Options:
  -o, --output         Local output directory (default: ./dist)
  -p, --pages          Comma-separated list of pages (default: /)
  --skip-upload        Generate files locally but don't upload to KV
  --kv-namespace-id    Override KV namespace ID from wrangler.toml
  -h, --help           Show this help message

Examples:
  # Basic usage
  node prerender.js \
    --figma-url https://web.yourdomain.com \
    --canonical https://yourdomain.com

  # Multiple pages
  node prerender.js \
    --figma-url https://web.yourdomain.com \
    --canonical https://yourdomain.com \
    --pages /,/about,/pricing,/contact

  # Local only (no KV upload)
  node prerender.js \
    --figma-url https://web.yourdomain.com \
    --canonical https://yourdomain.com \
    --skip-upload
`);
}

/**
 * Inject SEO enhancements into the HTML
 */
function enhanceHTML(html, canonicalUrl, pagePath, figmaUrl) {
  const fullCanonicalUrl = new URL(pagePath, canonicalUrl).href;
  const figmaHost = new URL(figmaUrl).host;
  const canonicalHost = new URL(canonicalUrl).host;

  // Remove any existing canonical tags
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, "");

  // Remove any meta robots noindex tags (we want indexing!)
  html = html.replace(
    /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/gi,
    ""
  );

  // Rewrite Figma subdomain references to canonical domain
  html = html.replace(new RegExp(escapeRegex(figmaUrl), "gi"), canonicalUrl);
  html = html.replace(
    new RegExp(escapeRegex(`//${figmaHost}`), "gi"),
    `//${canonicalHost}`
  );

  // Create SEO-friendly meta tags
  const seoTags = `
    <!-- SEO/GenAI Optimizations (pre-rendered) -->
    <link rel="canonical" href="${fullCanonicalUrl}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    
    <!-- Structured Data for GenAI -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "${fullCanonicalUrl}",
      "isPartOf": {
        "@type": "WebSite",
        "url": "${canonicalUrl}"
      }
    }
    </script>
  `;

  // Inject before </head>
  html = html.replace("</head>", `${seoTags}\n</head>`);

  // Add a comment for debugging
  const timestamp = new Date().toISOString();
  html = html.replace(
    "<html",
    `<!-- Pre-rendered for SEO: ${timestamp} -->\n<html`
  );

  return html;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a single page with Puppeteer
 */
async function renderPage(browser, figmaUrl, canonicalUrl, pagePath) {
  const page = await browser.newPage();

  try {
    await page.setViewport(CONFIG.viewport);

    // Use regular user agent for full JS rendering
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const fullUrl = new URL(pagePath, figmaUrl).href;
    console.log(`  Rendering: ${fullUrl}`);

    // Try with less strict waiting condition first
    try {
      await page.goto(fullUrl, {
        waitUntil: CONFIG.waitUntil,
        timeout: CONFIG.timeout,
      });
    } catch (err) {
      console.log(`    First attempt failed, trying with domcontentloaded...`);
      await page.goto(fullUrl, {
        waitUntil: "domcontentloaded",
        timeout: CONFIG.timeout,
      });
    }

    // Wait for content to settle
    await new Promise((resolve) => setTimeout(resolve, CONFIG.additionalWait));

    // Wait for animations
    await page.evaluate(() => {
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });

    let html = await page.content();
    html = enhanceHTML(html, canonicalUrl, pagePath, figmaUrl);

    return { html, success: true };
  } catch (error) {
    console.error(`  Error rendering ${pagePath}: ${error.message}`);
    return { html: null, success: false, error: error.message };
  } finally {
    await page.close();
  }
}

/**
 * Save rendered content locally
 */
async function saveLocal(outputDir, pagePath, html) {
  let filePath;
  if (pagePath === "/") {
    filePath = path.join(outputDir, "index.html");
  } else {
    const cleanPath = pagePath.replace(/^\//, "").replace(/\/$/, "");
    filePath = path.join(outputDir, cleanPath, "index.html");
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html, "utf-8");
  console.log(`  Saved locally: ${filePath}`);

  return filePath;
}

/**
 * Upload content to Cloudflare KV using wrangler
 */
async function uploadToKV(pagePath, html, kvNamespaceId) {
  // Normalize the key
  let key = pagePath === "/" ? "/index" : pagePath;
  key = key.replace(/\/$/, "");

  // Write to temp file (wrangler needs a file)
  const tempFile = `/tmp/prerender-${Date.now()}.html`;
  await fs.writeFile(tempFile, html, "utf-8");

  try {
    const cmd = kvNamespaceId
      ? `npx wrangler kv:key put --namespace-id="${kvNamespaceId}" "${key}" --path="${tempFile}"`
      : `npx wrangler kv:key put --binding="${CONFIG.kvNamespace}" "${key}" --path="${tempFile}"`;

    execSync(cmd, { stdio: "pipe" });
    console.log(`  Uploaded to KV: ${key}`);
  } catch (error) {
    console.error(`  KV upload failed for ${key}: ${error.message}`);
    throw error;
  } finally {
    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});
  }
}

/**
 * Generate and upload sitemap
 */
async function generateSitemap(
  outputDir,
  canonicalUrl,
  pages,
  kvNamespaceId,
  skipUpload
) {
  const urls = pages.map((pagePath) => {
    const fullUrl = new URL(pagePath, canonicalUrl).href;
    return `  <url>
    <loc>${fullUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>${pagePath === "/" ? "1.0" : "0.8"}</priority>
  </url>`;
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  // Save locally
  const sitemapPath = path.join(outputDir, "sitemap.xml");
  await fs.writeFile(sitemapPath, sitemap, "utf-8");
  console.log(`  Generated: ${sitemapPath}`);

  // Upload to KV
  if (!skipUpload) {
    const tempFile = `/tmp/sitemap-${Date.now()}.xml`;
    await fs.writeFile(tempFile, sitemap, "utf-8");
    try {
      const cmd = kvNamespaceId
        ? `npx wrangler kv:key put --namespace-id="${kvNamespaceId}" "/sitemap.xml" --path="${tempFile}"`
        : `npx wrangler kv:key put --binding="${CONFIG.kvNamespace}" "/sitemap.xml" --path="${tempFile}"`;
      execSync(cmd, { stdio: "pipe" });
      console.log(`  Uploaded to KV: /sitemap.xml`);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }

  // Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${new URL("/sitemap.xml", canonicalUrl).href}

# AI Crawlers - Allow all
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: PerplexityBot
Allow: /
`;

  const robotsPath = path.join(outputDir, "robots.txt");
  await fs.writeFile(robotsPath, robotsTxt, "utf-8");
  console.log(`  Generated: ${robotsPath}`);

  // Upload robots.txt to KV
  if (!skipUpload) {
    const tempFile = `/tmp/robots-${Date.now()}.txt`;
    await fs.writeFile(tempFile, robotsTxt, "utf-8");
    try {
      const cmd = kvNamespaceId
        ? `npx wrangler kv:key put --namespace-id="${kvNamespaceId}" "/robots.txt" --path="${tempFile}"`
        : `npx wrangler kv:key put --binding="${CONFIG.kvNamespace}" "/robots.txt" --path="${tempFile}"`;
      execSync(cmd, { stdio: "pipe" });
      console.log(`  Uploaded to KV: /robots.txt`);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  if (!options.figmaUrl || !options.canonical) {
    console.error("Error: --figma-url and --canonical are required\n");
    printHelp();
    process.exit(1);
  }

  // Normalize URLs
  if (!options.figmaUrl.startsWith("http")) {
    options.figmaUrl = "https://" + options.figmaUrl;
  }
  if (!options.canonical.startsWith("http")) {
    options.canonical = "https://" + options.canonical;
  }

  const pages = options.pages || CONFIG.pages;

  console.log("\n🚀 Figma Sites Pre-renderer\n");
  console.log(`Figma URL:  ${options.figmaUrl}`);
  console.log(`Canonical:  ${options.canonical}`);
  console.log(`Output:     ${options.output}`);
  console.log(`Pages:      ${pages.join(", ")}`);
  console.log(`KV Upload:  ${options.skipUpload ? "Disabled" : "Enabled"}\n`);

  // Check wrangler is available if uploading
  if (!options.skipUpload) {
    try {
      execSync("npx wrangler --version", { stdio: "pipe" });
    } catch (error) {
      console.error("Error: wrangler is required for KV upload.");
      console.error("Install with: npm install -g wrangler");
      console.error("Or use --skip-upload to generate files locally only.\n");
      process.exit(1);
    }
  }

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    await fs.mkdir(options.output, { recursive: true });

    console.log("\nRendering pages...");
    const results = [];

    for (const pagePath of pages) {
      const result = await renderPage(
        browser,
        options.figmaUrl,
        options.canonical,
        pagePath
      );

      if (result.success) {
        await saveLocal(options.output, pagePath, result.html);

        if (!options.skipUpload) {
          await uploadToKV(pagePath, result.html, options.kvNamespaceId);
        }

        results.push({ path: pagePath, success: true });
      } else {
        results.push({ path: pagePath, success: false, error: result.error });
      }
    }

    console.log("\nGenerating sitemap and robots.txt...");
    const successfulPages = results.filter((r) => r.success).map((r) => r.path);
    await generateSitemap(
      options.output,
      options.canonical,
      successfulPages,
      options.kvNamespaceId,
      options.skipUpload
    );

    // Summary
    console.log("\n✅ Pre-rendering complete!\n");
    console.log("Summary:");
    console.log(`  Successful: ${results.filter((r) => r.success).length}`);
    console.log(`  Failed:     ${results.filter((r) => !r.success).length}`);

    if (results.some((r) => !r.success)) {
      console.log("\nFailed pages:");
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  ${r.path}: ${r.error}`);
        });
    }

    console.log(`\nLocal files: ${path.resolve(options.output)}`);
    if (!options.skipUpload) {
      console.log("KV cache: Updated");
    }
    console.log("");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
