import JSZip from "npm:jszip@3";

// ===== XML HELPERS =====

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function setCellInXml(
  sheetXml: string,
  cellRef: string,
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") return sheetXml;

  const safeVal = String(value);
  const row = cellRef.match(/\d+/)?.[0] ?? "1";

  const isNum =
    typeof value === "number" ||
    (typeof value === "string" &&
      !isNaN(Number(value)) &&
      value.trim() !== "" &&
      !value.includes("%") &&
      !value.includes("/") &&
      !value.includes(" "));

  const newCell = isNum
    ? `<c r="${cellRef}"><v>${value}</v></c>`
    : `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(safeVal)}</t></is></c>`;

  // 1. Replace existing self-closing cell <c r="F10" s="5"/>
  const selfClosingRegex = new RegExp(
    `<c\\s[^>]*r="${cellRef}"[^/]*/\\s*>`,
    "s"
  );
  if (selfClosingRegex.test(sheetXml)) {
    return sheetXml.replace(selfClosingRegex, newCell);
  }

  // 2. Replace existing cell with content <c r="F10" ...>...</c>
  const existingCellRegex = new RegExp(
    `<c\\s[^>]*r="${cellRef}"[^>]*>(?:(?!</c>).)*</c>`,
    "s"
  );
  if (existingCellRegex.test(sheetXml)) {
    return sheetXml.replace(existingCellRegex, newCell);
  }

  // 3. Insert into existing row
  const rowRegex = new RegExp(`(<row[^>]*\\br="${row}"[^>]*>)(.*?)(</row>)`, "s");
  if (rowRegex.test(sheetXml)) {
    return sheetXml.replace(rowRegex, (_, open, content, close) => {
      return `${open}${content}${newCell}${close}`;
    });
  }

  // 4. Create the row
  return sheetXml.replace("</sheetData>", `<row r="${row}">${newCell}</row></sheetData>`);
}

// ===== SHARED STRINGS =====

async function loadSharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string") ?? "";
  const strings: string[] = [];
  if (!xml) return strings;

  const matches = xml.matchAll(/<si[^>]*>(.*?)<\/si>/gs);
  for (const match of matches) {
    const tMatch = match[1].match(/<t[^>]*>([^<]*)<\/t>/);
    strings.push(tMatch ? tMatch[1] : "");
  }
  return strings;
}

function getCellValue(
  sheetXml: string,
  cellRef: string,
  sharedStrings: string[]
): string | null {
  // Match both <c ...>...</c> and <c .../>
  const cellRegex = new RegExp(`<c[^>]*r="${cellRef}"[^>]*(?:>(.*?)<\/c>|/>)`, "s");
  const match = sheetXml.match(cellRegex);
  if (!match) return null;

  const cellContent = match[1] || "";

  const tMatch = cellContent.match(/<t[^>]*>([^<]*)<\/t>/);
  if (tMatch) return tMatch[1];

  const vMatch = cellContent.match(/<v[^>]*>([^<]*)<\/v>/);
  if (vMatch) {
    const val = vMatch[1];
    if (match[0].includes('t="s"')) {
      const idx = parseInt(val);
      if (!isNaN(idx) && idx < sharedStrings.length) return sharedStrings[idx];
    }
    return val;
  }

  return null;
}

// ===== TARGET ID NORMALIZATION =====
// Excel stores numbers as floats: "1.1000000000000001" → "1.1", "8.1999999999999993" → "8.2"
// Also handles: "7,2 a" → "7.2a", "2.a" → "2.a", "9.b" → "9.b", "11.c" → "11.c"

function normalizeTargetId(id: string): string {
  const cleaned = id.replace(/,/g, ".").trim().toLowerCase();

  // Pattern: "7.2 a" or "7.2 b" (with space before letter)
  const spaceLetterMatch = cleaned.match(/^(\d+)\.(\d+)\s+([a-z])$/);
  if (spaceLetterMatch) {
    return `${spaceLetterMatch[1]}.${spaceLetterMatch[2]}${spaceLetterMatch[3]}`;
  }

  // Pattern: "2.a", "9.b", "9.c", "6.a", "11.c" (digit.letter)
  const digitLetterMatch = cleaned.match(/^(\d+)\.([a-z])$/);
  if (digitLetterMatch) {
    return `${digitLetterMatch[1]}.${digitLetterMatch[2]}`;
  }

  // Pattern: pure number (possibly float artifact) — "1.1000000000000001" → "1.1"
  const num = parseFloat(cleaned);
  if (!isNaN(num) && /^\d+\.\d+/.test(cleaned)) {
    // Round to at most 2 decimal places to fix float artifacts
    const rounded = Math.round(num * 100) / 100;
    // Format without trailing zeros but keep at least one decimal
    const formatted = rounded.toString();
    return formatted;
  }

  // Pattern: "17.16", "17.17" — already handled by float path above

  // Fallback
  const match = cleaned.match(/^(\d+)\.(\d+(?:[a-z])?)/);
  if (match) {
    return `${match[1]}.${match[2]}`;
  }

  return cleaned;
}

