
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
const devHealth = document.getElementById('devHealth');
const devDebug = document.getElementById('devDebug');
const devCategories = document.getElementById('devCategories');
const devResponseBlock = document.getElementById('devResponseBlock');

let stream = null;
let currentImageBlob = null;
let currentFacingMode = 'environment'; // Start with back camera
let lastDraftObject = null;

// Camera functionality
async function startCameraStream() {
    try {
        // Stop existing stream first
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode }
        });
        
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

startCamera.addEventListener('click', () => {
    startCameraStream();
});

// Flip camera between front and back
flipCamera.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    startCameraStream();
    logEvent('camera_flipped');
});

// Capture photo
captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
        currentImageBlob = blob;
        const url = URL.createObjectURL(blob);
        
        preview.src = url;
        preview.classList.remove('hidden');
        video.classList.add('hidden');
        
        // Stop camera
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        
        captureButtons.classList.add('hidden');
        analyzeButtons.classList.remove('hidden');
        devButtons.classList.remove('hidden');
        createDraft.disabled = false;
        
        logEvent('photo_captured');
        
    }, 'image/jpeg', 0.8);
});

// Stop camera and return to initial state
retakeBtn.addEventListener('click', () => {
    // Stop camera stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    // Reset UI
    video.classList.add('hidden');
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    preview.src = '';
    currentImageBlob = null;
    cameraContainer.classList.remove('active');
    
    // Reset buttons
    captureButtons.classList.add('hidden');
    analyzeButtons.classList.add('hidden');
    devButtons.classList.add('hidden');
    results.classList.add('hidden');
    draftResults.classList.add('hidden');
    startCamera.disabled = false;
    createDraft.disabled = true;
    lastDraftObject = null;
    
    // Reset to back camera for next time
    currentFacingMode = 'environment';
    
    logEvent('camera_stopped');
});

// File upload - FIXED: Removed capture="camera" attribute
uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
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

// Analysis functions
quickAnalyze.addEventListener('click', () => analyzeImage(false));
fullAnalyze.addEventListener('click', () => analyzeImage(true));

// Real-time progress bar function
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
    if (!currentImageBlob) {
        showError('Please capture or upload an image first');
        return;
    }

    logEvent(fullAnalysis ? 'full_analysis' : 'quick_analysis', 'clothing_analysis');

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    
    const category = categorySelect.value;
    if (category) {
        formData.append('manual_category', category);
    }

    // Show initial progress
    const progress = showProgress();

    try {
        const endpoint = fullAnalysis ? '/appraise' : '/quick-caption';
        const url = `${API_BASE}${endpoint}`;
        
        console.log(`Making request to: ${url}`);
        
        // Update progress when request starts
        progress.update(50, '🤖 AI is analyzing your image...');
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);
        
        // Update progress when response received
        progress.update(80, fullAnalysis ? '💰 Getting pricing data...' : '✨ Generating caption...');
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        // Final progress update before showing results
        progress.update(100, '✅ Analysis complete!');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));

        if (data.success) {
            displayResults(data, fullAnalysis);
            logEvent('analysis_success', 'clothing_analysis');
        } else {
            showError(data.error || 'Analysis failed');
            logEvent('analysis_failed', 'errors');
        }

    } catch (error) {
        console.error('Analysis error:', error);
        showError(`Network error: ${error.message}`);
        logEvent('analysis_error', 'errors');
    }
}

function displayResults(data, fullAnalysis) {
    results.classList.remove('hidden');
    
    if (fullAnalysis) {
        // Full analysis with markdown-like formatting
        const resultText = data.result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const sections = resultText.split('\n\n');
        
        let html = '';
        sections.forEach(section => {
            if (section.trim()) {
                html += `<div class="result-card">${section.replace(/\n/g, '<br>')}</div>`;
            }
        });
        
        resultsContent.innerHTML = html;
        
    } else {
        // Quick analysis
        resultsContent.innerHTML = `
            <div class="result-card">
                <div class="result-title">Category</div>
                <div class="result-value">${data.category} (${Math.round(data.confidence * 100)}% confidence)</div>
            </div>
            <div class="result-card">
                <div class="result-title">Description</div>
                <div class="result-value">${data.caption}</div>
            </div>
        `;
    }

    // Reveal draft panel if we already created one before
    if (lastDraftObject) {
        draftResults.classList.remove('hidden');
    }
}

function showError(message) {
    results.classList.remove('hidden');
    resultsContent.innerHTML = `<div class="error">${message}</div>`;
}

// === NEW: Create Draft Listing flow ===
createDraft.addEventListener('click', async () => {
    if (!currentImageBlob) {
        showError('Please capture or upload an image first');
        return;
    }

    const formData = new FormData();
    formData.append('file', currentImageBlob);
    const category = categorySelect.value;
    if (category) formData.append('manual_category', category);

    // progress UI
    const progress = showProgress();
    progress.update(35, '📤 Uploading image…');

    try {
        const url = `${API_BASE}/create-draft-listing`;
        const resp = await fetch(url, { method: 'POST', body: formData });
        progress.update(65, '🧭 Suggesting category…');

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }

        progress.update(85, '💵 Calculating suggested price…');

        const data = await resp.json();
        console.log('Draft API response:', data);

        if (!data.success) {
            throw new Error(data.error || 'Draft creation failed');
        }

        // Show draft info
        lastDraftObject = data.draft_listing || {};
        results.classList.remove('hidden');
        draftResults.classList.remove('hidden');

        const catName = (data.category_suggestion && data.category_suggestion.categoryName) || 'Unknown';
        const catId = (data.category_suggestion && data.category_suggestion.categoryId) || '—';
        const price = (typeof data.suggested_price === 'number')
            ? `$${data.suggested_price.toFixed(2)}`
            : `$${data.suggested_price || '—'}`;

        categoryNamePill.textContent = catName;
        categoryIdPill.textContent = `ID: ${catId}`;
        suggestedPricePill.textContent = price;
        draftJsonBlock.textContent = JSON.stringify(lastDraftObject, null, 2);

        progress.update(100, '✅ Draft ready!');
        await new Promise(r => setTimeout(r, 400));

    } catch (err) {
        console.error('Draft error:', err);
        showError(`Draft error: ${err.message}`);
    }
});

// Copy & Download handlers
copyDraftJson.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(draftJsonBlock.textContent);
        alert('Draft JSON copied to clipboard ✅');
    } catch (e) {
        alert('Failed to copy. You can select and copy manually.');
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

// === NEW: Dev tools quick tests ===
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

// Test API connection on startup
console.log('Testing API connection...');
fetch(`${API_BASE}/health`)
    .then(response => response.json())
    .then(data => {
        console.log('✅ API Health Check:', data);
        if (data.models_loaded === 0) {
            console.warn('⚠️ Warning: No models loaded in API');
        }
    })
    .catch(error => {
        console.error('❌ API connection failed:', error);
        showError('Cannot connect to AI service. Please check your internet connection and try again.');
    });
