# CampusFind — Campus Lost and Found Portal

## Title Page

- **Project title:** CampusFind — Campus Lost and Found Portal
- **Student name:** [[Enter student name]]
- **Register number:** [[Enter register number]]
- **Programme / department:** [[Confirm programme and department]]
- **Course:** Web Technology and Internet Programming
- **Academic year:** 2026–2027
- **Institution:** Sai University
- **Submission date:** [[Enter submission date]]

> Adapt this draft to the official Sai University format if your instructor supplied one.

## 1. Abstract

CampusFind is a web application for reporting and finding belongings lost or found on campus. It provides public listing search and filters, authenticated item reporting, photo uploads, user claims, and administrator review. The application uses a browser-based HTML/CSS/JavaScript frontend, an Express and Node.js API, and MongoDB through Mongoose. Listing and claim data are validated on the server, and session-based access controls protect account and administrative actions. Live test outcomes and screenshots must be added after running the application with a configured MongoDB database.

## 2. Objectives

- Provide one searchable place for campus lost-and-found reports.
- Let users create, update, and delete their own listings and upload item photos.
- Help users find reports through keyword, category, type, location, and date sorting controls.
- Let users submit and track claims for items reported by others.
- Give administrators tools to manage reports and approve or reject claims.
- Validate submitted data and restrict protected actions to authorized accounts.

## 3. Requirements

### Functional requirements

1. Register an account, sign in, view the current session, update a profile name, and sign out.
2. Browse open reports, search by keyword or location, filter by category and lost/found type, sort by report date, and navigate result pages.
3. Create reports with a title, category, description, location, date, and lost/found type; optionally upload a photo.
4. Edit or delete the signed-in user's listings.
5. Submit one claim per item and view the user's claims.
6. Let administrators view statistics and all reports, edit or delete reports, change report status, and review claims.

### Non-functional requirements

- Use responsive browser layouts and provide loading, empty, and error feedback.
- Persist application records in MongoDB.
- Validate input on the server and enforce owner/admin authorization.
- Hash account passwords and use HTTP-only, same-site session cookies.
- Escape user-provided text before rendering it as HTML.
- Limit uploaded image size and resize accepted images before storage.

## 4. System Design

### Architecture

```text
Browser (HTML, CSS, JavaScript)
    | same-origin HTTP requests and session cookie
    v
Express application
    |-- Auth routes and session middleware
    |-- Item routes, validation, image processing
    |-- Claim routes and authorization
    |-- Admin routes
    v
MongoDB (User, Item, Claim documents)

Uploaded images -> public/uploads/
```

### Main user flows

- A visitor browses/searches reports and may register or sign in.
- A signed-in user reports an item, manages their own listings, or submits a claim on another user's open listing.
- An administrator signs in separately, manages reports, and reviews pending claims.

### API design

The API is organized under `/api/auth`, `/api/items`, `/api/claims`, and `/api/admin`. Public browse and item-detail routes are separated from authenticated user routes and administrator-only routes. The full route list and access levels are documented in the project README.

## 5. Database Design

The application has three Mongoose collections:

- **User:** name, unique normalized email, password hash, role (`user` or `admin`), and timestamps. Passwords are excluded from normal query results.
- **Item:** title, category, description, location, report date, type (`lost` or `found`), image URL, status (`open`, `claimed`, or `closed`), creator reference, and timestamps. Title, description, and location have a text index.
- **Claim:** item reference, claimant reference, message, status (`pending`, `approved`, or `rejected`), and timestamps. A unique compound index on item and claimant prevents duplicate claims for the same item.

An item belongs to one user and may have claims from other users. A claim references both its item and claimant.

## 6. Implementation

The frontend is served from `public/`. `public/index.html` contains the browse, report, dashboard, sign-in, claim, and item-detail views. `public/js/app.js` handles API requests, filtering, pagination, form submission, and dashboard interactions. User-submitted text is escaped when inserted into listing markup; image error handling is registered in JavaScript rather than an inline HTML handler.

