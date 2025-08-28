// Configuration
const API_BASE = 'https://cnoval-flipfit.hf.space';

// Simple logging
function logEvent(action, category = 'user_interaction') {
    console.log(`Event: ${action} | Category: ${category}`);
}

function logDebug(message, obj = null) {
    const debugDiv = document.getElementById('api-response');
    if (debugDiv) {
        let output = message;
        if (obj) output += "\n" + JSON.stringify(obj, null, 2);
        debugDiv.textContent = output;
    }
}

// Utility function to show errors
function showError(message) {
    const results = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    results.classList.remove('hidden');
    resultsContent.innerHTML = `
        <div class="result-card" style="border-left: 4px solid #ef4444;">
            <div class="result-title" style="color: #ef4444;">❌ Error</div>
            <div class="result-value">${message}</div>
        </div>
    `;
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
    if (draftResults) draftResults.classList.add('hidden');
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
        <div class="progress-container" style="padding: 20px; text-align: center;">
            <div class="progress-bar" style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-bottom: 10px;">
                <div class="progress-fill" id="progressFill" style="width: 25%; height: 100%; background: #3b82f6; transition: width 0.3s ease;"></div>
            </div>
            <div class="progress-text" id="progressText" style="color: #6b7280;">🚀 Sending image to AI...</div>
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
        console.log(`Calling API: ${API_BASE}${endpoint}`);
        
        const resp = await fetch(`${API_BASE}${endpoint}`, { 
            method: 'POST', 
            body: formData 
        });
        
        progress.update(70, 'Processing response...');
        console.log(`Response status: ${resp.status}`);

        if (!resp.ok) {
            const txt = await resp.text();
            console.error(`API Error: ${txt}`);
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        console.log('API Response:', data);
        
        progress.update(100, '✅ Analysis complete!');
        await new Promise(r => setTimeout(r, 300));

        if (!data.success) throw new Error(data.error || 'Analysis failed');

        displayResults(data, fullAnalysis);
        logEvent('analysis_success', 'clothing_analysis');

    } catch (err) {
        console.error('Analysis error:', err);
        showError(`Network error: ${err.message}`);
        logEvent('analysis_error', 'errors');
    }
}

function displayResults(data, fullAnalysis) {
    results.classList.remove('hidden');

    // Handle different response formats between full analysis and quick caption
    const result = fullAnalysis ? data.result : data;
    
    let html = '';

    // CATEGORY - handle both response formats
    const category = fullAnalysis 
        ? (result?.predicted_category || data.detected_category || 'Unknown')
        : (data.category || 'Unknown');
    
    const confidence = fullAnalysis 
        ? (result?.confidence || data.confidence)
        : data.confidence;

    html += `<div class="result-card">
                <div class="result-title">Category</div>
                <div class="result-value">${category} 
                    ${confidence ? `(${Math.round(confidence*100)}%)` : ''}
                </div>
             </div>`;

    // FINAL CAPTION/DESCRIPTION
    const caption = fullAnalysis 
        ? (result?.final_caption || data.caption_used)
        : data.caption;
    
    if (caption) {
        html += `<div class="result-card">
                    <div class="result-title">Description</div>
                    <div class="result-value">${caption}</div>
                 </div>`;
    }

    // OCR TEXT (full analysis only)
    if (fullAnalysis && (result?.ocr_text || data.ocr_text)) {
        html += `<div class="result-card">
                    <div class="result-title">Brand / Text Detected</div>
                    <div class="result-value">${result.ocr_text || data.ocr_text}</div>
                 </div>`;
    }

    // PRICE ESTIMATES (full analysis only)
    if (fullAnalysis && (result?.price_info || data.price_info)) {
        const pi = result?.price_info || data.price_info;
        html += `<div class="result-card price-card">
                    <div class="result-title">💰 Price Estimates</div>
                    <div class="result-value">
                        <strong>Current Listings:</strong> Avg $${pi.current_avg || '—'}, Median $${pi.current_median || '—'}<br>
                        <strong>Sold Listings:</strong> Avg $${pi.sold_avg || '—'}, Median $${pi.sold_median || '—'}
                    </div>
                 </div>`;
    }

    // SEARCH QUERY (full analysis only)
    if (fullAnalysis && (result?.search_query || data.search_query)) {
        html += `<div class="result-card">
                    <div class="result-title">🔍 Search Query Used</div>
                    <div class="result-value">${result.search_query || data.search_query}</div>
                 </div>`;
    }

    resultsContent.innerHTML = html;

    // Update draft panel if JSON returned (full analysis only)
    if (fullAnalysis && data.draft_listing && draftResults) {
        lastDraftObject = data.draft_listing;
        draftResults.classList.remove('hidden');
        if (draftJsonBlock) draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);
        if (categoryNamePill) categoryNamePill.textContent = data.category_suggestion?.categoryName || 'Unknown';
        if (categoryIdPill) categoryIdPill.textContent = `ID: ${data.category_suggestion?.categoryId || '—'}`;
        if (suggestedPricePill) {
            const price = typeof data.suggested_price === 'number'
                ? `$${data.suggested_price.toFixed(2)}`
                : `$${data.suggested_price || '—'}`;
            suggestedPricePill.textContent = price;
        }
    }
}

