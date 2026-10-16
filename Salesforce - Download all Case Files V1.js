// ==UserScript==
// @name         Salesforce - Download All Case Files (Standalone, Service Cloud Premium style)
// @namespace    https://planview.lightning.force.com/
// @version      2026.10.05
// @description  Download all Salesforce Case Files/Attachments as a ZIP
// @match        https://planview.lightning.force.com/*
// @match        https://planview--trident.lightning.force.com/*
// @match        https://planview--trident.sandbox.lightning.force.com/*
// @match        https://planview--partialsb.lightning.force.com/*
// @match        https://planview--partialsb.sandbox.lightning.force.com/*
// @match        https://planview--bizappspro.sandbox.lightning.force.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      file.force.com
// @connect      lightning.force.com
// @connect      my.salesforce.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /*
     * Tampermonkey sandboxes this script because of @grant GM_xmlhttpRequest.
     * pageWindow.showSaveFilePicker must be invoked on the REAL page window,
     * otherwise Chrome throws "Illegal invocation".
     */
    const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    /**********************************************************************
     * CONFIGURATION
     **********************************************************************/

    const BUTTON_ID = 'pv-download-all-button';
    const FILE_HOST = 'https://planview.file.force.com';
    const REQUEST_TIMEOUT = 120000;
    const BUTTON_TOP = '152px';
    const BUTTON_RIGHT = '150px';
    const SETTING_KEY_ENABLED = 'pvDownloadAll_enabled';

    /**********************************************************************
     * isVisible() / deepQuerySelector() style helpers
     *
     * Mirrors the pattern used in Service Cloud Premium's own
     * isVisible()/deepQuerySelector(): a hidden ancestor (Salesforce
     * Console keeps every open Case tab mounted, just hidden) collapses
     * descendant bounding rects to 0x0, so filtering on that is enough
     * to only scrape the Case tab that is actually on screen.
     **********************************************************************/

    function isVisible(element) {
        if (!element) return false;
        const style = getComputedStyle(element);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**********************************************************************
     * LIGHTWEIGHT SETTINGS (GM_setValue/GM_getValue, no shared UI)
     *
     * This script is intentionally standalone, so it has no access to
     * Service Cloud Premium's Settings popup. A Tampermonkey menu command
     * is the idiomatic equivalent for a single on/off toggle.
     **********************************************************************/

    class DownloadAllSettings {
        isEnabled = () => GM_getValue(SETTING_KEY_ENABLED, true);

        toggle = () => {
            const next = !this.isEnabled();
            GM_setValue(SETTING_KEY_ENABLED, next);
            this.registerMenuCommand();
            DownloadAllFiles.instance?.synchronizeButton();
            alert(`"Download all" button ${next ? 'enabled' : 'disabled'}.`);
        };

        registerMenuCommand = () => {
            if (typeof GM_registerMenuCommand !== 'function') return;
            GM_registerMenuCommand(
                `Download All Files: ${this.isEnabled() ? 'Disable' : 'Enable'}`,
                this.toggle,
            );
        };
    }

    /**********************************************************************
     * DownloadAllFiles
     *
     * Single class holding all state/behaviour for the feature, following
     * Service Cloud Premium's class-with-arrow-methods convention.
     **********************************************************************/

    class DownloadAllFiles {
        static instance = null;

        constructor() {
            DownloadAllFiles.instance = this;
            this.settings = new DownloadAllSettings();
            this.isDownloading = false;
            this.synchronizationScheduled = false;
            this.observerStarted = false;
            this.crcTable = null;
        }

        log = (...args) => console.log('[PV Download All]', ...args);
        warn = (...args) => console.warn('[PV Download All]', ...args);
        error = (...args) => console.error('[PV Download All]', ...args);

        sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        /******************************************************************
         * CASE IDENTIFICATION
         ******************************************************************/

        getCaseId = () => {
            const path = window.location.pathname;
            let match = path.match(/\/lightning\/r\/Case\/([a-zA-Z0-9]{15,18})/);
            if (match) return match[1];
            match = window.location.href.match(/[?&](?:id|recordId)=([a-zA-Z0-9]{15,18})/);
            if (match) return match[1];
            return null;
        };

        getCaseNumber = () => {
            const titleMatch = document.title.match(/\b(\d{5,10})\b/);
            if (titleMatch) return titleMatch[1];
            const headerSelectors = [
                '.slds-page-header', '.forceHighlightsPanel',
                'records-lwc-highlights-panel', 'lightning-highlights', 'h1'
            ];
            for (const selector of headerSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.innerText || '';
                    const match = text.match(/\b(\d{5,10})\b/);
                    if (match) return match[1];
                }
            }
            return null;
        };

        getCaseReference = () => {
            const caseNumber = this.getCaseNumber();
            if (caseNumber) return this.sanitizeFilename(caseNumber);
            return this.getCaseId() || 'Attachments';
        };

        isAttachmentsPage = () => {
            const path = window.location.pathname;
            return (
                path.includes('/related/CombinedAttachments/view') ||
                path.includes('/related/Files/view') ||
                path.includes('/related/Attachments/view')
            );
        };

        /******************************************************************
         * GM_xmlhttpRequest WRAPPER
         ******************************************************************/

        gmRequest = (url, { responseType = 'text', method = 'GET' } = {}) => {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method, url, responseType, anonymous: false, timeout: REQUEST_TIMEOUT,
                    onload: resolve,
                    onerror: () => reject(new Error(`Request failed: ${url}`)),
                    ontimeout: () => reject(new Error('Request timed out'))
                });
            });
        };

        /******************************************************************
         * GET CASE FILES — DOM scraping, scoped to the visible Case tab only
         ******************************************************************/

        getFilesFromDom = () => {
            const files = [];
            const seen = new Set();
            const links = document.querySelectorAll('a[href]');

            for (const link of links) {
                if (!isVisible(link)) continue; // skip links from hidden/inactive case tabs

                const href = link.getAttribute('href') || '';
                let match = href.match(/\/lightning\/r\/ContentDocument\/([a-zA-Z0-9]{15,18})/);
                if (match) {
                    const id = match[1];
                    const key = `cd:${id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        files.push({ type: 'ContentDocument', id, name: (link.textContent || '').trim() || 'file' });
                    }
                    continue;
                }
                match = href.match(/\/lightning\/r\/Attachment\/([a-zA-Z0-9]{15,18})/);
                if (match) {
                    const id = match[1];
                    const key = `att:${id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        files.push({ type: 'Attachment', id, name: (link.textContent || '').trim() || 'attachment' });
                    }
                }
            }
            this.log(`Found ${files.length} file(s) on the page.`);
            return files;
        };

        getCaseFiles = async () => {
            await this.sleep(50);
            return this.getFilesFromDom();
        };

        /******************************************************************
         * DOWNLOAD URL / FILENAME
         ******************************************************************/

        getDownloadUrl = (file) => {
            if (file.type === 'ContentDocument') {
                return `${FILE_HOST}/sfc/servlet.shepherd/document/download/${encodeURIComponent(file.id)}`;
            }
            if (file.type === 'Attachment') {
                return `${FILE_HOST}/servlet/servlet.FileDownload?file=${encodeURIComponent(file.id)}`;
            }
            throw new Error(`Unsupported file type: ${file.type}`);
        };

        getFilenameFromHeaders = (headers, fallbackName, index) => {
            const lines = String(headers || '').split(/\r?\n/);
            const line = lines.find(item => /^content-disposition:/i.test(item));
            const disposition = line ? line.substring(line.indexOf(':') + 1).trim() : '';
            const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
            if (match) {
                try { return decodeURIComponent(match[1] || match[2]); }
                catch (_) { return match[1] || match[2]; }
            }
            return fallbackName || `file-${String(index + 1).padStart(2, '0')}`;
        };

        downloadFile = async (file, index) => {
            const url = this.getDownloadUrl(file);
            this.log('Downloading:', file.name);
            const response = await this.gmRequest(url, { responseType: 'arraybuffer' });
            if (response.status < 200 || response.status >= 300) {
                throw new Error(`Download failed for "${file.name}". HTTP ${response.status}.`);
            }
            const resolvedName = this.getFilenameFromHeaders(response.responseHeaders, file.name, index);
            return { data: new Uint8Array(response.response), name: resolvedName };
        };

        /******************************************************************
         * FILENAME SANITIZATION
         ******************************************************************/

        sanitizeFilename = (name) => {
            let result = String(name || 'file');
            result = result.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            result = result.replace(/[ .]+$/g, '');
            if (!result) result = 'file';
            const reserved = new Set(['CON','PRN','AUX','NUL','COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9','LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9']);
            const base = result.split('.')[0].toUpperCase();
            if (reserved.has(base)) result = `_${result}`;
            return result;
        };

        makeUniqueFilename = (filename, usedNames) => {
            const safe = this.sanitizeFilename(filename);
            const key = safe.toLowerCase();
            if (!usedNames.has(key)) { usedNames.add(key); return safe; }
            const dot = safe.lastIndexOf('.');
            const base = dot > 0 ? safe.substring(0, dot) : safe;
            const extension = dot > 0 ? safe.substring(dot) : '';
            let counter = 2;
            while (true) {
                const candidate = `${base} (${counter})${extension}`;
                const candidateKey = candidate.toLowerCase();
                if (!usedNames.has(candidateKey)) { usedNames.add(candidateKey); return candidate; }
                counter++;
            }
        };

        /******************************************************************
         * CRC32 / ZIP HELPERS
         ******************************************************************/

        createCRCTable = () => {
            const table = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
                table[n] = c >>> 0;
            }
            return table;
        };

        crc32 = (data) => {
            if (!this.crcTable) this.crcTable = this.createCRCTable();
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < data.length; i++) { crc = this.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8); }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        };

        write16 = (view, offset, value) => view.setUint16(offset, value, true);
        write32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
        utf8 = (text) => new TextEncoder().encode(text);

        getDosDateTime = () => {
            const date = new Date();
            const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
            const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
            return { dosTime, dosDate };
        };

        createLocalHeader = (filenameBytes, crc, size, dosTime, dosDate) => {
            const header = new Uint8Array(30 + filenameBytes.length);
            const view = new DataView(header.buffer);
            this.write32(view, 0, 0x04034b50); this.write16(view, 4, 20); this.write16(view, 6, 0x0800);
            this.write16(view, 8, 0); this.write16(view, 10, dosTime); this.write16(view, 12, dosDate);
            this.write32(view, 14, crc); this.write32(view, 18, size); this.write32(view, 22, size);
            this.write16(view, 26, filenameBytes.length); this.write16(view, 28, 0);
            header.set(filenameBytes, 30);
            return header;
        };

        createCentralHeader = (entry) => {
            const filenameBytes = this.utf8(entry.filename);
            const header = new Uint8Array(46 + filenameBytes.length);
            const view = new DataView(header.buffer);
            this.write32(view, 0, 0x02014b50); this.write16(view, 4, 20); this.write16(view, 6, 20);
            this.write16(view, 8, 0x0800); this.write16(view, 10, 0); this.write16(view, 12, entry.dosTime);
            this.write16(view, 14, entry.dosDate); this.write32(view, 16, entry.crc); this.write32(view, 20, entry.size);
            this.write32(view, 24, entry.size); this.write16(view, 28, filenameBytes.length); this.write16(view, 30, 0);
            this.write16(view, 32, 0); this.write16(view, 34, 0); this.write16(view, 36, 0); this.write32(view, 38, 0);
            this.write32(view, 42, entry.offset);
            header.set(filenameBytes, 46);
            return header;
        };

        createEndRecord = (entryCount, centralSize, centralOffset) => {
            const data = new Uint8Array(22);
            const view = new DataView(data.buffer);
            this.write32(view, 0, 0x06054b50); this.write16(view, 4, 0); this.write16(view, 6, 0);
            this.write16(view, 8, entryCount); this.write16(view, 10, entryCount);
            this.write32(view, 12, centralSize); this.write32(view, 16, centralOffset); this.write16(view, 20, 0);
            return data;
        };

        /******************************************************************
         * ZIP CREATION
         ******************************************************************/

        createZipBlob = async (files) => {
            const parts = [];
            const centralDirectory = [];
            let offset = 0;
            const usedNames = new Set();
            const caseReference = this.getCaseReference();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateButtonText(`Downloading ${i + 1}/${files.length}...`);
                this.log(`Downloading ${i + 1}/${files.length}:`, file.name);
                const downloaded = await this.downloadFile(file, i);
                const filename = this.makeUniqueFilename(downloaded.name, usedNames);
                const zipPath = `${caseReference}/${filename}`;
                const data = downloaded.data;
                const crc = this.crc32(data);
                const { dosTime, dosDate } = this.getDosDateTime();
                const filenameBytes = this.utf8(zipPath);
                const header = this.createLocalHeader(filenameBytes, crc, data.length, dosTime, dosDate);
                parts.push(header); parts.push(data);
                centralDirectory.push({ filename: zipPath, crc, size: data.length, offset, dosTime, dosDate });
                offset += header.length + data.length;
                if (i % 3 === 0) await this.sleep(0);
            }

            const centralOffset = offset;
            let centralSize = 0;
            for (const entry of centralDirectory) {
                const header = this.createCentralHeader(entry);
                parts.push(header);
                centralSize += header.length;
                offset += header.length;
            }
            const end = this.createEndRecord(centralDirectory.length, centralSize, centralOffset);
            parts.push(end);
            return new Blob(parts, { type: 'application/zip' });
        };

        createZipDirectToDisk = async (files) => {
            if (typeof pageWindow.showSaveFilePicker !== 'function') return false;

            const handle = await pageWindow.showSaveFilePicker({
                suggestedName: `Case_${this.getCaseReference()}_files.zip`,
                types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }]
            });
            const writable = await handle.createWritable();
            const centralDirectory = [];
            let offset = 0;
            const usedNames = new Set();
            const caseReference = this.getCaseReference();

            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    this.updateButtonText(`Downloading ${i + 1}/${files.length}...`);
                    this.log(`Downloading ${i + 1}/${files.length}:`, file.name);
                    const downloaded = await this.downloadFile(file, i);
                    const filename = this.makeUniqueFilename(downloaded.name, usedNames);
                    const zipPath = `${caseReference}/${filename}`;
                    const data = downloaded.data;
                    const crc = this.crc32(data);
                    const { dosTime, dosDate } = this.getDosDateTime();
                    const filenameBytes = this.utf8(zipPath);
                    const header = this.createLocalHeader(filenameBytes, crc, data.length, dosTime, dosDate);
                    await writable.write(header);
                    await writable.write(data);
                    centralDirectory.push({ filename: zipPath, crc, size: data.length, offset, dosTime, dosDate });
                    offset += header.length + data.length;
                    await this.sleep(0);
                }
                const centralOffset = offset;
                let centralSize = 0;
                for (const entry of centralDirectory) {
                    const header = this.createCentralHeader(entry);
                    await writable.write(header);
                    centralSize += header.length;
                    offset += header.length;
                }
                const end = this.createEndRecord(centralDirectory.length, centralSize, centralOffset);
                await writable.write(end);
                await writable.close();
                return true;
            } catch (e) {
                try { await writable.abort(); } catch (_) {}
                throw e;
            }
        };

        saveBlob = (blob, filename) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = filename;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        };

        /******************************************************************
         * MAIN DOWNLOAD
         ******************************************************************/

        downloadAllFiles = async () => {
            if (this.isDownloading) return;
            const caseId = this.getCaseReference();
            this.isDownloading = true;
            const button = document.getElementById(BUTTON_ID);
            if (button) { button.disabled = true; button.style.opacity = '0.7'; button.style.cursor = 'wait'; }

            try {
                this.updateButtonText('Loading files...');
                const files = await this.getCaseFiles();
                if (!files.length) { alert('No files or attachments were found on this page.'); return; }
                this.log(`Starting download of ${files.length} file(s).`);

                if (typeof pageWindow.showSaveFilePicker === 'function') {
                    try {
                        const success = await this.createZipDirectToDisk(files);
                        if (success) {
                            this.updateButtonText('Download all');
                            alert(`ZIP created successfully.\n\n${files.length} file(s) downloaded.`);
                            return;
                        }
                    } catch (e) {
                        if (e && e.name === 'AbortError') { this.log('Save dialog cancelled.'); return; }
                        this.error('Direct-to-disk ZIP creation failed.', e);
                        throw e;
                    }
                }

                this.updateButtonText('Creating ZIP...');
                const blob = await this.createZipBlob(files);
                this.saveBlob(blob, `Case_${caseId}_files.zip`);
                this.updateButtonText('Download all');
                this.log('ZIP download started.');
            } catch (e) {
                this.error('Download all failed:', e);
                alert(`Download failed.\n\n${e.message || e}`);
            } finally {
                this.isDownloading = false;
                const btn = document.getElementById(BUTTON_ID);
                if (btn) {
                    btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
                    this.updateButtonText('Download all');
                }
            }
        };

        /******************************************************************
         * BUTTON
         ******************************************************************/

        createButton = () => {
            let button = document.getElementById(BUTTON_ID);
            if (button) return button;

            button = document.createElement('button');
            button.id = BUTTON_ID;
            button.type = 'button';
            button.textContent = 'Download all';
            button.title = 'Download all Case files as a ZIP';

            Object.assign(button.style, {
                position: 'fixed', top: BUTTON_TOP, right: BUTTON_RIGHT, zIndex: '2147483647',
                padding: '6px 14px', background: '#0176d3', color: '#ffffff', border: 'none',
                borderRadius: '4px', fontFamily: 'Salesforce Sans, Arial, sans-serif',
                fontSize: '13px', fontWeight: '400', lineHeight: '18px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)', cursor: 'pointer', display: 'block', userSelect: 'none'
            });

            button.addEventListener('mouseenter', () => { if (!button.disabled) button.style.filter = 'brightness(0.95)'; });
            button.addEventListener('mouseleave', () => { button.style.filter = ''; });
            button.addEventListener('click', this.downloadAllFiles);

            document.body.appendChild(button);
            return button;
        };

        updateButtonText = (text) => {
            const button = document.getElementById(BUTTON_ID);
            if (button) button.textContent = text;
        };

        /******************************************************************
         * PREVIEW DETECTION
         ******************************************************************/

        hasVisiblePreviewContainer = () => {
            const selectors = ['.forceContentPreviewPlayer', '.forceContentPreviewPlayerDesktop', '.forceContentPreviewViewer', '.lightning-file-preview'];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) { if (isVisible(element)) return true; }
            }
            return false;
        };

        hasVisiblePreviewDialog = () => {
            const dialogs = document.querySelectorAll('[role="dialog"], section.slds-modal');
            for (const dialog of dialogs) {
                if (!isVisible(dialog)) continue;
                const rect = dialog.getBoundingClientRect();
                const viewportArea = window.innerWidth * window.innerHeight;
                const dialogArea = rect.width * rect.height;
                if (dialogArea < viewportArea * 0.15) continue;
                const previewContent = dialog.querySelector('iframe, img, video, audio, embed, object');
                if (previewContent && isVisible(previewContent)) return true;
            }
            return false;
        };

        isFilePreviewOpen = () => this.hasVisiblePreviewContainer() || this.hasVisiblePreviewDialog();

        updateButtonVisibility = () => {
            const button = document.getElementById(BUTTON_ID);
            if (!button) return;
            button.style.display = this.isFilePreviewOpen() ? 'none' : 'block';
        };

        /******************************************************************
         * SYNCHRONIZATION WITH SALESFORCE SPA NAVIGATION
         ******************************************************************/

        synchronizeButton = () => {
            this.synchronizationScheduled = false;

            if (!this.settings.isEnabled() || !this.isAttachmentsPage()) {
                const existing = document.getElementById(BUTTON_ID);
                if (existing) existing.remove();
                return;
            }

            this.createButton();
            this.updateButtonVisibility();
        };

        scheduleSynchronization = () => {
            if (this.synchronizationScheduled) return;
            this.synchronizationScheduled = true;
            setTimeout(this.synchronizeButton, 100);
        };

        startObserver = () => {
            if (this.observerStarted) return;
            this.observerStarted = true;
            const observer = new MutationObserver(() => { this.scheduleSynchronization(); });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
            this.log('MutationObserver started.');
        };

        monitorNavigation = () => {
            let lastUrl = window.location.href;
            setInterval(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) { lastUrl = currentUrl; this.log('Salesforce navigation detected.'); this.scheduleSynchronization(); }
            }, 500);
        };

        /******************************************************************
         * ENTRY POINT
         ******************************************************************/

        run = () => {
            this.log('Salesforce Download All V4.3 (standalone, harmonized style) initialized.');
            this.settings.registerMenuCommand();
            this.synchronizeButton();
            this.startObserver();
            this.monitorNavigation();
            setTimeout(this.synchronizeButton, 500);
            setTimeout(this.synchronizeButton, 1500);
            setTimeout(this.synchronizeButton, 3000);
        };
    }

    function init() {
        const feature = new DownloadAllFiles();
        feature.run();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

})();
