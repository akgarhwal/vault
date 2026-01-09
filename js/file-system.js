
import { DB } from './db.js';

/**
 * Handles direct file system access for "Save As" and "Open" functionality.
 * Uses the modern File System Access API.
 */
export const FileSystem = {
    /**
     * Checks if the File System Access API is supported.
     * @returns {boolean}
     */
    isSupported() {
        return 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
    },

    /**
     * Saves data to a file selected by the user.
     * @param {string} content - JSON string to save
     * @param {string} suggestedName - Default filename
     */
    async saveToDisk(content, suggestedName = 'vault.json') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'Vault JSON File',
                    accept: { 'application/json': ['.json'] },
                }],
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            // Save handle for future use
            await DB.set('vault_handle', handle);

            return { success: true, handle: handle };
        } catch (err) {
            // User cancelled or error
            if (err.name !== 'AbortError') {
                console.error('Save failed:', err);
                throw err;
            }
            return { success: false };
        }
    },

    /**
     * Opens a file selected by the user, returns content, and saves handle.
     * @returns {Promise<{content: string, name: string, handle: FileSystemFileHandle}|null>}
     */
    async loadFromDisk() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Vault JSON File',
                    accept: { 'application/json': ['.json'] },
                }],
                multiple: false
            });

            const file = await handle.getFile();
            const content = await file.text();

            // Save handle
            await DB.set('vault_handle', handle);

            return { content, name: file.name, handle };
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Open failed:', err);
                throw err;
            }
            return null;
        }
    },

    /**
     * Retrieves the stored handle from IndexedDB.
     */
    async getStoredHandle() {
        return await DB.get('vault_handle');
    },

    /**
     * Verifies if the user has granted permission to read/write.
     * If not, it requests it.
     */
    async verifyPermission(handle, withWrite = false) {
        const opts = {};
        if (withWrite) {
            opts.mode = 'readwrite';
        }

        // Check if permission was already granted.
        if ((await handle.queryPermission(opts)) === 'granted') {
            return true;
        }

        // Request permission. If the user grants permission, return true.
        if ((await handle.requestPermission(opts)) === 'granted') {
            return true;
        }

        // The user didn't grant permission, so return false.
        return false;
    },

    /**
     * Writes directly to a handle.
     */
    async writeToFile(handle, content) {
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }
};
