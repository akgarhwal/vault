# [Vault](https://akgarhwal.github.io/vault/) (Secure Password Manager)

A simple, secure, and modern Password Manager built with **Vanilla JavaScript, HTML, and CSS**. No frameworks, no trackers, just pure web technologies.

## 🔒 Features

-   **Client-Side Encryption**: Uses **Web Crypto API** (AES-GCM & PBKDF2) to encrypt your data before it is saved. Your master password never leaves your browser.
-   **Local Storage**: Data is persisted in your browser's `localStorage`.
-   **Modern UI**: Glassmorphism design, Dark Mode, and 3D Flip interactions for Credit Cards.
-   **Rich Credit Cards**: Visual representation of cards (Visa/Mastercard styling), copy to clipboard, and flip to reveal CVV.
-   **Import/Export**: Backup your encrypted vault to JSON and restore it on any device.
-   **Auto-Lock**: Automatically locks the vault after 120 seconds of inactivity.

## 🚀 How to Run Locally

Because this project uses **ES Modules** and **Web Crypto API**, it must be served over `http://` or `https://`. File protocol (`file://`) will **not** work.

### Using Python (Mac/Linux/Windows)
If you have Python installed:

```bash
# 1. Navigate to the project folder
cd "Password Manager"

# 2. Start a simple server
python3 -m http.server 8080

# 3. Open in browser
http://localhost:8080
```

### Using VS Code
1.  Install the **Live Server** extension.
2.  Right-click `index.html` and select **Open with Live Server**.


## ⚠️ Security Notice

-   **Zero Knowledge**: We cannot recover your Master Password. If you lose it, your data is lost forever.
-   **Browser Storage**: Clearing your browser cache/storage **will delete your vault**. Please use the **Export** feature regularly to backup your data.
-   **Context**: This is a client-side web tool. Ensure you use it on a secure, malware-free device.
