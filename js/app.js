import * as Crypto from './crypto.js';
import { Storage } from './storage.js';
import { UI } from './ui.js';

// State
let STATE = {
    key: null, // CryptoKey
    items: [], // Decrypted items in memory
    isNewUser: false
};

// Initialization
async function init() {
    const meta = Storage.getMeta();
    if (!meta) {
        STATE.isNewUser = true;
        UI.authView.querySelector('h1').textContent = 'Create Vault';
        UI.authView.querySelector('p').textContent = 'Set a master password to secure your data.';

        const warningEl = UI.authView.querySelector('.small-text') || UI.authView.querySelector('.funny-warning');
        warningEl.className = 'funny-warning';
        warningEl.textContent = 'Tattoo this on your brain! If you lose it, your data becomes digital confetti. Unrecoverable, sad confetti. 🎊➡️🗑️😭';

        UI.unlockBtn.textContent = 'Create Vault';
    } else {
        STATE.isNewUser = false;
        UI.authView.querySelector('h1').textContent = 'Unlock Vault';
        UI.authView.querySelector('p').textContent = 'Enter your master password to access your secure data.';
        UI.authView.querySelector('.small-text').textContent = ''; // Hide "First time?" text
        UI.unlockBtn.textContent = 'Unlock';
    }

    setupEventListeners();
    setupAutoLock();
}

function setupAutoLock() {
    let timeout;
    const INACTIVITY_LIMIT = 120 * 1000; // 120 seconds

    function resetTimer() {
        clearTimeout(timeout);
        // Only potential lock if we have a key (are logged in)
        if (STATE.key) {
            timeout = setTimeout(() => {
                console.log('Auto-locking due to inactivity');
                lockVault();
            }, INACTIVITY_LIMIT);
        }
    }

    // Listerners for activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
}

function lockVault() {
    STATE.key = null;
    STATE.items = [];
    UI.showView('auth');
    UI.masterPasswordInput.value = '';
    UI.authError.classList.add('hidden');
    UI.unlockBtn.disabled = false;
    UI.unlockBtn.textContent = 'Unlock';
}

function setupEventListeners() {
    // Auth
    UI.unlockBtn.addEventListener('click', handleAuth);
    UI.masterPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAuth();
    });

    // Dashboard
    UI.lockBtn.addEventListener('click', () => location.reload()); // Simple lock -> Changed to use lockVault for consistency? 
    // Actually location.reload() is safer as it clears memory completely. 
    // But auto-lock might want to just show auth screen. 
    // Let's keep lockBtn as reload for now, or unified.
    // Let's unify:
    UI.lockBtn.addEventListener('click', lockVault);

    UI.addItemBtn.addEventListener('click', openAddItemModal);
    UI.addItemBtn.addEventListener('click', openAddItemModal);

    // Modal
    UI.cancelModalBtn.addEventListener('click', () => UI.hide(UI.itemModal));
    UI.itemForm.addEventListener('submit', handleSaveItem);

    // Type Toggle
    const typeSelect = document.getElementById('item-type');
    typeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type === 'password') {
            document.getElementById('password-fields').classList.remove('hidden');
            document.getElementById('card-fields').classList.add('hidden');
        } else {
            document.getElementById('password-fields').classList.add('hidden');
            document.getElementById('card-fields').classList.remove('hidden');
        }
    });

    // Visibility Toggle
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wrapper = e.target.parentElement;
            const input = wrapper.querySelector('input');
            if (input.type === 'password') {
                input.type = 'text';
                e.target.textContent = '🙈';
            } else {
                input.type = 'password';
                e.target.textContent = '👁️';
            }
        });
    });

    // Generate Password
    const genBtn = document.getElementById('generate-password-btn');
    if (genBtn) {
        genBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const password = Crypto.generateCustomPassword();
            const input = document.getElementById('item-password');
            input.value = password;

            // Show password
            input.type = 'text';
            const wrapper = input.parentElement;
            const toggle = wrapper.querySelector('.toggle-visibility');
            if (toggle) toggle.textContent = '🙈';
        });
    }

    // Filter
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderFilteredItems(e.target.dataset.filter);
        });
    });

    // Search
    UI.searchInput.addEventListener('input', (e) => renderFilteredItems('all', e.target.value));

    // Export
    UI.exportBtn.addEventListener('click', handleExport);

    // Import
    UI.importBtn.addEventListener('click', () => UI.show(UI.importModal));
    UI.cancelImportBtn.addEventListener('click', () => UI.hide(UI.importModal));
    UI.confirmImportBtn.addEventListener('click', handleImport);
}

