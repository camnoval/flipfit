// Configuration
const API_BASE = 'https://cnoval-flipfit.hf.space';

// Simple logging function
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

// Dev Tool elements
const devHealth = document.getElementById('pingHealth');
const devDebug = document.getElementById('pingDebug');
const devCategories = document.getElementById('pingCategories');
const devResponseBlock = document.getElementById('devResponseBlock');

// Caption editor
const captionEditor = document.getElementById('captionEditor');
const reappraiseBtn = document.getElementById('reappraiseBtn');

let stream = null;
let currentImageBlob = null;
let currentFacingMode = 'environment'; // back camera default
let lastDraftObject = null;

// ===== Camera functions =====
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
    } catch (error) {
        showError('Camera access denied or not available');
        console.error('Camera error:', error);
        logEvent('camera_error', 'errors');
    }
}

startCamera.addEventListener('click', () => startCameraStream());

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

// ===== File Upload =====
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
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
    }
});

// ===== Analysis Functions =====
quickAnalyze.addEventListener('click', () => analyzeImage(false));
fullAnalyze.addEventListener('click', () => analyzeImage(true));

function showProgress() {
    results.classList.remove('hidden');
    resultsContent.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 25%"></div>
            </div>
            <div class="progress-text" id="progressText">🚀 Sending image to AI...</div>
        </div>
    `;

    return {
        update: (percentage, text) => {
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            if (progressFill && progressText) {
                progressFill.style.width = `${percentage}%`;
                progressText.textContent = text;
            }
        }
    };
}

async function analyzeImage(fullAnalysis) {
    if (!currentImageBlob) return showError('Please capture or upload an image first');
    logEvent(fullAnalysis ? 'full_analysis' : 'quick_analysis', 'clothing_analysis');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    if (categorySelect.value) formData.append('manual_category', categorySelect.value);

    const progress = showProgress();

    try {
        const endpoint = fullAnalysis ? '/appraise' : '/quick-caption';
        const url = `${API_BASE}${endpoint}`;
        progress.update(50, '🤖 AI is analyzing your image...');

        const response = await fetch(url, { method: 'POST', body: formData });
        progress.update(80, fullAnalysis ? '💰 Getting pricing data...' : '✨ Generating caption...');

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        const data = await response.json();
        progress.update(100, '✅ Analysis complete!');
        await new Promise(r => setTimeout(r, 500));

        if (data.success) {
            displayResults(data, fullAnalysis);
            if (!fullAnalysis && data.caption) captionEditor.value = data.caption; // set for reappraisal
            logEvent('analysis_success', 'clothing_analysis');
        } else throw new Error(data.error || 'Analysis failed');

    } catch (error) {
        console.error('Analysis error:', error);
        showError(`Network error: ${error.message}`);
        logEvent('analysis_error', 'errors');
    }
}

function displayResults(data, fullAnalysis) {
    results.classList.remove('hidden');
    if (fullAnalysis) {
        const resultText = data.result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const sections = resultText.split('\n\n');
        let html = '';
        sections.forEach(section => {
            if (section.trim()) html += `<div class="result-card">${section.replace(/\n/g, '<br>')}</div>`;
        });
        resultsContent.innerHTML = html;
    } else {
        resultsContent.innerHTML = `
            <div class="result-card">
                <div class="result-title">Category</div>
                <div class="result-value">${data.category} (${Math.round(data.confidence*100)}% confidence)</div>
            </div>
            <div class="result-card">
                <div class="result-title">Description</div>
                <div class="result-value">${data.caption}</div>
            </div>
        `;
    }
    if (lastDraftObject) draftResults.classList.remove('hidden');
}

function showError(message) {
    results.classList.remove('hidden');
    resultsContent.innerHTML = `<div class="error">${message}</div>`;
}

// ===== Draft Listing =====
createDraft.addEventListener('click', async () => {
    if (!currentImageBlob) return showError('Please capture or upload an image first');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    if (categorySelect.value) formData.append('manual_category', categorySelect.value);

    const progress = showProgress();
    progress.update(35, '📤 Uploading image…');

    try {
        const url = `${API_BASE}/create-draft-listing`;
        const resp = await fetch(url, { method: 'POST', body: formData });
        progress.update(65, '🧭 Suggesting category…');

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();

        if (!data.success) throw new Error(data.error || 'Draft creation failed');

        lastDraftObject = data.draft_listing || {};
        results.classList.remove('hidden');
        draftResults.classList.remove('hidden');

        categoryNamePill.textContent = (data.category_suggestion?.categoryName) || 'Unknown';
        categoryIdPill.textContent = `ID: ${data.category_suggestion?.categoryId || '—'}`;
        suggestedPricePill.textContent = (typeof data.suggested_price === 'number') ? `$${data.suggested_price.toFixed(2)}` : `$${data.suggested_price || '—'}`;
        draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);

        progress.update(100, '✅ Draft ready!');
        await new Promise(r => setTimeout(r, 400));

    } catch (err) {
        console.error('Draft error:', err);
        showError(`Draft error: ${err.message}`);
    }
});

// ===== Copy & Download JSON =====
copyDraftJson.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(draftJsonBlock.textContent); alert('Draft JSON copied ✅'); }
    catch { alert('Failed to copy. Select manually.'); }
});

downloadDraftJson.addEventListener('click', () => {
    const blob = new Blob([draftJsonBlock.textContent || '{}'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flipfit-draft-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

// ===== Dev Tools =====
async function runDevCall(path) {
    try {
        const res = await fetch(`${API_BASE}${path}`);
        const data = await res.json();
        devResponseBlock.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        devResponseBlock.textContent = `Error: ${e.message}`;
    }
}

devHealth.addEventListener('click', () => runDevCall('/health'));
devDebug.addEventListener('click', () => runDevCall('/debug'));
devCategories.addEventListener('click', () => runDevCall('/categories'));

// ===== Reappraisal (edit caption) =====
reappraiseBtn.addEventListener('click', async () => {
    if (!captionEditor.value.trim()) return showError('Caption cannot be empty');

    const formData = new FormData();
    if (currentImageBlob) formData.append('file', currentImageBlob);
    formData.append('manual_caption', captionEditor.value);

    const progress = showProgress();
    progress.update(40, '🔄 Sending edited caption to AI…');

    try {
        const url = `${API_BASE}/reappraise`;
        const resp = await fetch(url, { method: 'POST', body: formData });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        progress.update(100, '✅ Reappraisal complete!');
        await new Promise(r => setTimeout(r, 300));

        if (data.success) {
            displayResults(data, true); // show full analysis
        } else showError(data.error || 'Reappraisal failed');

    } catch (err) {
        console.error('Reappraisal error:', err);
        showError(`Reappraisal error: ${err.message}`);
    }
});

// ===== Initial API Health Check =====
console.log('Testing API connection...');
fetch(`${API_BASE}/health`)
    .then(resp => resp.json())
    .then(data => {
        console.log('✅ API Health Check:', data);
        if (data.models_loaded === 0) console.warn('⚠️ No models loaded in API');
    })
    .catch(err => { console.error('❌ API connection failed:', err); showError('Cannot connect to AI service.'); });
