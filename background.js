// background.js
// Client-side Gmail classifier for Inbox Noise Filter / MailSift.

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1/users/me";
const COLLEGE_ADS_LABEL_NAME = "College Ads";
const AUTO_SCAN_COOLDOWN_MS = 30 * 1000;
const SCAN_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_REPORT_ITEMS = 40;
const CLASSIFIER_VERSION = "2026-07-protection-after-admissions-score";
const COLLEGE_AD_SEARCH_QUERY = 'in:inbox newer_than:180d {university college admissions admission undergraduate campus apply application applicant "apply now" "apply today" "start your application" "create your account" "request information" "visit campus" "student panel" "open house" "information session" "admissions counselor" "financial aid" scholarship technolutions}';

const DEFAULT_SETTINGS = {
  connected: false,
  autoScanEnabled: true,
  lastAutoScanAt: 0,
  protectedTerms: [
    "stanford bio-x",
    "esfahani",
    "radiation oncology",
    "rad onc",
    "rad_cancer_bio",
    "affiliated labs",
    "publication announcement",
    "submit a poster",
    "stanford university school of medicine"
  ]
};

const EMPTY_REPORT = {
  lastRunAt: null,
  lastSource: null,
  scanned: 0,
  moved: 0,
  kept: 0,
  protected: 0,
  failed: 0,
  skipped: 0,
  candidates: 0,
  durationMs: 0,
  movedItems: [],
  protectedItems: [],
  keptItems: [],
  failedItems: []
};

const COLLEGE_ORG_SIGNALS = [
  "university",
  "college",
  "admission",
  "admissions",
  "undergraduate",
  "first-year",
  "freshman",
  "prospective student",
  "future student",
  "office of admission",
  "office of admissions",
  "office of undergraduate admission",
  "office of undergraduate admissions",
  "admissions@",
  "admission@",
  "collegeadmissions@",
  "enroll@",
  "apply@",
  "drexel",
  "creighton",
  "university of san francisco",
  "usfca",
  "tcu",
  "uchicago",
  "university of chicago",
  "university of colorado boulder",
  "colorado boulder",
  "cu boulder"
];

const ADMISSIONS_INTENT_SIGNALS = [
  "apply today",
  "buckeye preview day",
  "undergraduate admission",
  "is college worth it",
  "start the path to your future",
  "university of colorado boulder invites you",
  "apply now",
  "apply by",
  "apply to",
  "apply for admission",
  "apply for admissions",
  "start your application",
  "start an application",
  "start applying",
  "start your college application",
  "start your college applications",
  "complete your application",
  "submit your application",
  "application is open",
  "applications are open",
  "applications open",
  "application opens",
  "application deadline",
  "priority deadline",
  "early action",
  "early decision",
  "regular decision",
  "create your account",
  "set up your account",
  "activate your account",
  "uchicago account",
  "applicant account",
  "application portal",
  "applicant portal",
  "admissions portal",
  "getstarted",
  "request information",
  "request info",
  "join our mailing list",
  "admissions cycle",
  "college admissions cycle",
  "supplemental essay prompts",
  "supplemental materials",
  "admissions counselor",
  "admission counselor",
  "connect with your counselor",
  "invites you to apply",
  "invited to apply",
  "you are invited to apply",
  "you are invited",
  "you're invited"
];

