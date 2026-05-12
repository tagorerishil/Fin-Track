// ===== EMI TRACKER TAB =====
let emiDistChartInst;
let editingEmiId = null;

document.getElementById('addEmiBtn').addEventListener('click', () => {
    editingEmiId = null;
    document.getElementById('emiName').value = '';
    document.getElementById('emiAmount').value = '';
    document.getElementById('emiTotal').value = '';
    document.getElementById('emiRate').value = '';
    document.getElementById('emiTenure').value = '';
    document.getElementById('emiPaid').value = '0';
    document.getElementById('emiStart').value = new Date().toISOString().split('T')[0];
    document.getElementById('emiForm').style.display = 'block';
});

document.getElementById('cancelEmiBtn').addEventListener('click', () => {
    document.getElementById('emiForm').style.display = 'none';
});

document.getElementById('saveEmiBtn').addEventListener('click', () => {
    const emi = {
        id: editingEmiId || uid(),
        name: document.getElementById('emiName').value,
        amount: parseFloat(document.getElementById('emiAmount').value) || 0,
        totalLoan: parseFloat(document.getElementById('emiTotal').value) || 0,
        rate: parseFloat(document.getElementById('emiRate').value) || 0,
        tenure: parseInt(document.getElementById('emiTenure').value) || 0,
        paid: parseInt(document.getElementById('emiPaid').value) || 0,
        startDate: document.getElementById('emiStart').value,
        category: document.getElementById('emiCategory').value,
    };
    if (!emi.name || !emi.amount) return alert('Fill loan name and EMI amount.');
    if (!DATA.emis) DATA.emis = [];
    if (editingEmiId) {
        const idx = DATA.emis.findIndex(x => x.id === editingEmiId);
        if (idx >= 0) DATA.emis[idx] = emi;
    } else {
        DATA.emis.push(emi);
    }
    saveData(DATA);
    document.getElementById('emiForm').style.display = 'none';
    renderEmiTab();
});

window.deleteEmi = function(id) {
    pendingDeleteId = id;
    pendingDeleteType = 'emi';
    const emi = DATA.emis.find(x => x.id === id);
    document.getElementById('deleteModalMsg').textContent = 
        `Delete "${emi ? emi.name : 'this EMI'}" loan? This cannot be undone.`;
    deleteModal.style.display = 'flex';
};

window.editEmi = function(id) {
    const e = DATA.emis.find(x => x.id === id);
    if (!e) return;
    editingEmiId = id;
    document.getElementById('emiName').value = e.name;
    document.getElementById('emiAmount').value = e.amount;
    document.getElementById('emiTotal').value = e.totalLoan;
    document.getElementById('emiRate').value = e.rate;
    document.getElementById('emiTenure').value = e.tenure;
    document.getElementById('emiPaid').value = e.paid;
    document.getElementById('emiStart').value = e.startDate;
    document.getElementById('emiCategory').value = e.category;
    document.getElementById('emiForm').style.display = 'block';
};