The Express routes are in `src/routes/`. `src/models/` defines MongoDB schemas, while `src/middleware/auth.js` enforces signed-in and administrator access. The item route validates listing fields, restricts creation to explicitly allowed fields, safely treats search input as literal text, and validates MongoDB IDs before database lookup. Image uploads are size-limited, checked, resized, and stored under `public/uploads/`. The project README describes local setup and the demo seed data.

## 7. Testing

The Postman collection is `postman/CampusFind.postman_collection.json`. It contains API requests and response assertions. Run the application against a test MongoDB database, follow the collection order, then fill in the actual result and evidence columns below. Do not report a test as passed until it has been run.

| # | Test case | Expected result | Actual result | Evidence |
|---|---|---|---|---|
| 1 | Health check | HTTP 200 with service status | [[Record result]] | [[Screenshot / response]] |
| 2 | Invalid registration input | HTTP 400 validation response | [[Record result]] | [[Screenshot / response]] |
| 3 | Create listing while signed in | HTTP 201 and a new open listing | [[Record result]] | [[Screenshot / response]] |
| 4 | Create listing without a session | HTTP 401 | [[Record result]] | [[Screenshot / response]] |
| 5 | Search using regex metacharacters | HTTP 200; characters are treated literally | [[Record result]] | [[Screenshot / response]] |
| 6 | Request an item with a malformed ID | HTTP 400 validation response | [[Record result]] | [[Screenshot / response]] |
| 7 | Submit a claim as a different user | HTTP 201 and a pending claim | [[Record result]] | [[Screenshot / response]] |
| 8 | Review a claim as an administrator | HTTP 200 and updated claim status | [[Record result]] | [[Screenshot / response]] |
| 9 | Update profile with a valid name | HTTP 200 and updated session user | [[Record result]] | [[Screenshot / response]] |
| 10 | Browse beyond the first page | Results and page metadata match the requested page | [[Record result]] | [[Screenshot / response]] |

## 8. Screenshots

Add current screenshots captured from the running application. Do not use mockups as evidence of tested behavior.

- Home and browse page: [[Insert screenshot]]
- Search/filter results and pagination: [[Insert screenshot]]
- Report form with photo preview: [[Insert screenshot]]
- User dashboard with listing actions and profile editor: [[Insert screenshot]]
- Admin dashboard and claim review: [[Insert screenshot]]
- Postman test results: [[Insert screenshot]]

## 9. Deployment

- **Hosting provider:** [[Enter provider or state “Not deployed”]]
- **Application URL:** [[Enter deployed URL or state “Local development only”]]
- **Database hosting:** [[Enter provider; do not include credentials]]
- **Deployment verification:** [[Record date and health-check result]]

For local use, configure `MONGODB_URI` and a strong `SESSION_SECRET` in `.env`, install dependencies, optionally seed a disposable development database, and run `npm run dev`. Never include `.env` values in this report.

## 10. Results and Discussion

The source implementation includes account registration and login, report creation and management, image uploads, paginated browsing, claims, profile editing, and administrator tools. Search and location input are treated as literal text, and malformed route IDs are validated before database lookup. These are implementation facts; usability, database behavior, and API test outcomes should be discussed only after completing the tests in Section 7. The instructor's approval of the custom-feature requirement is still to be confirmed.

## 11. Conclusion and Future Enhancements

CampusFind provides a single workflow for campus item reports, search, claims, and administrative review. The next steps are to verify all flows against a configured database, capture test evidence, and confirm the assignment's approved custom feature. Possible future work includes instructor-approved duplicate-item alerts, email notifications, a campus map, and durable shared image storage for multi-instance deployment.

## 12. References

List only sources actually consulted while building or documenting the submitted work. Suggested entries to verify and complete:

- Node.js documentation: [[URL and access date]]
- Express documentation: [[URL and access date]]
- MongoDB and Mongoose documentation: [[URLs and access date]]
- Course brief or instructor-provided report specification: [[Details]]

## 13. AI Use Disclosure

AI assistance (Copilot in VS Code) was used in this work session to review the supplied issue list, implement code and documentation changes, and identify validation steps. Before submission, the student should describe any additional AI use, personally verify the implementation and test results, and ensure the final disclosure matches the course policy.
