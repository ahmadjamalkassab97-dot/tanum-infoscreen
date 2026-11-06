# Tanum InfoScreen

Cloudflare Worker for Lysekil Buss – Tanum. Includes a Swedish TV information display and admin panel.

Required: bind a Workers KV namespace as `INFO_KV` and set the secret/variable `ADMIN_PIN`. Update the placeholder namespace ID in `wrangler.toml` before Wrangler deployment. Images are currently added as HTTPS URLs.
