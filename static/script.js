// static/script.js
// Updated display script per your requests:
// - Show only the clean, readable summary for Prediction, Critical Cases and Monthly Report.
// - REMOVE the raw JSON blocks (no raw JSON shown).
// - Prediction: show Prediction, Confidence (decimal), Fake/Real numbers, latencies, timestamp.
// - Critical Cases: bold title, normal result, include timestamp and details.
// - Monthly Report: show all important fields (fake_real_ratio, averages, latencies, model_drift, totals, anomalies, server_health, etc.) in readable format.
// Save/replace this file at static/script.js and hard-reload the page (Ctrl/Cmd+Shift+R).

/* DOM nodes */
const predictBtn = document.getElementById('predictBtn');
const clearBtn = document.getElementById('clearBtn');
const newsText = document.getElementById('newsText');
const resultsContainer = document.getElementById('resultsContainer');
const criticalBtn = document.getElementById('criticalBtn');
const monthlyBtn = document.getElementById('monthlyBtn');
const criticalContainer = document.getElementById('criticalContainer');
const monthlyContainer = document.getElementById('monthlyContainer');

/* small helpers */
function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const k in attrs) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c === null || c === undefined) return;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
    });
    return n;
}
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtNum(v, d = 3) {
    if (v === null || v === undefined) return '-';
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : n.toFixed(d);
}
function fmtPercent(v, d = 1) {
    if (v === null || v === undefined) return '-';
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : (n * 100).toFixed(d) + '%';
}
function fmtDate(iso) {
    try {
        const dt = new Date(iso);
        if (isNaN(dt)) return String(iso);
        return dt.toLocaleString();
    } catch {
        return String(iso);
    }
}
function showEmpty(container, text = 'No results yet — click "Predict".') {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'empty', text }));
}

/* ---------- Build prediction card (clean readable format only) ---------- */
function buildPredictionCard(data) {
    const card = el('div', { class: 'result-card' });

    card.appendChild(el('h4', { text: 'Prediction' }));

    // Headline/snippet
    const snippet = data.title || data.headline || (data.text ? (data.text.slice(0, 160) + (data.text.length > 160 ? '…' : '')) : '');
    if (snippet) card.appendChild(el('div', { class: 'small-muted', text: snippet }));

    // Summary box (legacy-like, clear)
    const summary = el('div', { style: 'margin-top:10px; padding:12px; border-radius:8px; background:#f3fdf7; border:1px solid #e6f6ef;' });

    const predVal = data.prediction || data.verdict || data.label || '-';
    const confidence = data.confidence !== undefined ? data.confidence : (data.confidence_score !== undefined ? data.confidence_score : null);
    const probs = data.probabilities || data.proba || data.probs || null;

    summary.appendChild(el('div', {}, [el('strong', { text: 'Prediction: ' }), el('span', {}, String(predVal))]));
    summary.appendChild(el('div', {}, [el('strong', { text: 'Confidence: ' }), el('span', {}, confidence !== null ? String(confidence) : '-')]));

    // Show explicit fake/real numeric values if present
    if (probs && typeof probs === 'object') {
        if (probs.fake !== undefined) summary.appendChild(el('div', {}, [el('strong', { text: 'Fake: ' }), el('span', {}, String(probs.fake))]));
        if (probs.real !== undefined) summary.appendChild(el('div', {}, [el('strong', { text: 'Real: ' }), el('span', {}, String(probs.real))]));
        // show other prob keys if any
        Object.keys(probs).forEach(k => {
            if (['fake', 'real'].includes(k)) return;
            summary.appendChild(el('div', {}, [el('strong', { text: k + ': ' }), el('span', {}, String(probs[k]))]));
        });
    } else {
        // if not object but array or other, show as one line
        if (Array.isArray(data.probabilities)) {
            summary.appendChild(el('div', {}, [el('strong', { text: 'Probabilities: ' }), el('span', {}, JSON.stringify(data.probabilities))]));
        }
    }

    card.appendChild(summary);

    // Additional readable metadata (latencies, timestamp)
    const meta = el('div', { style: 'margin-top:10px; color:#556' });
    if (data.inference_latency !== undefined) meta.appendChild(el('div', {}, `Inference latency: ${fmtNum(data.inference_latency, 4)} s`));
    if (data.server_latency !== undefined) meta.appendChild(el('div', {}, `Server latency: ${fmtNum(data.server_latency, 4)} s`));
    if (data.total_latency !== undefined) meta.appendChild(el('div', {}, `Total latency: ${fmtNum(data.total_latency, 4)} s`));
    if (data.timestamp) meta.appendChild(el('div', {}, `Timestamp: ${fmtDate(data.timestamp)}`));
    if (meta.childNodes.length) card.appendChild(meta);

    return card;
}

