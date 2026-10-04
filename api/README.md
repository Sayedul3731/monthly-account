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
