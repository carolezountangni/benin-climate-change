/**
 * Impact Climatique Benin - Application de visualisation
 * Donnees: Donnees Publiques du Benin - World Bank Climate Change Indicators
 */

const CONFIG = {
  dataUrl: 'data/climate-benin.json',
  maxIndicators: 10,
  colorPalette: [
    { border: '#2563eb', fill: 'rgba(37, 99, 235, 0.12)' },
    { border: '#dc2626', fill: 'rgba(220, 38, 38, 0.12)' },
    { border: '#ea580c', fill: 'rgba(234, 88, 12, 0.12)' },
    { border: '#9333ea', fill: 'rgba(147, 51, 234, 0.12)' },
    { border: '#0d9488', fill: 'rgba(13, 148, 136, 0.12)' },
    { border: '#ca8a04', fill: 'rgba(202, 138, 4, 0.12)' },
    { border: '#db2777', fill: 'rgba(219, 39, 119, 0.12)' },
    { border: '#1e40af', fill: 'rgba(30, 64, 175, 0.12)' },
    { border: '#16a34a', fill: 'rgba(22, 163, 74, 0.12)' },
    { border: '#7c3aed', fill: 'rgba(124, 58, 237, 0.12)' }
  ],
  forecastColorPalette: [
    { hist: '#2563eb', pred: '#60a5fa' },
    { hist: '#dc2626', pred: '#f87171' },
    { hist: '#ea580c', pred: '#fb923c' },
    { hist: '#9333ea', pred: '#c084fc' },
    { hist: '#0d9488', pred: '#2dd4bf' },
    { hist: '#ca8a04', pred: '#facc15' },
    { hist: '#db2777', pred: '#f472b6' },
    { hist: '#1e40af', pred: '#93c5fd' },
    { hist: '#16a34a', pred: '#4ade80' },
    { hist: '#7c3aed', pred: '#a78bfa' }
  ],
  heroIndicators: {
    agriculture: 'NV.AGR.TOTL.ZS',
    electricite: 'EG.ELC.ACCS.ZS',
    elevation: 'EN.POP.EL5M.ZS',
    forest: 'AG.LND.FRST.ZS'
  },
  impactIndicators: [
    { code: 'NV.AGR.TOTL.ZS', label: 'Agriculture dans le PIB', unit: '%', icon: 'agri' },
    { code: 'EG.FEC.RNEW.ZS', label: 'Energie renouvelable', unit: '%', icon: 'energy' },
    { code: 'EG.ELC.ACCS.ZS', label: "Acces a l'electricite", unit: '%', icon: 'elec' },
    { code: 'EN.POP.EL5M.ZS', label: 'Population zone cote basse (<5m)', unit: '%', icon: 'coast' },
    { code: 'AG.LND.FRST.ZS', label: 'Surface forestiere', unit: '%', icon: 'forest' },
    { code: 'ER.H2O.FWTL.K3', label: 'Prelevements eau douce', unit: 'Mrd m3', icon: 'water' }
  ]
};

let climateData = null;
let mainChart = null;
let forecastChart = null;