// Event listeners for analysis buttons
quickAnalyze.addEventListener('click', () => analyzeImage(false));
fullAnalyze.addEventListener('click', () => analyzeImage(true));

// === CREATE DRAFT USING STRUCTURED JSON ===
createDraft.addEventListener('click', async () => {
    if (!currentImageBlob) return showError('Please capture or upload an image first');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    if (categorySelect.value) formData.append('manual_category', categorySelect.value);

    // Optional size/color
    const sizeInput = document.getElementById('sizeInput');
    const colorInput = document.getElementById('colorInput');
    if (sizeInput?.value) formData.append('size', sizeInput.value);
    if (colorInput?.value) formData.append('color', colorInput.value);

    const progress = showProgress();
    progress.update(30, '📤 Uploading image…');

    try {
        const resp = await fetch(`${API_BASE}/create-draft-listing`, { method: 'POST', body: formData });
        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(errorText);
        }

        const data = await resp.json();
        if (!data.success) throw new Error(data.error || 'Draft creation failed');

        lastDraftObject = data.draft_listing || {};
        if (draftResults) {
            draftResults.classList.remove('hidden');
            if (draftJsonBlock) draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);
            if (categoryNamePill) categoryNamePill.textContent = data.category_suggestion?.categoryName || 'Unknown';
            if (categoryIdPill) categoryIdPill.textContent = `ID: ${data.category_suggestion?.categoryId || '—'}`;
            if (suggestedPricePill) {
                const price = typeof data.suggested_price === 'number'
                    ? `$${data.suggested_price.toFixed(2)}`
                    : `$${data.suggested_price || '—'}`;
                suggestedPricePill.textContent = price;
            }
        }

        progress.update(100, '✅ Draft ready!');
        await new Promise(r => setTimeout(r, 400));

    } catch (err) {
        console.error(err);
        showError(`Draft error: ${err.message}`);
    }
});

// === COPY / DOWNLOAD JSON ===
if (copyDraftJson) {
    copyDraftJson.addEventListener('click', async () => {
        try {
            if (draftJsonBlock) {
                await navigator.clipboard.writeText(draftJsonBlock.textContent);
                alert('Draft JSON copied ✅');
            }
        } catch {
            alert('Failed to copy. Select and copy manually.');
        }
    });
}

if (downloadDraftJson) {
    downloadDraftJson.addEventListener('click', () => {
        if (draftJsonBlock) {
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
        }
    });
}

// === DEV TEST TOOLS ===
async function runDevCall(path) {
    const devResponseBlock = document.getElementById('api-response');
    if (!devResponseBlock) return;
    
    try {
        console.log(`Calling dev endpoint: ${API_BASE}${path}`);
        const res = await fetch(`${API_BASE}${path}`);
        const data = await res.json();
        devResponseBlock.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        devResponseBlock.textContent = `Error: ${e.message}`;
    }
}

// Dev button event listeners
const devHealth = document.getElementById('ping-health');
const devDebug = document.getElementById('ping-debug'); 
const devCategories = document.getElementById('ping-categories');

if (devHealth) devHealth.addEventListener('click', () => runDevCall('/health'));
if (devDebug) devDebug.addEventListener('click', () => runDevCall('/debug'));
if (devCategories) devCategories.addEventListener('click', () => runDevCall('/categories'));

// Test API on startup
console.log('✅ App.js initialized and ready.');

// Ping endpoint function for the dev buttons
async function pingEndpoint(endpoint) {
    const resultDiv = document.getElementById("api-response");
    if (!resultDiv) return;
    
    resultDiv.textContent = "⏳ Processing...";
    
    try {
        console.log(`Pinging: ${API_BASE}${endpoint}`);
        const response = await fetch(`${API_BASE}${endpoint}`);
        const data = await response.json();
        resultDiv.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        resultDiv.textContent = "❌ Error: " + err.message;
        console.error('Ping error:', err);
    }
}
