// ===== DATA STORE =====
let _idCounter = Date.now();
function uid() { return 'e' + (_idCounter++); }

// ===== SECURITY ENHANCEMENT =====
// Sanitize user input to prevent Cross-Site Scripting (XSS)
window.escapeHTML = function(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const DEFAULT_DATA = {
    salary: 0,
    needsPct: 50, wantsPct: 30, savingsPct: 20,
    fixedExpenses: [],
    bike: { emi: 0, fuel: 0, insurance: 0, maintenance: 0 },
    expenses: [],
    emis: [],
};

function loadData() {
    const d = localStorage.getItem('fintrack_data');
    if (d) {
        const parsed = JSON.parse(d);
        // Migrate: add emis if missing
        if (!parsed.emis) parsed.emis = JSON.parse(JSON.stringify(DEFAULT_DATA.emis));
        // Migrate: add IDs to expenses if missing
        parsed.expenses.forEach(e => { if (!e.id) e.id = uid(); });
        // Migrate: add importHistory if missing
        if (!parsed.importHistory) parsed.importHistory = [];
        return parsed;
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function saveData(data) { localStorage.setItem('fintrack_data', JSON.stringify(data)); }

let DATA = loadData();
const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== NAVIGATION =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        link.classList.add('active');
        document.getElementById('tab-' + link.dataset.tab).classList.add('active');
        if (link.dataset.tab === 'dashboard') renderDashboard();
        if (link.dataset.tab === 'expenses') renderExpenses();
        if (link.dataset.tab === 'budget') renderBudgetSetup();
        if (link.dataset.tab === 'emi') renderEmiTab();
        if (link.dataset.tab === 'bike') renderBikeTab();
        if (link.dataset.tab === 'afford') renderAffordTab();
        if (link.dataset.tab === 'statements') renderStatementsTab();
        if (link.dataset.tab === 'patterns') renderPatternsTab();
        if (link.dataset.tab === 'monthly') renderMonthly();
    });
});

// ===== MONTH/YEAR SELECTORS =====
function populateSelectors() {
    const now = new Date();
    const monthSels = [document.getElementById('dashboardMonth'), document.getElementById('filterMonth'), document.getElementById('monthlyMonth')];
    const yearSels = [document.getElementById('dashboardYear'), document.getElementById('filterYear'), document.getElementById('monthlyYear')];
    monthSels.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        monthNames.forEach((m, i) => {
            const o = document.createElement('option');
            o.value = i; o.textContent = m;
            if (i === now.getMonth()) o.selected = true;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => { renderDashboard(); renderExpenses(); renderMonthly(); });
    });
    yearSels.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        for (let y = 2024; y <= 2030; y++) {
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            if (y === now.getFullYear()) o.selected = true;
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => { renderDashboard(); renderExpenses(); renderMonthly(); });
    });
}

function getSelectedMonth() { return parseInt(document.getElementById('dashboardMonth')?.value ?? new Date().getMonth()); }
function getSelectedYear() { return parseInt(document.getElementById('dashboardYear')?.value ?? new Date().getFullYear()); }
function getExpFilterMonth() { return parseInt(document.getElementById('filterMonth')?.value ?? new Date().getMonth()); }
function getExpFilterYear() { return parseInt(document.getElementById('filterYear')?.value ?? new Date().getFullYear()); }

function getMonthExpenses(m, y) {
    return DATA.expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === m && d.getFullYear() === y;
    });
}

// ===== DASHBOARD =====
let budgetChartInst, categoryChartInst;

