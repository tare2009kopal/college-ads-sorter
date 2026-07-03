const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const scanButton = document.getElementById("scanButton");
const saveSettingsButton = document.getElementById("saveSettingsButton");
const setupButton = document.getElementById("setupButton");
const autoScanCheckbox = document.getElementById("autoScanCheckbox");
const protectedTermsNode = document.getElementById("protectedTerms");
const statusNode = document.getElementById("status");
const mainStatus = document.getElementById("mainStatus");
const lastScanText = document.getElementById("lastScanText");
const connectedPill = document.getElementById("connectedPill");
const movedCount = document.getElementById("movedCount");
const protectedCount = document.getElementById("protectedCount");
const checkedCount = document.getElementById("checkedCount");
const skippedCount = document.getElementById("skippedCount");
const reportSections = document.getElementById("reportSections");

let currentSettings = null;
let currentReport = null;

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = type;
}

function setBusy(isBusy) {
  connectButton.disabled = isBusy || currentSettings?.connected;
  disconnectButton.disabled = isBusy || !currentSettings?.connected;
  scanButton.disabled = isBusy || !currentSettings?.connected;
  setupButton.disabled = isBusy;
  saveSettingsButton.disabled = isBusy;
  autoScanCheckbox.disabled = isBusy;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.success) {
        reject(new Error(response?.error || "Request failed."));
        return;
      }

      resolve(response);
    });
  });
}

function formatDuration(ms) {
  if (!ms) return "under a second";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} sec`;
}

function formatTime(value) {
  if (!value) return "No scan yet";
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderItem(item) {
  return `
    <div class="item">
      <strong>${escapeHtml(item.subject || "(no subject)")}</strong>
      <small>${escapeHtml(item.from || "unknown sender")}</small>
      <small>${escapeHtml(item.reason || "")}</small>
    </div>
  `;
}

function renderSection(title, items, emptyText) {
  const safeItems = items || [];
  return `
    <div class="section-title">${title}</div>
    <div class="item-list">
      ${safeItems.length ? safeItems.slice(0, 6).map(renderItem).join("") : `<div class="item"><small>${emptyText}</small></div>`}
    </div>
  `;
}

function renderReport(report) {
  currentReport = report || currentReport || {};
  movedCount.textContent = currentReport.moved || 0;
  protectedCount.textContent = currentReport.protected || 0;
  checkedCount.textContent = currentReport.scanned || 0;
  skippedCount.textContent = currentReport.skipped || 0;

  if (!currentReport.lastRunAt) {
    lastScanText.textContent = "No scan has run yet.";
    reportSections.innerHTML = renderSection("Recent activity", [], "No report yet. Click Scan Now to test it.");
    return;
  }

  const source = currentReport.lastSource || "scan";
  const reason = currentReport.triggerReason ? ` • ${currentReport.triggerReason}` : "";
  lastScanText.textContent = `${formatTime(currentReport.lastRunAt)} • ${formatDuration(currentReport.durationMs)} • ${source}${reason}`;

  reportSections.innerHTML = `
    ${renderSection("Moved to College Ads", currentReport.movedItems, "Nothing moved in the last scan.")}
    ${renderSection("Protected in Inbox", currentReport.protectedItems, "No protected matches in the last scan.")}
    ${currentReport.failed ? renderSection("Needs attention", currentReport.failedItems?.map((item) => ({ subject: item.id, from: "Scan error", reason: item.error })), "No errors.") : ""}
  `;
}

function renderSettings(settings) {
  currentSettings = settings;
  autoScanCheckbox.checked = Boolean(settings.autoScanEnabled);
  protectedTermsNode.value = (settings.protectedTerms || []).join("\n");

  if (settings.connected) {
    mainStatus.textContent = settings.autoScanEnabled ? "Active and watching Gmail" : "Connected, manual scans only";
    connectedPill.textContent = "Connected";
    connectedPill.className = "pill on";
    connectButton.style.display = "none";
    disconnectButton.style.display = "block";
  } else {
    mainStatus.textContent = "Connect Gmail to start";
    connectedPill.textContent = "Not connected";
    connectedPill.className = "pill off";
    connectButton.style.display = "block";
    disconnectButton.style.display = "none";
  }

  setBusy(false);
}

async function refreshState() {
  const response = await sendMessage({ action: "getState" });
  renderSettings(response.settings);
  renderReport(response.report);
}

async function runAction(pendingText, action) {
  try {
    setBusy(true);
    setStatus(pendingText);
    const response = await action();
    await refreshState();
    return response;
  } catch (error) {
    setStatus(error.message, "error");
    setBusy(false);
    throw error;
  }
}

connectButton.addEventListener("click", async () => {
  const response = await runAction("Opening Google permission prompt...", () =>
    sendMessage({ action: "connectGmail" })
  );
  setStatus("Gmail connected. MailSift is ready.", "success");
  renderSettings(response.settings);
});

disconnectButton.addEventListener("click", async () => {
  const response = await runAction("Disabling cached Gmail permission...", () =>
    sendMessage({ action: "disconnectGmail" })
  );
  setStatus("Permission cache cleared.", "success");
  renderSettings(response.settings);
});

scanButton.addEventListener("click", async () => {
  const response = await runAction("Scanning likely college-ad candidates...", () =>
    sendMessage({ action: "scanInbox" })
  );
  setStatus(
    `Done in ${formatDuration(response.durationMs)}. Moved ${response.moved}, protected ${response.protected}, checked ${response.scanned}, cached ${response.skipped}.`,
    "success"
  );
  renderReport(response);
});

saveSettingsButton.addEventListener("click", async () => {
  const protectedTerms = protectedTermsNode.value
    .split("\n")
    .map((term) => term.trim())
    .filter(Boolean);

  const response = await runAction("Saving preferences...", () =>
    sendMessage({
      action: "saveSettings",
      settings: {
        protectedTerms,
        autoScanEnabled: autoScanCheckbox.checked
      }
    })
  );
  setStatus("Preferences saved. Cache reset so new rules apply.", "success");
  renderSettings(response.settings);
});

autoScanCheckbox.addEventListener("change", async () => {
  try {
    setBusy(true);
    const response = await sendMessage({
      action: "saveSettings",
      settings: { autoScanEnabled: autoScanCheckbox.checked }
    });
    renderSettings(response.settings);
    setStatus(
      autoScanCheckbox.checked ? "Continuous scanning enabled." : "Continuous scanning disabled.",
      "success"
    );
  } catch (error) {
    setStatus(error.message, "error");
    autoScanCheckbox.checked = !autoScanCheckbox.checked;
    setBusy(false);
  }
});

setupButton.addEventListener("click", async () => {
  try {
    await sendMessage({ action: "openSetup" });
  } catch (error) {
    setStatus(error.message, "error");
  }
});

refreshState().catch((error) => {
  setStatus(error.message, "error");
});
