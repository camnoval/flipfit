// Configuration
const API_BASE = 'https://cnoval-flipfit.hf.space';

// Simple logging
function logEvent(action, category = 'user_interaction') {
    console.log(`Event: ${action} | Category: ${category}`);
}

// DOM Elements
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const cameraContainer = document.getElementById('cameraContainer');
const startCamera = document.getElementById('startCamera');
const uploadBtn = document.getElementById('uploadBtn');
const captureBtn = document.getElementById('captureBtn');
const flipCamera = document.getElementById('flipCamera');
const retakeBtn = document.getElementById('retakeBtn');
const quickAnalyze = document.getElementById('quickAnalyze');
const fullAnalyze = document.getElementById('fullAnalyze');
const createDraft = document.getElementById('createDraft');
const fileInput = document.getElementById('fileInput');
const categorySelect = document.getElementById('categorySelect');
const results = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');
const captureButtons = document.getElementById('captureButtons');
const analyzeButtons = document.getElementById('analyzeButtons');
const devButtons = document.getElementById('devButtons');

// Draft UI elements
const draftResults = document.getElementById('draftResults');
const categoryNamePill = document.getElementById('categoryNamePill');
const categoryIdPill = document.getElementById('categoryIdPill');
const suggestedPricePill = document.getElementById('suggestedPricePill');
const draftJsonBlock = document.getElementById('draftJsonBlock');
const copyDraftJson = document.getElementById('copyDraftJson');
const downloadDraftJson = document.getElementById('downloadDraftJson');

let stream = null;
let currentImageBlob = null;
let currentFacingMode = 'environment';
let lastDraftObject = null;

// === CAMERA FUNCTIONS ===
async function startCameraStream() {
    try {
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
        video.srcObject = stream;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        cameraContainer.classList.add('active');
        captureButtons.classList.remove('hidden');
        startCamera.disabled = true;
        logEvent('camera_started');
    } catch (err) {
        showError('Camera access denied or not available');
        console.error(err);
        logEvent('camera_error', 'errors');
    }
}

startCamera.addEventListener('click', startCameraStream);

flipCamera.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    startCameraStream();
    logEvent('camera_flipped');
});

captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        currentImageBlob = blob;
        const url = URL.createObjectURL(blob);
        preview.src = url;
        preview.classList.remove('hidden');
        video.classList.add('hidden');
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
        captureButtons.classList.add('hidden');
        analyzeButtons.classList.remove('hidden');
        devButtons.classList.remove('hidden');
        createDraft.disabled = false;
        logEvent('photo_captured');
    }, 'image/jpeg', 0.8);
});

retakeBtn.addEventListener('click', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.classList.add('hidden');
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    preview.src = '';
    currentImageBlob = null;
    cameraContainer.classList.remove('active');
    captureButtons.classList.add('hidden');
    analyzeButtons.classList.add('hidden');
    devButtons.classList.add('hidden');
    results.classList.add('hidden');
    draftResults.classList.add('hidden');
    startCamera.disabled = false;
    createDraft.disabled = true;
    lastDraftObject = null;
    currentFacingMode = 'environment';
    logEvent('camera_stopped');
});

// === FILE UPLOAD ===
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    currentImageBlob = file;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    video.classList.add('hidden');
    analyzeButtons.classList.remove('hidden');
    devButtons.classList.remove('hidden');
    captureButtons.classList.add('hidden');
    startCamera.disabled = false;
    createDraft.disabled = false;
    logEvent('file_uploaded');
});

