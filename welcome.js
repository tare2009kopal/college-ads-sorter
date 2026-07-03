const connectionStatus = document.getElementById("connectionStatus");
const progressNode = document.getElementById("progress");
const stepEyebrow = document.getElementById("stepEyebrow");
const stepQuestion = document.getElementById("stepQuestion");
const stepHelper = document.getElementById("stepHelper");
const stepContent = document.getElementById("stepContent");
const backButton = document.getElementById("backButton");
const nextButton = document.getElementById("nextButton");
const openGmailButton = document.getElementById("openGmailButton");
const messageNode = document.getElementById("message");

let gmailConnected = false;
let currentStep = 0;
let savedSettings = null;

const CATEGORY_TERMS = {
  testing: [
    "college board",
    "ap classroom",
    "advanced placement",
    "sat",
    "psat",
    "act",
    "bluebook",
    "exam registration",
    "score report"
  ],
  applications: [
    "common app",
    "coalition application",
    "fafsa",
    "css profile",
    "application portal",
    "applicant portal",
    "admission decision",
    "application received",
    "missing documents",
    "financial aid portal"
  ],
  counseling: [
    "school counselor",
    "college counselor",
    "guidance counselor",
    "naviance",
    "scoir",
    "cialfo",
    "school district",
    "counseling office"
  ],
  scholarships: [
    "scholarship finalist",
    "scholarship award",
    "merit scholarship",
    "competition finalist",
    "national merit",
    "questbridge",
    "coca-cola scholars",
    "gates scholarship"
  ],
  research: [
    "lab",
    "research group",
    "internship",
    "publication announcement",
    "radiation oncology",
    "rad onc",
    "esfahani",
    "stanford bio-x",
    "summer program"
  ]
};

const state = {
  autoScanEnabled: true,
  protectedCategories: ["testing", "counseling", "research"],
  protectedColleges: "",
  customTerms: ""
};

const steps = [
  {
    key: "connect",
    label: "Connect",
    eyebrow: "Step 1 of 6",
    question: "Can MailSift connect to Gmail?",
    helper: "Chrome will show Google's permission screen. After this, users do not need to reconnect unless they disable permission.",
    render: renderConnectStep
  },
  {
    key: "autoScan",
    label: "Auto-scan",
    eyebrow: "Step 2 of 6",
    question: "Should MailSift scan automatically when Gmail opens?",
    helper: "Most users should keep this on. They can still run a manual scan from the popup anytime.",
    render: renderAutoScanStep
  },
  {
    key: "categories",
    label: "Protect",
    eyebrow: "Step 3 of 6",
    question: "What kinds of emails should always stay in the inbox?",
    helper: "Choose the important categories MailSift should protect from filtering.",
    render: renderCategoryStep
  },
  {
    key: "colleges",
    label: "Colleges",
    eyebrow: "Step 4 of 6",
    question: "Are there specific colleges MailSift should never filter?",
    helper: "Add colleges you are applying to, working with, or definitely want to hear from.",
    render: renderCollegeStep
  },
  {
    key: "custom",
    label: "Custom",
    eyebrow: "Step 5 of 6",
    question: "Any other senders or phrases to protect?",
    helper: "This is good for labs, counselor names, programs, research groups, or exact email addresses.",
    render: renderCustomStep
  },
  {
    key: "review",
    label: "Finish",
    eyebrow: "Step 6 of 6",
    question: "Ready to save this setup?",
    helper: "MailSift will use these choices for automatic scans and manual scans.",
    render: renderReviewStep
  }
];

function setMessage(text, type = "") {
  messageNode.textContent = text;
  messageNode.className = type;
}

