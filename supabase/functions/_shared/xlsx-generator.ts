import JSZip from "https://esm.sh/jszip@3.10.1";

/**
 * Generate a real XLSX file (Office Open XML) using JSZip.
 * Supports multiple sheets with proper formatting.
 */

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

function buildSheetXml(sheet: SheetData): string {
  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>`;
  
  // Header row
  xml += '<row r="1">';
  sheet.headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    xml += `<c r="${col}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  xml += '</row>';
  
  // Data rows
  sheet.rows.forEach((row, ri) => {
    xml += `<row r="${ri + 2}">`;
    row.forEach((val, ci) => {
      const col = String.fromCharCode(65 + ci);
      const ref = `${col}${ri + 2}`;
      if (typeof val === 'number' && !isNaN(val)) {
        xml += `<c r="${ref}"><v>${val}</v></c>`;
      } else {
        xml += `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(val || ''))}</t></is></c>`;
      }
    });
    xml += '</row>';
  });
  
  xml += '</sheetData></worksheet>';
  return xml;
}

export async function generateXlsxFile(sheets: SheetData[]): Promise<Uint8Array> {
  const zip = new JSZip();
  
  // [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`;
  sheets.forEach((_, i) => {
    contentTypes += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  contentTypes += '</Types>';
  zip.file('[Content_Types].xml', contentTypes);
  
  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  
  // xl/workbook.xml
  let workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>`;
  sheets.forEach((s, i) => {
    workbook += `<sheet name="${escapeXml(s.name.substring(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  });
  workbook += '</sheets></workbook>';
  zip.file('xl/workbook.xml', workbook);
  
  // xl/_rels/workbook.xml.rels
  let wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  sheets.forEach((_, i) => {
    wbRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  });
  wbRels += '</Relationships>';
  zip.file('xl/_rels/workbook.xml.rels', wbRels);
  
  // xl/worksheets/sheetN.xml
  sheets.forEach((sheet, i) => {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, buildSheetXml(sheet));
  });
  
  const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return buffer;
}

// ===== MODULE-SPECIFIC XLSX BUILDERS =====

function flattenToSheet(data: any, name: string): SheetData {
  const rows: [string, string | number][] = [];
  const flatten = (obj: any, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        if (typeof item === "object") flatten(item, `${prefix}[${i}]`);
        else rows.push([`${prefix}[${i}]`, item]);
      });
    } else {
      Object.entries(obj).forEach(([key, val]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null) flatten(val, fullKey);
        else rows.push([fullKey.replace(/_/g, ' '), val as string | number]);
      });
    }
  };
  flatten(data);
  return { name, headers: ['Champ', 'Valeur'], rows };
}

