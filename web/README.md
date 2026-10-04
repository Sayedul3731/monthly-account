This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

### Personal categories

Use **Add category** beside the category picker in the transaction form,
quick-expense form, or recurring-expense form. Enter a name and optional icon;
the current income/expense type is used automatically. A successful creation
selects the category immediately. Categories are private to the signed-in account
and appear alongside shared defaults in all account category pickers and imports.

Creating a category requires an internet connection. Once saved in the lookup
catalog, personal categories can also be used for offline transaction entry.
Admins continue managing shared categories from Admin → Categories.

### New-account setup

New email and Google signups go to a Bengali `/onboarding` flow: welcome,
monthly income, monthly budget, first expense, and a summary of actual income,
budget, spending, and remaining budget. Amounts accept Bengali or English digits.
Income and expense are real ledger entries; saving a step again updates the same
entry. Steps can be skipped, and saved data remains in the account.

Setup progress, its original month, and the completed/skipped outcome are saved
through `PATCH /auth/me/onboarding`. Unfinished setup resumes after login, even
across a month boundary. The dashboard opens the month that was set up. Existing
and administrator-created accounts go directly to the dashboard.

Run `npm test` for routing, session, Bengali input, and summary regression checks.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

### Same-origin API proxy

When the web app and API are deployed at different origins, configure the web
project with these production environment variables:

```bash
NEXT_PUBLIC_API_URL=/api
API_PROXY_ORIGIN=https://your-api.example.com
```

The Next.js rewrite proxies browser requests through the web origin. This avoids
CORS preflight round trips for authenticated API calls. Leave these variables
unset for the existing direct-API deployment behaviour.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Launch changes and verification

Password recovery is available from login through `/forgot-password` and
`/reset-password`. New passwords accept 8–64 characters. Password reset links
are removed from the browser URL after the form loads, and the reset page uses
no-referrer and no-index metadata. The API must have working SMTP credentials.

Account → Categories opens `/categories`. Shared categories remain read-only;
personal categories can be edited or deleted by their owner. The API prevents
renaming, changing the type, or deleting used categories so saved records and
budgets keep their meaning. Icons can still be changed. Personal expense
categories appear in budget allocation.

Transaction retries and offline sync reuse stable request IDs. Imports validate
all rows before saving, report partial progress, and retain a per-user retry batch
across reloads. Resume the same batch after a failure; closing it abandons the
remaining rows and leaves already saved transactions in place. Browser storage
must work before a queued transaction or import is reported as saved.

PDF exports use the bundled Bengali font and browser text shaping for Bengali
descriptions and categories. Non-ASCII lines are embedded as images and cannot
be selected as text; use Excel or CSV when editable text is needed.

Run in `web/` with Node.js 24:

```bash
npm ci
npm run lint
npm test
npm run build
npx tsc --noEmit
npx playwright install --with-deps chromium
npm run test:browser
npm audit --omit=dev --audit-level=high
```

For the recommended proxy deployment, set `NEXT_PUBLIC_API_URL=/api` and
`API_PROXY_ORIGIN` before the build. The public API URL is baked into the browser
bundle. Register Google OAuth's callback on the web origin at
`/api/auth/google/callback` and configure the API accordingly. Refresh and OAuth
state cookies use `/` so they work through the proxy.

Browser tests start the production build on port 3100, mock API responses, and
exercise desktop/mobile recovery, category management, budgets, and Bengali PDF
downloads. They do not connect to the operator's API. On Windows, use `npm.cmd`
and `npx.cmd` when needed. To use installed Edge instead of downloaded Chromium,
set `PLAYWRIGHT_CHANNEL=msedge` before running the browser tests.

GitHub Actions verifies both projects; Dependabot checks dependencies weekly.
The web production dependency audit currently passes. The full development audit
still reports high advisories in the Next.js ESLint dependency chain; CI reports
those separately. Review upstream updates before removing that exception. Do
not apply a forced downgrade of `eslint-config-next` to an incompatible major.

See [API launch preparation](../api/README.md#launch-preparation-and-progress)
for migrations, administrator setup, SMTP/OAuth verification, backups, monitoring,
and release checks. Public support and policy pages are deferred at the owner's
request.
