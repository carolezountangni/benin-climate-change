/**
 * Impact Climatique Benin - Application de visualisation
 * Donnees: World Bank Climate Change Indicators
 */

const CONFIG = {
  dataUrl: 'data/climate-benin.json',
  heroIndicators: {
    agriculture: 'NV.AGR.TOTL.ZS',
    electricite: 'EG.ELC.ACCS.ZS',
    elevation: 'EN.POP.EL5M.ZS'
  },
  impactIndicators: [
    { code: 'NV.AGR.TOTL.ZS', label: 'Agriculture dans le PIB', unit: '%', icon: 'agri' },
    { code: 'EG.FEC.RNEW.ZS', label: 'Energie renouvelable', unit: '%', icon: 'energy' },
    { code: 'EG.ELC.ACCS.ZS', label: "Acces a l'electricite", unit: '%', icon: 'elec' },
    { code: 'EN.POP.EL5M.ZS', label: 'Population zone cote basse (&lt;5m)', unit: '%', icon: 'coast' },
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
    const year = lastYear + i;
    result.push({ year, value: slope * year + intercept });
  }
  return result;
}

// Chargement des donnees
async function loadData() {
  try {
    const res = await fetch(CONFIG.dataUrl);
    if (!res.ok) throw new Error('Erreur de chargement');
    climateData = await res.json();
    return climateData;
  } catch (e) {
    console.error('Chargement des donnees:', e);
    document.body.innerHTML = '<p style="padding:2rem;text-align:center;color:#c00;">Impossible de charger les donnees. Verifiez que le fichier data/climate-benin.json existe.</p>';
    return null;
  }
}

// Stats hero
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
    if (key === 'elevation') val = val.toFixed(1) + '%';
    else if (key === 'electricite') val = val.toFixed(1) + '%';
    else if (key === 'agriculture') val = val.toFixed(1) + '%';
    el.textContent = val;
  });
}

// Masquer chargement des graphiques au premier rendu
function hideChartLoaders() {
  document.getElementById('chart-main-loading')?.classList.add('is-hidden');
  document.getElementById('chart-forecast-loading')?.classList.add('is-hidden');
}

// Select indicateurs
function populateIndicatorSelects() {
  if (!climateData?.indicators) return;
  const selectMain = document.getElementById('indicator-select');
  const selectForecast = document.getElementById('forecast-select');
  if (!selectMain || !selectForecast) return;

  const opts = Object.entries(climateData.indicators)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');

  const placeholder = '<option value="">-- Choisir un indicateur --</option>';
  selectMain.innerHTML = placeholder + opts;
  selectForecast.innerHTML = placeholder + opts;

  const defaultCode = 'NV.AGR.TOTL.ZS';
  selectMain.value = defaultCode;
  selectForecast.value = defaultCode;
  hideChartLoaders();
  renderMainChart(defaultCode);
  renderForecastChart(defaultCode);
}

// Graphique principal
function renderMainChart(code) {
  const canvas = document.getElementById('chart-main');
  if (!canvas || !climateData?.byIndicator?.[code]) return;

  const ind = climateData.byIndicator[code];
  const sorted = ind.values.sort((a, b) => a.year - b.year);
  const labels = sorted.map(d => d.year);
  const data = sorted.map(d => d.value);

  if (mainChart) mainChart.destroy();

  const loading = document.getElementById('chart-main-loading');
  if (loading) loading.classList.add('is-hidden');

  mainChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: ind.name,
        data,
        borderColor: '#0d4f2b',
        backgroundColor: 'rgba(13, 79, 43, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw?.toFixed?.(2) ?? ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12, font: { size: 11 } }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// Graphique previsions
function renderForecastChart(code) {
  const canvas = document.getElementById('chart-forecast');
  const yearsInput = document.getElementById('forecast-years');
  if (!canvas || !climateData?.byIndicator?.[code]) return;

  const yearsAhead = Math.min(30, Math.max(1, parseInt(yearsInput?.value || 10, 10) || 10));
  const ind = climateData.byIndicator[code];
  const hist = ind.values.sort((a, b) => a.year - b.year);
  const pred = forecast(ind.values, yearsAhead);

  const histLabels = hist.map(d => d.year);
  const histData = hist.map(d => d.value);
  const predLabels = pred.map(d => d.year);
  const predData = pred.map(d => d.value);

  const lastHistYear = histLabels[histLabels.length - 1];
  const allLabels = [...histLabels];
  for (let y = 1; y <= yearsAhead; y++) {
    allLabels.push(lastHistYear + y);
  }

  const histExt = allLabels.map(l => histLabels.includes(l) ? histData[histLabels.indexOf(l)] : null);
  const predExt = allLabels.map(l => predLabels.includes(l) ? predData[predLabels.indexOf(l)] : null);

  if (forecastChart) forecastChart.destroy();

  const loading = document.getElementById('chart-forecast-loading');
  if (loading) loading.classList.add('is-hidden');

  forecastChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historique',
          data: histExt,
          borderColor: '#0d4f2b',
          backgroundColor: 'rgba(13, 79, 43, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          spanGaps: true
        },
        {
          label: 'Prevision',
          data: predExt,
          borderColor: '#2d9d5f',
          borderDash: [5, 5],
          backgroundColor: 'rgba(45, 157, 95, 0.05)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => ctx.raw != null ? `${ctx.raw?.toFixed?.(2) ?? ctx.raw}` : null
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 14, font: { size: 11 } }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// Cartes impacts - icones SVG inline (chemins simplifies)
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
      const sorted = ind.values.sort((a, b) => b.year - a.year);
      const latest = sorted[0];
      const old = sorted.find(d => d.year <= latest.year - 5);
      if (old && typeof latest.value === 'number' && typeof old.value === 'number') {
        const diff = ((latest.value - old.value) / old.value * 100).toFixed(1);
        if (Math.abs(diff) >= 0.5) trend = diff > 0
          ? `<span class="trend trend-up" aria-label="Hausse de ${diff}% sur 5 ans">+${diff}%</span>`
          : `<span class="trend trend-down" aria-label="Baisse de ${Math.abs(diff)}% sur 5 ans">${diff}%</span>`;
      }
      value = typeof latest.value === 'number'
        ? (latest.value % 1 === 0 ? latest.value : latest.value.toFixed(2)) + (unit || '')
        : latest.value + (unit || '');
      desc = `Derniere valeur connue (${latest.year})`;
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

// Event listeners
function initEvents() {
  const selectMain = document.getElementById('indicator-select');
  const selectForecast = document.getElementById('forecast-select');
  const yearsInput = document.getElementById('forecast-years');
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  if (selectMain) {
    selectMain.addEventListener('change', e => renderMainChart(e.target.value));
  }
  if (selectForecast) {
    selectForecast.addEventListener('change', e => renderForecastChart(e.target.value));
  }
  if (yearsInput) {
    yearsInput.addEventListener('change', () => {
      const code = selectForecast?.value;
      if (code) renderForecastChart(code);
    });
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open);
      navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('is-open'));
    });
  }
}

// Date des donnees
function setDataDate() {
  const el = document.getElementById('data-date');
  if (el && climateData?.meta?.lastUpdate) {
    el.textContent = climateData.meta.lastUpdate;
  }
}

// Init
async function init() {
  const data = await loadData();
  if (!data) return;

  updateHeroStats();
  populateIndicatorSelects();
  renderImpacts();
  setDataDate();
  initEvents();
}

init();
