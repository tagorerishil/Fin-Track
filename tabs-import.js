// ===== STATEMENT IMPORT & SPENDING PATTERNS =====
// Parses CSV bank/credit card statements, auto-maps columns, imports to expenses

let parsedCSVData = [];
let csvHeaders = [];
let columnMapping = { date: -1, desc: -1, debit: -1, credit: -1, amount: -1 };

// ===== CSV PARSING =====
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect delimiter from the line with the most columns
    let delim = ',';
    let maxCols = 0;
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const commas = splitCSVLine(lines[i], ',').length;
        const tabs = splitCSVLine(lines[i], '\t').length;
        const best = Math.max(commas, tabs);
        if (best > maxCols) {
            maxCols = best;
            delim = tabs > commas ? '\t' : ',';
        }
    }

    // Find the ACTUAL header row by looking for banking keywords
    // Bank CSVs often have preamble: account name, number, period, etc.
    const headerKeywords = ['date', 'description', 'narration', 'particulars', 'details',
        'debit', 'credit', 'withdrawal', 'deposit', 'amount', 'balance',
        'txn', 'transaction', 'value', 'posting', 'remarks', 'ref', 'chq'];

    let headerIdx = 0;
    let bestScore = 0;

    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const cols = splitCSVLine(lines[i], delim);
        if (cols.length < 3) continue; // Skip rows with too few columns

        const lowerCols = cols.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
        let score = 0;
        lowerCols.forEach(col => {
            if (headerKeywords.some(kw => col.includes(kw))) score++;
        });

        // Also check if this row has mostly text (headers) vs numbers (data)
        const textCols = cols.filter(c => c && isNaN(c.replace(/[,₹Rs.\s]/g, '')) && c.length > 1).length;
        if (score > 0) score += textCols * 0.5;

        if (score > bestScore) {
            bestScore = score;
            headerIdx = i;
        }
    }

    // If no header found with keywords, try to find the first row with 3+ columns
    if (bestScore === 0) {
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const cols = splitCSVLine(lines[i], delim);
            if (cols.length >= 3) { headerIdx = i; break; }
        }
    }

    const headers = splitCSVLine(lines[headerIdx], delim);
    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i], delim);
        // Only include rows with similar column count to headers (±2)
        if (cols.length >= headers.length - 2 && cols.some(c => c.trim())) {
            // Pad or trim to match header length
            while (cols.length < headers.length) cols.push('');
            rows.push(cols.slice(0, headers.length));
        }
    }
    return { headers, rows };
}

function splitCSVLine(line, delim) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === delim && !inQuotes) { result.push(current.trim()); current = ''; continue; }
        current += ch;
    }
    result.push(current.trim());
    return result;
}

// ===== AUTO-DETECT COLUMNS =====
function autoDetectColumns(headers) {
    const mapping = { date: -1, desc: -1, debit: -1, credit: -1, amount: -1 };
    const lower = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Date patterns
    const dateKeys = ['date', 'txndate', 'transactiondate', 'valuedate', 'postdate', 'postingdate', 'txndt'];
    lower.forEach((h, i) => { if (dateKeys.some(k => h.includes(k)) && mapping.date === -1) mapping.date = i; });
    if (mapping.date === -1) lower.forEach((h, i) => { if (h.includes('date')) mapping.date = i; });

    // Description patterns  
    const descKeys = ['description', 'narration', 'particulars', 'details', 'remarks', 'txndescription', 'merchant', 'transactiondetails'];
    lower.forEach((h, i) => { if (descKeys.some(k => h.includes(k)) && mapping.desc === -1) mapping.desc = i; });

    // Amount patterns
    const debitKeys = ['debit', 'withdrawal', 'withdrawalamount', 'debitamount', 'dr'];
    const creditKeys = ['credit', 'deposit', 'depositamount', 'creditamount', 'cr'];
    const amtKeys = ['amount', 'transactionamount', 'txnamount'];
    
    lower.forEach((h, i) => { if (debitKeys.some(k => h.includes(k)) && mapping.debit === -1) mapping.debit = i; });
    lower.forEach((h, i) => { if (creditKeys.some(k => h.includes(k)) && mapping.credit === -1) mapping.credit = i; });
    lower.forEach((h, i) => { if (amtKeys.some(k => h === k) && mapping.amount === -1) mapping.amount = i; });

    return mapping;
}

