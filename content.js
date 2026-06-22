// content.js

const COLLEGE_ADS_LABEL = "College Ads";
const SCAN_INTERVAL_MS = 8000;
const MAX_THREADS_PER_SCAN = 20;

const processedThreadIds = new Set();

function textOf(node) {
  return (node?.innerText || node?.textContent || "").trim();
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getThreadId(row) {
  return (
    row.getAttribute("data-legacy-message-id") ||
    row.getAttribute("data-legacy-thread-id") ||
    row.getAttribute("data-thread-id") ||
    row.id ||
    `${textOf(row).slice(0, 120)}`
  );
}

function isUnreadThread(row) {
  return (
    row.classList.contains("zE") ||
    row.getAttribute("aria-label")?.toLowerCase().includes("unread") ||
    row.querySelector("[aria-label*='unread' i]")
  );
}

function hasPositiveGmailMarker(row, positiveWords, negativeWords) {
  const selector = [
    "[aria-label]",
    "[data-tooltip]",
    "[title]",
    "[role='button']",
    "[role='img']"
  ].join(",");

  const nodes = Array.from(row.querySelectorAll(selector));

  return nodes.some((node) => {
    const values = [
      node.getAttribute("aria-label"),
      node.getAttribute("data-tooltip"),
      node.getAttribute("title")
    ].map(normalize);

    return values.some((value) => {
      if (!value) return false;
      if (negativeWords.some((word) => value === word || value.includes(word))) {
        return false;
      }
      return positiveWords.some((word) => value === word || value.includes(word));
    });
  });
}

function isStarred(row) {
  return hasPositiveGmailMarker(row, ["starred"], ["not starred"]);
}

function isImportant(row) {
  return hasPositiveGmailMarker(row, ["important", "marked important"], ["not important", "mark as important"]);
}

function isSafetyProtected(row) {
  return isStarred(row) || isImportant(row);
}

function extractSender(row) {
  return (
    textOf(row.querySelector(".yW span[email]")) ||
    row.querySelector(".yW span[email]")?.getAttribute("email") ||
    textOf(row.querySelector("[email]")) ||
    textOf(row.querySelector(".yW")) ||
    ""
  );
}

function extractSubject(row) {
  return (
    textOf(row.querySelector(".bog")) ||
    textOf(row.querySelector("[data-thread-id] .bog")) ||
    textOf(row.querySelector("[role='link']")) ||
    ""
  );
}

function extractSnippet(row) {
  return (
    textOf(row.querySelector(".y2")) ||
    textOf(row.querySelector(".a4W")) ||
    textOf(row).slice(0, 500)
  );
}

function extractThread(row) {
  return {
    threadId: getThreadId(row),
    sender: extractSender(row),
    subject: extractSubject(row),
    snippet: extractSnippet(row)
  };
}

function findInboxRows() {
  return Array.from(document.querySelectorAll("tr.zA, div[role='main'] tr"));
}

function getUnreadUnprotectedThreads() {
  return findInboxRows()
    .filter(isUnreadThread)
    .filter((row) => !isSafetyProtected(row))
    .slice(0, MAX_THREADS_PER_SCAN)
    .map((row) => ({ row, data: extractThread(row) }))
    .filter(({ data }) => data.threadId && !processedThreadIds.has(data.threadId));
}

function selectThreadRow(row) {
  const checkbox =
    row.querySelector("[role='checkbox']") ||
    row.querySelector("div[aria-label*='Select' i]") ||
    row.querySelector(".oZ-jc");
  if (!checkbox) return false;
  checkbox.click();
  return true;
}

function clickToolbarButton(labelPatterns) {
  const buttons = Array.from(document.querySelectorAll("[role='button'], div[aria-label], div[data-tooltip]"));

  const button = buttons.find((node) => {
    const label = normalize(
      node.getAttribute("aria-label") ||
      node.getAttribute("data-tooltip") ||
      node.getAttribute("title") ||
      textOf(node)
    );

    return labelPatterns.some((pattern) => pattern.test(label));
  });

  if (!button) return false;
  button.click();
  return true;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyCollegeAdsLabel() {
  const opened = clickToolbarButton([
    /^labels?$/,
    /label/
  ]);

  if (!opened) return false;

  await wait(400);

  const menuItems = Array.from(document.querySelectorAll("[role='menuitem'], [role='option'], div[aria-label]"));
  const labelItem = menuItems.find((node) => normalize(textOf(node)).includes(normalize(COLLEGE_ADS_LABEL)));

  if (labelItem) {
    labelItem.click();
    await wait(200);

    clickToolbarButton([/^apply$/, /^ok$/]);
    return true;
  }

  console.warn(`Label "${COLLEGE_ADS_LABEL}" not found. Create it once in Gmail before running automation.`);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return false;
}

async function archiveSelectedThread() {
  return clickToolbarButton([
    /^archive$/,
    /archive/
  ]);
}

async function moveThreadToCollegeAds(row) {
  if (isSafetyProtected(row)) return false;

  const selected = selectThreadRow(row);
  if (!selected) return false;

  await wait(300);

  const labeled = await applyCollegeAdsLabel();
  if (!labeled) return false;

  await wait(300);

  const archived = await archiveSelectedThread();
  return archived;
}

async function classifyThread(thread) {
  return chrome.runtime.sendMessage({
    type: "CLASSIFY_EMAIL",
    payload: thread
  });
}

async function scanInbox() {
  const candidates = getUnreadUnprotectedThreads();

  for (const { row, data } of candidates) {
    processedThreadIds.add(data.threadId);

    try {
      const result = await classifyThread(data);

      if (result?.classification === "JUNK") {
        await moveThreadToCollegeAds(row);
      }
    } catch (error) {
      console.error("College Ads Sorter classification failed:", error);
    }
  }
}

function startListener() {
  scanInbox();
  setInterval(scanInbox, SCAN_INTERVAL_MS);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__collegeAdsSorterScanTimer);
    window.__collegeAdsSorterScanTimer = setTimeout(scanInbox, 1000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

startListener();