import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/helpers.ts";

const SEED_DATA = [
  // ═══════ BENCHMARKS SECTORIELS DÉTAILLÉS ═══════
  {
    category: "benchmarks",
    title: "Agriculture — Côte d'Ivoire",
    content: `Cacao: marge brute 30-40%, rendement moyen 400-600 kg/ha, prix bord champ 1000-1500 FCFA/kg.
Hévéa: marge brute 25-35%, cycle 7 ans avant production, prix FOB 600-900 FCFA/kg.
Anacarde: marge brute 20-35%, campagne mars-juin, prix bord champ 300-500 FCFA/kg.
Riz: marge brute 15-25%, rendement paddy 2-4 t/ha, coût production 100-150 FCFA/kg.
Maraîchage: marge brute 40-60%, cycle court (2-4 mois), BFR élevé (avance semences+intrants).
PME agricole typique CI: CA 50-300M FCFA, effectif 10-50 personnes, saisonnalité forte (±40% CA).
Financement: taux bancaire 10-14%, microfinance 18-24%, campagne 6-9 mois.`,
    country: "Côte d'Ivoire",
    sector: "Agriculture",
    source: "FIRCA, ANADER, CCC, rapports campagnes 2023-2024",
    tags: ["agriculture", "cacao", "hevea", "anacarde"]
  },
  {
    category: "benchmarks",
    title: "Agriculture — Sénégal",
    content: `Arachide: marge brute 20-30%, campagne juin-novembre, prix producteur 250-350 FCFA/kg.
Riz: marge brute 15-25%, Valley du Fleuve Sénégal, rendement 4-6 t/ha irrigué.
Maraîchage Niayes: marge brute 40-55%, export possible vers Europe (normes GlobalGAP).
Aviculture: marge brute 35-50%, coût aliment 65-70% du coût total, cycle 45 jours (poulet chair).
Pêche/Aquaculture: marge brute 25-40%, saison mars-juin pour crevettes, contraintes frigorifiques.
PME agricole typique SN: CA 30-200M FCFA, forte dépendance pluviométrie.`,
    country: "Sénégal",
    sector: "Agriculture",
    source: "ISRA, SAED, ANSD rapports 2023",
    tags: ["agriculture", "arachide", "aviculture"]
  },
  {
    category: "benchmarks",
    title: "Tech / Digital — Afrique de l'Ouest",
    content: `SaaS B2B: marge brute 70-85%, MRR growth 10-20%/mois en early stage, churn cible <5%/mois.
Fintech/Mobile Money: marge brute 50-70%, volume transactionnel clé, réglementation BCEAO stricte.
E-commerce: marge brute 15-30%, logistique = 15-25% du CA, panier moyen 15000-50000 FCFA.
Services IT/Consulting: marge brute 50-65%, facturation journalière 150000-500000 FCFA selon séniorité.
EdTech: marge brute 60-80%, ticket 5000-50000 FCFA/mois, LTV/CAC cible > 3.
AgriTech: marge brute 40-60%, adoption lente (alphabétisation digitale), scale via USSD/WhatsApp.
Startups tech UEMOA: valorisation pré-seed 50-200M FCFA, seed 200M-1B FCFA, Série A > 2B FCFA.
Burn rate médian: 5-15M FCFA/mois. Runway minimum attendu par investisseurs: 12-18 mois.`,
    country: null,
    sector: "Tech / Digital",
    source: "Partech Africa Report 2024, Briter Bridges, GSMA",
    tags: ["tech", "saas", "fintech", "ecommerce"]
  },
  {
    category: "benchmarks",
    title: "Commerce / Distribution — UEMOA",
    content: `Grande distribution: marge brute 12-18%, rotation stocks 8-12x/an, BFR 30-60 jours.
Commerce de détail: marge brute 15-25%, marge nette 3-8%, très sensible au fonds de roulement.
Import-export: marge brute 10-20%, risque de change USD/XOF, délais douane 5-15 jours.
Distribution FMCG: marge brute 15-22%, commission distributeur 8-15%, stockage = 5-8% CA.
Grossistes: marge brute 8-15%, volume élevé, capital immobilisé important (stocks + créances).
Ratios d'alerte: créances clients > 90 jours = risque, stock mort > 10% = alerte, marge < 10% = danger.`,
    country: null,
    sector: "Commerce / Distribution",
    source: "CEPICI, CCI Abidjan, rapport distribution UEMOA 2023",
    tags: ["commerce", "distribution", "import-export"]
  },
  {
    category: "benchmarks",
    title: "BTP / Construction — Afrique de l'Ouest",
    content: `Gros œuvre: marge brute 18-28%, marge nette 5-10%, appels d'offres publics = 60-80% du marché.
Second œuvre/finitions: marge brute 25-35%, clients privés davantage que publics.
Promotion immobilière: marge brute 30-45%, cycle long 18-36 mois, BFR très élevé.
Routes/VRD: marge brute 15-22%, dépendance marchés publics, délais de paiement État 90-180 jours.
PME BTP typique: CA 100-500M FCFA, effectif 20-100, parc matériel = 30-50% du bilan.
Risques principaux: retards de paiement État (6-12 mois fréquent), coût ciment/fer importé, saison des pluies.
Financement: avance démarrage chantier 20-30%, retenue de garantie 5-10%, caution bancaire.`,
    country: null,
    sector: "BTP / Construction",
    source: "CGECI, Union des BTP CI, Banque Mondiale Doing Business",
    tags: ["btp", "construction", "immobilier"]
  },
  {
    category: "benchmarks",
    title: "Santé / Pharma — Afrique de l'Ouest",
    content: `Pharmacie officine: marge brute 25-33% (réglementé), CA moyen 80-200M FCFA, stock = 40-60% CA.
Clinique/polyclinique: marge brute 40-55%, charges personnel = 35-45% CA, équipement lourd.
Laboratoire d'analyses: marge brute 50-65%, investissement initial élevé, amortissement 5-10 ans.
Distribution pharmaceutique: marge brute 10-18%, réglementation stricte, chaîne du froid obligatoire.
Fabrication locale: marge brute 35-50%, normes BPF obligatoires, marché dominé par génériques.
Taille marché pharma UEMOA: ~2500 milliards FCFA, croissance 8-12%/an, 90% importé.`,
    country: null,
    sector: "Santé / Pharma",
    source: "OMS Afrique, OAPI, rapports sectoriels 2023",
    tags: ["sante", "pharma", "clinique"]
  },
  {
    category: "benchmarks",
    title: "Énergie / Environnement — Afrique",
    content: `Solaire off-grid (kits): marge brute 35-50%, PAYGO = 70% du marché, churn 15-25%.
Mini-grids solaires: marge brute 50-65%, CAPEX 500M-2B FCFA, payback 5-8 ans, tarif 150-300 FCFA/kWh.
Recyclage/valorisation déchets: marge brute 30-45%, opex collecte = 40-50% CA, contrats municipaux clés.
Biomasse/bioénergie: marge brute 40-55%, approvisionnement régulier critique, cycle production 3-6 mois.
Eau/assainissement: marge brute 35-50%, contrats publics, maintenance = 15-20% CA.
Taux d'électrification UEMOA: 40-65% selon pays, rural < 25%. Gap = opportunité massive.`,
    country: null,
    sector: "Énergie / Environnement",
    source: "IRENA, SE4ALL, Lighting Africa, IEA Africa 2024",
    tags: ["energie", "solaire", "recyclage", "environnement"]
  },
  {
    category: "benchmarks",
    title: "Transport / Logistique — Afrique de l'Ouest",
    content: `Transport routier marchandises: marge brute 20-30%, carburant = 35-45% CA, amortissement véhicules 5-7 ans.
Transport urbain (minibus/taxi): marge brute 25-35%, régulation informelle, renouvellement flotte critique.
Logistique/entreposage: marge brute 30-40%, m² stockage 3000-8000 FCFA/mois selon ville.
Coursiers/last-mile delivery: marge brute 25-35%, coût acquisition client élevé, volume = clé.
Transit/déclaration douane: marge brute 40-55%, services, personnel qualifié, réseau institutionnel.
Coût logistique Afrique: 50-75% plus élevé que moyenne mondiale, corridor Abidjan-Ouaga = référence.`,
    country: null,
    sector: "Transport / Logistique",
    source: "PMAWCA, UEMOA Commission, Banque Mondiale corridor studies",
    tags: ["transport", "logistique", "livraison"]
  },
  {
    category: "benchmarks",
    title: "Éducation / Formation — Afrique de l'Ouest",
    content: `École privée K-12: marge brute 35-50%, scolarité 200K-2M FCFA/an selon standing, cash cycle saisonnier (sept-juin).
Formation professionnelle: marge brute 40-55%, ticket 50K-500K FCFA/formation, B2B plus rentable que B2C.
Université privée: marge brute 30-45%, frais 500K-3M FCFA/an, accréditation = barrière à l'entrée.
EdTech: marge brute 60-80%, marché naissant, adoption via mobile, freemium dominant.
Centre de langues: marge brute 50-60%, enseignants = 50-60% des charges, clients corporate = meilleur panier.
Marché éducation UEMOA: croissance 10-15%/an, démographie favorable (60% population < 25 ans).`,
    country: null,
    sector: "Éducation / Formation",
    source: "UNESCO UIS, rapports PASEC, études marché 2023-2024",
    tags: ["education", "formation", "edtech"]
  },

  // ═══════ CONDITIONS BANCAIRES LOCALES ═══════
  {
    category: "fiscal",
    title: "Conditions bancaires PME — Côte d'Ivoire 2024-2025",
    content: `SGBCI: PME = CA 100M-5B FCFA. Crédit MT: 8-12%, durée 2-5 ans, garantie 100-120% (hypothèque/nantissement). Découvert: plafond 30% CA, taux 10-13%.
Ecobank CI: Crédit PME: 9-13%, durée 1-5 ans, apport personnel 20-30%. Affacturage disponible.
BOA CI: Prêt investissement: 9-11%, 3-7 ans, garantie ARIZ (AFD) possible = réduit garantie réelle à 50%.
SIB: Crédit-bail (leasing): 10-14%, durée alignée sur amortissement fiscal, pas de garantie immobilière nécessaire.
BIAO CI: Ligne de crédit PME: 10-13%, revolving, nantissement stock ou créances.
Microfinance (ADVANS, COFINA, Baobab): Taux 18-24%, ticket 500K-50M FCFA, durée 6-24 mois, moins de garanties.
Garantie ARIZ (AFD/Proparco): couvre 50% du prêt bancaire, coût 1.5-2%/an, éligible via banques partenaires.
Fonds de garantie FGPME (État CI): couvre 60% du prêt, plafond 150M FCFA, conditions variables.`,
    country: "Côte d'Ivoire",
    sector: null,
    source: "Conditions générales banques CI 2024, APBEF-CI, rapports BCEAO",
    tags: ["banque", "credit", "financement", "garantie"]
  },
  {
    category: "fiscal",
    title: "Conditions bancaires PME — Sénégal 2024-2025",
    content: `CBAO (Attijariwafa): Crédit PME 9-12%, durée 2-5 ans, exige bilan certifié 2 ans.
BHS: Prêt investissement 8-11%, spécialisé habitat mais finance PME BTP/immobilier.
Ecobank SN: Crédit MT 10-13%, affacturage, leasing via filiale.
CNCAS: Crédit agricole saisonnier 8-10%, campagne 6-9 mois, garantie récolte/stock.
Baobab SN: Microfinance 20-24%, ticket 300K-30M FCFA, décaissement rapide (48h-1 semaine).
BNDE: Banque de développement, prêts concessionnels 6-9% pour PME innovantes, ticket 50-500M FCFA.
Fonds FONGIP: Garantie publique, couvre 60-80% prêt, conditions souples, processus parfois lent.
DER/FJ: Financement jeunes/femmes entrepreneurs, ticket 1-50M FCFA, taux subventionné.`,
    country: "Sénégal",
    sector: null,
    source: "APBEF-SN, DER, BNDE rapports 2024",
    tags: ["banque", "credit", "financement", "senegal"]
  },

  // ═══════ BAILLEURS DE FONDS ADDITIONNELS ═══════
  {
    category: "benchmarks",
    title: "I&P — Investisseurs & Partenaires",
    content: `Type: Fonds d'impact equity/quasi-equity. Basé à Paris, focus Afrique francophone.
Fonds actifs: IPAE 2 (150M EUR), IPDEV 2 (20M EUR), I&P Accélération (5-10M EUR).
Ticket: IPAE = 1-10M EUR (equity). IPDEV = 100K-1.5M EUR (petites PME). Accélération = 30-300K EUR.
Secteurs: tous secteurs sauf extractif et tabac/alcool. Préférence: agro, santé, éducation, finance, digital.
Critères clés: CA > 200M FCFA (IPAE) ou > 30M (IPDEV). Gouvernance propre. Potentiel croissance 20%+/an. Impact mesurable.
Process: 3-6 mois de due diligence. Comité d'investissement. Siège au board. Exit 5-7 ans.
KPIs impact: emplois créés, accès services essentiels, genre (cible 30% management féminin), climat.
Ce qu'ils veulent voir: états financiers 2-3 ans, BP 5 ans, équipe solide, marché adressable clair.`,
    country: null,
    sector: null,
    source: "I&P website, rapports d'impact I&P 2023-2024",
    tags: ["bailleur", "ip", "equity", "impact"]
  },
  {
    category: "benchmarks",
    title: "BOAD — Banque Ouest Africaine de Développement",
    content: `Type: Institution financière régionale UEMOA. Prêts concessionnels + garanties.
Ticket: 500M - 50B FCFA. Durée: 7-20 ans avec 2-5 ans de différé.
Taux: 5-7% (concessionnaire), 7-9% (marché). Devise: FCFA (pas de risque de change).
Secteurs: infrastructure, agriculture, industrie, énergie, habitat social. Pas de retail/commerce.
Critères: TRI > 10%, impact développement, viabilité financière, contribution au PIB régional.
Process: via États membres ou directement pour grands projets. Études de faisabilité BOAD format.
Lignes de refinancement PME via banques locales: BOAD prête à 5% aux banques qui reprêtent à 8-10% aux PME.
Important: la BOAD ne finance pas directement les micro/petites entreprises, uniquement via intermédiaires.`,
    country: null,
    sector: null,
    source: "BOAD rapport annuel 2023, conditions générales de financement",
    tags: ["bailleur", "boad", "uemoa", "pret"]
  },
  {
    category: "benchmarks",
    title: "BIO Invest — Coopération belge",
    content: `Type: DFI belge. Equity, quasi-equity, prêts. Focus Afrique Centrale et Ouest.
Ticket: 1-10M EUR (direct). Aussi via fonds d'investissement (PE funds Africa).
Secteurs: agribusiness, énergie renouvelable, santé, finance inclusive, digital.
Critères: rentabilité financière + impact développement. Due diligence ESG complète (IFC PS).
Spécificité: forte synergie avec Enabel (AT complémentaire possible).
Process: 3-6 mois, format Information Memorandum + modèle financier 5-10 ans.`,
    country: null,
    sector: null,
    source: "BIO Invest annual report 2023",
    tags: ["bailleur", "bio", "belgique", "equity"]
  },

  // ═══════ FISCALITÉ DÉTAILLÉE ═══════
  {
    category: "fiscal",
    title: "Régimes fiscaux PME — Côte d'Ivoire",
    content: `Régime réel simplifié (RSI): CA 50-200M FCFA. IS = 25%. Comptabilité simplifiée SYSCOHADA.
Régime du réel normal: CA > 200M FCFA. IS = 25%. Comptabilité normale, audit si SA.
Taxe sur l'exploitation (TE): 0.5% CA, minimum 2M FCFA/an. Déductible de l'IS.
Régime PME spécial: IS réduit à 4% pour CA < 200M FCFA (article 33 ter du CGI). Exonération BIC 5 ans pour entreprises agréées CEPICI.
Zone franche industrielle: exonération IS 5-10 ans, TVA 0%, droits de douane 0% sur équipements.
Patente: 0.5% CA, minimum variable selon commune. Due même en cas de perte.
TVA: 18% standard, 9% réduit (produits de première nécessité). Seuil assujettissement 50M FCFA CA.
Retenue à la source: 20% sur prestations étrangères, 12% sur dividendes, 15% sur intérêts.`,
    country: "Côte d'Ivoire",
    sector: null,
    source: "CGI Côte d'Ivoire 2024, DGI circulaires",
    tags: ["fiscal", "is", "tva", "pme", "civ"]
  },
  {
    category: "fiscal",
    title: "Régimes fiscaux PME — Sénégal",
    content: `Contribution Globale Unique (CGU): CA < 100M FCFA. Taux progressif 5-10% CA. Déclaration simplifiée.
Régime réel simplifié: CA 100-300M FCFA. IS = 30%. SYSCOHADA simplifié.
Régime du réel normal: CA > 300M FCFA. IS = 30%. Audit obligatoire pour SA.
Minimum fiscal: 0.5% CA, plancher 500K FCFA. Dû même en cas de perte.
Zone économique spéciale (Diamniadio, DISEZ): exonération IS 5-10 ans, TVA 0% sur équipements.
Loi startup act (2019): exonération IS 3 ans, TVA 0%, procédures simplifiées. Label PME DER.
TVA: 18% standard. Seuil 100M FCFA CA.
Contribution foncière: 5% valeur locative, 15% terrains non bâtis.`,
    country: "Sénégal",
    sector: null,
    source: "CGI Sénégal 2024, DGID",
    tags: ["fiscal", "is", "tva", "pme", "senegal"]
  },
  {
    category: "fiscal",
    title: "Droit du travail — UEMOA (synthèse)",
    content: `SMIG: CI 75000, SN 58900, BF 34664, ML 40000, BJ 40000, TG 35000, NE 30047 FCFA/mois.
Durée légale: 40h/semaine (8h/jour, 5j). Heures sup: +15% (41-46h), +50% (47-55h), +100% (nuit/dimanche).
Congés payés: 2.5 jours/mois travaillé (30 jours/an). +1 jour par 5 ans ancienneté.
Préavis licenciement: 1 mois (ouvrier), 3 mois (cadre). Indemnité = 1 mois/an ancienneté (min).
Charges sociales patronales: CI ~18% (CNPS), SN ~18% (CSS/IPM), BF ~16% (CNSS). Base = salaire brut plafonné.
Charges salariales: CI ~6.3%, SN ~7%, BF ~5.5%.
Contrats: CDD max 2 ans renouvelable 1 fois. CDI = forme normale. Période d'essai: 1-6 mois selon catégorie.
Convention collective interprofessionnelle applicable dans chaque pays UEMOA (grille de salaires par catégorie).`,
    country: null,
    sector: null,
    source: "Codes du travail UEMOA, conventions collectives 2023",
    tags: ["travail", "smig", "social", "emploi"]
  },

  // ═══════ DONNÉES MACRO ═══════
  {
    category: "benchmarks",
    title: "Indicateurs macro-économiques — UEMOA 2024-2025",
    content: `PIB nominal UEMOA 2024: ~155 000 milliards FCFA. Croissance moyenne 5.5-6.5%.
CI: PIB 50 000B FCFA, croissance 6.5%, inflation 3.5%. Plus grande économie UEMOA.
SN: PIB 20 000B FCFA, croissance 8.5% (gaz/pétrole), inflation 4%.
BF: PIB 12 000B FCFA, croissance 4% (ralenti sécuritaire), inflation 3%.
ML: PIB 13 000B FCFA, croissance 5%, situation politique instable.
Taux directeur BCEAO: 3.5% (mars 2025). Taux de refinancement: 5.5%.
Taux d'usure: ~15% (variable par trimestre). Réserves de change: 6 mois d'importations.
Population UEMOA: ~140 millions. Urbanisation: 45%. Âge médian: 18 ans.
Taux de bancarisation: 30-40% (en hausse avec mobile money). Mobile money: 60%+ adultes.`,
    country: null,
    sector: null,
    source: "BCEAO Rapport annuel 2024, FMI WEO, Banque Mondiale WDI",
    tags: ["macro", "pib", "inflation", "uemoa"]
  },
  {
    category: "benchmarks",
    title: "Cours matières premières clés — Afrique Ouest 2024-2025",
    content: `Cacao: 8000-12000 USD/tonne (hausse historique 2024). CI = 45% production mondiale.
Café robusta: 3500-5000 USD/tonne. CI 3ème producteur africain.
Coton: 0.80-0.95 USD/livre. ML, BF = grands producteurs sahéliens.
Or: 2300-2700 USD/once. ML, BF = exportateurs majeurs.
Pétrole brut: 70-85 USD/baril. Impact coût transport et énergie.
Caoutchouc naturel: 1.50-2.00 USD/kg. CI 1er producteur africain.
Anacarde (cajou): 1200-1800 USD/tonne (noix brute). CI, TG, BJ = exportateurs.
Huile de palme: 800-1100 USD/tonne. CI, GH producteurs ouest-africains.
Impact sur PME: coûts intrants indexés sur cours mondiaux, risque de marge si prix non répercutés.`,
    country: null,
    sector: null,
    source: "World Bank Commodity Markets, ICCO, ICO, Bloomberg 2024-2025",
    tags: ["matieres_premieres", "cours", "cacao", "coton"]
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Clear existing seed data (optional — controlled by query param)
    const url = new URL(req.url);
    if (url.searchParams.get("clear") === "true") {
      await sb.from("knowledge_base").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Insert all seed entries
    const { data, error } = await sb.from("knowledge_base").upsert(
      SEED_DATA.map(entry => ({
        ...entry,
        metadata: { seeded: true, version: "2026-03" },
      })),
      { onConflict: "title" }
    ).select("id, title, category");

    if (error) throw error;

    // Trigger embedding generation for entries without embeddings
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ mode: "backfill" }),
      });
      console.log("Embedding backfill triggered after seed");
    } catch (e) {
      console.warn("Embedding generation failed (non-blocking):", e);
    }

    return new Response(JSON.stringify({
      success: true,
      inserted: data?.length || 0,
      categories: [...new Set(SEED_DATA.map(e => e.category))],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