function renderDashboard() {
    const m = getSelectedMonth(), y = getSelectedYear();
    const sal = DATA.salary;
    const totalEmi = (DATA.emis || []).reduce((s, e) => s + e.amount, 0);
    const disposable = sal - totalEmi;
    const needs = disposable * DATA.needsPct / 100;
    const wants = disposable * DATA.wantsPct / 100;
    const savings = disposable * DATA.savingsPct / 100;

    document.getElementById('dashSalary').textContent = fmt(sal);
    document.getElementById('dashEmi').textContent = fmt(totalEmi);
    document.getElementById('emiPct').textContent = sal > 0 ? ((totalEmi / sal) * 100).toFixed(0) : 0;
    document.getElementById('emiBar').style.width = sal > 0 ? Math.min(100, (totalEmi / sal * 100)) + '%' : '0%';
    document.getElementById('needsLbl').textContent = DATA.needsPct;
    document.getElementById('wantsLbl').textContent = DATA.wantsPct;
    document.getElementById('savingsLbl').textContent = DATA.savingsPct;
    document.getElementById('dashNeeds').textContent = fmt(needs);
    document.getElementById('dashWants').textContent = fmt(wants);
    document.getElementById('dashSavings').textContent = fmt(savings);

    const exps = getMonthExpenses(m, y);
    const needsSpent = exps.filter(e => e.type === 'Need').reduce((s, e) => s + e.amount, 0);
    const wantsSpent = exps.filter(e => e.type === 'Want').reduce((s, e) => s + e.amount, 0);
    const savingsSpent = exps.filter(e => e.type === 'Saving').reduce((s, e) => s + e.amount, 0);

    document.getElementById('needsSpent').textContent = fmt(needsSpent);
    document.getElementById('wantsSpent').textContent = fmt(wantsSpent);
    document.getElementById('savingsSpent').textContent = fmt(savingsSpent);

    document.getElementById('needsBar').style.width = needs > 0 ? Math.min(100, (needsSpent / needs * 100)) + '%' : '0%';
    document.getElementById('wantsBar').style.width = wants > 0 ? Math.min(100, (wantsSpent / wants * 100)) + '%' : '0%';
    document.getElementById('savingsBar').style.width = savings > 0 ? Math.min(100, (savingsSpent / savings * 100)) + '%' : '0%';

    // Fixed expenses list
    const fixedList = document.getElementById('fixedExpensesList');
    fixedList.innerHTML = DATA.fixedExpenses.map(f => `
        <div class="fixed-item">
            <div><span class="fixed-item-name">${escapeHTML(f.name)}</span><span class="fixed-item-type type-${escapeHTML(f.type).toLowerCase()}">${escapeHTML(f.type)}</span></div>
            <span class="fixed-item-amount">${fmt(f.amount)}</span>
        </div>`).join('');
    const fixedTotal = DATA.fixedExpenses.reduce((s, f) => s + f.amount, 0);
    document.getElementById('fixedTotal').textContent = fmt(fixedTotal);

    // Remaining info
    const totalSpent = needsSpent + wantsSpent + savingsSpent;
    const remaining = sal - totalEmi - totalSpent;
    const ri = document.getElementById('remainingInfo');
    ri.innerHTML = `
        <div class="remain-item"><span class="remain-label">Monthly EMIs</span><span class="remain-value negative">${fmt(totalEmi)}</span></div>
        <div class="remain-item"><span class="remain-label">Disposable Income</span><span class="remain-value">${fmt(disposable)}</span></div>
        <div class="remain-item"><span class="remain-label">Total Spent (excl EMI)</span><span class="remain-value">${fmt(totalSpent)}</span></div>
        <div class="remain-item"><span class="remain-label">Needs Remaining</span><span class="remain-value ${needs - needsSpent >= 0 ? 'positive' : 'negative'}">${fmt(needs - needsSpent)}</span></div>
        <div class="remain-item"><span class="remain-label">Wants Remaining</span><span class="remain-value ${wants - wantsSpent >= 0 ? 'positive' : 'negative'}">${fmt(wants - wantsSpent)}</span></div>
        <div class="remain-item"><span class="remain-label">Savings Remaining</span><span class="remain-value ${savings - savingsSpent >= 0 ? 'positive' : 'negative'}">${fmt(savings - savingsSpent)}</span></div>
        <div class="remain-item"><span class="remain-label">Overall Remaining</span><span class="remain-value ${remaining >= 0 ? 'positive' : 'negative'}">${fmt(remaining)}</span></div>`;

    // Budget Chart - now includes EMI
    if (budgetChartInst) budgetChartInst.destroy();
    const ctx1 = document.getElementById('budgetChart').getContext('2d');
    budgetChartInst = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['EMIs', 'Needs', 'Wants', 'Savings'],
            datasets: [
                { label: 'Budget', data: [totalEmi, needs, wants, savings], backgroundColor: ['rgba(239,68,68,0.3)','rgba(59,130,246,0.3)','rgba(245,158,11,0.3)','rgba(34,197,94,0.3)'], borderColor: ['#ef4444','#3b82f6','#f59e0b','#22c55e'], borderWidth: 2 },
                { label: 'Spent', data: [totalEmi, needsSpent, wantsSpent, savingsSpent], backgroundColor: ['rgba(239,68,68,0.7)','rgba(59,130,246,0.7)','rgba(245,158,11,0.7)','rgba(34,197,94,0.7)'], borderColor: ['#ef4444','#3b82f6','#f59e0b','#22c55e'], borderWidth: 2 }
            ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8', callback: v => '₹' + (v/1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Category Chart
    if (categoryChartInst) categoryChartInst.destroy();
    const cats = {};
    exps.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    const catColors = ['#6366f1','#f59e0b','#22c55e','#ec4899','#06b6d4','#a855f7'];
    const ctx2 = document.getElementById('categoryChart').getContext('2d');
    categoryChartInst = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: catColors.slice(0, Object.keys(cats).length), borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12 } } } }
    });
}

