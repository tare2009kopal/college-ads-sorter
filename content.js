// content.js
// Keeps MailSift active while Gmail is open. It asks the background worker to
// scan Gmail through the API, and also inspects visible Gmail rows as a fast UI aid.

const STRONG_ROW_SIGNALS = [
  "undergraduate",
  "admissions",
  "admission",
  "apply now",
  "apply today",
  "apply by",
  "start your application",
  "create your account",
  "request information",
  "request info",
  "application is open",
  "applications are open",
  "admissions cycle",
  "admissions counselor",
  "supplemental essay prompts",
  "visit campus",
  "campus tour",
  "open house",
  "information session",
  "info session",
  "student panel",
  "virtually visit",
  "virtual visit",
  "financial aid",
  "scholarship",
  "prospectus",
  "why attend",
  "journey starts",
  "invites you",
  "invited to apply",
  "frog camp"
];

const COLLEGE_ROW_SIGNALS = [
  "college",
  "university",
  "admission",
  "admissions",
  "undergraduate",
  "prospective student",
  "future student",
  "office of admission",
  "drexel",
  "creighton",
  "usf",
  "university of san francisco",
  "tcu",
  "uchicago",
  "university of chicago",
  "university of colorado boulder",
  "colorado boulder",
  "cu boulder"
];

const SCAN_DEBOUNCE_MS = 350;
const AUTO_SCAN_INTERVAL_MS = 30 * 1000;
const AUTO_SCAN_MUTATION_DEBOUNCE_MS = 4000;
const ROW_HIDDEN_CLASS = "inbox-noise-filter-hidden";

const processedMessageIds = new Set();
const pendingMessageIds = new Set();

let scanTimer = null;
let autoScanMutationTimer = null;