const COLLEGE_RECRUITING_SIGNALS = [
  "why attend",
  "why choose",
  "why students choose",
  "urban school",
  "urban institution",
  "top three reasons",
  "explore life",
  "life in philly",
  "campus life",
  "student life",
  "visit campus",
  "visit us",
  "visit day",
  "preview day",
  "admissions preview",
  "campus visit",
  "campus tour",
  "tour campus",
  "schedule a visit",
  "virtually visit",
  "virtual visit",
  "virtual tour",
  "open house",
  "information session",
  "info session",
  "admitted student",
  "student panel",
  "virtual student panel",
  "student ambassador",
  "university ambassadors",
  "meet current students",
  "current students",
  "student stories",
  "webinar",
  "sign up",
  "register now",
  "reserve your spot",
  "save your spot",
  "learn more",
  "discover",
  "explore",
  "see yourself",
  "picture yourself",
  "journey starts here",
  "start exploring",
  "your future starts",
  "next steps",
  "planning your next steps",
  "students in your area",
  "opportunity to hear directly",
  "looking for a sign",
  "is college worth it",
  "big picture",
  "preparing for a job",
  "start the path",
  "path to your future",
  "your future",
  "our community",
  "shaped me",
  "one step closer",
  "college search",
  "find your fit",
  "majors",
  "programs",
  "academic programs",
  "undergraduate programs",
  "scholarship",
  "scholarships",
  "financial aid",
  "tuition",
  "affordability",
  "frog camp",
  "bluejay",
  "cooperative education",
  "experiential education"
];

const MARKETING_INFRASTRUCTURE_SIGNALS = [
  "unsubscribe",
  "you unsubscribed",
  "manage preferences",
  "email preferences",
  "view this email in your browser",
  "technolutions",
  "mx.technolutions.net",
  "slate",
  "office of admission",
  "office of admissions",
  "office of undergraduate admission",
  "office of undergraduate admissions",
  "undergraduate programs"
];

const HIGH_CONFIDENCE_CAMPAIGN_SIGNALS = [
  "why attend an urban school",
  "top three reasons to attend an urban institution",
  "live virtual student panel",
  "your creighton journey starts here",
  "looking for a sign",
  "is college worth it",
  "big picture",
  "preparing for a job",
  "start the path",
  "path to your future",
  "your future",
  "our community",
  "shaped me",
  "you can now create your uchicago account",
  "today marks the beginning of the 2026-2027 uchicago admissions cycle",
  "start your college applications",
  "create your uchicago account",
  "university of colorado boulder invites you",
  "apply today",
  "buckeye preview day",
  "undergraduate admission",
  "is college worth it",
  "start the path to your future",
  "university of colorado boulder invites you"
];

const KEEP_SIGNALS = [
  "security alert",
  "2-step verification",
  "verification code",
  "email verification",
  "password reset",
  "application received",
  "we received your application",
  "your application has been received",
  "missing documents",
  "decision available",
  "view your decision",
  "portal login",
  "ap classroom",
  "college board",
  "score report"
];

const BROAD_PROTECTED_TERMS = [
  "common app",
  "common application",
  "coalition application",
  "questbridge",
  "fafsa",
  "css profile",
  "financial aid",
  "financial aid portal",
  "application portal",
  "applicant portal",
  "admission decision",
  "application deadline"
];

const TRANSACTIONAL_KEEP_CONTEXT = [
  "application received",
  "we received your application",
  "your application has been received",
  "missing documents",
  "action required",
  "status update",
  "decision available",
  "view your decision",
  "portal login",
  "password reset",
  "verification code"
];

let cachedCollegeAdsLabelId = null;

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

async function getSettings() {
  const data = await storageGet(["settings"]);
  return {
    ...DEFAULT_SETTINGS,
    ...(data.settings || {}),
    protectedTerms: Array.isArray(data.settings?.protectedTerms)
      ? data.settings.protectedTerms
      : DEFAULT_SETTINGS.protectedTerms
  };
}

async function saveSettings(nextSettings) {
  const current = await getSettings();
  const settings = { ...current, ...nextSettings };
  await storageSet({ settings, scanCache: {} });
  return settings;
}


async function getScanCache() {
  const data = await storageGet(["scanCache"]);
  return data.scanCache || {};
}

async function saveScanCache(scanCache) {
  const now = Date.now();
  const pruned = {};

  Object.entries(scanCache || {}).forEach(([messageId, entry]) => {
    if (now - Number(entry.checkedAt || 0) < SCAN_CACHE_TTL_MS) {
      pruned[messageId] = entry;
    }
  });

  await storageSet({ scanCache: pruned });
  return pruned;
}