// ===== UPLOAD ZONE =====
const uploadZone = document.getElementById('uploadZone');
const csvFileInput = document.getElementById('csvFileInput');

uploadZone.addEventListener('click', () => csvFileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
csvFileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (file.name.match(/\.pdf$/i)) {
        handlePDF(file); return;
    }
    if (!file.name.match(/\.(csv|txt)$/i)) { alert('Please upload a PDF or CSV file.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        const { headers, rows } = parseCSV(e.target.result);
        if (rows.length === 0) { alert('No data rows found in the file.'); return; }
        csvHeaders = headers;
        parsedCSVData = rows;
        columnMapping = autoDetectColumns(headers);
        showColumnMapping();
        showPreview();
    };
    reader.readAsText(file);
}

// ===== PDF PARSING =====
let pdfExtractedTxns = [];
let currentPDFFileName = '';

async function handlePDF(file) {
    currentPDFFileName = file.name;
    const statusCard = document.getElementById('pdfStatusCard');
    const progressBar = document.getElementById('pdfProgressBar');
    const statusText = document.getElementById('pdfStatusText');
    statusCard.style.display = 'block';
    document.getElementById('pdfExtractCard').style.display = 'none';

    try {
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        let allText = [];

        for (let i = 1; i <= totalPages; i++) {
            progressBar.style.width = ((i / totalPages) * 100) + '%';
            statusText.textContent = `Extracting page ${i} of ${totalPages}...`;
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Group items by Y position to reconstruct lines
            const lineMap = {};
            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5]); // Y coordinate
                if (!lineMap[y]) lineMap[y] = [];
                lineMap[y].push({ x: item.transform[4], text: item.str });
            });

            // Sort lines by Y (top to bottom = descending Y)
            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
            sortedYs.forEach(y => {
                const items = lineMap[y].sort((a, b) => a.x - b.x);
                const lineText = items.map(it => it.text).join('  ').trim();
                if (lineText) allText.push(lineText);
            });
        }

        statusText.textContent = 'Parsing transactions...';
        pdfExtractedTxns = extractTransactionsFromText(allText);

        statusCard.style.display = 'none';

        if (pdfExtractedTxns.length === 0) {
            alert('Could not find transaction rows in this PDF. The format may not be recognized.\n\nTry downloading as CSV from your bank instead.');
            return;
        }

        showPDFPreview();
    } catch (err) {
        statusCard.style.display = 'none';
        console.error('PDF parse error:', err);
        alert('Error reading PDF: ' + err.message + '\n\nTry downloading as CSV instead.');
    }
}

function extractTransactionsFromText(lines) {
    const txns = [];

    // Date patterns commonly found in Indian bank/CC statements
    // dd/mm/yyyy, dd-mm-yyyy, dd Mon yyyy, dd-Mon-yyyy, dd/mm/yy
    const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,\-]*\d{2,4})/i;

    // Amount pattern: require comma-formatted or decimal amounts (not bare single/double digits)
    // Matches: 1,234.56  500.00  1,23,456.78  234.5  1,500
    const amountRegex = /(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2})/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const dateMatch = line.match(dateRegex);
        if (!dateMatch) continue;

        const rawDate = dateMatch[1];
        const parsedDate = parseFlexDate(rawDate);
        if (!parsedDate) continue;

        // Extract rest of line after date
        let rest = line.slice(dateMatch[0].length).trim();

        // Sometimes the next line is part of the same transaction (description continuation)
        // Peek at next line - if it doesn't start with a date, merge it
        if (i + 1 < lines.length && !dateRegex.test(lines[i + 1].trim())) {
            const nextLine = lines[i + 1].trim();
            // Only merge if it doesn't look like a header or too short
            if (nextLine.length > 3 && nextLine.length < 200) {
                rest += '  ' + nextLine;
            }
        }

        // Find all amounts in the line
        const amounts = [];
        let amtMatch;
        const amtCheckStr = rest;
        amountRegex.lastIndex = 0; // Reset regex state
        while ((amtMatch = amountRegex.exec(amtCheckStr)) !== null) {
            const val = parseFloat(amtMatch[1].replace(/,/g, ''));
            if (val >= 5 && val < 10000000) amounts.push(val); // Min ₹5, max 1Cr
        }

        if (amounts.length === 0) continue;

        // Extract description: text before the first large number
        let desc = rest;
        // Remove all amounts from description
        amounts.forEach(a => {
            const formatted = a.toLocaleString('en-IN');
            desc = desc.replace(formatted, '').replace(a.toString(), '');
        });
        desc = cleanDesc(desc);
        if (desc.length < 2) desc = 'Transaction';

        // Determine which amount is the expense
        // Typically: if 2 amounts, first might be debit, second credit (or vice versa)
        // If 1 amount, use it
        // For balance columns, the last amount is usually balance - skip it if 3+ amounts
        let expAmount = 0;
        if (amounts.length === 1) {
            expAmount = amounts[0];
        } else if (amounts.length === 2) {
            // Could be debit + balance, or debit + credit
            expAmount = amounts[0]; // Usually first is the transaction amount
        } else if (amounts.length >= 3) {
            // Likely: debit, credit, balance - take the first non-zero as amount
            expAmount = amounts[0] || amounts[1];
        }

        if (expAmount > 0) {
            txns.push({
                date: parsedDate,
                desc: desc,
                amount: expAmount,
            });
        }
    }

    return txns;
}