// ===== EXPENSES TAB =====
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseForm = document.getElementById('expenseForm');
const saveExpenseBtn = document.getElementById('saveExpenseBtn');
const cancelExpenseBtn = document.getElementById('cancelExpenseBtn');
let editingIndex = null;

addExpenseBtn.addEventListener('click', () => {
    editingIndex = null;
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expDesc').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value = '';
    expenseForm.style.display = 'block';
});

cancelExpenseBtn.addEventListener('click', () => { expenseForm.style.display = 'none'; });

// Auto-set type based on category
document.getElementById('expCategory').addEventListener('change', function() {
    const typeMap = { 'Life Infrastructure': 'Need', 'Future Me': 'Saving', 'Performance & Growth': 'Need', 'Relationships & Generosity': 'Want', 'Lifestyle Enjoyment': 'Want' };
    document.getElementById('expType').value = typeMap[this.value] || 'Need';
});

saveExpenseBtn.addEventListener('click', () => {
    const exp = {
        date: document.getElementById('expDate').value,
        desc: document.getElementById('expDesc').value,
        category: document.getElementById('expCategory').value,
        amount: parseFloat(document.getElementById('expAmount').value) || 0,
        payment: document.getElementById('expPayment').value,
        type: document.getElementById('expType').value,
        note: document.getElementById('expNote').value,
    };
    if (!exp.date || !exp.desc || !exp.amount) return alert('Please fill date, description and amount.');
    if (editingIndex !== null) {
        const idx = DATA.expenses.findIndex(x => x.id === editingIndex);
        if (idx >= 0) { exp.id = editingIndex; DATA.expenses[idx] = exp; }
    } else { exp.id = uid(); DATA.expenses.push(exp); }
    saveData(DATA);
    expenseForm.style.display = 'none';
    renderExpenses();
    renderDashboard();
});

document.getElementById('filterCategory').addEventListener('change', renderExpenses);
document.getElementById('filterType').addEventListener('change', renderExpenses);