function setBusy(isBusy) {
  backButton.disabled = isBusy || currentStep === 0;
  nextButton.disabled = isBusy;
  openGmailButton.disabled = isBusy;
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

function splitCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLineList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeTerms(existingTerms = []) {
  const terms = new Set(existingTerms.map((term) => term.trim()).filter(Boolean));

  state.protectedCategories.forEach((category) => {
    (CATEGORY_TERMS[category] || []).forEach((term) => terms.add(term));
  });

  splitCommaList(state.protectedColleges).forEach((name) => terms.add(name));
  splitLineList(state.customTerms).forEach((term) => terms.add(term));

  return Array.from(terms);
}

function renderState(settings) {
  savedSettings = settings;
  gmailConnected = Boolean(settings.connected);
  state.autoScanEnabled = settings.autoScanEnabled !== false;

  if (Array.isArray(settings.protectedTerms) && settings.protectedTerms.length) {
    state.customTerms = settings.protectedTerms.join("\n");
  }

  connectionStatus.textContent = gmailConnected ? "Gmail connected" : "Not connected";
  connectionStatus.style.color = gmailConnected ? "#137333" : "#5f6368";
}

function createChoice({ type = "checkbox", name, value, checked, title, description }) {
  const id = `${name}-${value}`;
  const label = document.createElement("label");
  label.className = "choice";
  label.setAttribute("for", id);
  label.innerHTML = `
    <input id="${id}" type="${type}" name="${name}" value="${value}" ${checked ? "checked" : ""}>
    <span><strong>${title}</strong><span>${description}</span></span>
  `;
  return label;
}

function renderConnectStep() {
  const wrapper = document.createElement("div");
  wrapper.className = "answers";

  const connectButton = document.createElement("button");
  connectButton.type = "button";
  connectButton.className = gmailConnected ? "secondary" : "";
  connectButton.textContent = gmailConnected ? "Gmail is connected" : "Connect Gmail";
  connectButton.disabled = gmailConnected;
  connectButton.addEventListener("click", connectGmail);

  const note = document.createElement("p");
  note.className = "helper";
  note.textContent = gmailConnected
    ? "Permission is saved. You can continue to preferences."
    : "MailSift needs Gmail permission before it can scan or move messages.";

  wrapper.append(connectButton, note);
  stepContent.appendChild(wrapper);
}

function renderAutoScanStep() {
  const wrapper = document.createElement("div");
  wrapper.className = "answers";
  wrapper.append(
    createChoice({
      type: "radio",
      name: "autoScan",
      value: "yes",
      checked: state.autoScanEnabled,
      title: "Yes, scan when Gmail opens",
      description: "Best for most users. MailSift checks recent inbox messages automatically."
    }),
    createChoice({
      type: "radio",
      name: "autoScan",
      value: "no",
      checked: !state.autoScanEnabled,
      title: "No, only scan manually",
      description: "Use this if you only want filtering when you click Scan Inbox Now."
    })
  );
  stepContent.appendChild(wrapper);
}

function renderCategoryStep() {
  const options = [
    ["testing", "Testing and classroom accounts", "College Board, AP Classroom, SAT, ACT, Bluebook, exam alerts."],
    ["applications", "Applications and financial aid", "Common App, FAFSA, CSS Profile, portals, decisions, missing documents."],
    ["counseling", "School and college counseling", "Counselors, districts, Naviance, Scoir, Cialfo."],
    ["scholarships", "Scholarships and competitions", "Awards, finalist notices, competitions, scholarship providers."],
    ["research", "Research, labs, and academic programs", "Labs, internships, publications, research groups, summer programs."]
  ];
  const wrapper = document.createElement("div");
  wrapper.className = "answers";
  options.forEach(([value, title, description]) => {
    wrapper.appendChild(
      createChoice({
        name: "category",
        value,
        checked: state.protectedCategories.includes(value),
        title,
        description
      })
    );
  });
  stepContent.appendChild(wrapper);
}

function renderCollegeStep() {
  const wrapper = document.createElement("div");
  wrapper.className = "field-block";
  wrapper.innerHTML = `
    <input id="collegeNames" type="text" placeholder="Stanford, MIT, University of San Francisco" value="${escapeAttribute(state.protectedColleges)}">
    <div class="hint">Separate names with commas. Leave blank if no specific colleges need protection.</div>
  `;
  stepContent.appendChild(wrapper);
}

function renderCustomStep() {
  const wrapper = document.createElement("div");
  wrapper.className = "field-block";
  wrapper.innerHTML = `
    <textarea id="customTerms" placeholder="esfahani&#10;radiation oncology&#10;my counselor's email">${escapeText(state.customTerms)}</textarea>
    <div class="hint">One per line. Matching emails stay in the inbox.</div>
  `;
  stepContent.appendChild(wrapper);
}

function renderReviewStep() {
  const terms = mergeTerms(savedSettings?.protectedTerms || []);
  const wrapper = document.createElement("div");
  wrapper.className = "review";
  wrapper.innerHTML = `
    <div class="review-row"><strong>Gmail access</strong>${gmailConnected ? "Connected" : "Not connected yet"}</div>
    <div class="review-row"><strong>Auto-scan</strong>${state.autoScanEnabled ? "On when Gmail opens" : "Manual only"}</div>
    <div class="review-row"><strong>Protected categories</strong>${state.protectedCategories.length ? state.protectedCategories.join(", ") : "None selected"}</div>
    <div class="review-row"><strong>Protected terms</strong>${terms.length} total terms saved</div>
  `;
  stepContent.appendChild(wrapper);
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function saveCurrentStepInputs() {
  const step = steps[currentStep];

  if (step.key === "autoScan") {
    state.autoScanEnabled = document.querySelector("input[name='autoScan']:checked")?.value !== "no";
  }

  if (step.key === "categories") {
    state.protectedCategories = Array.from(document.querySelectorAll("input[name='category']:checked")).map(
      (node) => node.value
    );
  }

  if (step.key === "colleges") {
    state.protectedColleges = document.getElementById("collegeNames")?.value || "";
  }

  if (step.key === "custom") {
    state.customTerms = document.getElementById("customTerms")?.value || "";
  }
}

function renderProgress() {
  progressNode.innerHTML = "";
  steps.forEach((step, index) => {
    const item = document.createElement("div");
    item.className = "progress-step";
    if (index === currentStep) item.classList.add("active");
    if (index < currentStep) item.classList.add("done");
    item.innerHTML = `<span class="dot">${index < currentStep ? "✓" : index + 1}</span><span>${step.label}</span>`;
    progressNode.appendChild(item);
  });
}

function renderStep() {
  const step = steps[currentStep];
  renderProgress();
  stepEyebrow.textContent = step.eyebrow;
  stepQuestion.textContent = step.question;
  stepHelper.textContent = step.helper;
  stepContent.innerHTML = "";
  setMessage("");
  step.render();
  backButton.disabled = currentStep === 0;
  nextButton.textContent = currentStep === steps.length - 1 ? "Save setup" : "Next";
  nextButton.className = currentStep === steps.length - 1 ? "secondary" : "";
}

async function connectGmail() {
  try {
    setBusy(true);
    setMessage("Opening Google permission prompt...");
    const response = await sendMessage({ action: "connectGmail" });
    renderState(response.settings);
    setMessage("Gmail connected. You can continue.", "success");
    renderStep();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function saveSetup() {
  if (!gmailConnected) {
    setMessage("Connect Gmail before saving setup.", "error");
    currentStep = 0;
    renderStep();
    return;
  }

  try {
    setBusy(true);
    setMessage("Saving setup...");
    const protectedTerms = mergeTerms(savedSettings?.protectedTerms || []);
    const response = await sendMessage({
      action: "saveSettings",
      settings: {
        protectedTerms,
        autoScanEnabled: state.autoScanEnabled,
        onboardingComplete: true,
        onboardingCompletedAt: new Date().toISOString()
      }
    });
    renderState(response.settings);
    setMessage("Setup saved. MailSift will use these preferences from now on.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

backButton.addEventListener("click", () => {
  saveCurrentStepInputs();
  currentStep = Math.max(0, currentStep - 1);
  renderStep();
});

nextButton.addEventListener("click", async () => {
  saveCurrentStepInputs();
  if (currentStep === steps.length - 1) {
    await saveSetup();
    return;
  }
  currentStep += 1;
  renderStep();
});

openGmailButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://mail.google.com/" });
});

async function init() {
  const response = await sendMessage({ action: "getState" });
  renderState(response.settings);
  renderStep();
}

init().catch((error) => {
  setMessage(error.message, "error");
  renderStep();
});