// Utilitaires
function linearRegression(points) {
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  points.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecast(values, yearsAhead) {
  if (!values || values.length < 5) return [];
  const sorted = [...values].sort((a, b) => a.year - b.year);
  const recent = sorted.slice(-15);
  const points = recent.map(({ year, value }) => ({ x: year, y: value }));
  const { slope, intercept } = linearRegression(points);
  const lastYear = sorted[sorted.length - 1].year;
  const result = [];
  for (let i = 1; i <= yearsAhead; i++) {
    result.push({ year: lastYear + i, value: slope * (lastYear + i) + intercept });
  }
  return result;
}

/** Normalise une serie de valeurs entre 0 et 100 pour comparaison visuelle */
function normalizeTo100(values) {
  const valid = values.filter(v => v != null && typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return { normalized: values, min: 0, max: 100 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const normalized = values.map(v => {
    if (v == null || (typeof v !== 'number') || isNaN(v)) return null;
    return ((v - min) / range) * 100;
  });
  return { normalized, min, max };
}

async function loadData() {
  try {
    const res = await fetch(CONFIG.dataUrl);
    if (!res.ok) throw new Error('Erreur de chargement');
    climateData = await res.json();
    return climateData;
  } catch (e) {
    console.error('Chargement:', e);
    document.body.innerHTML = '<p style="padding:2rem;text-align:center;color:#c00;">Impossible de charger les donnees.</p>';
    return null;
  }
}

function updateHeroStats() {
  if (!climateData?.byIndicator) return;
  const byInd = climateData.byIndicator;
  const heroStats = document.getElementById('hero-stats');
  if (heroStats) heroStats.setAttribute('aria-busy', 'false');

  Object.entries(CONFIG.heroIndicators).forEach(([key, code]) => {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (!el) return;
    const ind = byInd[code];
    if (!ind?.values?.length) {
      el.textContent = '--';
      return;
    }
    const latest = ind.values[ind.values.length - 1];
    let val = latest.value;
    if (typeof val === 'number') {
      if (key === 'elevation' || key === 'electricite' || key === 'agriculture' || key === 'forest') val = val.toFixed(1) + '%';
      else val = val.toFixed(2);
    }
    el.textContent = val;
  });
}

function getIndicatorList() {
  if (!climateData?.indicators) return [];
  return Object.entries(climateData.indicators)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({ code, name }));
}

function getSelectedCodes(type) {
  const listId = type === 'main' ? 'list-main' : 'list-forecast';
  const list = document.getElementById(listId);
  if (!list) return [];
  return [...list.querySelectorAll('input:checked')].map(el => el.dataset.code).filter(Boolean);
}

function updateMultiselectUI(type) {
  const prefix = type === 'main' ? 'main' : 'forecast';
  const codes = getSelectedCodes(type);
  const indicators = getIndicatorList();
  const byCode = Object.fromEntries(indicators.map(i => [i.code, i.name]));

  const trigger = document.getElementById(`trigger-${prefix}`);
  const countEl = document.getElementById(`count-${prefix}`);
  const summaryEl = document.getElementById(`summary-${prefix}`);

  if (trigger) {
    const label = trigger.querySelector('.multiselect-label');
    if (codes.length === 0) {
      label.textContent = 'Choisir des indicateurs';
    } else {
      label.textContent = codes.length === 1 ? byCode[codes[0]] : `${codes.length} indicateurs`;
      if (label.scrollWidth > label.offsetWidth) label.textContent = `${codes.length} indicateurs`;
    }
  }
  if (countEl) {
    countEl.textContent = codes.length ? ` ${codes.length}` : '';
    countEl.style.display = codes.length ? 'inline' : 'none';
  }
  const total = indicators.length;
  if (summaryEl) summaryEl.textContent = total > 0 ? `${codes.length} / ${CONFIG.maxIndicators} max (${total} indicateurs)` : `${codes.length} / ${CONFIG.maxIndicators} max`;

  if (type === 'forecast') {
    const years = document.getElementById('forecast-years')?.value || 10;
    const yearsEl = document.getElementById('years-forecast');
    if (yearsEl) yearsEl.textContent = `${years} annees`;
  }
}

function initMultiselect(type) {
  const prefix = type === 'main' ? 'main' : 'forecast';
  const indicators = getIndicatorList();
  const listEl = document.getElementById(`list-${prefix}`);
  const trigger = document.getElementById(`trigger-${prefix}`);
  const dropdown = document.getElementById(`dropdown-${prefix}`);
  const searchEl = document.getElementById(`search-${prefix}`);

  if (!listEl || !trigger || !dropdown) return;

  function renderList(filter = '') {
    const f = filter.toLowerCase();
    const filtered = indicators.filter(i => !f || i.name.toLowerCase().includes(f));
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    listEl.innerHTML = filtered.map(({ code, name }) => {
      const selected = getSelectedCodes(type).includes(code);
      return `<div class="multiselect-item" data-code="${code}" title="${esc(name)}"><input type="checkbox" data-code="${code}" ${selected ? 'checked' : ''}><span>${name}</span></div>`;
    }).join('');

    listEl.querySelectorAll('.multiselect-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = item.querySelector('input');
        const checked = document.querySelectorAll(`#list-${prefix} input:checked`).length;
        if (!cb.checked && checked >= CONFIG.maxIndicators) return;
        cb.checked = !cb.checked;
        (type === 'main' ? renderMainChart : renderForecastChart)();
        updateMultiselectUI(type);
      });
    });
    listEl.querySelectorAll('input').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const checked = document.querySelectorAll(`#list-${prefix} input:checked`).length;
        if (checked > CONFIG.maxIndicators) { cb.checked = false; return; }
        (type === 'main' ? renderMainChart : renderForecastChart)();
        updateMultiselectUI(type);
      });
    });
  }

  const closeDropdown = () => {
    dropdown.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  const openDropdown = () => {
    document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('is-open'));
    document.querySelectorAll('.multiselect-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
    dropdown.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    searchEl?.focus();
    renderList(searchEl?.value || '');
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (dropdown.classList.contains('is-open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  searchEl?.addEventListener('input', () => renderList(searchEl.value));
  searchEl?.addEventListener('keydown', (e) => e.stopPropagation());

  document.getElementById(`btn-close-${prefix}`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDropdown();
  });

  document.getElementById(`btn-select-all-${prefix}`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    const visible = [...listEl.querySelectorAll('.multiselect-item')].map(el => el.dataset.code);
    const toSelect = visible.slice(0, CONFIG.maxIndicators);
    listEl.querySelectorAll('input').forEach(cb => {
      cb.checked = toSelect.includes(cb.dataset.code);
    });
    (type === 'main' ? renderMainChart : renderForecastChart)();
    updateMultiselectUI(type);
  });

  document.getElementById(`btn-select-none-${prefix}`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    listEl.querySelectorAll('input').forEach(cb => { cb.checked = false; });
    (type === 'main' ? renderMainChart : renderForecastChart)();
    updateMultiselectUI(type);
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.multiselect')) return;
    closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('is-open')) closeDropdown();
  });

  renderList();
  updateMultiselectUI(type);
}

