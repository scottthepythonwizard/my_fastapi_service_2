# SOLE favorites and administrator access

The shared `/account` page is linked from Archive, Fit and Compare. Sign in with a Supabase Auth account, or create an account and confirm the email if required. Save sneakers, refresh to check persistence, and remove favorites. Each account has its own list.

## Relationships and permissions

- `public.favorites.user_id` references `auth.users.id`.
- `public.favorites.sneaker_id` references `sole.sneakers.id`.
- Both foreign keys cascade on deletion. The composite primary key prevents duplicates.
- `public.sole_admins.user_id` references `auth.users.id` and records administrator membership.
- RLS allows signed-in users to select, insert and delete only their own favorites. No ownership updates are granted. Admins also see only their own favorites.
- Users cannot promote themselves or modify the catalog. Public requests cannot read favorites.

The basic admin panel lists sneakers, edits name/retail price, and deletes a sneaker after confirmation. Deletion removes the matching category record and saved favorites. Admin functions are SECURITY INVOKER and protected by RLS membership checks. The existing server-only admin-token API remains available for full catalog creation/management.

The requested existing account has been assigned admin on the connected Sole project. To assign another trusted account, the database owner can insert its `auth.users.id` into `public.sole_admins`. Do not use editable `user_metadata` for authorization. Removing the membership row revokes these admin permissions.

## Deployment and builds

The database migration is already applied to the connected Sole project. The repository preserves the actual remote migration versions, including the category-table migration recovered from migration history. Do not replay these manually on production.

The website changes must be deployed before `/account` appears in production. The catalog repository now supports the current category tables and atomic multi-table writes. The browser contains only a publishable Supabase key and public catalog key; no admin token, database password or service key.

To rebuild the committed local browser bundle, run `npm ci` and `npm run build` in `account-client/`. SDK/build dependencies are pinned with a lockfile. No runtime CDN dependency is needed.

## Verification and limits

Live database tests used two existing identities under the authenticated role: favorite add/read, cross-user read/delete isolation, rejection of spoofed ownership, duplicates, missing sneakers and self-promotion, admin-only catalog listing/editing/deletion, and cascading favorite cleanup. All test writes rolled back; the 20 sneakers remain.

Local Chromium tests used mocked Auth/REST responses with a catalog fixture: user/admin panels, add, persistence after reload, remove, admin edit submission and signout, with no JavaScript errors. Real password sign-in and email delivery still require production verification with the account owner after deployment.

The existing 12 Archive API tests passed. Schema security and performance advisors found no new issues. Auth reports leaked-password protection disabled; enable it if supported by the project plan.
