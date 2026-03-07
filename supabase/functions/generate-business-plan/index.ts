import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType, LevelFormat, PageBreak, Header, Footer } from "npm:docx@8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

// ── SYSTEM PROMPT ──────────────────────────────────────────────────────
const BP_SYSTEM_PROMPT = `Tu es un consultant senior en business plan avec 20+ ans d'expérience auprès de PME africaines. Tu rédiges des business plans professionnels pour OVO.
Tu génères UNIQUEMENT du JSON structuré. Pas de markdown, pas de texte autour. Rédige en français. Sois précis, factuel, stratégique. JAMAIS de contenu générique.`;

// ── SPLIT SCHEMAS ──────────────────────────────────────────────────────
const SCHEMA_PART1 = `{
  "company_name": "string",
  "tagline": "string — une phrase percutante",
  "founder": "string",
  "location": "string",
  "email": "string",
  "website": "string ou N/A",
  "date_creation": "string",
  "numero_entreprise": "string ou À compléter",
  "compte_bancaire": "string ou À compléter",
  "resume_gestion": "string — 3-4 paragraphes, 400-500 mots",
  "historique": "string — chronologie narrative",
  "vision": "string — 2-3 phrases, horizon 10 ans",
  "mission": "string — 2-3 phrases",
  "valeurs": ["string × 3-5 — format: NOM — explication"],
  "description_generale": "string — localisation, forme juridique, processus, innovation",
  "avenir": "string — projets CT/LT, objectifs SMART",
  "swot": {
    "forces": ["string × 4-6"],
    "faiblesses": ["string × 4-6"],
    "opportunites": ["string × 4-6"],
    "menaces": ["string × 4-6"]
  },
  "gestion_risques": "string — risques + mitigations",
  "modele_produit": "string",
  "modele_clients": "string",
  "modele_revenus_depenses": "string",
  "modele_activites_ressources": "string",
  "marche_potentiel": "string — TAM/SAM/SOM",
  "competitivite": "string",
  "tendances_marche": "string"
}`;

const SCHEMA_PART2 = `{
  "marketing_5p": {
    "produit": "string",
    "place": "string",
    "prix": "string",
    "promotion": "string",
    "personnel": "string"
  },
  "equipe_direction": "string",
  "personnel": "string",
  "organigramme": "string — description textuelle",
  "autres_parties": "string",
  "projet_description": "string",
  "impact_social": "string",
  "impact_environnemental": "string",
  "impact_economique": "string",
  "investissement_plan": "string",
  "financement_plan": "string",
  "financier_tableau": {
    "annee1": { "contrib_locale": "string", "prets_locaux": "string", "prets_etrangers": "string", "subventions": "string", "total": "string", "revenu": "string", "depenses": "string", "marge_brute": "string", "benefice_net": "string", "seuil_rentabilite": "string", "tresorerie_finale": "string" },
    "annee2": { "...same..." },
    "annee3": { "...same..." }
  },
  "ovo_financier": "string",
  "ovo_expertise": "string",
  "score": 0-100
}`;

// ── BUILD USER PROMPTS ─────────────────────────────────────────────────
function buildContextBlock(ctx: any): string {
  const ent = ctx.enterprise;
  const dm = ctx.deliverableMap;
  const bmc = dm["bmc_analysis"] || {};
  const inp = dm["inputs_data"] || {};
  const fw = dm["framework_data"] || {};
  const sic = dm["sic_analysis"] || {};
  const diag = dm["diagnostic_data"] || {};
  const plan = dm["plan_ovo"] || {};

  return `ENTREPRISE :
- Nom : ${ent.name || "N/A"}
- Pays : ${ent.country || "Côte d'Ivoire"}
- Secteur : ${ent.sector || "N/A"}
- Description : ${ent.description || "N/A"}
- Employés : ${ent.employees_count || "N/A"}
- Forme juridique : ${ent.legal_form || "N/A"}
- Date création : ${ent.creation_date || "N/A"}

BMC : ${JSON.stringify(bmc).substring(0, 1000)}

FINANCIER : ${JSON.stringify(inp).substring(0, 800)}

FRAMEWORK : ${JSON.stringify(fw).substring(0, 800)}

SIC : ${JSON.stringify(sic).substring(0, 500)}

DIAGNOSTIC : ${JSON.stringify(diag).substring(0, 500)}

PLAN OVO : ${plan ? JSON.stringify(plan).substring(0, 800) : "Non disponible"}

${ctx.documentContent ? `DOCUMENTS:\n${ctx.documentContent.substring(0, 2000)}` : ""}`;
}