function showPDFPreview() {
    const card = document.getElementById('pdfExtractCard');
    card.style.display = 'block';
    document.getElementById('pdfExtractInfo').textContent =
        `Found ${pdfExtractedTxns.length} transactions in "${currentPDFFileName}". Review below and click Import.`;

    const table = document.getElementById('pdfPreviewTable');
    table.querySelector('thead').innerHTML = '<tr><th>Date</th><th>Description</th><th>Amount</th><th>Include</th></tr>';
    table.querySelector('tbody').innerHTML = pdfExtractedTxns.map((t, i) => `<tr>
        <td>${new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${escapeHTML(t.desc)}</td>
        <td class="amount-cell">${fmt(t.amount)}</td>
        <td><input type="checkbox" class="pdf-txn-check" data-idx="${i}" checked></td>
    </tr>`).join('');
}

// PDF Import button
document.getElementById('pdfImportBtn').addEventListener('click', () => {
    const checks = document.querySelectorAll('.pdf-txn-check');
    const source = document.getElementById('pdfStmtSource').value;
    let imported = 0;

    checks.forEach(chk => {
        if (!chk.checked) return;
        const t = pdfExtractedTxns[parseInt(chk.dataset.idx)];
        if (!t) return;

        DATA.expenses.push({
            id: uid(),
            date: t.date,
            desc: t.desc,
            category: 'Life Infrastructure',
            amount: t.amount,
            payment: source === 'Credit Card' ? 'Credit Card' : 'Bank Transfer',
            type: 'Need',
            note: `Imported from ${source} PDF`,
        });
        imported++;
    });

    if (!DATA.importHistory) DATA.importHistory = [];
    DATA.importHistory.push({
        date: new Date().toISOString(),
        source: source + ' (PDF)',
        count: imported,
        file: currentPDFFileName,
    });

    saveData(DATA);
    document.getElementById('pdfExtractCard').style.display = 'none';
    pdfExtractedTxns = [];
    csvFileInput.value = '';

    alert(`✅ Imported ${imported} transactions from PDF! Go to Expenses tab to review and categorize.`);
    renderStatementsTab();
});

document.getElementById('pdfCancelBtn').addEventListener('click', () => {
    document.getElementById('pdfExtractCard').style.display = 'none';
    pdfExtractedTxns = [];
    csvFileInput.value = '';
});