function renderExpenses() {
    const m = getExpFilterMonth(), y = getExpFilterYear();
    let exps = getMonthExpenses(m, y);
    const catF = document.getElementById('filterCategory').value;
    const typeF = document.getElementById('filterType').value;
    if (catF !== 'All') exps = exps.filter(e => e.category === catF);
    if (typeF !== 'All') exps = exps.filter(e => e.type === typeF);
    exps.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('expenseTableBody');
    const empty = document.getElementById('tableEmpty');
    if (exps.length === 0) {
        tbody.innerHTML = ''; empty.style.display = 'block';
        document.getElementById('bulkEditBar').style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = exps.map(e => {
        const typeClass = e.type === 'Need' ? 'type-need' : e.type === 'Want' ? 'type-want' : 'type-saving';
        return `<tr>
            <td><input type="checkbox" class="exp-check" data-id="${e.id}"></td>
            <td>${new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
            <td>${escapeHTML(e.desc)}</td><td>${escapeHTML(e.category)}</td>
            <td class="amount-cell">${fmt(e.amount)}</td>
            <td>${escapeHTML(e.payment)}</td>
            <td><span class="type-badge ${typeClass}">${escapeHTML(e.type)}</span></td>
            <td>${escapeHTML(e.note) || '-'}</td>
            <td><button class="btn-edit" onclick="editExpense('${e.id}')">✏️</button><button class="btn-delete" onclick="deleteExpense('${e.id}')">🗑️</button></td>
        </tr>`;
    }).join('');

    // Add select-all listener
    document.querySelectorAll('.exp-check').forEach(chk => {
        chk.addEventListener('change', updateBulkBar);
    });
}

// Custom modal-based delete
let pendingDeleteId = null;
let pendingDeleteType = null; // 'expense' or 'emi'
const deleteModal = document.getElementById('deleteModal');

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    if (pendingDeleteType === 'expense' && pendingDeleteId) {
        DATA.expenses = DATA.expenses.filter(x => x.id !== pendingDeleteId);
        saveData(DATA); renderExpenses(); renderDashboard();
    } else if (pendingDeleteType === 'emi' && pendingDeleteId) {
        DATA.emis = DATA.emis.filter(x => x.id !== pendingDeleteId);
        saveData(DATA);
        if (typeof renderEmiTab === 'function') renderEmiTab();
        renderDashboard();
    } else if (pendingDeleteType === 'deleteAll') {
        DATA.expenses = [];
        saveData(DATA); renderExpenses(); renderDashboard();
    } else if (pendingDeleteType === 'deleteAllEmis') {
        DATA.emis = [];
        saveData(DATA);
        if (typeof renderEmiTab === 'function') renderEmiTab();
        renderDashboard();
        if (typeof renderBudgetSetup === 'function') renderBudgetSetup();
    } else if (pendingDeleteType === 'resetAll') {
        // Clear everything — nuke from orbit
        localStorage.removeItem('fintrack_data');
        // Clear fixed_added flags
        Object.keys(localStorage).filter(k => k.startsWith('fixed_added_')).forEach(k => localStorage.removeItem(k));
        // Reload from clean defaults
        DATA = JSON.parse(JSON.stringify(DEFAULT_DATA));
        saveData(DATA);
        renderDashboard(); renderExpenses(); renderBudgetSetup();
        if (typeof renderEmiTab === 'function') renderEmiTab();
        if (typeof renderBikeTab === 'function') renderBikeTab();
        alert('All data has been reset. Start fresh!');
    }
    deleteModal.style.display = 'none';
    pendingDeleteId = null; pendingDeleteType = null;
});

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    deleteModal.style.display = 'none';
    pendingDeleteId = null; pendingDeleteType = null;
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.style.display = 'none';
        pendingDeleteId = null; pendingDeleteType = null;
    }
});

window.deleteExpense = function(id) {
    pendingDeleteId = id;
    pendingDeleteType = 'expense';
    const exp = DATA.expenses.find(x => x.id === id);
    document.getElementById('deleteModalMsg').textContent = 
        `Delete "${exp ? exp.desc : 'this expense'}"? This cannot be undone.`; // textContent is safe
    deleteModal.style.display = 'flex';
};

window.editExpense = function(id) {
    const e = DATA.expenses.find(x => x.id === id);
    if (!e) return;
    editingIndex = id;
    document.getElementById('expDate').value = e.date;
    document.getElementById('expDesc').value = e.desc;
    document.getElementById('expCategory').value = e.category;
    document.getElementById('expAmount').value = e.amount;
    document.getElementById('expPayment').value = e.payment;
    document.getElementById('expType').value = e.type;
    document.getElementById('expNote').value = e.note || '';
    expenseForm.style.display = 'block';
};

// ===== BUDGET SETUP =====
function renderBudgetSetup() {
    document.getElementById('setupSalary').value = DATA.salary;
    document.getElementById('setupNeeds').value = DATA.needsPct;
    document.getElementById('setupWants').value = DATA.wantsPct;
    document.getElementById('setupSavings').value = DATA.savingsPct;
    updateAllocationPreview();
    renderBudgetEmiSection();
    renderFixedSetup();
}

