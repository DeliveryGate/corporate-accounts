# Corporate Accounts — B2B Portal

**Built and proven in production at Vanda's Kitchen.** The account system behind Vanda's Kitchen's enterprise clients.

A complete B2B account management system for Shopify merchants. Includes a public-facing application form, merchant admin for reviewing and approving applications, tiered pricing per account, monthly consolidated invoicing, and a logged-in portal for account holders.

---

## App Store Listing

**Developer:** SaltCore | saltai.app | support@saltai.app

**Description:**
Corporate Accounts — B2B Portal is the complete solution for Shopify merchants serving business customers. Built and proven in production at Vanda's Kitchen, it powers enterprise client relationships with tailored pricing, consolidated monthly invoicing, and a branded application experience your customers will trust.

Add a fully styled corporate accounts page to your storefront in minutes using the Theme App Extension — no code required. Merchants review and approve applications from a clean Polaris dashboard, set custom discounts per account, and generate monthly invoices with one click.

---

## Plans

| Plan       | Price     | Features |
|------------|-----------|---------|
| Free       | $0/month  | Application form only, up to 3 active accounts |
| Starter    | $19/month | Unlimited accounts, admin review dashboard, custom pricing per account |
| Pro        | $39/month | Monthly invoice generation, account portal with order history, custom T&Cs builder |
| Enterprise | $99/month | Multi-location accounts, API access, custom onboarding, dedicated support |

---

## Structure

```
corporate-accounts/
├── Dockerfile
├── railway.json
├── package.json
├── shopify.app.toml
├── prisma/
│   └── schema.prisma
├── web/
│   ├── index.js              # Express backend
│   ├── shopify.js            # Shopify helpers, plans, billing
│   ├── package.json
│   ├── middleware/
│   │   └── verify-request.js
│   ├── lib/
│   │   └── accountHelpers.js
│   └── frontend/
│       ├── index.html
│       ├── vite.config.js
│       ├── App.jsx
│       └── pages/
│           ├── index.jsx         # Dashboard
│           ├── applications.jsx  # Application review
│           ├── invoices.jsx      # Invoice management
│           └── settings.jsx      # T&Cs, bank details, plans
└── extensions/
    └── corporate-accounts/
        ├── shopify.extension.toml
        └── blocks/
            └── corporate_form.liquid  # Theme app extension
```

---

## Setup

### Environment Variables

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=https://your-app.railway.app
NODE_ENV=production
PORT=3000
```

### Deploy to Railway

1. Connect your GitHub repo to Railway
2. Set the environment variables above
3. Railway builds via Dockerfile automatically
4. Run `shopify app config link` to configure `shopify.app.toml` with your real client ID

### Local Development

```bash
cd web && npm install
npm run dev          # starts Vite frontend on :5173
node index.js        # starts Express backend on :3000
```

---

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/public/apply | Public | Submit corporate account application |
| GET | /api/applications | Session | List applications (paginated, filter by status) |
| GET | /api/applications/:id | Session | Single application |
| POST | /api/applications/:id/approve | Session | Approve + set custom pricing |
| POST | /api/applications/:id/reject | Session | Reject application |
| POST | /api/applications/:id/suspend | Session | Suspend account |
| GET | /api/applications/:id/invoices | Session | Invoices for account |
| POST | /api/applications/:id/invoices | Session | Generate monthly invoice (Pro+) |
| GET | /api/invoices | Session | All invoices |
| GET | /api/settings | Session | Merchant settings |
| POST | /api/settings | Session | Save settings |
| GET | /api/billing/status | Session | Plan + account counts |
| POST | /api/billing/subscribe | Session | Start subscription |
| GET | /api/billing/callback | Public | Billing callback |
| POST | /api/webhooks/:topic | Webhook | GDPR webhooks |

---

## Theme App Extension

The extension adds a `Corporate Accounts` block to the Theme Editor. It renders:

1. **Hero** — customisable headline, subtitle, trust badges
2. **Login CTA** — directs existing account holders to `/account/login`
3. **Application form** — posts to `/apps/corporate-accounts/apply`, fully validated with success/error states
4. **Benefits cards** — Tailored Pricing, Monthly Invoicing, Priority Delivery, Dedicated Support
5. **T&Cs section** — displays merchant-configured terms or sensible defaults
6. **Bank details** — shown only when configured in the app settings
7. **Bottom CTA** — configurable buttons

All text, colours, and URLs are configurable in the Theme Editor with no code changes needed.

---

## Scopes

`read_products,write_products`
