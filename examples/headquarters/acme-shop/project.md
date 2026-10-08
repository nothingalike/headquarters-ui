---
project: acme-shop
remote: github.com/acme/shop
updated: 2026-10-07
---

# Acme shop

The storefront and its inventory admin. Runs on Node 22 with Postgres.

## Things to know

- The cart lives in `src/cart/`; migrations run with `npm run db:migrate`.