// ===== COLUMN MAPPING UI =====
function showColumnMapping() {
    const card = document.getElementById('columnMapCard');
    card.style.display = 'block';
    document.getElementById('previewInfo').innerHTML = 
        `Found <strong>${parsedCSVData.length}</strong> data rows and <strong>${csvHeaders.length}</strong> columns.<br>
         <span style="color:var(--text-muted);font-size:12px">Detected headers: ${escapeHTML(csvHeaders.join(' | '))}</span>`;

    const grid = document.getElementById('columnMapGrid');
    const fields = [
        { key: 'date', label: 'Date Column', required: true },
        { key: 'desc', label: 'Description / Narration', required: true },
        { key: 'debit', label: 'Debit / Withdrawal Amount', required: false },
        { key: 'credit', label: 'Credit / Deposit Amount', required: false },
        { key: 'amount', label: 'Amount (if single column)', required: false },
    ];

    grid.innerHTML = fields.map(f => `
        <div class="form-group">
            <label>${f.label} ${f.required ? '<span style="color:#ef4444">*</span>' : ''}</label>
            <select id="map_${f.key}">
                <option value="-1">-- Skip --</option>
                ${csvHeaders.map((h, i) => `<option value="${i}" ${columnMapping[f.key] === i ? 'selected' : ''}>[${i+1}] ${escapeHTML(h)}</option>`).join('')}
            </select>
        </div>`).join('');

    // Show validation status
    updateMappingStatus();
    ['map_date','map_desc','map_debit','map_credit','map_amount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateMappingStatus);
    });
}

function updateMappingStatus() {
    const date = parseInt(document.getElementById('map_date')?.value ?? -1);
    const desc = parseInt(document.getElementById('map_desc')?.value ?? -1);
    const debit = parseInt(document.getElementById('map_debit')?.value ?? -1);
    const credit = parseInt(document.getElementById('map_credit')?.value ?? -1);
    const amount = parseInt(document.getElementById('map_amount')?.value ?? -1);
    
    const issues = [];
    if (date === -1) issues.push('Date column not selected');
    if (desc === -1) issues.push('Description column not selected');
    if (debit === -1 && credit === -1 && amount === -1) issues.push('No amount column selected');

    const info = document.getElementById('previewInfo');
    const statusHtml = issues.length > 0
        ? `<div style="margin-top:8px;color:#ef4444;font-size:13px">⚠️ ${issues.join(' • ')}</div>`
        : `<div style="margin-top:8px;color:#22c55e;font-size:13px">✅ All required columns mapped. Ready to import!</div>`;
    
    // Only update status part, preserve the original info
    const existingStatus = info.querySelector('.map-status');
    if (existingStatus) existingStatus.outerHTML = `<div class="map-status">${statusHtml}</div>`;
    else info.insertAdjacentHTML('beforeend', `<div class="map-status">${statusHtml}</div>`);
}

function showPreview() {
    const card = document.getElementById('previewCard');
    card.style.display = 'block';
    const table = document.getElementById('previewTable');
    table.querySelector('thead').innerHTML = '<tr>' + csvHeaders.map((h, i) => `<th>[${i+1}] ${escapeHTML(h)}</th>`).join('') + '</tr>';
    table.querySelector('tbody').innerHTML = parsedCSVData.slice(0, 10).map(row => 
        '<tr>' + row.map(c => `<td>${escapeHTML(c)}</td>`).join('') + '</tr>'
    ).join('');
}

