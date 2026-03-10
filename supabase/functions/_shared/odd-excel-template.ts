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

  // 1. Replace existing cell
  const existingCellRegex = new RegExp(
    `<c\\s+r="${cellRef}"(?:\\s[^>]*)?>(?:(?!</c>).)*</c>`,
    "s"
  );
  if (existingCellRegex.test(sheetXml)) {
    return sheetXml.replace(existingCellRegex, newCell);
  }

  // 2. Insert into existing row
  const rowRegex = new RegExp(`(<row[^>]*\\br="${row}"[^>]*>)(.*?)(</row>)`, "s");
  if (rowRegex.test(sheetXml)) {
    return sheetXml.replace(rowRegex, (_, open, content, close) => {
      return `${open}${content}${newCell}${close}`;
    });
  }

  // 3. Create the row
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
  const cellRegex = new RegExp(`<c[^>]*r="${cellRef}"[^>]*>(.*?)<\/c>`, "s");
  const match = sheetXml.match(cellRegex);
  if (!match) return null;

  const cellContent = match[1];

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

function normalizeTargetId(id: string): string {
  const cleaned = id.replace(/,/g, ".").trim().toLowerCase();
  const match = cleaned.match(/^(\d+)[.,](\d+(?:[a-z])?)/);
  if (match) {
    const minor = parseFloat(match[2]);
    return isNaN(minor)
      ? `${match[1]}.${match[2]}`
      : `${match[1]}.${minor}`;
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

function findTargetRows(
  sheetXml: string,
  sharedStrings: string[],
  startRow = 9,
  endRow = 80
): Array<{ row: number; targetId: string }> {
  const results: Array<{ row: number; targetId: string }> = [];

  for (let row = startRow; row <= endRow; row++) {
    const colB = getCellValue(sheetXml, `B${row}`, sharedStrings);
    const colD = getCellValue(sheetXml, `D${row}`, sharedStrings);

    if (
      colB && /^\d+[.,]\d+/.test(colB.trim()) &&
      colD && colD.toLowerCase().trim() === "x"
    ) {
      results.push({ row, targetId: normalizeTargetId(colB) });
    }
  }

  console.log(`[odd-excel] Found ${results.length} target rows (rows ${startRow}-${endRow})`);
  return results;
}

// ===== FILL TARGET ROW =====

function fillTargetRow(sheetXml: string, cible: Record<string, string>, row: number): string {
  if (cible.info_additionnelle) {
    sheetXml = setCellInXml(sheetXml, `E${row}`, cible.info_additionnelle);
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

  // Preserve ALL VBA-related binaries before any modifications
  const vbaEntries: Array<{ path: string; bytes: Uint8Array }> = [];
  const vbaPromises: Array<Promise<void>> = [];
  zip.forEach((relativePath, file) => {
    if (relativePath.includes("vbaProject") || relativePath.startsWith("xl/vba")) {
      vbaPromises.push(
        file.async("uint8array").then((bytes) => {
          vbaEntries.push({ path: relativePath, bytes });
        })
      );
    }
  });
  await Promise.all(vbaPromises);

  const sharedStrings = await loadSharedStrings(zip);
  console.log(`[odd-excel] ${sharedStrings.length} shared strings chargées`);

  const cibles = (data.evaluation_cibles_odd as Record<string, unknown>)?.cibles as Array<Record<string, string>> ?? [];
  const indicateurs = (data.indicateurs_impact as Record<string, unknown>)?.indicateurs as Array<Record<string, string>> ?? [];

  // ── Main sheet: "Evaluation cibles ODD avec Circ" ──
  const evalSheetFile = await findSheetFile(zip, "Evaluation cibles ODD");
  const fallbackEval = "xl/worksheets/sheet2.xml";
  const evalFile = evalSheetFile || fallbackEval;

  let sheetEval = await zip.file(evalFile)?.async("string") ?? "";
  if (!sheetEval) throw new Error(`Feuille d'évaluation ODD introuvable (${evalFile})`);

  sheetEval = setCellInXml(sheetEval, "E1", enterpriseName);
  if ((data.metadata as Record<string, string>)?.pays) {
    sheetEval = setCellInXml(sheetEval, "E2", (data.metadata as Record<string, string>).pays);
  }

  const targetRows = findTargetRows(sheetEval, sharedStrings, 9, 80);

  let matchedCount = 0;

  if (targetRows.length > 0) {
    for (const cible of cibles) {
      const normalizedId = normalizeTargetId(cible.target_id);
      const targetRow = targetRows.find(tr => tr.targetId === normalizedId);

      if (!targetRow) {
        console.warn(`[odd-excel] Cible ${cible.target_id} → ${normalizedId} non trouvée dans le template`);
        continue;
      }

      sheetEval = fillTargetRow(sheetEval, cible, targetRow.row);
      matchedCount++;
    }
    console.log(`[odd-excel] ${matchedCount}/${cibles.length} cibles matchées`);
  } else {
    console.warn("[odd-excel] Aucune ligne de cible détectée → fallback séquentiel (row 10+)");
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

  // Re-inject ALL VBA binaries with STORE to preserve macro integrity
  for (const entry of vbaEntries) {
    zip.file(entry.path, entry.bytes, { compression: "STORE" });
    console.log(`[odd-excel] VBA preserved: ${entry.path} (${entry.bytes.byteLength} bytes, STORE)`);
  }

  console.log(`[odd-excel] ✅ Template rempli pour "${enterpriseName}"`);
  // No global compression — let per-file STORE settings take effect for VBA
  return await zip.generateAsync({ type: "uint8array" });
}