function renderEmiTab() {
    if (!DATA.emis) DATA.emis = [];
    const emis = DATA.emis;
    const totalEmi = emis.reduce((s, e) => s + e.amount, 0);
    const totalLoan = emis.reduce((s, e) => s + e.totalLoan, 0);
    const emiPct = DATA.salary > 0 ? ((totalEmi / DATA.salary) * 100).toFixed(1) : '0.0';

    // Summary cards
    document.getElementById('emiSummaryCards').innerHTML = `
        <div class="summary-card" style="--accent: #ef4444;">
            <div class="card-label">Total Monthly EMI</div>
            <div class="card-value">${fmt(totalEmi)}</div>
            <div class="card-sub">${emiPct}% of salary</div>
        </div>
        <div class="summary-card" style="--accent: #f59e0b;">
            <div class="card-label">Total Loan Outstanding</div>
            <div class="card-value">${fmt(totalLoan)}</div>
            <div class="card-sub">${emis.length} active loans</div>
        </div>
        <div class="summary-card" style="--accent: #22c55e;">
            <div class="card-label">Salary After EMIs</div>
            <div class="card-value">${fmt(DATA.salary - totalEmi)}</div>
            <div class="card-sub">Available for expenses</div>
        </div>
        <div class="summary-card" style="--accent: ${parseFloat(emiPct) > 50 ? '#ef4444' : parseFloat(emiPct) > 35 ? '#f59e0b' : '#22c55e'};">
            <div class="card-label">EMI Health</div>
            <div class="card-value">${parseFloat(emiPct) > 50 ? '⚠️ Critical' : parseFloat(emiPct) > 35 ? '⚡ High' : '✅ Healthy'}</div>
            <div class="card-sub">Recommended &lt;35%</div>
        </div>`;

    // Table
    const tbody = document.getElementById('emiTableBody');
    const empty = document.getElementById('emiTableEmpty');
    if (emis.length === 0) {
        tbody.innerHTML = ''; empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = emis.map(e => {
            const pct = e.tenure > 0 ? Math.round((e.paid / e.tenure) * 100) : 0;
            const remaining = e.tenure - e.paid;
            const endDate = new Date(e.startDate);
            endDate.setMonth(endDate.getMonth() + e.tenure);
            const catColors = { 'Personal Loan': '#ec4899', 'Home Loan': '#6366f1', 'Vehicle Loan': '#f59e0b', 'Education Loan': '#06b6d4', 'Other': '#a855f7' };
            const color = catColors[e.category] || '#6366f1';
            return `<tr>
                <td style="font-weight:600;color:var(--text-primary)">${escapeHTML(e.name)}</td>
                <td><span style="color:${color};font-weight:600">${escapeHTML(e.category)}</span></td>
                <td class="amount-cell">${fmt(e.amount)}</td>
                <td>${fmt(e.totalLoan)}</td>
                <td>${e.rate}%</td>
                <td><div class="card-progress" style="width:120px;display:inline-block"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div> <span style="font-size:11px;color:var(--text-muted)">${pct}%</span></td>
                <td>${remaining} months</td>
                <td>${endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                <td><button class="btn-edit" onclick="editEmi('${e.id}')">✏️</button><button class="btn-delete" onclick="deleteEmi('${e.id}')">🗑️</button></td>
            </tr>`;
        }).join('');
    }

    // EMI Distribution Chart
    if (emiDistChartInst) emiDistChartInst.destroy();
    if (emis.length > 0) {
        const ctx = document.getElementById('emiDistChart').getContext('2d');
        emiDistChartInst = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: emis.map(e => e.name),
                datasets: [{ data: emis.map(e => e.amount), backgroundColor: ['#ec4899','#6366f1','#f59e0b','#06b6d4','#a855f7','#22c55e'], borderWidth: 0 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10 } } } }
        });
    }

    // EMI Burden
    const burden = document.getElementById('emiBurden');
    const salAfterEmi = DATA.salary - totalEmi;
    const fixedNonEmi = DATA.fixedExpenses.filter(f => !f.name.toLowerCase().includes('loan') && !f.name.toLowerCase().includes('emi')).reduce((s, f) => s + f.amount, 0);
    const freeAfterAll = salAfterEmi - fixedNonEmi;
    burden.innerHTML = `
        <div class="remain-item"><span class="remain-label">Gross Salary</span><span class="remain-value">${fmt(DATA.salary)}</span></div>
        <div class="remain-item"><span class="remain-label">Total EMIs</span><span class="remain-value negative">- ${fmt(totalEmi)}</span></div>
        <div class="remain-item"><span class="remain-label">After EMIs</span><span class="remain-value ${salAfterEmi >= 0 ? 'positive' : 'negative'}">${fmt(salAfterEmi)}</span></div>
        <div class="remain-item"><span class="remain-label">Other Fixed Expenses</span><span class="remain-value negative">- ${fmt(fixedNonEmi)}</span></div>
        <div class="remain-item"><span class="remain-label">Free Cash</span><span class="remain-value ${freeAfterAll >= 0 ? 'positive' : 'negative'}">${fmt(freeAfterAll)}</span></div>
        ${emis.map(e => {
            const remaining = e.tenure - e.paid;
            const totalLeft = e.amount * remaining;
            return `<div class="remain-item"><span class="remain-label">${escapeHTML(e.name)} — ${remaining}mo left</span><span class="remain-value">${fmt(totalLeft)} total</span></div>`;
        }).join('')}`;
}

// ===== BIKE AFFORDABILITY TAB =====
let affordPieInst, scenarioChartInst;