// ===== DYNAMIC SHEET DETECTION =====

async function findSheetFile(
  zip: JSZip,
  sheetNameKeyword: string
): Promise<string | null> {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string") ?? "";
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string") ?? "";

  if (!workbookXml || !relsXml) return null;

  const sheetRegex = /<sheet[^>]+name="([^"]*)"[^>]+r:id="([^"]*)"/g;
  let rId: string | null = null;

  for (const match of workbookXml.matchAll(sheetRegex)) {
    if (match[1].toLowerCase().includes(sheetNameKeyword.toLowerCase())) {
      rId = match[2];
      console.log(`[odd-excel] Found sheet "${match[1]}" → rId=${rId}`);
      break;
    }
  }

  if (!rId) return null;

  const relRegex = new RegExp(`Id="${rId}"[^>]+Target="([^"]*)"`, "s");
  const relMatch = relsXml.match(relRegex);
  if (!relMatch) return null;

  const target = relMatch[1].startsWith("worksheets/")
    ? `xl/${relMatch[1]}`
    : relMatch[1];

  console.log(`[odd-excel] rId=${rId} → file=${target}`);
  return target;
}

// ===== TARGET ROW DETECTION =====
// Scans rows 9-200 for rows where column B has a target ID pattern and column D = "x"

function findTargetRows(
  sheetXml: string,
  sharedStrings: string[],
  startRow = 9,
  endRow = 200
): Array<{ row: number; targetId: string; rawB: string }> {
  const results: Array<{ row: number; targetId: string; rawB: string }> = [];

  for (let row = startRow; row <= endRow; row++) {
    const colB = getCellValue(sheetXml, `B${row}`, sharedStrings);
    const colD = getCellValue(sheetXml, `D${row}`, sharedStrings);

    if (!colB || !colD) continue;
    if (colD.toLowerCase().trim() !== "x") continue;

    // Check if B looks like a target ID:
    // - Starts with digit(s) followed by . or , then digit(s) or letter(s)
    // - Or is a float like "1.1000000000000001"
    const trimmedB = colB.trim();
    const isTargetPattern = /^\d+[.,]\d/.test(trimmedB) || /^\d+\.[a-z]$/i.test(trimmedB);

    if (isTargetPattern) {
      const normalizedId = normalizeTargetId(trimmedB);
      results.push({ row, targetId: normalizedId, rawB: trimmedB });
    }
  }

  console.log(`[odd-excel] Found ${results.length} target rows (rows ${startRow}-${endRow}):`);
  results.forEach(r => console.log(`  Row ${r.row}: "${r.rawB}" → "${r.targetId}"`));
  return results;
}

// ===== FILL TARGET ROW =====
// Columns: E=info_additionnelle, F=positif(1), G=neutre(1), H=negatif(1), I=besoin_aide(1)

function fillTargetRow(sheetXml: string, cible: Record<string, string>, row: number): string {
  if (cible.justification || cible.info_additionnelle) {
    const info = cible.info_additionnelle || cible.justification || "";
    sheetXml = setCellInXml(sheetXml, `E${row}`, info);
  }

  if (cible.evaluation === "positif") {
    sheetXml = setCellInXml(sheetXml, `F${row}`, 1);
  } else if (cible.evaluation === "neutre") {
    sheetXml = setCellInXml(sheetXml, `G${row}`, 1);
  } else if (cible.evaluation === "negatif") {
    sheetXml = setCellInXml(sheetXml, `H${row}`, 1);
  }

  return sheetXml;
}

// ===== MAIN EXPORT =====

export async function fillOddExcelTemplate(
  data: Record<string, unknown>,
  enterpriseName: string,
  supabase: { storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: Error | null }> } } }
): Promise<Uint8Array> {

  const { data: fileData, error } = await supabase.storage
    .from("templates")
    .download("ODD_template.xlsx");

  if (error || !fileData) {
    throw new Error(`Template ODD_template.xlsx introuvable: ${error?.message ?? "absent"}`);
  }

  const buffer = await fileData.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings = await loadSharedStrings(zip);
  console.log(`[odd-excel] ${sharedStrings.length} shared strings chargées`);

  const cibles = (data.evaluation_cibles_odd as Record<string, unknown>)?.cibles as Array<Record<string, string>> ?? [];
  const indicateurs = (data.indicateurs_impact as Record<string, unknown>)?.indicateurs as Array<Record<string, string>> ?? [];

  // Build a lookup map from normalized AI target IDs
  const cibleMap = new Map<string, Record<string, string>>();
  for (const cible of cibles) {
    if (!cible.target_id) continue;
    const normalizedId = normalizeTargetId(cible.target_id);
    cibleMap.set(normalizedId, cible);
  }
  console.log(`[odd-excel] AI produced ${cibles.length} cibles, ${cibleMap.size} unique normalized IDs`);

  // ── Main sheet: "Evaluation cibles ODD avec Circ" ──
  const evalSheetFile = await findSheetFile(zip, "Evaluation cibles ODD");
  const fallbackEval = "xl/worksheets/sheet2.xml";
  const evalFile = evalSheetFile || fallbackEval;

  let sheetEval = await zip.file(evalFile)?.async("string") ?? "";
  if (!sheetEval) throw new Error(`Feuille d'évaluation ODD introuvable (${evalFile})`);

  // Set enterprise name and country
  sheetEval = setCellInXml(sheetEval, "E1", enterpriseName);
  if ((data.metadata as Record<string, string>)?.pays) {
    sheetEval = setCellInXml(sheetEval, "E2", (data.metadata as Record<string, string>).pays);
  }

  // Scan template for target rows
  const targetRows = findTargetRows(sheetEval, sharedStrings, 9, 200);

  let matchedCount = 0;
  let unmatchedTemplate: string[] = [];
  let unmatchedAI: string[] = [];

  if (targetRows.length > 0) {
    // Template-driven approach: iterate template rows and find matching AI cibles
    const matchedAIIds = new Set<string>();

    for (const tr of targetRows) {
      const cible = cibleMap.get(tr.targetId);
      if (cible) {
        sheetEval = fillTargetRow(sheetEval, cible, tr.row);
        matchedCount++;
        matchedAIIds.add(tr.targetId);
      } else {
        unmatchedTemplate.push(tr.targetId);
        // Mark as "besoin d'aide" (column I) when AI has no data
        sheetEval = setCellInXml(sheetEval, `I${tr.row}`, 1);
      }
    }

    // Find AI targets that didn't match any template row
    for (const [id] of cibleMap) {
      if (!matchedAIIds.has(id)) {
        unmatchedAI.push(id);
      }
    }

    console.log(`[odd-excel] ✅ Matched: ${matchedCount}/${targetRows.length} template rows`);
    if (unmatchedTemplate.length > 0) {
      console.log(`[odd-excel] ⚠️ Template targets without AI data: ${unmatchedTemplate.join(", ")}`);
    }
    if (unmatchedAI.length > 0) {
      console.log(`[odd-excel] ⚠️ AI targets not in template: ${unmatchedAI.join(", ")}`);
    }
  } else {
    console.warn("[odd-excel] ⚠️ No target rows detected → sequential fallback (row 10+)");
    cibles.forEach((cible, i) => {
      sheetEval = fillTargetRow(sheetEval, cible, 10 + i);
    });
  }

  zip.file(evalFile, sheetEval);

  // ── Indicators sheet ──
  const indSheetFile = await findSheetFile(zip, "INDICATEURS");
  if (indSheetFile) {
    let sheetInd = await zip.file(indSheetFile)?.async("string") ?? "";
    if (sheetInd) {
      indicateurs.forEach((ind, i) => {
        const row = 11 + i;
        if (ind.indicateur_ovo) sheetInd = setCellInXml(sheetInd, `G${row}`, ind.indicateur_ovo);
        if (ind.valeur) sheetInd = setCellInXml(sheetInd, `H${row}`, ind.valeur);
      });
      zip.file(indSheetFile, sheetInd);
      console.log(`[odd-excel] ${indicateurs.length} indicateurs remplis`);
    }
  } else {
    console.warn("[odd-excel] Feuille INDICATEURS non trouvée, ignorée");
  }

  // Remove calcChain.xml to avoid inconsistencies — Excel will recalculate automatically
  zip.remove("xl/calcChain.xml");

  console.log(`[odd-excel] ✅ Template rempli pour "${enterpriseName}" (${matchedCount} cibles matchées)`);
  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
