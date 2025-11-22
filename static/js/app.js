const API_BASE = '/api';
let currentMode = 'normalize';
let lastResult = null;
let fileInput, fileName;

// Initialize when DOM is ready
function initializeApp() {
    // Mode selector
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentMode = e.target.value;
            clearResults();
        });
    });

    // Buttons
    document.getElementById('processBtn').addEventListener('click', processText);
    document.getElementById('clearBtn').addEventListener('click', clearResults);
    document.getElementById('downloadBtn').addEventListener('click', downloadResults);

    // File upload handling
    fileInput = document.getElementById('fileInput');
    fileName = document.getElementById('fileName');
    
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
        console.log('File input event listener attached');
    } else {
        console.error('File input element not found');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already ready
    initializeApp();
}

async function processText() {
    const inputText = document.getElementById('inputText').value.trim();

    if (!inputText) {
        showError('Please enter text to process');
        return;
    }

    // Split by newlines and filter empty lines
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const isBatchMode = lines.length > 1;

    showLoading(true);
    hideError();

    try {
        let endpoint;
        let requestBody;

        if (isBatchMode) {
            // Use batch processing endpoint
            endpoint = `${API_BASE}/batch-process`;
            requestBody = {
                texts: lines,
                mode: currentMode,
                device: 'cpu'
            };
        } else {
            // Use single text endpoint
            endpoint = currentMode === 'normalize' ? `${API_BASE}/normalize` : `${API_BASE}/detect-nsw`;
            requestBody = {
                text: lines[0],
                device: 'cpu'
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.error || `HTTP error! status: ${response.status}`;
            throw new Error(message);
        }

        const data = await response.json();
        lastResult = data;
        displayResults(data, isBatchMode);

    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayResults(data, isBatchMode = false) {
    const resultContent = document.getElementById('resultContent');

    if (isBatchMode) {
        // Batch processing results
        let resultsHtml = `<div class="batch-results">`;
        resultsHtml += `<div class="batch-summary">`;
        resultsHtml += `<p><strong>Processed ${data.total_texts} text(s)</strong> in ${(data.total_processing_time * 1000).toFixed(2)}ms</p>`;
        resultsHtml += `</div>`;

        data.results.forEach((result, idx) => {
            if (data.mode === 'normalize') {
                resultsHtml += `
                    <div class="result-card batch-item">
                        <div class="batch-item-header">
                            <span class="batch-item-number">#${idx + 1}</span>
                        </div>
                        <div class="batch-item-content">
                            <h4>Original:</h4>
                            <p class="text-original">${escapeHtml(result.original)}</p>
                            <h4>Normalized:</h4>
                            <p class="text-normalized">${escapeHtml(result.normalized)}</p>
                            <p class="processing-time">Time: ${(result.processing_time * 1000).toFixed(2)}ms</p>
                        </div>
                    </div>
                `;
            } else {
                // NSW Detection mode for batch
                resultsHtml += `
                    <div class="result-card batch-item">
                        <div class="batch-item-header">
                            <span class="batch-item-number">#${idx + 1}</span>
                        </div>
                        <div class="batch-item-content">
                            <h4>Text:</h4>
                            <p class="text-original">${escapeHtml(result.text || result.original || '')}</p>
                            <p>Found <strong>${result.nsw_count || 0}</strong> non-standard words</p>`;
                
                if (result.results && result.results.length > 0) {
                    result.results.forEach((nswResult, nswIdx) => {
                        resultsHtml += `
                            <div class="nsw-item">
                                <p><strong>NSW ${nswIdx + 1}:</strong> "${escapeHtml(nswResult.nsw)}"</p>
                                <p><strong>Prediction:</strong> "${escapeHtml(nswResult.prediction)}"</p>
                                <p><strong>Confidence:</strong> ${(nswResult.confidence_score * 100).toFixed(2)}%</p>
                            </div>
                        `;
                    });
                }
                
                resultsHtml += `
                            <p class="processing-time">Time: ${(result.processing_time * 1000).toFixed(2)}ms</p>
                        </div>
                    </div>
                `;
            }
        });

        resultContent.innerHTML = resultsHtml + `</div>`;
    } else {
        // Single text processing results
        if (currentMode === 'normalize') {
            resultContent.innerHTML = `
                <div class="result-card">
                    <h3>Original Text</h3>
                    <p class="text-original">${escapeHtml(data.original_text)}</p>

                    <h3>Normalized Text</h3>
                    <p class="text-normalized">${escapeHtml(data.normalized_text)}</p>

                    <p class="processing-time">
                        Processing time: ${(data.processing_time * 1000).toFixed(2)}ms
                    </p>
                </div>
            `;
        } else {
            let resultsHtml = `<div class="result-card">`;
            resultsHtml += `<p>Found <strong>${data.nsw_count}</strong> non-standard words</p>`;

            data.results.forEach((result, idx) => {
                resultsHtml += `
                    <div class="nsw-item">
                        <p><strong>NSW ${idx + 1}:</strong> "${escapeHtml(result.nsw)}"</p>
                        <p><strong>Prediction:</strong> "${escapeHtml(result.prediction)}"</p>
                        <p><strong>Confidence:</strong> ${(result.confidence_score * 100).toFixed(2)}%</p>
                    </div>
                `;
            });

            resultContent.innerHTML = resultsHtml + `</div>`;
        }
    }

    document.getElementById('results').style.display = 'block';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
}

function hideError() {
    document.getElementById('errorMsg').style.display = 'none';
}

function clearResults() {
    document.getElementById('inputText').value = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('resultContent').innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (fileName) fileName.textContent = '';
    hideFileStatus();
    showFileLoadedBadge(false);
    hideError();
    lastResult = null;
}

function downloadResults() {
    if (!lastResult) {
        showError('Run a request before downloading results.');
        return;
    }

    const format = document.getElementById('downloadFormat').value;
    const text = document.getElementById('inputText').value;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const isBatchMode = lines.length > 1;

    let content, mimeType, filename;

    switch (format) {
        case 'csv':
            content = formatAsCSV(isBatchMode);
            mimeType = 'text/csv;charset=utf-8;';
            filename = 'visolex_results.csv';
            break;
        case 'json':
            content = formatAsJSON(isBatchMode, text);
            mimeType = 'application/json;charset=utf-8;';
            filename = 'visolex_results.json';
            break;
        case 'txt':
        default:
            content = formatAsTXT(isBatchMode, text);
            mimeType = 'text/plain;charset=utf-8;';
            filename = 'visolex_results.txt';
            break;
    }

    // Add BOM for UTF-8 CSV to ensure Excel opens it correctly
    if (format === 'csv') {
        const BOM = '\uFEFF';
        content = BOM + content;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.setAttribute('href', url);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
}

function formatAsTXT(isBatchMode, inputText) {
    let blobContent = [];
    blobContent.push(`Mode: ${currentMode}`);
    blobContent.push(`Batch Processing: ${isBatchMode ? 'Yes' : 'No'}`);
    blobContent.push('');
    blobContent.push('Input:');
    blobContent.push(inputText);
    blobContent.push('');
    blobContent.push('Results:');

    if (isBatchMode && lastResult.results) {
        lastResult.results.forEach((result, idx) => {
            blobContent.push(`\n--- Result ${idx + 1} ---`);
            if (currentMode === 'normalize') {
                blobContent.push(`Original: ${result.original}`);
                blobContent.push(`Normalized: ${result.normalized}`);
                blobContent.push(`Processing Time: ${(result.processing_time * 1000).toFixed(2)}ms`);
            } else {
                blobContent.push(`Text: ${result.text || result.original || ''}`);
                blobContent.push(`NSW Count: ${result.nsw_count || 0}`);
                if (result.results && result.results.length > 0) {
                    result.results.forEach((nsw, nswIdx) => {
                        blobContent.push(`  NSW ${nswIdx + 1}: "${nsw.nsw}" -> "${nsw.prediction}" (${(nsw.confidence_score * 100).toFixed(2)}%)`);
                    });
                }
                blobContent.push(`Processing Time: ${(result.processing_time * 1000).toFixed(2)}ms`);
            }
        });
        blobContent.push(`\n--- Summary ---`);
        blobContent.push(`Total Texts: ${lastResult.total_texts}`);
        blobContent.push(`Total Processing Time: ${(lastResult.total_processing_time * 1000).toFixed(2)}ms`);
    } else {
        blobContent.push(JSON.stringify(lastResult, null, 2));
    }

    return blobContent.join('\n');
}

function formatAsCSV(isBatchMode) {
    const rows = [];
    
    if (isBatchMode && lastResult.results) {
        // CSV Header
        if (currentMode === 'normalize') {
            rows.push('Index,Original Text,Normalized Text,Processing Time (ms)');
            lastResult.results.forEach((result, idx) => {
                const original = escapeCSV(result.original);
                const normalized = escapeCSV(result.normalized);
                const time = (result.processing_time * 1000).toFixed(2);
                rows.push(`${idx + 1},"${original}","${normalized}",${time}`);
            });
        } else {
            // NSW Detection: Each NSW on a separate row
            rows.push('Index,Text,NSW Count,NSW,Prediction,Confidence (%),Processing Time (ms)');
            lastResult.results.forEach((result, idx) => {
                const text = escapeCSV(result.text || result.original || '');
                const nswCount = result.nsw_count || 0;
                const time = (result.processing_time * 1000).toFixed(2);
                
                if (result.results && result.results.length > 0) {
                    // Create a row for each NSW with complete information
                    result.results.forEach((nsw) => {
                        const nswText = escapeCSV(nsw.nsw);
                        const prediction = escapeCSV(nsw.prediction);
                        const confidence = (nsw.confidence_score * 100).toFixed(2);
                        rows.push(`${idx + 1},"${text}",${nswCount},"${nswText}","${prediction}",${confidence},${time}`);
                    });
                } else {
                    // No NSWs found, but still show the text
                    rows.push(`${idx + 1},"${text}",0,,,${time}`);
                }
            });
        }
        // Add summary row
        rows.push('');
        rows.push(`Summary,Total Texts: ${lastResult.total_texts},Total Time: ${(lastResult.total_processing_time * 1000).toFixed(2)}ms,`);
    } else {
        // Single result
        if (currentMode === 'normalize') {
            rows.push('Original Text,Normalized Text,Processing Time (ms)');
            rows.push(`"${escapeCSV(lastResult.original_text)}","${escapeCSV(lastResult.normalized_text)}",${(lastResult.processing_time * 1000).toFixed(2)}`);
        } else {
            // NSW Detection: Each NSW on a separate row
            rows.push('Text,NSW Count,NSW,Prediction,Confidence (%)');
            if (lastResult.results && lastResult.results.length > 0) {
                // Create a row for each NSW with complete information
                lastResult.results.forEach((nsw) => {
                    const text = escapeCSV(lastResult.text);
                    const nswText = escapeCSV(nsw.nsw);
                    const prediction = escapeCSV(nsw.prediction);
                    const confidence = (nsw.confidence_score * 100).toFixed(2);
                    rows.push(`"${text}",${lastResult.nsw_count},"${nswText}","${prediction}",${confidence}`);
                });
            } else {
                rows.push(`"${escapeCSV(lastResult.text)}",0,,,`);
            }
        }
    }
    
    return rows.join('\n');
}

function formatAsJSON(isBatchMode, inputText) {
    const output = {
        mode: currentMode,
        batch_processing: isBatchMode,
        input: inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0),
        results: null
    };

    if (isBatchMode && lastResult.results) {
        output.results = {
            total_texts: lastResult.total_texts,
            total_processing_time: lastResult.total_processing_time,
            items: lastResult.results.map((result, idx) => {
                const item = {
                    index: idx + 1,
                    processing_time: result.processing_time
                };
                
                if (currentMode === 'normalize') {
                    item.original = result.original;
                    item.normalized = result.normalized;
                } else {
                    item.text = result.text || result.original || '';
                    item.nsw_count = result.nsw_count || 0;
                    item.nsw_results = (result.results || []).map(nsw => ({
                        nsw: nsw.nsw,
                        prediction: nsw.prediction,
                        confidence_score: nsw.confidence_score
                    }));
                }
                return item;
            })
        };
    } else {
        output.results = lastResult;
    }

    return JSON.stringify(output, null, 2);
}

function escapeCSV(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    // Escape double quotes by doubling them
    return str.replace(/"/g, '""');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    const fileNameDisplay = document.getElementById('fileName');
    const fileStatusDisplay = document.getElementById('fileStatus');
    const textarea = document.getElementById('inputText');
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // Reset status and clear previous content
    hideFileStatus();
    hideError();
    fileNameDisplay.textContent = '';
    showFileLoadedBadge(false);

    // Validate file type
    if (fileExtension !== 'txt' && fileExtension !== 'csv') {
        const errorMsg = 'Invalid file type. Please upload a .txt or .csv file';
        showFileStatus(errorMsg, 'error');
        showError(errorMsg);
        fileInput.value = '';
        return;
    }

    // Show file name and loading status immediately
    fileNameDisplay.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    showFileStatus('⏳ Reading file...', 'loading');

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            console.log('File read successfully, length:', e.target.result.length);
            const content = e.target.result;
            let textContent = '';

            if (fileExtension === 'txt') {
                // For .txt files, use the content directly
                textContent = content;
                console.log('TXT file processed, lines:', textContent.split('\n').length);
            } else if (fileExtension === 'csv') {
                // For .csv files, parse and extract text
                textContent = parseCSVFile(content);
                console.log('CSV file processed, lines:', textContent.split('\n').length);
            }

            // Check if content is empty
            if (!textContent || textContent.trim().length === 0) {
                const errorMsg = 'File is empty or contains no valid data';
                showFileStatus('❌ ' + errorMsg, 'error');
                showError(errorMsg);
                fileNameDisplay.textContent = '';
                fileInput.value = '';
                textarea.value = '';
                return;
            }

            // Update the textarea with the loaded content
            const trimmedContent = textContent.trim();
            textarea.value = trimmedContent;
            console.log('Textarea updated with', trimmedContent.length, 'characters');
            console.log('First 100 chars:', trimmedContent.substring(0, 100));
            
            // Show success status
            const lineCount = trimmedContent.split('\n').filter(line => line.trim().length > 0).length;
            showFileStatus(`✅ Successfully loaded ${lineCount} line(s) - Ready to process!`, 'success');
            
            // Show file loaded badge
            showFileLoadedBadge(true);
            
            // Clear results if any
            document.getElementById('results').style.display = 'none';
            document.getElementById('resultContent').innerHTML = '';
            lastResult = null;
            
            // Scroll textarea into view and highlight
            textarea.focus();
            textarea.scrollTop = 0;
            textarea.style.borderColor = 'var(--success-color)';
            setTimeout(() => {
                textarea.style.borderColor = '';
            }, 2000);
        } catch (error) {
            console.error('Error processing file:', error);
            showFileStatus('❌ Error processing file: ' + error.message, 'error');
            showError(`Error reading file: ${error.message}`);
            fileNameDisplay.textContent = '';
            fileInput.value = '';
            textarea.value = '';
            showFileLoadedBadge(false);
        }
    };

    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showFileStatus('❌ Error reading file', 'error');
        showError('Error reading file. Please try again.');
        fileNameDisplay.textContent = '';
        fileInput.value = '';
        textarea.value = '';
        showFileLoadedBadge(false);
    };

    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 100);
            showFileStatus(`⏳ Reading file... ${percentLoaded}%`, 'loading');
        }
    };

    // Read file as text with UTF-8 encoding
    reader.readAsText(file, 'UTF-8');
}

