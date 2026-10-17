# Order administration

The Order API follows the product structure: `models/OrderModel.js`, `controllers/OrderController.js`, and `routes/OrderRoute.js`, mounted in `server.js`.

Dashboard order routes currently require no authentication or authorization, as requested. The existing admin subsystem is retained separately. See `DASHBOARD.md`.

- `GET /api/orders?page=1&limit=20`: lists orders newest first. Returns `orders` and `pagination` with `page`, `limit`, `total`, and `pages`. Limit must be 1–100.
- `GET /api/orders/:id`: returns full order details, including ordered items.
- `PUT /api/orders/:id`: updates only the `status` field. Returns the updated `order` (also under `data`).

Example update body:

```json
{
  "status": "shipped"
}
```

Status must be `pending`, `processing`, `shipped`, `delivered`, or `cancelled`. Admins can correct statuses in either direction; updates do not trigger refunds, stock changes, payments, or courier actions.

Unknown fields, empty updates, malformed IDs, and invalid field values return 400. Missing orders return 404.

There are no create or delete endpoints. Orders must already exist in MongoDB's `orders` collection, populated by a separate checkout system. No orders are seeded by this change. The model includes customer details, shipping address, item snapshots, total, currency, payment status, and timestamps. Customer data, items, total, currency, and payment status cannot be changed through this administration endpoint.