function getSelectedIndicatorsMain() {
  return getSelectedCodes('main');
}

function getSelectedIndicatorsForecast() {
  return getSelectedCodes('forecast');
}

function renderMainChart() {
  const canvas = document.getElementById('chart-main');
  const codes = getSelectedIndicatorsMain();
  const chartType = document.getElementById('chart-type-main')?.value || 'line';
  const mode = document.getElementById('chart-mode-main')?.value || 'compare';
  const useNormalize = mode === 'compare' && codes.length >= 2;

  if (!canvas || !climateData?.byIndicator) return;

  document.getElementById('chart-main-loading')?.classList.add('is-hidden');

  if (!codes.length) {
    document.getElementById('chart-main-loading')?.classList.remove('is-hidden');
    document.getElementById('chart-main-loading').textContent = 'Selectionnez un ou plusieurs indicateurs...';
  }

  if (mainChart) mainChart.destroy();

  if (!codes.length) return;

  const datasets = [];
  const allYears = new Set();
  codes.forEach((code, i) => {
    const ind = climateData.byIndicator[code];
    if (!ind?.values?.length) return;
    const sorted = [...ind.values].sort((a, b) => a.year - b.year);
    sorted.forEach(d => allYears.add(d.year));
  });

  const labels = [...allYears].sort((a, b) => a - b);
  const colors = CONFIG.colorPalette;

  codes.forEach((code, i) => {
    const ind = climateData.byIndicator[code];
    if (!ind?.values?.length) return;
    const sorted = [...ind.values].sort((a, b) => a.year - b.year);
    const byYear = Object.fromEntries(sorted.map(d => [d.year, d.value]));
    let data = labels.map(y => byYear[y] ?? null);
    const rawValues = data.slice();

    if (useNormalize) {
      const { normalized } = normalizeTo100(data);
      data = normalized;
    }

    const c = colors[i % colors.length];
    const ds = {
      label: ind.name,
      data,
      borderColor: c.border,
      backgroundColor: c.fill,
      borderWidth: 2,
      fill: chartType === 'line' && codes.length <= 3,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 8,
      spanGaps: true
    };
    if (useNormalize) ds.rawValues = rawValues;
    datasets.push(ds);
  });

  if (!datasets.length) return;

  mainChart = new Chart(canvas, {
    type: chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 11 }, boxWidth: 14, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.raw == null) return null;
              const rawV = ctx.dataset.rawValues?.[ctx.dataIndex];
              if (useNormalize && rawV != null && typeof rawV === 'number') {
                return `${ctx.dataset.label}: ${ctx.raw.toFixed(0)} (valeur: ${rawV.toFixed(2)})`;
              }
              return `${ctx.dataset.label}: ${ctx.raw?.toFixed?.(2) ?? ctx.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Année' },
          grid: { display: false },
          ticks: { maxTicksLimit: 14, font: { size: 10 } }
        },
        y: {
          beginAtZero: useNormalize,
          max: useNormalize ? 100 : undefined,
          title: { display: true, text: useNormalize ? 'Index comparaison (0-100)' : 'Valeur' },
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 10 } }
        }
      }
    }
  });

  const explainEl = document.getElementById('chart-main-mode-explain');
  if (explainEl) explainEl.hidden = !useNormalize;
}

function renderForecastChart() {
  const canvas = document.getElementById('chart-forecast');
  const codes = getSelectedIndicatorsForecast();
  const yearsInput = document.getElementById('forecast-years');
  const yearsAhead = Math.min(30, Math.max(1, parseInt(yearsInput?.value || 10, 10) || 10));
  const mode = document.getElementById('chart-mode-forecast')?.value || 'compare';
  const useNormalize = mode === 'compare' && codes.length >= 2;

  if (!canvas || !climateData?.byIndicator) return;

  document.getElementById('chart-forecast-loading')?.classList.add('is-hidden');

  if (!codes.length) {
    document.getElementById('chart-forecast-loading')?.classList.remove('is-hidden');
    document.getElementById('chart-forecast-loading').textContent = 'Selectionnez un ou plusieurs indicateurs...';
  }

  if (forecastChart) forecastChart.destroy();

  if (!codes.length) return;

  const datasets = [];
  const colors = CONFIG.forecastColorPalette;
  let allLabels = [];
  const labelSet = new Set();

  codes.forEach((code, idx) => {
    const ind = climateData.byIndicator[code];
    if (!ind?.values?.length) return;
    const hist = [...ind.values].sort((a, b) => a.year - b.year);
    const pred = forecast(ind.values, yearsAhead);
    const lastYear = hist[hist.length - 1].year;
    hist.forEach(d => labelSet.add(d.year));
    for (let y = 1; y <= yearsAhead; y++) labelSet.add(lastYear + y);
  });

  allLabels = [...labelSet].sort((a, b) => a - b);

  codes.forEach((code, idx) => {
    const ind = climateData.byIndicator[code];
    if (!ind?.values?.length) return;
    const hist = [...ind.values].sort((a, b) => a.year - b.year);
    const pred = forecast(ind.values, yearsAhead);
    const lastYear = hist[hist.length - 1].year;
    const c = colors[idx % colors.length];

    const histByYear = Object.fromEntries(hist.map(d => [d.year, d.value]));
    const predByYear = Object.fromEntries(pred.map(d => [d.year, d.value]));

    let histData = allLabels.map(y => histByYear[y] ?? null);
    let predData = allLabels.map(y => predByYear[y] ?? null);

    const histRaw = histData.slice();
    const predRaw = predData.slice();

    if (useNormalize) {
      const allVals = [...histData, ...predData].filter(v => v != null && typeof v === 'number');
      if (allVals.length > 0) {
        const min = Math.min(...allVals);
        const max = Math.max(...allVals);
        const range = max - min || 1;
        histData = histData.map(v => (v != null && typeof v === 'number') ? ((v - min) / range) * 100 : null);
        predData = predData.map(v => (v != null && typeof v === 'number') ? ((v - min) / range) * 100 : null);
      }
    }

    datasets.push({
      label: ind.name + ' (hist.)',
      data: histData,
      rawValues: useNormalize ? histRaw : undefined,
      borderColor: c.hist,
      borderWidth: 2,
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 8,
      spanGaps: true
    });
    datasets.push({
      label: ind.name + ' (prev.)',
      data: predData,
      rawValues: useNormalize ? predRaw : undefined,
      borderColor: c.pred,
      borderWidth: 2,
      borderDash: [6, 4],
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 8,
      spanGaps: true
    });
  });

  if (!datasets.length) return;

  forecastChart = new Chart(canvas, {
    type: 'line',
    data: { labels: allLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 10 }, boxWidth: 12, padding: 6 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.raw == null) return null;
              const rawV = ctx.dataset.rawValues?.[ctx.dataIndex];
              if (useNormalize && rawV != null && typeof rawV === 'number') {
                return `${ctx.dataset.label}: ${ctx.raw.toFixed(0)} (valeur: ${rawV.toFixed(2)})`;
              }
              return `${ctx.dataset.label}: ${ctx.raw?.toFixed?.(2) ?? ctx.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Année' },
          grid: { display: false },
          ticks: { maxTicksLimit: 16, font: { size: 10 } }
        },
        y: {
          beginAtZero: useNormalize,
          max: useNormalize ? 100 : undefined,
          title: { display: true, text: useNormalize ? 'Index comparaison (0-100)' : 'Valeur' },
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 10 } }
        }
      }
    }
  });
  updateLegendButtonState('forecast');

  const explainEl = document.getElementById('chart-forecast-mode-explain');
  if (explainEl) explainEl.hidden = !useNormalize;
}

