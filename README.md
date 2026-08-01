# 🏨 STUDIO NEXT — Full-Stack Hotel Booking System

> A production-grade, real-world hotel booking platform built with **Next.js 16**, **Prisma**, **PostgreSQL (Supabase)**, and **Razorpay** — featuring an AI concierge chatbot, admin dashboard, staff portal, and automated email notifications.

---

## Table of Contents

1. [Why This Project Exists](#1-why-this-project-exists)
2. [Tech Stack & Why Each Tool Was Chosen](#2-tech-stack--why-each-tool-was-chosen)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure — File by File](#4-project-structure--file-by-file)
5. [Database Design (Prisma Schema)](#5-database-design-prisma-schema)
6. [The Booking Flow — Step by Step](#6-the-booking-flow--step-by-step)
7. [Pricing Engine Deep Dive](#7-pricing-engine-deep-dive)
8. [Razorpay Payment Integration](#8-razorpay-payment-integration)
9. [Email System](#9-email-system)
10. [AI Chatbot (RAG-powered)](#10-ai-chatbot-rag-powered)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Staff / Reception Portal](#12-staff--reception-portal)
13. [Guest Self-Service (Manage Booking)](#13-guest-self-service-manage-booking)
14. [Cancellation & Refund Engine](#14-cancellation--refund-engine)
15. [PMS Integration (Property Management System)](#15-pms-integration-property-management-system)
16. [Security Architecture](#16-security-architecture)
17. [Environment Variables](#17-environment-variables)
18. [Getting Started (Local Development)](#18-getting-started-local-development)
19. [Deployment (Vercel + Supabase)](#19-deployment-vercel--supabase)
20. [NPM Scripts Reference](#20-npm-scripts-reference)
21. [Contributing & Extending This Project](#21-contributing--extending-this-project)

---

## 1. Why This Project Exists

Most small and mid-size hotels in India rely on OTA platforms (MakeMyTrip, Booking.com) that charge 15-25% commission per booking. STUDIO NEXT is a **direct booking website** that lets the hotel accept bookings and payments directly, saving commissions and owning the guest relationship.

This isn't a demo — it handles:
- Real payments via Razorpay
- Real emails via Resend
- Real room availability with double-booking prevention
- Real cancellation with automated refunds
- A full admin panel for hotel staff to manage everything

---

## 2. Tech Stack & Why Each Tool Was Chosen

| Technology | What It Does | Why This One |
|---|---|---|
| **Next.js 16** (App Router) | Full-stack React framework — serves both the website pages AND the API endpoints | Single codebase for frontend + backend. No need for a separate Express server. Server Components reduce client-side JavaScript. |
| **React 19** | UI library | Latest version with improved performance, used with `'use client'` directives only where interactivity is needed. |
| **TypeScript** | Type-safe JavaScript | Catches bugs at compile time. Every file is typed — no `any` types in business logic. |
| **Prisma ORM** | Database toolkit (queries, migrations, schema) | Type-safe database queries that autocomplete in your IDE. Generates types from your schema automatically. |
| **PostgreSQL (Supabase)** | Relational database | Real ACID transactions needed for booking integrity. Supabase provides free hosted PostgreSQL with connection pooling. |
| **Razorpay** | Payment gateway | India's most developer-friendly payment gateway. Supports UPI, cards, netbanking, wallets. |
| **NextAuth.js** | Authentication for admin/staff login | Session-based auth that integrates natively with Next.js. Role-based access control (ADMIN, MANAGER, RECEPTION, STAFF). |
| **Tailwind CSS 4** | Utility-first CSS | Rapid UI development without writing custom CSS files. Responsive design built into class names. |
| **Framer Motion** | Animations | Smooth page transitions, hover effects, 3D card shuffles, and trackpad-aware horizontal scrolling on the Gallery. |
| **React Hook Form** | Form handling | Performance-optimized forms. Doesn't re-render the entire form on every keystroke (unlike `useState` for each field). |
| **Zod** | Runtime validation | Validates API request bodies on the server. If someone sends garbage data, Zod rejects it before it hits the database. |
| **Resend** | Transactional email service | Simple API, good deliverability. Sends booking confirmations, OTPs, cancellation emails. |
| **Cloudinary** | Image hosting & optimization | Hotel/room images stored in the cloud with automatic resizing and format conversion. |
| **OpenAI / Groq** | AI chatbot (LLM provider) | Powers the concierge chatbot that answers guest questions about rooms, policies, nearby attractions. |
| **Pusher** | Real-time WebSockets | Live inventory updates — when a room gets booked, the admin dashboard updates instantly without refresh. |
| **Lucide React** | Icon library | Clean, consistent SVG icons throughout the UI. |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                         │
│  ┌──────────┐  ┌───────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Landing  │  │  Booking Flow │  │  Admin    │  │  Staff    │  │
│  │ Page     │  │  /book/*      │  │  Panel    │  │  Portal   │  │
│  └──────────┘  └───────────────┘  └───────────┘  └───────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP (fetch)
┌──────────────────────────▼───────────────────────────────────────┐
│                    NEXT.JS SERVER (API Routes)                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  src/app/api/                                                ││
│  │  ├── bookings/     → Create booking, validate, Razorpay order││
│  │  ├── payments/     → Verify Razorpay signature, save to DB   ││
│  │  ├── rooms/        → Availability queries                    ││
│  │  ├── auth/         → NextAuth + Email OTP                    ││
│  │  ├── admin/        → Dashboard, rates, rooms, guests CRUD    ││
│  │  ├── chat/         → AI chatbot messages                     ││
│  │  ├── coupons/      → Validate discount codes                 ││
│  │  ├── gallery/      → Image management                        ││
│  │  ├── upload/       → Cloudinary upload                       ││
│  │  ├── cron/         → Scheduled tasks (auto-checkout)         ││
│  │  └── webhooks/     → PMS sync webhooks                       ││
│  └──────────────────────────────────────────────────────────────┘│
│                            │                                     │
│  ┌─────────────────────────▼────────────────────────────────────┐│
│  │  src/lib/ (Business Logic Layer)                             ││
│  │  ├── pricing.ts        → All price/tax calculations          ││
│  │  ├── availability.ts   → Room availability queries           ││
│  │  ├── cancellation.ts   → Cancellation + refund logic         ││
│  │  ├── otp-store.ts      → Email OTP (in-memory, SHA-256)      ││
│  │  ├── api-rate-limit.ts → IP-based rate limiting              ││
│  │  ├── auth-guard.ts     → Role-based access control           ││
│  │  ├── auth-token.ts     → HMAC-signed booking tokens          ││
│  │  ├── email/            → Resend client + HTML templates      ││
│  │  ├── chat/             → RAG chatbot (knowledge + LLM)       ││
│  │  └── pms/              → PMS adapter pattern                 ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────┬───────────────────────────────────────┘
                           │ Prisma ORM
┌──────────────────────────▼───────────────────────────────────────┐
│                    POSTGRESQL (Supabase)                          │
│  rooms, room_rates, guests, bookings, booking_rooms,             │
│  transactions, coupons, room_blocks, staff_users,                │
│  chat_sessions, knowledge_documents, pms_logs, gallery_images    │
└──────────────────────────────────────────────────────────────────┘
```

**Key Design Principle: Separation of Concerns**

- **Pages** (`src/app/**/page.tsx`) → Only handle UI rendering and user interaction
- **API Routes** (`src/app/api/**/route.ts`) → Only handle HTTP request/response
- **Libraries** (`src/lib/**`) → All business logic lives here. API routes call lib functions. Pages never call the database directly.

This means if you want to understand "how does pricing work?", you read **one file**: `src/lib/pricing.ts`. If you want to understand "how does cancellation work?", you read `src/lib/cancellation.ts`. The logic is never scattered across pages.

---

## 4. Project Structure — File by File

```
Studio next-hotel/
│
├── prisma/
│   ├── schema.prisma          # Database schema — all tables, fields, relations, enums
│   ├── seed.ts                # Seed script — creates initial rooms, rates, admin user
│   └── migrations/            # Auto-generated migration SQL files
│
├── scripts/
│   ├── seed-knowledge.ts      # Seeds chatbot knowledge base into the DB
│   ├── generate-embeddings.ts # Generates vector embeddings for chatbot RAG
│   ├── test-otp.ts            # Test script for OTP email sending
│   ├── cancel-orphan-bookings.ts  # Cleanup script for orphaned bookings
│   └── setup-vercel-env.sh    # Helper to push env vars to Vercel
│
├── src/
│   ├── app/                   # Next.js App Router (pages + API)
│   │   ├── page.tsx           # Landing page (hero video, rooms, gallery)
│   │   ├── layout.tsx         # Root layout (fonts, metadata, providers)
│   │   ├── globals.css        # Global styles + Tailwind imports
│   │   │
│   │   ├── book/              # 📦 BOOKING FLOW
│   │   │   ├── page.tsx           # Step 1: Select dates, guests, rooms
│   │   │   ├── guest-details/     # Step 2: Guest form + OTP + Razorpay payment
│   │   │   ├── confirmation/      # Step 3: Booking confirmation page
│   │   │   └── addons/            # Optional add-ons selection
│   │   │
│   │   ├── rooms/             # Public room listing page
│   │   ├── gallery/           # Photo gallery page
│   │   ├── manage/            # Guest self-service (view/cancel booking)
│   │   │
│   │   ├── admin/             # 🔐 ADMIN PANEL (requires login)
│   │   │   ├── login/            # Admin login page
│   │   │   ├── page.tsx          # Dashboard (stats, charts, recent bookings)
│   │   │   ├── layout.tsx        # Admin layout (sidebar nav, auth check)
│   │   │   ├── bookings/         # Booking management (view, check-in/out)
│   │   │   ├── rooms/            # Room management (add/edit rooms)
│   │   │   ├── rates/            # Rate management (set prices)
│   │   │   ├── guests/           # Guest directory
│   │   │   ├── coupons/          # Coupon/discount management
│   │   │   ├── gallery/          # Gallery image management
│   │   │   ├── cancellations/    # Cancellation history
│   │   │   └── staff/            # Staff user management
│   │   │
│   │   ├── staff/             # 🏢 RECEPTION / STAFF PORTAL
│   │   │   ├── login/            # Staff login
│   │   │   ├── dashboard/        # Reception dashboard
│   │   │   ├── bookings/         # View today's bookings
│   │   │   ├── check-in-out/     # Check-in / check-out operations
│   │   │   ├── calendar/         # Occupancy calendar
│   │   │   ├── rooms/            # Room status board
│   │   │   └── guests/           # Guest lookup
│   │   │
│   │   └── api/               # 🔌 BACKEND API ROUTES
│   │       ├── bookings/          # POST: Create booking + Razorpay order
│   │       │   └── manage/        # Guest self-service API (auth, token, cancel)
│   │       ├── payments/
│   │       │   └── razorpay/verify/  # POST: Verify payment + save booking
│   │       ├── rooms/
│   │       │   └── available-by-type/ # GET: Room availability grouped by type
│   │       ├── auth/
│   │       │   ├── [...nextauth]/    # NextAuth config (admin/staff login)
│   │       │   └── email-otp/        # Send + Verify email OTP
│   │       ├── admin/                # Admin-only CRUD endpoints
│   │       ├── chat/                 # AI chatbot message endpoint
│   │       ├── coupons/              # Coupon validation
│   │       ├── gallery/              # Gallery CRUD
│   │       ├── upload/               # Cloudinary upload
│   │       ├── cron/                 # Scheduled automation
│   │       └── webhooks/             # PMS webhook receiver
│   │
│   ├── components/            # Reusable React components
│   │   ├── ChatWidget.tsx         # Floating AI chatbot widget
│   │   ├── DateRangePicker.tsx    # Custom date picker for booking
│   │   ├── OccupancyCalendar.tsx  # Visual room occupancy calendar
│   │   ├── RoomCard.tsx           # Room display card component
│   │   ├── BookingSummary.tsx     # Booking details summary
│   │   ├── ExperienceModal.tsx    # Nearby attractions modal
│   │   └── admin/                 # Admin-specific components
│   │
│   ├── lib/                   # 🧠 CORE BUSINESS LOGIC
│   │   ├── pricing.ts            # Centralized pricing engine (see §7)
│   │   ├── availability.ts       # Room availability checker
│   │   ├── cancellation.ts       # Cancellation + refund processor
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── otp-store.ts          # Email OTP store (SHA-256 hashed)
│   │   ├── api-rate-limit.ts     # Generic IP-based rate limiter
│   │   ├── auth-guard.ts         # Role-based auth middleware
│   │   ├── auth-token.ts         # HMAC token signing/verification
│   │   ├── manage-booking-rate-limit.ts  # Rate limits for guest self-service
│   │   ├── hotelPolicy.ts        # Check-in/out times, timezone rules
│   │   ├── realtime.ts           # Pusher real-time broadcast helper
│   │   ├── experiences-data.ts   # Nearby attractions data
│   │   ├── email/                # Email system
│   │   │   ├── client.ts             # Resend API client
│   │   │   ├── index.ts              # Email sending functions
│   │   │   └── templates/            # HTML email templates
│   │   │       ├── layout.ts             # Shared email layout
│   │   │       ├── booking-confirmation.ts
│   │   │       ├── booking-cancellation.ts
│   │   │       ├── checkin-reminder.ts
│   │   │       ├── checkout-thankyou.ts
│   │   │       ├── booking-manage-link.ts
│   │   │       └── otp.ts
│   │   ├── chat/                 # AI Chatbot System
│   │   │   ├── config.ts            # Chat config (model, limits)
│   │   │   ├── knowledge.ts         # RAG knowledge builder
│   │   │   ├── retrieval.ts         # Vector search for relevant docs
│   │   │   ├── llm-client.ts        # LLM API client (OpenAI/Groq)
│   │   │   ├── prompt.ts            # System prompt template
│   │   │   ├── session.ts           # Chat session management
│   │   │   ├── rate-limit.ts        # Chat-specific rate limiting
│   │   │   └── verification.ts      # Booking verification via chat
│   │   ├── pms/                  # Property Management System
│   │   │   ├── types.ts              # PMS adapter interface
│   │   │   ├── adapter-factory.ts    # Factory to create PMS adapter
│   │   │   ├── mock-pms.ts           # Mock PMS for development
│   │   │   └── sync.ts              # Sync bookings ↔ PMS
│   │   └── validations/          # Shared validation schemas
│   │
│   └── types/                 # Global TypeScript type definitions
│
├── public/                    # Static assets (images, fonts, logo)
├── next.config.ts             # Next.js config (security headers, CSP, images)
├── package.json               # Dependencies + scripts
├── tsconfig.json              # TypeScript configuration
├── vercel.json                # Vercel deployment config
└── .env.local                 # Environment variables (secrets)
```

---

## 5. Database Design (Prisma Schema)

The database has **14 main tables**. Here's how they connect:

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Room    │───▶│ RoomRate │     │   Booking    │───▶│ Transaction │
│          │     │ (pricing)│     │              │     │ (payment)   │
│ type     │     │ baseRate │     │ status       │     │ amount      │
│ floor    │     │ weekend  │     │ checkIn      │     │ paymentId   │
│ occupancy│     │ seasonal │     │ checkOut     │     │ refundAmt   │
└────┬─────┘     └──────────┘     │ totalAmount  │     └─────────────┘
     │                            └──────┬───────┘
     │           ┌──────────┐            │            ┌──────────┐
     └──────────▶│BookingRoom│◀──────────┘       ┌───▶│  Coupon  │
                 │ (join)    │                    │    │ code     │
                 └───────────┘            ┌──────┘    │ discount │
                                          │           └──────────┘
                              ┌───────────┴──┐
                              │    Guest     │
                              │ email        │
                              │ fullName     │
                              │ phone        │
                              │ idProof      │
                              │ address      │
                              └──────────────┘
```

**Key Tables:**

| Table | Purpose | Key Fields |
|---|---|---|
| `Room` | Physical hotel rooms | `roomNumber`, `type` (DELUXE/SUITE/FAMILY/STANDARD), `baseOccupancy`, `maxOccupancy`, `extraGuestCharge`, `floor`, `amenities`, `images`, `status` |
| `RoomRate` | Pricing per room (can have seasonal/weekend rates) | `baseRate`, `weekendMultiplier`, `effectiveFrom`, `effectiveTo`, `rateType` |
| `Guest` | Customer information | `email` (unique), `fullName`, `phone`, `address` (JSON), `idProof` (JSON) |
| `Booking` | A reservation | `bookingReference` (e.g. OMK-20260416-A1B2), `checkIn`, `checkOut`, `numberOfGuests`, `totalAmount`, `status` |
| `BookingRoom` | Join table: which rooms are in which booking | Allows multi-room bookings |
| `Transaction` | Payment records | `amount`, `paymentMethod`, `paymentGatewayId`, `refundAmount`, `status` |
| `Coupon` | Discount codes | `code`, `discountType` (PERCENTAGE/FIXED), `discountValue`, `maxUses`, `usedCount` |
| `RoomBlock` | Block rooms for maintenance/events | `startDate`, `endDate`, `reason` |
| `StaffUser` | Admin/reception logins | `email`, `passwordHash`, `role` (ADMIN/MANAGER/RECEPTION/STAFF) |
| `ChatSession` | AI chatbot conversations | `messages` (JSON), `guestEmail` |
| `KnowledgeDocument` | RAG knowledge base for chatbot | `title`, `content`, `category`, `embedding` |
| `PmsLog` | PMS sync audit trail | `direction`, `status`, `payload` |
| `GalleryImage` | Hotel photo gallery | `url`, `caption`, `category`, `sortOrder` |

**Why PostgreSQL?**
The booking system requires ACID transactions (Atomicity, Consistency, Isolation, Durability). When two guests try to book the same room simultaneously, PostgreSQL's advisory locks ensure only one succeeds. NoSQL databases (MongoDB, Firebase) cannot guarantee this.

---

## 6. The Booking Flow — Step by Step

This is the most critical part of the system. Here's exactly what happens when a guest books a room:

### Step 1: Room Selection (`/book`)
**File:** `src/app/book/page.tsx`

1. Guest enters **Check-in date**, **Check-out date**, and **Number of guests**
2. Frontend calls `GET /api/rooms/available-by-type?checkIn=...&checkOut=...&guests=...`
3. Server runs `getAvailableRooms()` from `src/lib/availability.ts` — queries PostgreSQL for rooms that don't have overlapping bookings
4. Results are grouped by room type (Deluxe, Suite, Family, Standard) and sent back
5. Guest clicks on a room → it's added to a **cart** stored in `sessionStorage`
6. The cart contains: `roomId`, `roomType`, `roomNumber`, `baseRate`, `weekendMultiplier`, `baseOccupancy`, `maxOccupancy`, `extraGuestChargePerNight`
7. Rates displayed on cards dynamically include extra guest charges when guests > baseOccupancy

### Step 2: Guest Details (`/book/guest-details`)
**File:** `src/app/book/guest-details/page.tsx`

1. Cart is loaded from `sessionStorage`
2. Pricing is calculated client-side using `calculateBookingPriceBreakdown()` from `src/lib/pricing.ts` — this is the same function the server uses
3. Guest fills out the form: name, email, phone, ID proof, address
4. **PIN Code Auto-Fill**: When guest types a 6-digit PIN code, it calls India Post API (`api.postalpincode.in`) to auto-populate city, state, and locality dropdown
5. **ID Proof Validation**: Each ID type (Aadhaar, Passport, Driving License, Voter ID) has its own regex pattern and input mask
6. Guest can apply a **coupon code** → validated via `POST /api/coupons/validate`

### Step 3: Email OTP Verification
**Files:** `src/lib/otp-store.ts`, `src/app/api/auth/email-otp/send/route.ts`

1. When guest clicks "Verify Email & Continue", an OTP modal appears
2. Server generates a 6-digit OTP using `crypto.randomInt()` (cryptographically secure)
3. OTP is **hashed with SHA-256** before storage — the plain OTP is never stored
4. OTP is sent to guest's email via Resend
5. Guest enters the OTP → server compares `SHA-256(input)` with stored hash
6. **Security**: 5 wrong attempts → lockout. 60-second cooldown between resends. 10-minute expiry.

### Step 4: Payment (Razorpay)
**Files:** `src/app/api/bookings/route.ts`, `src/app/api/payments/razorpay/verify/route.ts`

1. After OTP verification, frontend calls `POST /api/bookings` with the full form data
2. **Server does NOT write anything to the database** — this is critical (see §8)
3. Server validates everything, checks room availability again, calculates pricing from DB data
4. Server creates a Razorpay order via their API
5. Server signs all booking details into an **HMAC-SHA256 token** (tamper-proof)
6. Frontend receives: `{ razorpayKey, order, bookingToken, bookingReference }`
7. Razorpay checkout modal opens in the browser
8. Guest pays via UPI/Card/Netbanking
9. On payment success, frontend sends `{ orderId, paymentId, signature, bookingToken }` to `POST /api/payments/razorpay/verify`
10. Server verifies Razorpay's HMAC signature using `timingSafeEqual` (prevents timing attacks)
11. Server decodes the booking token, verifies it wasn't tampered with
12. Server recalculates the price from DB data and compares with what was paid
13. **Only now** does the server create the booking in PostgreSQL (inside a transaction with advisory locks)
14. Confirmation email is sent, PMS is synced

### Step 5: Confirmation (`/book/confirmation`)
- Shows booking reference, guest details, and a summary
- Booking reference format: `OMK-YYYYMMDD-XXXXXXXX` (date + random hex)

---

## 7. Pricing Engine Deep Dive

**File:** `src/lib/pricing.ts`

This is the **single source of truth** for all pricing calculations. Both the client-side display and the server-side verification use this exact same function.

### How Pricing Works:

```
Total = Room Total + Extra Guest Charges - Coupon Discount + GST
```

#### 1. Room Total
```typescript
// For each night in the stay:
nightRate = isWeekend(date) ? baseRate × weekendMultiplier : baseRate
roomTotal = sum of all nightRates across all nights
```
- **Weekend**: Saturday (6) and Sunday (0) use the `weekendMultiplier` (default 1.2x = 20% more)
- Multi-room bookings: each room's total is calculated independently and summed

#### 2. Extra Guest Charges
```typescript
extraGuests = Math.min(
    Math.max(0, numberOfGuests - room.baseOccupancy),
    room.maxOccupancy - room.baseOccupancy
);
extraGuestCharge = extraGuests × room.extraGuestChargePerNight × numberOfNights;
```
- If a room has `baseOccupancy: 2` and `maxOccupancy: 4`, and the guest selects 3 guests, they pay for 1 extra guest
- The extra charge per night is set per room in the admin panel

#### 3. GST (Goods & Services Tax)
Indian hotel GST follows government slabs:
```typescript
if (perNightRate <= ₹1,000)  → 0% GST
if (perNightRate <= ₹7,500)  → 12% GST
if (perNightRate > ₹7,500)   → 18% GST
```
GST is applied on `subtotal` (roomTotal + extraGuestCharge - discount).

#### 4. Coupon Discounts
```typescript
if (coupon.type === 'PERCENTAGE') discount = subtotal × (coupon.value / 100)
if (coupon.type === 'FIXED')      discount = coupon.value
```

### Why This Design Matters
The pricing function is used in **3 places**:
1. `/book` page — to show rates on room cards (client-side)
2. `/book/guest-details` — to show the price breakdown sidebar (client-side)
3. `/api/payments/razorpay/verify` — to verify the amount paid matches the calculated amount (server-side)

If any of these disagree, the payment is rejected. This prevents price manipulation attacks.

---

## 8. Razorpay Payment Integration

**The Zero-Write-Before-Payment Architecture:**

```
Traditional (BAD):                     STUDIO NEXT (GOOD):
─────────────────                      ──────────────────
1. Guest fills form                    1. Guest fills form
2. Create PENDING booking in DB ←──    2. Validate + calculate (NO DB write)
3. Open payment modal                  3. Sign data into HMAC token
4. Guest abandons → orphan booking!    4. Open payment modal
5. Admin sees fake bookings            5. Guest abandons → nothing saved!
                                       6. Payment succeeds → THEN save to DB
```

**Why?** Previously, every form submission created a PENDING booking. Guests would fill the form, see the payment modal, and close the tab. This created hundreds of fake PENDING bookings that showed up in the admin panel and temporarily blocked room availability.

Now, the database is only written to **after Razorpay confirms the payment was successful**. If a guest abandons, nothing happens — zero cleanup needed.

### Security Layers:

| Layer | What It Prevents |
|---|---|
| HMAC-signed booking token | Attacker can't modify the room, price, or guest data between steps |
| Razorpay signature verification (`timingSafeEqual`) | Attacker can't forge a "payment successful" response |
| Server-side price recalculation | Attacker can't manipulate client-side JavaScript to change the price |
| PostgreSQL advisory locks | Two simultaneous bookings for the same room — only one succeeds |
| Idempotency check (`paymentGatewayId`) | Same payment can't create two bookings if the callback fires twice |

---

## 9. Email System

**Files:** `src/lib/email/`

### Email Templates:

| Template | When It's Sent | File |
|---|---|---|
| **Booking Confirmation** | After successful payment | `templates/booking-confirmation.ts` |
| **Booking Cancellation** | When booking is cancelled | `templates/booking-cancellation.ts` |
| **Check-in Reminder** | Day before check-in | `templates/checkin-reminder.ts` |
| **Checkout Thank You** | After checkout | `templates/checkout-thankyou.ts` |
| **Manage Booking Link** | When guest requests self-service link | `templates/booking-manage-link.ts` |
| **OTP Verification** | During booking checkout | `templates/otp.ts` |

All templates share a common layout (`templates/layout.ts`) that provides consistent branding, header, and footer.

### How It Works:
```typescript
// src/lib/email/client.ts creates a Resend client
// src/lib/email/index.ts exports easy-to-call functions:
sendBookingConfirmation({ guestName, guestEmail, bookingReference, ... })
sendBookingCancellation({ guestName, guestEmail, refundAmount, ... })
sendOtpEmail({ guestEmail, otp, expiresInMinutes })
```

---

## 10. AI Chatbot (RAG-powered)

**Files:** `src/lib/chat/`

The chatbot uses **Retrieval-Augmented Generation (RAG)** — instead of relying on the LLM's training data, it retrieves real hotel data from the database and feeds it as context.

### How RAG Works Here:

```
Guest asks: "What rooms do you have with valley view?"
                    │
                    ▼
    ┌─── Query Preprocessing ───┐
    │  Extract keywords:         │
    │  "rooms", "valley", "view" │
    └────────────┬───────────────┘
                 │
    ┌────────────▼──────────────────────────┐
    │  1. Vector Search (retrieval.ts)       │
    │     Search KnowledgeChunk embeddings   │
    │     for semantically similar content   │
    │                                        │
    │  2. Live DB Query (knowledge.ts)       │
    │     Fetch actual room data:            │
    │     - Room types, views, prices        │
    │     - Availability                     │
    │     - Hotel policies                   │
    │     - Nearby attractions               │
    └────────────┬──────────────────────────┘
                 │
    ┌────────────▼──────────────────────────┐
    │  Build Context String:                 │
    │  "Room 101 (DELUXE) View: VALLEY_VIEW │
    │   Occupancy: 2-3, Base rate: 3500..."  │
    └────────────┬──────────────────────────┘
                 │
    ┌────────────▼──────────────────────────┐
    │  Send to LLM (OpenAI/Groq):           │
    │  System: "You are STUDIO NEXT's       │
    │  concierge. Answer using this data..."│
    │  Context: [retrieved data]             │
    │  User: "What rooms with valley view?" │
    └────────────┬──────────────────────────┘
                 │
                 ▼
    "We have our Deluxe Room (Room 101) with a
     beautiful valley view! It accommodates 2-3
     guests at ₹3,500/night..."
```

### Chat Features:
- **Intent Detection** — recognizes if user wants to cancel, check booking, ask about rooms, or ask about nearby places
- **Booking Verification via Chat** — guest can verify their booking by providing email + OTP through the chatbot
- **Session Management** — conversations are stored in the database with session IDs
- **Rate Limiting** — 30 messages/minute, 500/hour per session

### Setup Commands:
```bash
npm run chat:seed     # Seed knowledge documents into DB
npm run chat:embed    # Generate vector embeddings for RAG retrieval
```

---

## 11. Admin Dashboard

**Files:** `src/app/admin/`  
**Access:** `/admin/login` → requires `ADMIN` or `MANAGER` role

| Page | URL | What It Does |
|---|---|---|
| Dashboard | `/admin` | Revenue stats, occupancy rate, recent bookings, charts |
| Bookings | `/admin/bookings` | View all bookings, filter by status/date, check-in/out guests |
| Rooms | `/admin/rooms` | Add/edit rooms, change status, set floor/amenities/images |
| Rates | `/admin/rates` | Set base rates, weekend multipliers, seasonal pricing |
| Guests | `/admin/guests` | Guest directory with booking history |
| Coupons | `/admin/coupons` | Create/manage discount codes |
| Gallery | `/admin/gallery` | Upload/manage hotel photos |
| Cancellations | `/admin/cancellations` | View cancellation history and refund status |
| Staff | `/admin/staff` | Create/manage staff accounts and roles |

### Auth Flow:
1. Admin visits `/admin/login`
2. Enters email + password
3. NextAuth validates credentials against `StaffUser` table (password is bcrypt hashed)
4. Session is created (JWT stored in HTTP-only cookie)
5. Every admin page checks the session via `requireAuth(request, ['ADMIN', 'MANAGER'])`
6. If no session or wrong role → redirected to login

---

## 12. Staff / Reception Portal

**Files:** `src/app/staff/`  
**Access:** `/staff/login` → requires `RECEPTION` or `STAFF` role

A simplified portal for front-desk staff:

| Page | What It Does |
|---|---|
| Dashboard | Today's arrivals, departures, active guests, and walk-in shortcuts |
| New Walk-In | Create bookings directly at the desk (uses the same pricing engine as the public site) |
| Check-In/Out | Process physical check-in and check-out |
| Bookings | Search and view bookings |
| Calendar | Visual room occupancy calendar (component: `OccupancyCalendar.tsx`) |
| Rooms | Live room status board |
| Guests | Quick guest lookup |

---

## 13. Guest Self-Service (Manage Booking)

**Files:** `src/app/manage/`  
**Access:** `/manage` (public, no login required)

Guests can manage their booking without calling the hotel:

1. Guest enters booking reference + email
2. Server sends a **time-limited token** to their email (not a full login)
3. Guest clicks the link → sees booking details
4. Can view booking info, download invoice, or **cancel** (subject to cancellation policy)

All endpoints are rate-limited per IP to prevent brute-force booking reference guessing.

---

## 14. Cancellation & Refund Engine

**File:** `src/lib/cancellation.ts`

### Cancellation Policy (with Platform Fee):
```
More than 48 hours before check-in  → 95% refund (5% non-refundable platform fee to cover Razorpay gateway costs)
24-48 hours before check-in         → 50% refund (Partial Refund)
Less than 24 hours before check-in  → 0% refund  (No Refund)
Already checked in                  → Cannot cancel online
```

### How Refunds Work:
1. Calculate hours until check-in using the hotel's timezone (IST)
2. Determine refund percentage based on policy
3. If the original payment was online (Razorpay):
   - Find the `paymentId` from the transaction metadata
   - Subtract the 5% platform fee if applicable
   - Call `razorpay.payments.refund()` with the calculated amount
   - Update the transaction record with refund details
4. Update booking status to `CANCELLED`
5. Free up the rooms (set status back to `AVAILABLE`)
6. Send cancellation email to guest (with platform fee breakdown)
7. Sync cancellation to PMS

---

## 15. PMS Integration (Property Management System)

**Files:** `src/lib/pms/`

The system is designed to connect to an external Property Management System (like Opera, Hotelogix, etc.) using the **Adapter Pattern**:

```typescript
// src/lib/pms/types.ts defines the interface:
interface PMSAdapter {
    syncInventory(): Promise<PMSInventoryItem[]>  // Pull room availability
    pushBooking(booking): Promise<PMSBookingResponse>  // Push new booking
    cancelBooking(pmsBookingId): Promise<void>  // Push cancellation
    getRoomStatus(roomNumber): Promise<RoomStatus>  // Check room status
    isConnected(): Promise<boolean>  // Health check
}
```

Currently uses a **Mock PMS** (`mock-pms.ts`) for development. To connect a real PMS:
1. Create a new file (e.g., `opera-pms.ts`) implementing `PMSAdapter`
2. Update `adapter-factory.ts` to return your implementation
3. Set the PMS connection credentials in environment variables

---

## 16. Security Architecture

### HTTP Security Headers (`next.config.ts`):
| Header | Protection |
|---|---|
| `X-Frame-Options: DENY` | Prevents clickjacking (site can't be embedded in iframes) |
| `X-Content-Type-Options: nosniff` | Stops MIME-type sniffing attacks |
| `X-XSS-Protection: 1; mode=block` | Legacy XSS protection for older browsers |
| `Strict-Transport-Security` | Forces HTTPS for 1 year |
| `Referrer-Policy: strict-origin-when-cross-origin` | Controls what info is sent in the Referer header |
| `Permissions-Policy` | Disables camera, microphone, geolocation access |
| `Content-Security-Policy` | Controls which scripts, styles, images, and connections the browser allows |

### Rate Limiting (`src/lib/api-rate-limit.ts`):
| Endpoint | Limit | Why |
|---|---|---|
| `POST /api/bookings` | 10 per 15 min per IP | Prevents Razorpay order spam |
| `POST /api/auth/email-otp/send` | 20 per hour per IP | Prevents email quota abuse |
| Admin login | 5 attempts per 15 min per IP | Prevents password brute-force |
| Manage booking (auth/token/cancel) | Custom per-action limits | Prevents booking reference guessing |
| Chat messages | 30/min, 500/hour | Prevents AI API cost abuse |

### OTP Security (`src/lib/otp-store.ts`):
- 6-digit OTP generated via `crypto.randomInt()` (not `Math.random()`)
- Stored as SHA-256 hash (plain text never persisted)
- 10-minute expiry, 5 attempt lockout, 60-second resend cooldown

### Payment Security:
- HMAC-SHA256 booking tokens with 30-minute expiry
- Razorpay signature verification with constant-time comparison (`timingSafeEqual`)
- Server-side price recalculation — client-displayed price is informational only
- PostgreSQL advisory locks prevent double-booking race conditions

### Input Validation:
- Every API endpoint uses **Zod schemas** to validate request bodies
- ID proof numbers are validated against government format patterns
- Phone numbers validated as Indian mobile (starts with 6-9, exactly 10 digits)
- Email validated both by regex and OTP verification

---

## 17. Environment Variables

Create a `.env.local` file with these variables:

```env
# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=postgresql://...        # Supabase pooled connection (port 6543)
DIRECT_URL=postgresql://...          # Direct connection for migrations (port 5432)

# ── Razorpay ─────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_...         # Server-side key (test or live)
RAZORPAY_KEY_SECRET=...              # Server-side secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...  # Client-side public key (same as KEY_ID)

# ── Auth ─────────────────────────────────────────────────────────
NEXTAUTH_SECRET=...                  # Random 32+ char string for session encryption
NEXTAUTH_URL=http://localhost:3000   # Your app URL
BOOKING_TOKEN_SECRET=...             # Separate secret for booking HMAC tokens

# ── Admin Seed ───────────────────────────────────────────────────
ADMIN_SEED_EMAIL=admin@Studio nexthotel.com
ADMIN_SEED_PASSWORD=...
RECEPTION_SEED_EMAIL=reception@Studio nexthotel.com
RECEPTION_SEED_PASSWORD=...

# ── Cloudinary ───────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# ── Email (Resend) ───────────────────────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=bookings@yourdomain.com
OTP_FROM_EMAIL=verify@yourdomain.com

# ── AI Chatbot ───────────────────────────────────────────────────
CHAT_PROVIDER=groq                   # 'openai' or 'groq'
CHAT_MODEL=llama-3.3-70b-versatile
GROQ_API_KEY=gsk_...
GROQ_BASE_URL=https://api.groq.com/openai/v1
OPENAI_API_KEY=sk-...                # Only if using OpenAI
NEXT_PUBLIC_CHAT_WIDGET_ENABLED=true

# ── Embeddings (for RAG) ─────────────────────────────────────────
EMBEDDING_PROVIDER=groq
EMBEDDING_API_KEY=gsk_...
EMBEDDING_BASE_URL=https://api.groq.com/openai/v1
EMBEDDING_MODEL=nomic-embed-text-v1_5
EMBEDDING_DIMENSION=768
```

---

## 18. Getting Started (Local Development)

### Prerequisites:
- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- PostgreSQL database (Supabase free tier recommended)

### Setup:

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd Studio next-hotel

# 2. Install dependencies
npm install

# 3. Create your .env.local file (see §17 above)
cp .env.example .env.local
# Edit .env.local with your actual values

# 4. Generate Prisma client
npm run db:generate

# 5. Push schema to database (creates tables)
npm run db:push

# 6. Seed initial data (rooms, rates, admin user)
npm run db:seed

# 7. (Optional) Seed chatbot knowledge + generate embeddings
npm run chat:prepare

# 8. Start development server
npm run dev
```

The app will be running at `http://localhost:3000`.

### Key URLs:
| URL | What |
|---|---|
| `http://localhost:3000` | Landing page |
| `http://localhost:3000/book` | Booking flow |
| `http://localhost:3000/rooms` | Room listing |
| `http://localhost:3000/gallery` | Photo gallery |
| `http://localhost:3000/manage` | Guest self-service |
| `http://localhost:3000/admin/login` | Admin login |
| `http://localhost:3000/staff/login` | Staff login |

---

## 19. Deployment (Vercel + Supabase)

### Supabase:
1. Create a project at [supabase.com](https://supabase.com)
2. Copy the **Connection String** (port 6543) → `DATABASE_URL`
3. Copy the **Direct Connection** (port 5432) → `DIRECT_URL`

### Vercel:
1. Push your code to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add **all environment variables** from `.env.local` to Vercel's dashboard (Settings → Environment Variables)
4. Deploy!

### Production Checklist:
- [ ] Replace Razorpay **test** keys with **live** keys
- [ ] Set `NEXTAUTH_URL` to your production domain
- [ ] Set `BOOKING_TOKEN_SECRET` (separate from `NEXTAUTH_SECRET`)
- [ ] Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the live key
- [ ] Verify emails are sending from your verified domain
- [ ] Test the full booking flow end-to-end with a real ₹1 payment

---

## 20. NPM Scripts Reference

| Command | What It Does |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client types |
| `npm run db:push` | Push schema changes to database |
| `npm run db:seed` | Seed initial rooms, rates, and admin user |
| `npm run db:studio` | Open Prisma Studio (visual database browser) |
| `npm run chat:seed` | Seed chatbot knowledge documents |
| `npm run chat:embed` | Generate vector embeddings for RAG |
| `npm run chat:prepare` | `chat:seed` + `chat:embed` combined |

---

## 21. Contributing & Extending This Project

### Adding a New Feature:

1. **Database change?** → Edit `prisma/schema.prisma`, then run `npm run db:push` and `npm run db:generate`
2. **New API endpoint?** → Create `src/app/api/your-feature/route.ts`. Use Zod for validation. Add rate limiting if it's public-facing.
3. **New business logic?** → Create/edit a file in `src/lib/`. Never put business logic inside API routes or pages.
4. **New page?** → Create `src/app/your-page/page.tsx`. Use `'use client'` only if it needs interactivity.
5. **New admin feature?** → Add to `src/app/admin/` and protect with `requireAuth(request, ['ADMIN'])`.
6. **New email template?** → Add to `src/lib/email/templates/` following the existing pattern.

### Code Conventions:
- All files use TypeScript (`.ts` / `.tsx`)
- API routes use Zod for request body validation
- Business logic goes in `src/lib/`, not in pages or API routes
- All prices are in INR (Indian Rupees), stored as `Decimal(10,2)` in the database
- Dates are stored in UTC, displayed in IST (Indian Standard Time)
- All security-sensitive operations log to `console.error` with a `[Module]` prefix

### When You Add Something New:
Update this README! Add it to the relevant section so future-you (or collaborators) can understand the full system.

---

**Built with ❤️ for STUDIO NEXT — Concept to creation** 🏔️