// ===== IMPORT =====
document.getElementById('importBtn').addEventListener('click', () => {
    const mapping = {
        date: parseInt(document.getElementById('map_date').value),
        desc: parseInt(document.getElementById('map_desc').value),
        debit: parseInt(document.getElementById('map_debit').value),
        credit: parseInt(document.getElementById('map_credit').value),
        amount: parseInt(document.getElementById('map_amount').value),
    };

    if (mapping.date === -1 || mapping.desc === -1) {
        alert('Date and Description columns are required.'); return;
    }
    if (mapping.debit === -1 && mapping.credit === -1 && mapping.amount === -1) {
        alert('At least one amount column (Debit, Credit, or Amount) is required.'); return;
    }

    const source = document.getElementById('stmtSource').value;
    let imported = 0;
    let skipped = 0;

    parsedCSVData.forEach(row => {
        const rawDate = row[mapping.date] || '';
        const desc = row[mapping.desc] || '';
        if (!rawDate || !desc) return;

        // Parse date
        const parsedDate = parseFlexDate(rawDate);
        if (!parsedDate) return;

        // Parse amount - ONLY import debits (expenses), skip credits (income/salary)
        let amount = 0;
        if (mapping.debit !== -1 && mapping.credit !== -1) {
            // Both debit and credit columns mapped
            const deb = parseAmount(row[mapping.debit]);
            const cred = parseAmount(row[mapping.credit]);
            if (cred > 0 && deb === 0) {
                // This is a CREDIT transaction (salary, refund, deposit) — SKIP
                skipped++;
                return;
            }
            amount = deb;
        } else if (mapping.debit !== -1) {
            // Only debit column — use it directly
            amount = parseAmount(row[mapping.debit]);
        } else if (mapping.amount !== -1) {
            // Single amount column — negative means credit, positive means debit
            const raw = row[mapping.amount] || '';
            const val = parseFloat(raw.replace(/[^\d.-]/g, '')) || 0;
            if (val < 0) { skipped++; return; } // Negative = credit/income
            amount = Math.abs(val);
        }

        if (amount <= 0) return; // Skip zero amounts

        // Add as expense
        DATA.expenses.push({
            id: uid(),
            date: parsedDate,
            desc: cleanDesc(desc),
            category: 'Life Infrastructure',
            amount: amount,
            payment: source === 'Credit Card' ? 'Credit Card' : 'Bank Transfer',
            type: 'Need',
            note: `Imported from ${source}`,
        });
        imported++;
    });

    // Track import history
    if (!DATA.importHistory) DATA.importHistory = [];
    DATA.importHistory.push({
        date: new Date().toISOString(),
        source: source,
        count: imported,
        file: csvFileInput.files[0]?.name || 'unknown',
    });

    saveData(DATA);
    document.getElementById('columnMapCard').style.display = 'none';
    document.getElementById('previewCard').style.display = 'none';
    parsedCSVData = [];
    csvFileInput.value = '';

    alert(`✅ Imported ${imported} expense transactions!\n🚫 Skipped ${skipped} credit/income transactions (salary, refunds, etc.).\n\nGo to Expenses tab to review and categorize.`);
    renderStatementsTab();
});

function parseAmount(str) {
    if (!str) return 0;
    return Math.abs(parseFloat(str.replace(/[^\d.-]/g, '')) || 0);
}

