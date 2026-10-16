# Product image storage

Before deploying the admin authentication changes, configure `JWT_SECRET` and `ADMIN_REGISTRATION_KEY` and update the frontend to send bearer tokens. See `AUTHENTICATION.md` for setup and requests. All product API routes now require an active admin account.

On Vercel (`VERCEL=1`), product create and update uploads are stored in a public Vercel Blob store. Locally, uploads remain in `uploads/`.

Connect a public Blob store to the Vercel project and provide `BLOB_READ_WRITE_TOKEN` for that store in the deployment environment. Redeploy after configuring storage. Keep this token on the server, never in frontend code.

Image replacement saves the new Blob URL before deleting the old image. Product deletion removes its primary image after database deletion succeeds. Failed database writes clean up the newly uploaded Blob. Existing local image URLs still use local file cleanup; they are not automatically migrated to Blob.

If image cleanup fails after a database change, the API returns `imageCleanupFailed: true` alongside its successful product response and logs the cleanup error. The database change is already committed; the failed image deletion needs manual cleanup. There is no automatic retry queue.

This applies to the primary `image` uploaded by the API. The optional `images` array contains caller-supplied URLs and is not treated as owned uploaded files.

Run `npm test` for local-file and mocked Blob/database lifecycle checks. These tests do not modify a live Blob store or database.