function buildPromptPart1(ctx: any): string {
  return `Génère les sections 1-8 du business plan OVO (présentation + opérations) pour cette entreprise.

${buildContextBlock(ctx)}

CONTRAINTES : Chaque section doit être substantielle. Utilise des chiffres précis (FCFA, %). RETOURNE UNIQUEMENT LE JSON.

${SCHEMA_PART1}`;
}

function buildPromptPart2(ctx: any, part1Summary: string): string {
  return `Génère les sections 9-14 du business plan OVO (marketing, équipe, projet, impact, financier, attentes OVO).

${buildContextBlock(ctx)}

SECTIONS DÉJÀ GÉNÉRÉES (résumé) : ${part1Summary}

CONTRAINTES : Cohérence avec les sections précédentes. Chiffres financiers précis en FCFA. RETOURNE UNIQUEMENT LE JSON.

${SCHEMA_PART2}`;
}

// ── WORD GENERATION ────────────────────────────────────────────────────
const BLUE = "365F91";
const GRAY_HEADER = "BFBFBF";
const GRAY_GUIDE = "808080";
const CONTENT_WIDTH = 9026;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: "Calibri", size: 32, color: BLUE, bold: true })],
    spacing: { before: 400, after: 200 },
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: "Calibri", size: 26, color: BLUE, bold: true })],
    spacing: { before: 300, after: 150 },
  });
}

function para(text: string, opts: any = {}) {
  if (!text) return new Paragraph({ children: [new TextRun("")] });
  return new Paragraph({
    children: [new TextRun({ text: String(text), font: "Calibri", size: 22, ...opts })],
    spacing: { after: 120 },
  });
}

function italic(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: String(text || ""), font: "Calibri", size: 22, italics: true })],
    spacing: { after: 120 },
  });
}

/** Guide text from the template — italic + gray, before AI content */
function guideText(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: String(text), font: "Calibri", size: 20, italics: true, color: GRAY_GUIDE })],
    spacing: { after: 80 },
  });
}

function bulletItem(text: string) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text: String(text || ""), font: "Calibri", size: 22 })],
    spacing: { after: 80 },
  });
}

function spacer() {
  return new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } });
}

function multiPara(text: string): Paragraph[] {
  if (!text) return [spacer()];
  return String(text).split("\n").filter(l => l.trim()).map(line => {
    if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
      return bulletItem(line.replace(/^[•\-]\s*/, ""));
    }
    return para(line);
  });
}

// ── TABLE: Company Info ───────────────────────────────────────────────
function tableInfos(bp: any): Table {
  const rowsData = [
    ["Nom", bp.company_name || ""],
    ["Site web", bp.website || "N/A"],
    ["Personne en contact", bp.founder || ""],
    ["Courrier électronique", bp.email || ""],
    ["Téléphone", "À compléter"],
    ["Date de création", bp.date_creation || ""],
    ["Numéro d'entreprise", bp.numero_entreprise || "À compléter"],
    ["Compte bancaire", bp.compte_bancaire || "À compléter"],
  ];

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3000, 6026],
    rows: rowsData.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            borders, width: { size: 3000, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: label, font: "Calibri", size: 22, bold: true })] })],
          }),
          new TableCell({
            borders, width: { size: 6026, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: String(value), font: "Calibri", size: 22 })] })],
          }),
        ],
      })
    ),
  });
}

// ── TABLE: SWOT ───────────────────────────────────────────────────────
function tableSWOT(bp: any): Table {
  const swot = bp.swot || {};

  function swotCell(title: string, items: string[]): TableCell {
    return new TableCell({
      borders, width: { size: 4513, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [
        new Paragraph({ children: [new TextRun({ text: title, font: "Calibri", size: 22, bold: true })], spacing: { after: 100 } }),
        ...(items || []).map((item: string) =>
          new Paragraph({ children: [new TextRun({ text: `- ${item}`, font: "Calibri", size: 20 })], spacing: { after: 60 } })
        ),
      ],
    });
  }

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [4513, 4513],
    rows: [
      new TableRow({ children: [swotCell("Points forts (internes)", swot.forces || []), swotCell("Faiblesses (internes)", swot.faiblesses || [])] }),
      new TableRow({ children: [swotCell("Opportunités (externe)", swot.opportunites || []), swotCell("Menaces (externes)", swot.menaces || [])] }),
    ],
  });
}