function parseFlexDate(str) {
    str = str.trim();
    // Try ISO format first (yyyy-mm-dd)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str);
        return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
    // dd/mm/yyyy or dd-mm-yyyy
    const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
        let [, d, m, y] = match;
        if (y.length === 2) y = '20' + y;
        const day = parseInt(d), mon = parseInt(m);
        // If day > 12, assume dd/mm/yyyy. Otherwise could be mm/dd/yyyy for US
        if (day > 12) {
            return `${y}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        }
        // Assume dd/mm/yyyy for Indian banks
        return `${y}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    // Try native Date parse as fallback
    const d = new Date(str);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function cleanDesc(desc) {
    // Remove extra spaces, UPI IDs, long numbers
    return desc
        .replace(/\s+/g, ' ')
        .replace(/\d{10,}/g, '')
        .replace(/UPI\/\d+\//g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
}

// ===== RENDER STATEMENTS TAB =====
function renderStatementsTab() {
    const history = DATA.importHistory || [];
    const container = document.getElementById('importHistory');
    if (history.length === 0) {
        container.innerHTML = '<div class="table-empty">No imports yet. Upload a PDF or CSV above.</div>';
    } else {
        container.innerHTML = history.slice().reverse().map(h => `
            <div class="import-item">
                <div>
                    <strong>${escapeHTML(h.source)}</strong> — ${escapeHTML(h.file)}
                    <div class="import-meta">${new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span class="import-count">${h.count} transactions</span>
            </div>`).join('');
    }
}

// ===== SPENDING PATTERNS TAB =====
let monthlyTrendInst, categorySplitInst, typesTrendInst, weekOfMonthInst;

function renderPatternsTab() {
    const now = new Date();
    // Get 3 months of expenses
    const months = [];
    for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ m: d.getMonth(), y: d.getFullYear(), label: monthNames[d.getMonth()] + ' ' + d.getFullYear() });
    }

    const monthData = months.map(mo => ({
        ...mo,
        expenses: DATA.expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === mo.m && d.getFullYear() === mo.y;
        })
    }));

    const allExps = monthData.flatMap(m => m.expenses);
    const totalSpent = allExps.reduce((s, e) => s + e.amount, 0);
    const avgMonthly = totalSpent / 3;
    const totalTxns = allExps.length;

    // Summary cards
    document.getElementById('patternSummaryCards').innerHTML = `
        <div class="summary-card" style="--accent: #6366f1;">
            <div class="card-label">3-Month Total</div>
            <div class="card-value">${fmt(totalSpent)}</div>
            <div class="card-sub">${totalTxns} transactions</div>
        </div>
        <div class="summary-card" style="--accent: #f59e0b;">
            <div class="card-label">Avg Monthly Spend</div>
            <div class="card-value">${fmt(avgMonthly)}</div>
            <div class="card-sub">across 3 months</div>
        </div>
        <div class="summary-card" style="--accent: #22c55e;">
            <div class="card-label">Avg Per Transaction</div>
            <div class="card-value">${fmt(totalTxns > 0 ? totalSpent / totalTxns : 0)}</div>
            <div class="card-sub">${totalTxns} total txns</div>
        </div>
        <div class="summary-card" style="--accent: ${avgMonthly > DATA.salary ? '#ef4444' : '#22c55e'};">
            <div class="card-label">Avg vs Salary</div>
            <div class="card-value">${((avgMonthly / DATA.salary) * 100).toFixed(0)}%</div>
            <div class="card-sub">${avgMonthly > DATA.salary ? 'Over budget!' : 'Within budget'}</div>
        </div>`;

    // Monthly Spending Trend
    if (monthlyTrendInst) monthlyTrendInst.destroy();
    const ctx1 = document.getElementById('monthlyTrendChart').getContext('2d');
    monthlyTrendInst = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: monthData.map(m => m.label),
            datasets: [{
                label: 'Total Spent',
                data: monthData.map(m => m.expenses.reduce((s, e) => s + e.amount, 0)),
                backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
                borderColor: ['#6366f1', '#f59e0b', '#22c55e'],
                borderWidth: 2,
            }, {
                label: 'Salary',
                data: [DATA.salary, DATA.salary, DATA.salary],
                type: 'line', borderColor: '#ef4444', borderDash: [6, 4], borderWidth: 2,
                pointRadius: 0, fill: false,
            }]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8', callback: v => '₹' + (v/1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Category Split
    if (categorySplitInst) categorySplitInst.destroy();
    const cats = {};
    allExps.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const catColors = ['#6366f1','#f59e0b','#22c55e','#ec4899','#06b6d4','#a855f7','#ef4444'];
    const ctx2 = document.getElementById('categorySplitChart').getContext('2d');
    categorySplitInst = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: catColors, borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10 } } } }
    });

    // Top Merchants/Descriptions
    const descMap = {};
    allExps.forEach(e => {
        const key = e.desc.toLowerCase().replace(/\(fixed\)/g, '').trim();
        if (!descMap[key]) descMap[key] = { name: e.desc, count: 0, total: 0 };
        descMap[key].count++;
        descMap[key].total += e.amount;
    });
    const sorted = Object.values(descMap).sort((a, b) => b.total - a.total).slice(0, 10);
    const maxTotal = sorted.length > 0 ? sorted[0].total : 1;
    document.getElementById('topMerchants').innerHTML = sorted.map((m, i) => `
        <div class="merchant-item">
            <div class="merchant-rank">${i + 1}</div>
            <div class="merchant-info">
                <div class="merchant-name">${escapeHTML(m.name)}</div>
                <div class="merchant-freq">${m.count} time${m.count > 1 ? 's' : ''}</div>
            </div>
            <div class="merchant-total">${fmt(m.total)}</div>
            <div class="merchant-bar-wrap"><div class="merchant-bar" style="width:${(m.total/maxTotal*100)}%"></div></div>
        </div>`).join('') || '<div class="table-empty">No expense data yet.</div>';

    // Needs vs Wants vs Savings Trend
    if (typesTrendInst) typesTrendInst.destroy();
    const ctx3 = document.getElementById('typesTrendChart').getContext('2d');
    typesTrendInst = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: monthData.map(m => m.label),
            datasets: [
                { label: 'Needs', data: monthData.map(m => m.expenses.filter(e => e.type === 'Need').reduce((s, e) => s + e.amount, 0)), backgroundColor: 'rgba(59,130,246,0.7)' },
                { label: 'Wants', data: monthData.map(m => m.expenses.filter(e => e.type === 'Want').reduce((s, e) => s + e.amount, 0)), backgroundColor: 'rgba(245,158,11,0.7)' },
                { label: 'Savings', data: monthData.map(m => m.expenses.filter(e => e.type === 'Saving').reduce((s, e) => s + e.amount, 0)), backgroundColor: 'rgba(34,197,94,0.7)' },
            ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { stacked: true, ticks: { color: '#94a3b8', callback: v => '₹' + (v/1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Week of Month
    if (weekOfMonthInst) weekOfMonthInst.destroy();
    const weekTotals = [0, 0, 0, 0, 0]; // weeks 1-5
    allExps.forEach(e => {
        const day = new Date(e.date).getDate();
        const week = Math.min(4, Math.floor((day - 1) / 7));
        weekTotals[week] += e.amount;
    });
    const ctx4 = document.getElementById('weekOfMonthChart').getContext('2d');
    weekOfMonthInst = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: ['Week 1 (1-7)', 'Week 2 (8-14)', 'Week 3 (15-21)', 'Week 4 (22-28)', 'Week 5 (29-31)'],
            datasets: [{ label: 'Avg Spend', data: weekTotals.map(v => v / 3), backgroundColor: ['#6366f1','#a855f7','#ec4899','#f59e0b','#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8', callback: v => '₹' + v }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Spending Insights
    const insights = [];
    const m0 = monthData[0]?.expenses.reduce((s, e) => s + e.amount, 0) || 0;
    const m2 = monthData[2]?.expenses.reduce((s, e) => s + e.amount, 0) || 0;
    if (m0 > 0 && m2 > m0) {
        const pct = (((m2 - m0) / m0) * 100).toFixed(0);
        insights.push({ icon: '📈', text: `Spending increased by ${pct}% from ${escapeHTML(monthData[0].label)} to ${escapeHTML(monthData[2].label)}.`, color: '#ef4444' });
    } else if (m0 > 0 && m2 < m0) {
        const pct = (((m0 - m2) / m0) * 100).toFixed(0);
        insights.push({ icon: '📉', text: `Spending decreased by ${pct}% from ${escapeHTML(monthData[0].label)} to ${escapeHTML(monthData[2].label)}. Great job!`, color: '#22c55e' });
    }

    const needsTotal = allExps.filter(e => e.type === 'Need').reduce((s, e) => s + e.amount, 0);
    const wantsTotal = allExps.filter(e => e.type === 'Want').reduce((s, e) => s + e.amount, 0);
    if (wantsTotal > needsTotal * 0.6) {
        insights.push({ icon: '⚠️', text: `Wants spending (${fmt(wantsTotal)}) is over 60% of Needs (${fmt(needsTotal)}). Consider cutting discretionary expenses.`, color: '#f59e0b' });
    }

    const highWeek = weekTotals.indexOf(Math.max(...weekTotals));
    insights.push({ icon: '📅', text: `Week ${highWeek + 1} of the month has the highest spending. Consider budgeting extra for that period.`, color: '#6366f1' });

    if (avgMonthly > DATA.salary) {
        insights.push({ icon: '🚨', text: `Average monthly spend (${fmt(avgMonthly)}) exceeds salary (${fmt(DATA.salary)}). You're spending more than you earn!`, color: '#ef4444' });
    }

    if (sorted.length > 0) {
        insights.push({ icon: '🏪', text: `Your biggest expense category is "${escapeHTML(sorted[0].name)}" at ${fmt(sorted[0].total)} over 3 months.`, color: '#a855f7' });
    }

    document.getElementById('spendingInsights').innerHTML = insights.length > 0 
        ? '<div style="display:grid;gap:8px;">' + insights.map(i => 
            // Note: i.text now contains escaped strings where needed
            `<div class="remain-item" style="border-left:3px solid ${i.color}"><span class="remain-label">${i.icon} ${i.text}</span></div>`
        ).join('') + '</div>'
        : '<div class="table-empty">Add more expense data to see insights.</div>';
}
