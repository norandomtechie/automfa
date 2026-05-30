// background.js
const STORAGE_KEY = 'purdue_secret';
const DISCLAIMER_KEY = 'automfa_disclaimer_accepted';

// Helper to generate TOTP in the background
async function getCode() {
    const disclaimer = await chrome.storage.local.get(DISCLAIMER_KEY);
    if (!disclaimer[DISCLAIMER_KEY]) {
        console.warn("AutoMFA: Disclaimer has not been accepted yet. Action blocked.");
        return null;
    }

    const data = await chrome.storage.local.get(STORAGE_KEY);
    const secret = data[STORAGE_KEY];
    if (!secret) return null;
    
    // Minimal and robust TOTP logic for background
    const cleaned = secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
    if (!cleaned) return null;

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '', bytes = [];
    for (let i = 0; i < cleaned.length; i++) {
        const v = alpha.indexOf(cleaned[i]);
        if (v >= 0) {
            bits += v.toString(2).padStart(5, '0');
        } else {
            return null; // Invalid secret character
        }
    }
    
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
    }

    if (bytes.length === 0) return null;

    const t = Math.floor(Date.now() / 30000);
    const msg = new ArrayBuffer(8);
    new DataView(msg).setUint32(4, t);
    
    const key = await crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
    const o = h[19] % 16;
    const view = new DataView(h.buffer, o, 4);
    const code = (view.getUint32(0) % 2147483648) % 1000000;
    return code.toString().padStart(6, '0');
}

// Create Right-Click Menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const token = await getCode();
  if (!token || !tab || !tab.id) return;

  if (info.menuItemId === "automfa-paste") {
    chrome.tabs.sendMessage(tab.id, { action: "START_BYPASS", token: token }).catch(err => {
      console.log("AutoMFA: Message not received. Content script not present/loaded yet on this tab:", err.message);
    });
  } else if (info.menuItemId === "automfa-paste-textbox") {
    chrome.tabs.sendMessage(tab.id, { action: "PASTE_TO_TEXTBOX", token: token }).catch(err => {
      console.log("AutoMFA: Message not received. Content script not present/loaded yet on this tab:", err.message);
    });
  }
});

// Create menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ 
        id: "automfa-paste", 
        title: "AutoMFA: Autofill Microsoft Login", 
        contexts: ["all"] 
    });
    chrome.contextMenus.create({ 
        id: "automfa-paste-textbox", 
        title: "AutoMFA: Paste into selected textbox", 
        contexts: ["editable"] 
    });
});

// Listen for automatic token requests from content script on page load
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_AUTO_TOKEN") {
    chrome.storage.local.get(["automfa_auto_bypass_enabled", DISCLAIMER_KEY, STORAGE_KEY]).then(data => {
      const autoEnabled = data.automfa_auto_bypass_enabled !== false; // Default to true if unset
      if (!autoEnabled || !data[DISCLAIMER_KEY] || !data[STORAGE_KEY]) {
        sendResponse({ token: null });
        return;
      }
      getCode().then(token => {
        sendResponse({ token: token });
      }).catch(err => {
        console.error("AutoMFA: error calculating auto token:", err);
        sendResponse({ token: null });
      });
    });
    return true; // Keep message channel open for asynchronous sendResponse
  }
});