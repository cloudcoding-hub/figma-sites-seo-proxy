# Figma Sites SEO Proxy

Server-side SEO solution for Figma Sites. Uses Cloudflare Workers to detect bots and serve pre-rendered HTML, while humans get the full Figma Sites experience.

## Architecture

```
                    yourdomain.com (main domain)
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Cloudflare Worker  │
                    │  (server-side bot   │
                    │   detection)        │
                    └─────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
   ┌─────────────────┐               ┌─────────────────────┐
   │      Bot?       │               │      Human?         │
   │                 │               │                     │
   │  Serve static   │               │  Reverse proxy to   │
   │  HTML from KV   │               │  web.yourdomain.com  │
   │                 │               │  (Figma Sites)      │
   └─────────────────┘               └─────────────────────┘
```

## Prerequisites

- Node.js 18+
- A Cloudflare account (free tier works)
- Your domain's DNS managed by Cloudflare
- A published Figma Sites project

## Quick Deployment

If you've already completed the initial setup, deploying updates is quick:

### Step 0: Configure Environment (First Time Only)

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your domains and KV namespace ID
# This is the ONLY file you need to update for configuration!
nano .env
```

See [ENV-SETUP.md](ENV-SETUP.md) for detailed environment variable configuration.

**Important:** All configuration is in `.env` - no need to edit `worker.js` or `wrangler.toml` [vars] section!

### Step 1: Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate. Only needed once per machine.

### Step 2: Pre-render and Deploy

```bash
# Automatically uses values from .env file
node prerender.js
```

Or override with command line arguments:

```bash
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
```

This will:

- Fetch your Figma Sites pages
- Generate SEO-optimized HTML
- Upload to Cloudflare KV automatically

Done! Your changes are live within seconds.

**Note:** If you haven't completed initial setup, follow the full [Setup Guide](#setup-guide) below.

## Setup Guide

### Step 1: DNS Configuration

#### A. Set up the Figma subdomain first:

1. In Figma Sites, go to Settings → Domains
2. Add `web.yourdomain.com` (or your chosen subdomain) as a custom domain
3. Figma will show you the exact DNS records needed:
   - **CNAME record**: `web` → `cname.figma.com` (or similar)
   - **TXT record**: `web` → `figma-site-verification=...`
4. Add BOTH records to Cloudflare DNS:
   - **Proxy status: DNS only** (grey cloud) for both
   - Use the exact values Figma provides
5. Wait for Figma to verify (usually 5-30 minutes, can take up to 24 hours)
6. Test that `https://web.yourdomain.com` loads your Figma site

#### B. Set up the main domain:

| Type | Name | Content | Proxy Status |
|-------|------|---------|--------------||
| A | @ | 192.0.2.1 | Proxied 🟠 |
| CNAME | www | yourdomain.com | Proxied 🟠 |

Add these to Cloudflare DNS. The Worker will intercept all requests to these domains.

### Step 2: Install Dependencies

```bash
cd figma-seo-proxy
npm install
```

### Step 3: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Login to Cloudflare:

```bash
npx wrangler login
```

Create the KV namespace for storing pre-rendered pages:

```bash
npx wrangler kv:namespace create "PRERENDER_CACHE"
```

You'll see output like:

```
🌀 Creating namespace with title "figma-seo-proxy-PRERENDER_CACHE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "PRERENDER_CACHE", id = "abc123def456..." }
```

Copy the `id` value and update **two places**:

1. Your `.env` file:

   ```bash
   KV_NAMESPACE_ID=abc123def456...
   ```

2. Your `wrangler.toml` file:
   ```toml
   [[kv_namespaces]]
   binding = "PRERENDER_CACHE"
   id = "abc123def456..."  # ← Paste your ID here
   ```

### Step 4: Configure Your Domains

Edit your `.env` file with your actual domains:

```bash
# Your Figma Sites subdomain (where Figma hosts your site)
FIGMA_SITE_URL=https://web.yourdomain.com

# Your main domain (what users see)
MAIN_DOMAIN=https://yourdomain.com

# KV Namespace ID (from Step 3)
KV_NAMESPACE_ID=abc123def456...

# Debug mode (set to false in production)
DEBUG=false
```

### Step 5: Deploy the Worker

```bash
npx wrangler deploy
```

### Step 6: Route Your Domain to the Worker

Option A: Via wrangler.toml (uncomment and edit with your actual domain):