function renderBudgetEmiSection() {
    const emis = DATA.emis || [];
    const totalEmi = emis.reduce((s, e) => s + e.amount, 0);
    const sal = DATA.salary;
    const disposable = sal - totalEmi;

    document.getElementById('budgetEmiList').innerHTML = emis.length > 0
        ? emis.map(e => `
            <div class="fixed-item">
                <div><span class="fixed-item-name">${escapeHTML(e.name)}</span><span class="fixed-item-type" style="background:rgba(239,68,68,0.15);color:#ef4444">EMI</span></div>
                <span class="fixed-item-amount">${fmt(e.amount)}</span>
            </div>`).join('')
        : '<div class="table-empty" style="padding:12px">No EMIs added. Go to EMI Tracker to add.</div>';

    document.getElementById('budgetEmiTotal').textContent = fmt(totalEmi);
    document.getElementById('budgetDisposable').textContent = fmt(disposable);
}

function updateAllocationPreview() {
    const s = parseFloat(document.getElementById('setupSalary').value) || 0;
    const totalEmi = (DATA.emis || []).reduce((sum, e) => sum + e.amount, 0);
    const disposable = s - totalEmi;
    const n = parseFloat(document.getElementById('setupNeeds').value) || 0;
    const w = parseFloat(document.getElementById('setupWants').value) || 0;
    const sv = parseFloat(document.getElementById('setupSavings').value) || 0;
    document.getElementById('allocationPreview').innerHTML = `
        <div class="alloc-item" style="border-left:3px solid #ef4444"><div class="alloc-label">EMIs (Fixed)</div><div class="alloc-value">${fmt(totalEmi)}</div></div>
        <div class="alloc-item" style="border-left:3px solid #22c55e"><div class="alloc-label">Disposable</div><div class="alloc-value">${fmt(disposable)}</div></div>
        <div class="alloc-item needs"><div class="alloc-label">Needs (${n}%)</div><div class="alloc-value">${fmt(disposable * n / 100)}</div></div>
        <div class="alloc-item wants"><div class="alloc-label">Wants (${w}%)</div><div class="alloc-value">${fmt(disposable * w / 100)}</div></div>
        <div class="alloc-item savings"><div class="alloc-label">Savings (${sv}%)</div><div class="alloc-value">${fmt(disposable * sv / 100)}</div></div>`;
}

['setupSalary','setupNeeds','setupWants','setupSavings'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateAllocationPreview);
});

document.getElementById('saveBudgetBtn').addEventListener('click', () => {
    DATA.salary = parseFloat(document.getElementById('setupSalary').value) || 0;
    DATA.needsPct = parseFloat(document.getElementById('setupNeeds').value) || 50;
    DATA.wantsPct = parseFloat(document.getElementById('setupWants').value) || 30;
    DATA.savingsPct = parseFloat(document.getElementById('setupSavings').value) || 20;
    saveData(DATA); renderDashboard();
    alert('Budget saved!');
});

function renderFixedSetup() {
    const cont = document.getElementById('fixedExpensesSetup');
    cont.innerHTML = DATA.fixedExpenses.map((f, i) => `
        <div class="fixed-setup-item">
            <input type="text" value="${escapeHTML(f.name)}" data-idx="${i}" data-field="name" class="fixed-input" placeholder="Name">
            <input type="number" value="${f.amount}" data-idx="${i}" data-field="amount" class="fixed-input" placeholder="Amount">
            <select data-idx="${i}" data-field="type" class="fixed-input">
                <option value="Need" ${f.type==='Need'?'selected':''}>Need</option>
                <option value="Want" ${f.type==='Want'?'selected':''}>Want</option>
                <option value="Saving" ${f.type==='Saving'?'selected':''}>Saving</option>
            </select>
            <select data-idx="${i}" data-field="category" class="fixed-input">
                <option ${f.category==='Life Infrastructure'?'selected':''}>Life Infrastructure</option>
                <option ${f.category==='Future Me'?'selected':''}>Future Me</option>
                <option ${f.category==='Performance & Growth'?'selected':''}>Performance & Growth</option>
                <option ${f.category==='Relationships & Generosity'?'selected':''}>Relationships & Generosity</option>
                <option ${f.category==='Lifestyle Enjoyment'?'selected':''}>Lifestyle Enjoyment</option>
            </select>
            <button class="btn-remove-fixed" onclick="removeFixed(${i})">×</button>
        </div>`).join('');

    cont.querySelectorAll('.fixed-input').forEach(inp => {
        inp.addEventListener('change', function() {
            const idx = parseInt(this.dataset.idx), field = this.dataset.field;
            DATA.fixedExpenses[idx][field] = field === 'amount' ? parseFloat(this.value) : this.value;
            saveData(DATA); renderDashboard();
        });
    });
}

