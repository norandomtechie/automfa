// content.js
let lastRightClickedElement = null;
let observer = null;
let bypassInProgress = false;

// Track the element that was right-clicked to trigger the context menu
document.addEventListener("contextmenu", (event) => {
  lastRightClickedElement = event.target;
}, true);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_BYPASS") {
    startAutoBypass(request.token);
  } else if (request.action === "PASTE_TO_TEXTBOX") {
    pasteToSelectedElement(request.token);
  }
});

function pasteToSelectedElement(token) {
  let target = lastRightClickedElement;
  if (!target || !(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    target = document.activeElement;
  }

  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    target.focus();
    if (target.isContentEditable) {
      target.innerText = token;
    } else {
      target.value = token;
    }

    ['input', 'change', 'blur'].forEach(ev =>
      target.dispatchEvent(new Event(ev, { bubbles: true }))
    );
  }
}

function simulateMouseClick(element) {
  const mouseClickEvents = ['mousedown', 'click', 'mouseup'];
  mouseClickEvents.forEach(type => {
    const event = new MouseEvent(type, {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });
    element.dispatchEvent(event);
  });
}

function attemptBypass(token) {
  const findByText = (text) => {
    const lowerText = text.toLowerCase();
    return document.evaluate(
      `//*[not(self::script) and not(self::style) and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${lowerText}")]`,
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
  };

  // Try finding different stages of the Microsoft authentication flow
  const step1a = findByText("can't use my Microsoft Authenticator");
  const step1b = findByText("Sign in another way");
  const step1c = findByText("Having trouble?");

  const step2a = findByText("Use a verification code");
  const step2b = findByText("Verification code from my mobile app");

  const input = document.querySelector(
    'input[name="otcc"], ' +
    'input[name="otc"], ' +
    'input[type="tel"], ' +
    'input[id*="OTC"], ' +
    'input[id*="otc"], ' +
    'input[autocomplete="one-time-code"], ' +
    '#idTxtPx_SAOTCC_OTC'
  );

  if (step1a || step1b || step1c) {
    bypassInProgress = true;
    const clickTarget = step1a || step1b || step1c;
    console.log("AutoMFA: Found authentication method selector. Waiting 2 seconds for page to settle...");
    setTimeout(() => {
      simulateMouseClick(clickTarget);
      setTimeout(() => { 
        bypassInProgress = false; 
        attemptBypass(token); // Force recheck right after unlocking to prevent observer race condition
      }, 600);
    }, 2000);
    return false; // Still running (need verification code next)
  } 
  
  if (step2a || step2b) {
    bypassInProgress = true;
    const clickTarget = step2a || step2b;
    console.log("AutoMFA: Found verification code option. Waiting 2 seconds for page to settle...");
    setTimeout(() => {
      simulateMouseClick(clickTarget);
      setTimeout(() => { 
        bypassInProgress = false; 
        attemptBypass(token); // Force recheck right after unlocking to prevent observer race condition
      }, 600);
    }, 2000);
    return false; // Still running (need to wait for code box to appear)
  } 
  
  if (input) {
    bypassInProgress = true;
    console.log("AutoMFA: Target verification code input found! Pasting token...");
    input.focus();
    input.value = token;
    
    ['input', 'change', 'blur'].forEach(ev => 
      input.dispatchEvent(new Event(ev, { bubbles: true }))
    );
    
    setTimeout(() => {
        const btn = document.querySelector('input[type="submit"], #idSubmit_SAOTCC_Continue, #idSubmit_SAOTCC_OTC');
        if (btn) {
          console.log("AutoMFA: Clicking submit button...");
          simulateMouseClick(btn);
        }
        bypassInProgress = false;
    }, 400);
    
    return true; // Successfully filled and submitted code, automation completed!
  }

  return false; // Target elements not found yet
}

function startAutoBypass(token) {
  if (!token) return;

  // Run immediately in case login page elements are already loaded in DOM
  const success = attemptBypass(token);
  if (success) return;

  // Set up MutationObserver to watch for dynamic DOM updates (single page apps)
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    if (bypassInProgress) return;
    const completed = attemptBypass(token);
    if (completed) {
      observer.disconnect();
      observer = null;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// AUTOMATIC TRIGGER: Instantly request secret and start bypass on page load
chrome.runtime.sendMessage({ action: "GET_AUTO_TOKEN" }, (response) => {
  if (response && response.token) {
    console.log("AutoMFA: Automatic 2FA Bypass initiated...");
    startAutoBypass(response.token);
  } else {
    console.log("AutoMFA: No active credential key configured or disclaimer pending. Auto-bypass skipped.");
  }
});