/* ---------- Build critical case card (title bold, result normal, include timestamp) ---------- */
function buildCriticalCard(c) {
    const card = el('div', { class: 'result-card' });
    // Header: bold title
    const titleText = c.title || c.headline || (c.text ? (c.text.slice(0, 120) + (c.text.length > 120 ? '…' : '')) : 'Case');
    const title = el('div', {
        style: 'font-weight:700; font-size:16px; margin-bottom:8px; color: var(--green-dark)'
    }, titleText);

    card.appendChild(title);

    // Result lines
    if (c.prediction !== undefined) card.appendChild(el('div', {}, [el('strong', { text: 'Prediction: ' }), el('span', {}, String(c.prediction))]));
    if (c.confidence !== undefined) card.appendChild(el('div', {}, [el('strong', { text: 'Confidence: ' }), el('span', {}, String(c.confidence))]));

    // Timestamp
    if (c.timestamp) card.appendChild(el('div', { style: 'margin-top:8px; color:#556' }, `Time: ${fmtDate(c.timestamp)}`));

    return card;
}

/* ---------- Build monthly report (complete readable info) ---------- */
function buildMonthlyReportCard(report) {
    const card = el('div', { class: 'result-card' });
    // card.appendChild(el('h4', { text: 'Monthly Report' }));

    // top metadata
    if (report.timestamp) card.appendChild(el('div', { text: `Generated: ${fmtDate(report.timestamp)}` }));
    if (report.month) card.appendChild(el('div', { text: `Month: ${escapeHtml(String(report.month))}` }));

    // totals
    if (report.total_predictions !== undefined) card.appendChild(el('div', { text: `Total predictions: ${String(report.total_predictions)}` }));
    if (report.totals && typeof report.totals === 'object') {
        const t = el('div', { style: 'margin-top:8px' });
        t.appendChild(el('strong', { text: 'Totals:' }));
        Object.keys(report.totals).forEach(k => t.appendChild(el('div', {}, `${k}: ${String(report.totals[k])}`)));
        card.appendChild(t);
    }

    // fake_real_ratio
    if (report.fake_real_ratio) {
        const fr = el('div', { style: 'margin-top:8px' });
        fr.appendChild(el('strong', { text: 'Fake / Real ratio' }));
        Object.keys(report.fake_real_ratio).forEach(k => fr.appendChild(el('div', {}, `${k}: ${String(report.fake_real_ratio[k])}`)));
        card.appendChild(fr);
    }

    // Averages and latencies
    const avgFields = [
        ['average_confidence', 'Average confidence'],
        ['average_latency_total', 'Average latency (total)'],
        ['average_latency_inference', 'Average latency (inference)'],
        ['average_latency_server', 'Average latency (server)'],
        ['model_drift', 'Model drift']
    ];
    const avgBox = el('div', { style: 'margin-top:8px' });
    let avgAdded = false;
    avgFields.forEach(([k, label]) => {
        if (report[k] !== undefined) {
            avgBox.appendChild(el('div', {}, `${label}: ${fmtNum(report[k], 4)}`));
            avgAdded = true;
        }
    });
    if (avgAdded) {
        card.appendChild(el('div', { style: 'font-weight:700; margin-top:10px' }, 'Averages & model'));
        card.appendChild(avgBox);
    }

    // Error analysis (structured)
    if (report.error_analysis) {
        const e = el('div', { style: 'margin-top:8px' });
        e.appendChild(el('strong', { text: 'Error analysis' }));
        Object.keys(report.error_analysis).forEach(k => e.appendChild(el('div', {}, `${k}: ${String(report.error_analysis[k])}`)));
        card.appendChild(e);
    }

    // Server health
    if (report.server_health) {
        const s = el('div', { style: 'margin-top:8px' });
        s.appendChild(el('strong', { text: 'Server health' }));
        Object.keys(report.server_health).forEach(k => s.appendChild(el('div', {}, `${k}: ${String(report.server_health[k])}`)));
        card.appendChild(s);
    }

    // Anomalies
    if (report.anomalies) {
        const a = el('div', { style: 'margin-top:8px' });
        a.appendChild(el('strong', { text: 'Anomalies' }));
        if (Array.isArray(report.anomalies) && report.anomalies.length === 0) {
            a.appendChild(el('div', {}, 'No anomalies detected.'));
        } else if (Array.isArray(report.anomalies)) {
            report.anomalies.slice(0, 10).forEach((an, idx) => {
                a.appendChild(el('div', {}, `${idx + 1}. ${typeof an === 'string' ? an : JSON.stringify(an)}`));
            });
        } else {
            a.appendChild(el('div', {}, String(report.anomalies)));
        }
        card.appendChild(a);
    }

    // Top issues or top_issues
    if (report.top_issues && Array.isArray(report.top_issues)) {
        const ti = el('div', { style: 'margin-top:8px' });
        ti.appendChild(el('strong', { text: 'Top issues' }));
        report.top_issues.slice(0, 8).forEach((it, idx) => ti.appendChild(el('div', {}, `${idx + 1}. ${String(it)}`)));
        card.appendChild(ti);
    }

    return card;
}