window.removeFixed = function(i) {
    DATA.fixedExpenses.splice(i, 1); saveData(DATA); renderFixedSetup(); renderDashboard();
};

document.getElementById('addFixedBtn').addEventListener('click', () => {
    DATA.fixedExpenses.push({ name: 'New Expense', amount: 0, type: 'Need', category: 'Life Infrastructure' });
    saveData(DATA); renderFixedSetup();
});

document.getElementById('resetAllDataBtn').addEventListener('click', () => {
    pendingDeleteId = 'RESET_ALL';
    pendingDeleteType = 'resetAll';
    document.getElementById('deleteModalMsg').textContent =
        'Reset ALL data? This will erase everything — expenses, EMIs, budget, bike costs. Cannot be undone.';
    deleteModal.style.display = 'flex';
});

// ===== AUTO-ADD FIXED EXPENSES =====
function autoAddFixed(m, y) {
    const key = `fixed_added_${y}_${m}`;
    if (localStorage.getItem(key)) return;
    DATA.fixedExpenses.forEach(f => {
        DATA.expenses.push({
            id: uid(),
            date: new Date(y, m, 1).toISOString().split('T')[0],
            desc: f.name + ' (Fixed)',
            category: f.category, amount: f.amount,
            payment: 'Bank Transfer', type: f.type, note: 'Auto-added fixed expense'
        });
    });
    saveData(DATA);
    localStorage.setItem(key, '1');
}

// ===== BIKE TAB =====
let bikeChartInst;
function renderBikeTab() {
    document.getElementById('bikeEmi').value = DATA.bike.emi;
    document.getElementById('bikeFuel').value = DATA.bike.fuel;
    document.getElementById('bikeIns').value = DATA.bike.insurance;
    document.getElementById('bikeMaint').value = DATA.bike.maintenance;
    const total = DATA.bike.emi + DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance;
    document.getElementById('bikeTotalMonthly').textContent = fmt(total);

    // Dynamic bike summary cards
    document.getElementById('bikeSummaryCards').innerHTML = `
        <div class="summary-card" style="--accent: #f59e0b;"><div class="card-label">EMI</div><div class="card-value">${fmt(DATA.bike.emi)}</div><div class="card-sub">per month</div></div>
        <div class="summary-card" style="--accent: #ef4444;"><div class="card-label">Fuel Cost</div><div class="card-value">${fmt(DATA.bike.fuel)}</div><div class="card-sub">per month</div></div>
        <div class="summary-card" style="--accent: #8b5cf6;"><div class="card-label">Insurance</div><div class="card-value">${fmt(DATA.bike.insurance)}</div><div class="card-sub">per month avg</div></div>
        <div class="summary-card" style="--accent: #06b6d4;"><div class="card-label">Maintenance</div><div class="card-value">${fmt(DATA.bike.maintenance)}</div><div class="card-sub">per month avg</div></div>`;

    // Dynamic cost breakdown chart (estimated lifespan: 8 years = 96 months)
    const lifespan = 96;
    const emiTotal = DATA.bike.emi * Math.min(lifespan, 36); // EMI typically 2-3 years
    const fuelTotal = DATA.bike.fuel * lifespan;
    const insTotal = DATA.bike.insurance * lifespan;
    const maintTotal = DATA.bike.maintenance * lifespan;

    if (bikeChartInst) bikeChartInst.destroy();
    const ctx = document.getElementById('bikeChart').getContext('2d');
    bikeChartInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`EMI Cost (${fmt(emiTotal)})`, `Fuel (${fmt(fuelTotal)})`, `Insurance (${fmt(insTotal)})`, `Maintenance (${fmt(maintTotal)})`],
            datasets: [{ data: [emiTotal, fuelTotal, insTotal, maintTotal], backgroundColor: ['#f59e0b','#ef4444','#8b5cf6','#06b6d4'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 } } } } }
    });

    // Dynamic affordability box
    const affordBox = document.getElementById('bikeAffordBox');
    if (DATA.salary <= 0) {
        affordBox.innerHTML = '<div class="table-empty">Set your salary in Budget Setup first to see affordability analysis.</div>';
    } else if (total === 0) {
        affordBox.innerHTML = '<div class="table-empty">Fill in the bike costs and save to see affordability analysis.</div>';
    } else {
        const pct = ((total / DATA.salary) * 100).toFixed(1);
        const remaining = DATA.salary - total;
        const canAfford = remaining > 0 && parseFloat(pct) < 20;
        const badge = canAfford ? '<div class="afford-badge yes">✅ Affordable</div>' : (remaining < 0 ? '<div class="afford-badge no">🚫 Cannot Afford</div>' : '<div class="afford-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b">⚠️ Tight</div>');
        affordBox.innerHTML = `
            ${badge}
            <div class="afford-detail" style="margin-top:12px">
                <div class="afford-row"><span>Monthly Ownership Cost</span><span class="afford-val">${fmt(total)}</span></div>
                <div class="afford-row"><span>% of Monthly Income</span><span class="afford-val">${pct}%</span></div>
                <div class="afford-row"><span>Affordability Threshold</span><span class="afford-val">&lt;15-20%</span></div>
                <div class="afford-row"><span>Salary After Vehicle</span><span class="afford-val" style="color:${remaining >= 0 ? '#22c55e' : '#ef4444'}">${fmt(remaining)}</span></div>
                <div class="afford-row"><span>8-Year Total Cost</span><span class="afford-val">${fmt(emiTotal + fuelTotal + insTotal + maintTotal)}</span></div>
            </div>`;
    }
}

