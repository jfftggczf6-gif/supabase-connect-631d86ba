-- Seed contenu fake pour PharmaCi (ADW-2026-001) — permet de tester le workspace
-- sans appeler l'IA Claude. Reproduit le mockup PE_experience_complete_1.html.
--
-- Usage : docker exec -i supabase_db_<project_ref> psql -U postgres -d postgres < seed_pe_fake_pharmaci.sql

DO $$
DECLARE
  v_org_id UUID := '55555555-5555-5555-5555-555555555555';  -- Adiwale Test
  v_md_id UUID := 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa';   -- K. N'Guessan
  v_analyst1_id UUID := 'aaaaaaaa-4444-4444-4444-aaaaaaaaaaaa';  -- S. Koné
  v_deal_id UUID;
  v_memo_id UUID;
  v_version_id UUID;
BEGIN
  -- 1) Trouver le deal PharmaCi
  SELECT id INTO v_deal_id FROM pe_deals WHERE deal_ref = 'ADW-2026-001';
  IF v_deal_id IS NULL THEN
    RAISE EXCEPTION 'Deal ADW-2026-001 introuvable. Run seed_local_full.sql d''abord.';
  END IF;

  -- 2) Cleanup éventuel existant
  DELETE FROM investment_memos WHERE deal_id = v_deal_id;  -- cascade vers versions + sections + validations
  DELETE FROM pe_deal_documents WHERE deal_id = v_deal_id;

  -- 3) Documents fake (3 docs)
  INSERT INTO pe_deal_documents (deal_id, organization_id, filename, storage_path, mime_type, size_bytes, category, uploaded_by) VALUES
    (v_deal_id, v_org_id, 'pharmaci_pitch_deck.pdf',         v_org_id::text || '/' || v_deal_id::text || '/pharmaci_pitch_deck.pdf',         'application/pdf', 4500000,  'pitch',     v_analyst1_id),
    (v_deal_id, v_org_id, 'pharmaci_etats_financiers.xlsx',  v_org_id::text || '/' || v_deal_id::text || '/pharmaci_etats_financiers.xlsx',  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 320000, 'financial', v_analyst1_id),
    (v_deal_id, v_org_id, 'pharmaci_statuts.pdf',             v_org_id::text || '/' || v_deal_id::text || '/pharmaci_statuts.pdf',           'application/pdf', 850000,   'legal',     v_analyst1_id);

  -- 4) Investment memo + version pre_screening_v1 ready
  INSERT INTO investment_memos (deal_id, created_by) VALUES (v_deal_id, v_analyst1_id) RETURNING id INTO v_memo_id;

  INSERT INTO memo_versions (memo_id, label, stage, status, overall_score, classification, generated_by_agent, generated_by_user_id, generated_at)
  VALUES (v_memo_id, 'pre_screening_v1', 'pre_screening', 'ready', 74, 'go_conditionnel', 'fake_seed', v_analyst1_id, now())
  RETURNING id INTO v_version_id;

  -- 5) Les 12 sections avec contenu mockup-driven

  -- Section 1 : Résumé exécutif (kpis_bandeau + ai_synthesis)
  INSERT INTO memo_sections (version_id, section_code, content_md, content_json, position) VALUES
  (v_version_id, 'executive_summary',
    'PharmaCi Industries SA est un producteur ivoirien de médicaments génériques certifié BPF UEMOA, basé à Abidjan depuis 2012. L''entreprise affiche une croissance de **+18% par an** sur les 3 dernières années, portée par l''accès privilégié aux marchés publics hospitaliers via la certification locale. Ticket demandé : **4.2M EUR equity** pour financer une nouvelle ligne de production (60%), l''expansion régionale Sénégal (25%) et le BFR (15%). [Source: pitch_deck.pdf p.4]',
    '{
      "kpis_bandeau": [
        {"label": "CA 2025",        "value": "2.8 Mds FCFA",  "hint": "+18% YoY",       "hint_color": "ok"},
        {"label": "EBITDA retraité","value": "320M FCFA",     "hint": "Marge 11.4%",    "hint_color": "warning"},
        {"label": "Marge brute",    "value": "32%",            "hint": "Médiane 28%",    "hint_color": "warning"},
        {"label": "Dette/EBITDA",   "value": "0.8x",           "hint": "Seuil <2x",      "hint_color": "ok"},
        {"label": "Ticket demandé", "value": "4.2M EUR",       "hint": "equity",         "hint_color": null}
      ],
      "ai_synthesis": {
        "paragraph": "PME industrielle en forte croissance sur un marché porteur (pharmacie générique UEMOA, $2.4B, +8-10%/an). Avantage compétitif défendable via la certification BPF locale qui donne accès aux AO hospitaliers. Profil financier au-dessus de la médiane sectorielle avec marge brute Q3 et dette nette en réduction. Deux points d''attention majeurs : concentration client à 62% (dépendance probable aux marchés publics) et EBITDA à retraiter de la rémunération dirigeant. Gouvernance très centralisée sans contre-pouvoirs — condition sine qua non de structuration avant closing. Deal compatible thèse mid-market santé.",
        "strengths_tags": ["Croissance CA", "Marge brute Q3", "Dette saine", "Certification BPF"],
        "weaknesses_tags": ["Gouvernance", "Concentration client", "Documentation"]
      }
    }'::jsonb,
    0),

  -- Section 2 : Actionnariat
  (v_version_id, 'shareholding_governance',
    'Structure familiale sans investisseur institutionnel. M. A. Kouassi (DG/fondateur) détient **72%** du capital, Mme Kouassi 18%, et le management 10%. Pas de pacte d''actionnaires formalisé. La structure de gouvernance devra être restructurée pré-closing : formalisation d''un Conseil d''Administration et création d''un comité d''audit. [Source: statuts.pdf]',
    '{
      "actionnariat": {
        "items": [
          {"label": "M. A. Kouassi",  "percent": 72, "subtitle": "Fondateur / DG"},
          {"label": "Mme A. Kouassi", "percent": 18, "subtitle": "Conjointe"},
          {"label": "Management",      "percent": 10, "subtitle": "Pool stock-options"}
        ]
      }
    }'::jsonb,
    1),

  -- Section 3 : Top management
  (v_version_id, 'top_management',
    'Le DG/fondateur cumule les fonctions exécutives clés (DG + DAF de fait). **Risque homme-clé identifié.** Recrutement d''un DAF formalisé recommandé en condition de closing. L''équipe technique est solide (3 cadres expérimentés en production pharmaceutique). [Source: pitch_deck.pdf p.7]',
    '{
      "management": {
        "items": [
          {"name": "A. Kouassi",     "role": "DG/Fondateur",            "tag": "warning", "note": "14 ans exp. pharma. Cumule DG + DAF — risque homme-clé. DAF à recruter (condition de closing)."},
          {"name": "M. Touré",       "role": "Directeur Production",   "tag": "ok",      "note": "12 ans expérience BPF. Pilote la nouvelle ligne."},
          {"name": "Mme Coulibaly",  "role": "Responsable Qualité",    "tag": "ok",      "note": "Certifiée auditeur BPF UEMOA."},
          {"name": "Poste à pourvoir","role": "DAF",                    "tag": "danger",  "note": "Recrutement requis avant closing."}
        ]
      }
    }'::jsonb,
    2),

  -- Section 4 : Services
  (v_version_id, 'services',
    'Production et distribution de médicaments génériques certifiés BPF UEMOA. Positionnement intermédiaire entre importateurs et laboratoires industriels internationaux. Accès privilégié aux appels d''offres hospitaliers publics via la certification locale. Catalogue : 47 SKUs (anti-infectieux, antalgiques, gastro, cardio).',
    '{"activite": "Production et distribution de médicaments génériques certifiés BPF UEMOA. Positionnement intermédiaire entre importateurs et laboratoires industriels internationaux. Accès privilégié aux AO hospitaliers publics via la certification locale. Catalogue de 47 SKUs (anti-infectieux, antalgiques, gastro, cardio)."}'::jsonb,
    3),

  -- Section 5 : Concurrence et marché (benchmark)
  (v_version_id, 'competition_market',
    'Le marché pharma UEMOA pèse $2.4 Mds avec une croissance de 8-10%/an, porté par la directive UEMOA 2023 (préférence nationale +15% sur AO publics). PharmaCi se compare favorablement aux pairs régionaux sur la croissance (+18% vs +10% médiane) et la marge brute (32% vs 28%). [Source: knowledge_benchmarks pharma UEMOA / IFC 2024]',
    '{
      "benchmark": {
        "headers": ["PharmaCi", "Médiane", "Quartile"],
        "rows": [
          {"ratio": "Marge brute",       "company": "32%",    "median": "28%",    "quartile": "Q3"},
          {"ratio": "Marge EBITDA",      "company": "15%",    "median": "12%",    "quartile": "Q3"},
          {"ratio": "EBITDA retraité",   "company": "11.4%",  "median": "12%",    "quartile": "Q2"},
          {"ratio": "BFR / CA",          "company": "22%",    "median": "18%",    "quartile": "Q3↑"},
          {"ratio": "Croiss. CA 3 ans",  "company": "+18%",   "median": "+10%",   "quartile": "Q4"}
        ],
        "source": "knowledge_benchmarks pharma UEMOA · IFC 2024 · 14 entreprises"
      }
    }'::jsonb,
    4),

  -- Section 6 : Unit economics
  (v_version_id, 'unit_economics',
    '## Économie unitaire — analyse par SKU\n\n- **Anti-infectieux (40% du CA)** : marge brute 35%, marge EBITDA 18%. Volume hospitalier dominant.\n- **Antalgiques OTC (25% du CA)** : marge brute 28%, marge EBITDA 12%. Pression prix sur les officines.\n- **Gastro/Cardio (35% du CA)** : marge brute 31%, marge EBITDA 14%. Croissance secteur diabète.\n\nPoint d''attention : ROIC sectoriel pharma génériques UEMOA estimé à 18-22%. PharmaCi affiche 24% (calcul interne sur capitaux engagés moyens). [Source: états_financiers.xlsx onglet ROIC]',
    '{}'::jsonb,
    5),

  -- Section 7 : États financiers PnL (snapshot 3 ans)
  (v_version_id, 'financials_pnl',
    'Croissance soutenue avec amélioration progressive de la marge brute (+3 pts sur 3 ans). EBITDA déclaré 2025 : 420M FCFA — **retraité à 320M** après normalisation de la rémunération dirigeant (estimation 80-120M FCFA non identifiée dans les charges). Dette nette en réduction : 400M → 280M sur 3 ans. À confirmer en DD. [Source: états_financiers.xlsx]',
    '{
      "snapshot_3y": {
        "headers": ["2023", "2024", "2025"],
        "rows": [
          {"label": "Chiffre d''affaires", "values": ["2.0 Mds", "2.4 Mds", "2.8 Mds"]},
          {"label": "Marge brute (%)",     "values": ["29%", "31%", "32%"]},
          {"label": "EBITDA déclaré",      "values": ["250M", "340M", "420M"]},
          {"label": "EBITDA retraité",     "values": ["n/d", "n/d", "320M"], "highlight": "warning"},
          {"label": "Résultat net",        "values": ["120M", "180M", "230M"]},
          {"label": "Dette nette",         "values": ["400M", "350M", "280M"]}
        ],
        "footnote": "Retraitement EBITDA : rémunération dirigeant estimée 80-120M FCFA non identifiée dans les charges. EBITDA retraité = 420M - 100M = 320M. À confirmer en DD."
      }
    }'::jsonb,
    6),

  -- Section 8 : Bilan
  (v_version_id, 'financials_balance',
    '## Structure bilantaire (clôture 31/12/2025)\n\n**Actif** (3.2 Mds FCFA total) :\n- Immobilisations corporelles : 1.4 Mds (ligne production + équipements BPF)\n- Stocks : 480M (3.5 mois de CA)\n- Créances clients : 620M (BFR/CA = 22%)\n- Trésorerie : 320M\n\n**Passif** :\n- Capitaux propres : 1.8 Mds\n- Dette financière nette : 280M\n- Dettes d''exploitation : 380M\n- Provisions : 60M (litiges + IDR)\n\nRatios clés : autonomie financière 56% (sain), gearing 0.16x (très bas). Capacité d''endettement supplémentaire confortable.',
    '{}'::jsonb,
    7),

  -- Section 9 : Thèse d'investissement (match + scenarios + reco)
  (v_version_id, 'investment_thesis',
    'Deal compatible avec la thèse mid-market santé du fonds. Profil financier au-dessus de la médiane sectorielle, trajectoire de croissance soutenue (+18% CAGR). Base case : MOIC 2.8x / IRR 22% sur horizon 5 ans. **Verdict : Go conditionnel** sous 3 conditions (liasses certifiées, clarification rémunération DG, cartographie clients).',
    '{
      "thesis_match": {
        "criteria": [
          {"label": "Secteur cible",                "status": "match"},
          {"label": "Ticket dans la fourchette",    "status": "match"},
          {"label": "Géographie éligible",          "status": "match"},
          {"label": "CA minimum requis",            "status": "match"},
          {"label": "États financiers certifiés",   "status": "partial"},
          {"label": "EBITDA positif exigé",         "status": "match"}
        ],
        "match_count": 5,
        "total": 6,
        "score_percent": 83
      },
      "scenarios_returns": {
        "bear": {"moic": "1.8x", "irr": "12%", "description": "Croiss. CA 8%/an (Sénégal échoue), EBITDA marge stable 11.4%, exit 6x EBITDA secondaire. EV sortie : 8.2M EUR."},
        "base": {"moic": "2.8x", "irr": "22%", "description": "Croiss. CA 15%/an (plan 80%), EBITDA marge 13%, exit 8x EBITDA trade sale. EV sortie : 15.6M EUR."},
        "bull": {"moic": "4.1x", "irr": "33%", "description": "Croiss. CA 22%/an (Sénégal + 2ème pays), EBITDA marge 15%, exit 10x EBITDA trade sale stratégique. EV sortie : 24.5M EUR."},
        "pre_money_indicatif": "10-14M EUR"
      },
      "recommendation": {
        "verdict": "go_conditionnel",
        "summary": "Deal compatible thèse mid-market santé. Base case IRR 22% / MOIC 2.8x. Trois conditions préalables à la poursuite en DD.",
        "conditions": [
          {"n": 1, "text": "Obtenir les liasses 2024-2025 certifiées par un commissaire aux comptes"},
          {"n": 2, "text": "Clarifier la politique de rémunération du dirigeant pour retraiter l''EBITDA"},
          {"n": 3, "text": "Cartographier les 10 premiers clients avec poids respectif et nature contractuelle"}
        ],
        "deal_breakers": ["Concentration client > 70%", "EBITDA retraité < 8%"],
        "conviction": "modéré"
      }
    }'::jsonb,
    8),

  -- Section 10 : Accompagnement demandé (use of proceeds)
  (v_version_id, 'support_requested',
    'Plan d''utilisation des fonds **majoritairement productif** (CAPEX 85%) — profil cohérent mid-market industriel. La nouvelle ligne de production (60%) doit doubler la capacité actuelle pour absorber la demande publique en hausse. L''expansion Sénégal (25%) cible les AO hospitaliers BCEAO, leveraging la certification BPF UEMOA déjà obtenue.',
    '{
      "use_of_proceeds": [
        {"label": "Nouvelle ligne de production",  "percent": 60},
        {"label": "Expansion régionale Sénégal",   "percent": 25},
        {"label": "Fonds de roulement",            "percent": 15}
      ]
    }'::jsonb,
    9),

  -- Section 11 : ESG / Risques
  (v_version_id, 'esg_risks',
    'Trois red flags qualitatifs identifiés. La concentration client (62% sur top 3) est le risque principal et doit être validée en DD. La gouvernance centralisée et l''EBITDA non normalisé sont corrigeables pré-closing via structuration et reporting. [Sources: états_financiers.xlsx + interview DG du 08/04]',
    '{
      "red_flags": [
        {"title": "Concentration client élevée",            "severity": "high",   "detail": "Top 3 clients = 62% du CA. Seuil d''alerte : 40%. Probable dépendance marchés publics hospitaliers — à valider en DD via cartographie client + nature contractuelle."},
        {"title": "EBITDA sans rémun. dirigeant",          "severity": "medium", "detail": "Rémunération DG non identifiée dans les charges. Retraitement estimé 80-120M FCFA. EBITDA réel inférieur au déclaré de ~24%."},
        {"title": "Gouvernance centralisée",                "severity": "medium", "detail": "DG cumule toutes les fonctions exécutives. Pas de Conseil d''Administration formalisé, AG irrégulières. À structurer pré-closing."}
      ]
    }'::jsonb,
    10),

  -- Section 12 : Annexes (qualité dossier)
  (v_version_id, 'annexes',
    'Score qualité documentaire : **N1.5** — données financières exploitables mais gouvernance documentaire très faible. **8 documents fournis sur 16 attendus**. Compléments à demander avant DD : pacte d''actionnaires, organigramme détaillé, CV dirigeants, contrats clés, liste top 10 clients.',
    '{
      "doc_quality": {
        "categories": [
          {"name": "Financier",   "level": "N2", "checklist": [
            {"label": "Liasses SYSCOHADA 3 ans",  "status": "ok"},
            {"label": "Relevés bancaires 12m",    "status": "ok"},
            {"label": "Budget prévisionnel",      "status": "ok"},
            {"label": "Audit / certification",    "status": "partial"}
          ]},
          {"name": "Juridique",   "level": "N2", "checklist": [
            {"label": "Statuts",   "status": "ok"},
            {"label": "RCCM",       "status": "ok"},
            {"label": "Fiscal / CNPS",       "status": "ok"},
            {"label": "PV AG récent",        "status": "missing"}
          ]},
          {"name": "Commercial",  "level": "N1", "checklist": [
            {"label": "Pitch deck",          "status": "ok"},
            {"label": "BP / projections",    "status": "ok"},
            {"label": "Liste clients top 10","status": "missing"},
            {"label": "Contrats clés",       "status": "missing"}
          ]},
          {"name": "RH / Gouv.",  "level": "N0", "checklist": [
            {"label": "Organigramme",        "status": "missing"},
            {"label": "CV dirigeants",       "status": "missing"},
            {"label": "Pacte d''actionnaires","status": "missing"},
            {"label": "Règlement intérieur", "status": "missing"}
          ]}
        ],
        "global_level": "N1.5",
        "summary": "8 documents fournis / 16 attendus"
      }
    }'::jsonb,
    11);

  -- 6) Quelques sections en différents status pour démontrer le workflow
  -- exec_summary : déjà validée par MD
  UPDATE memo_sections SET status = 'validated', last_edited_by = v_md_id, last_edited_at = now() - interval '2 hours'
    WHERE version_id = v_version_id AND section_code = 'executive_summary';
  INSERT INTO memo_section_validations (section_id, action, from_status, to_status, actor_id, actor_role, comment, created_at)
  SELECT id, 'submit', 'draft', 'pending_validation', v_analyst1_id, 'analyste', 'Première version', now() - interval '4 hours'
    FROM memo_sections WHERE version_id = v_version_id AND section_code = 'executive_summary';
  INSERT INTO memo_section_validations (section_id, action, from_status, to_status, actor_id, actor_role, comment, created_at)
  SELECT id, 'validate', 'pending_validation', 'validated', v_md_id, 'managing_director', 'OK pour comité', now() - interval '2 hours'
    FROM memo_sections WHERE version_id = v_version_id AND section_code = 'executive_summary';

  -- top_management : en attente de validation
  UPDATE memo_sections SET status = 'pending_validation', last_edited_by = v_analyst1_id, last_edited_at = now() - interval '30 minutes'
    WHERE version_id = v_version_id AND section_code = 'top_management';
  INSERT INTO memo_section_validations (section_id, action, from_status, to_status, actor_id, actor_role, comment, created_at)
  SELECT id, 'submit', 'draft', 'pending_validation', v_analyst1_id, 'analyste', 'Soumis avec note risque homme-clé', now() - interval '30 minutes'
    FROM memo_sections WHERE version_id = v_version_id AND section_code = 'top_management';

  -- esg_risks : à réviser (commentaire MD)
  UPDATE memo_sections SET status = 'needs_revision', last_edited_by = v_md_id, last_edited_at = now() - interval '15 minutes'
    WHERE version_id = v_version_id AND section_code = 'esg_risks';
  INSERT INTO memo_section_validations (section_id, action, from_status, to_status, actor_id, actor_role, comment, created_at)
  SELECT id, 'submit', 'draft', 'pending_validation', v_analyst1_id, 'analyste', null, now() - interval '1 hour'
    FROM memo_sections WHERE version_id = v_version_id AND section_code = 'esg_risks';
  INSERT INTO memo_section_validations (section_id, action, from_status, to_status, actor_id, actor_role, comment, created_at)
  SELECT id, 'request_revision', 'pending_validation', 'needs_revision', v_md_id, 'managing_director', 'Ajouter détail sur la nature contractuelle des marchés publics (durée, renouvellement) — c''est le red flag principal', now() - interval '15 minutes'
    FROM memo_sections WHERE version_id = v_version_id AND section_code = 'esg_risks';

  RAISE NOTICE 'Seed PharmaCi fake content : OK';
  RAISE NOTICE '  - Deal: ADW-2026-001 (PharmaCi Industries SA)';
  RAISE NOTICE '  - Memo + 1 version pre_screening_v1 (score 74, classification go_conditionnel)';
  RAISE NOTICE '  - 12 sections remplies (mockup-driven)';
  RAISE NOTICE '  - exec_summary VALIDATED par MD';
  RAISE NOTICE '  - top_management PENDING (analyste a soumis)';
  RAISE NOTICE '  - esg_risks NEEDS_REVISION (MD a demandé révision)';
  RAISE NOTICE '  - 9 autres sections en DRAFT';
END $$;
