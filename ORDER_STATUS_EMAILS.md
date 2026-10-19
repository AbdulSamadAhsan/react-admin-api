Order status changes made through the admin API queue an email in the same MongoDB transaction. Processing, shipped, delivered, pending, awaiting-payment, and cancellation changes are supported. Selecting the existing status does not queue another notification. Cancellation retains transactional stock restoration.

Configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and EMAIL_FROM in the admin API environment. Secrets must never be committed. Mail goes to the stored order customer email, falling back to its checkout shipping email.

Delivery is attempted after commit. Failed jobs remain in the OrderStatusEmail collection with a retry time and sanitized error code; successful status updates are preserved. Call services/orderStatusEmail.retryPending() from an initialized database connection to retry due jobs (up to five attempts). Automatic scheduled retries are not configured. SMTP acceptance does not guarantee inbox delivery.
