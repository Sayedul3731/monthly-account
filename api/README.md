<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development (watches source files and restarts automatically)
$ npm run start

# explicit watch-mode alias
$ npm run start:dev

# development without watching
$ npm run start:once

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

### Personal categories

Authenticated users (including admins) can create a private category using
`POST /categories/mine` with `{ "name": "Pet care", "type": "expense", "icon": "🐾" }`.
`GET /categories/mine?type=expense` returns shared defaults plus only the current
user's categories. The type filter is optional. Names are trimmed, must be
nonempty, and cannot duplicate a visible category of the same type.

The existing public `GET /categories` and admin create/update/delete endpoints
continue to operate on shared categories. Transactions, onboarding entries, and
recurring expenses accept shared categories or categories owned by the caller.
Another account's personal category ID is rejected as not found.

On startup, the API creates the unique `(userId, type, name)` index before removing
the old `type_1_name_1` index. Existing categories without `userId` remain shared;
no documents are reassigned. Different users can independently create the same
personal category name. The database account needs index-management permissions.
Personal category creation and listing remain subscription exempt.

### Account onboarding

Self-service email registration and newly created Google accounts start with
`onboardingStatus: pending` and `onboardingStep: 0`. Existing accounts and accounts
created by an administrator retain direct dashboard access; no migration is needed.

Authenticated users can save progress with `PATCH /auth/me/onboarding` using
`{ "step": 1 }` (steps 0–4), or finish with `{ "status": "completed" }` or
`{ "status": "skipped" }`. Progress cannot move backwards, and completed/skipped
setup cannot be reopened by delayed requests. This endpoint is subscription
exempt, so an expired trial can still exit setup; budget writes keep their normal
subscription checks. Profile and authentication responses include setup state.

Setup starts by saving `{ "period": "2026-10" }`; this month is set only once so
resuming next month preserves the original account period. The Bengali web flow
records monthly income, an overall budget, and a first expense, then reads the
monthly dashboard to show actual spending and remaining budget.

`GET /transactions/onboarding` retrieves the current user's setup entries.
`PUT /transactions/onboarding/income` and `PUT /transactions/onboarding/expense`
accept the normal transaction payload and update one ledger entry per user and
kind. A unique partial index prevents duplicate entries on retries or concurrent
first submissions. These writes require pending setup and a date in its saved
month, and retain normal subscription and category/type validation.

### Security deployment checklist

- Set `NODE_ENV=production`, HTTPS `FRONTEND_URL`/`API_URL`, and a production
  MongoDB URI.
- Generate separate `JWT_SECRET` and `JWT_REFRESH_SECRET` values of at least
  32 characters. The API refuses unsafe or duplicate JWT secrets in production.
- Review privileged changes through `GET /audit-events` as an administrator.

### Budget ownership migration

Before deploying the user-scoped budget change, run:

```bash
npm run migrate:budget-ownership
```

If legacy budgets exist, set `LEGACY_BUDGET_OWNER_ID` to their real owner's
MongoDB ObjectId before running the command. The migration validates the supplied
user, assigns only budgets with no `userId`, and replaces the old global unique
index with the user-scoped index. It will not guess an owner. If no legacy budgets
exist, no owner ID is required.

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Launch preparation and progress

| Launch item | Progress |
| --- | --- |
| Password recovery | Implemented: generic email responses, 30-minute single-use hashed tokens, 8–64 character passwords, and session revocation |
| Safe transaction retries and offline sync | Implemented: per-user request IDs and database uniqueness; conflicting or deleted request IDs are rejected |
| Import recovery | Implemented in web: full validation before writes, saved per-user retry batches, and partial-progress reporting |
| Personal category management and budgets | Implemented: owner-only edit/delete, usage protection, custom budget categories, and concurrent budget upserts |
| Payment concurrency | Implemented: one pending payment per user and atomic approval/plan activation |
| Bengali PDF exports | Implemented in web using browser font shaping; non-ASCII lines are images in the PDF |
| Production readiness and diagnostics | Implemented: `/health/ready`, request IDs, server-error logs, and cron completion/failure logs |
| First-admin bootstrap and launch checks | Implemented: `bootstrap:admin` and read-only `check:launch` scripts |
| Automated checks and dependency updates | Implemented: GitHub Actions for API/web and weekly Dependabot updates |
| Production SMTP, Google OAuth, backups, alerts, and payment verification | Operator configuration and staging verification still required |
| Public support and policy pages | Deferred at the project owner's request |

