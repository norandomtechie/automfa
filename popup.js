const STORAGE_KEY = 'purdue_secret';
const DISCLAIMER_KEY = 'automfa_disclaimer_accepted';
const TUTORIAL_KEY = 'automfa_tutorial_completed';

// Base32 validation check (case-insensitive, allows letters A-Z/a-z and numbers 2-7)
function isValidBase32(str) {
    const cleaned = str.replace(/\s+/g, '').replace(/=+$/, '');
    if (cleaned.length === 0) return false;
    return /^[A-Z2-7]+=*$/i.test(cleaned);
}

// Helper to generate TOTP code
async function generateTOTP(secret) {
    try {
        const cleaned = secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
        if (!cleaned) return '------';

        const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let bytes = [];

        for (let i = 0; i < cleaned.length; i++) {
            const v = alpha.indexOf(cleaned[i]);
            if (v >= 0) {
                bits += v.toString(2).padStart(5, '0');
            } else {
                return 'ERROR';
            }
        }

        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substr(i, 8), 2));
        }

        if (bytes.length === 0) return '------';

        const t = Math.floor(Date.now() / 30000);
        const msg = new ArrayBuffer(8);
        new DataView(msg).setUint32(4, t);

        const key = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(bytes),
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
        const o = h[19] % 16;
        const view = new DataView(h.buffer, o, 4);
        const code = (view.getUint32(0) % 2147483648) % 1000000;
        return code.toString().padStart(6, '0');
    } catch (err) {
        console.error('TOTP Generation Error:', err);
        return 'ERROR';
    }
}

// Map the views to their DOM elements
const views = {
    disclaimer: document.getElementById('disclaimer-view'),
    step1: document.getElementById('step-1-view'),
    step2: document.getElementById('step-2-view'),
    step3: document.getElementById('step-3-view'),
    main: document.getElementById('main-view')
};

function showView(activeViewName) {
    Object.keys(views).forEach(key => {
        if (key === activeViewName) {
            views[key].classList.remove('hidden');
        } else {
            views[key].classList.add('hidden');
        }
    });
}

// Active Timer Management
let timerInterval = null;

function startTimer(secret) {
    if (timerInterval) clearInterval(timerInterval);

    const timerBar = document.getElementById('timer-bar');
    const timerText = document.getElementById('timer-text');
    const codeDisplay = document.getElementById('code');

    async function updateDisplay() {
        const now = Date.now();
        const secondsRemaining = 30 - ((Math.floor(now / 1000)) % 30);
        const msRemaining = 30000 - (now % 30000);
        const percentage = (msRemaining / 30000) * 100;

        timerBar.style.width = `${percentage}%`;

        if (secondsRemaining <= 5) {
            timerBar.classList.add('danger');
        } else {
            timerBar.classList.remove('danger');
        }

        timerText.innerText = `Code updates in ${secondsRemaining}s`;

        const code = await generateTOTP(secret);
        if (codeDisplay.innerText !== code && code !== 'COPIED') {
            codeDisplay.innerText = code;
        }
    }

    updateDisplay();
    timerInterval = setInterval(updateDisplay, 200);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Main View Manager Loader
async function init() {
    stopTimer();
    const data = await chrome.storage.local.get([DISCLAIMER_KEY, STORAGE_KEY, TUTORIAL_KEY, 'automfa_auto_bypass_enabled']);

    const isDisclaimerAccepted = data[DISCLAIMER_KEY];
    const secret = data[STORAGE_KEY];
    const isTutorialCompleted = data[TUTORIAL_KEY];

    // Sync checkboxes
    const autoEnabled = data.automfa_auto_bypass_enabled !== false;
    document.getElementById('toggle-auto-bypass-setup').checked = autoEnabled;
    document.getElementById('toggle-auto-bypass-active').checked = autoEnabled;

    if (!isDisclaimerAccepted) {
        showView('disclaimer');
    } else if (!secret) {
        // If they have accepted disclaimer but have no secret key, start them at Step 1 instructions
        showView('step1');
    } else if (!isTutorialCompleted) {
        // If they entered a secret key but haven't viewed the final instructions, show Step 3
        showView('step3');
    } else {
        // Fully active TOTP generator view
        showView('main');
        startTimer(secret);
    }
}

// Clipboard copying Feedback
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

// --- BUTTON NAVIGATION CLICK HANDLERS ---

// Disclaimer Accept
document.getElementById('accept-disclaimer-btn').onclick = async () => {
    await chrome.storage.local.set({ [DISCLAIMER_KEY]: true });
    init();
};

// Step 1: Back to Disclaimer
document.getElementById('step1-back-btn').onclick = async () => {
    await chrome.storage.local.remove([DISCLAIMER_KEY]);
    init();
};

// Step 1: Next to Step 2 Input
document.getElementById('step1-next-btn').onclick = () => {
    showView('step2');
};

// Step 2: Back to Step 1 Instructions
document.getElementById('step2-back-btn').onclick = () => {
    showView('step1');
};

// Step 2: Next to Step 3 Automation info (and Save Secret)
document.getElementById('step2-next-btn').onclick = async () => {
    const secretInput = document.getElementById('secret').value;
    const errorMsg = document.getElementById('setup-error');

    if (!isValidBase32(secretInput)) {
        errorMsg.style.display = 'block';
        return;
    }

    errorMsg.style.display = 'none';
    const secret = secretInput.replace(/\s+/g, '');
    await chrome.storage.local.set({ [STORAGE_KEY]: secret });

    // Switch to step 3 info
    showView('step3');
};

// Step 3: Back to Step 2 Input
document.getElementById('step3-back-btn').onclick = () => {
    showView('step2');
};

// Step 3: Finish and Activate TOTP Generator
document.getElementById('step3-finish-btn').onclick = async () => {
    await chrome.storage.local.set({ [TUTORIAL_KEY]: true });
    init();
};

// Main View: Clipboard copy
document.getElementById('code').onclick = () => {
    const codeDisplay = document.getElementById('code');
    const currentCode = codeDisplay.innerText;

    if (currentCode === '------' || currentCode === 'ERROR') return;

    navigator.clipboard.writeText(currentCode).then(() => {
        showToast('📋 Code copied to clipboard!');

        codeDisplay.innerText = 'COPIED';
        setTimeout(() => {
            codeDisplay.innerText = currentCode;
        }, 1000);
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
    });
};

// Main View: Clear stored secret keys (Reset)
document.getElementById('reset-btn').onclick = async () => {
    if (confirm('Are you sure you want to reset your secret key? This will clear all stored credentials.')) {
        stopTimer();
        // Clear all fields and settings
        await chrome.storage.local.remove([STORAGE_KEY, TUTORIAL_KEY, DISCLAIMER_KEY]);
        document.getElementById('secret').value = '';
        init();
    }
};

// Sync checkbox states and update storage
document.getElementById('toggle-auto-bypass-setup').onchange = async (event) => {
    const enabled = event.target.checked;
    document.getElementById('toggle-auto-bypass-active').checked = enabled;
    await chrome.storage.local.set({ automfa_auto_bypass_enabled: enabled });
};

document.getElementById('toggle-auto-bypass-active').onchange = async (event) => {
    const enabled = event.target.checked;
    document.getElementById('toggle-auto-bypass-setup').checked = enabled;
    await chrome.storage.local.set({ automfa_auto_bypass_enabled: enabled });
};

// Launch extension
init();