function toggleLegend(chartId) {
  const chart = chartId === 'main' ? mainChart : forecastChart;
  const btnId = chartId === 'main' ? 'btn-toggle-legend-main' : 'btn-toggle-legend-forecast';
  if (!chart) return;
  const opts = chart.options.plugins.legend;
  opts.display = !opts.display;
  chart.update();
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('is-active', opts.display);
}

function updateLegendButtonState(chartId) {
  const chart = chartId === 'main' ? mainChart : forecastChart;
  const btnId = chartId === 'main' ? 'btn-toggle-legend-main' : 'btn-toggle-legend-forecast';
  const btn = document.getElementById(btnId);
  if (chart && btn) {
    const visible = chart.options.plugins.legend.display;
    btn.classList.toggle('is-active', visible);
  }
}

function exportChart(chart, format, scale = 2) {
  if (!chart) return;
  const canvas = chart.canvas;
  const fmt = format === 'jpg' ? 'jpeg' : 'png';

  let dataUrl;
  let w, h;
  if (scale !== 1) {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width * scale;
    tmp.height = canvas.height * scale;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    dataUrl = tmp.toDataURL(`image/${fmt}`, format === 'jpg' ? 0.92 : undefined);
    w = tmp.width;
    h = tmp.height;
  } else {
    dataUrl = canvas.toDataURL(`image/${fmt}`, format === 'jpg' ? 0.92 : undefined);
    w = canvas.width;
    h = canvas.height;
  }

  if (format === 'pdf') {
    try {
      const { jsPDF } = window.jspdf || {};
      if (jsPDF) {
        const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait' });
        const maxW = 190;
        const maxH = 270;
        const ratio = Math.min(maxW / w, maxH / h);
        pdf.addImage(dataUrl, 'PNG', 10, 10, w * ratio, h * ratio);
        pdf.save('impact-climatique-benin.pdf');
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'impact-climatique-benin.png';
        a.click();
      }
    } catch (e) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'impact-climatique-benin.png';
      a.click();
    }
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `impact-climatique-benin.${format}`;
    a.click();
  }
}

