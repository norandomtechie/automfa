# Privacy Policy for AutoMFA

**Last Updated:** August 25, 2026

AutoMFA ("the Extension") is an open-source browser extension designed to generate and automatically fill Multi-Factor Authentication (MFA / TOTP) verification codes during login workflows.

This Privacy Policy explains how AutoMFA handles your information. 

---

## 1. Summary (Zero Data Collection)

* **No Data Collection:** AutoMFA does not collect, log, track, or transmit any personally identifiable information (PII) or authentication credentials to external servers.
* **Local Processing:** All MFA secrets, configuration settings, and generated one-time tokens are processed and stored strictly on your local device.
* **No Analytics or Telemetry:** The Extension contains no third-party tracking scripts, analytics libraries, advertising trackers, or telemetry beacons.

---

## 2. Information Handled by the Extension

### A. Authentication Secrets & Keys
To generate MFA codes, AutoMFA stores the secret keys / seed tokens provided by the user. 
* **Storage Location:** Stored exclusively in your browser's local sandbox using the `chrome.storage.local` API (or encrypted local storage).
* **Transmission:** Secret keys and generated tokens are **never** transmitted over the internet, synced to external servers, or accessible to the extension developers.

### B. Webpage Interaction & Form Autofill
AutoMFA uses content scripts solely to detect MFA/TOTP input fields on supported authentication pages and autofill the generated one-time code.
* The Extension does **not** read, log, or store passwords, usernames, browsing history, or form contents outside the targeted MFA input fields.
* The Extension does **not** inspect or alter network traffic.

---

## 3. Permissions Used and Justification

In compliance with the Chrome Web Store Minimum Permissions policy, AutoMFA only requests permissions strictly necessary for its functionality:

| Permission | Purpose |
| :--- | :--- |
| `storage` | To store MFA secret keys and user preferences locally on your machine. |
| `activeTab` / Host Permissions | To identify MFA token entry fields on authentication pages and inject the generated verification code. |

---

## 4. Google Chrome Web Store "Limited Use" Disclosure

AutoMFA adheres strictly to the [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/), including the User Data FAQ:

1. **No Sale of Data:** AutoMFA does not sell, rent, or monetize user data to third parties under any circumstances.
2. **No Data Transfers:** User data is not transferred or disclosed to third parties, except as strictly required to execute local functionality (which operates 100% offline).
3. **No Creditworthiness or Lending:** User data is not used or transferred for assessing creditworthiness or lending purposes.
4. **No Advertising:** User data is not used or transferred to serve targeted ads or build advertising profiles.

---

## 5. Data Retention and Deletion

Because all data resides exclusively in your browser's local storage:
* You can remove individual secret keys at any time through the Extension's popup / options interface.
* Clearing your browser cache/extension storage or **uninstalling AutoMFA will permanently delete all stored secrets and configurations** from your machine immediately.

---

## 6. Open Source & Verifiability

AutoMFA is open source. You can inspect the source code and verify our privacy practices directly on GitHub:
[https://github.com/norandomtechie/automfa](https://github.com/norandomtechie/automfa)

---

## 7. Changes to This Privacy Policy

If any functionality changes require an update to this policy, revisions will be posted directly to the project's repository. Continued use of the Extension after changes are posted constitutes acceptance of the updated policy.

---

## 8. Contact

If you have questions, feedback, or concerns regarding this Privacy Policy, please open an issue in the official GitHub repository:
* **Repository:** [https://github.com/norandomtechie/automfa/issues](https://github.com/norandomtechie/automfa/issues)
