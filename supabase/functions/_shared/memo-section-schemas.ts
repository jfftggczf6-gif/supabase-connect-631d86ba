/**
 * Schémas rich pour les 12 sections du dossier d'investissement PE.
 *
 * Source de vérité : seed PharmaCi (supabase/seeds/seed_pe_pharmaci_rich.sql)
 * + structures consommées par les viewers src/components/pe/sections/*.tsx
 *
 * Ces schémas sont injectés dans les prompts Claude pour :
 * - generate-pe-pre-screening (génération initiale 12 sections)
 * - regenerate-pe-section (régénération d'une section)
 * - generate-ic1-memo (enrichissement IC1 vs pre_screening)
 *
 * Convention : enums color = "ok" | "warning" | "danger" | "info"
 *              enums severity = "Critical" | "High" | "Medium" | "Low"
 *              enums status doc = "ok" | "partial" | "missing"
 */

export type MemoSectionCode =
  | 'executive_summary'
  | 'shareholding_governance'
  | 'top_management'
  | 'services'
  | 'competition_market'
  | 'unit_economics'
  | 'financials_pnl'
  | 'financials_balance'
  | 'investment_thesis'
  | 'support_requested'
  | 'esg_risks'
  | 'annexes';

export const SECTION_LABELS: Record<MemoSectionCode, string> = {
  executive_summary:        'Résumé exécutif',
  shareholding_governance:  'Actionnariat et gouvernance',
  top_management:           'Organisation interne et top management',
  services:                 "Services de l'entreprise et chaîne de valeur",
  competition_market:       'Concurrence et marché',
  unit_economics:           'Unit economics',
  financials_pnl:           'États financiers — Compte de résultat',
  financials_balance:       'États financiers — Bilan et trésorerie',
  investment_thesis:        "Thèse d'investissement",
  support_requested:        'Accompagnement et value creation',
  esg_risks:                'ESG, impact et risques',
  annexes:                  'Annexes',
};

export const SECTION_NUMBERS: Record<MemoSectionCode, number> = {
  executive_summary:        1,
  shareholding_governance:  2,
  top_management:           3,
  services:                 4,
  competition_market:       5,
  unit_economics:           6,
  financials_pnl:           7,
  financials_balance:       8,
  investment_thesis:        9,
  support_requested:        10,
  esg_risks:                11,
  annexes:                  12,
};

/**
 * Description du rôle de chaque section pour orienter la génération IA.
 */
export const SECTION_DESCRIPTIONS: Record<MemoSectionCode, string> = {
  executive_summary:
    "Synthèse en une page : KPIs clés, présentation cible, thèse en 5 points, recommandation formelle (verdict + score + conditions), red flags critiques, points de monitoring, deal breakers. Ce résumé est auto-généré à partir des 11 autres sections.",
  shareholding_governance:
    "Table de capitalisation détaillée, organes de gouvernance (CA, AG, CAC, contrôle interne), conventions réglementées identifiées, red flags gouvernance, plan de structuration post-investissement convenu avec le fondateur.",
  top_management:
    "Équipe dirigeante (profils + évaluation analyste), postes clés vacants avec plan de recrutement budgété et priorités, capacité d'absorption de la croissance, red flags RH (homme-clé, etc.).",
  services:
    "Nature de l'activité, gamme de produits / services par famille (avec marges et %CA), site de production, capacité de production (KPIs), canaux de distribution, supply chain, moat compétitif (typiquement multi-couches).",
  competition_market:
    "Taille du marché TAM/SAM/SOM, mégatrends, environnement réglementaire, paysage concurrentiel détaillé (top 3-5 concurrents avec CA, PDM, marge, CAGR, analyse), analyse géographique d'expansion, menaces, positionnement synthèse.",
  unit_economics:
    "Rentabilité par canal et par famille, décomposition du coût de revient unitaire, sensibilité aux inputs clés (matières premières, FX), break-even, levier opérationnel, unit economics expansion géographique, benchmarks sectoriels.",
  financials_pnl:
    "Compte de résultat 3 ans détaillé SYSCOHADA (rows: CA, marge brute, charges externes, frais perso, EBITDA déclaré, retraitements, EBITDA retraité, D&A, EBIT, financier, IS, RN), analyses croissance et marge brute, retraitements EBITDA détaillés, taux d'imposition, benchmarks ratios.",
  financials_balance:
    "Bilan 3 ans détaillé (actif + passif), KPIs BFR (DSO, DPO, DIO, BFR jours, BFR/CA), décomposition BFR, leviers de réduction, KPIs endettement (gearing, dette nette/EBITDA, ICR), analyse trésorerie, cash flow opérations, points de vigilance, paragraphe VNA.",
  investment_thesis:
    "Thèse d'investissement structurée en 5 arguments forts, structuration proposée (pre-money, ticket, participation, horizon, instrument, gouvernance post-deal), scénarios de sortie (bear/base/bull avec MOIC + IRR + description), stratégie de sortie envisagée.",
  support_requested:
    "Use of proceeds détaillé par poste avec %, plan de value creation sur 3 horizons temporels (H1=100j post-closing, H2=6 mois, H3=12 mois), KPIs de suivi trimestriel (T0/M+6/M+12), mécanisme de décaissement, valeur ajoutée non-financière du fonds.",
  esg_risks:
    "Impact ODD (KPIs alignement ODD3/8/9 + paragraphes), indicateurs IRIS+ (rows actuel/cible/méthode), 2X Criteria IFC (table éligibilité), IFC Performance Standards (matrice de conformité), attractivité DFI (Proparco/IFC/BII/FMO), matrice de risques, red flags SYSCOHADA détectés.",
  annexes:
    "Inventaire documentaire (items + statut ok/partial/missing + summary), références knowledge base utilisées, historique des modifications, qualité globale du dossier (legacy : catégories N0/N1/N2 par dimension).",
};