function injectHiddenStyle() {
  if (document.getElementById("inbox-noise-filter-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "inbox-noise-filter-style";
  style.textContent = `
    .${ROW_HIDDEN_CLASS} {
      display: none !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getRowSenderText(row) {
  return normalizeText(
    row.querySelector(".yW")?.innerText ||
      row.querySelector("[email]")?.getAttribute("email") ||
      row.querySelector("[name]")?.getAttribute("name") ||
      ""
  );
}

function getRowSubjectText(row) {
  return normalizeText(
    row.querySelector(".bog")?.innerText ||
      row.querySelector("[role='link']")?.innerText ||
      ""
  );
}

function getRowSnippetText(row) {
  return normalizeText(row.querySelector(".y2")?.innerText || row.textContent || "");
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getRowSnapshot(row) {
  return {
    sender: getRowSenderText(row),
    subject: getRowSubjectText(row),
    snippet: getRowSnippetText(row)
  };
}

function shouldAnalyzeRow(row) {
  const snapshot = getRowSnapshot(row);
  const combinedText = normalizeText(
    `${snapshot.sender} ${snapshot.subject} ${snapshot.snippet} ${row.innerText || row.textContent || ""}`
  );

  return (
    includesAny(combinedText, STRONG_ROW_SIGNALS) ||
    includesAny(combinedText, COLLEGE_ROW_SIGNALS)
  );
}

function getMessageIdFromRow(row) {
  const directMessageId =
    row.getAttribute("data-legacy-message-id") ||
    row.dataset?.legacyMessageId ||
    row.getAttribute("data-message-id") ||
    row.dataset?.messageId;

  if (directMessageId) {
    return directMessageId;
  }

  const nestedMessageNode = row.querySelector(
    "[data-legacy-message-id], [data-message-id]"
  );

  return (
    nestedMessageNode?.getAttribute("data-legacy-message-id") ||
    nestedMessageNode?.dataset?.legacyMessageId ||
    nestedMessageNode?.getAttribute("data-message-id") ||
    nestedMessageNode?.dataset?.messageId ||
    null
  );
}

function findGmailMessageRows() {
  const selectors = [
    "tr[data-legacy-message-id]",
    "tr.zA",
    "div[role='main'] table tr",
    "div[role='main'] [data-legacy-message-id]"
  ];

  const rows = new Set();

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const row = node.closest("tr") || node;
      if (row && document.body.contains(row)) {
        rows.add(row);
      }
    });
  });

  return Array.from(rows);
}

function hideRow(row) {
  row.classList.add(ROW_HIDDEN_CLASS);
  row.style.display = "none";
}

function restoreRow(row) {
  row.classList.remove(ROW_HIDDEN_CLASS);
  row.style.removeProperty("display");
}

function sendAnalyzeRequest(messageId, row) {
  pendingMessageIds.add(messageId);

  chrome.runtime.sendMessage(
    {
      action: "analyzeEmail",
      messageId,
      rowSnapshot: getRowSnapshot(row)
    },
    (response) => {
      pendingMessageIds.delete(messageId);

      if (chrome.runtime.lastError) {
        console.error(
          "[Inbox Noise Filter] Failed to contact background worker:",
          chrome.runtime.lastError.message
        );
        restoreRow(row);
        return;
      }

      if (!response?.success) {
        console.error(
          "[Inbox Noise Filter] Gmail analysis failed:",
          response?.error || "Unknown error"
        );
        restoreRow(row);
        return;
      }

      processedMessageIds.add(messageId);

      if (response.moved) {
        hideRow(row);
        console.log(
          `[Inbox Noise Filter] Moved message ${messageId} to College Ads: ${response.reason}`
        );
        return;
      }

      console.log(
        `[Inbox Noise Filter] Kept message ${messageId}: ${response.reason}`
      );
    }
  );
}

function processRow(row) {
  const messageId = getMessageIdFromRow(row);

  if (!messageId) {
    return;
  }

  if (processedMessageIds.has(messageId) || pendingMessageIds.has(messageId)) {
    return;
  }

  if (!shouldAnalyzeRow(row)) {
    return;
  }

  console.log(
    `[Inbox Noise Filter] Sending row ${messageId} for full-message analysis.`,
    getRowSnapshot(row)
  );
  sendAnalyzeRequest(messageId, row);
}

function scanVisibleRows() {
  try {
    const rows = findGmailMessageRows();
    rows.forEach(processRow);
  } catch (error) {
    console.error("[Inbox Noise Filter] DOM scan failed:", error);
  }
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(scanVisibleRows, SCAN_DEBOUNCE_MS);
}

function requestAutoScan(reason = "manual") {
  chrome.runtime.sendMessage({ action: "autoScanInbox", reason }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[Inbox Noise Filter] Auto scan request failed:",
        chrome.runtime.lastError.message
      );
      return;
    }

    if (!response?.success) {
      console.warn(
        "[Inbox Noise Filter] Auto scan failed:",
        response?.error || "Unknown error"
      );
      return;
    }

    if (response.skipped) {
      console.log("[Inbox Noise Filter] Auto scan skipped:", response.skipReason);
      return;
    }

    console.log("[Inbox Noise Filter] Auto scan complete:", {
      reason,
      scanned: response.scanned,
      moved: response.moved,
      kept: response.kept,
      protected: response.protected,
      failed: response.failed
    });
  });
}

function scheduleAutoScan(reason = "gmail-update") {
  window.clearTimeout(autoScanMutationTimer);
  autoScanMutationTimer = window.setTimeout(() => {
    requestAutoScan(reason);
  }, AUTO_SCAN_MUTATION_DEBOUNCE_MS);
}

function startContinuousAutoScan() {
  requestAutoScan("gmail-opened");
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      requestAutoScan("gmail-open-poll");
    }
  }, AUTO_SCAN_INTERVAL_MS);
}

function startObserver() {
  if (!document.body) {
    window.setTimeout(startObserver, 250);
    return;
  }

  injectHiddenStyle();
  startContinuousAutoScan();
  scanVisibleRows();

  const observer = new MutationObserver((mutations) => {
    const hasRelevantChange = mutations.some(
      (mutation) => mutation.addedNodes.length > 0 || mutation.type === "childList"
    );

    if (hasRelevantChange) {
      scheduleScan();
      scheduleAutoScan("gmail-dom-updated");
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("focus", () => {
    scheduleScan();
    scheduleAutoScan("gmail-focused");
  });
  window.addEventListener("hashchange", () => {
    scheduleScan();
    scheduleAutoScan("gmail-navigation");
  });

  console.log("[Inbox Noise Filter] Gmail DOM observer and continuous auto-scan started.");
}

startObserver();