function setupExportModals() {
  const setups = [
    { btnId: 'btn-export-main', modalId: 'export-modal-main', downloadId: 'btn-download-main', chart: 'main' },
    { btnId: 'btn-export-forecast', modalId: 'export-modal-forecast', downloadId: 'btn-download-forecast', chart: 'forecast' }
  ];

  setups.forEach(({ btnId, modalId, downloadId, chart }) => {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    const downloadBtn = document.getElementById(downloadId);
    if (!btn || !modal) return;

    let selectedFormat = null;
    let selectedSize = 2;

    const updateSelection = () => {
      modal.querySelectorAll('.export-format-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.format === selectedFormat);
      });
      modal.querySelectorAll('.export-size-btn').forEach(b => {
        b.classList.toggle('active', parseFloat(b.dataset.size) === selectedSize);
      });
      downloadBtn.disabled = !selectedFormat;
    };

    btn.addEventListener('click', () => {
      selectedFormat = null;
      selectedSize = 2;
      updateSelection();
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    });

    modal.querySelectorAll('.export-format-btn').forEach(b => {
      b.addEventListener('click', () => {
        selectedFormat = b.dataset.format;
        updateSelection();
      });
    });

    modal.querySelectorAll('.export-size-btn').forEach(b => {
      b.addEventListener('click', () => {
        selectedSize = parseFloat(b.dataset.size);
        updateSelection();
      });
    });

    downloadBtn.addEventListener('click', () => {
      if (!selectedFormat) return;
      const ch = chart === 'main' ? mainChart : forecastChart;
      exportChart(ch, selectedFormat, selectedSize);
      modal.hidden = true;
      document.body.style.overflow = '';
    });

    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
    };

    modal.querySelector('.export-modal-backdrop')?.addEventListener('click', close);
    modal.querySelector('.export-modal-close')?.addEventListener('click', close);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  });
}

const iconPaths = {
  agri: 'M3 3h6v4H3V3zm0 6h6v4H3V9zm8-6h6v4h-6V3zm0 6h6v4h-6V9z',
  energy: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  elec: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z',
  coast: 'M12 2C8 2 5 5 5 9c0 6 7 12 7 12s7-6 7-12c0-4-3-7-7-7zm0 10c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z',
  forest: 'M12 2L2 12h4v8h12v-8h4L12 2zm0 4l4 4h-2v6h-4v-6H8l4-4z',
  water: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z'
};

