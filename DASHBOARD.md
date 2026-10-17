# Ecommerce dashboard API integration

The existing `models/`, `controllers/`, `routes/`, and `services/` structure and product endpoints are retained. This integration is for `F:\ecommerce-admin-dashboard`.

## Local startup

Keep the existing `.env` containing `MONGO_URI` and `PORT=4000`. Run `npm start` (or `npm run dev`). The dashboard defaults to `http://localhost:4000/api`.

`CORS_ORIGINS` optionally accepts comma-separated browser origins. Defaults include localhost and 127.0.0.1 ports 5173-5176, localhost:3000, and the previously configured frontend deployment. Set explicit origins for any other frontend. The API checks database connectivity independently of authentication and returns a JSON 503 when it cannot connect.

## Authentication status

As requested, products, orders, customers, and settings currently require **no authentication or authorization**. The frontend sends no tokens. The existing `/api/admin` subsystem remains in place for future use and retains its own existing guards. Older authentication documentation describes that subsystem; it does not mean these dashboard routes are protected now. This change does not deploy or expose the local API to a new host.

## Routes

- `GET /api/products`: existing product list response (`products`).
- `POST /api/products`: existing multipart create; image required.
- `PUT /api/products/:id`: existing multipart update; replacement image optional.
- `DELETE /api/products/:id`: existing delete and image cleanup behavior.
- `GET /api/orders?page=1&limit=20`: existing paginated list, newest first, `limit` maximum 100.
- `GET /api/orders/:id`: full order including item snapshots, customer, shipping, payment status, total, and currency.
- `PUT /api/orders/:id`: accepts only `status`. Unknown fields, including customer, items, prices, tracking number, and notes, return 400. Existing status values: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.
- `GET /api/customers`: groups existing orders by normalized customer email, returning order count, first order date, latest order, and spending by currency (cancelled spending excluded). There is no duplicate customer collection.
- `GET /api/settings`: returns stored settings or defaults without inserting records.
- `PUT /api/settings`: saves `{ "storeName": "Studio Store", "contactEmail": "owner@example.com", "currency": "USD" }` in the new singleton StoreSettings model. Names must be 1-35 characters and email must be valid.

Order creation is left to the checkout system. No orders, customers, or products are seeded or migrated. Status updates have no payment, refund, inventory, or carrier side effects. Product model fields and image storage behavior are unchanged.

Run `npm test` for existing upload, product lifecycle, admin subsystem, and dashboard contract tests. Tests mock persistent storage and do not modify existing database records.

## Production connection

The admin API is deployed at `https://react-admin-api-two.vercel.app` and the integrated dashboard at `https://ecommercedashboard-amber.vercel.app`. The production database URI points to the existing Atlas shopco database used by the checkout project, rather than the separate local shopco database. The dashboard origin is included in CORS.

`services/OrderService.js` maps checkout `shipping` details and `items.productId` snapshots to the admin response format without migrating records. It preserves totals, discounts, delivery fees, variants, and the `awaiting_payment` status, while excluding internal checkout and payment-provider identifiers from responses. Reads use lean queries so the admin schema cannot replace checkout values with defaults. Writes still update only status.
