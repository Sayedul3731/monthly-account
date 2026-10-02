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