function renderImpacts() {
  const grid = document.getElementById('impacts-grid');
  if (!grid || !climateData?.byIndicator) return;

  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = CONFIG.impactIndicators.map(({ code, label, unit, icon }) => {
    const ind = climateData.byIndicator[code];
    let value = '--';
    let desc = 'Donnees non disponibles';
    let trend = '';

    if (ind?.values?.length) {
      const sorted = [...ind.values].sort((a, b) => b.year - a.year);
      const latest = sorted[0];
      const old = sorted.find(d => d.year <= latest.year - 5);
      if (old && typeof latest.value === 'number' && typeof old.value === 'number') {
        const diff = ((latest.value - old.value) / old.value * 100).toFixed(1);
        if (Math.abs(diff) >= 0.5) trend = diff > 0
          ? `<span class="trend trend-up">+${diff}% (5 ans)</span>`
          : `<span class="trend trend-down">${diff}% (5 ans)</span>`;
      }
      value = typeof latest.value === 'number'
        ? (latest.value % 1 === 0 ? latest.value : latest.value.toFixed(2)) + (unit || '')
        : latest.value + (unit || '');
      desc = `Derniere valeur (${latest.year})`;
    }

    const path = iconPaths[icon] || iconPaths.agri;
    return `
      <article class="impact-card">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${path}"/></svg>
          ${label}
        </h3>
        <div class="value-row">
          <span class="value">${value}</span>
          ${trend}
        </div>
        <p class="desc">${desc}</p>
      </article>
    `;
  }).join('');
}

function populateTableSelect() {
  const select = document.getElementById('table-indicator-select');
  if (!select) return;
  const indicators = getIndicatorList();
  select.innerHTML = '<option value="">-- Choisir un indicateur --</option>' +
    indicators.map(({ code, name }) => `<option value="${code}">${name}</option>`).join('');
  select.addEventListener('change', renderDataTable);
}

function renderDataTable() {
  const select = document.getElementById('table-indicator-select');
  const tbody = document.querySelector('#data-table tbody');
  if (!select || !tbody) return;

  const code = select.value;
  if (!code || !climateData?.byIndicator?.[code]) {
    tbody.innerHTML = '';
    return;
  }

  const ind = climateData.byIndicator[code];
  const sorted = [...ind.values].sort((a, b) => b.year - a.year);

  tbody.innerHTML = sorted.map(({ year, value }) => `
    <tr>
      <td>${year}</td>
      <td class="value-cell">${typeof value === 'number' ? value.toFixed(4) : value}</td>
    </tr>
  `).join('');
}

function initEvents() {
  document.getElementById('chart-type-main')?.addEventListener('change', renderMainChart);
  document.getElementById('chart-mode-main')?.addEventListener('change', renderMainChart);
  document.getElementById('forecast-years')?.addEventListener('change', renderForecastChart);
  document.getElementById('chart-mode-forecast')?.addEventListener('change', renderForecastChart);

  document.getElementById('btn-toggle-legend-main')?.addEventListener('click', () => toggleLegend('main'));
  document.getElementById('btn-toggle-legend-forecast')?.addEventListener('click', () => toggleLegend('forecast'));

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', nav.classList.contains('is-open'));
      navToggle.setAttribute('aria-label', nav.classList.contains('is-open') ? 'Fermer' : 'Ouvrir');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('is-open'));
    });
  }
}

function setDataDate() {
  const el = document.getElementById('data-date');
  if (el && climateData?.meta?.lastUpdate) el.textContent = climateData.meta.lastUpdate;
}

async function init() {
  const data = await loadData();
  if (!data) return;

  updateHeroStats();
  initMultiselect('main');
  initMultiselect('forecast');
  populateTableSelect();
  setupExportModals();

  document.getElementById('forecast-years')?.addEventListener('input', () => {
    updateMultiselectUI('forecast');
    renderForecastChart();
  });

  const defaultCode = 'NV.AGR.TOTL.ZS';
  const mainList = document.getElementById('list-main');
  const mainCb = mainList?.querySelector(`input[data-code="${defaultCode}"]`);
  if (mainCb) {
    mainCb.checked = true;
    updateMultiselectUI('main');
  }
  renderMainChart();

  const fcList = document.getElementById('list-forecast');
  const fcCb = fcList?.querySelector(`input[data-code="${defaultCode}"]`);
  if (fcCb) {
    fcCb.checked = true;
    updateMultiselectUI('forecast');
  }
  renderForecastChart();

  renderImpacts();
  setDataDate();
  initEvents();
}

init();