/**
 * Schéma JSON template par section.
 * L'IA doit produire un objet content_json conforme à ce schéma.
 */
export const SECTION_SCHEMAS: Record<MemoSectionCode, string> = {
  // ─────────────────────────────────────────────────────────────────
  executive_summary: `{
  "meta": {
    "redige_par": "<string: rôle + nom, ex 'K. N''Guessan (MD)'>",
    "data_par": "<string: nom analyste, ex 'S. Koné (Analyste)'>",
    "review_par": "<string: nom IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<string: courte note version, mentionne pré-DD/IC1/IC finale>",
    "auto_gen_note": "Ce résumé est auto-généré à partir des 11 autres sections. Régénéré à chaque validation de section.",
    "last_generated_at": "<string: date courte, ex '16 avr.'>",
    "validations_im": <number>,
    "validations_md": <number>,
    "score_memo": <number 0-100>
  },
  "kpis_bandeau": [
    { "label": "CA 2025",              "value": "<ex '2.82 Mds'>", "hint": "<ex 'CAGR 18% · 3 ans'>",     "hint_color": "ok|warning|danger" },
    { "label": "EBITDA retraité",      "value": "<ex '300M'>",     "hint": "<ex 'Marge 10.6%'>",          "hint_color": "ok|warning|danger", "value_color": "ok|warning|danger" },
    { "label": "Marge brute",          "value": "<ex '32%'>",      "hint": "<ex 'Q3 · méd. 28%'>",        "hint_color": "ok|warning|danger" },
    { "label": "Dette nette / EBITDA", "value": "<ex '0.88x'>",    "hint": "<ex 'seuil <2x'>",             "hint_color": "ok|warning|danger", "value_color": "ok|warning|danger" },
    { "label": "Ticket",               "value": "<ex '4.2M EUR'>", "hint": "<ex 'Equity pure'>" },
    { "label": "Pre-money",            "value": "<ex '10-14M'>",   "hint": "<ex '8-10x EBITDA'>" },
    { "label": "MOIC base",            "value": "<ex '2.8x'>",     "hint": "<ex 'IRR 22% · 5 ans'>",       "value_color": "ok",                "hint_color": "info" }
  ],
  "presentation": {
    "heading": "Présentation de la cible",
    "paragraphs": [
      "<para 1 : qui est l'entreprise, ce qu'elle fait, fondateurs, employés, certifications. Citations [Source: ...]>",
      "<para 2 : marché cible, mégatrends, taille, croissance. Citations>"
    ]
  },
  "thesis_5_points": {
    "heading": "Thèse d'investissement en 5 points",
    "items": [
      { "n": 1, "lead": "<lead synthétique>", "body": "<argumentation détaillée + chiffres + citations>" },
      { "n": 2, "lead": "...", "body": "..." },
      { "n": 3, "lead": "...", "body": "..." },
      { "n": 4, "lead": "...", "body": "..." },
      { "n": 5, "lead": "...", "body": "..." }
    ]
  },
  "recommendation": {
    "heading": "Recommandation formelle",
    "verdict": "go_direct|go_conditionnel|hold|reject",
    "verdict_label": "<string: ex 'GO CONDITIONNEL — conviction modérée'>",
    "color": "green|orange|red",
    "summary": "<paragraphe résumant le verdict + score d'adéquation thèse>",
    "score_section": "<phrase score, ex 'Score d''adéquation thèse : 83%.'>",
    "score_esono": <number 0-100>,
    "score_threshold": <number 0-100>,
    "score_brut": <number 0-100>,
    "conditions_intro": "<intro conditions, ex 'Trois conditions préalables au passage en IC1 :'>",
    "conditions": [
      { "n": 1, "text": "<condition précise + délai>" },
      { "n": 2, "text": "..." }
    ]
  },
  "red_flags_synthesis": [
    {
      "title": "<titre red flag, ex 'Concentration client 62% top 3'>",
      "severity": "Critical|High|Medium|Low",
      "penalty_pts": <number négatif>,
      "penalty_dimension": "Gouvernance|Finance|Croissance|Thèse|ESG|Données",
      "body": "<détail factuel + atténuation possible + citations>"
    }
  ],
  "monitoring_points": [
    "<point monitoring 1, ex 'BFR en hausse (14% → 17.4% CA en 3 ans)'>",
    "<point monitoring 2>"
  ],
  "deal_breakers": {
    "intro": "Deal breakers identifiés :",
    "items": [
      "<deal breaker 1, ex 'Concentration client >70% après cartographie DD'>",
      "<deal breaker 2>"
    ],
    "conclusion": "<phrase conclusion type 'Si l''un des deux se matérialise → la recommandation passe de Go conditionnel à Hold.'>"
  },
  "footer": {
    "auto_gen_summary": "Ce résumé est auto-généré à partir des 11 autres sections.",
    "last_generated_at": "<date courte>",
    "sections_redigees": 12,
    "sections_total": 12,
    "validations_im": <number>,
    "validations_md": <number>,
    "score_memo": <number>
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  shareholding_governance: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note version>"
  },
  "cap_table": {
    "rows": [
      {
        "actionnaire": "<nom>",
        "percent": <number 0-100>,
        "type": "Ordinaire|Préf.|Convertible",
        "entree": "<année, ex '2012'>",
        "role": "<description rôle opérationnel>",
        "bold": <bool: true si actionnaire majoritaire>
      }
    ],
    "notes": [
      "<note 1 : structure capitalistique, observation OHADA, etc.>",
      "<note 2 : historique modifications capital>"
    ]
  },
  "governance": {
    "ca": "<paragraphe sur le Conseil d'Administration : existe ? composition ? fréquence ?>",
    "ag": "<paragraphe sur les AG : conformité article 337 AUSCGIE ? PV à jour ?>",
    "cac": "<paragraphe sur le Commissaire aux Comptes : nommé ? réserves ? cabinet ?>",
    "controle_interne": "<paragraphe sur le contrôle interne : signataires bancaires, procédures, séparation des tâches>"
  },
  "conventions": [
    {
      "title": "<titre convention, ex 'Convention 1 — Bail commercial (confirmée)'>",
      "severity": "Critical|High|Medium|Low",
      "body": "<détail convention + analyse conformité prix marché + recommandation DD>"
    }
  ],
  "red_flags": [
    {
      "title": "<titre red flag>",
      "severity": "Critical|High|Medium|Low",
      "body": "<détail + impact + atténuation>"
    }
  ],
  "structuration_plan": {
    "intro": "<intro plan, ex 'Le fondateur a validé les 6 points suivants lors de l''entretien du XX :'>",
    "items": [
      { "title": "<item titre>", "body": "<détail item>" }
    ]
  },
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<liste sources, ex 'Statuts, PV AG 2023, RCCM, entretien DG'>",
    "review_comment": "<commentaire IM optionnel>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  top_management: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "equipe_dirigeante": {
    "rows": [
      {
        "name": "<nom>",
        "poste": "<poste, ex 'DG / Fondateur'>",
        "exp": "<expérience, ex '14 ans'>",
        "profil_eval": "<paragraphe : parcours + évaluation analyste + risques homme-clé>"
      }
    ],
    "synthesis": "<paragraphe synthèse : compétences couvertes ? alignement intérêts ? turnover ?>"
  },
  "postes_vacants": [
    {
      "title": "<poste, ex 'DAF'>",
      "priority": <number 1-3>,
      "delay": "<délai, ex '100 jours post-closing'>",
      "budget": "<budget annuel, ex '15M FCFA/an'>",
      "body": "<détail du besoin + profil recherché + impact si non comblé>"
    }
  ],
  "capacite_absorption": {
    "evaluation": "<phrase verdict, ex 'Insuffisante en l''état, mais corrigeable avec le plan de recrutement.'>",
    "paragraphs": [
      "<paragraphe 1 : analyse capacité actuelle>",
      "<paragraphe 2 : besoins additionnels et budget>"
    ]
  },
  "red_flags": [
    {
      "title": "<titre>",
      "severity": "Critical|High|Medium|Low",
      "body": "<détail + atténuation + délai>"
    }
  ],
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date, ex '11 avr. après visite site'>",
    "sources": "<sources>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  services: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "nature_activite": "<paragraphe synthétique : modèle business, périmètre, marché>",
  "gamme_produits": {
    "rows": [
      {
        "famille": "<nom famille, ex 'Antalgiques / anti-inflammatoires'>",
        "pct_ca": "<ex '35%'>",
        "references": "<ex '14'>",
        "marge": "<ex '30%'>",
        "molecules": "<molécules + observations>"
      }
    ],
    "formes_galeniques": "<paragraphe formes/segments produits + contributions marges>"
  },
  "site_production": "<paragraphe ou string : localisation, surface, certifications, équipements clés, observations visite>",
  "capacite_production": {
    "kpis": [
      { "label": "Capacité installée", "value": "<ex '50M unités/an'>" },
      { "label": "Production 2025",    "value": "<ex '31M unités'>" },
      { "label": "Taux utilisation",   "value": "<ex '62%'>" },
      { "label": "Potentiel 2 postes", "value": "<ex '100M unités/an'>" }
    ],
    "paragraphs": [
      "<paragraphe leviers croissance organique>"
    ]
  },
  "distribution": {
    "paragraphs": [
      "<paragraphe canal 1 : type, % CA, marge, dynamiques, AO, délais paiement>",
      "<paragraphe canal 2 : ...>"
    ]
  },
  "supply_chain": {
    "paragraphs": [
      "<para approvisionnement matières principales : fournisseurs, %, délais, stocks>",
      "<para approvisionnement secondaires + risques>"
    ]
  },
  "moat_bpf": {
    "intro": "<intro 1 phrase : moat compétitif en N couches>",
    "layers": [
      { "title": "<nom couche, ex 'Certification BPF UEMOA'>", "body": "<détail + chiffres + barrière à l''entrée>" }
    ]
  },
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<sources>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  competition_market: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "tam_sam_som": {
    "tam": "<paragraphe TAM avec chiffrage source>",
    "sam": "<paragraphe SAM>",
    "som": "<paragraphe SOM>"
  },
  "megatrends": [
    { "label": "<label trend>", "value": "<chiffre clé>", "hint": "<source/contexte>", "color": "ok|warning|danger" }
  ],
  "reglementation": {
    "paragraphs": [
      "<paragraphe 1 : cadre réglementaire favorable/défavorable>",
      "<paragraphe 2 : évolutions récentes>"
    ]
  },
  "concurrents": {
    "intro": "<intro paysage concurrentiel>",
    "rows": [
      {
        "name": "<nom concurrent>",
        "ca": "<CA>",
        "pdm": "<PDM>",
        "marge": "<marge>",
        "cagr": "<CAGR>",
        "cagr_color": "ok|warning|danger",
        "analyse": "<analyse positionnement>",
        "highlight": "self|null"
      }
    ],
    "dynamique": "<paragraphe dynamique concurrentielle>"
  },
  "senegal_analysis": "<paragraphe analyse marché expansion (si pertinent)>",
  "menaces": [
    {
      "title": "<titre menace>",
      "probability": "<faible|moyenne|élevée>",
      "body": "<analyse menace + résilience entreprise>"
    }
  ],
  "positionnement": {
    "paragraphs": [
      "<paragraphe synthèse positionnement de la cible>"
    ]
  },
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<sources benchmarks utilisés>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  unit_economics: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "rentabilite_canal": {
    "headers": ["Canal", "Volume", "Prix moyen", "Marge contribution", "% du résultat"],
    "rows": [
      ["<canal>", "<volume>", "<prix>", { "v": "<marge>", "color": "var(--pe-ok)", "bold": true }, "<%>"]
    ]
  },
  "rentabilite_famille": {
    "headers": ["Famille", "% CA", "Marge brute", "Marge contribution", "Contribution résultat"],
    "rows": [
      ["<famille>", "<%CA>", "<marge brute>", "<marge contrib>", "<contribution>"]
    ]
  },
  "decomposition_cout": [
    { "label": "<poste de coût>", "value": "<%>", "hint": "<contexte>" }
  ],
  "sensibilite_api": {
    "headers": ["Scénario", "Impact prix", "Impact CA", "Impact EBITDA", "Mitigation"],
    "rows": [
      ["<scénario>", "<impact prix>", "<impact CA>", "<impact EBITDA>", "<mitigation>"]
    ]
  },
  "break_even": {
    "value": "<ex '14M unités/an'>",
    "hint": "<ex '45% capacité installée'>"
  },
  "levier_operationnel": "<paragraphe : sensibilité résultat à variation CA>",
  "unit_eco_sn": "<paragraphe : unit economics expansion géographique (si pertinent)>",
  "benchmarks": {
    "headers": ["Ratio", "Cible", "P25", "Médiane", "Quartile"],
    "rows": [
      ["<ratio>", "<cible>", "<P25>", "<médiane>", "<quartile>"]
    ]
  },
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<sources>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  financials_pnl: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "pnl_3y": {
    "headers": ["2023", "2024", "2025"],
    "delta_header": "Δ 3 ans",
    "rows": [
      { "label": "Chiffre d'affaires",            "values": ["...", "...", "..."], "delta": "+X%",  "bold": true },
      { "label": "Coût des ventes",               "values": ["...", "...", "..."], "indent": true },
      { "label": "Marge brute",                   "values": ["...", "...", "..."], "delta": "...",  "bold": true, "highlight": "ok" },
      { "label": "Charges externes",              "values": ["...", "...", "..."] },
      { "label": "Frais de personnel",            "values": ["...", "...", "..."] },
      { "label": "EBITDA déclaré",                "values": ["...", "...", "..."], "bold": true },
      { "label": "Retraitements EBITDA",          "values": ["...", "...", "..."], "sub": true,    "highlight": "warning" },
      { "label": "EBITDA retraité",               "values": ["...", "...", "..."], "bold": true,   "highlight": "warning" },
      { "label": "Dotations amort. & prov.",      "values": ["...", "...", "..."] },
      { "label": "Résultat d'exploitation",       "values": ["...", "...", "..."] },
      { "label": "Résultat financier",            "values": ["...", "...", "..."] },
      { "label": "Impôt société",                 "values": ["...", "...", "..."] },
      { "label": "Résultat net",                  "values": ["...", "...", "..."], "bold": true }
    ],
    "footnote": "<footnote sur méthodologie SYSCOHADA + retraitements>"
  },
  "growth_analysis": {
    "paragraphs": [
      "<paragraphe analyse drivers croissance CA + comparaison concurrents>",
      "<paragraphe sustainability + projection>"
    ]
  },
  "gross_margin_analysis": {
    "paragraphs": [
      "<paragraphe analyse expansion marge brute + drivers>"
    ]
  },
  "ebitda_adjustments": {
    "red_flags": [
      { "title": "<red flag retraitement>", "severity": "Critical|High|Medium|Low", "body": "<détail+citation>" }
    ],
    "reconciliation_table": {
      "headers": ["EBITDA déclaré", "+/- Retraitement", "EBITDA retraité"],
      "rows": [
        { "label": "<retraitement>", "values": ["<a>", "<b>", "<c>"], "highlight": "warning" }
      ]
    }
  },
  "tax_rate": {
    "narrative": "<paragraphe analyse taux d'imposition réel vs théorique>"
  },
  "benchmarks": {
    "rows": [
      {
        "ratio": "<ex 'Marge brute'>",
        "company": "<chiffre cible>",
        "p25": "<P25>",
        "median": "<médiane secteur>",
        "quartile": "<Q1|Q2|Q3|Q4>",
        "highlight": "ok|warning|danger"
      }
    ],
    "source": "<source benchmarks>"
  },
  "synthesis": "<paragraphe synthèse : profil rentabilité au-dessus/dessous médiane>",
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<liasses + cabinet CAC + benchmarks>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  financials_balance: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "bilan_actif": {
    "headers": ["2023", "2024", "2025"],
    "rows": [
      { "label": "Immobilisations corporelles", "values": ["...", "...", "..."] },
      { "label": "Immobilisations incorporelles", "values": ["...", "...", "..."] },
      { "label": "Total actif immobilisé", "values": ["...", "...", "..."], "bold": true },
      { "label": "Stocks", "values": ["...", "...", "..."] },
      { "label": "Créances clients", "values": ["...", "...", "..."], "highlight": "warning" },
      { "label": "Autres créances", "values": ["...", "...", "..."] },
      { "label": "Trésorerie", "values": ["...", "...", "..."] },
      { "label": "Total actif circulant", "values": ["...", "...", "..."], "bold": true },
      { "label": "TOTAL ACTIF", "values": ["...", "...", "..."], "bold": true }
    ]
  },
  "bilan_passif": {
    "headers": ["2023", "2024", "2025"],
    "rows": [
      { "label": "Capitaux propres", "values": ["...", "...", "..."], "bold": true },
      { "label": "Dettes financières long terme", "values": ["...", "...", "..."] },
      { "label": "Dettes financières court terme", "values": ["...", "...", "..."] },
      { "label": "Dettes fournisseurs", "values": ["...", "...", "..."] },
      { "label": "Autres dettes", "values": ["...", "...", "..."] },
      { "label": "TOTAL PASSIF", "values": ["...", "...", "..."], "bold": true }
    ]
  },
  "bfr_kpis": [
    { "label": "DSO (jours)",           "value": "<ex '90j'>", "color": "ok|warning|danger", "hint": "<seuil>" },
    { "label": "DPO (jours)",           "value": "<ex '45j'>", "color": "ok|warning|danger", "hint": "<seuil>" },
    { "label": "DIO (jours)",           "value": "<ex '60j'>", "color": "ok|warning|danger", "hint": "<seuil>" },
    { "label": "BFR (jours de CA)",     "value": "<ex '105j'>", "color": "ok|warning|danger", "hint": "<seuil>" },
    { "label": "BFR / CA",              "value": "<ex '17.4%'>", "color": "ok|warning|danger", "hint": "<seuil>" }
  ],
  "bfr_analysis": {
    "paragraphs": [
      "<paragraphe analyse BFR : drivers, évolution>"
    ]
  },
  "bfr_decomposition": {
    "headers": ["2023", "2025", "Commentaire"],
    "rows": [
      { "label": "<composante BFR>", "value_a": "<2023>", "value_b": "<2025>", "comment": "<commentaire>", "highlight": "ok|warning|danger" }
    ]
  },
  "leviers_bfr": {
    "intro": "<intro plan réduction BFR>",
    "items": [
      { "n": 1, "title": "<titre levier>", "body": "<détail + impact estimé>" }
    ]
  },
  "endettement_kpis": [
    { "label": "Gearing (DN/CP)",       "value": "<ex '0.5x'>", "color": "ok|warning|danger", "hint": "<seuil>" },
    { "label": "Dette nette / EBITDA",  "value": "<ex '0.88x'>", "color": "ok|warning|danger", "hint": "<seuil <2x>" },
    { "label": "ICR",                   "value": "<ex '5.2x'>", "color": "ok|warning|danger", "hint": "<seuil >3x>" },
    { "label": "Maturité dette",        "value": "<ex '3.5 ans'>", "color": "ok|warning|danger", "hint": "<contexte>" }
  ],
  "endettement": "<paragraphe analyse structure endettement>",
  "desendettement": "<paragraphe trajectoire désendettement>",
  "tresorerie_analysis": "<paragraphe analyse trésorerie + saisonnalité>",
  "cash_flow_operations": "<paragraphe cash flow opérations 3y + analyse récurrence>",
  "no_red_flag_conclusion": "<paragraphe conclusion positive : pas de red flag bilan / structure financière saine>",
  "vigilance_points": [
    { "title": "<point vigilance>", "body": "<détail + monitoring proposé>" }
  ],
  "vna_paragraphe": "<paragraphe sur VNA / valeur résiduelle des immobilisations>",
  "red_flags": [
    { "title": "<red flag>", "severity": "Critical|High|Medium|Low", "body": "<détail>" }
  ],
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<liasses + commentaires CAC>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  investment_thesis: `{
  "meta": {
    "redige_par": "<IM>",
    "review_par": "<MD ou null>",
    "valide_par": "<MD ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>",
    "pivot_hint": "<phrase optionnelle, ex 'Pivot d''angle suite à analyse marché — voir §5'>"
  },
  "five_arguments": {
    "items": [
      { "n": 1, "lead": "<lead>", "body": "<argumentation détaillée + chiffres + sources>" },
      { "n": 2, "lead": "...", "body": "..." },
      { "n": 3, "lead": "...", "body": "..." },
      { "n": 4, "lead": "...", "body": "..." },
      { "n": 5, "lead": "...", "body": "..." }
    ]
  },
  "structuration": {
    "pre_money": { "value": "<ex '12M EUR'>", "hint": "<ex '8.5x EBITDA retraité'>" },
    "ticket":    { "value": "<ex '4.2M EUR'>", "hint": "<ex 'Equity pure'>" },
    "participation": { "value": "<ex '26% post-money'>", "hint": "<ex 'Minoritaire de blocage'>" },
    "horizon":   { "value": "<ex '5 ans'>", "hint": "<ex 'Sortie cible 2030'>" },
    "instrument_note": "<paragraphe instrument financier choisi + raisons>",
    "governance_items": [
      "<item gouvernance 1>",
      "<item gouvernance 2>"
    ]
  },
  "scenarios_returns": {
    "bear": { "moic": "<ex '1.8x'>", "irr": "<ex '12%'>", "description": "<hypothèses bear>" },
    "base": { "moic": "<ex '2.8x'>", "irr": "<ex '22%'>", "description": "<hypothèses base>" },
    "bull": { "moic": "<ex '4.1x'>", "irr": "<ex '33%'>", "description": "<hypothèses bull>" },
    "pre_money_indicatif": "<ex '10-14M EUR'>"
  },
  "exit_strategy": {
    "type_envisage": "<ex 'Cession industrielle ou DFI'>",
    "narratif": "<paragraphe stratégie sortie + acquéreurs potentiels + valorisation cible>"
  },
  "footer": {
    "redige_par": "<IM>",
    "date": "<date>",
    "sources": "<modèle DCF + comparables + IFC>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  support_requested: `{
  "meta": {
    "redige_par": "<IM>",
    "review_par": "<MD ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "use_of_proceeds_detailed": [
    {
      "label": "<ex 'Nouvelle ligne production'>",
      "percent": <number>,
      "amount": "<montant en devise, ex '2.5M EUR'>",
      "body": "<détail emploi : fournisseur, délai, ROI>",
      "highlight": <bool>
    }
  ],
  "value_creation_plan": [
    {
      "horizon": "H1",
      "items": [
        { "title": "<titre action>", "delay": "<délai, ex 'M+2'>", "body": "<détail + KPI cible>" }
      ],
      "budget_note": "<note budget horizon, ex 'Budget : 50M FCFA hors CAPEX'>"
    },
    {
      "horizon": "H2",
      "items": [
        { "title": "...", "delay": "...", "body": "..." }
      ],
      "budget_note": "..."
    },
    {
      "horizon": "H3",
      "items": [
        { "title": "...", "delay": "...", "body": "..." }
      ],
      "budget_note": "..."
    }
  ],
  "kpis_suivi": {
    "rows": [
      {
        "kpi": "<nom KPI>",
        "t0": "<valeur actuelle>",
        "t0_color": "ok|warning|danger",
        "m6": "<cible M+6>",
        "m6_color": "ok|warning|danger",
        "m12": "<cible M+12>",
        "m12_color": "ok|warning|danger"
      }
    ]
  },
  "decaissement": "<paragraphe mécanisme décaissement : tranches, conditions, milestones>",
  "valeur_ajoutee": "<paragraphe valeur ajoutée non-financière du fonds (réseau, expertise, ...)>",
  "footer": {
    "redige_par": "<IM>",
    "date": "<date>",
    "sources": "<plan de financement + échanges fondateur>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  esg_risks: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "valide_par": "<MD ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "odd_kpis": [
    { "label": "ODD 3 — Santé", "value": "<KPI clé>", "hint": "<contexte>", "color": "ok|warning|danger" },
    { "label": "ODD 8 — Travail", "value": "<KPI>", "hint": "<contexte>", "color": "ok|warning|danger" },
    { "label": "ODD 9 — Industrie", "value": "<KPI>", "hint": "<contexte>", "color": "ok|warning|danger" },
    { "label": "ODD 5 — Genre", "value": "<KPI>", "hint": "<contexte>", "color": "ok|warning|danger" }
  ],
  "odd_details": {
    "odd3": "<paragraphe ODD 3 santé : impact mesurable + métriques>",
    "odd8": "<paragraphe ODD 8 emploi : impact + métriques>",
    "odd9": "<paragraphe ODD 9 industrie : impact + métriques>"
  },
  "iris_plus": {
    "rows": [
      {
        "indicator": "<indicateur IRIS+, ex 'PI4060 — Patients servis'>",
        "actuel": "<valeur actuelle>",
        "actuel_color": "ok|warning|danger",
        "cible": "<cible M+24>",
        "method": "<méthode mesure>"
      }
    ],
    "note": "<note méthodologique>"
  },
  "two_x_criteria": {
    "intro": "<intro éligibilité 2X>",
    "rows": [
      {
        "criterion": "<critère 2X>",
        "actuel": "<statut actuel>",
        "actuel_status": "ok|warning|danger",
        "post": "<statut post-investissement>",
        "post_status": "ok|warning|danger",
        "analyse": "<analyse>"
      }
    ],
    "conclusion": "<conclusion éligibilité 2X>"
  },
  "ifc_ps": {
    "intro": "<intro IFC Performance Standards>",
    "rows": [
      {
        "ps": "<ex 'PS1 — Évaluation environnementale'>",
        "level": "ok|partial|missing|n/a",
        "analyse": "<analyse conformité>"
      }
    ],
    "synthesis": "<synthèse conformité IFC PS>"
  },
  "dfi_attractivite": {
    "intro": "<intro attractivité DFI>",
    "dfis": [
      {
        "name": "<DFI, ex 'Proparco'>",
        "fit": "ok|partial|low",
        "rationale": "<raison fit>"
      }
    ]
  },
  "risks_matrix": {
    "rows": [
      {
        "category": "<catégorie risque, ex 'Réglementaire'>",
        "risk": "<description risque>",
        "impact": "Critical|High|Medium|Low",
        "probability": "Critical|High|Medium|Low",
        "mitigation": "<mesures atténuation>"
      }
    ]
  },
  "red_flags_syscohada": {
    "rows": [
      {
        "code": "<ex 'KRF-001 - Convention non documentée'>",
        "severity": "Critical|High|Medium|Low",
        "score_pts": <number négatif>,
        "body": "<détail détection + atténuation>"
      }
    ],
    "score_brut": <number 0-100>,
    "score_net": <number 0-100>,
    "threshold": <number 0-100>
  },
  "red_flags": [
    { "title": "<red flag>", "severity": "Critical|High|Medium|Low", "body": "<détail>" }
  ],
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<knowledge_risk_factors + IRIS+ catalog + 2X Challenge>"
  }
}`,

  // ─────────────────────────────────────────────────────────────────
  annexes: `{
  "meta": {
    "redige_par": "<analyste>",
    "review_par": "<IM ou null>",
    "version_label": "IC1 (draft)",
    "version_note": "<note>"
  },
  "inventaire_documentaire": {
    "items": [
      {
        "label": "<doc attendu, ex 'Liasses SYSCOHADA 2023-2025'>",
        "status": "ok|partial|missing",
        "note": "<précision, ex 'Fournis pour 2023-2024 ; 2025 en cours de certification'>"
      }
    ],
    "summary": "<phrase synthèse, ex '11 docs fournis sur 16 attendus — qualité globale N1.5'>"
  },
  "knowledge_base_refs": [
    { "name": "<ex 'IFC Pharma Africa 2024'>", "description": "<usage dans le memo>" }
  ],
  "historique_modifications": [
    { "date": "<date>", "actor": "<acteur>", "action": "<action, ex 'Validation section 7'>" }
  ],
  "doc_quality": {
    "categories": [
      {
        "name": "<ex 'Financier'>",
        "level": "N0|N1|N2",
        "checklist": [
          { "label": "<doc>", "status": "ok|partial|missing" }
        ]
      }
    ],
    "global_level": "<ex 'N1.5'>",
    "summary": "<synthèse qualité>"
  },
  "footer": {
    "redige_par": "<analyste>",
    "date": "<date>",
    "sources": "<sources>"
  }
}`,
};