```toml
routes = [
  { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" },
  { pattern = "www.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

**Note:** Update the domain patterns with your actual domain (not the env variables).

Then redeploy: `npx wrangler deploy`

Option B: Via Cloudflare Dashboard:

1. Go to Workers & Pages → your worker
2. Click "Settings" → "Triggers"
3. Add routes: `yourdomain.com/*` and `www.yourdomain.com/*`

### Step 7: Pre-render Your Pages

Configure your pages in `prerender.js`:

```javascript
const CONFIG = {
  pages: ["/", "/about", "/features", "/pricing", "/contact"],
  // ...
};
```

Run the pre-renderer:

```bash
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
```

Or specify pages directly:

```bash
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com \
  --pages /,/about,/features,/pricing
```

### Step 8: Verify It's Working

**Test bot detection:**

```bash
# This should return pre-rendered HTML
curl -A "Googlebot" https://yourdomain.com

# Check the debug headers
curl -I -A "Googlebot" https://yourdomain.com
# Should show: x-served-by: prerender-cache
#              x-bot-detected: true

# This should proxy to Figma Sites
curl -I https://yourdomain.com
# Should show: x-served-by: figma-proxy
#              x-bot-detected: false
```

**Test in browser:**

1. Open Chrome DevTools → Network tab → three dots → Network conditions
2. Uncheck "Use browser default" under User agent
3. Select "Googlebot" or paste: `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`
4. Navigate to your site
5. View source - you should see the pre-rendered HTML with canonical tags

## Updating Content

When you update your Figma Sites:

```bash
# Re-render and upload to KV
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
```

That's it - the Worker automatically serves the updated content.

### Quick Update Script

Create `update.sh`:

```bash
#!/bin/bash
echo "🔄 Pre-rendering Figma Sites..."
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com \
  --pages /,/about,/features,/pricing

echo "✅ Done! KV cache updated."
```

```bash
chmod +x update.sh
./update.sh
```

## Debugging

### View Worker Logs

```bash
npx wrangler tail
```

### List KV Contents

```bash
npx wrangler kv:key list --binding=PRERENDER_CACHE
```

### View a Specific KV Entry

```bash
npx wrangler kv:key get --binding=PRERENDER_CACHE "/index"
```

### Delete a KV Entry

```bash
npx wrangler kv:key delete --binding=PRERENDER_CACHE "/old-page"
```

### Check Debug Headers

With `debug: true` in the Worker config:

```bash
curl -I https://yourdomain.com
```

Look for:

- `x-served-by`: `prerender-cache` or `figma-proxy`
- `x-bot-detected`: `true` or `false`

## Supported Bots

The Worker detects:

**Search Engines:** Google, Bing, Yahoo, DuckDuckGo, Baidu, Yandex

**AI Crawlers:** GPTBot, ChatGPT, Claude, Cohere, Perplexity, You.com, CCBot

**Social Media:** Facebook, Twitter, LinkedIn, Slack, Discord, Telegram, WhatsApp, Pinterest, Reddit

**SEO Tools:** Semrush, Ahrefs, Moz, Majestic

**Other:** Apple/Siri, Amazon, ByteDance/TikTok

## File Structure

```
figma-seo-proxy/
├── worker.js        # Cloudflare Worker (bot detection + proxy)
├── prerender.js     # Pre-rendering script (Puppeteer + KV upload)
├── wrangler.toml    # Cloudflare configuration
├── package.json     # Dependencies
├── dist/            # Local backup of pre-rendered pages
│   ├── index.html
│   ├── about/index.html
│   ├── sitemap.xml
│   └── robots.txt
└── README.md
```

## Costs

**Cloudflare Free Tier includes:**

- Workers: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day, 1GB storage

This is more than enough for most brochure sites. You'd need millions of monthly visitors to exceed this.

## Troubleshooting

### "No prerendered content" in logs

The page isn't in KV. Run the pre-renderer for that page:

```bash
node prerender.js --pages /missing-page ...
```

### Figma subdomain not verifying

- Ensure Cloudflare proxy is OFF (grey cloud) for the subdomain
- Check the DNS records match exactly what Figma provided
- Wait 24-48 hours for DNS propagation

### Worker not receiving traffic

- Ensure main domain has Cloudflare proxy ON (orange cloud)
- Check the route pattern matches your domain
- Verify the Worker is deployed: `npx wrangler deploy`

### Pre-renderer fails to load pages

- Check the Figma Sites URL is correct and publicly accessible
- Try increasing timeout in the CONFIG section
- Make sure you have a stable internet connection

### Links on the page point to wrong domain

The Worker should rewrite these, but if not:

- Check the `rewriteHtml` function in `worker.js`
- Ensure both `figmaSiteOrigin` and `mainDomain` are correct

## Multiple Sites

You can use this for multiple Figma Sites:

1. Create a separate KV namespace for each site:

   ```bash
   npx wrangler kv:namespace create "SITE1_CACHE"
   npx wrangler kv:namespace create "SITE2_CACHE"
   ```

2. Either:
   - Deploy separate Workers for each site, OR
   - Modify the Worker to route based on hostname

## License

MIT - Use however you like.