// ── TABLE: Financial ──────────────────────────────────────────────────
function tableFinancier(bp: any): Table {
  const t = bp.financier_tableau || {};
  const a1 = t.annee1 || {};
  const a2 = t.annee2 || {};
  const a3 = t.annee3 || {};

  const rowsData = [
    { label: "Plan financier", bold: true, header: true, a1: "1ère année", a2: "2ème année", a3: "3ème année" },
    { label: "Contribution des entreprises locales", a1: a1.contrib_locale, a2: a2.contrib_locale, a3: a3.contrib_locale },
    { label: "Prêts bancaires locaux, taux d'intérêt", a1: a1.prets_locaux, a2: a2.prets_locaux, a3: a3.prets_locaux },
    { label: "Prêts de l'étranger, taux d'intérêt", a1: a1.prets_etrangers, a2: a2.prets_etrangers, a3: a3.prets_etrangers },
    { label: "Subventions", a1: a1.subventions || "0", a2: a2.subventions || "0", a3: a3.subventions || "0" },
    { label: "Total", bold: true, a1: a1.total, a2: a2.total, a3: a3.total },
    { label: "Revenu", a1: a1.revenu, a2: a2.revenu, a3: a3.revenu },
    { label: "Dépenses", a1: a1.depenses, a2: a2.depenses, a3: a3.depenses },
    { label: "Marge brute", a1: a1.marge_brute, a2: a2.marge_brute, a3: a3.marge_brute },
    { label: "Bénéfice net", bold: true, a1: a1.benefice_net, a2: a2.benefice_net, a3: a3.benefice_net },
    { label: "Chiffre d'affaires au seuil de rentabilité", bold: true, a1: a1.seuil_rentabilite, a2: a2.seuil_rentabilite, a3: a3.seuil_rentabilite },
    { label: "Bilan final de la trésorerie", bold: true, a1: a1.tresorerie_finale, a2: a2.tresorerie_finale, a3: a3.tresorerie_finale },
  ];

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [3500, 1842, 1842, 1842],
    rows: rowsData.map((row: any, i: number) =>
      new TableRow({
        children: [row.label, row.a1, row.a2, row.a3].map((text: string, ci: number) =>
          new TableCell({
            borders,
            width: { size: ci === 0 ? 3500 : 1842, type: WidthType.DXA },
            shading: (i === 0 || row.bold) ? { fill: GRAY_HEADER, type: ShadingType.CLEAR } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: String(text || ""), font: "Calibri", size: 20, bold: !!(row.bold || i === 0) })] })],
          })
        ),
      })
    ),
  });
}

