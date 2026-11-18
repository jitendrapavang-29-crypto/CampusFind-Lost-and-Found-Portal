# CampusFind — Campus Lost and Found Portal

A full-stack individual project for Sai University, School of Computing and Data Science.

## Features

- Responsive home page with recent lost/found listings
- Registration, login, logout and session-based protected access
- Create, browse, search and filter lost/found reports
- Literal-safe keyword and location search, filters, sorting and paginated listings
- Upload item photos from a device; images are validated, resized and stored locally
- User dashboard for editing/deleting personal listings, updating profile details and tracking claims
- Claim submission with duplicate-claim protection
- Admin dashboard with basic statistics
- Dedicated admin sign-in, report editing/deletion/status controls, and claim approval/rejection
- MongoDB persistence, server-side validation and authorization
- Postman collection with API test examples

## Technology

HTML5, CSS3, JavaScript ES6+, Node.js, Express.js, MongoDB, Mongoose, Multer, Sharp, Postman and Git.

## Requirements

- Node.js 20.9 or newer
- MongoDB Community Server or MongoDB Atlas
- npm

## Run locally

1. Install Node.js and MongoDB.
2. Open the extracted workspace folder in VS Code. From that folder, the root npm scripts forward commands into `campus-lost-found-portal`:

   ```bash
   npm install
   npm run dev
   ```

   Alternatively, open `campus-lost-found-portal` directly and run the commands below.
3. In the application folder, copy `.env.example` to `.env`.
4. Set `MONGODB_URI` and replace `SESSION_SECRET` with a long random value.
5. To start the application directly from the application folder, run:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Demo data

Run `npm run seed` to create 10 sample item records, a demo student and a demo admin.

- Admin: `admin@campusfind.demo`
- Admin password: `Admin12345!`
- Student: `student@campusfind.demo`
- Student password: `Student12345!`

**Important:** These are development-only demo credentials. Change/remove them before public deployment. The seed script clears existing users and items, so do not run it on a real database with data you need.

Use the **Admin login** option on the website to sign in with the demo admin account. Administrators can edit or delete any lost/found report, update its status, and review claims.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Register |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | Logged in | Logout |
| GET | `/api/auth/me` | Public | Current session |
| PATCH | `/api/auth/profile` | Logged in | Update profile name |
| GET | `/api/items` | Public | Browse/search/filter; `page` (default 1), `limit` (default 12, max 100), `sort=newest` (default) or `sort=oldest` |
| GET | `/api/items/:id` | Public | Get item |
| POST | `/api/items` | Logged in | Create listing; optional `image` file (multipart, up to 5 MB) |
| GET | `/api/items/mine` | Logged in | User dashboard data |
| PATCH | `/api/items/:id` | Owner/admin | Update listing |
| DELETE | `/api/items/:id` | Owner/admin | Delete listing |
| POST | `/api/claims` | Logged in | Submit claim |
| GET | `/api/claims/mine` | Logged in | My claims |
| GET | `/api/claims` | Admin | All claims |
| PATCH | `/api/claims/:id` | Admin | Approve/reject claim |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/items` | Admin | List all reports |
| PATCH | `/api/admin/items/:id/status` | Admin | Update report status |

## Postman

Import `postman/CampusFind.postman_collection.json`. Set collection variable `baseUrl` to `http://localhost:3000`. The collection includes response assertions and uses its create-listing and claim responses to populate `itemId` and `claimId`. Run requests in order with Postman's cookie jar enabled. The workflow registers/logs in a student, creates a listing, switches to a separate claimant, then signs in as admin to review and clean up.

## Security and production checklist

- Use HTTPS in production.
- Set a strong random `SESSION_SECRET`.
- Configure `NODE_ENV=production`.
- Use a managed MongoDB database with a restricted database user.
- Configure secure session cookies and an appropriate session store.
- Use durable shared image storage instead of local disk when deploying multiple server instances.
- Add rate limiting, CSRF protection and audit logging before real-world use.
- Never commit `.env` or credentials.
- Restrict admin account creation to a controlled process. The seed admin is only for local demonstration.

## Important project notes

- The assignment asks for at least 8 API test cases; the collection includes more than 8 request examples.
- The assignment requires one instructor-approved custom feature. The app includes keyword/category/location/type filtering and paginated results; confirm with your instructor whether these meet the additional-feature requirement or seek approval for a distinct feature such as duplicate-item alerts.
- A factual report draft is in `docs/REPORT_TEMPLATE.md`. Fill in personal details, actual test results, deployment information, screenshots, and references; adapt it to the official format if your instructor supplied one.
- AI assistance should be disclosed as required by the course. Be prepared to explain the code and make a small modification during viva.