function shouldSkipCachedMessage(messageId, scanCache) {
  const entry = scanCache?.[messageId];
  return Boolean(
    entry &&
      entry.classifierVersion === CLASSIFIER_VERSION &&
      Date.now() - Number(entry.checkedAt || 0) < SCAN_CACHE_TTL_MS
  );
}

function updateScanCache(scanCache, messageId, result) {
  scanCache[messageId] = {
    checkedAt: Date.now(),
    classifierVersion: CLASSIFIER_VERSION,
    moved: Boolean(result.moved),
    protected: Boolean(result.protected),
    reason: result.reason || ""
  };
}
async function getReport() {
  const data = await storageGet(["report"]);
  return { ...EMPTY_REPORT, ...(data.report || {}) };
}

async function saveReport(report) {
  const trimmed = {
    ...report,
    movedItems: (report.movedItems || []).slice(0, MAX_REPORT_ITEMS),
    protectedItems: (report.protectedItems || []).slice(0, MAX_REPORT_ITEMS),
    keptItems: (report.keptItems || []).slice(0, MAX_REPORT_ITEMS),
    failedItems: (report.failedItems || []).slice(0, MAX_REPORT_ITEMS)
  };
  await storageSet({ report: trimmed });
  return trimmed;
}

function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (tokenResult) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const token =
        typeof tokenResult === "string" ? tokenResult : tokenResult?.token;

      if (!token) {
        reject(new Error("chrome.identity returned an empty OAuth token."));
        return;
      }

      resolve(token);
    });
  });
}

async function clearCachedAuthTokens() {
  return new Promise((resolve) => chrome.identity.clearAllCachedAuthTokens(resolve));
}