/* ---------- Fetch handlers ---------- */
async function predict() {
    const text = newsText.value.trim();
    if (!text) {
        alert('Please enter the news text.');
        return;
    }
    showEmpty(resultsContainer, 'Verifying… please wait');

    try {
        const res = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) {
            const txt = await res.text();
            showEmpty(resultsContainer, `Server did not return a valid result: ${res.status} ${txt || ''}`);
            return;
        }
        const data = await res.json();
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(buildPredictionCard(data));
    } catch (err) {
        console.error(err);
        showEmpty(resultsContainer, 'Failed to contact server. Make sure backend is running.');
    }
}

async function loadCriticalCases() {
    criticalContainer.innerHTML = '';
    criticalContainer.appendChild(el('div', { class: 'small-muted', text: 'Loading…' }));

    try {
        const res = await fetch('/critical-cases');
        if (!res.ok) {
            criticalContainer.innerHTML = '';
            criticalContainer.appendChild(el('div', { class: 'small-muted', text: `Server error ${res.status}` }));
            return;
        }
        const data = await res.json();
        const cases = data.cases || [];
        criticalContainer.innerHTML = '';
        if (!cases.length) {
            criticalContainer.appendChild(el('div', { class: 'small-muted', text: 'No critical cases found.' }));
            return;
        }
        const wrap = el('div', { class: 'cards' });
        // display up to 6
        cases.slice(0, 6).forEach(c => wrap.appendChild(buildCriticalCard(c)));
        criticalContainer.appendChild(wrap);
    } catch (err) {
        console.error(err);
        criticalContainer.innerHTML = '';
        criticalContainer.appendChild(el('div', { class: 'small-muted', text: 'Failed to load critical cases.' }));
    }
}

async function loadMonthlyReport() {
    monthlyContainer.innerHTML = '';
    monthlyContainer.appendChild(el('div', { class: 'small-muted', text: 'Loading…' }));

    try {
        const res = await fetch('/monthly-report');
        if (!res.ok) {
            monthlyContainer.innerHTML = '';
            monthlyContainer.appendChild(el('div', { class: 'small-muted', text: `Server error ${res.status}` }));
            return;
        }
        const data = await res.json();
        monthlyContainer.innerHTML = '';
        // If backend returns message about no data
        if (data && data.message && typeof data.message === 'string' && data.message.toLowerCase().includes('no')) {
            monthlyContainer.appendChild(el('div', { class: 'small-muted', text: data.message }));
            return;
        }
        monthlyContainer.appendChild(buildMonthlyReportCard(data));
    } catch (err) {
        console.error(err);
        monthlyContainer.innerHTML = '';
        monthlyContainer.appendChild(el('div', { class: 'small-muted', text: 'Failed to load monthly report.' }));
    }
}

/* ---------- Wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
    if (predictBtn) predictBtn.addEventListener('click', predict);
    if (clearBtn) clearBtn.addEventListener('click', () => {
        newsText.value = '';
        showEmpty(resultsContainer);
    });
    if (criticalBtn) criticalBtn.addEventListener('click', loadCriticalCases);
    if (monthlyBtn) monthlyBtn.addEventListener('click', loadMonthlyReport);

    // initial placeholders
    showEmpty(resultsContainer);
    criticalContainer.textContent = 'No data available.';
    monthlyContainer.textContent = 'No data available.';
});
