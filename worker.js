/**
 * Figma Sites SEO Proxy Worker
 *
 * Routes traffic between pre-rendered static content (for bots)
 * and the live Figma Sites (for humans).
 */

// ===========================================
// CONFIGURATION
// ===========================================
// ⚠️  DO NOT EDIT VALUES BELOW - THEY ARE ONLY FALLBACKS
//
// Your actual configuration comes from the .env file:
// 1. Edit .env with your domains
// 2. Wrangler automatically loads .env and injects values
// 3. The worker receives them as env.FIGMA_SITE_URL, env.MAIN_DOMAIN, etc.
//
// The CONFIG object below is ONLY used if .env variables are missing.
// In production with wrangler, these fallback values are never used.
//
// 📝 To configure: Update your .env file, NOT these values

const CONFIG = {
  figmaSiteOrigin: "https://web.yourdomain.com", // Fallback only
  mainDomain: "https://yourdomain.com", // Fallback only
  debug: false, // Fallback only
};

// Helper to get config - reads from .env (via wrangler env injection)
function getConfig(env) {
  return {
    figmaSiteOrigin: env.FIGMA_SITE_URL || CONFIG.figmaSiteOrigin,
    mainDomain: env.MAIN_DOMAIN || CONFIG.mainDomain,
    debug: env.DEBUG === "true" || CONFIG.debug,
  };
}

// Bot detection patterns - comprehensive list
const BOT_PATTERNS = [
  // Search engine crawlers
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "slurp", // Yahoo
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "sogou",
  "exabot",
  "facebot",
  "ia_archiver", // Alexa

  // AI crawlers
  "gptbot",
  "chatgpt-user",
  "oai-searchbot", // OpenAI
  "claude-web",
  "claudebot",
  "anthropic-ai",
  "cohere-ai",
  "perplexitybot",
  "youbot",
  "ccbot", // Common Crawl (used by AI training)

  // Social media crawlers (link previews)
  "facebookexternalhit",
  "facebookcatalog",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "pinterestbot",
  "redditbot",

  // SEO tools
  "semrushbot",
  "ahrefsbot",
  "mj12bot", // Majestic
  "dotbot",
  "rogerbot", // Moz
  "screaming frog",

  // Other important bots
  "applebot", // Apple/Siri
  "amazonbot",
  "bytespider", // TikTok/ByteDance
];

// Create regex for bot detection
const BOT_REGEX = new RegExp(BOT_PATTERNS.join("|"), "i");

/**
 * Check if the request is from a bot
 */
function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return BOT_REGEX.test(userAgent);
}

/**
 * Get the pre-rendered HTML from KV storage
 */
async function getPrerenderedContent(pathname, env) {
  // Normalize the path for KV key
  let key = pathname === "/" ? "/index" : pathname;
  key = key.replace(/\/$/, ""); // Remove trailing slash

  try {
    const html = await env.PRERENDER_CACHE.get(key, "text");
    return html;
  } catch (error) {
    console.error(`KV fetch error for ${key}:`, error);
    return null;
  }
}

/**
 * Fetch from Figma Sites and rewrite links
 */
async function proxyToFigmaSites(request, pathname, config) {
  // Build the full URL for Figma subdomain
  const figmaUrl = new URL(pathname, config.figmaSiteOrigin);

  // Preserve query parameters
  const originalUrl = new URL(request.url);
  figmaUrl.search = originalUrl.search;

  // Create a new request with fresh headers
  const headers = new Headers();

  // Copy important headers from the original request
  const headersToCopy = [
    "accept",
    "accept-encoding",
    "accept-language",
    "user-agent",
    "cache-control",
  ];

  headersToCopy.forEach((header) => {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  try {
    const response = await fetch(figmaUrl.toString(), {
      method: request.method,
      headers: headers,
      redirect: "manual",
    });

    // Handle redirects - rewrite to main domain
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const newLocation = location.replace(
          config.figmaSiteOrigin,
          config.mainDomain
        );
        return new Response(null, {
          status: response.status,
          headers: {
            Location: newLocation,
          },
        });
      }
    }

    // Get content type
    const contentType = response.headers.get("content-type") || "";

    // Only rewrite HTML content
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // Rewrite all references to the Figma subdomain
      html = rewriteHtml(html, config);

      // Create new response with rewritten content
      const newHeaders = new Headers(response.headers);
      newHeaders.set("content-type", "text/html; charset=utf-8");

      return new Response(html, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // For non-HTML content (CSS, JS, images), pass through
    return response;
  } catch (error) {
    console.error("Error fetching from Figma:", error);
    return new Response("Error loading page", {
      status: 502,
      headers: {
        "content-type": "text/plain",
      },
    });
  }
}

/**
 * Rewrite HTML to replace Figma subdomain references with main domain
 */
function rewriteHtml(html, config) {
  const figmaHost = new URL(config.figmaSiteOrigin).host;
  const mainHost = new URL(config.mainDomain).host;

  // Replace all occurrences of the Figma subdomain
  // Handle both http and https, with and without www
  const patterns = [
    // Full URLs
    new RegExp(`https?://${escapeRegex(figmaHost)}`, "gi"),
    // Protocol-relative URLs
    new RegExp(`//${escapeRegex(figmaHost)}`, "gi"),
    // Just the hostname in various contexts
    new RegExp(
      `(href|src|action|data-[^=]*)(=["'])([^"']*)(${escapeRegex(
        figmaHost
      )})([^"']*)`,
      "gi"
    ),
  ];

  // Simple replacement for full URLs
  html = html.replace(
    new RegExp(escapeRegex(CONFIG.figmaSiteOrigin), "gi"),
    CONFIG.mainDomain
  );

  // Also handle the host without protocol
  html = html.replace(
    new RegExp(`//${escapeRegex(figmaHost)}`, "gi"),
    `//${mainHost}`
  );

  return html;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const config = getConfig(env);
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Skip worker for certain paths (like _next, static assets, etc.)
    const skipPaths = ["/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];
    if (skipPaths.some((p) => pathname.startsWith(p))) {
      // For robots.txt and sitemap.xml, serve from KV if available
      if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
        const content = await env.PRERENDER_CACHE.get(pathname, "text");
        if (content) {
          return new Response(content, {
            headers: {
              "content-type": pathname.endsWith(".xml")
                ? "application/xml"
                : "text/plain",
            },
          });
        }
      }
      // Otherwise proxy to Figma
      return proxyToFigmaSites(request, pathname, config);
    }

    // Check if request is from a bot
    const botDetected = isBot(request);

    if (botDetected) {
      // Try to serve pre-rendered content
      const prerendered = await getPrerenderedContent(pathname, env);

      if (prerendered) {
        const response = new Response(prerendered, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });

        // Add debug header if enabled
        if (CONFIG.debug) {
          response.headers.set("x-served-by", "prerender-cache");
          response.headers.set("x-bot-detected", "true");
        }

        return response;
      }

      // No pre-rendered content found, fall through to Figma Sites
      // (Better than showing nothing)
      console.log(
        `No prerendered content for ${pathname}, falling back to Figma`
      );
    }

    // Human visitor (or bot without pre-rendered content) - proxy to Figma
    const response = await proxyToFigmaSites(request, pathname);

    // Add debug headers if enabled
    if (CONFIG.debug) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("x-served-by", "figma-proxy");
      newResponse.headers.set("x-bot-detected", botDetected ? "true" : "false");
      return newResponse;
    }

    return response;
  },
};