function renderAffordTab() {
    const sal = DATA.salary;
    const emis = DATA.emis || [];
    const totalEmi = emis.reduce((s, e) => s + e.amount, 0);
    const fixedNonEmi = DATA.fixedExpenses.filter(f => !f.name.toLowerCase().includes('loan') && !f.name.toLowerCase().includes('emi')).reduce((s, f) => s + f.amount, 0);
    const bikeTotal = DATA.bike.emi + DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance;
    const currentSpend = totalEmi + fixedNonEmi;
    const currentFree = sal - currentSpend;
    const afterBikeFree = currentFree - bikeTotal;
    const bikePct = sal > 0 ? ((bikeTotal / sal) * 100).toFixed(1) : '0.0';
    const totalWithBike = currentSpend + bikeTotal;
    const totalWithBikePct = sal > 0 ? ((totalWithBike / sal) * 100).toFixed(1) : '0.0';
    const canAfford = afterBikeFree > 0 && parseFloat(bikePct) < 20;
    const savings20 = sal * 0.2;
    const canSaveAfterBike = afterBikeFree >= savings20;

    // Verdict
    const verdict = document.getElementById('affordVerdict');
    const verdictClass = canAfford ? (canSaveAfterBike ? 'yes' : 'yes') : 'no';
    let verdictText, verdictIcon, verdictDesc;
    if (afterBikeFree < 0) {
        verdictIcon = '🚫'; verdictText = 'Cannot Afford';
        verdictDesc = `Adding the bike (${fmt(bikeTotal)}/mo) would put you ₹${Math.abs(afterBikeFree).toLocaleString('en-IN')} in deficit every month.`;
    } else if (!canSaveAfterBike) {
        verdictIcon = '⚠️'; verdictText = 'Tight — Savings Impacted';
        verdictDesc = `You can technically afford it, but your 20% savings target (${fmt(savings20)}) won't be met. Free cash after bike: ${fmt(afterBikeFree)}.`;
    } else {
        verdictIcon = '✅'; verdictText = 'Affordable';
        verdictDesc = `Bike cost is ${bikePct}% of income (<15% threshold). You'll still have ${fmt(afterBikeFree)} free after all obligations.`;
    }

    verdict.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
            <div class="afford-badge ${verdictClass}" style="font-size:24px">${verdictIcon} ${verdictText}</div>
        </div>
        <p style="color:var(--text-secondary);font-size:15px;line-height:1.6">${verdictDesc}</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px;">
            <div class="alloc-item needs"><div class="alloc-label">Bike Cost/Mo</div><div class="alloc-value">${fmt(bikeTotal)}</div></div>
            <div class="alloc-item wants"><div class="alloc-label">% of Income</div><div class="alloc-value">${bikePct}%</div></div>
            <div class="alloc-item ${afterBikeFree >= 0 ? 'savings' : 'needs'}"><div class="alloc-label">Free After Bike</div><div class="alloc-value">${fmt(afterBikeFree)}</div></div>
            <div class="alloc-item ${totalWithBikePct < 80 ? 'savings' : 'needs'}"><div class="alloc-label">Total Obligations</div><div class="alloc-value">${totalWithBikePct}%</div></div>
        </div>`;

    // Waterfall
    const wf = document.getElementById('affordWaterfall');
    const items = [
        { label: 'Salary', value: sal, color: '#22c55e' },
        { label: 'EMIs', value: -totalEmi, color: '#ef4444' },
        { label: 'PG + Food + Misc', value: -fixedNonEmi, color: '#f59e0b' },
        { label: 'Bike EMI', value: -DATA.bike.emi, color: '#ec4899' },
        { label: 'Bike Fuel', value: -DATA.bike.fuel, color: '#a855f7' },
        { label: 'Bike Ins+Maint', value: -(DATA.bike.insurance + DATA.bike.maintenance), color: '#06b6d4' },
        { label: 'Remaining', value: afterBikeFree, color: afterBikeFree >= 0 ? '#22c55e' : '#ef4444' },
    ];
    wf.innerHTML = items.map(item => {
        const barW = sal > 0 ? Math.min(100, Math.abs(item.value / sal) * 100) : 0;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="width:120px;font-size:12px;color:var(--text-secondary);text-align:right">${item.label}</span>
            <div style="flex:1;height:24px;background:var(--bg-input);border-radius:4px;overflow:hidden;position:relative">
                <div style="width:${barW}%;height:100%;background:${item.color};border-radius:4px;transition:width 0.5s"></div>
            </div>
            <span style="width:80px;font-size:13px;font-weight:600;color:${item.color}">${item.value >= 0 ? '' : '-'}${fmt(Math.abs(item.value))}</span>
        </div>`;
    }).join('');

    // Pie chart
    if (affordPieInst) affordPieInst.destroy();
    const ctx = document.getElementById('affordPieChart').getContext('2d');
    affordPieInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['EMIs', 'Living Expenses', 'Bike EMI', 'Bike Running', 'Free Cash'],
            datasets: [{ data: [totalEmi, fixedNonEmi, DATA.bike.emi, DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance, Math.max(0, afterBikeFree)], backgroundColor: ['#ef4444','#f59e0b','#ec4899','#a855f7','#22c55e'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10 } } } }
    });

    // Scenario chart
    if (scenarioChartInst) scenarioChartInst.destroy();
    const ctx2 = document.getElementById('scenarioChart').getContext('2d');
    scenarioChartInst = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Current (No Bike)', 'With Bike (EMI Period)', 'With Bike (After EMI)'],
            datasets: [
                { label: 'EMIs', data: [totalEmi, totalEmi + DATA.bike.emi, totalEmi], backgroundColor: 'rgba(239,68,68,0.7)' },
                { label: 'Living', data: [fixedNonEmi, fixedNonEmi, fixedNonEmi], backgroundColor: 'rgba(245,158,11,0.7)' },
                { label: 'Bike Running', data: [0, DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance, DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance], backgroundColor: 'rgba(168,85,247,0.7)' },
                { label: 'Free', data: [currentFree, Math.max(0, afterBikeFree), Math.max(0, currentFree - (DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance))], backgroundColor: 'rgba(34,197,94,0.7)' },
            ]
        },
        options: {
            responsive: true, plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { stacked: true, ticks: { color: '#94a3b8', callback: v => '₹' + (v/1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });

    // Recommendations
    const recs = document.getElementById('affordRecommendations');
    let recHtml = '<div style="display:grid;gap:12px;">';
    if (afterBikeFree < 0) {
        recHtml += `<div class="remain-item" style="border-left:3px solid #ef4444"><span class="remain-label">❌ You're short by ${fmt(Math.abs(afterBikeFree))}/month. Consider a longer EMI tenure to reduce monthly burden.</span></div>`;
    }
    if (parseFloat(bikePct) > 15) {
        recHtml += `<div class="remain-item" style="border-left:3px solid #f59e0b"><span class="remain-label">⚠️ Bike cost is ${bikePct}% of income (recommended: <15%). Consider a smaller down payment period.</span></div>`;
    }
    if (sal > 0 && totalEmi / sal > 0.4) {
        recHtml += `<div class="remain-item" style="border-left:3px solid #ef4444"><span class="remain-label">🚨 EMI burden is ${((totalEmi/sal)*100).toFixed(0)}% of salary. This is above the 40% safe limit. Clear one loan before adding bike EMI.</span></div>`;
    }
    const bikeRunningOnly = DATA.bike.fuel + DATA.bike.insurance + DATA.bike.maintenance;
    const freeAfterEmiDone = sal - fixedNonEmi - bikeRunningOnly - totalEmi + DATA.bike.emi;
    recHtml += `<div class="remain-item" style="border-left:3px solid #22c55e"><span class="remain-label">💡 After bike EMI ends (2 years), your monthly bike cost drops to just ${fmt(bikeRunningOnly)} (fuel + insurance + maintenance).</span></div>`;
    recHtml += `<div class="remain-item" style="border-left:3px solid #6366f1"><span class="remain-label">📊 Current total obligations: ${fmt(currentSpend)} (${sal > 0 ? ((currentSpend/sal)*100).toFixed(0) : 0}% of salary). With bike: ${fmt(totalWithBike)} (${totalWithBikePct}%).</span></div>`;
    if (afterBikeFree > 0 && afterBikeFree < 3000) {
        recHtml += `<div class="remain-item" style="border-left:3px solid #f59e0b"><span class="remain-label">⚡ Only ${fmt(afterBikeFree)} free cash left. Keep an emergency buffer of at least ₹2,000-3,000.</span></div>`;
    }
    if (afterBikeFree >= 3000) {
        recHtml += `<div class="remain-item" style="border-left:3px solid #22c55e"><span class="remain-label">✅ With ${fmt(afterBikeFree)} free cash, you have room for unexpected expenses and can try saving ${fmt(Math.min(afterBikeFree, savings20))} monthly.</span></div>`;
    }
    recHtml += '</div>';
    recs.innerHTML = recHtml;
}