document.getElementById('saveBikeBtn').addEventListener('click', () => {
    DATA.bike.emi = parseFloat(document.getElementById('bikeEmi').value) || 0;
    DATA.bike.fuel = parseFloat(document.getElementById('bikeFuel').value) || 0;
    DATA.bike.insurance = parseFloat(document.getElementById('bikeIns').value) || 0;
    DATA.bike.maintenance = parseFloat(document.getElementById('bikeMaint').value) || 0;
    saveData(DATA); renderBikeTab();
    alert('Bike costs saved!');
});

document.getElementById('resetBikeBtn').addEventListener('click', () => {
    if (!confirm('Reset all bike costs to zero?')) return;
    DATA.bike = { emi: 0, fuel: 0, insurance: 0, maintenance: 0 };
    saveData(DATA); renderBikeTab();
});

document.getElementById('deleteAllEmisBtn').addEventListener('click', () => {
    if (!DATA.emis || DATA.emis.length === 0) { alert('No EMIs to delete.'); return; }
    pendingDeleteId = 'ALL_EMIS';
    pendingDeleteType = 'deleteAllEmis';
    document.getElementById('deleteModalMsg').textContent =
        `Delete ALL ${DATA.emis.length} EMIs? This cannot be undone.`;
    deleteModal.style.display = 'flex';
});

// ===== MONTHLY VIEW =====
let dailyTrendInst, paymentChartInst;

