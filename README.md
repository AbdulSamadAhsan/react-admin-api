# Commerce Administration API

Express and MongoDB API for products, orders, customers, coupons, and store administration.

[Live deployment](https://react-admin-api-two.vercel.app)

## Overview

- Admin authentication and account management
- Product uploads and review handling
- Order, customer, coupon, and settings routes
- API regression tests

## Stack

Express, MongoDB / Mongoose.

## Run locally

```bash
git clone https://github.com/AbdulSamadAhsan/react-admin-api.git
cd react-admin-api
npm install
```

Create a local `.env` with `MONGO_URI`, `JWT_SECRET`, `PORT`, and `CORS_ORIGINS`. Configure image storage as described in [DEPLOYMENT.md](DEPLOYMENT.md). See [AUTHENTICATION.md](AUTHENTICATION.md), [DASHBOARD.md](DASHBOARD.md), and [ORDERS.md](ORDERS.md) for API behavior.

```bash
npm run dev
```

Use the local URL printed by the development server.

## Available checks

| Command | Script |
| --- | --- |
| `npm run test` | `node --test --test-concurrency=1 test/*.test.js tests/*.test.js` |

These commands are defined by the project; documentation updates do not imply they have been run.

## Author

[Syed Abdul Samad Ahsan](https://github.com/AbdulSamadAhsan)