async function gmailFetch(path, options = {}, authOptions = {}) {
  const interactive = authOptions.interactive !== false;
  const retryOnAuthFailure = authOptions.retryOnAuthFailure !== false;
  const token = await getAuthToken(interactive);
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && retryOnAuthFailure) {
    console.warn("[Inbox Noise Filter] OAuth token expired; retrying once.");
    chrome.identity.removeCachedAuthToken({ token });
    return gmailFetch(path, options, {
      interactive,
      retryOnAuthFailure: false
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gmail API ${options.method || "GET"} ${path} failed: ` +
        `${response.status} ${response.statusText} ${errorText}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listLabels(authOptions = {}) {
  console.log("[Inbox Noise Filter] Checking existing Gmail labels.");
  const data = await gmailFetch("/labels", {}, authOptions);
  return Array.isArray(data.labels) ? data.labels : [];
}

async function createCollegeAdsLabel(authOptions = {}) {
  console.log("[Inbox Noise Filter] Creating Gmail label: College Ads.");
  return gmailFetch(
    "/labels",
    {
      method: "POST",
      body: JSON.stringify({
        name: COLLEGE_ADS_LABEL_NAME,
        labelListVisibility: "labelShow",
        messageListVisibility: "show"
      })
    },
    authOptions
  );
}

async function getCollegeAdsLabelId(authOptions = {}) {
  if (cachedCollegeAdsLabelId) {
    return cachedCollegeAdsLabelId;
  }

  const labels = await listLabels(authOptions);
  const existingLabel = labels.find(
    (label) => label.name === COLLEGE_ADS_LABEL_NAME
  );

  if (existingLabel?.id) {
    cachedCollegeAdsLabelId = existingLabel.id;
    return cachedCollegeAdsLabelId;
  }

  const createdLabel = await createCollegeAdsLabel(authOptions);
  if (!createdLabel?.id) {
    throw new Error("Gmail label creation succeeded but returned no label ID.");
  }

  cachedCollegeAdsLabelId = createdLabel.id;
  return cachedCollegeAdsLabelId;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function countSignals(text, signals) {
  return signals.filter((signal) => text.includes(signal)).length;
}

function hasAnySignal(text, signals) {
  return signals.some((signal) => text.includes(signal));
}

function getHeader(headers, name) {
  const match = headers.find(
    (header) => normalizeText(header.name) === normalizeText(name)
  );
  return match?.value || "";
}

function decodeBase64Url(data) {
  if (!data) {
    return "";
  }

  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
}

function extractPayloadText(payload) {
  if (!payload) {
    return "";
  }

  const currentPartText = decodeBase64Url(payload.body?.data || "");
  const childText = Array.isArray(payload.parts)
    ? payload.parts.map(extractPayloadText).join("\n")
    : "";

  return `${currentPartText}\n${childText}`;
}

async function getMessageDetails(messageId, authOptions = {}) {
  const encodedMessageId = encodeURIComponent(messageId);
  const message = await gmailFetch(
    `/messages/${encodedMessageId}?format=full`,
    {},
    authOptions
  );
  const headers = message.payload?.headers || [];
  const rawBody = extractPayloadText(message.payload);
  const bodyText = stripHtml(rawBody);

  return {
    id: message.id,
    labelIds: message.labelIds || [],
    snippet: message.snippet || "",
    from: getHeader(headers, "From"),
    subject: getHeader(headers, "Subject"),
    listUnsubscribe: getHeader(headers, "List-Unsubscribe"),
    bodyText
  };
}

function getCombinedText(details, rowSnapshot = {}) {
  return normalizeText(
    [
      details.from,
      details.subject,
      details.snippet,
      details.listUnsubscribe,
      details.bodyText,
      rowSnapshot.sender,
      rowSnapshot.subject,
      rowSnapshot.snippet
    ].join(" ")
  );
}

function itemSummary(details) {
  return {
    id: details.id,
    from: details.from,
    subject: details.subject,
    snippet: details.snippet.slice(0, 180)
  };
}

function findProtectedTerm(combinedText, settings) {
  const terms = (settings.protectedTerms || [])
    .map(normalizeText)
    .filter(Boolean);
  return terms.find((term) => combinedText.includes(term)) || "";
}

function isBroadProtectedTerm(term) {
  return BROAD_PROTECTED_TERMS.some(
    (broadTerm) => term === broadTerm || term.includes(broadTerm)
  );
}

function shouldHonorProtectedTerm(term, combinedText) {
  if (!isBroadProtectedTerm(term)) {
    return true;
  }

  return hasAnySignal(combinedText, TRANSACTIONAL_KEEP_CONTEXT);
}

function classifyCollegeAdEmail(details, settings, rowSnapshot = {}) {
  const combinedText = getCombinedText(details, rowSnapshot);
  const protectedTerm = findProtectedTerm(combinedText, settings);
  const orgScore = countSignals(combinedText, COLLEGE_ORG_SIGNALS);
  const intentScore = countSignals(combinedText, ADMISSIONS_INTENT_SIGNALS);
  const recruitingScore = countSignals(combinedText, COLLEGE_RECRUITING_SIGNALS);
  const infrastructureScore = countSignals(
    combinedText,
    MARKETING_INFRASTRUCTURE_SIGNALS
  );
  const fromText = normalizeText(details.from);
  const fromLooksCollegeRelated = /@(.*\.)?(edu)\b/.test(fromText);
  const fromLooksAdmissionsRelated = /(admission|admissions|enroll|apply|undergraduate)/.test(fromText);
  const exactCampaignMatch = hasAnySignal(combinedText, HIGH_CONFIDENCE_CAMPAIGN_SIGNALS);

  const shouldMove =
    exactCampaignMatch ||
    (orgScore >= 1 && intentScore >= 1) ||
    (fromLooksAdmissionsRelated && (intentScore >= 1 || recruitingScore >= 1)) ||
    (fromLooksCollegeRelated && orgScore >= 1 && intentScore >= 1) ||
    (orgScore >= 2 && recruitingScore >= 1 && infrastructureScore >= 1) ||
    (orgScore >= 1 && recruitingScore >= 2 && infrastructureScore >= 1);

  if (protectedTerm && shouldHonorProtectedTerm(protectedTerm, combinedText) && !shouldMove) {
    return {
      shouldMove: false,
      protected: true,
      reason: `Matched protected term: ${protectedTerm}.`
    };
  }

  if (hasAnySignal(combinedText, KEEP_SIGNALS) && !shouldMove) {
    return {
      shouldMove: false,
      protected: false,
      reason: "Contains account/application safety signal."
    };
  }

  return {
    shouldMove,
    protected: false,
    reason: shouldMove
      ? `Matched admissions campaign: org=${orgScore}, intent=${intentScore}, recruiting=${recruitingScore}, infra=${infrastructureScore}.`
      : `Not enough admissions campaign evidence: org=${orgScore}, intent=${intentScore}, recruiting=${recruitingScore}, infra=${infrastructureScore}.`
  };
}
async function connectGmail() {
  const labelId = await getCollegeAdsLabelId({ interactive: true });
  const settings = await saveSettings({
    connected: true,
    connectedAt: new Date().toISOString()
  });
  console.log(`[Inbox Noise Filter] Gmail connected with label ${labelId}.`);
  return { labelId, settings };
}

async function disconnectGmail() {
  await clearCachedAuthTokens();
  const settings = await saveSettings({ connected: false });
  return { settings };
}

async function moveEmailToCollegeAds(messageId, authOptions = {}) {
  if (!messageId || typeof messageId !== "string") {
    throw new Error("A valid Gmail messageId string is required.");
  }

  const labelId = await getCollegeAdsLabelId(authOptions);
  const encodedMessageId = encodeURIComponent(messageId);

  return gmailFetch(
    `/messages/${encodedMessageId}/modify`,
    {
      method: "POST",
      body: JSON.stringify({
        addLabelIds: [labelId],
        removeLabelIds: ["INBOX"]
      })
    },
    authOptions
  );
}

async function analyzeAndMaybeMoveEmail(
  messageId,
  rowSnapshot = {},
  authOptions = {},
  settings = null
) {
  const activeSettings = settings || (await getSettings());
  const details = await getMessageDetails(messageId, authOptions);
  const classification = classifyCollegeAdEmail(
    details,
    activeSettings,
    rowSnapshot
  );

  console.log("[Inbox Noise Filter] Full-message classification:", {
    messageId,
    from: details.from,
    subject: details.subject,
    shouldMove: classification.shouldMove,
    protected: classification.protected,
    reason: classification.reason
  });

  if (!classification.shouldMove) {
    return {
      moved: false,
      protected: classification.protected,
      reason: classification.reason,
      item: itemSummary(details)
    };
  }

  const modifiedMessage = await moveEmailToCollegeAds(messageId, authOptions);
  return {
    moved: true,
    protected: false,
    reason: classification.reason,
    messageId: modifiedMessage?.id || messageId,
    item: itemSummary(details)
  };
}

async function listInboxMessages(pageToken = "", authOptions = {}, maxResults = 50) {
  const query = encodeURIComponent(COLLEGE_AD_SEARCH_QUERY);
  const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  return gmailFetch(
    `/messages?q=${query}&maxResults=${maxResults}${pageParam}`,
    {},
    authOptions
  );
}

async function scanInboxForCollegeAds(options = {}) {
  const startedAt = Date.now();
  const authOptions = { interactive: options.interactive !== false };
  const settings = await getSettings();

  if (!authOptions.interactive && !settings.connected) {
    return {
      ...EMPTY_REPORT,
      lastRunAt: new Date().toISOString(),
      lastSource: options.source || "auto",
      triggerReason: options.reason || "",
      skipped: 1,
      skipReason: "Gmail is not connected yet."
    };
  }

  await getCollegeAdsLabelId(authOptions);

  let pageToken = "";
  let scanCache = await getScanCache();
  const report = {
    ...EMPTY_REPORT,
    lastRunAt: new Date().toISOString(),
    lastSource: options.source || "manual",
    triggerReason: options.reason || "",
    query: COLLEGE_AD_SEARCH_QUERY
  };
  const maxPages = options.maxPages || 2;
  const maxResults = options.maxResults || 40;
  const forceRefresh = Boolean(options.forceRefresh);

  if (forceRefresh) {
    console.log("[Inbox Noise Filter] Force refresh scan requested; ignoring scan cache.");
    scanCache = {};
  }

  for (let page = 0; page < maxPages; page += 1) {
    const pageData = await listInboxMessages(pageToken, authOptions, maxResults);
    const messages = Array.isArray(pageData.messages) ? pageData.messages : [];
    report.candidates += messages.length;

    if (messages.length === 0) {
      break;
    }

    for (const message of messages) {
      if (!forceRefresh && shouldSkipCachedMessage(message.id, scanCache)) {
        report.skipped += 1;
        continue;
      }

      report.scanned += 1;

      try {
        const result = await analyzeAndMaybeMoveEmail(
          message.id,
          {},
          authOptions,
          settings
        );
        updateScanCache(scanCache, message.id, result);

        if (result.moved) {
          report.moved += 1;
          report.movedItems.unshift({ ...result.item, reason: result.reason });
        } else if (result.protected) {
          report.kept += 1;
          report.protected += 1;
          report.protectedItems.unshift({ ...result.item, reason: result.reason });
        } else {
          report.kept += 1;
          if (report.keptItems.length < 10) {
            report.keptItems.unshift({ ...result.item, reason: result.reason });
          }
        }
      } catch (error) {
        report.failed += 1;
        report.failedItems.unshift({ id: message.id, error: error.message });
        console.error(
          `[Inbox Noise Filter] Inbox scan failed for ${message.id}:`,
          error
        );
      }
    }

    pageToken = pageData.nextPageToken || "";
    if (!pageToken) {
      break;
    }
  }

  report.durationMs = Date.now() - startedAt;
  scanCache = await saveScanCache(scanCache);
  await saveReport(report);

  if (options.source === "auto") {
    const currentSettings = await getSettings();
    await storageSet({
      settings: {
        ...currentSettings,
        lastAutoScanAt: Date.now()
      }
    });
  }

  return report;
}
async function autoScanInbox(options = {}) {
  const settings = await getSettings();
  const now = Date.now();

  if (!settings.connected || !settings.autoScanEnabled) {
    return {
      success: true,
      skipped: 1,
      skipReason: "Auto scan is off or Gmail is not connected."
    };
  }

  if (now - Number(settings.lastAutoScanAt || 0) < AUTO_SCAN_COOLDOWN_MS) {
    return {
      success: true,
      skipped: 1,
      skipReason: "Auto scan cooldown is active."
    };
  }

  const report = await scanInboxForCollegeAds({
    interactive: false,
    source: "auto",
    reason: options.reason || "",
    maxPages: 1,
    maxResults: 25
  });
  return { success: true, ...report };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "openSetup") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
    sendResponse({ success: true });
    return false;
  }
  if (message?.action === "getState") {
    Promise.all([getSettings(), getReport()])
      .then(([settings, report]) => sendResponse({ success: true, settings, report }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message?.action === "saveSettings") {
    saveSettings(message.settings || {})
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message?.action === "connectGmail") {
    connectGmail()
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => {
        console.error("[Inbox Noise Filter] Gmail connection failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message?.action === "disconnectGmail") {
    disconnectGmail()
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message?.action === "scanInbox") {
    scanInboxForCollegeAds({ interactive: true, source: "manual", maxPages: 2, maxResults: 40, forceRefresh: true })
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => {
        console.error("[Inbox Noise Filter] Inbox scan failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message?.action === "autoScanInbox") {
    autoScanInbox({ reason: message.reason || "" })
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("[Inbox Noise Filter] Auto scan failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message?.action === "analyzeEmail") {
    analyzeAndMaybeMoveEmail(message.messageId, message.rowSnapshot, {
      interactive: false
    })
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => {
        console.error("[Inbox Noise Filter] Unable to analyze email:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});
















