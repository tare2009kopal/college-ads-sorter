# Inbox Noise Filter

A Manifest V3 Chrome extension for Gmail that detects promotional college admissions emails already visible on screen, hides matching rows immediately, and uses the Gmail API to move those messages out of `INBOX` into a Gmail label named `College Ads`.

The extension has no cloud backend. `content.js` watches Gmail's dynamic DOM with a debounced `MutationObserver`; `background.js` handles OAuth and Gmail API calls with `chrome.identity`.

## Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project, or select an existing project for this extension.
3. Go to **APIs & Services > Library**.
4. Search for **Gmail API** and click **Enable**.
5. Go to **APIs & Services > OAuth consent screen**.
6. Choose **External** unless you are using a Google Workspace organization that requires **Internal**.
7. Fill in the required app name, user support email, and developer contact email.
8. Add this scope when prompted: `https://www.googleapis.com/auth/gmail.modify`.
9. Save the consent screen. If the app is in testing mode, add your Gmail account under **Test users**.
10. Go to **APIs & Services > Credentials**.
11. Click **Create Credentials > OAuth client ID**.
12. Choose **Chrome Extension** as the application type.
13. Open `chrome://extensions/`, enable **Developer mode**, and copy this extension's ID after loading it unpacked once. If Chrome has not assigned an ID yet, load the folder first, then return here and create/update the OAuth client.
14. Paste this Chrome extension ID into the OAuth client form: `pligmlaiaplaiilhlphnkjcgpjpodeoi`, then create the client.
15. Copy the generated client ID.
16. Open `manifest.json` and replace `PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com` with your generated OAuth client ID.

## Load The Extension

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select this folder: `College Ads Sorter`.
6. Open Gmail at `https://mail.google.com/`.
7. When Chrome asks for Google account permission, approve the Gmail modify scope.

## How It Works

- `content.js` scans Gmail rows such as `tr[data-legacy-message-id]`, `tr.zA`, and rows inside Gmail's main message table.
- It looks for these keywords: `undergraduate`, `admissions`, `apply now`, `prospectus`, `virtually visit`, `financial aid`.
- Matching rows are hidden immediately on the page.
- The Gmail message ID is sent to `background.js` with `{ action: "moveEmail", messageId }`.
- `background.js` checks whether the `College Ads` label exists, creates it if needed, then calls `users.messages.modify` to add that label and remove `INBOX`.

## Debugging

- Open `chrome://extensions/`, find **Inbox Noise Filter**, and click **Service worker** to view background logs.
- In Gmail, open DevTools to view content script logs.
- If OAuth fails, confirm the extension ID in Google Cloud matches the installed unpacked extension ID.
- If Gmail API calls fail, confirm the Gmail API is enabled and the consent screen includes `https://www.googleapis.com/auth/gmail.modify`.

