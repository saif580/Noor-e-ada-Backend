# TODO

## Infrastructure & Setup

- [x] Set up PostgreSQL with auto-initializing schema
- [x] Connect to Supabase (dev + uat)
- [x] Multi-environment config (dev, uat, prod)
- [x] Cloudinary integration for image and video uploads
- [x] Swagger/OpenAPI documentation
- [x] Global error handler and 404 handler
- [x] Rate limiting middleware
- [x] Decide whether `uat` will use sandbox SMTP or real SMTP: Mailtrap sandbox for UAT
- [ ] Add `.env` documentation for required variables
- [ ] Rename remaining legacy `fashion-store` identifiers in package metadata and Cloudinary folder config

## Auth

- [x] Register with email verification
- [x] Login with JWT access + refresh token
- [x] Refresh token flow
- [x] Logout with token invalidation
- [x] Email verification end-to-end
- [x] Resend verification email
- [x] Forgot password and reset password flow
- [x] Fix one-active-verification-token persistence rule
- [x] Role-based authorization middleware
- [ ] Decide final password policy for production
- [ ] Decide whether refresh tokens should be hashed in the database
- [ ] Add auth audit logging for sensitive events

## OAuth

- [ ] Choose first OAuth provider for UAT, likely Google
- [ ] Add OAuth env vars: provider client ID, client secret, callback URL, and frontend redirect URL
- [ ] Add database support for OAuth identities or provider fields linked to users
- [ ] Implement OAuth state/CSRF protection
- [ ] Add `GET /api/auth/oauth/:provider` start endpoint
- [ ] Add `GET /api/auth/oauth/:provider/callback` callback endpoint
- [ ] Link OAuth login to an existing email account when safe
- [ ] Create a new verified customer account from OAuth profile when no user exists
- [ ] Issue the same JWT access token and refresh token pair used by password login
- [ ] Add OAuth logout/session behavior notes
- [ ] Add Swagger docs and UAT redirect URI setup notes for OAuth

## Users

- [x] Get and update customer profile
- [x] Address management (create, update, delete)
- [x] Default shipping and billing address selection

## Catalog

- [x] Categories module with parent-child support
- [x] Products module with pagination
- [x] Product variants (SKU, size, color, material, price, compare_at_price)
- [x] Product images support
- [x] Product attributes (generic key-value)
- [x] Wire Cloudinary upload into product image endpoints
- [x] Add product search (full-text)
- [x] Add product filters (price, size, color, category)
- [x] Add sort options (price, newest, popularity)

## Cart

- [x] Create cart table in database
- [x] Create cart items table
- [x] POST /api/cart/items — add item to cart
- [x] GET /api/cart — get current user's cart
- [x] PUT /api/cart/items/:id — update quantity
- [x] DELETE /api/cart/items/:id — remove item
- [x] DELETE /api/cart — clear cart
- [x] Handle out-of-stock validation on add
- [x] POST /api/cart/coupon — apply coupon to cart
- [x] DELETE /api/cart/coupon — remove coupon from cart

## Orders

- [x] Create orders table
- [x] Create order_items table
- [x] POST /api/orders — place order from cart
- [x] GET /api/orders — list user's orders
- [x] GET /api/orders/:id — get order details
- [x] Add order status flow (pending → confirmed → shipped → delivered → cancelled)
- [x] Send order confirmation email

## Inventory

- [x] Add inventory tracking on order placement
- [x] Add stock reservation strategy during checkout
- [x] Handle oversell prevention
- [x] Low stock warnings for admin

## Payments

- [x] Choose payment provider (Razorpay)
- [x] Create order_payments table
- [x] POST /api/payments/create-order — initiate Razorpay order for a pending order
- [x] POST /api/payments/verify — verify HMAC signature, confirm order
- [x] POST /api/payments/webhook — handle payment.captured / payment.failed events
- [x] Send payment success email after verified/captured Razorpay payment
- [x] Configure RAZORPAY_WEBHOOK_SECRET and register webhook URL in Razorpay dashboard for UAT

## UAT Deployment

- [x] Choose UAT backend host: Render free web service
- [x] Configure Render service from backend GitHub repo
- [x] Configure Render service branch: `uat`
- [x] Configure Render build command: `npm install`
- [x] Configure Render start command: `npm run start:uat`
- [x] Configure Render health check path: `/api/health`
- [x] Configure Render env: `APP_ENV=uat`
- [x] Configure Render env: `APP_BASE_URL=https://noor-e-ada-backend-uat.onrender.com`
- [x] Configure Render env: `DATABASE_URL` for Supabase UAT database
- [x] Configure Render secrets: JWT, refresh JWT, Cloudinary, Razorpay, and Mailtrap
- [x] Deploy backend to Render: `https://noor-e-ada-backend-uat.onrender.com`
- [x] Add UAT frontend CORS allowlist support through `FRONTEND_URL`
- [ ] Update Render env `FRONTEND_URL` after final Vercel frontend URL is confirmed
- [x] Verify `GET /api/health` from deployed Render URL
- [ ] Run deployed API smoke test: auth, catalog, cart, checkout, wishlist, reviews
- [ ] Document UAT backend URL, env var names, webhook secret handling, and rollback steps

## Coupons & Discounts

- [x] Create coupons table (discount_type, max_discount_amount, per_user_limit, starts_at, free_shipping flag)
- [x] Create coupon_redemptions table for per-user tracking
- [x] Discount calculation (percentage with cap, fixed, free shipping)
- [x] Coupon validation: expiry, start date, global usage limit, per-user limit
- [x] Coupon applied and discount persisted at order placement
- [x] Discount and total shown in order confirmation email

## Wishlist

- [x] Create wishlist table
- [x] POST /api/wishlist — add product
- [x] GET /api/wishlist — get user's wishlist
- [x] DELETE /api/wishlist/:id — remove item

## Reviews & Ratings

- [x] Create product_reviews table
- [x] POST /api/products/:id/reviews — submit review
- [x] GET /api/products/:id/reviews — list reviews
- [x] Average rating on product listing

## Admin

- [x] Admin product management (create, update, delete, bulk)
- [x] Admin category management (delete)
- [x] Admin order management (view all, update status)
- [x] Admin user management (list, edit role, deactivate)
- [ ] Sales and inventory reports

## Documentation

- [ ] Keep Swagger docs updated for every new API
- [ ] Re-export `docs/openapi.json` after API changes
- [ ] Add `.env.example` file with all required variables
- [ ] Document OAuth setup once provider credentials are created