### Verify locally

Run in `api/` with Node.js 24 and the committed lockfile:

```bash
npm ci
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npm audit --audit-level=high
```

Integration tests create and destroy an isolated MongoDB replica set and mock
SMTP. They never use the application's database. The first run downloads a
MongoDB test binary. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.
After dependency updates, restart an already-running API watcher. The separate
`typecheck` command checks every source and script file without incremental cache.

### Prepare staging before public launch

1. Create a separate staging database and take a restorable backup of any existing
   data. Use a MongoDB replica set or sharded cluster; payment approval needs
   transactions. Set production-mode environment variables from `.env.example`,
   distinct random JWT secrets, a random `CRON_SECRET`, HTTPS URLs, SMTP credentials,
   and the actual public Nagad collection number. Keep credentials out of Git.
2. Rehearse `npm run migrate:budget-ownership` on the staging copy. Supply
   `LEGACY_BUDGET_OWNER_ID` only when old ownerless budgets exist, including null
   owners. Confirm the intended owner and budget counts afterward. The migration
   creates the replacement index before dropping the old global index.
3. Review old pending payments for duplicate submissions before starting the
   updated API. Its required unique index will prevent startup if duplicates
   remain. Resolve them with the operator's review process; the application does
   not silently discard payment records. The database account needs permission
   to create required indexes.
4. Build and start the API, then register the intended administrator account.
   Set `BOOTSTRAP_ADMIN_EMAIL` temporarily and run `npm run bootstrap:admin`.
   It promotes that existing account, revokes its sessions, and refuses when an
   active administrator already exists. Remove the temporary variable and sign
   in again. Do not use default administrator credentials.
5. Run `npm run check:launch` with the intended production-mode staging configuration.
   It checks configuration, transaction support, legacy budgets, administrator
   availability, required unique indexes, and duplicate pending payments. It
   reads the configured database without changing its records. It does not prove
   email delivery or external provider configuration.
6. Verify SMTP delivery to a real mailbox: unknown email gets the same recovery
   response, reset links expire and work once, old sessions stop working, and
   email-change verification completes. For same-origin web proxy deployments,
   register `https://your-web.example.com/api/auth/google/callback` with Google
   and set `GOOGLE_CALLBACK_URL` to that exact URL. Use the API's own HTTPS origin
   for `API_URL` (email-verification links), and the web origin for `FRONTEND_URL`.
7. With two test accounts, verify category, transaction, budget, payment, and
   notification isolation. Check trial expiry, payment submission, rejection,
   approval, and renewal; confirm the amount and interval in the admin review.
   Test offline entry followed by reconnect and safe retry of interrupted imports.
8. Configure uptime monitoring for `/health` and `/health/ready`, alerting for
   `http_server_error` and `monthly_summaries_failed`, and missing daily cron
   completion. Forward the API logs to your hosting provider's log service.
   Request IDs in `X-Request-ID` help correlate failures without logging bodies.
   The cron route requires `Authorization: Bearer <CRON_SECRET>`; verify its
   scheduled execution and rerun behavior on staging.
9. Restore a managed database backup into a separate staging cluster. Compare
   user, transaction, budget, and payment counts; confirm login and ledger access
   with test accounts. Record the recovery steps and restore duration. Rehearse
   rollback to the prior application release without dropping the new indexes.
10. Deploy the verified builds, repeat readiness/login/payment smoke checks, and
    watch errors and cron completion. Enable required CI checks before merging.

Production credential setup, actual backup restoration, external alerts, and
deployment must be performed in the operator's hosting accounts. None of these
scripts deploys the project or sends test mail to real users.
