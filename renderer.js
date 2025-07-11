let files = [];
let processing = false;
let paused = false;
let currentIndex = 0;

const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const clearBtn = document.getElementById('clear-btn');
const resultBody = document.getElementById('result-body');
const selectFilesBtn = document.getElementById('select-files');
const exportBtn = document.getElementById('export-btn');
const startBtnText = document.getElementById('start-btn-text');
const startSpinner = document.getElementById('start-spinner');

// Add modal for PDF preview
document.body.insertAdjacentHTML('beforeend', `
  <div id="pdf-modal" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">
    <div style="background:#fff;padding:16px;border-radius:8px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:flex-end;">
      <button id="close-pdf-modal" style="margin-bottom:8px;">Close</button>
      <embed id="pdf-embed" type="application/pdf" width="800" height="600" style="max-width:80vw;max-height:80vh;" />
    </div>
  </div>
`);

const pdfModal = document.getElementById('pdf-modal');
const pdfEmbed = document.getElementById('pdf-embed');
document.getElementById('close-pdf-modal').onclick = () => {
  pdfModal.style.display = 'none';
  pdfEmbed.removeAttribute('src');
};

function renderFileList() {
  fileList.innerHTML = '';
  files.forEach((file, idx) => {
    const li = document.createElement('li');
    li.textContent = `${idx + 1}. ${file.name}`;
    li.style.cursor = file.type === 'application/pdf' ? 'pointer' : 'default';
    if (file.type === 'application/pdf') {
      li.onclick = () => {
        const fileUrl = URL.createObjectURL(file);
        pdfEmbed.setAttribute('src', fileUrl);
        pdfModal.style.display = 'flex';
      };
    } else {
      li.onclick = null;
    }
    fileList.appendChild(li);
  });
}

function renderResults(results) {
  resultBody.innerHTML = '';
  results.forEach((res) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${res.SupplierName || ''}</td>
      <td>${res.City || ''}</td>
      <td>${res.BillNo || ''}</td>
      <td>${res.BillDate || ''}</td>
      <td>${res.Amount || ''}</td>
      <td>${res.TotalAmount || ''}</td>
    `;
    resultBody.appendChild(tr);
  });
}

let results = [];

function handleFiles(selectedFiles) {
  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    // Check for duplicates by name and size
    if (!files.some(f => f.name === file.name && f.size === file.size)) {
      files.push(file);
    }
  }
  renderFileList();
}

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

selectFilesBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function setProcessingState(isProcessing) {
  startBtn.disabled = isProcessing;
  pauseBtn.disabled = isProcessing;
  clearBtn.disabled = isProcessing;
  selectFilesBtn.disabled = isProcessing;
  fileInput.disabled = isProcessing;
  exportBtn.disabled = isProcessing;
  if (isProcessing) {
    startBtnText.textContent = '';
    startSpinner.style.display = '';
  } else {
    startBtnText.textContent = 'Start';
    startSpinner.style.display = 'none';
    startBtn.disabled = false;
    pauseBtn.disabled = false;
    clearBtn.disabled = false;
    selectFilesBtn.disabled = false;
    fileInput.disabled = false;
    exportBtn.disabled = false;
  }
}

startBtn.addEventListener('click', () => {
  if (files.length === 0) return;
  if (!processing) {
    processing = true;
    paused = false;
    pauseBtn.textContent = 'Pause';
    setProcessingState(true);
    processNextFile();
  }
});

async function callRealApi(file) {
  const formData = new FormData();
  formData.append('data', file);
  try {
    const response = await fetch('https://n8n.srv900112.hstgr.cloud/webhook/parse-file', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data;
  } catch (err) {
    return {
      SupplierName: 'Error',
      City: '-',
      BillNo: '-',
      BillDate: '-',
      Amount: '-',
      TotalAmount: '-',
    };
  }
}

async function processNextFile() {
  if (paused || !processing) {
    setProcessingState(false);
    return;
  }
  if (currentIndex >= files.length) {
    processing = false;
    currentIndex = 0;
    setProcessingState(false);
    return;
  }
  // Check if result exists and is not an error
  const existing = results[currentIndex];
  if (existing && existing.SupplierName !== 'Error') {
    currentIndex++;
    processNextFile();
    return;
  }
  const file = files[currentIndex];
  const res = await callRealApi(file);
  results[currentIndex] = res;
  renderResults(results);
  currentIndex++;
  processNextFile();
}

pauseBtn.addEventListener('click', () => {
  if (processing) return; // Prevent pause during processing
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  if (!paused && processing) {
    processNextFile();
  }
});

clearBtn.addEventListener('click', () => {
  if (processing) return; // Prevent clear during processing
  files = [];
  results = [];
  currentIndex = 0;
  renderFileList();
  renderResults(results);
});

function exportResultsToCSV() {
  const headers = [
    'InwardNo', 'Inward Date', 'Supplier Name', 'City', 'PO No', 'PO Date', 'Bill No', 'Bill Date', 'Challan No', 'Challan Date', 'freight', 'Loading', 'Packing', 'Amount', 'Total Amount', ' ', 'Remarks'
  ];
  const rows = results.map((res, idx) => [
    '',
    '',
    res.SupplierName || '',
    res.City || '',
    '', // PO No
    '', // PO Date
    res.BillNo || '',
    res.BillDate || '',
    '', // Challan No
    '', // Challan Date
    '', // freight
    '', // Loading
    '', // Packing
    res.Amount || '',
    res.TotalAmount || '',
    '',
    '' // Remarks
  ]);
  let csvContent = 'Bill Inward Detail\n'; // ✅ your custom note
  csvContent += headers.join(',') + '\n';

  rows.forEach(row => {
    csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bill_inward_detail.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener('click', exportResultsToCSV); 