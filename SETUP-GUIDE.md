# Figma Sites SEO Proxy - Complete Setup Guide

A detailed, step-by-step guide to setting up the Cloudflare proxy for your Figma Sites.

**Your setup:** DNS with 123-reg, Figma Sites project, domain: yourdomain.com (adjust as needed)

---

## Table of Contents

1. [Overview - What We're Building](#1-overview---what-were-building)
2. [Prerequisites Checklist](#2-prerequisites-checklist)
3. [Create a Cloudflare Account](#3-create-a-cloudflare-account)
4. [Add Your Domain to Cloudflare](#4-add-your-domain-to-cloudflare)
5. [Update Nameservers at 123-reg](#5-update-nameservers-at-123-reg)
6. [Configure DNS Records in Cloudflare](#6-configure-dns-records-in-cloudflare)
7. [Connect Figma Sites to Your Subdomain](#7-connect-figma-sites-to-your-subdomain)
8. [Set Up Your Local Environment](#8-set-up-your-local-environment)
9. [Install and Configure Wrangler](#9-install-and-configure-wrangler)
10. [Create the KV Namespace](#10-create-the-kv-namespace)
11. [Configure the Worker Code](#11-configure-the-worker-code)
12. [Deploy the Worker](#12-deploy-the-worker)
13. [Set Up Domain Routes](#13-set-up-domain-routes)
14. [Pre-render Your Pages](#14-pre-render-your-pages)
15. [Test Everything Works](#15-test-everything-works)
16. [Ongoing Maintenance](#16-ongoing-maintenance)
17. [Troubleshooting Common Issues](#17-troubleshooting-common-issues)

---

## 1\. Overview \- What We're Building

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR SETUP                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   yourdomain.com (main domain)                                    │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────────────────────────┐                               │
│   │     Cloudflare (proxied)        │                               │
│   │     ┌─────────────────────┐     │                               │
│   │     │  Worker             │     │                               │
│   │     │  - Detects bots     │     │                               │
│   │     │  - Routes traffic   │     │                               │
│   │     └─────────────────────┘     │                               │
│   └─────────────────────────────────┘                               │
│                    │                                                 │
│         ┌─────────┴─────────┐                                       │
│         ▼                   ▼                                        │
│   ┌───────────┐      ┌─────────────────┐                            │
│   │   Bot?    │      │    Human?       │                            │
│   │           │      │                 │                            │
│   │ Serve     │      │ Proxy to        │                            │
│   │ static    │      │ web.yourdomain.com                         │
│   │ HTML      │      │ (Figma Sites)   │                            │
│   └───────────┘      └─────────────────┘                            │
│                                                                      │
│   web.yourdomain.com (subdomain - DNS only, not proxied)          │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────────────────────────┐                               │
│   │     Figma Sites                 │                               │
│   │     (your actual site)          │                               │
│   └─────────────────────────────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Result:**

- Humans visiting `yourdomain.com` → see full Figma Sites with animations
- Bots visiting `yourdomain.com` → see SEO-optimised static HTML
- Your Figma workflow stays exactly the same

---

##     2. Prerequisites Checklist

Before starting, make sure you have:

- [x] **Node.js 18 or higher** installed
- [x] **A domain** (e.g., yourdomain.com)
- [x] **Login access to 123-reg** for your domain
- [x] **A published Figma Sites project**
- [x] **About 1-2 hours** (mostly waiting for DNS)

### Check Node.js is installed:

Open Terminal (Mac) or Command Prompt (Windows):

```bash
node --version
```

You should see `v18.x.x` or higher. If not, download from [nodejs.org](https://nodejs.org/).

### Get your Figma Sites URL:

1. Open your Figma Sites file
2. Click **Publish** (or check if already published)
3. Note the URL - it'll be something like `https://something.figma.site`

---

## 3\. Create a Cloudflare Account

### Step 3.1: Sign Up

1. Go to <b>[dash.cloudflare.com](https://dash.cloudflare.com/)</b>
2. Click **Sign Up**
3. Enter your email address
4. Create a strong password
5. Click **Create Account**
6. Check your email and click the verification link

### Step 3.2: Complete Verification

1. After clicking the email link, you'll be logged in
2. You'll see the Cloudflare dashboard

---

## 4\. Add Your Domain to Cloudflare

### Step 4.1: Add Site

1. In the Cloudflare dashboard, click the blue **Add a Site** button
2. Type your domain: `yourdomain.com` (no https://, no www)
3. Click **Add Site**

### Step 4.2: Select the Free Plan

1. Scroll down to see plan options
2. Click on **Free** ($0/month)
3. Click **Continue**

### Step 4.3: Review DNS Records

Cloudflare will scan your existing DNS records.

1. You'll see a list of records it found
2. **Don't worry about these for now** \- we'll set up the correct ones later
3. Click **Continue**

### Step 4.4: Note Your Nameservers

Cloudflare will show you two nameservers. They look like:

```
aria.ns.cloudflare.com
bob.ns.cloudflare.com
```

**Write these down or keep this tab open** \- you'll need them in the next step\.

---

## 5\. Update Nameservers at 123\-reg

This tells the internet that Cloudflare now manages your domain's DNS.

### Step 5.1: Log into 123-reg

1. Go to <b>[123-reg.co.uk](https://www.123-reg.co.uk/)</b>
2. Click **Control Panel** (top right)
3. Log in with your 123-reg credentials

### Step 5.2: Find Your Domain

1. In the Control Panel, you'll see your domains listed
2. Find `yourdomain.com`
3. Click **Manage** next to it

### Step 5.3: Go to Nameserver Settings

1. Look for **Manage DNS** or **Nameservers** in the menu
2. In 123-reg, this is usually under **Advanced Domain Settings** → **Manage DNS**
3. Or click directly on **Nameservers** if visible

### Step 5.4: Change Nameservers

1. You'll see the current nameservers (probably 123-reg's defaults)
2. Select **Use custom nameservers** or **Change nameservers**
3. Delete the existing nameservers
4. Enter the two Cloudflare nameservers:

```
Nameserver 1: aria.ns.cloudflare.com
Nameserver 2: bob.ns.cloudflare.com
```

(Use YOUR nameservers from Cloudflare - they may be different) 5. Click **Update** or **Save**

### Step 5.5: Confirm the Change

123-reg may ask you to confirm. Click **Yes** or **Confirm**.

**Important:** DNS changes can take up to 24-48 hours to fully propagate, but usually happen within 1-2 hours.

### Step 5.6: Tell Cloudflare to Check

1. Go back to the Cloudflare tab
2. Click **Done, check nameservers**
3. Cloudflare will verify (may take a few minutes to hours)
4. You'll get an email when your site is active on Cloudflare

### Step 5.7: Wait for Activation

While waiting, you can continue with steps 6-11 (local setup), but you won't be able to fully test until Cloudflare is active.

**Check status:** In Cloudflare, go to **Overview**. When active, you'll see:

> "Great news! Cloudflare is now protecting your site"

---

## 6\. Configure DNS Records in Cloudflare

Once Cloudflare is active (or you can set these up while waiting):

### Step 6.1: Go to DNS Settings

1. In Cloudflare dashboard, click on your domain
2. Click **DNS** in the left sidebar
3. Click **Records**

### Step 6.2: Delete Old Records (Optional but Recommended)

If Cloudflare imported old records that you don't need:

1. Click the **Edit** button next to each unwanted record
2. Click **Delete**
3. Confirm deletion

Keep any records you need (like MX records for email).

### Step 6.3: SKIP THIS - We'll Add Subdomain After Getting Figma's Records

**DO NOT create the subdomain record yet.** We need to get the exact DNS records from Figma first (in Step 7).

Figma will tell you exactly what CNAME target and TXT record to use. If you create it now with a wrong target, Figma won't be able to verify.

**Skip to Step 6.4 below.**

### Step 6.4: Add the Main Domain Record

This is what the Worker will intercept.

1. Click **Add record**
2. Fill in:
   - **Type:** `A`
   - **Name:** `@` (this represents the root domain)
   - **IPv4 address:** `192.0.2.1`
   - **Proxy status:** Keep the orange cloud **ON** (Proxied)
   - **TTL:** Auto
3. Click **Save**

**Note:** The IP address `192.0.2.1` is a reserved documentation address. When proxied through Cloudflare (orange cloud), the actual IP doesn't matter because the Worker intercepts all traffic before it reaches that IP. This is a standard placeholder for proxied Cloudflare Workers.

### Step 6.5: Add WWW Redirect (Optional but Recommended)

1. Click **Add record**
2. Fill in:
   - **Type:** `CNAME`
   - **Name:** `www`
   - **Target:** `yourdomain.com`
   - **Proxy status:** Orange cloud **ON** (Proxied)
3. Click **Save**

### Your DNS Should Look Like This (After Completing Step 7):

| Type  | Name | Content          | Proxy Status     |
| ----- | ---- | ---------------- | ---------------- |
| A     | @    | 192.0.2.1        | Proxied (orange) |
| CNAME | www  | yourdomain.com | Proxied (orange) |
| CNAME | tbp  | (from Figma)     | DNS only (grey)  |
| TXT   | tbp  | (from Figma)     | DNS only (grey)  |

**Note:** The `tbp` records will be added in Step 7 after Figma provides the exact values.

---

## 7\. Connect Figma Sites to Your Subdomain

### Step 7.1: Open Your Figma Sites File

1. Open Figma
2. Open your Sites file (or go to figma.com and open your published site)
3. Click the **Settings** icon (gear icon, usually in the top right or left panel)

### Step 7.2: Go to Domains

1. In Settings, look for **Domains** or **Custom domains**
2. Click on it
3. You'll see your current `.figma.site` URL

### Step 7.3: Add Custom Domain

1. Click **Add custom domain** or **Connect domain**
2. Enter: `web.yourdomain.com`
3. Click **Add** or **Continue**

### Step 7.4: Get the DNS Records from Figma

Figma will show you the exact DNS records you need. You'll see:

1. **A CNAME record** - This points your subdomain to Figma's servers

   - Example: `tbp` → `cname.figma.com` (or similar)

2. **A TXT record** - This verifies you own the domain
   - Example: `tbp` → `figma-site-verification=abc123xyz...`

**IMPORTANT:** Take a screenshot or write down BOTH records exactly as shown. The values are unique to your site.

### Step 7.5: Add DNS Records in Cloudflare

**IMPORTANT:** Use the EXACT values Figma showed you. Don't guess.

#### Add the CNAME Record:

1. Go to Cloudflare → DNS → Records
2. Click **Add record**
3. Fill in:
   - **Type:** `CNAME`
   - **Name:** `tbp`
   - **Target:** Copy the exact target from Figma (e.g., `cname.figma.com` or similar)
   - **Proxy status:** Must be **OFF** (grey cloud - "DNS only")
   - **TTL:** Auto
4. Click **Save**

#### Add the TXT Record:

1. Click **Add record** again
2. Fill in:
   - **Type:** `TXT`
   - **Name:** `tbp` (use exactly what Figma says - might be `tbp` or `_figma-site-verification.tbp`)
   - **Content:** Copy the entire verification string from Figma (starts with `figma-site-verification=`)
   - **TTL:** Auto
3. Click **Save**

**Critical:** The CNAME must have the grey cloud (DNS only). If it's orange, click it to turn off proxying.

### Step 7.6: Verify in Figma

1. Go back to Figma Sites settings
2. Click **Refresh** or **Verify**
3. Wait for verification (can take 5 minutes to 24 hours)

**Status indicators:**

- ⏳ Pending = Still waiting (DNS propagation)
- ✅ Connected = Success!
- ❌ Error = Check your DNS records match exactly

### Step 7.7: Test the Subdomain

Once verified, visit `https://web.yourdomain.com` in your browser.

You should see your Figma Sites page. If you do, Figma is working correctly.

---

## 8\. Set Up Your Local Environment

Now let's set up the tools on your computer.

### Step 8.1: Create a Project Folder

**On Mac:**

```bash
mkdir ~/figma-seo-proxy
cd ~/figma-seo-proxy
```

**On Windows (Command Prompt):**

```cmd
mkdir %USERPROFILE%\figma-seo-proxy
cd %USERPROFILE%\figma-seo-proxy
```

**On Windows (PowerShell):**

```powershell
mkdir $HOME\figma-seo-proxy
cd $HOME\figma-seo-proxy
```

### Step 8.2: Download the Project Files

Download the zip file I provided earlier and extract it to this folder.

Or create the files manually (I'll provide them in the next steps).

### Step 8.3: Verify Files Exist

You should have these files in your folder:

```

├── worker.js
├── prerender.js
├── wrangler.toml
├── package.json
└── README.md
```

---

## 9\. Install and Configure Wrangler

Wrangler is Cloudflare's command-line tool for managing Workers.

### Step 9.1: Install Dependencies

In your project folder, run:

```bash
yarn install
```

This installs:

- `puppeteer` (for rendering pages)
- `wrangler` (Cloudflare's CLI)

### Step 9.2: Log into Cloudflare via Wrangler

```bash
npx wrangler login
```

This will:

1. Open your browser
2. Ask you to log into Cloudflare
3. Ask you to authorize Wrangler

Click **Allow** when prompted.

### Step 9.3: Verify Login

```bash
npx wrangler whoami
```

You should see output like:

```
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email you@email.com!
```

---

## 10\. Create the KV Namespace

KV (Key-Value) storage is where we'll store the pre-rendered HTML.

### Step 10.1: Create the Namespace

```bash
npx wrangler kv:namespace create "PRERENDER_CACHE"
```

You'll see output like:

```
🌀 Creating namespace with title "figma-seo-proxy-PRERENDER_CACHE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "PRERENDER_CACHE", id = "abc123def456789..." }
```

### Step 10.2: Copy the ID

From the output, copy the `id` value. It's a long string like `abc123def456789...`

### Step 10.3: Update wrangler.toml

Open `wrangler.toml` in a text editor and find this section:

```toml
[[kv_namespaces]]
binding = "PRERENDER_CACHE"
id = "your-kv-namespace-id"
```

Replace `your-kv-namespace-id` with the ID you copied:

```toml
[[kv_namespaces]]
binding = "PRERENDER_CACHE"
id = "abc123def456789..."
```

Save the file.

---

## 11\. Configure the Worker Code

### Step 11.1: Open worker.js

Open `worker.js` in a text editor.

### Step 11.2: Get Your Figma CNAME Target

**IMPORTANT:** You need to find the actual CNAME target that Figma provided.

1. Go to Cloudflare Dashboard → DNS → Records
2. Find your `tbp` CNAME record
3. Look at the **Target** column - it will be something like:
   - `cname.figma.com`
   - `sites-proxy.figma.com`
   - Or another Figma hostname

**Write this down - you'll need it in the next step.**

### Step 11.3: Find the CONFIG Section

Near the top of `worker.js`, you'll see:

```javascript
const CONFIG = {
  // Your Figma Sites subdomain (where Figma is actually hosted)
  figmaSiteOrigin: "https://web.yourdomain.com",

  // Figma's actual CNAME target
  figmaActualHost: "", // UPDATE THIS

  // Your main domain (what users and SEO see)
  mainDomain: "https://yourdomain.com",

  // Enable debug headers (set to false in production)
  debug: true,
};
```

### Step 11.4: Update the Values

Change these to match your setup:

```javascript
const CONFIG = {
  figmaSiteOrigin: "https://web.yourdomain.com", // Your Figma subdomain
  figmaActualHost: "cname.figma.com", // The CNAME target from Step 11.2
  mainDomain: "https://yourdomain.com", // Your main domain
  debug: true, // Keep true for testing, change to false in production
};
```

**Why is this needed?** The Worker can't proxy to `web.yourdomain.com` directly because it's also on Cloudflare. Instead, we fetch from Figma's actual server (`cname.figma.com`) and set the Host header to `web.yourdomain.com`.

Save the file.

---

## 12\. Deploy the Worker

### Step 12.1: Deploy to Cloudflare

```bash
npx wrangler deploy
```

You should see:

```
⛅️ wrangler 3.x.x
-------------------
Uploading figma-seo-proxy...
Published figma-seo-proxy (x.xx sec)
  https://figma-seo-proxy.your-subdomain.workers.dev
```

### Step 12.2: Note the Worker URL

The output shows a `.workers.dev` URL. This is your Worker running, but it's not yet connected to your domain.

---

## 13\. Set Up Domain Routes

This tells Cloudflare to send traffic from your domain to the Worker.

### Step 13.1: Go to Workers in Cloudflare Dashboard

1. Log into [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Click **Workers & Pages** in the left sidebar
3. Click on your worker: **figma-seo-proxy**

### Step 13.2: Add Routes

1. Click the **Settings** tab
2. Click **Triggers** in the sub-menu
3. Under **Routes**, click **Add route**

### Step 13.3: Add Main Domain Route

1. Fill in:
   - **Route:** `yourdomain.com/*`
   - **Zone:** Select `yourdomain.com`
2. Click **Add route**

### Step 13.4: Add WWW Route

1. Click **Add route** again
2. Fill in:
   - **Route:** `www.yourdomain.com/*`
   - **Zone:** Select `yourdomain.com`
3. Click **Add route**

### Your Routes Should Look Like:

| Route                   | Zone             |
| ----------------------- | ---------------- |
| yourdomain.com/\*     | yourdomain.com |
| www.yourdomain.com/\* | yourdomain.com |

---

## 14\. Pre\-render Your Pages

Now we'll create the static HTML that bots will see.

### Step 14.1: Configure Your Pages

Open `prerender.js` and find the CONFIG section:

```javascript
const CONFIG = {
  pages: [
    "/",
    // '/about',
    // '/features',
    // '/pricing',
    // '/contact',
  ],
  // ...
};
```

Uncomment and add your pages:

```javascript
const CONFIG = {
  pages: ["/", "/about", "/features", "/pricing", "/contact"],
  // ...
};
```

Save the file.

### Step 14.2: Run the Pre-renderer

```bash
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
```

**On Windows (Command Prompt), use this instead:**

```cmd
node prerender.js --figma-url https://web.yourdomain.com --canonical https://yourdomain.com
```

You'll see output like:

```
🚀 Figma Sites Pre-renderer

Figma URL:  https://web.yourdomain.com
Canonical:  https://yourdomain.com
Output:     ./dist
Pages:      /, /about, /features, /pricing, /contact
KV Upload:  Enabled

Launching browser...

Rendering pages...
  Rendering: https://web.yourdomain.com/
  Saved locally: dist/index.html
  Uploaded to KV: /index
  Rendering: https://web.yourdomain.com/about
  Saved locally: dist/about/index.html
  Uploaded to KV: /about
  ...

Generating sitemap and robots.txt...
  Generated: dist/sitemap.xml
  Uploaded to KV: /sitemap.xml
  Generated: dist/robots.txt
  Uploaded to KV: /robots.txt

✅ Pre-rendering complete!

Summary:
  Successful: 5
  Failed:     0
```

---

## 15\. Test Everything Works

### Test 15.1: Test Human Access

1. Open your browser
2. Go to `https://yourdomain.com`
3. You should see your full Figma Sites page with all animations working
4. Navigate around - everything should work normally

### Test 15.2: Check Debug Headers

Open Terminal/Command Prompt:

```bash
curl -I https://yourdomain.com
```

Look for:

```
x-served-by: figma-proxy
x-bot-detected: false
```

This confirms humans are being proxied to Figma Sites.

### Test 15.3: Test Bot Access

```bash
curl -I -A "Googlebot" https://yourdomain.com
```

Look for:

```
x-served-by: prerender-cache
x-bot-detected: true
```

This confirms bots get the pre-rendered HTML.

### Test 15.4: View What Bots See

```bash
curl -A "Googlebot" https://yourdomain.com
```

You should see HTML with:

- `<!-- Pre-rendered for SEO: ... -->` comment
- `<link rel="canonical" href="https://yourdomain.com">` tag
- Schema.org structured data

### Test 15.5: Test in Browser with Fake Bot User Agent

1. Open Chrome
2. Press **F12** to open DevTools
3. Click the **three dots menu** (⋮) in DevTools
4. Go to **More tools** → **Network conditions**
5. Under **User agent**, uncheck **Use browser default**
6. In the **Custom** dropdown, select **Googlebot**
7. Go to `https://yourdomain.com`
8. Right-click → **View page source**
9. You should see the pre-rendered HTML with canonical tags

### Test 15.6: Google Search Console (Optional)

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property if not already added
3. Use **URL Inspection** tool
4. Enter your URL
5. Click **Test Live URL**
6. Check that Google can see your content

---

## 16\. Ongoing Maintenance

### 16.1: When You Update Your Figma Sites

Every time you publish changes in Figma Sites:

```bash
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
```

### 16.2: Create an Update Script (Recommended)

**On Mac/Linux**, create `update.sh`:

```bash
#!/bin/bash
echo "🔄 Pre-rendering Figma Sites..."
node prerender.js \
  --figma-url https://web.yourdomain.com \
  --canonical https://yourdomain.com
echo "✅ Done!"
```

Make it executable:

```bash
chmod +x update.sh
```

Run it:

```bash
./update.sh
```

**On Windows**, create `update.bat`:

```batch
@echo off
echo Pre-rendering Figma Sites...
node prerender.js --figma-url https://web.yourdomain.com --canonical https://yourdomain.com
echo Done!
pause
```

Double-click to run.

### 16.3: Adding New Pages

When you add a new page to your Figma Sites:

1. Update the `pages` array in `prerender.js`:

```javascript
pages: [
  '/',
  '/about',
  '/new-page',  // Add new page here
],
```

2. Run the pre-renderer again

### 16.4: Disable Debug Headers for Production

Once everything is working:

1. Open `worker.js`
2. Change `debug: true` to `debug: false`
3. Redeploy:

```bash
npx wrangler deploy
```

### 16.5: Monitor Your Worker

View real-time logs:

```bash
npx wrangler tail
```

Press `Ctrl+C` to stop.

### 16.6: Check KV Contents

List all cached pages:

```bash
npx wrangler kv:key list --binding=PRERENDER_CACHE
```

View a specific page:

```bash
npx wrangler kv:key get --binding=PRERENDER_CACHE "/index"
```

Delete a page:

```bash
npx wrangler kv:key delete --binding=PRERENDER_CACHE "/old-page"
```

---

## 17\. Troubleshooting Common Issues

### Issue: "Cloudflare not active on domain"

**Symptoms:** DNS changes not taking effect, can't add routes

**Fix:**

1. Check nameservers at 123-reg are correct
2. Wait up to 24 hours for propagation
3. In Cloudflare, go to Overview → Check nameservers

### Issue: "Figma Sites subdomain not verifying"

**Symptoms:** Figma shows pending or error for custom domain

**Fix:**

1. In Cloudflare DNS, ensure the `tbp` record has **grey cloud** (DNS only, not proxied)
2. Check the CNAME target matches exactly what Figma provided
3. If Figma needs a TXT record, add it exactly as specified
4. Wait 24 hours and try again

### Issue: "Worker not intercepting traffic"

**Symptoms:** Visiting domain shows Cloudflare error or doesn't work

**Fix:**

1. Check routes are set up correctly (Workers → your worker → Settings → Triggers)
2. Ensure main domain DNS record has **orange cloud** (Proxied)
3. Redeploy the worker: `npx wrangler deploy`

### Issue: "Pre-renderer fails to load pages"

**Symptoms:** Errors when running prerender.js

**Fix:**

1. Check the Figma Sites URL is correct
2. Ensure the site is publicly accessible
3. Try visiting the URL in your browser
4. Increase timeout in prerender.js CONFIG if pages are slow

### Issue: "KV upload fails"

**Symptoms:** "Error uploading to KV" messages

**Fix:**

1. Check you're logged in: `npx wrangler whoami`
2. Verify the KV namespace ID in wrangler.toml is correct
3. Re-login: `npx wrangler login`

### Issue: "Bots not getting pre-rendered content"

**Symptoms:** x-served-by shows "figma-proxy" for bot requests

**Fix:**

1. Check the page is in KV: `npx wrangler kv:key list --binding=PRERENDER_CACHE`
2. Re-run the pre-renderer for that page
3. Check for typos in page paths

### Issue: "Links on page go to wrong domain"

**Symptoms:** Clicking links takes users to web.yourdomain.com instead of yourdomain.com

**Fix:**

1. Check the `rewriteHtml` function in worker.js
2. Ensure `figmaSiteOrigin` and `mainDomain` in CONFIG are correct
3. Look for hardcoded URLs in your Figma Sites content

### Issue: "SSL/HTTPS errors"

**Symptoms:** Browser shows security warnings

**Fix:**

1. In Cloudflare, go to **SSL/TLS** → **Overview**
2. Set SSL mode to **Full** or **Full (strict)**
3. Go to **Edge Certificates** and ensure certificates are active
4. Wait 15 minutes for certificate provisioning

---

## Quick Reference Commands

```bash
# Deploy worker
npx wrangler deploy

# View logs
npx wrangler tail

# Pre-render pages
node prerender.js --figma-url https://web.yourdomain.com --canonical https://yourdomain.com

# List KV contents
npx wrangler kv:key list --binding=PRERENDER_CACHE

# Check Cloudflare login
npx wrangler whoami

# Test as bot
curl -A "Googlebot" https://yourdomain.com

# Test headers
curl -I https://yourdomain.com
```

---

## Summary Checklist

- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at 123-reg
- [ ] Cloudflare showing "active" for domain
- [ ] DNS records configured (tbp = grey cloud, @ = orange cloud)
- [ ] Figma Sites connected to web.yourdomain.com
- [ ] Figma subdomain verified and working
- [ ] Node.js and npm installed locally
- [ ] Wrangler logged in
- [ ] KV namespace created and configured
- [ ] worker.js CONFIG updated with your domains
- [ ] Worker deployed
- [ ] Routes added for main domain
- [ ] Pre-renderer run successfully
- [ ] Human access tested ✓
- [ ] Bot access tested ✓
- [ ] Debug headers disabled for production

---

## Costs

**All free tier:**

- Cloudflare Workers: 100,000 requests/day
- Cloudflare KV: 100,000 reads/day, 1,000 writes/day
- DNS hosting: Unlimited

You'd need millions of monthly visitors to exceed the free tier.