export function buildInputsXlsx(data: any): SheetData[] {
  const sheets: SheetData[] = [];
  
  // Compte de résultat
  const cr = data.compte_resultat || {};
  if (Object.keys(cr).length) {
    sheets.push({
      name: 'Compte de Résultat',
      headers: ['Poste', `Montant (${data.devise || 'FCFA'})`],
      rows: Object.entries(cr).map(([k, v]) => [k.replace(/_/g, ' '), Number(v) || 0]),
    });
  }
  
  // Bilan Actif
  if (data.bilan?.actif) {
    sheets.push({
      name: 'Bilan Actif',
      headers: ['Poste', `Montant (${data.devise || 'FCFA'})`],
      rows: Object.entries(data.bilan.actif).map(([k, v]) => [k.replace(/_/g, ' '), Number(v) || 0]),
    });
  }
  
  // Bilan Passif
  if (data.bilan?.passif) {
    sheets.push({
      name: 'Bilan Passif',
      headers: ['Poste', `Montant (${data.devise || 'FCFA'})`],
      rows: Object.entries(data.bilan.passif).map(([k, v]) => [k.replace(/_/g, ' '), Number(v) || 0]),
    });
  }
  
  // Indicateurs & Ratios historiques
  if (data.ratios_historiques?.length) {
    sheets.push({
      name: 'Ratios Historiques',
      headers: ['Ratio', 'N-2', 'N-1', 'N', 'Benchmark'],
      rows: data.ratios_historiques.map((r: any) => [r.ratio, r.n_moins_2 || '', r.n_moins_1 || '', r.n || '', r.benchmark || '']),
    });
  }

  // Trésorerie & BFR
  if (data.tresorerie_bfr?.composantes?.length) {
    sheets.push({
      name: 'Trésorerie BFR',
      headers: ['Indicateur', 'Valeur', 'Benchmark'],
      rows: data.tresorerie_bfr.composantes.map((c: any) => [c.indicateur, c.valeur || '', c.benchmark || '']),
    });
  }

  // Analyse marge par activité
  if (data.analyse_marge?.activites?.length) {
    sheets.push({
      name: 'Analyse Marge',
      headers: ['Activité', 'CA (FCFA)', 'Marge Brute', 'Marge %', 'Classification'],
      rows: data.analyse_marge.activites.map((a: any) => [a.nom, Number(a.ca) || 0, Number(a.marge_brute) || 0, a.marge_pct || '', a.classification || '']),
    });
  }
  
  // Projection 5 ans
  if (data.projection_5ans?.lignes?.length) {
    sheets.push({
      name: 'Projection 5 Ans',
      headers: ['Poste', 'Année 1', 'Année 2', 'Année 3', 'Année 4', 'Année 5', 'CAGR'],
      rows: data.projection_5ans.lignes.map((l: any) => [l.poste, Number(l.an1) || 0, Number(l.an2) || 0, Number(l.an3) || 0, Number(l.an4) || 0, Number(l.an5) || 0, l.cagr || '']),
    });
  }

  // Scénarios
  if (data.scenarios?.tableau?.length) {
    sheets.push({
      name: 'Scénarios',
      headers: ['Indicateur', 'Prudent', 'Central', 'Ambitieux'],
      rows: data.scenarios.tableau.map((r: any) => [r.indicateur, r.prudent || '', r.central || '', r.ambitieux || '']),
    });
  }

  // Plan d'action
  if (data.plan_action?.length) {
    sheets.push({
      name: 'Plan Action',
      headers: ['Horizon', 'Action', 'Coût', 'Impact'],
      rows: data.plan_action.map((a: any) => [a.horizon || '', a.action || '', a.cout || '', a.impact || '']),
    });
  }

  if (sheets.length === 0) sheets.push(flattenToSheet(data, 'Données'));
  return sheets;
}

export function buildFrameworkXlsx(data: any): SheetData[] {
  const sheets: SheetData[] = [];
  const ratios = data.ratios || {};
  
  for (const [cat, group] of Object.entries(ratios) as [string, any][]) {
    sheets.push({
      name: cat.substring(0, 31),
      headers: ['Ratio', 'Valeur', 'Benchmark/Seuil', 'Verdict'],
      rows: Object.entries(group).map(([k, v]: any) => [
        k.replace(/_/g, ' '),
        v?.valeur || String(v),
        v?.benchmark || v?.seuil || '—',
        v?.verdict || '',
      ]),
    });
  }
  
  if (sheets.length === 0) sheets.push(flattenToSheet(data, 'Framework'));
  return sheets;
}

export function buildPlanOvoXlsx(data: any): SheetData[] {
  const sheets: SheetData[] = [];
  
  // Hypothèses
  if (data.hypotheses_base) {
    sheets.push({
      name: 'Hypothèses',
      headers: ['Paramètre', 'Valeur'],
      rows: Object.entries(data.hypotheses_base).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
    });
  }
  
  // Scénarios
  for (const name of ['optimiste', 'realiste', 'pessimiste']) {
    const s = data.scenarios?.[name];
    if (!s?.projections?.length) continue;
    sheets.push({
      name: `Scénario ${name}`,
      headers: ['Année', 'CA', 'Résultat Net', 'Trésorerie'],
      rows: s.projections.map((p: any) => [
        String(p.annee || ''),
        Number(p.ca) || 0,
        Number(p.resultat_net) || 0,
        Number(p.tresorerie) || 0,
      ]),
    });
  }
  
  if (sheets.length === 0) sheets.push(flattenToSheet(data, 'Plan OVO'));
  return sheets;
}
