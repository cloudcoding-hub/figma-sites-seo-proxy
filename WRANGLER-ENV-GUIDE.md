# How Wrangler Loads .env Variables

## Overview

Wrangler has **built-in support** for `.env` files. When you run wrangler commands, it automatically:

1. Reads your `.env` file
2. Loads the variables into the environment
3. Makes them available to your worker via the `env` parameter

## How It Works

### Your .env File

```bash
FIGMA_SITE_URL=https://web.yourdomain.com
MAIN_DOMAIN=https://yourdomain.com
KV_NAMESPACE_ID=abc123def456
DEBUG=false
```

### Wrangler Automatically Injects Them

When you run:

```bash
npx wrangler deploy
```

Wrangler:

1. ✅ Reads `.env`
2. ✅ Sets environment variables
3. ✅ Passes them to your worker as `env.FIGMA_SITE_URL`, `env.MAIN_DOMAIN`, etc.

### Your Worker Receives Them

In `worker.js`:

```javascript
export default {
  async fetch(request, env, ctx) {
    // env.FIGMA_SITE_URL is automatically available!
    // env.MAIN_DOMAIN is automatically available!
    // env.DEBUG is automatically available!

    const config = getConfig(env);
    // Now config.figmaSiteOrigin = env.FIGMA_SITE_URL
  },
};
```

## No Manual wrangler.toml [vars] Needed!

### ❌ Old Way (Manual)

```toml
[vars]
FIGMA_SITE_URL = "https://web.yourdomain.com"  # Had to edit this
MAIN_DOMAIN = "https://yourdomain.com"         # And this
DEBUG = "false"                                # And this
```

### ✅ New Way (Automatic)

```toml
[vars]
# Wrangler automatically loads from .env file
# No need to edit this section!
```

Just update `.env` - that's it!

## The [vars] Section

The `[vars]` section in `wrangler.toml` is now just a **placeholder**.

Wrangler will:

1. See you have a `[vars]` section (even if empty)
2. Look for a `.env` file
3. Load variables from `.env`
4. Inject them into your worker

So you can leave it empty or just have a comment:

```toml
[vars]
# Populated automatically from .env file
```

## Development vs Production

### Local Development

```bash
npx wrangler dev
```

- Reads `.env` file
- Runs worker locally with those variables

### Production Deployment

```bash
npx wrangler deploy
```

- Reads `.env` file
- Uploads worker with those variables to Cloudflare

### Different Environments (Optional)

If you need different configs for dev/prod, you can create:

- `.env` - Default/production
- `.env.development` - Development overrides

Wrangler will use the appropriate one based on the command.

## Prerender Script

The prerender script uses `dotenv` package to read `.env`:

```javascript
require("dotenv").config(); // Loads .env into process.env

const figmaUrl = process.env.FIGMA_SITE_URL; // Now available
```

This is separate from wrangler but achieves the same result - one `.env` file for everything!

## Summary

✅ **One .env file** controls everything
✅ **Wrangler reads it automatically** (no manual [vars] editing)
✅ **Prerender reads it automatically** (via dotenv package)
✅ **Worker receives variables** via `env` parameter
✅ **No configuration duplication**

Just update `.env` and run your commands - wrangler handles the rest!