// Auth Handler
async function handleAuth() {
    const password = UI.masterPasswordInput.value;
    if (!password) return;

    UI.authError.classList.add('hidden');
    UI.unlockBtn.disabled = true;
    UI.unlockBtn.textContent = 'Processing...';

    try {
        if (STATE.isNewUser) {
            // Create New Vault
            const salt = Crypto.getRandomValues(16);
            const key = await Crypto.deriveKey(password, salt);

            // Create Validation Token
            const validation = await Crypto.encrypt('VALID', key);

            // Save Meta
            Storage.setMeta({
                salt: Crypto.bufferToBase64(salt),
                validation: {
                    ciphertext: Crypto.bufferToBase64(validation.ciphertext),
                    iv: Crypto.bufferToBase64(validation.iv)
                }
            });

            STATE.key = key;
            enterDashboard();
        } else {
            // Unlock Existing
            const meta = Storage.getMeta();
            const salt = Crypto.base64ToBuffer(meta.salt);
            const key = await Crypto.deriveKey(password, salt);

            // Validate
            try {
                const valParams = meta.validation;
                const decrypted = await Crypto.decrypt(
                    Crypto.base64ToBuffer(valParams.ciphertext),
                    Crypto.base64ToBuffer(valParams.iv),
                    key
                );

                if (decrypted === 'VALID') {
                    STATE.key = key;
                    await loadItems();
                    enterDashboard();
                } else {
                    throw new Error('Invalid');
                }
            } catch (e) {
                console.error(e);
                UI.authError.textContent = 'Incorrect password.';
                UI.authError.classList.remove('hidden');
                UI.unlockBtn.disabled = false;
                UI.unlockBtn.textContent = 'Unlock';
            }
        }
    } catch (e) {
        console.error(e);
        UI.authError.textContent = 'An error occurred.';
        UI.authError.classList.remove('hidden');
    }
}

function enterDashboard() {
    UI.showView('dashboard');
    renderFilteredItems('all');
}

// Data Logic
async function loadItems() {
    const encryptedItems = Storage.getItems();
    STATE.items = [];

    for (const item of encryptedItems) {
        try {
            const dataStr = await Crypto.decrypt(
                Crypto.base64ToBuffer(item.data.ciphertext),
                Crypto.base64ToBuffer(item.data.iv),
                STATE.key
            );
            const data = JSON.parse(dataStr);
            STATE.items.push({
                id: item.id,
                ...data
            });
        } catch (e) {
            console.error('Failed to decrypt item', item.id);
        }
    }
}

function renderFilteredItems(filter, searchQuery = '') {
    let items = STATE.items;

    if (filter !== 'all') {
        const activeFilter = document.querySelector('.nav-item.active').dataset.filter;
        if (activeFilter !== 'all') {
            items = items.filter(i => i.type === activeFilter);
        }
    } else {
        // If called from search, respect current tab
        const activeFilter = document.querySelector('.nav-item.active').dataset.filter;
        if (activeFilter !== 'all') {
            items = items.filter(i => i.type === activeFilter);
        }
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(q));
    }

    UI.renderItems(items, null, openEditModal, null);
}