function showFileStatus(message, type) {
    const fileStatusDisplay = document.getElementById('fileStatus');
    if (!fileStatusDisplay) {
        console.error('fileStatus element not found');
        return;
    }
    
    fileStatusDisplay.textContent = message;
    fileStatusDisplay.className = 'file-status-message';
    
    // Remove all status classes first
    fileStatusDisplay.classList.remove('status-success', 'status-error', 'status-loading');
    
    // Add the appropriate status class
    if (type === 'success') {
        fileStatusDisplay.classList.add('status-success');
    } else if (type === 'error') {
        fileStatusDisplay.classList.add('status-error');
    } else if (type === 'loading') {
        fileStatusDisplay.classList.add('status-loading');
    }
    
    // Make sure it's visible
    fileStatusDisplay.style.display = 'block';
    console.log('Status message shown:', message, type);
}

function hideFileStatus() {
    const fileStatusDisplay = document.getElementById('fileStatus');
    fileStatusDisplay.textContent = '';
    fileStatusDisplay.className = 'file-status-message';
}

function showFileLoadedBadge(show) {
    const badge = document.getElementById('fileLoadedBadge');
    if (show) {
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function parseCSVFile(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const textLines = [];

    lines.forEach((line, index) => {
        // Skip header row (first line)
        if (index === 0 && lines.length > 1) {
            // Check if first line looks like a header (contains common CSV header keywords)
            const headerKeywords = ['text', 'sentence', 'input', 'original', 'content', 'data'];
            const firstLineLower = line.toLowerCase();
            const isHeader = headerKeywords.some(keyword => firstLineLower.includes(keyword));
            if (isHeader) {
                return; // Skip header
            }
        }

        // Parse CSV line (handle quoted fields)
        const parsed = parseCSVLine(line);
        
        // Extract text from first column (or use the whole line if it's not CSV-formatted)
        if (parsed.length > 0) {
            // Use the first non-empty column as text
            const text = parsed.find(col => col.trim().length > 0) || parsed[0];
            if (text && text.trim().length > 0) {
                textLines.push(text.trim());
            }
        } else if (line.trim().length > 0) {
            // If parsing failed, use the line as-is
            textLines.push(line.trim());
        }
    });

    return textLines.join('\n');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Add last field
    result.push(current);
    return result;
}

