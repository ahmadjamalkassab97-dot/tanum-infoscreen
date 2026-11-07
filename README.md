# Tanum InfoScreen – TV refresh

This update refreshes the TV display with a widescreen 16:9 layout, live clock/date, Tanum weather via Open-Meteo, a large image/story area, and a bottom information ticker. The mobile admin interface and existing KV-backed post API are retained.

## Cloudflare bindings
- KV namespace binding: `INFO_KV`
- Secret: `ADMIN_PIN` (set your own PIN in the Cloudflare dashboard)

## Routes
- `/` – TV display
- `/admin` – mobile admin
- `/api/posts` – public post feed
- `/api/weather` – current weather for Tanum

See `INSTALLERA_AR.txt` for deployment steps.
