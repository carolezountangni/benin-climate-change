#!/usr/bin/env node
/**
 * Script pour convertir les CSV en JSON optimisé pour le frontend
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../donnees');
const OUT_FILE = path.join(__dirname, '../public/data/climate-benin.json');

function parseCSV(content) {
  const lines = content.trim().split('\n').filter(l => l);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((h, j) => row[h] = values[j]?.trim?.() ?? values[j]);
      rows.push(row);
    }
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function loadAndMergeData() {
  const fullData = [];
  const indicatorNames = {};

  const files = [
    'resource-932b1d04-d1e5-4f43-b419-551b61d95af8.csv',
    'resource-4ad3cdd2-5ddf-4695-98a0-889a37daf73d.csv'
  ];

  const nameMap = {
    'SH.DYN.MORT': 'Mortality rate, under-5 (per 1,000 live births)',
    'SI.POV.DDAY': 'Poverty headcount ratio at $2.15 a day (2017 PPP) (% of population)',
    'SP.POP.GROW': 'Population growth (annual %)'
  };

  files.forEach(file => {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) return;
    const content = fs.readFileSync(fp, 'utf-8');
    const rows = parseCSV(content);

    rows.forEach(row => {
      if (row['Country ISO3'] !== 'BEN') return;
      const year = parseInt(row.Year, 10);
      if (isNaN(year)) return;

      const indicatorCode = row['Indicator Code'];
      const indicatorName = row['Indicator Name'] || nameMap[indicatorCode] || indicatorCode;
      const value = parseFloat(row.Value);
      if (isNaN(value)) return;

      indicatorNames[indicatorCode] = indicatorName;
      fullData.push({
        year,
        code: indicatorCode,
        name: indicatorName,
        value
      });
    });
  });

  return { data: fullData, indicators: indicatorNames };
}

function groupByIndicator(data) {
  const byIndicator = {};
  data.forEach(d => {
    if (!byIndicator[d.code]) {
      byIndicator[d.code] = { name: d.name, values: [] };
    }
    byIndicator[d.code].values.push({ year: d.year, value: d.value });
  });
  Object.keys(byIndicator).forEach(k => {
    byIndicator[k].values.sort((a, b) => a.year - b.year);
  });
  return byIndicator;
}

const { data, indicators } = loadAndMergeData();
const byIndicator = groupByIndicator(data);

  const output = {
  meta: {
    source: 'Donnees Publiques du Benin - Benin Climate Change',
    url: 'https://donneespubliques.gouv.bj/datasets/benin-climate-change-d28fc158-46e4-44e7-b6f9-7e962c0bc0b2',
    lastUpdate: new Date().toISOString().slice(0, 10)
  },
  indicators,
  byIndicator,
  raw: data
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 0), 'utf-8');
console.log('Data built:', OUT_FILE);