// CRUD
function openAddItemModal() {
    UI.itemForm.reset();
    document.getElementById('item-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Item';

    // Auto-select type based on current filter
    const activeFilter = document.querySelector('.nav-item.active').dataset.filter;
    const typeSelect = document.getElementById('item-type');

    if (activeFilter === 'card') {
        typeSelect.value = 'card';
    } else {
        typeSelect.value = 'password';
    }

    // Force UI sync (Show/Hide fields)
    const evt = new Event('change');
    typeSelect.dispatchEvent(evt);

    UI.show(UI.itemModal);
}

function openEditModal(item) {
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-type').value = item.type;
    document.getElementById('item-name').value = item.name;
    document.getElementById('modal-title').textContent = 'Edit Item';

    // Trigger change to show correct fields
    const evt = new Event('change');
    document.getElementById('item-type').dispatchEvent(evt);

    if (item.type === 'password') {
        document.getElementById('item-username').value = item.username || '';
        document.getElementById('item-password').value = item.password || '';
        document.getElementById('item-url').value = item.url || '';
    } else {
        document.getElementById('card-holder').value = item.cardHolder || '';
        document.getElementById('card-number').value = item.cardNumber || '';
        document.getElementById('card-expiry').value = item.cardExpiry || '';
        document.getElementById('card-cvv').value = item.cardCvv || '';
    }

    UI.show(UI.itemModal);
}

async function handleSaveItem(e) {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const type = document.getElementById('item-type').value;
    const name = document.getElementById('item-name').value;

    let data = { type, name, updatedAt: Date.now() };

    if (type === 'password') {
        data.username = document.getElementById('item-username').value;
        data.password = document.getElementById('item-password').value;
        data.url = document.getElementById('item-url').value;
    } else {
        data.cardHolder = document.getElementById('card-holder').value;
        data.cardNumber = document.getElementById('card-number').value;
        data.cardExpiry = document.getElementById('card-expiry').value;
        data.cardCvv = document.getElementById('card-cvv').value;
    }

    // Encrypt
    const jsonStr = JSON.stringify(data);
    const encrypted = await Crypto.encrypt(jsonStr, STATE.key);

    const encryptedItem = {
        id: id || crypto.randomUUID(),
        data: {
            ciphertext: Crypto.bufferToBase64(encrypted.ciphertext),
            iv: Crypto.bufferToBase64(encrypted.iv)
        }
    };

    // Update Memory
    if (id) {
        // Edit
        const index = STATE.items.findIndex(i => i.id === id);
        if (index !== -1) STATE.items[index] = { id, ...data };

        // Update Storage
        const storedItems = Storage.getItems();
        const storedIndex = storedItems.findIndex(i => i.id === id);
        if (storedIndex !== -1) storedItems[storedIndex] = encryptedItem;
        Storage.saveItems(storedItems);

    } else {
        // Create
        STATE.items.push({ id: encryptedItem.id, ...data });

        // Update Storage
        const storedItems = Storage.getItems();
        storedItems.push(encryptedItem);
        Storage.saveItems(storedItems);
    }

    UI.hide(UI.itemModal);
    renderFilteredItems('all');
}

// Import/Export
function handleExport() {
    const meta = Storage.getMeta();
    const items = Storage.getItems();

    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        meta: meta,
        items: items
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleImport() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!json.meta || !json.items) throw new Error('Invalid Format');

            // Merge Logic: Actually for security complexity in vanilla JS, 
            // replacing is safer to ensure keys match. Merging encrypted data 
            // from different keys is impossible without decryption first.
            // So we will assume the Import replaces the vault IF the user confirms,
            // OR we assume the import is from receiving same vault data.

            // Current simple implementation: REPLACE
            // Ideally we should try to decrypt the imported meta with CURRENT key. 
            // If fails, it's a different vault -> Ask to replace?

            // For now: Replace everything.
            if (confirm('This will replace your current vault. Are you sure?')) {
                Storage.setMeta(json.meta);
                Storage.saveItems(json.items);
                location.reload();
            }

        } catch (err) {
            alert('Failed to import file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Start
init();
