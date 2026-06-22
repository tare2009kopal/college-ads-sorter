// background.js - BUILT-IN CHROME AI VERSION (No Servers, No Keys)

const SYSTEM_PROMPT = `
You are an email classification engine. You must evaluate the email metrics and output a single word answer: JUNK or KEEP.

Return KEEP if the email is from official high school, testing, or college-application systems like Common App, College Board, ACT, SAT, Scoir, Naviance, FAFSA, CSS Profile, school district systems, or applicant portals.
Return KEEP if it contains terms like Admission Decision, Application Received, Interview Scheduled, Portal Login, Verification, Missing Documents, Financial Aid, or Deadline Reminder.
Return KEEP if it is a personal 1-to-1 thread with a real human admissions officer or counselor.

Return JUNK if it is a generic mass-marketing blast, promotional brochure, campus newsletter, virtual tour invitation, webinar invitation, open house advertisement, or broad college advertising email.

Output exactly one word: JUNK or KEEP. Do not include punctuation or explanations.
`.trim();

async function classifyEmail(email) {
  // Check if Chrome's built-in AI language model is available
  const capabilities = await ai.languageModel.capabilities();
  if (capabilities.available === "no") {
    throw new Error("Chrome built-in AI is not enabled or supported on this browser.");
  }

  // Create a localized session with Gemini Nano inside the browser
  const session = await ai.languageModel.create({
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0
  });

  const promptText = `Sender: ${email.sender}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`;
  const rawResponse = await session.prompt(promptText);
  
  // Clean up the text response
  const normalized = rawResponse.trim().toUpperCase();
  session.destroy(); // Free up memory on the user's computer

  return {
    classification: normalized.includes("JUNK") ? "JUNK" : "KEEP",
    reason: "Processed locally via browser Gemini Nano."
  };
}

// Listen for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CLASSIFY_EMAIL") return false;

  classifyEmail(message.payload)
    .then(sendResponse)
    .catch((error) => {
      console.error("Local AI Error:", error);
      sendResponse({
        classification: "KEEP",
        reason: "Local AI failed; defaulted to KEEP for safety."
      });
    });

  return true;
});

// background.js - Lifecycle Listener for Onboarding

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // Automatically open the welcome.html page in a new browser tab upon installation
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html")
    });
  }
});