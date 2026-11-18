# CampusFind bug-fix notes

- Corrected JSON request headers in the frontend API helper. The previous helper could overwrite default headers, so Express might not parse login, registration, report, and claim bodies correctly.
- Preserved same-origin session cookies on all API requests.
- Updated the navigation button immediately after login, registration, and logout.
- Added clearer loading, empty, and error messages.
- Added disabled/loading states to prevent duplicate form submissions.
- Added automatic category and listing-type filtering.
- Kept HTML escaping for user-generated listing and claim text.
- Moved static-file serving after session middleware in `server.js` and enabled proxy awareness for HTTPS deployment.

## Apply the update

Replace the old project folder with this updated project, then run from the folder containing `package.json`:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and hard-refresh with `Ctrl + F5`.

## Authentication test

1. Register a new account.
2. The top-right button should change to `Account: FirstName`.
3. Refresh the browser. The session should remain active.
4. Log out. The button should return to `Login / Register`.
5. Log in again. The button should show the account name.

This update corrects the identified frontend request/session handling issue. Full integration testing still requires running MongoDB and the app on your computer.