// === PROGRESS UI ===
function showProgress() {
    results.classList.remove('hidden');
    resultsContent.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width:25%"></div>
            </div>
            <div class="progress-text" id="progressText">🚀 Sending image to AI...</div>
        </div>
    `;
    return {
        update: (percent, text) => {
            const fill = document.getElementById('progressFill');
            const txt = document.getElementById('progressText');
            if (fill && txt) {
                fill.style.width = `${percent}%`;
                txt.textContent = text;
            }
        }
    };
}

// === ANALYSIS FUNCTIONS ===
async function analyzeImage(fullAnalysis) {
    if (!currentImageBlob) return showError('Please capture or upload an image first');
    logEvent(fullAnalysis ? 'full_analysis' : 'quick_analysis', 'clothing_analysis');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    if (categorySelect.value) formData.append('manual_category', categorySelect.value);

    const progress = showProgress();

    try {
        const endpoint = fullAnalysis ? '/appraise' : '/quick-caption';
        const resp = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: formData });
        progress.update(70, 'Processing response...');

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        progress.update(100, '✅ Analysis complete!');
        await new Promise(r => setTimeout(r, 300));

        if (!data.success) throw new Error(data.error || 'Analysis failed');

        displayResults(data, fullAnalysis);
        logEvent('analysis_success', 'clothing_analysis');

    } catch (err) {
        console.error(err);
        showError(`Network error: ${err.message}`);
        logEvent('analysis_error', 'errors');
    }
}

function displayResults(data, fullAnalysis) {
    results.classList.remove('hidden');

    if (fullAnalysis) {
        const html = `<div class="result-card">${data.result.replace(/\n/g, '<br>')}</div>`;
        resultsContent.innerHTML = html;
    } else {
        resultsContent.innerHTML = `
            <div class="result-card"><div class="result-title">Category</div><div class="result-value">${data.category} (${Math.round(data.confidence*100)}%)</div></div>
            <div class="result-card"><div class="result-title">Description</div><div class="result-value">${data.caption}</div></div>
        `;
    }

    // Update draft panel if JSON returned
    if (data.draft_listing) {
        lastDraftObject = data.draft_listing;
        draftResults.classList.remove('hidden');
        draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);
        categoryNamePill.textContent = data.category_suggestion?.categoryName || 'Unknown';
        categoryIdPill.textContent = `ID: ${data.category_suggestion?.categoryId || '—'}`;
        suggestedPricePill.textContent = typeof data.suggested_price === 'number'
            ? `$${data.suggested_price.toFixed(2)}`
            : `$${data.suggested_price || '—'}`;
    }
}

quickAnalyze.addEventListener('click', () => analyzeImage(false));
fullAnalyze.addEventListener('click', () => analyzeImage(true));

// === CREATE DRAFT USING STRUCTURED JSON ===
createDraft.addEventListener('click', async () => {
    if (!currentImageBlob) return showError('Please capture or upload an image first');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    if (categorySelect.value) formData.append('manual_category', categorySelect.value);

    // Optional size/color
    const size = document.getElementById('sizeInput')?.value;
    const color = document.getElementById('colorInput')?.value;
    if (size) formData.append('size', size);
    if (color) formData.append('color', color);

    const progress = showProgress();
    progress.update(30, '📤 Uploading image…');

    try {
        const resp = await fetch(`${API_BASE}/create-draft-listing`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const data = await resp.json();
        if (!data.success) throw new Error(data.error || 'Draft creation failed');

        lastDraftObject = data.draft_listing || {};
        draftResults.classList.remove('hidden');
        draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);
        categoryNamePill.textContent = data.category_suggestion?.categoryName || 'Unknown';
        categoryIdPill.textContent = `ID: ${data.category_suggestion?.categoryId || '—'}`;
        suggestedPricePill.textContent = typeof data.suggested_price === 'number'
            ? `$${data.suggested_price.toFixed(2)}`
            : `$${data.suggested_price || '—'}`;

        progress.update(100, '✅ Draft ready!');
        await new Promise(r => setTimeout(r, 400));

    } catch (err) {
        console.error(err);
        showError(`Draft error: ${err.message}`);
    }
});

// === COPY / DOWNLOAD JSON ===
copyDraftJson.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(draftJsonBlock.textContent);
        alert('Draft JSON copied ✅');
    } catch {
        alert('Failed to copy. Select and copy manually.');
    }
});

downloadDraftJson.addEventListener('click', () => {
    const blob = new Blob([draftJsonBlock.textContent || '{}'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `flipfit-draft-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// === DEV TEST TOOLS ===
async function runDevCall(path) {
    try {
        const res = await fetch(`${API_BASE}${path}`);
        devResponseBlock.textContent = JSON.stringify(await res.json(), null, 2);
    } catch (e) {
        devResponseBlock.textContent = `Error: ${e.message}`;
    }
}

devHealth?.addEventListener('click', () => runDevCall('/health'));
devDebug?.addEventListener('click', () => runDevCall('/debug'));
devCategories?.addEventListener('click', () => runDevCall('/categories'));

// Test API on startup
console.log('✅ App.js initialized and ready.');