// ── SOMMAIRE (Table of Contents) ──────────────────────────────────────
function buildSommaire(): Paragraph[] {
  const tocEntry = (text: string, level = 0) => new Paragraph({
    children: [new TextRun({ text, font: "Calibri", size: level === 0 ? 24 : 22, bold: level === 0 })],
    spacing: { after: level === 0 ? 120 : 80 },
    indent: level > 0 ? { left: 360 } : undefined,
  });

  return [
    new Paragraph({
      children: [new TextRun({ text: "SOMMAIRE", font: "Calibri", size: 32, bold: true, color: BLUE })],
      spacing: { before: 200, after: 300 },
      alignment: AlignmentType.CENTER,
    }),
    tocEntry("INTRODUCTION"),
    spacer(),
    tocEntry("PARTIE I : PRÉSENTATION DE L'ENTREPRISE"),
    tocEntry("1. Informations sur l'entreprise", 1),
    tocEntry("2. Résumé de la gestion", 1),
    tocEntry("3. Revue historique", 1),
    tocEntry("4. Vision, mission et valeurs", 1),
    tocEntry("5. L'entreprise", 1),
    tocEntry("6. Analyse SWOT & gestion des risques", 1),
    spacer(),
    tocEntry("PARTIE II : OPÉRATIONS COMMERCIALES"),
    tocEntry("7. Modèle de l'entreprise", 1),
    tocEntry("8. Marché, concurrence et environnement", 1),
    tocEntry("9. Stratégie de vente et de marketing : Les 5P", 1),
    tocEntry("10. Équipe et organisation", 1),
    spacer(),
    tocEntry("PARTIE III : VOTRE PROJET"),
    tocEntry("11. Description générale", 1),
    tocEntry("12. Impact", 1),
    tocEntry("13. Financier", 1),
    tocEntry("14. Attentes vis-à-vis d'OVO ?", 1),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── COVER PAGE ────────────────────────────────────────────────────────
function buildCoverPage(bp: any): Paragraph[] {
  return [
    spacer(), spacer(), spacer(),
    new Paragraph({
      children: [new TextRun({ text: "entrepreneurs for entrepreneurs", font: "Calibri", size: 28, italics: true, color: BLUE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Sustainable cooperation with Africa", font: "Calibri", size: 22, italics: true, color: GRAY_GUIDE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    spacer(), spacer(),
    new Paragraph({
      children: [new TextRun({ text: "Business Plan", font: "Calibri", size: 48, bold: true, color: BLUE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Guide de construction", font: "Calibri", size: 32, color: BLUE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    spacer(),
    new Paragraph({
      children: [new TextRun({ text: bp.company_name || "", font: "Calibri", size: 36, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: bp.tagline || "", font: "Calibri", size: 24, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    spacer(),
    para(`Fondateur / Contact : ${bp.founder || ""}`, { size: 22 }),
    para(`Localisation : ${bp.location || ""}`, { size: 22 }),
    para(`Email : ${bp.email || ""}`, { size: 22 }),
    para(`Site web : ${bp.website || "N/A"}`, { size: 22 }),
    spacer(), spacer(), spacer(),
    new Paragraph({
      children: [new TextRun({ text: "Business Plan Guide 2025", font: "Calibri", size: 20, italics: true, color: GRAY_GUIDE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ── INTRODUCTION ──────────────────────────────────────────────────────
function buildIntroduction(bp: any): Paragraph[] {
  return [
    h1("INTRODUCTION"),
    para("Ce document présente le Business Plan dans le cadre du programme OVO. Il est structuré en trois parties :"),
    spacer(),
    para("La PARTIE I présente l'entreprise : son histoire, sa vision, sa mission, ses valeurs, son analyse SWOT et sa gestion des risques. Cette section permet au lecteur de comprendre le contexte et les fondamentaux de l'entreprise."),
    spacer(),
    para("La PARTIE II décrit les opérations commerciales : le modèle d'entreprise, le marché et la concurrence, la stratégie marketing (les 5P) et l'organisation de l'équipe. Cette section détaille comment l'entreprise fonctionne au quotidien."),
    spacer(),
    para("La PARTIE III présente le projet spécifique pour lequel un investissement est recherché : sa description, son impact (social, environnemental, économique), le plan financier et les attentes vis-à-vis d'OVO."),
    spacer(),
    para("Ce business plan est un document important pour tout investisseur potentiel. Il doit être clair, complet et convaincant. Chaque section contient des questions directrices en italique pour guider la rédaction.", { italics: true }),
    spacer(),
    para("Note : Vous êtes libre d'utiliser un autre modèle de business plan si celui-ci ne correspond pas à vos besoins. L'important est que toutes les informations requises soient couvertes.", { italics: true, color: GRAY_GUIDE }),
    spacer(),
  ];
}

// ── MAIN DOCUMENT BUILDER ─────────────────────────────────────────────
async function generateWordDoc(bp: any): Promise<Uint8Array> {
  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, font: "Calibri", color: BLUE, bold: true },
          paragraph: { spacing: { before: 400, after: 200 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, font: "Calibri", color: BLUE, bold: true },
          paragraph: { spacing: { before: 300, after: 150 } } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new [
            new Paragraph({
              children: [
                new TextRun({ text: "entrepreneurs for entrepreneurs", font: "Calibri", size: 16, italics: true, color: BLUE }),
                new TextRun({ text: "    |    ", font: "Calibri", size: 16, color: GRAY_GUIDE }),
                new TextRun({ text: "Sustainable cooperation with Africa", font: "Calibri", size: 16, italics: true, color: GRAY_GUIDE }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new (await import("npm:docx@8")).[
            new Paragraph({
              children: [new TextRun({ text: "Business Plan Guide 2025", font: "Calibri", size: 16, italics: true, color: GRAY_GUIDE })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        // ── COVER PAGE ──
        ...buildCoverPage(bp),

        // ── SOMMAIRE ──
        ...buildSommaire(),

        // ── INTRODUCTION ──
        ...buildIntroduction(bp),

        // ══════════════════════════════════════════════════════════════
        // PARTIE I : PRÉSENTATION DE L'ENTREPRISE
        // ══════════════════════════════════════════════════════════════
        h1("PARTIE I : PRÉSENTATION DE L'ENTREPRISE"),
        para("Ce chapitre donne au lecteur un premier aperçu de votre entreprise."),
        spacer(),

        // Section 1
        h2("1. Informations sur l'entreprise :"),
        guideText("Remplissez les informations de base de votre entreprise dans le tableau ci-dessous."),
        tableInfos(bp),
        spacer(),

        // Section 2
        h2("2. Résumé de la gestion :"),
        guideText("Donnez un résumé de votre entreprise : que fait-elle, quels sont ses produits/services principaux, quels sont ses objectifs à court et moyen terme ?"),
        ...multiPara(bp.resume_gestion),
        spacer(),

        // Section 3
        h2("3. Revue historique :"),
        guideText("Quand l'entreprise a-t-elle démarré ? Quelles sont les étapes clés de son développement ? Quels ont été les moments charnières ?"),
        ...multiPara(bp.historique),
        spacer(),

        // Section 4
        h2("4. Vision, mission et valeurs :"),
        italic("A : Vision :"),
        guideText("Quelle est votre vision à long terme (10 ans) ? Quel impact souhaitez-vous avoir sur votre secteur et votre communauté ?"),
        ...multiPara(bp.vision),
        spacer(),
        italic("B : La mission :"),
        guideText("Quelle est la raison d'être de votre entreprise ? Comment contribuez-vous à réaliser votre vision au quotidien ?"),
        ...multiPara(bp.mission),
        spacer(),
        italic("C : Valeurs :"),
        guideText("Quelles sont les 3 à 5 valeurs fondamentales qui guident votre entreprise et vos décisions ?"),
        ...(bp.valeurs || []).map((v: string) => bulletItem(v)),
        spacer(),

        // Section 5
        h2("5. L'entreprise :"),
        italic("A : Description générale :"),
        guideText("Décrivez votre entreprise : localisation, forme juridique, processus de production/prestation, éléments innovants, avantages compétitifs."),
        ...multiPara(bp.description_generale),
        spacer(),
        italic("B : L'avenir :"),
        guideText("Quels sont vos projets à court terme et à long terme ? Avez-vous des objectifs SMART définis ?"),
        ...multiPara(bp.avenir),
        spacer(),

        // Section 6
        h2("6. Analyse SWOT & gestion des risques :"),
        guideText("Identifiez les forces et faiblesses internes, ainsi que les opportunités et menaces externes de votre entreprise."),
        tableSWOT(bp),
        spacer(),
        italic("Gestion des risques :"),
        guideText("Quels sont les principaux risques auxquels votre entreprise est confrontée ? Quelles mesures de mitigation avez-vous mises en place ?"),
        ...multiPara(bp.gestion_risques),
        spacer(),

        // ══════════════════════════════════════════════════════════════
        // PARTIE II : OPÉRATIONS COMMERCIALES
        // ══════════════════════════════════════════════════════════════
        h1("PARTIE II : OPÉRATIONS COMMERCIALES"),
        para("Ce chapitre fournit des informations approfondies sur tous les aspects de votre entreprise."),
        spacer(),

        // Section 7
        h2("7. Modèle de l'entreprise :"),
        italic("A : Produit/service et proposition de valeur unique :"),
        guideText("Quel est votre produit ou service ? Qu'est-ce qui le rend unique ? Quelle est votre proposition de valeur ?"),
        ...multiPara(bp.modele_produit),
        spacer(),
        italic("B : Clients, canaux d'accès et relations :"),
        guideText("Qui sont vos clients cibles ? Comment les atteignez-vous ? Quelle relation entretenez-vous avec eux ?"),
        ...multiPara(bp.modele_clients),
        spacer(),
        italic("C : Revenus et dépenses :"),
        guideText("Quelles sont vos sources de revenus ? Quelles sont vos principales dépenses ? Quel est votre modèle de tarification ?"),
        ...multiPara(bp.modele_revenus_depenses),
        spacer(),
        italic("D : Principales activités, ressources et partenaires :"),
        guideText("Quelles sont les activités clés de votre entreprise ? De quelles ressources avez-vous besoin ? Qui sont vos partenaires stratégiques ?"),
        ...multiPara(bp.modele_activites_ressources),
        spacer(),

        // Section 8
        h2("8. Marché, concurrence et environnement :"),
        italic("A : Marché et potentiel de marché :"),
        guideText("Quelle est la taille de votre marché (TAM/SAM/SOM) ? Quel est le potentiel de croissance ?"),
        ...multiPara(bp.marche_potentiel),
        spacer(),
        italic("B : Compétitivité :"),
        guideText("Qui sont vos concurrents ? Quels sont vos avantages compétitifs ? Comment vous positionnez-vous ?"),
        ...multiPara(bp.competitivite),
        spacer(),
        italic("C : Analyses et tendances du marché :"),
        guideText("Quelles sont les tendances de votre secteur ? Comment évoluent les besoins des clients ?"),
        ...multiPara(bp.tendances_marche),
        spacer(),

        // Section 9
        h2("9. Stratégie de vente et de marketing : Les 5P"),
        guideText("Décrivez votre stratégie marketing selon les 5P : Produit, Place, Prix, Promotion et Personnel."),
        ...["produit", "place", "prix", "promotion", "personnel"].flatMap((key, i) => [
          italic(["A : Produit (ou service) :", "B : Point(s) de vente :", "C : Prix :", "D : Promotion :", "E : Personnel :"][i]),
          ...multiPara(bp.marketing_5p?.[key]),
          spacer(),
        ]),

        // Section 10
        h2("10. Équipe et organisation :"),
        italic("A : L'équipe de direction :"),
        guideText("Qui compose l'équipe de direction ? Quelles sont leurs compétences et expériences clés ?"),
        ...multiPara(bp.equipe_direction),
        spacer(),
        italic("B : Le personnel :"),
        guideText("Combien d'employés avez-vous ? Quels sont les postes clés ? Avez-vous des besoins en recrutement ?"),
        ...multiPara(bp.personnel),
        spacer(),
        italic("C : Organigramme :"),
        guideText("Décrivez la structure organisationnelle de votre entreprise."),
        ...multiPara(bp.organigramme),
        spacer(),
        italic("D : Autres parties prenantes :"),
        guideText("Qui sont vos autres parties prenantes (investisseurs, mentors, conseillers, partenaires) ?"),
        ...multiPara(bp.autres_parties),
        spacer(),

        // ══════════════════════════════════════════════════════════════
        // PARTIE III : VOTRE PROJET
        // ══════════════════════════════════════════════════════════════
        h1("PARTIE III : VOTRE PROJET"),
        para("Ce chapitre fournit des informations sur le projet pour lequel vous avez besoin d'un investissement externe."),
        spacer(),

        // Section 11
        h2("11. Description générale :"),
        guideText("Décrivez le projet pour lequel vous cherchez un financement. Quels sont les objectifs ? Quel est le calendrier de mise en œuvre ?"),
        ...multiPara(bp.projet_description),
        spacer(),

        // Section 12 — Impact restructuré
        h2("12. Impact :"),
        guideText("Le projet doit au moins avoir un impact positif sur l'un des domaines mentionnés ci-dessous."),
        spacer(),
        italic("A : Impact social :"),
        guideText("Quel est l'impact de votre projet sur la communauté ? Combien d'emplois seront créés ? Quels groupes vulnérables en bénéficieront ?"),
        ...multiPara(bp.impact_social),
        spacer(),
        italic("B : Impact environnemental :"),
        guideText("Quel est l'impact environnemental de votre projet ? Utilisez-vous des pratiques durables ? Réduisez-vous les émissions de CO2 ?"),
        ...multiPara(bp.impact_environnemental),
        spacer(),
        italic("C : Impact économique :"),
        guideText("Quel est l'impact économique de votre projet sur la région ? Contribuez-vous au développement de la chaîne de valeur locale ?"),
        ...multiPara(bp.impact_economique),
        spacer(),

        // Section 13
        h2("13. Financier :"),
        italic("A : Plan d'investissement :"),
        guideText("Quel est le montant total de l'investissement nécessaire ? Comment sera-t-il réparti ?"),
        ...multiPara(bp.investissement_plan),
        spacer(),
        italic("B : Plan financier :"),
        guideText("Présentez votre plan financier sur 3 ans. Les chiffres doivent être cohérents avec le plan financier détaillé OVO."),
        ...multiPara(bp.financement_plan),
        spacer(),
        tableFinancier(bp),
        spacer(),
        para("Les chiffres ci-dessus sont tirés du plan financier détaillé OVO. Veuillez vous référer au fichier Excel pour les détails complets.", { italics: true, color: GRAY_GUIDE }),
        spacer(),

        // Section 14
        h2("14. Attentes vis-à-vis d'OVO ?"),
        italic("A : Financier :"),
        guideText("Quel montant de financement attendez-vous d'OVO ? Sous quelle forme (prêt, subvention, prise de participation) ?"),
        ...multiPara(bp.ovo_financier),
        spacer(),
        italic("B : Expertise :"),
        guideText("Quel type d'accompagnement ou d'expertise attendez-vous d'OVO en plus du financement ?"),
        ...multiPara(bp.ovo_expertise),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ── STRIP CUSTOM XML ──────────────────────────────────────────────────
async function stripCustomXml(docxBuffer: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docxBuffer);

  // Remove all customXml entries
  const toRemove = Object.keys(zip.files).filter(f => f.startsWith("customXml/"));
  toRemove.forEach(f => zip.remove(f));

  // Patch [Content_Types].xml — remove Override entries for customXml
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ct = await ctFile.async("string");
    ct = ct.replace(/<Override[^>]*PartName="\/customXml\/[^"]*"[^>]*\/>/g, "");
    zip.file("[Content_Types].xml", ct);
  }

  // Patch word/_rels/document.xml.rels — remove Relationship entries for customXml
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (relsFile) {
    let rels = await relsFile.async("string");
    rels = rels.replace(/<Relationship[^>]*Target="[^"]*customXml[^"]*"[^>]*\/>/g, "");
    zip.file("word/_rels/document.xml.rels", rels);
  }

  const cleaned = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return cleaned;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    console.log("[BP] Generating Business Plan for:", ent.name);

    // PART 1: Sections 1-8
    console.log("[BP] AI Call 1/2: Sections 1-8...");
    const part1 = await callAI(BP_SYSTEM_PROMPT, buildPromptPart1(ctx));
    console.log("[BP] Part 1 OK, keys:", Object.keys(part1).length);

    // Build summary of part1 for context in part2
    const part1Summary = `Entreprise: ${part1.company_name}, SWOT: ${(part1.swot?.forces || []).length} forces, Marché: ${(part1.marche_potentiel || "").substring(0, 100)}`;

    // PART 2: Sections 9-14
    console.log("[BP] AI Call 2/2: Sections 9-14...");
    const part2 = await callAI(BP_SYSTEM_PROMPT, buildPromptPart2(ctx, part1Summary));
    console.log("[BP] Part 2 OK, keys:", Object.keys(part2).length);

    // Merge
    const bpJson = { ...part1, ...part2 };
    bpJson.score = bpJson.score || part1.score || 50;
    bpJson.company_name = bpJson.company_name || ent.name;

    console.log("[BP] Merged, generating Word document...");

    // Generate Word document
    const rawDocxBytes = await generateWordDoc(bpJson);
    console.log("[BP] Word document generated:", rawDocxBytes.length, "bytes");

    // Strip Custom XML Parts to avoid Word warning
    const docxBytes = await stripCustomXml(rawDocxBytes);
    console.log("[BP] Custom XML stripped:", docxBytes.length, "bytes");

    // Upload to storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `BusinessPlan_${ent.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.docx`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("bp-outputs")
      .upload(fileName, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        cacheControl: "no-store",
      });

    if (uploadError) {
      console.error("[BP] Upload error:", uploadError);
      throw new Error("Erreur d'upload du fichier Word: " + uploadError.message);
    }

    const { data: signedData } = await supabaseAdmin.storage
      .from("bp-outputs")
      .createSignedUrl(fileName, 7200);

    const downloadUrl = signedData?.signedUrl || "";

    const deliverableData = {
      ...bpJson,
      _meta: {
        file_name: fileName,
        download_url: downloadUrl,
        generated_at: new Date().toISOString(),
      },
    };

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "business_plan", deliverableData, "business_plan");

    console.log("[BP] SUCCESS:", fileName);

    return jsonResponse({
      success: true,
      data: bpJson,
      score: bpJson.score,
      fileName,
      downloadUrl,
    });
  } catch (e: any) {
    console.error("[BP] ERROR:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