function renderMonthly() {
    const m = parseInt(document.getElementById('monthlyMonth')?.value ?? new Date().getMonth());
    const y = parseInt(document.getElementById('monthlyYear')?.value ?? new Date().getFullYear());
    const exps = getMonthExpenses(m, y);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const today = new Date();

    // Calendar
    const grid = document.getElementById('calendarGrid');
    const headers = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let html = headers.map(h => `<div class="calendar-header">${h}</div>`).join('');

    // Daily totals
    const dailyTotals = {};
    exps.forEach(e => {
        const d = new Date(e.date).getDate();
        dailyTotals[d] = (dailyTotals[d] || 0) + e.amount;
    });

    const avgDaily = Object.values(dailyTotals).length ? Object.values(dailyTotals).reduce((a, b) => a + b, 0) / Object.values(dailyTotals).length : 0;

    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        const spent = dailyTotals[d] || 0;
        const cls = [isToday ? 'today' : '', spent > 0 ? 'has-expense' : '', spent > avgDaily * 1.5 && spent > 0 ? 'high-spend' : ''].filter(Boolean).join(' ');
        html += `<div class="calendar-day ${cls}"><span class="day-num">${d}</span>${spent ? `<span class="day-amount">${fmt(spent)}</span>` : ''}</div>`;
    }
    grid.innerHTML = html;

    // Daily trend chart
    if (dailyTrendInst) dailyTrendInst.destroy();
    const labels = [], data = [];
    for (let d = 1; d <= daysInMonth; d++) { labels.push(d); data.push(dailyTotals[d] || 0); }
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    dailyTrendInst = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Daily Spend', data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#6366f1' }] },
        options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#64748b', callback: v => '₹' + v }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Payment mode chart
    if (paymentChartInst) paymentChartInst.destroy();
    const payments = {};
    exps.forEach(e => { payments[e.payment] = (payments[e.payment] || 0) + e.amount; });
    const ctx2 = document.getElementById('paymentChart').getContext('2d');
    paymentChartInst = new Chart(ctx2, {
        type: 'pie',
        data: { labels: Object.keys(payments), datasets: [{ data: Object.values(payments), backgroundColor: ['#6366f1','#f59e0b','#22c55e','#ef4444','#06b6d4'], borderWidth: 0 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }
    });
}

// ===== EXPORT CSV =====
document.getElementById('exportBtn').addEventListener('click', () => {
    if (!DATA.expenses.length) return alert('No expenses to export.');
    let csv = 'Date,Description,Category,Amount,Payment,Type,Note\n';
    DATA.expenses.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(e => {
        csv += `${e.date},"${e.desc}","${e.category}",${e.amount},"${e.payment}","${e.type}","${e.note || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
});

// ===== DELETE ALL EXPENSES =====
document.getElementById('deleteAllExpBtn').addEventListener('click', () => {
    if (DATA.expenses.length === 0) { alert('No expenses to delete.'); return; }
    pendingDeleteId = 'ALL';
    pendingDeleteType = 'deleteAll';
    document.getElementById('deleteModalMsg').textContent =
        `Delete ALL ${DATA.expenses.length} expenses? This cannot be undone.`;
    deleteModal.style.display = 'flex';
});

// ===== BULK EDIT =====
function updateBulkBar() {
    const checked = document.querySelectorAll('.exp-check:checked');
    const bar = document.getElementById('bulkEditBar');
    if (checked.length > 0) {
        bar.style.display = 'block';
        document.getElementById('bulkCount').textContent = checked.length + ' selected';
    } else {
        bar.style.display = 'none';
    }
}

document.getElementById('selectAllExp').addEventListener('change', function() {
    document.querySelectorAll('.exp-check').forEach(chk => { chk.checked = this.checked; });
    updateBulkBar();
});

document.getElementById('bulkApplyBtn').addEventListener('click', () => {
    const cat = document.getElementById('bulkCategory').value;
    const type = document.getElementById('bulkType').value;
    if (!cat && !type) { alert('Select a category or type to apply.'); return; }
    const checked = document.querySelectorAll('.exp-check:checked');
    checked.forEach(chk => {
        const exp = DATA.expenses.find(e => e.id === chk.dataset.id);
        if (exp) {
            if (cat) exp.category = cat;
            if (type) exp.type = type;
        }
    });
    saveData(DATA);
    document.getElementById('bulkCategory').value = '';
    document.getElementById('bulkType').value = '';
    document.getElementById('selectAllExp').checked = false;
    renderExpenses(); renderDashboard();
});

document.getElementById('bulkCancelBtn').addEventListener('click', () => {
    document.querySelectorAll('.exp-check').forEach(chk => { chk.checked = false; });
    document.getElementById('selectAllExp').checked = false;
    updateBulkBar();
});

// ===== HAMBURGER MENU (Mobile) =====
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});
// Close sidebar on nav click (mobile)
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        }
    });
});

// ===== INIT =====
function init() {
    populateSelectors();
    const now = new Date();
    autoAddFixed(now.getMonth(), now.getFullYear());
    renderDashboard();
}

init();
