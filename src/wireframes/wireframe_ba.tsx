import { useState, useCallback, useMemo } from "react";
import { Upload, User, BarChart3, BookOpen, Search, FileText, TrendingUp, Target, Briefcase, ChevronLeft, Users, Settings, Inbox } from "lucide-react";

// ── DATA ──
const MANDATS_INIT = [
  { id:"MCA-001", name:"PharmaCi Industries SA", short:"PharmaCi", sector:"Pharma", country:"CI", ticket:"12M", stage:"im", analyste:"F. Bamba", reviewPending:2, progress:65 },
  { id:"MCA-002", name:"AquaCulture Dakar", short:"AquaCulture", sector:"Aquaculture", country:"SN", ticket:"8M", stage:"im", analyste:"F. Bamba", reviewPending:0, progress:80 },
  { id:"MCA-003", name:"TransportCo Logistics", short:"TransportCo", sector:"Transport", country:"CI", ticket:"15M", stage:"im", analyste:"F. Bamba", reviewPending:0, progress:90 },
  { id:"MCA-004", name:"AgriPro Sahel", short:"AgriPro BF", sector:"Agro", country:"BF", ticket:"10M", stage:"interets", analyste:"M. Koné", reviewPending:0, progress:95 },
  { id:"MCA-005", name:"MediLab Lomé", short:"MediLab", sector:"Diagnostic", country:"TG", ticket:"6M", stage:"im", analyste:"M. Koné", reviewPending:1, progress:40 },
  { id:"MCA-006", name:"SolarFarm CI", short:"SolarFarm", sector:"Énergie", country:"CI", ticket:"20M", stage:"im", analyste:"M. Koné", reviewPending:0, progress:75 },
  { id:"MCA-007", name:"Boulangerie Mod.", short:"BoulanMod", sector:"Agro", country:"CI", ticket:"4M", stage:"recus", analyste:"F. Bamba", reviewPending:0, progress:10 },
  { id:"MCA-008", name:"ClimateTech DK", short:"ClimateTech", sector:"Green", country:"SN", ticket:"18M", stage:"nego", analyste:"M. Koné", reviewPending:0, progress:98 },
  { id:"MCA-009", name:"EduConnect GN", short:"EduConnect", sector:"EdTech", country:"GN", ticket:"7M", stage:"close", analyste:"F. Bamba", reviewPending:0, progress:100 },
  { id:"MCA-C01", name:"FoodTech Abidjan", short:"FoodTech", sector:"Food", country:"CI", ticket:"5M", stage:"recus", analyste:"M. Koné", reviewPending:0, progress:5 },
  { id:"MCA-C02", name:"TechServ Bamako", short:"TechServ", sector:"IT", country:"ML", ticket:"2M", stage:"close", analyste:"M. Koné", reviewPending:0, progress:100 },
];

const STAGES = [
  {id:"recus", label:"Reçus", color:"#6B7280"},
  {id:"im", label:"IM vendeur", color:"#534AB7"},
  {id:"interets", label:"Intérêts", color:"#BA7517"},
  {id:"nego", label:"Négo", color:"#DC2626"},
  {id:"close", label:"Closé", color:"#6B7280"},
];

const SECS = [
  {id:1, label:"Résumé exécutif", status:"empty", auto:true},
  {id:2, label:"Actionnariat & gouvernance", status:"validated"},
  {id:3, label:"Top management", status:"validated"},
  {id:4, label:"Services", status:"validated"},
  {id:5, label:"Concurrence & marché", status:"validated"},
  {id:6, label:"Unit economics", status:"submitted"},
  {id:8, label:"PnL", status:"submitted"},
  {id:9, label:"États financiers Bilan", status:"correction", comment:"Vérifier passif court terme vs liasse SYSCOHADA 2025"},
  {id:10, label:"Thèse d'investissement", status:"validated"},
  {id:11, label:"Accompagnement demandé", status:"validated"},
  {id:12, label:"ESG / Risques", status:"draft"},
  {id:13, label:"Annexes", status:"draft"},
];

const DOCS_INIT = [
  {id:1, name:"Liasse SYSCOHADA 2025 (certifié)", pages:45, date:"08/04", data:"CA: 2.82 Mds, RN: 215M"},
  {id:2, name:"Liasse SYSCOHADA 2024", pages:38, date:"08/04", data:"CA: 2.40 Mds, RN: 180M"},
  {id:3, name:"Relevés bancaires NSIA", pages:24, date:"09/04", data:"2 comptes, solde moyen 145M"},
  {id:4, name:"Statuts SARL (2020)", pages:18, date:"08/04"},
  {id:5, name:"RCCM mars 2026", pages:2, date:"09/04"},
  {id:6, name:"Quittances fiscales", pages:4, date:"09/04"},
  {id:7, name:"Pitch deck", pages:22, date:"10/04"},
  {id:8, name:"CV dirigeants", pages:6, date:"12/04"},
];

const MISSING = ["Liste clients top 10", "Contrats AO hospitaliers", "Organigramme", "PV AG 2024-2025"];

const ST = {
  empty: {c:"#E5E7EB", l:"Vide"},
  draft: {c:"#D97706", l:"En cours"},
  submitted: {c:"#534AB7", l:"En review"},
  correction: {c:"#DC2626", l:"À corriger"},
  validated: {c:"#16A34A", l:"Validé"},
};

const RC = {analyste:"#534AB7", senior:"#3B82F6", partner:"#DC2626"};

// ── UI PRIMITIVES ──
function Tag({children, v="default", s:sx={}}) {
  const m = {
    default:{b:"#F9FAFB",c:"#6B7280"}, success:{b:"#DCFCE7",c:"#166534"},
    purple:{b:"#EEEDFE",c:"#534AB7"}, info:{b:"#E0F2FE",c:"#0369A1"},
    warn:{b:"#FEF3C7",c:"#D97706"}, coral:{b:"#FEE2E2",c:"#DC2626"},
  };
  const s = m[v] || m.default;
  return (<span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,background:s.b,color:s.c,...sx}}>{children}</span>);
}

function Dot({color, s:sz=7}) {
  return (<span style={{width:sz,height:sz,borderRadius:sz/2,background:color,display:"inline-block",flexShrink:0}}/>);
}

function Prog({value, max=100, color="#534AB7", h=5}) {
  return (<div style={{height:h,background:"#E5E7EB",borderRadius:999,overflow:"hidden"}}><div style={{width:`${Math.min(100,(value/max)*100)}%`,height:"100%",background:color,transition:"width 0.3s",borderRadius:999}}/></div>);
}

function Btn({children, primary, small, disabled, onClick, style:sx={}}) {
  const [ho, sH] = useState(false);
  const base = {
    border:"1px solid #D1D5DB",
    background: primary ? "#534AB7" : (ho && !disabled ? "#F9FAFB" : "#fff"),
    color: primary ? "#fff" : "#374151",
    padding: small ? "5px 10px" : "8px 14px",
    fontSize: small ? 11 : 13, fontWeight:600, borderRadius:6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, transition:"all 0.15s", ...sx,
  };
  if (primary) base.borderColor = "#534AB7";
  return (<button onClick={disabled?undefined:onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={base} disabled={disabled}>{children}</button>);
}

function Card({children, style={}, accent, onClick}) {
  return (<div onClick={onClick} style={{background:"#fff",border:"1px solid #E5E7EB",borderLeft:accent?`3px solid ${accent}`:"1px solid #E5E7EB",borderRadius:8,padding:12,cursor:onClick?"pointer":"default",...style}}>{children}</div>);
}

function KPI({label, value, color}) {
  return (<div style={{textAlign:"center",flex:1,minWidth:65}}><div style={{fontSize:22,fontWeight:700,color:color||"#111827"}}>{value}</div><div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{label}</div></div>);
}

function Toast2({message, type, onClose}) {
  const c = type==="warning" ? "#D97706" : type==="info" ? "#3B82F6" : "#16A34A";
  return (<div style={{position:"fixed",bottom:20,right:20,zIndex:1000,background:"#fff",border:`1px solid ${c}`,borderLeft:`4px solid ${c}`,padding:"10px 14px",borderRadius:6,fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,0.08)",animation:"slideIn 0.2s ease-out",display:"flex",alignItems:"center",gap:10,color:"#374151"}}><span>{message}</span><span onClick={onClose} style={{cursor:"pointer",color:"#6B7280",fontSize:14}}>×</span></div>);
}

function Modal2({title, children, onClose, wide}) {
  return (<div style={{position:"fixed",inset:0,background:"rgba(17,24,39,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:8,padding:20,maxWidth:wide?640:520,width:"90%",maxHeight:"85vh",overflowY:"auto",border:"1px solid #E5E7EB"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #E5E7EB"}}><h3 style={{margin:0,fontSize:14,fontWeight:700,color:"#111827"}}>{title}</h3><span onClick={onClose} style={{cursor:"pointer",color:"#6B7280",fontSize:18}}>×</span></div>{children}</div></div>);
}

function SubHeader({onBack, children}) {
  return (<div style={{padding:"10px 16px",borderBottom:"1px solid #E5E7EB",background:"#fff",display:"flex",alignItems:"center",gap:10,height:32}}><span onClick={onBack} style={{cursor:"pointer",color:"#6B7280",fontSize:13,display:"flex",alignItems:"center",gap:4}}><ChevronLeft size={14}/> Retour</span><span style={{color:"#E5E7EB"}}>|</span>{children}</div>);
}

function CheckCircle({status, size=12}) {
  const map = {
    validated: {c:"#16A34A", filled:true},
    correction: {c:"#DC2626", filled:true},
    submitted: {c:"#534AB7", filled:false, dot:true},
    draft: {c:"#D97706", filled:false, dot:true},
    empty: {c:"#D1D5DB", filled:false},
  };
  const s = map[status] || map.empty;
  return (
    <div style={{width:size, height:size, borderRadius:size/2, border:`1.5px solid ${s.c}`, background:s.filled?s.c:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center"}}>
      {s.filled && <span style={{color:"#fff", fontSize:size*0.55, fontWeight:700, lineHeight:1}}>✓</span>}
      {s.dot && <span style={{width:size*0.35, height:size*0.35, borderRadius:"50%", background:s.c}}/>}
    </div>
  );
}

// ── MANDAT SIDEBAR ──
function MandatSideNav({groups, active, onSelect}) {
  return (
    <div style={{width:255, borderRight:"1px solid #E5E7EB", padding:"14px 0", background:"#fff", overflowY:"auto", flexShrink:0}}>
      {groups.map((g, gi) => (
        <div key={gi} style={{marginBottom:14}}>
          <div style={{padding:"4px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3}}>
            <span style={{fontSize:10, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.6}}>{g.label}</span>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              {g.progress && <span style={{fontSize:9, color:"#6B7280", fontWeight:600}}>{g.progress}</span>}
              {g.status && <CheckCircle status={g.status} size={13}/>}
            </div>
          </div>
          {g.items.map(it => {
            const isActive = active === it.id;
            const Icon = it.icon;
            return (
              <div key={it.id} onClick={() => onSelect(it.id)} style={{padding:"7px 14px", fontSize:11.5, cursor:"pointer", background:isActive?"#EEEDFE":"transparent", borderLeft:isActive?"3px solid #534AB7":"3px solid transparent", color:isActive?"#534AB7":"#374151", fontWeight:isActive?700:400, display:"flex", alignItems:"center", gap:8, justifyContent:"space-between", transition:"all 0.1s"}}>
                <div style={{display:"flex", alignItems:"center", gap:8, minWidth:0, flex:1}}>
                  {Icon && <Icon size={13} style={{flexShrink:0, opacity:0.75}}/>}
                  <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{it.label}</span>
                </div>
                <CheckCircle status={it.status} size={12}/>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── KANBAN ──
function KanbanCard2({m, role, onClick}) {
  const dim = role==="analyste" && m.analyste !== "F. Bamba";
  return (
    <Card onClick={onClick} style={{marginBottom:6, padding:10, opacity:dim?0.4:1, cursor:dim?"default":"pointer"}} accent={STAGES.find(s=>s.id===m.stage)?.color}>
      <div style={{fontSize:13, fontWeight:700, marginBottom:4, color:"#111827"}}>{m.short}</div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
        <span style={{fontSize:11, color:"#6B7280"}}>{m.sector} · {m.country}</span>
        <span style={{fontSize:11, fontWeight:700, color:"#534AB7"}}>{m.ticket}</span>
      </div>
      <Prog value={m.progress} h={4}/>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6, fontSize:10, color:"#6B7280"}}>
        <span>{m.analyste}</span>
        {m.reviewPending>0 && <Tag v="purple" s={{fontSize:9, padding:"1px 6px"}}>{m.reviewPending} review</Tag>}
      </div>
    </Card>
  );
}

function KanbanBoard({mandats, role, onCardClick}) {
  return (
    <div style={{display:"flex", gap:8, overflowX:"auto", paddingBottom:8}}>
      {STAGES.map(stage => {
        const items = mandats.filter(m => m.stage === stage.id);
        return (
          <div key={stage.id} style={{flex:"0 0 195px", minWidth:195}}>
            <div style={{padding:"6px 10px", background:"#F9FAFB", borderRadius:6, marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #E5E7EB"}}>
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                <Dot color={stage.color}/>
                <span style={{fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:0.4}}>{stage.label}</span>
              </div>
              <span style={{fontSize:11, color:"#6B7280", fontWeight:600}}>{items.length}</span>
            </div>
            {items.map(m => (
              <KanbanCard2 key={m.id} m={m} role={role} onClick={() => {
                if (role==="analyste" && m.analyste !== "F. Bamba") return;
                onCardClick(m);
              }}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MandatTable({mandats, role, onRow}) {
  const tagV = {im:"purple", interets:"warn", nego:"coral", recus:"default", close:"default"};
  return (
    <div style={{background:"#fff", border:"1px solid #E5E7EB", borderRadius:8, overflow:"hidden"}}>
      <div style={{display:"flex", padding:"10px 14px", fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", borderBottom:"1px solid #E5E7EB", background:"#F9FAFB", letterSpacing:0.5}}>
        <div style={{flex:2}}>Mandat</div>
        <div style={{flex:1}}>Secteur</div>
        <div style={{flex:1}}>Ticket</div>
        <div style={{flex:1}}>Stage</div>
        <div style={{flex:1}}>Analyste</div>
        <div style={{flex:1}}>Avancement</div>
      </div>
      {mandats.map(m => {
        const dim = role==="analyste" && m.analyste !== "F. Bamba";
        return (
          <div key={m.id} onClick={() => {if(!dim) onRow(m)}} style={{display:"flex", padding:"10px 14px", borderBottom:"1px solid #F3F4F6", fontSize:12, alignItems:"center", opacity:dim?0.4:1, cursor:dim?"default":"pointer"}}>
            <div style={{flex:2, fontWeight:600, color:"#111827"}}>{m.short}</div>
            <div style={{flex:1, color:"#6B7280"}}>{m.sector}</div>
            <div style={{flex:1, color:"#534AB7", fontWeight:700}}>{m.ticket}</div>
            <div style={{flex:1}}><Tag v={tagV[m.stage] || "default"}>{STAGES.find(s=>s.id===m.stage)?.label}</Tag></div>
            <div style={{flex:1, color:"#6B7280"}}>{m.analyste}</div>
            <div style={{flex:1}}><Prog value={m.progress}/></div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PAGES — DONNÉES
// ════════════════════════════════════════════════════════

function UploadPage({mandat, docs, setDocs, toast}) {
  const [ext, setExt] = useState(false);
  function add() {
    setExt(true);
    toast("Extraction IA lancée", "info");
    setTimeout(() => {
      setDocs(d => [...d, {id:Date.now(), name:"Liste clients top 10.xlsx", pages:3, date:"15/04", data:"10 clients · 65% CA"}]);
      setExt(false);
      toast("Document ajouté ✓");
    }, 1800);
  }
  return (
    <div style={{padding:20, maxWidth:680}}>
      <div style={{fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8, marginBottom:6}}>DONNÉES</div>
      <h3 style={{margin:"0 0 4px", fontSize:24, fontWeight:700, color:"#111827"}}>Upload documents</h3>
      <div style={{fontSize:12, color:"#6B7280", marginBottom:18, lineHeight:1.6}}>Glisser des documents, l'IA extrait les données chiffrées et les associe aux sections de l'IM</div>
      <div onClick={add} style={{border:"2px dashed #D1D5DB", borderRadius:8, padding:28, textAlign:"center", cursor:"pointer", marginBottom:14, background:"#F9FAFB", transition:"all 0.15s"}}
        onMouseEnter={e => {e.currentTarget.style.borderColor="#534AB7"; e.currentTarget.style.background="#EEEDFE";}}
        onMouseLeave={e => {e.currentTarget.style.borderColor="#D1D5DB"; e.currentTarget.style.background="#F9FAFB";}}>
        <Upload size={22} style={{color:"#6B7280", marginBottom:8}}/>
        <div style={{fontSize:14, fontWeight:600, color:"#374151", marginBottom:4}}>Glisser un document ou cliquer</div>
        <div style={{fontSize:11, color:"#6B7280"}}>PDF, Excel, Word — extraction IA automatique</div>
      </div>
      {ext && (
        <Card accent="#534AB7" style={{marginBottom:8, padding:10, background:"#EEEDFE"}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:14, height:14, border:"2px solid #534AB7", borderTopColor:"transparent", borderRadius:7, animation:"spin 0.8s linear infinite"}}/>
            <span style={{fontSize:12, color:"#534AB7", fontWeight:600}}>Extraction IA en cours...</span>
          </div>
        </Card>
      )}
      <div style={{fontSize:11, fontWeight:700, color:"#534AB7", marginTop:14, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Fournis ({docs.length})</div>
      {docs.map(d => (
        <div key={d.id} style={{display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"#F9FAFB", borderRadius:6, marginBottom:5, border:"1px solid #E5E7EB"}}>
          <FileText size={14} style={{color:"#6B7280"}}/>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, fontWeight:600, color:"#111827", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{d.name}</div>
            {d.data && <div style={{fontSize:10, color:"#16A34A"}}>✓ {d.data}</div>}
          </div>
          <span style={{fontSize:10, color:"#6B7280"}}>{d.pages}p · {d.date}</span>
        </div>
      ))}
      <div style={{fontSize:11, fontWeight:700, color:"#DC2626", marginTop:18, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Manquants ({MISSING.length})</div>
      {MISSING.map((d, i) => (
        <div key={i} style={{display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:"#FEE2E2", borderRadius:6, marginBottom:5, fontSize:12, color:"#DC2626", border:"1px solid #FECACA"}}>
          <span style={{fontWeight:700}}>⚠</span>
          <span>{d}</span>
        </div>
      ))}
      <Btn small style={{marginTop:14}} onClick={() => toast("Rappel envoyé ✓")}>📧 Rappel mandant</Btn>
    </div>
  );
}

function InfoAnalystePage({mandat, role, toast}) {
  const [notes, setNotes] = useState([
    {
      id:1, type:"RDV", title:"Réunion de cadrage avec dirigeant",
      date:"12/04/2026", author:"F. Bamba + S. Diop", corrections:3,
      body:"Premier RDV en présentiel avec J. Diabaté (DG) et A. Touré (DAF) au siège d'Abidjan. Validation du périmètre du mandat, calendrier de livraison et accès aux documents financiers. Le DG souhaite finaliser avant la rentrée scolaire pour profiter d'une fenêtre de marché favorable, notamment vu l'appel d'offres CHU Cocody attendu en septembre.",
      integrated:[
        "Calendrier livrables : IM finalisé semaine 18, teaser diffusé semaine 20",
        "Contact référent finance : A. Touré (DAF) joignable mardi/jeudi",
        "Préférence fonds : éviter Helios (mauvaise expérience secteur)",
      ],
      corrected:[
        "§3 Top management > nom DAF (A. Touré, et non A. Touré-Konan)",
        "§7 États financiers > masse salariale 2025 (510M et non 480M)",
        "§10 Thèse d'investissement > horizon de sortie 5-7 ans",
      ],
    },
    {
      id:2, type:"Note", title:"Recherche concurrents — benchmarking",
      date:"10/04/2026", author:"F. Bamba", corrections:0,
      body:"Recherche complémentaire sur les acteurs pharma sous-régionaux pour alimenter §5 Concurrence. Pharmivoire et Cipharm sont les comparables locaux les plus pertinents. Strides Africa offre un comparable transactionnel récent (2024).",
      integrated:[
        "§5 Concurrence : 4 comparables ajoutés avec parts de marché",
        "Benchmarks : 4 ratios sectoriels mis à jour",
      ],
      corrected:[],
    },
  ]);
  const [showEditor, setShowEditor] = useState(false);
  const [draft, setDraft] = useState({type:"Note", title:"", body:""});

  function addNote() {
    if (!draft.title.trim()) { toast("Titre requis","warning"); return; }
    setNotes([{
      id:Date.now(), type:draft.type, title:draft.title, body:draft.body,
      date:"07/05/2026", author:mandat.analyste, corrections:0,
      integrated:[], corrected:[],
    }, ...notes]);
    setDraft({type:"Note", title:"", body:""});
    setShowEditor(false);
    toast("Note ajoutée ✓");
  }

  function uploadCR() {
    toast("Extraction IA du compte-rendu...","info");
    setTimeout(() => {
      setNotes([{
        id:Date.now(), type:"RDV",
        title:"CR_Strategie_Q2.pdf — extrait par IA",
        body:"Compte-rendu importé. L'IA a identifié 2 informations clés à intégrer au pipeline et 2 corrections suggérées sur l'IM en cours.",
        date:"07/05/2026", author:mandat.analyste, corrections:2,
        integrated:[
          "Hypothèse croissance révisée à +18% (vs +20% initial)",
          "Nouveau client AO : CHU Treichville (3M FCFA/an)",
        ],
        corrected:[
          "§7 États financiers > révision hypothèse croissance",
          "§5 Concurrence > ajout d'un acteur local",
        ],
      }, ...notes]);
      toast("CR extrait et intégré au mandat ✓");
    }, 1800);
  }

  return (
    <div style={{padding:20, maxWidth:780}}>
      <h3 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Informations de l'analyste</h3>
      <p style={{fontSize:12, color:"#666", lineHeight:1.5, margin:"0 0 18px", maxWidth:640}}>
        Notes de réunion, comptes-rendus et informations contextuelles pour personnaliser l'IM et les livrables. L'IA extrait les éléments pertinents et les propose à l'intégration.
      </p>
      <div onClick={uploadCR} style={{border:"2px dashed #d0cfc8", borderRadius:8, padding:30, textAlign:"center", cursor:"pointer", background:"#fafaf7", transition:"all 0.15s"}}
        onMouseEnter={e => {e.currentTarget.style.borderColor="#1D9E75"; e.currentTarget.style.background="#f4faf2";}}
        onMouseLeave={e => {e.currentTarget.style.borderColor="#d0cfc8"; e.currentTarget.style.background="#fafaf7";}}>
        <Upload size={22} style={{color:"#1D9E75", marginBottom:8}}/>
        <div style={{fontSize:14, fontWeight:600, color:"#333", marginBottom:4}}>Déposez un compte-rendu de RDV</div>
        <div style={{fontSize:11, color:"#888"}}>Word, PDF, ou photo de notes</div>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:14, margin:"14px 0"}}>
        <div style={{flex:1, height:1, background:"#F1EFE8"}}/>
        <span style={{fontSize:11, color:"#888"}}>ou</span>
        <div style={{flex:1, height:1, background:"#F1EFE8"}}/>
      </div>
      {!showEditor ? (
        <div onClick={() => setShowEditor(true)} style={{border:"1px solid #F1EFE8", borderRadius:8, padding:16, textAlign:"center", cursor:"pointer", marginBottom:22, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"background 0.15s"}}
          onMouseEnter={e => e.currentTarget.style.background="#fafaf7"}
          onMouseLeave={e => e.currentTarget.style.background="#fff"}>
          <span style={{fontSize:14}}>✏</span>
          <span style={{fontSize:13, fontWeight:600}}>Écrire une note</span>
        </div>
      ) : (
        <Card style={{padding:14, marginBottom:22}}>
          <div style={{display:"flex", gap:6, marginBottom:8}}>
            {["Note","RDV","Appel"].map(t => (
              <Btn key={t} small primary={draft.type===t} onClick={() => setDraft({...draft, type:t})}>{t}</Btn>
            ))}
          </div>
          <input value={draft.title} onChange={e => setDraft({...draft, title:e.target.value})} placeholder="Titre de la note..." autoFocus style={{width:"100%", padding:8, fontSize:13, fontWeight:600, border:"1px solid #F1EFE8", borderRadius:5, marginBottom:8, fontFamily:"inherit"}}/>
          <textarea value={draft.body} onChange={e => setDraft({...draft, body:e.target.value})} placeholder="Contenu de la note..." style={{width:"100%", minHeight:90, padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, fontFamily:"inherit", resize:"vertical"}}/>
          <div style={{display:"flex", justifyContent:"flex-end", gap:6, marginTop:10}}>
            <Btn small onClick={() => {setShowEditor(false); setDraft({type:"Note", title:"", body:""});}}>Annuler</Btn>
            <Btn primary small onClick={addNote}>Ajouter la note</Btn>
          </div>
        </Card>
      )}
      <div style={{fontSize:12, color:"#444", marginBottom:10, fontWeight:600}}>Historique — {notes.length} note{notes.length>1?"s":""}</div>
      {notes.map(n => (
        <Card key={n.id} style={{padding:16, marginBottom:10}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:10, flexWrap:"wrap"}}>
            <div style={{display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0}}>
              <Tag v={n.type==="RDV"?"success":n.type==="Appel"?"info":"purple"}>{n.type}</Tag>
              <span style={{fontSize:13, fontWeight:600}}>{n.title}</span>
              {n.corrections>0 && (<Tag v="success">{n.corrections} correction{n.corrections>1?"s":""}</Tag>)}
            </div>
            <span style={{fontSize:10, color:"#888", flexShrink:0}}>{n.date}</span>
          </div>
          <p style={{fontSize:12, color:"#444", lineHeight:1.6, margin:"0 0 10px"}}>{n.body}</p>
          {n.integrated.length>0 && (
            <div style={{borderTop:"1px solid #F1EFE8", paddingTop:10, marginBottom:8}}>
              <div style={{fontSize:11, fontWeight:600, color:"#534AB7", marginBottom:5}}>Intégré au pipeline :</div>
              {n.integrated.map((it, i) => (<div key={i} style={{fontSize:11, color:"#534AB7", paddingLeft:4, marginBottom:3, lineHeight:1.5}}>• {it}</div>))}
            </div>
          )}
          {n.corrected && n.corrected.length>0 && (
            <div style={{borderTop:"1px solid #F1EFE8", paddingTop:10, marginBottom:4}}>
              <div style={{fontSize:11, fontWeight:600, color:"#1D9E75", marginBottom:6}}>Corrections appliquées :</div>
              {n.corrected.map((it, i) => (
                <div key={i} style={{fontSize:11, color:"#1D9E75", padding:"5px 8px", background:"#EAF3DE", borderRadius:4, marginBottom:3, display:"flex", gap:6, alignItems:"flex-start"}}>
                  <span style={{flexShrink:0}}>✓</span>
                  <span>{it}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:10, color:"#888", marginTop:10}}>par {n.author}</div>
        </Card>
      ))}
    </div>
  );
}

function BenchmarksPage({mandat}) {
  return (
    <div style={{padding:20, maxWidth:820}}>
      <h3 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Benchmark & analyse concurrentielle</h3>
      <p style={{fontSize:12, color:"#666", lineHeight:1.5, margin:"0 0 18px", maxWidth:680}}>
        Positionnement de {mandat.short} vs acteurs du secteur {mandat.sector} en Afrique de l'Ouest. Données agrégées par l'IA depuis la base de connaissance Esono et les sources sectorielles, avec score de pertinence affiché par bloc pour la transparence.
      </p>
      <Card style={{padding:18, marginBottom:14}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
          <BarChart3 size={16} style={{color:"#534AB7"}}/>
          <span style={{fontSize:13, fontWeight:700}}>Benchmark sectoriel</span>
        </div>
        <div style={{display:"flex", padding:"8px 0", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid #F1EFE8"}}>
          <div style={{flex:2}}>Ratio</div>
          <div style={{flex:1, textAlign:"right"}}>{mandat.short}</div>
          <div style={{flex:1, textAlign:"right"}}>Médiane</div>
          <div style={{flex:1, textAlign:"right"}}>Quartile</div>
        </div>
        {[
          {ratio:"Marge brute", company:"32%", median:"28%", quartile:"Q3", trend:"", ok:true},
          {ratio:"Marge EBITDA", company:"15%", median:"12%", quartile:"Q3", trend:"", ok:true},
          {ratio:"EBITDA retraité", company:"10.6%", median:"12%", quartile:"Q2", trend:"", ok:false},
          {ratio:"BFR / CA", company:"17.4%", median:"18%", quartile:"Q3", trend:"↑", ok:true},
          {ratio:"Croiss. CA 3 ans", company:"+18%", median:"+10%", quartile:"Q4", trend:"", ok:true},
          {ratio:"Dette nette / EBITDA", company:"1.4x", median:"2.1x", quartile:"Q3", trend:"", ok:true},
          {ratio:"ROE", company:"21%", median:"16%", quartile:"Q4", trend:"", ok:true},
        ].map((r, i) => (
          <div key={i} style={{display:"flex", padding:"10px 0", fontSize:12, borderBottom:"1px solid #f8f8f6", alignItems:"center"}}>
            <div style={{flex:2}}>{r.ratio}</div>
            <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.company}</div>
            <div style={{flex:1, textAlign:"right", color:"#888"}}>{r.median}</div>
            <div style={{flex:1, textAlign:"right"}}>
              <span style={{color:r.ok?"#1D9E75":"#BA7517", fontWeight:700, fontSize:11}}>{r.quartile}{r.trend}</span>
            </div>
          </div>
        ))}
        <div style={{marginTop:14, paddingTop:12, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", lineHeight:1.5}}>
          <strong>Source agrégée :</strong> knowledge_benchmarks pharma UEMOA · IFC 2024 · 14 entreprises · score pertinence 0.95
        </div>
      </Card>
      <Card style={{padding:18, marginBottom:14}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
          <Briefcase size={16} style={{color:"#534AB7"}}/>
          <span style={{fontSize:13, fontWeight:700}}>Concurrents directs</span>
        </div>
        <p style={{fontSize:11, color:"#666", margin:"0 0 14px", lineHeight:1.5}}>5 acteurs identifiés sur le segment génériques hospitaliers en CI/UEMOA</p>
        <div style={{display:"flex", padding:"8px 0", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid #F1EFE8"}}>
          <div style={{flex:2}}>Acteur</div>
          <div style={{width:50}}>Pays</div>
          <div style={{flex:1, textAlign:"right"}}>CA est.</div>
          <div style={{flex:1, textAlign:"right"}}>Marge EBITDA</div>
          <div style={{flex:1, textAlign:"right"}}>Part marché CI</div>
        </div>
        {[
          {name:"Pharmivoire", country:"CI", ca:"4.5 Mds FCFA", margin:"14%", share:"22%", note:"Leader historique, contrats AO publics CI + UEMOA", highlight:false},
          {name:"Cipharm", country:"CI", ca:"3.1 Mds FCFA", margin:"11%", share:"15%", note:"Production locale, partenariat Sanofi Génériques", highlight:false},
          {name:`${mandat.short} (cible)`, country:"CI", ca:"2.82 Mds FCFA", margin:"15%", share:"14%", note:"Croissance la + rapide du secteur (+18%/an), forte position AO hospitaliers", highlight:true},
          {name:"LaborEx CI", country:"CI", ca:"2.4 Mds FCFA", margin:"9%", share:"12%", note:"Distribution principalement, peu de production locale", highlight:false},
          {name:"Ubipharm CI", country:"CI", ca:"1.8 Mds FCFA", margin:"8%", share:"9%", note:"Officines + parapharmacie, marges sous pression", highlight:false},
        ].map((c, i) => (
          <div key={i} style={{padding:c.highlight?"10px 8px":"10px 0", fontSize:12, borderBottom:"1px solid #f8f8f6", background:c.highlight?"#EEEDFE":"transparent", borderRadius:c.highlight?5:0, margin:c.highlight?"4px 0":0}}>
            <div style={{display:"flex", alignItems:"center"}}>
              <div style={{flex:2, fontWeight:c.highlight?700:600, color:c.highlight?"#534AB7":"#333"}}>{c.name}</div>
              <div style={{width:50, color:"#666"}}>{c.country}</div>
              <div style={{flex:1, textAlign:"right"}}>{c.ca}</div>
              <div style={{flex:1, textAlign:"right"}}>{c.margin}</div>
              <div style={{flex:1, textAlign:"right", fontWeight:600}}>{c.share}</div>
            </div>
            <div style={{fontSize:10, color:c.highlight?"#534AB7":"#888", marginTop:4, fontStyle:"italic"}}>{c.note}</div>
          </div>
        ))}
        <div style={{marginTop:14, paddingTop:12, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", lineHeight:1.5}}>
          <strong>Source agrégée :</strong> Endeavor Insight Pharma West Africa 2023 · WHO Pharma Production Africa 2024 · Estimations IA croisées avec liasses publiées · score pertinence 0.82
        </div>
      </Card>
      <Card style={{padding:18, marginBottom:14}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
          <TrendingUp size={16} style={{color:"#534AB7"}}/>
          <span style={{fontSize:13, fontWeight:700}}>Positionnement stratégique</span>
        </div>
        <p style={{fontSize:11, color:"#666", margin:"0 0 14px", lineHeight:1.5}}>SWOT généré par l'IA à partir des entretiens et benchmarks</p>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
          <div style={{padding:12, background:"#EAF3DE", borderRadius:6, borderLeft:"3px solid #1D9E75"}}>
            <div style={{fontSize:11, fontWeight:700, color:"#1D9E75", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Forces</div>
            <ul style={{margin:0, paddingLeft:14, fontSize:11, color:"#333", lineHeight:1.7}}>
              <li>Position #3 sur AO hospitaliers CI (14% PdM)</li>
              <li>Marge EBITDA Q3 du secteur (15% vs 12%)</li>
              <li>Croissance 1,8x médiane sectorielle</li>
              <li>Équipe dirigeante stable sur 15 ans</li>
            </ul>
          </div>
          <div style={{padding:12, background:"#FBE6DC", borderRadius:6, borderLeft:"3px solid #D85A30"}}>
            <div style={{fontSize:11, fontWeight:700, color:"#D85A30", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Faiblesses</div>
            <ul style={{margin:0, paddingLeft:14, fontSize:11, color:"#333", lineHeight:1.7}}>
              <li>EBITDA retraité &lt; médiane (10,6% vs 12%)</li>
              <li>Concentration top 3 clients (42% du CA)</li>
              <li>Pas de production exportée hors UEMOA</li>
              <li>Mix produits peu diversifié (78% génériques)</li>
            </ul>
          </div>
          <div style={{padding:12, background:"#EEEDFE", borderRadius:6, borderLeft:"3px solid #534AB7"}}>
            <div style={{fontSize:11, fontWeight:700, color:"#534AB7", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Opportunités</div>
            <ul style={{margin:0, paddingLeft:14, fontSize:11, color:"#333", lineHeight:1.7}}>
              <li>Marché pharma UEMOA en croissance +12%/an</li>
              <li>Politique de souveraineté pharma régionale</li>
              <li>Demande locale post-COVID renforcée</li>
              <li>3 fonds DFI actifs sur le secteur (BIO, IFC, FMO)</li>
            </ul>
          </div>
          <div style={{padding:12, background:"#FFF8F0", borderRadius:6, borderLeft:"3px solid #BA7517"}}>
            <div style={{fontSize:11, fontWeight:700, color:"#BA7517", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Menaces</div>
            <ul style={{margin:0, paddingLeft:14, fontSize:11, color:"#333", lineHeight:1.7}}>
              <li>Pression prix sur AO hospitaliers (-3%/an)</li>
              <li>Entrée Strides / Cipla sur production locale</li>
              <li>Volatilité FCFA sur matières premières</li>
              <li>Délais paiement secteur public (90-120j)</li>
            </ul>
          </div>
        </div>
        <div style={{marginTop:14, paddingTop:12, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", lineHeight:1.5}}>
          <strong>Source agrégée :</strong> Synthèse IA · 3 entretiens dirigeants · benchmark sectoriel + revues de presse 2024-2026 · score pertinence 0.78
        </div>
      </Card>
      <Card style={{padding:18}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
          <Target size={16} style={{color:"#534AB7"}}/>
          <span style={{fontSize:13, fontWeight:700}}>Comparables transactionnels</span>
        </div>
        <p style={{fontSize:11, color:"#666", margin:"0 0 14px", lineHeight:1.5}}>Transactions M&A retenues pour la valuation par multiples</p>
        <div style={{display:"flex", padding:"8px 0", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid #F1EFE8"}}>
          <div style={{flex:2}}>Cible</div>
          <div style={{width:55}}>Année</div>
          <div style={{flex:1, textAlign:"right"}}>Mult. EBITDA</div>
          <div style={{flex:1, textAlign:"right"}}>Mult. CA</div>
          <div style={{flex:2}}>Acquéreur</div>
        </div>
        {[
          ["Pharmivoire", "2023", "8.2x", "1.4x", "Investec / Helios IP"],
          ["Cipharm", "2022", "7.5x", "1.2x", "Sanofi (extension capital)"],
          ["Strides Africa", "2024", "9.1x", "1.6x", "Mediterrania Capital"],
          ["Saidal Algérie", "2023", "6.8x", "1.0x", "Algerian Sovereign Fund"],
        ].map((row, i) => (
          <div key={i} style={{display:"flex", padding:"9px 0", fontSize:11, borderBottom:"1px solid #f8f8f6", alignItems:"center"}}>
            <div style={{flex:2, fontWeight:600}}>{row[0]}</div>
            <div style={{width:55, color:"#666"}}>{row[1]}</div>
            <div style={{flex:1, textAlign:"right", color:"#534AB7", fontWeight:700}}>{row[2]}</div>
            <div style={{flex:1, textAlign:"right", color:"#534AB7", fontWeight:700}}>{row[3]}</div>
            <div style={{flex:2, color:"#666", fontSize:10}}>{row[4]}</div>
          </div>
        ))}
        <div style={{marginTop:12, padding:12, background:"#EEEDFE", borderRadius:6}}>
          <div style={{fontSize:11, color:"#534AB7", marginBottom:4}}>
            <strong>Médiane comparable :</strong> 7,9x EBITDA · 1,3x CA
          </div>
          <div style={{fontSize:11, color:"#534AB7"}}>
            <strong>Implication {mandat.short} :</strong> 12,0 - 15,0M USD pré-money (médiane 13,2M)
          </div>
        </div>
        <div style={{marginTop:14, paddingTop:12, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", lineHeight:1.5}}>
          <strong>Source agrégée :</strong> Mergermarket Africa · AVCA Annual Report 2024 · 4 transactions retenues sur 12 identifiées · score pertinence 0.92
        </div>
      </Card>
    </div>
  );
}

function SourcesPage({mandat, docs}) {
  return (
    <div style={{padding:20, maxWidth:680}}>
      <h3 style={{margin:"0 0 4px", fontSize:16}}>Sources & références</h3>
      <div style={{fontSize:11, color:"#888", marginBottom:14}}>Toutes les sources mobilisées pour la production de l'IM</div>
      <Card style={{padding:14, marginBottom:10}}>
        <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>Documents fournis par le mandant ({docs.length})</div>
        {docs.map(d => (
          <div key={d.id} style={{display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #f8f8f6", fontSize:11}}>
            <span>{d.name}</span>
            <span style={{color:"#888"}}>{d.pages}p · {d.date}</span>
          </div>
        ))}
      </Card>
      <Card style={{padding:14, marginBottom:10}}>
        <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>Sources externes utilisées</div>
        {[
          ["IFC — Africa Pharma Sector Review", "2024", "§5 Concurrence"],
          ["BCEAO — Statistiques bancaires UEMOA", "Q1 2026", "§7 États fin."],
          ["Endeavor Insight — Pharma West Africa", "2023", "§5 Marché"],
          ["DGI Côte d'Ivoire — Annuaire fiscal", "2025", "§7 Conformité"],
          ["WHO Pharma Production Africa", "2024", "§4 Services"],
        ].map(([n, y, ref], i) => (
          <div key={i} style={{display:"flex", padding:"5px 0", borderBottom:"1px solid #f8f8f6", fontSize:11}}>
            <div style={{flex:2}}>{n}</div>
            <div style={{flex:1, color:"#888"}}>{y}</div>
            <div style={{flex:1, color:"#534AB7", fontWeight:600, fontSize:10}}>{ref}</div>
          </div>
        ))}
      </Card>
      <Card style={{padding:14}}>
        <div style={{fontSize:12, fontWeight:600, marginBottom:8}}>Entretiens réalisés</div>
        {[
          ["J. Diabaté (DG)", "Cadrage stratégique", "12/04"],
          ["A. Touré (DAF)", "Validation chiffres", "14/04"],
          ["S. Konan (Dir. opérations)", "Visite site production", "16/04"],
        ].map(([p, o, d], i) => (
          <div key={i} style={{display:"flex", padding:"5px 0", borderBottom:"1px solid #f8f8f6", fontSize:11}}>
            <div style={{flex:1, fontWeight:600}}>{p}</div>
            <div style={{flex:1, color:"#666"}}>{o}</div>
            <div style={{width:50, color:"#888", textAlign:"right"}}>{d}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function SectionTitle({children, style={}}) {
  return (
    <div style={{borderLeft:"3px solid #534AB7", paddingLeft:10, fontSize:12, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.8, marginBottom:12, ...style}}>
      {children}
    </div>
  );
}

function PreScreenPage({mandat, role, toast}) {
  const [source] = useState("dfi");

  return (
    <div style={{padding:"0 0 20px", background:"#FAFAFA"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #E5E7EB", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#6B7280"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        {/* Card header */}
        <Card style={{padding:24, marginBottom:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18, gap:12, flexWrap:"wrap"}}>
            <div style={{flex:1, minWidth:240}}>
              <div style={{fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8, marginBottom:6}}>PRÉ-SCREENING 360° ENRICHI</div>
              <h2 style={{margin:"0 0 6px", fontSize:26, fontWeight:700, color:"#111827"}}>{mandat.name}</h2>
              <div style={{fontSize:12, color:"#6B7280"}}>{mandat.sector} · {mandat.country} · Deal ref. {mandat.id}</div>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
              <span style={{fontSize:10, color:"#6B7280", fontWeight:600}}>Source</span>
              <Tag>{source}</Tag>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — Activité */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Activité</SectionTitle>
            <p style={{fontSize:13, lineHeight:1.7, color:"#374151", margin:0}}>
              {mandat.name} est un acteur intégré de la chaîne de valeur pharmaceutique en Afrique de l'Ouest, spécialisé dans la production locale de médicaments génériques essentiels (antipaludéens, antibiotiques, anti-infectieux) et leur distribution sur les canaux hospitaliers publics et officinaux privés. La société exploite une unité de production aux normes WHO-GMP à Abidjan, sert les marchés de la zone UEMOA depuis 15 ans, et bénéficie d'une position de leader sur les appels d'offres hospitaliers en Côte d'Ivoire (3e PdM nationale, 14% sur génériques).
            </p>
          </div>

          {/* Section 2 — Actionnariat & Management */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:24}}>
            <div>
              <SectionTitle>Actionnariat</SectionTitle>
              {[
                ["Amidou Kouassi", "72%"],
                ["Fatou Kouassi (épouse)", "18%"],
                ["Management pool (3 pers.)", "10%"],
              ].map(([n, p], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #F3F4F6", fontSize:13}}>
                  <span style={{color:"#374151"}}>{n}</span>
                  <span style={{fontWeight:700, color:"#534AB7"}}>{p}</span>
                </div>
              ))}
              <div style={{fontSize:11, color:"#6B7280", fontStyle:"italic", marginTop:8}}>
                Structure familiale — pas d'investisseur institutionnel
              </div>
            </div>
            <div>
              <SectionTitle>Management clé</SectionTitle>
              {[
                ["A. Kouassi", "DG / Fondateur · 14 ans"],
                ["Dr. B. Traoré", "Dir. Production · 8 ans"],
              ].map(([n, r], i) => (
                <div key={i} style={{padding:"8px 0", borderBottom:"1px solid #F3F4F6"}}>
                  <div style={{fontSize:13, fontWeight:600, color:"#111827"}}>{n}</div>
                  <div style={{fontSize:11, color:"#6B7280", marginTop:2}}>{r}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — KPIs */}
          <div style={{marginBottom:24}}>
            <div style={{display:"flex", gap:10, flexWrap:"wrap", marginBottom:10}}>
              {[
                {label:"CA 2025", value:"2.82", unit:"Mds", sub:"CAGR 18% · 3 ans"},
                {label:"EBITDA retraité", value:"300M", sub:"Marge 10.6% · méd. 12%"},
                {label:"Marge brute", value:"32%", sub:"Q3 · méd. 28%"},
                {label:"Dette nette / EBITDA", value:"0.88x", sub:"seuil <2x"},
              ].map((k, i) => (
                <div key={i} style={{flex:"1 1 180px", padding:16, background:"#fff", borderRadius:8, border:"1px solid #E5E7EB"}}>
                  <div style={{fontSize:11, color:"#6B7280", marginBottom:6}}>{k.label}</div>
                  <div style={{fontSize:24, fontWeight:700, color:"#111827", lineHeight:1.1}}>{k.value}{k.unit && <span style={{fontSize:14, fontWeight:600, color:"#6B7280", marginLeft:4}}>{k.unit}</span>}</div>
                  <div style={{fontSize:11, color:"#6B7280", marginTop:4, fontStyle:"italic"}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <Card style={{padding:16, marginTop:10, borderLeft:"3px solid #534AB7", display:"flex", alignItems:"center", gap:14}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10, color:"#534AB7", fontWeight:700, textTransform:"uppercase", letterSpacing:0.6}}>Ticket recherché</div>
                <div style={{fontSize:12, color:"#6B7280", marginTop:4}}>Equity pure</div>
              </div>
              <div style={{fontSize:28, fontWeight:700, color:"#111827"}}>{mandat.ticket} EUR</div>
            </Card>
          </div>

          {/* Section 4 — Snapshot financier 3 ans */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Snapshot financier 3 ans</SectionTitle>
            <div style={{border:"1px solid #E5E7EB", borderRadius:8, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 14px", fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", borderBottom:"1px solid #E5E7EB", background:"#F9FAFB", letterSpacing:0.5}}>
                <div style={{flex:3}}>Ligne (M FCFA)</div>
                <div style={{flex:1, textAlign:"right"}}>2023</div>
                <div style={{flex:1, textAlign:"right"}}>2024</div>
                <div style={{flex:1, textAlign:"right"}}>2025</div>
              </div>
              {[
                {l:"Chiffre d'affaires net", v:["2 000","2 400","2 820"], bold:true},
                {l:"dont canal public (AO hospitaliers)", v:["1 140","1 440","1 692"], indent:true},
                {l:"dont canal privé (pharmacies)", v:["860","960","1 128"], indent:true},
                {l:"Achats consommés (API + excipients + condit.)", v:["-1 420","-1 656","-1 918"]},
                {l:"Marge brute", v:["580","744","902"], bold:true},
                {l:"Charges de personnel", v:["-160","-200","-245"]},
                {l:"ratio masse salariale / CA", v:["8.0%","8.3%","8.7%"], indent:true, italic:true},
                {l:"Autres charges d'exploitation", v:["-170","-204","-237"]},
                {l:"EBITDA déclaré", v:["250","340","420"], bold:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"9px 14px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #F3F4F6":"none", background:r.bold?"#F9FAFB":"transparent"}}>
                  <div style={{flex:3, paddingLeft:r.indent?16:0, fontWeight:r.bold?600:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#6B7280":"#374151"}}>{r.l}</div>
                  {r.v.map((val, vi) => (
                    <div key={vi} style={{flex:1, textAlign:"right", fontWeight:r.bold?600:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#6B7280":"#111827"}}>{val}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5 — Utilisation des fonds */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Utilisation des fonds</SectionTitle>
            {[
              ["Nouvelle ligne de production", 60],
              ["Expansion Sénégal", 25],
              ["Fonds de roulement", 15],
            ].map(([n, p], i) => (
              <div key={i} style={{marginBottom:10}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:13}}>
                  <span style={{color:"#374151"}}>{n}</span>
                  <span style={{fontWeight:700, color:"#534AB7"}}>{p}%</span>
                </div>
                <Prog value={p} color="#534AB7" h={6}/>
              </div>
            ))}
            <div style={{fontSize:11, color:"#6B7280", fontStyle:"italic", marginTop:10}}>
              CAPEX productif majoritaire — profil mid-market industriel
            </div>
          </div>

          {/* Section 6 — Scénarios retour */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Scénarios retour (5 ans)</SectionTitle>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
              {[
                {label:"BEAR", multiple:"1.8x", irr:"IRR 12%"},
                {label:"BASE", multiple:"2.8x", irr:"IRR 22%"},
                {label:"BULL", multiple:"4.1x", irr:"IRR 33%"},
              ].map((s, i) => (
                <div key={i} style={{padding:16, background:"#fff", border:"1px solid #E5E7EB", borderRadius:8, textAlign:"center"}}>
                  <div style={{fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8}}>{s.label}</div>
                  <div style={{fontSize:26, fontWeight:700, color:"#111827", lineHeight:1.1}}>{s.multiple}</div>
                  <div style={{fontSize:12, color:"#6B7280", marginTop:5}}>{s.irr}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:11, color:"#6B7280", textAlign:"center", marginTop:10, fontStyle:"italic"}}>
              Pre-money indicatif : 10-14M EUR
            </div>
          </div>

          {/* Section 7 — Adéquation thèse */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Adéquation thèse du fonds</SectionTitle>
            {[
              ["Secteur cible", "Match"],
              ["Ticket dans la fourchette", "Match"],
              ["Géographie éligible", "Match"],
              ["CA minimum requis", "Match"],
              ["États financiers certifiés", "Partiel"],
              ["EBITDA positif exigé", "Match"],
            ].map(([crit, status], i, arr) => (
              <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:i<arr.length-1?"1px solid #F3F4F6":"none", fontSize:13}}>
                <span style={{color:"#374151"}}>{crit}</span>
                <Tag v={status==="Match"?"success":"warn"}>{status}</Tag>
              </div>
            ))}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0 0", marginTop:6, borderTop:"1px solid #E5E7EB"}}>
              <span style={{fontSize:13, color:"#6B7280"}}>5/6 critères · Adéquation</span>
              <span style={{fontSize:22, fontWeight:700, color:"#534AB7"}}>83%</span>
            </div>
          </div>

          {/* Section 8 — Red flags */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Red flags SYSCOHADA détectés</SectionTitle>
            {[
              {
                severity:"CRITICAL", color:"#DC2626", bg:"#FEE2E2", border:"#DC2626",
                title:"Concentration client 62% top 3",
                desc:"Seuil d'alerte : 40%. Les 3 clients sont des AO hospitaliers PSP. Atténuation possible si AO récurrents — à vérifier en DD par cartographie détaillée. Si concentration réelle >70% après cartographie → deal breaker, recommandation passe en Hold."
              },
              {
                severity:"HIGH", color:"#D97706", bg:"#FEF3C7", border:"#D97706",
                title:"EBITDA sans rémunération dirigeant identifiée",
                desc:"Masse salariale / CA = 8.75% vs médiane secteur 12%. Écart cohérent avec rémun. non déclarée 80-120M FCFA. Retraitement retenu : 100M (milieu de fourchette) + charges perso 20M = 300M EBITDA retraité (marge 10.6%). Si EBITDA retraité <8% après clarification DD → deal breaker."
              },
              {
                severity:"HIGH", color:"#D97706", bg:"#FEF3C7", border:"#D97706",
                title:"Gouvernance centralisée",
                desc:"Pas de CA formalisé, DG cumule 4 fonctions (DG + DAF + relation clients + signataire bancaire unique), PV AG 2024-2025 absents. Corrigeable en 100 jours post-closing avec plan de structuration validé par fondateur."
              },
            ].map((f, i) => (
              <div key={i} style={{padding:16, background:"#fff", borderRadius:8, borderLeft:`3px solid ${f.border}`, border:`1px solid #E5E7EB`, marginBottom:10}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:10}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, flex:1}}>
                    <span style={{color:f.color, fontSize:14, fontWeight:700}}>✕</span>
                    <span style={{fontSize:13, fontWeight:700, color:"#111827"}}>{f.title}</span>
                  </div>
                  <span style={{padding:"2px 8px", borderRadius:4, fontSize:10, fontWeight:700, color:f.color, background:f.bg, letterSpacing:0.5, flexShrink:0}}>{f.severity}</span>
                </div>
                <div style={{fontSize:12, color:"#374151", lineHeight:1.6, paddingLeft:22}}>
                  <strong style={{color:"#111827"}}>Conséquence :</strong> {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Section 9 — Qualité du dossier documentaire */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Qualité du dossier documentaire</SectionTitle>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {[
                {cat:"Financier", level:"N2", color:"#16A34A", items:[["Liasses SYSCOHADA 3 ans","ok"],["Relevés bancaires 12m","ok"],["Budget prévisionnel","ok"],["Audit / certification","warn"]]},
                {cat:"Juridique", level:"N2", color:"#16A34A", items:[["Statuts","ok"],["RCCM","ok"],["Fiscal / CNPS","ok"],["PV AG récent","ko"]]},
                {cat:"Commercial", level:"N1", color:"#D97706", items:[["Pitch deck","ok"],["BP / projections","ok"],["Liste clients top 10","ko"],["Contrats clés","ko"]]},
                {cat:"RH / Gouv.", level:"N0", color:"#DC2626", items:[["Organigramme","ko"],["CV dirigeants","ko"],["Pacte d'actionnaires","ko"],["Règlement intérieur","ko"]]},
              ].map((col, i) => (
                <div key={i} style={{padding:14, background:"#fff", borderRadius:8, border:"1px solid #E5E7EB"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                    <span style={{fontSize:12, fontWeight:700, color:"#111827"}}>{col.cat}</span>
                    <span style={{padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, color:col.color, background:col.color==="#16A34A"?"#DCFCE7":col.color==="#D97706"?"#FEF3C7":"#FEE2E2"}}>{col.level}</span>
                  </div>
                  {col.items.map(([l, s], j) => (
                    <div key={j} style={{display:"flex", alignItems:"center", gap:6, padding:"5px 0", fontSize:11}}>
                      <span style={{fontSize:11, fontWeight:700, color:s==="ok"?"#16A34A":s==="warn"?"#D97706":"#DC2626", flexShrink:0}}>{s==="ok"?"✓":s==="warn"?"⚠":"✗"}</span>
                      <span style={{color:s==="ko"?"#6B7280":"#374151"}}>{l}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{marginTop:14, padding:12, background:"#EEEDFE", borderRadius:6, fontSize:12, color:"#534AB7", textAlign:"center", fontWeight:600}}>
              Score qualité global : N1.5 — 8 documents fournis / 16 attendus
            </div>
          </div>

          {/* Section 10 — Benchmark sectoriel */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Benchmark sectoriel</SectionTitle>
            <div style={{border:"1px solid #E5E7EB", borderRadius:8, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 14px", fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", borderBottom:"1px solid #E5E7EB", background:"#F9FAFB", letterSpacing:0.5}}>
                <div style={{flex:2}}>Ratio</div>
                <div style={{flex:1, textAlign:"right"}}>{mandat.short}</div>
                <div style={{flex:1, textAlign:"right"}}>Médiane</div>
                <div style={{flex:1, textAlign:"right"}}>Quartile</div>
              </div>
              {[
                ["Marge brute", "32%", "28%", "Q3"],
                ["Marge EBITDA", "15%", "12%", "Q3"],
                ["EBITDA retraité", "10.6%", "12%", "Q2"],
                ["BFR / CA", "17.4%", "18%", "Q3"],
                ["Croiss. CA 3 ans", "+18%", "+10%", "Q4"],
              ].map(([r, c, m, q], i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 14px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #F3F4F6":"none", alignItems:"center"}}>
                  <div style={{flex:2, color:"#374151"}}>{r}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600, color:"#111827"}}>{c}</div>
                  <div style={{flex:1, textAlign:"right", color:"#6B7280"}}>{m}</div>
                  <div style={{flex:1, textAlign:"right"}}>
                    <span style={{padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:700, color:"#3B82F6", background:"#E0F2FE"}}>{q}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:8, fontSize:11, color:"#6B7280", lineHeight:1.5, fontStyle:"italic"}}>
              Source : knowledge_benchmarks pharma UEMOA · IFC 2024 · 14 entreprises · score pertinence 0.95
            </div>
          </div>

          {/* Section 11 — Recommandation analyste */}
          <div>
            <SectionTitle>Recommandation analyste</SectionTitle>
            <div style={{padding:18, background:"#EEEDFE", borderRadius:8}}>
              <div style={{padding:"4px 12px", borderRadius:4, fontSize:11, fontWeight:700, color:"#534AB7", background:"#fff", display:"inline-block", marginBottom:14, letterSpacing:0.4}}>
                GO CONDITIONNEL — conviction modérée
              </div>
              <p style={{fontSize:13, lineHeight:1.7, color:"#374151", margin:"0 0 16px"}}>
                Le dossier présente une thèse industrielle solide (croissance 1,8x médiane sectorielle, position de marché établie, équipe stable) mais soulève trois zones de risque qui doivent être adressées avant tout passage en comité. La concentration client est le point de vigilance majeur — atténuable si les AO hospitaliers sont confirmés récurrents. L'EBITDA retraité reste juste sous la médiane sectorielle après clarification de la rémunération dirigeant. La gouvernance familiale est corrigeable dans une feuille de route 100 jours post-closing.
              </p>
              <div style={{fontSize:13, fontWeight:700, color:"#111827", marginBottom:10}}>Trois conditions préalables au passage en IC1 :</div>
              {[
                {label:"Condition 1", text:"Cartographie clients top 10 avec ancienneté, récurrence des AO et part de chaque client. Concentration <55% top 3 attendue après analyse fine."},
                {label:"Condition 2", text:"Confirmation de la rémunération dirigeant retraitée par audit ou certification du commissaire aux comptes. EBITDA retraité ≥8% à valider."},
                {label:"Condition 3", text:"Engagement écrit du fondateur sur le plan de structuration de gouvernance 100 jours (CA formalisé, séparation DG/DAF, ouverture pacte)."},
              ].map((c, i) => (
                <div key={i} style={{display:"flex", gap:10, alignItems:"flex-start", padding:"10px 0", borderTop:i>0?"1px solid rgba(83,74,183,0.15)":"none"}}>
                  <span style={{padding:"3px 9px", borderRadius:4, fontSize:10, fontWeight:700, background:"#fff", color:"#6B7280", flexShrink:0, marginTop:1}}>{c.label}</span>
                  <span style={{fontSize:12, color:"#374151", lineHeight:1.6}}>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ResumeExecutifPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 1);

  // Résumé exécutif toujours affiché, indépendamment du statut de validation des autres sections.
  // Le contenu est généré à partir des autres sections en l'état (validées ou non).
  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Résumé exécutif</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* Section 1 — KPIs ligne 1 (5 cartes) */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8, marginBottom:8}}>
            {[
              {label:"CA 2025", value:"2.41 Mds", sub:"CAGR 18% · 1 an disponible", nd:false, color:"#534AB7"},
              {label:"EBITDA 2025", value:"520M", sub:"Marge 21.6% · méd. ~17% [non vérifié DD]", nd:false, color:"#185FA5"},
              {label:"Résultat net", value:"290M", sub:"Marge nette 12.0%", nd:false, color:"#1D9E75"},
              {label:"Dette nette / EBITDA", value:"n/d", sub:"n/d — bilan non renseigné", nd:true},
              {label:"Ticket", value:"n/d", sub:"n/d — structuration en cours", nd:true},
            ].map((k, i) => (
              <div key={i} style={{padding:14, background:"#fff", borderRadius:8, border:"1px solid #F1EFE8"}}>
                <div style={{fontSize:10, color:"#888", marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:k.nd?16:18, fontWeight:700, color:k.nd?"#aaa":k.color}}>{k.value}</div>
                <div style={{fontSize:10, color:"#888", marginTop:3, lineHeight:1.4}}>{k.sub}</div>
              </div>
            ))}
          </div>
          {/* KPIs ligne 2 (2 cartes plus larges) */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:24}}>
            {[
              {label:"Pre-money", value:"n/d", sub:"n/d — valorisation non calculée"},
              {label:"MOIC base", value:"n/d", sub:"n/d — projections non disponibles"},
            ].map((k, i) => (
              <div key={i} style={{padding:14, background:"#fff", borderRadius:8, border:"1px solid #F1EFE8"}}>
                <div style={{fontSize:10, color:"#888", marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:18, fontWeight:700, color:"#aaa"}}>{k.value}</div>
                <div style={{fontSize:10, color:"#888", marginTop:3, lineHeight:1.4}}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Section 2 — Présentation de la cible */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:15, color:"#534AB7", fontWeight:700}}>Présentation de la cible</h3>
            <div style={{padding:14, background:"#fafaf7", borderLeft:"3px solid #534AB7", borderRadius:"0 6px 6px 0"}}>
              <p style={{margin:0, fontSize:12.5, lineHeight:1.7, color:"#333"}}>
                CleanWater Ouaga est un acteur émergent du secteur eau et assainissement au Burkina Faso, opérant principalement dans la zone de Ouagadougou et sa périphérie. La société conçoit et déploie des unités de potabilisation décentralisées et des systèmes d'assainissement modulaires destinés aux collectivités locales, aux établissements scolaires et aux centres de santé. Fondée en 2018, elle opère sur un marché structurellement sous-équipé : moins de 50% de la population sahélienne a accès à une eau potable conforme aux normes OMS, et l'État burkinabè a inscrit l'accès universel à l'eau dans son Plan National de Développement Économique et Social.
              </p>
            </div>
          </div>

          {/* Section 3 — Thèse en 5 points */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Thèse d'investissement en 5 points</h3>
            {[
              {n:1, title:"Demande structurelle irréversible dans un marché sous-équipé", text:"Le déficit d'infrastructures eau & assainissement en Afrique sahélienne représente un besoin annuel de plusieurs milliards USD, soutenu par les bailleurs publics (BAD, BM, AFD) et les programmes Team Europe. La croissance démographique (+2,9%/an au Burkina) et l'urbanisation accélérée garantissent une demande pérenne.", note:"[non vérifié DD]"},
              {n:2, title:"Position de niche défensive sur un savoir-faire technique local", text:"L'équipe a développé une compétence d'ingénierie locale qui permet d'opérer dans des zones où les acteurs internationaux peinent à intervenir (logistique, maintenance, paiement). Les barrières à l'entrée sont moyennes mais l'avantage local est durable sur un horizon 5-7 ans.", note:""},
              {n:3, title:"Croissance double-digit avec récurrence partielle", text:"CAGR 18% sur le CA disponible, avec une part croissante de contrats récurrents (maintenance + suivi qualité). Le mix vise 40% de CA récurrent à horizon 2028.", note:"[1 année de données seulement]"},
              {n:4, title:"Marges supérieures à la médiane sectorielle", text:"Marge EBITDA déclarée 21,6% vs médiane sectorielle estimée 17%. Profil cohérent avec un acteur en phase de scale-up bénéficiant d'un effet de levier opérationnel sur ses unités déployées.", note:"[non vérifié DD]"},
              {n:5, title:"Alignement ESG et impact mesurable (ODD 6)", text:"Le projet contribue directement à l'ODD 6 (Eau propre et assainissement) avec des indicateurs d'impact mesurables (nombre de bénéficiaires, m³ d'eau potabilisée, écoles équipées). Forte appétence attendue des LP DFI européens (Proparco, BIO, FMO).", note:""},
            ].map(p => (
              <div key={p.n} style={{padding:"12px 0", borderBottom:p.n<5?"1px solid #f8f8f6":"none"}}>
                <div style={{fontSize:13, fontWeight:700, color:"#333", marginBottom:6}}>{p.n}. {p.title}</div>
                <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
                  {p.text}
                  {p.note && <span style={{fontStyle:"italic", color:"#888", marginLeft:6}}>{p.note}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Section 4 — Recommandation formelle */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:15, fontWeight:700}}>Recommandation formelle</h3>
            <div style={{padding:"6px 14px", borderRadius:14, fontSize:12, fontWeight:700, color:"#BA7517", background:"#FFF5E0", display:"inline-block", marginBottom:12, letterSpacing:0.4}}>
              HOLD — données insuffisantes pour statuer
            </div>
            <p style={{fontSize:12, lineHeight:1.7, color:"#333", margin:"0 0 12px"}}>
              Le dossier présente une thèse industrielle attractive et un alignement ESG fort, mais l'absence de données financières structurées (bilan, BFR, projections) ne permet pas de produire une recommandation GO à ce stade. Le passage en IC1 nécessite la complétion préalable du dossier documentaire et la conduite d'une due diligence financière chiffrée.
            </p>
            <div style={{padding:10, background:"#fafaf7", borderRadius:6, marginBottom:12, fontSize:11.5, color:"#444"}}>
              <div style={{marginBottom:4}}><strong>Score d'adéquation thèse :</strong> non calculable — sections insuffisantes.</div>
              <div><strong>Score ESONO :</strong> n/d/100 (seuil mid-market : 65) · Score avant pénalités : n/d/100</div>
            </div>
            <div style={{fontSize:12, fontWeight:700, color:"#333", marginBottom:10}}>Trois conditions préalables au passage en IC1 :</div>
            {[
              {n:"(1)", text:"Production des états financiers SYSCOHADA complets sur 3 ans (compte de résultat + bilan détaillé) certifiés ou revus par un commissaire aux comptes inscrit OEC-BF."},
              {n:"(2)", text:"Cartographie clients top-10 avec ancienneté, récurrence, part de CA et type de contrat (privé / institutionnel / bailleur). Concentration top-3 cible <55%."},
              {n:"(3)", text:"Business plan 5 ans (P&L + cash-flow + bilan prévisionnel) avec hypothèses détaillées et scénarios sensibilité (volume / prix / délai paiement public)."},
            ].map((c, i) => (
              <div key={i} style={{display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderTop:i>0?"1px solid #f8f8f6":"none"}}>
                <span style={{padding:"3px 9px", borderRadius:10, fontSize:11, fontWeight:700, background:"#fafaf7", border:"1px solid #d0cfc8", color:"#666", flexShrink:0, marginTop:1}}>{c.n}</span>
                <span style={{fontSize:11.5, color:"#444", lineHeight:1.6}}>{c.text}</span>
              </div>
            ))}
          </div>

          {/* Section 5 — 1 red flag actif */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:15, fontWeight:700}}>1 red flag actif</h3>
            <div style={{padding:14, background:"#FBE6DC", borderRadius:8, borderLeft:"3px solid #D85A30", display:"flex", gap:10, alignItems:"flex-start"}}>
              <span style={{color:"#A32D2D", fontSize:14, fontWeight:700, flexShrink:0, marginTop:1}}>✕</span>
              <div style={{flex:1, fontSize:11.5, color:"#333", lineHeight:1.6}}>
                <strong style={{color:"#A32D2D"}}>Concentration clients 62% top 3.</strong> Les trois principaux clients sont des entités publiques (Ministère de l'Eau, ONEA, programme Eau Pour Tous) et représentent 62% du CA 2025. Risque de dépendance budgétaire sur des cycles de financement publics (12-18 mois) avec délais de paiement structurellement longs.
              </div>
            </div>
          </div>

          {/* Section 6 — 2 points à monitorer */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:15, fontWeight:700}}>2 points à monitorer</h3>
            <ul style={{margin:0, paddingLeft:20, fontSize:12, color:"#444", lineHeight:1.8}}>
              <li>Concentration top-3 clients à 62% du CA 2025 — à reventiler par type de client (institutionnel / bailleur / privé) et par récurrence contractuelle.</li>
              <li>Structure bilancielle, ratio d'endettement et BFR non disponibles — la solidité financière ne peut pas être évaluée tant que le bilan détaillé n'est pas fourni.</li>
            </ul>
          </div>

          {/* Section 7 — Deal breakers */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:14, fontWeight:700}}>Deal breakers identifiés :</h3>
            <ul style={{margin:"0 0 12px", paddingLeft:20, fontSize:12, color:"#444", lineHeight:1.8}}>
              <li><strong>EBITDA retraité &lt; 8%</strong> après prise en compte de la rémunération dirigeant non déclarée et des charges privées identifiables. Si la marge réelle tombe sous ce seuil, la valorisation cible devient incompatible avec la fourchette mandat.</li>
              <li><strong>Concentration clients &gt; 70% top-3</strong> après cartographie détaillée. Au-delà de ce seuil, le risque de dépendance budgétaire publique devient incompatible avec le profil de risque mid-market visé par les LP du fonds.</li>
            </ul>
            <p style={{margin:0, fontSize:11.5, color:"#666", fontStyle:"italic", lineHeight:1.6}}>
              Ces deux deal breakers peuvent être levés ou confirmés à l'issue de la due diligence financière et commerciale. À ce stade, ils constituent des seuils de vigilance à valider avant tout engagement formel.
            </p>
          </div>

          {/* Section 8 — Notes complémentaires */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Notes complémentaires</h3>
            <div style={{fontSize:12, lineHeight:1.7, color:"#444"}}>
              <p style={{margin:"0 0 12px"}}>
                <strong>Présentation de la cible.</strong> CleanWater Ouaga a été créée en 2018 par Amidou Kouassi (DG, ingénieur hydraulicien formé à l'EIER de Ouagadougou) avec un capital initial de 25M FCFA. La société emploie 32 personnes dont 18 sur la production et la maintenance, 8 commerciaux et 6 fonctions support. Elle dispose d'un atelier d'assemblage à Ouagadougou et d'un dépôt logistique à Bobo-Dioulasso pour couvrir l'ouest du pays.
              </p>
              <p style={{margin:"0 0 12px"}}>
                <strong>Profil financier.</strong> Sur la base des éléments transmis (compte de résultat 2025 uniquement), la société présente un CA de 2,41 Mds FCFA, un EBITDA de 520M (marge 21,6%) et un résultat net de 290M (marge nette 12,0%). Ces chiffres sont déclaratifs et doivent être confirmés par audit ou certification d'un commissaire aux comptes indépendant. L'absence de bilan, de BFR et de tableau de flux empêche tout exercice de valorisation à ce stade.
              </p>
              <p style={{margin:"0 0 12px"}}>
                <strong>Thèse préliminaire.</strong> Le dossier présente une attractivité thématique forte (ODD 6, demande sahélienne en eau potable, alignement avec les priorités des bailleurs européens et multilatéraux) et un potentiel de scale-up régional vers Mali, Niger et Tchad. La thèse repose sur la capacité de l'équipe à industrialiser un savoir-faire local et à diversifier sa clientèle au-delà du segment institutionnel.
              </p>
              <p style={{margin:0}}>
                <strong>Recommandation et conditions.</strong> Recommandation HOLD à ce stade — le dossier mérite d'être instruit en profondeur mais ne peut pas être présenté en IC1 sans complétion documentaire. Une fois les trois conditions ci-dessus levées, le dossier pourra être ré-évalué et faire l'objet d'une note de présentation IC1 complète, incluant valorisation indicative, structuration proposée et plan d'engagement post-closing.
              </p>
            </div>
          </div>

          {/* Section 9 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "K. N'Guessan (MD)"],
                ["Data par", "S. Koné (Analyste)"],
                ["Version", "IC1 (draft)"],
                ["Dernière génération", "16 avr."],
                ["Score memo", "68/100"],
                ["Sections rédigées", "3/12"],
                ["Validées IM", "4/12"],
                ["Validées MD", "2/12"],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Cette version IC1 est un brouillon en cours de rédaction. Les sections en cours d'instruction sont susceptibles d'évoluer après les retours de la DD.
              <br/>
              Auto-génération à partir des sections §2-§13 validées. Les chiffres marqués [non vérifié DD] doivent être confirmés en due diligence.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · il y a 11 min
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
}

function ActionnariatGouvernancePage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 2);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Actionnariat & gouvernance</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — Actionnariat et gouvernance */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Actionnariat et gouvernance</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Table de capitalisation</h3>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14}}>
              {[
                {
                  name:"Amidou Kouassi", pct:"72%", type:"Ordinaire", year:"2012",
                  body:"Fondateur, DG opérationnel. Ex-Cipharm (3 ans), ex-CHU Cocody (4 ans). Cumule DG + DAF + signataire bancaire unique.",
                  highlight:true,
                },
                {
                  name:"Fatou Kouassi (épouse)", pct:"18%", type:"Ordinaire", year:"2012",
                  body:"Famille. Pas de rôle opérationnel identifié dans l'entreprise. Présente aux AG (quand elles ont lieu).",
                  highlight:false,
                },
                {
                  name:"Management pool (3 pers.)", pct:"10%", type:"Ordinaire", year:"2020",
                  body:"Dr. B. Traoré (Dir. Production), M. Diarra (Dir. Commercial), Resp. logistique. Mécanisme d'attribution non documenté — à clarifier en DD.",
                  highlight:false,
                },
              ].map((s, i) => (
                <Card key={i} style={{padding:14, background:s.highlight?"#EEEDFE":"#fff", borderLeft:s.highlight?"3px solid #534AB7":"1px solid #F1EFE8"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:6}}>
                    <div style={{fontSize:12, fontWeight:700, color:"#333", lineHeight:1.3}}>{s.name}</div>
                    <div style={{fontSize:14, fontWeight:700, color:"#534AB7", flexShrink:0}}>{s.pct}</div>
                  </div>
                  <div style={{fontSize:10, color:"#888", marginBottom:10, display:"flex", gap:8, flexWrap:"wrap"}}>
                    <span>{s.type}</span>
                    <span>·</span>
                    <span>entré en {s.year}</span>
                  </div>
                  <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{s.body}</p>
                </Card>
              ))}
            </div>

            <p style={{margin:"0 0 12px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Structure familiale classique des PME industrielles UEMOA — concentration capitalistique sur le couple fondateur (90% des parts), pool managérial limité à 10% sans formalisation contractuelle. Aucun investisseur institutionnel présent au capital. Cette configuration est typique de sociétés en phase de pré-institutionnalisation et appelle un travail de structuration de la table de capitalisation avant tout closing.
            </p>

            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              <strong>Historique des modifications du capital.</strong> Création en 2012 avec un capital initial de 10M FCFA détenu à 80% par A. Kouassi et 20% par F. Kouassi. Augmentation de capital en 2015 (passage à 50M FCFA) avec maintien des proportions. Allocation de 10% au pool de management en 2020 par cession de parts du DG (réduction de sa quote-part de 80% à 72%) — opération non documentée par acte de cession formel, à régulariser. Aucune autre modification depuis.
            </p>
          </div>

          {/* Section 2 — Organes de gouvernance */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Organes de gouvernance — état actuel</h3>
            {[
              {
                title:"Conseil d'administration :",
                body:"Aucun CA formalisé à ce jour. Les statuts mentionnent la possibilité d'instituer un conseil mais celui-ci n'a jamais été constitué. Les décisions stratégiques sont prises de manière informelle par le DG-fondateur, parfois en concertation avec son épouse. Aucun procès-verbal de réunion stratégique n'a été produit.",
              },
              {
                title:"Assemblées générales :",
                body:"Les AG ordinaires des exercices 2024 et 2025 n'ont pas fait l'objet de procès-verbaux formalisés. Les comptes annuels n'ont pas été déposés au greffe du tribunal de commerce dans les délais réglementaires. Une régularisation est à programmer en priorité dans les 100 jours post-closing pour mettre la société en conformité avec l'Acte Uniforme OHADA.",
              },
              {
                title:"Commissaire aux comptes :",
                body:"Aucun commissaire aux comptes désigné, alors que les seuils OHADA imposent cette désignation pour les SARL dépassant 250M FCFA de CA ou 50 salariés. La société est en infraction depuis 2023. Désignation prioritaire d'un CAC inscrit OEC-CI à formaliser avant la première AG de régularisation.",
              },
              {
                title:"Contrôle interne :",
                body:"Pas de procédures formalisées de contrôle interne. Pas de séparation des fonctions (le DG est à la fois engagement, paiement et contrôle bancaire). Pas de cartographie des risques opérationnels documentée. Le contrôle de gestion est tenu en Excel par le DG lui-même, sans validation indépendante.",
              },
            ].map((g, i) => (
              <div key={i} style={{padding:"10px 0", borderBottom:i<3?"1px solid #f8f8f6":"none"}}>
                <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:5}}>{g.title}</div>
                <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>{g.body}</p>
              </div>
            ))}
          </div>

          {/* Section 3 — Conventions réglementées */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Conventions réglementées identifiées</SectionTitle>
            {[
              {
                status:"confirmée",
                title:"Convention 1 — Bail commercial",
                body:"PharmaCi SARL loue ses locaux d'exploitation (siège + atelier de production, 1 800 m²) à la SCI Kouassi, société civile détenue à 100% par A. Kouassi. Le loyer annuel s'élève à 36M FCFA, soit ~1,3% du CA 2025. Convention non soumise à validation en AG des associés. Niveau de loyer cohérent avec le marché abidjanais (à benchmarker en DD).",
              },
              {
                status:"suspectée",
                title:"Convention 2 — Véhicule de fonction",
                body:"Véhicule Toyota Land Cruiser apparaissant à l'actif immobilisé pour 28M FCFA, dont l'usage est principalement personnel selon les déclarations du DG. Frais d'entretien et carburant pris en charge par la société pour environ 4M FCFA/an. À retraiter en EBITDA (cf. red flag §1) et à régulariser par contrat d'usage privé ou cession à titre personnel.",
              },
            ].map((c, i) => (
              <div key={i} style={{padding:14, background:"#FBE6DC", borderRadius:8, borderLeft:"3px solid #D85A30", marginBottom:10, display:"flex", gap:10, alignItems:"flex-start"}}>
                <span style={{color:"#A32D2D", fontSize:14, fontWeight:700, flexShrink:0, marginTop:1}}>✕</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:4, flexWrap:"wrap"}}>
                    <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{c.title}</span>
                    <span style={{fontSize:10, color:"#A32D2D", fontWeight:600, textTransform:"uppercase", letterSpacing:0.4, fontStyle:"italic"}}>({c.status})</span>
                  </div>
                  <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Section 4 — Red flags gouvernance */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Red flags gouvernance détectés</SectionTitle>
            {[
              {
                title:"Gouvernance centralisée",
                severity:"HIGH", color:"#BA7517", bg:"#FFF8F0", border:"#BA7517",
                body:"Pas de CA formalisé, cumul DG / DAF / signataire bancaire unique sur la personne du fondateur. Aucun mécanisme de contrôle indépendant, aucune validation collégiale des décisions d'investissement supérieures à un seuil défini. Risque de continuité opérationnelle en cas d'indisponibilité du fondateur. Corrigeable en 100 jours post-closing avec plan de structuration.",
              },
              {
                title:"Homme-clé",
                severity:"HIGH", color:"#BA7517", bg:"#FFF8F0", border:"#BA7517",
                body:"1 personne = DG + DAF + seul contact clients institutionnels + signataire bancaire unique. Concentration des relations avec les 3 clients principaux (CHU Cocody, Pharmacie Centrale, AO PSP) dans la main du fondateur. Aucun successeur identifié, aucune assurance homme-clé en place, aucun plan de continuité documenté.",
              },
            ].map((f, i) => (
              <div key={i} style={{padding:14, background:f.bg, borderRadius:8, borderLeft:`3px solid ${f.border}`, marginBottom:10}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:10}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, flex:1}}>
                    <span style={{color:f.color, fontSize:14, fontWeight:700}}>✕</span>
                    <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{f.title}</span>
                  </div>
                  <span style={{padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:f.color, letterSpacing:0.5, flexShrink:0}}>{f.severity}</span>
                </div>
                <div style={{fontSize:11.5, color:"#444", lineHeight:1.6, paddingLeft:22}}>{f.body}</div>
              </div>
            ))}
          </div>

          {/* Section 5 — Plan de structuration */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 6px", fontSize:15, fontWeight:700}}>Plan de structuration post-investissement — convenu avec le fondateur</h3>
            <div style={{fontSize:11.5, color:"#888", marginBottom:14}}>Le fondateur a validé les 6 points suivants lors de l'entretien du 8 avril :</div>
            {[
              {n:1, title:"Formalisation CA 3 membres", target:"100 jours", body:"Constitution d'un Conseil d'administration de 3 membres : le fondateur, un administrateur indépendant proposé par le fonds, un représentant des minoritaires (pool managérial). Réunions trimestrielles obligatoires."},
              {n:2, title:"Recrutement DAF", target:"Budget 15M FCFA/an", body:"Recrutement d'un Directeur Administratif et Financier dédié, séparation des fonctions DG/DAF. Profil cible : 8-12 ans d'expérience, comptabilité SYSCOHADA, contrôle de gestion industriel."},
              {n:3, title:"Double signature bancaire", target:"DG + DAF", body:"Mise en place d'une double signature bancaire obligatoire au-delà d'un seuil de 5M FCFA. Suppression de la signature unique du DG. Refonte des conventions bancaires avec NSIA et SIB."},
              {n:4, title:"Régularisation AG", target:"6 mois", body:"Régularisation des AG ordinaires 2024 et 2025, dépôt des comptes annuels au greffe, désignation d'un commissaire aux comptes inscrit OEC-CI. Mise en conformité avec l'Acte Uniforme OHADA."},
              {n:5, title:"Séparation comptes perso/pro", target:"Immédiat", body:"Cessation de l'usage privé du véhicule Toyota Land Cruiser, formalisation contractuelle ou cession personnelle. Identification et facturation explicite de toute prestation entre la société et la SCI Kouassi."},
              {n:6, title:"Assurance homme-clé", target:"Avant closing", body:"Souscription d'une police d'assurance homme-clé sur la personne du fondateur, plafond 500M FCFA, couvrant invalidité et décès. Plan de continuité opérationnelle documenté avec délégations identifiées."},
            ].map(p => (
              <div key={p.n} style={{display:"flex", gap:12, alignItems:"flex-start", padding:"10px 0", borderBottom:p.n<6?"1px solid #f8f8f6":"none"}}>
                <span style={{padding:"3px 9px", borderRadius:10, fontSize:11, fontWeight:700, background:"#EEEDFE", color:"#534AB7", flexShrink:0, marginTop:1}}>{p.n}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex", justifyContent:"space-between", gap:10, marginBottom:4, alignItems:"baseline", flexWrap:"wrap"}}>
                    <span style={{fontSize:12.5, fontWeight:700, color:"#333"}}>{p.title}</span>
                    <span style={{fontSize:10, color:"#888", fontStyle:"italic"}}>{p.target}</span>
                  </div>
                  <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Section 6 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Cette version IC1 est un brouillon en cours de rédaction. Le plan de structuration post-investissement a été validé verbalement par le fondateur le 8 avril, mais doit être formalisé par lettre d'engagement avant le passage en IC1.
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function TopManagementPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 3);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Top management</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — Organisation interne et top management */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Organisation interne et top management</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Équipe dirigeante — profils et évaluation</h3>

            {[
              {
                initials:"AK", name:"A. Kouassi", role:"DG / Fondateur", years:"14 ans",
                body:"Pharmacien diplômé Université Cocody (2008). 4 ans pharmacien hospitalier CHU Cocody (2008-2012), puis 3 ans Cipharm en tant que responsable production avant de fonder PharmaCi en 2012 avec un capital initial de 10M FCFA. Profil technique + commercial + entrepreneurial rare sur le marché ouest-africain. Cumule aujourd'hui DG + DAF + relation clients institutionnels + signataire bancaire — risque homme-clé à traiter en priorité dans les 100 jours post-closing.",
                bg:"#EEEDFE", border:"#534AB7", badge:"DG",
              },
              {
                initials:"BT", name:"Dr. B. Traoré", role:"Dir. Production", years:"8 ans",
                body:"Pharmacien industriel, Université de Bamako (2014). Certifié inspecteur BPF (Bonnes Pratiques de Fabrication) WHO-GMP en 2018. A piloté la mise en conformité de l'unité de production aux normes WHO-GMP entre 2019 et 2021. Gère 12 ouvriers production + 4 techniciens contrôle qualité. Homme clé côté production — sans lui, la certification BPF serait mise en risque immédiat.",
                bg:"#fafaf7", border:"#185FA5", badge:"PROD",
              },
              {
                initials:"MD", name:"M. Diarra", role:"Dir. Commercial", years:"6 ans",
                body:"Ex-commercial Sanofi Afrique de l'Ouest (2012-2020) avec 8 ans d'expérience sur les marchés CI/SN/BF. Recruté en 2020 pour structurer la fonction commerciale et accélérer la conquête d'AO. A triplé le nombre d'AO remportés en 3 ans (de 4 à 12) et porté la part de CA hospitalier de 32% à 60%. Son réseau au Sénégal est l'atout clé pour l'expansion régionale prévue 2027-2028.",
                bg:"#fafaf7", border:"#1D9E75", badge:"COM",
              },
            ].map((p, i) => (
              <Card key={i} style={{padding:14, background:p.bg, borderLeft:`3px solid ${p.border}`, marginBottom:10}}>
                <div style={{display:"flex", gap:14, alignItems:"flex-start"}}>
                  {/* Avatar */}
                  <div style={{width:46, height:46, borderRadius:23, background:p.border, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, flexShrink:0}}>
                    {p.initials}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:6, flexWrap:"wrap"}}>
                      <div style={{display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap"}}>
                        <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{p.name}</span>
                        <span style={{fontSize:11, color:"#666"}}>— {p.role}</span>
                      </div>
                      <span style={{fontSize:11, color:"#888", fontWeight:600}}>{p.years}</span>
                    </div>
                    <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{p.body}</p>
                  </div>
                </div>
              </Card>
            ))}

            <p style={{margin:"14px 0 0", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Les 3 compétences critiques du secteur pharma sont couvertes : production aux normes BPF (Dr. Traoré), commercialisation hospitalière et institutionnelle (M. Diarra), pilotage stratégique et relations partenaires (A. Kouassi). L'équipe a démontré sa capacité à scaler un acteur de niche en leader régional sur 14 ans, mais reste dimensionnée pour la phase actuelle. Les fonctions support (DAF, DRH, juridique) sont aujourd'hui assurées de manière partagée et insuffisamment professionnalisée pour absorber la croissance projetée.
            </p>
          </div>

          {/* Section 2 — Postes clés vacants */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Postes clés vacants — plan de recrutement budgété</h3>
            {[
              {
                title:"DAF — Directeur Administratif et Financier",
                priority:"Priorité 1", deadline:"100 jours post-closing", color:"#D85A30", bg:"#FBE6DC",
                body:"Rupture du cumul DG/DAF. Profil cible : 8-12 ans d'expérience en environnement industriel UEMOA, maîtrise SYSCOHADA, contrôle de gestion analytique, reporting investor. Idéalement issu d'un Big Four ou d'une fonction CFO d'industrie pharma régionale. Mission prioritaire : structuration du contrôle interne et mise en place du reporting trimestriel investisseur.",
                budget:"15M FCFA/an",
              },
              {
                title:"DRH — Directeur des Ressources Humaines",
                priority:"Priorité 2", deadline:"6 mois", color:"#BA7517", bg:"#FFF8F0",
                body:"Structuration de la fonction RH aujourd'hui assurée à temps partiel par le DG. Profil cible : 6-10 ans d'expérience industrie pharma ou agro-industriel, maîtrise du droit du travail OHADA et des conventions collectives sectorielles. Missions prioritaires : grilles salariales, plans de formation BPF récurrents, conventions collectives, mise en place du LTIP pour le pool managérial.",
                budget:"10M FCFA/an",
              },
              {
                title:"Dir. pays Sénégal",
                priority:"Priorité 3", deadline:"12 mois", color:"#1D9E75", bg:"#EAF3DE",
                body:"Recrutement conditionné à la concrétisation de l'expansion régionale prévue T2 2027. Profil cible : pharmacien sénégalais avec carnet d'adresses Pharmacie Nationale d'Approvisionnement (PNA) et hôpitaux publics. Mission : implantation d'une filiale ou d'un bureau de représentation à Dakar, premiers AO ciblés sur les hôpitaux régionaux de Saint-Louis, Thiès et Diourbel.",
                budget:"15-20M FCFA/an",
              },
            ].map((p, i) => (
              <Card key={i} style={{padding:14, marginBottom:10, background:p.bg, borderLeft:`3px solid ${p.color}`}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, gap:10, flexWrap:"wrap"}}>
                  <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{p.title}</span>
                  <div style={{display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
                    <span style={{padding:"3px 10px", borderRadius:10, fontSize:10, fontWeight:700, color:"#fff", background:p.color, letterSpacing:0.4}}>{p.priority}</span>
                    <span style={{fontSize:10, color:p.color, fontWeight:600, fontStyle:"italic"}}>· {p.deadline}</span>
                  </div>
                </div>
                <p style={{margin:"0 0 10px", fontSize:11.5, lineHeight:1.7, color:"#444"}}>{p.body}</p>
                <div style={{paddingTop:8, borderTop:`1px solid ${p.color}30`, fontSize:11, color:p.color, fontWeight:600}}>
                  Budget : <span style={{fontSize:12}}>{p.budget}</span>
                </div>
              </Card>
            ))}

            <p style={{margin:"14px 0 0", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Plan de recrutement total : 40-45M FCFA/an de masse salariale additionnelle à régime, soit ~1,5% du CA 2025. Cohérent avec le levier de structuration attendu sur ce profil de société, dilution acceptable de la marge EBITDA si le plan est déployé séquentiellement avec montée en charge progressive.
            </p>
          </div>

          {/* Section 3 — Capacité d'absorption */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 10px", fontSize:14, fontWeight:700}}>Capacité d'absorption de la croissance</h3>
            <div style={{padding:"6px 14px", borderRadius:14, fontSize:11.5, fontWeight:700, color:"#BA7517", background:"#FFF5E0", display:"inline-block", marginBottom:12, letterSpacing:0.3}}>
              Insuffisante en l'état, mais corrigeable avec le plan de recrutement
            </div>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              L'équipe actuelle a démontré sa capacité à exécuter sur le périmètre CI mais reste sous-dimensionnée pour absorber simultanément (i) le doublement de la capacité de production prévu en 2027, (ii) le lancement d'une filiale Sénégal et (iii) la professionnalisation des fonctions support (finance, RH, juridique). Le plan de recrutement séquencé sur 12 mois post-closing permet de combler les fonctions critiques sans tension opérationnelle excessive. Le risque d'exécution principal réside dans le calendrier de recrutement DAF (Priorité 1) : tout retard au-delà de 100 jours mettrait sous tension la mise en place du reporting investisseur trimestriel et la structuration du contrôle interne.
            </p>
          </div>

          {/* Section 4 — Red flags identifiés */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Red flags identifiés</SectionTitle>
            <div style={{padding:14, background:"#FFF8F0", borderRadius:8, borderLeft:"3px solid #BA7517"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:10}}>
                <div style={{display:"flex", alignItems:"center", gap:8, flex:1}}>
                  <span style={{color:"#BA7517", fontSize:14, fontWeight:700}}>✕</span>
                  <span style={{fontSize:13, fontWeight:700, color:"#333"}}>Homme-clé</span>
                </div>
                <span style={{padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:"#BA7517", letterSpacing:0.5, flexShrink:0}}>HIGH</span>
              </div>
              <div style={{fontSize:11.5, color:"#444", lineHeight:1.7, paddingLeft:22}}>
                Si M. Kouassi est indisponible (incapacité, départ, conflit), Dr. Traoré assure la continuité production sur 4-6 mois mais ne peut pas reprendre la fonction commerciale institutionnelle ni le pilotage financier. Aucun successeur identifié au poste de DG, aucune assurance homme-clé en place à ce jour. Continuité opérationnelle évaluée à 6 mois maximum sans restructuration d'urgence. Assurance homme-clé à souscrire dans les 100 jours (plafond 500M FCFA, couverture invalidité + décès). Plan de succession à formaliser dans les 12 mois post-closing avec identification d'un DG délégué interne ou recrutement externe.
              </div>
            </div>
          </div>

          {/* Section 5 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Évaluation des profils basée sur les CV transmis, deux entretiens individuels (8 et 12 avril) et le retour de deux clients institutionnels. Les budgets de recrutement sont des estimations marché à confirmer avec un cabinet de chasse spécialisé pharma UEMOA.
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function ServicesPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 4);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Services</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — Services de l'entreprise et chaîne de valeur */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Services de l'entreprise et chaîne de valeur</h2>
            <h3 style={{margin:"4px 0 12px", fontSize:14, color:"#534AB7", fontWeight:700}}>Nature de l'activité</h3>
            <p style={{margin:0, fontSize:12.5, lineHeight:1.7, color:"#333"}}>
              {mandat.name} est un producteur de médicaments génériques certifié BPF UEMOA, opérant sur l'intégralité de la chaîne de valeur depuis l'importation des matières premières (API + excipients) jusqu'à la distribution finale aux établissements hospitaliers et aux officines de la zone CI/UEMOA. La société conçoit, fabrique et commercialise 42 références sur 4 familles thérapeutiques essentielles, avec un positionnement double canal (public via AO hospitaliers PSP, privé via grossistes-répartiteurs). L'activité s'inscrit dans la politique de souveraineté pharmaceutique régionale portée par l'OOAS et soutenue par les bailleurs européens.
            </p>
          </div>

          {/* Section 2 — Gamme de produits */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Gamme de produits — 4 familles thérapeutiques</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
              {[
                {
                  name:"Antalgiques / anti-inflammatoires", caPct:"35%", refs:"14 réf.", margin:"30%", color:"#534AB7",
                  body:"Paracétamol 500mg, ibuprofène 400mg, diclofénac 50mg. Fort volume, marge modérée. Concurrence importations indiennes (Cipla, Dr. Reddy's) sur le canal officinal.",
                },
                {
                  name:"Antibiotiques courants", caPct:"25%", refs:"10 réf.", margin:"34%", color:"#185FA5",
                  body:"Amoxicilline 500mg, ciprofloxacine 500mg, métronidazole 250mg. Forte demande AO hospitaliers, prescription stable. Pression sur les prix d'achat publics.",
                },
                {
                  name:"Antipaludéens", caPct:"25%", refs:"8 réf.", margin:"36%", color:"#1D9E75",
                  body:"Artéméther-luméfantrine, artésunate-amodiaquine. Meilleure marge de la gamme. Demande saisonnière (pic juin-octobre). Segment prioritaire pour l'expansion Sénégal.",
                },
                {
                  name:"Antihypertenseurs", caPct:"15%", refs:"10 réf.", margin:"32%", color:"#BA7517",
                  body:"Amlodipine 5/10mg, losartan 50mg. Croissance rapide (+25%/an) tirée par la transition épidémiologique. Pipeline de 4 nouvelles références à l'ANRP.",
                },
              ].map((p, i) => (
                <Card key={i} style={{padding:14, borderLeft:`3px solid ${p.color}`}}>
                  <div style={{fontSize:13, fontWeight:700, color:"#333", marginBottom:6}}>{p.name}</div>
                  <div style={{display:"flex", gap:10, flexWrap:"wrap", fontSize:10, color:"#888", marginBottom:10}}>
                    <span><span style={{color:p.color, fontWeight:700}}>CA {p.caPct}</span></span>
                    <span>·</span>
                    <span>{p.refs}</span>
                    <span>·</span>
                    <span>marge {p.margin}</span>
                  </div>
                  <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{p.body}</p>
                </Card>
              ))}
            </div>
            <div style={{marginTop:12, padding:10, background:"#fafaf7", borderRadius:6, fontSize:11.5, color:"#444", lineHeight:1.7, fontStyle:"italic"}}>
              <strong style={{fontStyle:"normal"}}>Formes galéniques :</strong> sèches (comprimés, gélules) = 70% du volume — liquides (sirops, suspensions) = 25% — semi-solides (crèmes, pommades) = 5%. La société ne produit pas de formes injectables ni stériles, ce qui limite l'accès à certains segments hospitaliers à plus forte valeur ajoutée mais évite des CAPEX significatifs (chambres blanches, lyophilisation).
            </div>
          </div>

          {/* Section 3 — Site de production */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Site de production</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              L'unité de production est implantée sur un terrain de 2 400 m² à Yopougon (zone industrielle Cosrou, périphérie nord-ouest d'Abidjan), certifiée BPF UEMOA depuis 2019 et inspectée annuellement par la Direction de la Pharmacie et du Médicament (DPM-CI). Le site comprend trois zones distinctes : une zone de réception et de stockage des matières premières (640 m²), une zone de production divisée en deux ateliers (formes sèches 720 m², formes liquides et semi-solides 380 m²) et une zone de contrôle qualité (260 m²) équipée d'un laboratoire physico-chimique avec HPLC, dissolution-tester et infrarouge. Le site emploie 22 personnes en deux équipes (6h-14h et 14h-22h), avec un fonctionnement à un seul poste effectif sur la majorité des lignes.
            </p>
          </div>

          {/* Section 4 — Capacité de production */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Capacité de production — le levier de croissance clé</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:12}}>
              {[
                {label:"Capacité installée", value:"50M", unit:"unités/an", color:"#534AB7"},
                {label:"Production 2025", value:"31M", unit:"unités", color:"#185FA5"},
                {label:"Taux utilisation", value:"62%", unit:"un poste effectif", color:"#BA7517"},
                {label:"Potentiel 2 postes", value:"100M", unit:"unités/an", color:"#1D9E75"},
              ].map((k, i) => (
                <div key={i} style={{padding:14, background:"#fff", borderRadius:8, border:"1px solid #F1EFE8", textAlign:"center"}}>
                  <div style={{fontSize:10, color:"#888", marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:20, fontWeight:700, color:k.color}}>{k.value}</div>
                  <div style={{fontSize:10, color:"#888", marginTop:3}}>{k.unit}</div>
                </div>
              ))}
            </div>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le taux d'utilisation actuel de 62% sur un seul poste signifie que la société dispose d'une marge de croissance significative sans CAPEX additionnel : passer d'un à deux postes complets permet de doubler la capacité installée à 100M unités/an, avec un investissement marginal limité au fonds de roulement et à la masse salariale (environ 60M FCFA/an d'OPEX additionnel pour 12 opérateurs supplémentaires). Cette élasticité opérationnelle est le levier de croissance principal du dossier sur l'horizon 2026-2028 — la nouvelle ligne de production cofinancée par l'opération viendra compléter cette montée en charge à partir de 2027.
            </p>
          </div>

          {/* Section 5 — Distribution */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Distribution — double canal complémentaire</h3>
            {[
              {
                title:"Canal public — AO hospitaliers PSP",
                meta:"60% du CA · marge contribution 32%", color:"#534AB7", bg:"#EEEDFE",
                body:"La Pharmacie de la Santé Publique (PSP) centralise les achats de l'ensemble des CHU et hôpitaux publics de Côte d'Ivoire. Les contrats sont attribués sur appels d'offres semestriels par famille thérapeutique. La société a remporté 12 AO actifs en 2025 (vs 4 en 2022), couvrant 60% de son CA. Les délais de paiement contractuels sont de 30 jours mais sont effectivement de 90 à 120 jours en pratique, ce qui pèse sur le BFR. Récurrence forte sur les molécules essentielles : 80% des AO 2024 ont été reconduits à PharmaCi en 2025.",
              },
              {
                title:"Canal privé — Pharmacies d'officine",
                meta:"40% du CA · marge 52%", color:"#1D9E75", bg:"#EAF3DE",
                body:"Distribution via 3 grossistes-répartiteurs nationaux (Ubipharm, Laborex CI, COPHARMED) qui irriguent l'ensemble des officines du territoire. La société est référencée auprès d'environ 80 pharmacies actives en 2025, principalement à Abidjan et dans les capitales régionales. Le plan de croissance prévoit l'extension à 200 pharmacies actives d'ici 2027 via l'embauche de 4 délégués médicaux et le déploiement d'une force de vente terrain dédiée. Marge significativement supérieure au canal public (52% vs 32%) du fait de l'absence d'appels d'offres et d'une chaîne de prix moins comprimée.",
              },
            ].map((c, i) => (
              <Card key={i} style={{padding:14, marginBottom:10, background:c.bg, borderLeft:`3px solid ${c.color}`}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:8, flexWrap:"wrap"}}>
                  <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{c.title}</span>
                  <span style={{fontSize:10, color:c.color, fontWeight:600}}>{c.meta}</span>
                </div>
                <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{c.body}</p>
              </Card>
            ))}
          </div>

          {/* Section 6 — Chaîne d'approvisionnement */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Chaîne d'approvisionnement</h3>
            {[
              {
                inline:"API", costPct:"62% du coût",
                body:"3 fournisseurs principaux basés en Inde — Cipla (40%), Dr. Reddy's (35%), Aurobindo (25%). Relations établies depuis 8 à 12 ans, paiements en USD avec ouverture de crédits documentaires via NSIA et SIB. Délai d'acheminement Inde-Abidjan : 45 à 60 jours par voie maritime. Stock de sécurité tenu à 3 mois sur les API critiques (paracétamol, amoxicilline, artéméther). Sensibilité forte aux variations USD/FCFA — couverture de change limitée à 30% des approvisionnements via forwards bancaires.",
              },
              {
                inline:"Excipients", costPct:"14% du coût",
                body:"Mix Chine (60%) et fournisseurs locaux UEMOA (40%). Les excipients chinois (lactose, amidon, MCC) sont moins sensibles que les API et offrent une diversification d'approvisionnement. Les excipients locaux (talc, stéarates) sont fournis par 4 industriels CI/SN avec des délais courts (15 à 30 jours).",
              },
              {
                inline:"Conditionnement", costPct:"9% du coût",
                body:"Majoritairement local — blisters PVC et aluminium produits par 2 fournisseurs ivoiriens (Ets Sotipac, Embalpharm), boîtes carton imprimées par 1 imprimeur abidjanais. Notices et étiquetage gérés en interne. La part locale du conditionnement est un argument fort dans les AO publics et dans le calcul du contenu local UEMOA.",
              },
            ].map((c, i, arr) => (
              <div key={i} style={{padding:"10px 0", borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none"}}>
                <div style={{fontSize:12, marginBottom:4}}>
                  <strong style={{color:"#333"}}>{c.inline}</strong>
                  <span style={{color:"#888", fontWeight:400}}> ({c.costPct}) :</span>
                </div>
                <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{c.body}</p>
              </div>
            ))}
          </div>

          {/* Section 7 — Avantage compétitif (moat BPF) */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Avantage compétitif structurel — le moat BPF en 3 couches</h3>
            {[
              {
                n:1, title:"Certification BPF UEMOA",
                body:"L'investissement initial pour obtenir la certification BPF UEMOA s'élève entre 200 et 400M FCFA selon le périmètre des formes galéniques visées, avec un délai de mise en conformité de 18 à 24 mois (audits, équipements, qualification, validation). Aujourd'hui seuls 3 producteurs sont certifiés en Côte d'Ivoire (PharmaCi, Cipharm, Pharmivoire). Cette barrière à l'entrée est structurelle et particulièrement défensive face aux importations qui ne peuvent pas accéder aux AO hospitaliers réservés aux producteurs locaux certifiés.",
                color:"#534AB7", bg:"#EEEDFE",
              },
              {
                n:2, title:"42 agréments de mise sur le marché",
                body:"Le portefeuille d'autorisations de mise sur le marché (AMM) constitue un actif intangible non réplicable rapidement. Construit sur 12 ans avec un investissement cumulé estimé à 180M FCFA (dossiers ANRP-CI, dossiers UEMOA centralisés, suivi pharmacovigilance), il représente un avantage temporel décisif. Un nouvel entrant aurait besoin de 5 à 7 ans pour reconstituer un portefeuille équivalent, même avec un capital disponible.",
                color:"#185FA5", bg:"#E3EDF7",
              },
              {
                n:3, title:"Historique de fourniture 2+ ans",
                body:"Les cahiers des charges des AO publics PSP-CI exigent un historique de fourniture continue et conforme d'au moins 24 mois sur la molécule concernée. Cette exigence verrouille l'accès au canal hospitalier pour les nouveaux entrants pendant au minimum 2 années consécutives sans incident qualité, créant une fenêtre de protection commerciale forte sur les molécules historiques de la société (paracétamol, amoxicilline, artéméther).",
                color:"#1D9E75", bg:"#EAF3DE",
              },
            ].map(c => (
              <Card key={c.n} style={{padding:14, marginBottom:10, background:c.bg, borderLeft:`3px solid ${c.color}`}}>
                <div style={{display:"flex", gap:12, alignItems:"flex-start"}}>
                  <div style={{width:32, height:32, borderRadius:16, background:c.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0}}>
                    {c.n}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:700, color:"#333", marginBottom:5}}>Couche {c.n} — {c.title}</div>
                    <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{c.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Section 8 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Données issues de la visite site du 11/04 et de l'entretien DG du 08/04. Capacités de production et taux d'utilisation à confirmer en DD opérationnelle par audit indépendant des lignes.
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function ConcurrenceMarchePage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 5);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Concurrence & marché</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — TAM / SAM / SOM */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Concurrence et marché</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Taille du marché — TAM / SAM / SOM</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
              {[
                {
                  label:"TAM", title:"Marché pharma total Afrique de l'Ouest",
                  value:"2.4 Mds USD", growth:"CAGR 8-10%/an",
                  body:"Marché pharmaceutique total UEMOA + CEDEAO en 2025, dont 75% est satisfait par des importations (Inde, Chine, France, Maghreb).",
                  color:"#534AB7", bg:"#EEEDFE",
                },
                {
                  label:"SAM", title:"Production locale de génériques certifiés BPF",
                  value:"360-430M USD", growth:"15-18% du TAM",
                  body:"Segment adressable réservé aux producteurs locaux certifiés BPF UEMOA, en croissance soutenue par les politiques de souveraineté pharmaceutique régionale.",
                  color:"#185FA5", bg:"#E3EDF7",
                },
                {
                  label:"SOM", title:`Marché adressable ${mandat.short}`,
                  value:"80-120M USD", growth:"PdM actuelle ~11% du SAM",
                  body:"Périmètre réaliste sur l'horizon du plan 2026-2028, intégrant montée en charge sur les 4 familles thérapeutiques + extension Sénégal.",
                  color:"#1D9E75", bg:"#EAF3DE",
                },
              ].map((m, i) => (
                <Card key={i} style={{padding:14, background:m.bg, borderLeft:`3px solid ${m.color}`}}>
                  <div style={{display:"inline-block", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, color:"#fff", background:m.color, letterSpacing:0.6, marginBottom:8}}>{m.label}</div>
                  <div style={{fontSize:11.5, fontWeight:600, color:"#333", marginBottom:6, lineHeight:1.3}}>{m.title}</div>
                  <div style={{fontSize:18, fontWeight:700, color:m.color, marginBottom:3}}>{m.value}</div>
                  <div style={{fontSize:10, color:m.color, fontWeight:600, marginBottom:10}}>{m.growth}</div>
                  <p style={{margin:0, fontSize:11, lineHeight:1.6, color:"#444"}}>{m.body}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 2 — Mégatendances */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Mégatendances sectorielles</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {[
                {
                  value:"+2.7%/an", label:"Croissance démographique UEMOA",
                  body:"Pression structurelle sur la demande de soins primaires. Population UEMOA passera de 130M à 165M habitants d'ici 2030.",
                  color:"#534AB7",
                },
                {
                  value:"45% → 52%", label:"Urbanisation d'ici 2030",
                  body:"Concentration urbaine accélère l'accès aux officines et hôpitaux. Class moyenne urbaine émergente avec pouvoir d'achat médicament.",
                  color:"#185FA5",
                },
                {
                  value:"CMU", label:"Couverture maladie universelle",
                  body:"Déploiement progressif des régimes CMU-CI, CMU-SN, RAMU-ML qui solvabilise la demande hospitalière publique.",
                  color:"#1D9E75",
                },
                {
                  value:"Réglementation", label:"Environnement de plus en plus favorable",
                  body:"Préférence nationale renforcée sur les AO publics, exonérations sectorielles, harmonisation BPF UEMOA.",
                  color:"#BA7517",
                },
              ].map((m, i) => (
                <Card key={i} style={{padding:14, borderTop:`3px solid ${m.color}`}}>
                  <div style={{fontSize:18, fontWeight:700, color:m.color, marginBottom:4, lineHeight:1.2}}>{m.value}</div>
                  <div style={{fontSize:10.5, color:"#666", fontWeight:600, marginBottom:8, lineHeight:1.4}}>{m.label}</div>
                  <p style={{margin:0, fontSize:11, lineHeight:1.6, color:"#444"}}>{m.body}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 3 — Réglementation */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Réglementation — un environnement de plus en plus favorable</h3>
            {[
              {
                title:"Directive UEMOA n°01/2023/CM — préférence nationale +15%",
                body:"Adoptée en mars 2023, cette directive impose une marge de préférence de 15% sur les prix d'achat publics au bénéfice des producteurs locaux certifiés BPF, applicable à l'ensemble des AO hospitaliers de la zone UEMOA. Effet direct sur la compétitivité de PharmaCi face aux importations indiennes sur les molécules essentielles.",
              },
              {
                title:"Code des investissements CI 2018 — exonérations fiscales 5 ans",
                body:"Le code des investissements ivoirien de 2018 prévoit des exonérations d'impôt sur les sociétés (IS) de 5 ans pour les nouveaux investissements industriels supérieurs à 500M FCFA dans les zones prioritaires (Yopougon Cosrou en fait partie). La nouvelle ligne de production cofinancée par l'opération devrait bénéficier de ce régime.",
              },
              {
                title:"Loi CMU-CI 2019",
                body:"La Couverture Maladie Universelle ivoirienne, en déploiement depuis 2019, étend progressivement la prise en charge des médicaments essentiels génériques. Effet de solvabilisation de la demande hospitalière sur les molécules clés du portefeuille.",
              },
              {
                title:"PNDIP 2022 — Plan National de Développement de l'Industrie Pharmaceutique",
                body:"Le PNDIP fixe un objectif de souveraineté pharmaceutique à 30% de production locale d'ici 2030 (vs 15-18% aujourd'hui), avec des engagements budgétaires sectoriels. Soutien institutionnel fort sur les acteurs en place.",
              },
            ].map((r, i, arr) => (
              <div key={i} style={{padding:"10px 0", borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none"}}>
                <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:5}}>{r.title}</div>
                <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{r.body}</p>
              </div>
            ))}
          </div>

          {/* Section 4 — Paysage concurrentiel */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 8px", fontSize:15, fontWeight:700}}>Paysage concurrentiel</h3>
            <p style={{margin:"0 0 14px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le marché ivoirien de la production locale de génériques est un oligopole réglementaire de fait — la barrière à l'entrée BPF UEMOA limite à 3 acteurs nationaux le périmètre des AO hospitaliers, complété par un panel d'importateurs sur le canal officinal. La dynamique concurrentielle est segmentée entre les leaders historiques (Pharmivoire, Cipharm), les challengers en croissance ({mandat.short}, Olea Medical au Sénégal) et un nuage d'importateurs non certifiés positionnés sur le canal privé à bas prix.
            </p>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"8px 12px", fontSize:9.5, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Acteur</div>
                <div style={{width:60, textAlign:"right"}}>CA (Mds)</div>
                <div style={{width:55, textAlign:"right"}}>PdM</div>
                <div style={{width:55, textAlign:"right"}}>Marge</div>
                <div style={{width:55, textAlign:"right"}}>CAGR</div>
                <div style={{flex:3}}>Description</div>
              </div>
              {[
                {name:"Pharmivoire", ca:"4.5", pdm:"~18%", margin:"35%", cagr:"+6%", desc:"Leader historique depuis 1987, fort héritage public. Croissance modérée, pas d'expansion régionale active.", highlight:false},
                {name:`${mandat.short} (cible)`, ca:"2.8", pdm:"~11%", margin:"32%", cagr:"+18%", desc:"Challenger dynamique. Croissance 3x plus rapide que le leader. Pipeline réglementaire le plus actif du secteur.", highlight:true},
                {name:"Cipharm", ca:"3.2", pdm:"~13%", margin:"28%", cagr:"+9%", desc:"Filiale industrielle adossée à un groupe étranger. Marges sous pression, focus sur le volume hospitalier.", highlight:false},
                {name:"Olea Medical (SN)", ca:"1.8", pdm:"~7%", margin:"30%", cagr:"+12%", desc:"Producteur sénégalais, pas de présence en CI. Concurrent direct sur le périmètre d'expansion régionale visé.", highlight:false},
                {name:"Importateurs (panel)", ca:"~15", pdm:"~55%", margin:"15-20%", cagr:"+5%", desc:"Pas de certification BPF, exclus des AO hospitaliers. Présents uniquement sur le canal officinal à bas prix.", highlight:false},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.highlight?"#EEEDFE":"transparent"}}>
                  <div style={{flex:2, fontWeight:r.highlight?700:600, color:r.highlight?"#534AB7":"#333"}}>{r.name}</div>
                  <div style={{width:60, textAlign:"right", fontWeight:600}}>{r.ca}</div>
                  <div style={{width:55, textAlign:"right", color:"#666"}}>{r.pdm}</div>
                  <div style={{width:55, textAlign:"right", color:"#666"}}>{r.margin}</div>
                  <div style={{width:55, textAlign:"right", color:r.cagr.includes("+18")?"#1D9E75":"#666", fontWeight:r.highlight?700:400}}>{r.cagr}</div>
                  <div style={{flex:3, color:"#666", fontSize:10.5, lineHeight:1.5, paddingLeft:8}}>{r.desc}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12, padding:10, background:"#EAF3DE", borderRadius:6, fontSize:11.5, color:"#1D9E75", lineHeight:1.6, fontStyle:"italic"}}>
              <strong style={{fontStyle:"normal"}}>Synthèse :</strong> {mandat.short} gagne des parts de marché à +1-2 points par an depuis 2022, principalement au détriment des importateurs non certifiés sur les molécules essentielles. La trajectoire est cohérente avec un repositionnement progressif vers le statut de challenger #2 du marché ivoirien à horizon 2028.
            </div>
          </div>

          {/* Section 5 — Marché sénégalais */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Analyse de la concurrence sur le marché sénégalais</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le marché sénégalais représente la première étape de l'expansion régionale visée par l'opération (T2 2027). Estimé à 380M USD en 2025 avec une croissance de 9-11%/an, il présente des caractéristiques structurelles proches du marché ivoirien (oligopole réglementaire, double canal public/privé) avec deux producteurs locaux certifiés BPF UEMOA : Olea Medical (CA 1,8 Mds FCFA, leader local) et Pharmasen (CA 0,9 Mds FCFA, challenger). Le canal public est centralisé par la Pharmacie Nationale d'Approvisionnement (PNA), équivalent sénégalais de la PSP, avec un fonctionnement par AO semestriels comparable. La directive UEMOA de préférence nationale +15% s'applique également, ce qui ouvre un accès direct à {mandat.short} dès l'obtention de l'agrément réglementaire local. Le différentiel de marge anticipé (effet économies d'échelle sur la production CI mutualisée) et le carnet d'adresses du Directeur Commercial (M. Diarra, 8 ans Sanofi Afrique de l'Ouest) constituent les deux leviers principaux d'entrée. Premier objectif de 5-7% de PdM sur 24 mois post-implantation.
            </p>
          </div>

          {/* Section 6 — Menaces et résilience */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Menaces potentielles et analyse de résilience</h3>
            {[
              {
                n:1, title:"Entrée d'un acteur international",
                proba:"Probabilité faible", color:"#1D9E75", bg:"#EAF3DE",
                body:"Marché trop fragmenté pour attirer un Sanofi, Cipla ou Aurobindo en mode investissement direct. Les acteurs internationaux préfèrent des partenariats commerciaux ou des prises de participation minoritaires. Horizon menace : 5-7 ans minimum avant scénario crédible.",
              },
              {
                n:2, title:"Libéralisation de la préférence nationale",
                proba:"Probabilité faible", color:"#1D9E75", bg:"#EAF3DE",
                body:"La directive UEMOA n°01/2023/CM est récente et adossée à des engagements politiques régionaux forts. Aucun signal de remise en cause à l'horizon 2030. Lobbying des producteurs locaux et alignement avec les agendas de souveraineté pharmaceutique africains.",
              },
              {
                n:3, title:"Durcissement des normes BPF",
                proba:"Probabilité modérée", color:"#BA7517", bg:"#FFF8F0",
                body:"L'OOAS et l'AMA travaillent à un durcissement progressif des standards BPF UEMOA pour s'aligner sur les normes WHO-GMP+ d'ici 2028-2030. PharmaCi est en avance sur le sujet (certifié WHO-GMP depuis 2019) mais devra investir 80-150M FCFA pour se maintenir aux nouveaux standards. Effet d'éviction renforcé sur les concurrents non préparés.",
              },
              {
                n:4, title:"Substitution technologique",
                proba:"Probabilité très faible", color:"#1D9E75", bg:"#EAF3DE",
                body:"Aucune rupture technologique anticipée sur les génériques essentiels à l'horizon 10 ans. Les biothérapies et thérapies géniques ne concernent pas le segment des génériques de masse adressé par PharmaCi. La menace réelle viendrait plutôt de génériqueurs en e-commerce direct, qui restent marginaux en Afrique de l'Ouest.",
              },
            ].map(m => (
              <Card key={m.n} style={{padding:14, marginBottom:10, background:m.bg, borderLeft:`3px solid ${m.color}`}}>
                <div style={{display:"flex", gap:12, alignItems:"flex-start"}}>
                  <div style={{width:28, height:28, borderRadius:14, background:m.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0}}>
                    {m.n}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:5, flexWrap:"wrap"}}>
                      <span style={{fontSize:12.5, fontWeight:700, color:"#333"}}>{m.title}</span>
                      <span style={{padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:m.color, letterSpacing:0.4, flexShrink:0}}>{m.proba}</span>
                    </div>
                    <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>{m.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Section 7 — Synthèse positionnement */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Positionnement concurrentiel — synthèse analyste</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              {mandat.short} se positionne comme le challenger le plus dynamique d'un marché protégé par 3 couches de barrières réglementaires (BPF, AMM, historique de fourniture). La trajectoire de croissance (+18%/an) est trois fois supérieure à celle du leader historique, et la société capte progressivement des parts de marché sur les importateurs non certifiés grâce à la directive UEMOA de préférence nationale. Les mégatendances démographiques, urbaines et réglementaires alimentent une demande structurellement croissante sur les 4 familles thérapeutiques du portefeuille. Le profil de risque concurrentiel est faible à modéré, dominé par un seul scénario à surveiller (durcissement BPF) qui jouerait paradoxalement en faveur des acteurs en place. L'expansion sénégalaise constitue le levier principal de doublement du périmètre adressable à horizon 2028 et bénéficie d'un appui structurel via la directive UEMOA et l'expérience commerciale du Directeur Commercial.
            </p>
          </div>

          {/* Section 8 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Validé par", "K. N'Guessan (MD)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Section la plus consommatrice de knowledge_base sectorielle (IFC Pharma Africa 2024, OOAS, BCEAO, BAD). Données concurrents partiellement déclaratives — à recouper en DD via base SCIPP et entretiens secteur.
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function UnitEconomicsPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 6);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Units economics</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
              <Btn small onClick={() => toast("Brouillon sauvegardé")}>↩ Brouillon</Btn>
            </div>
          </div>

          {/* Section 1 — Rentabilité par canal */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Unit economics</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Rentabilité par canal de distribution</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Canal</div>
                <div style={{flex:1, textAlign:"right"}}>Prix moy. FCFA</div>
                <div style={{flex:1, textAlign:"right"}}>Coût unitaire</div>
                <div style={{flex:1, textAlign:"right"}}>Marge contribution</div>
                <div style={{width:75, textAlign:"right"}}>Marge %</div>
              </div>
              {[
                {channel:"AO public PSP", price:"85", cost:"58", margin:"27", marginPct:"32%", color:"#534AB7", highlight:false},
                {channel:"Privé pharmacie", price:"120", cost:"58", margin:"62", marginPct:"52%", color:"#1D9E75", highlight:false},
                {channel:"Blended (mix 60/40)", price:"99", cost:"58", margin:"41", marginPct:"41%", color:"#534AB7", highlight:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.highlight?"#EEEDFE":"transparent"}}>
                  <div style={{flex:2, fontWeight:r.highlight?700:600, color:r.highlight?"#534AB7":"#333"}}>{r.channel}</div>
                  <div style={{flex:1, textAlign:"right"}}>{r.price}</div>
                  <div style={{flex:1, textAlign:"right", color:"#666"}}>{r.cost}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.margin}</div>
                  <div style={{width:75, textAlign:"right"}}>
                    <span style={{color:r.color, fontWeight:700}}>{r.marginPct}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 — Rentabilité par famille */}
          <div style={{marginBottom:24}}>
            <SectionTitle>Rentabilité par famille thérapeutique</SectionTitle>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Famille</div>
                <div style={{flex:1, textAlign:"right"}}>Prix moy.</div>
                <div style={{flex:1, textAlign:"right"}}>Coût</div>
                <div style={{flex:1, textAlign:"right"}}>Marge</div>
                <div style={{width:70, textAlign:"right"}}>Marge %</div>
                <div style={{width:60, textAlign:"right"}}>% CA</div>
              </div>
              {[
                {family:"Antalgiques / anti-inflammatoires", price:"70", cost:"49", margin:"21", marginPct:"30%", caPct:"35%", color:"#534AB7"},
                {family:"Antibiotiques courants", price:"95", cost:"63", margin:"32", marginPct:"34%", caPct:"25%", color:"#185FA5"},
                {family:"Antipaludéens", price:"120", cost:"77", margin:"43", marginPct:"36%", caPct:"25%", color:"#1D9E75"},
                {family:"Antihypertenseurs", price:"115", cost:"78", margin:"37", marginPct:"32%", caPct:"15%", color:"#BA7517"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center"}}>
                  <div style={{flex:2, display:"flex", alignItems:"center", gap:8}}>
                    <Dot color={r.color}/>
                    <span style={{fontWeight:600}}>{r.family}</span>
                  </div>
                  <div style={{flex:1, textAlign:"right"}}>{r.price}</div>
                  <div style={{flex:1, textAlign:"right", color:"#666"}}>{r.cost}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.margin}</div>
                  <div style={{width:70, textAlign:"right"}}>
                    <span style={{color:r.color, fontWeight:700}}>{r.marginPct}</span>
                  </div>
                  <div style={{width:60, textAlign:"right", color:"#666"}}>{r.caPct}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — Décomposition coût de revient */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Décomposition du coût de revient (par unité)</h3>
            <Card style={{padding:16}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14, paddingBottom:10, borderBottom:"1px solid #F1EFE8"}}>
                <span style={{fontSize:11, fontWeight:600, color:"#666", textTransform:"uppercase", letterSpacing:0.5}}>Coût total unitaire</span>
                <span style={{fontSize:22, fontWeight:700, color:"#333"}}>58 <span style={{fontSize:13, fontWeight:600, color:"#888"}}>FCFA</span></span>
              </div>
              {[
                {item:"API", value:"32", pct:55, color:"#534AB7"},
                {item:"Excipients", value:"8", pct:14, color:"#185FA5"},
                {item:"Conditionnement", value:"5", pct:9, color:"#1D9E75"},
                {item:"MOD (main d'œuvre directe)", value:"8", pct:14, color:"#BA7517"},
                {item:"Énergie", value:"5", pct:9, color:"#D85A30"},
              ].map((c, i) => (
                <div key={i} style={{marginBottom:i<4?12:0}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4, fontSize:12}}>
                    <span style={{fontWeight:600, color:"#333"}}>{c.item}</span>
                    <span style={{display:"flex", gap:10, alignItems:"baseline"}}>
                      <span style={{fontWeight:700, color:c.color}}>{c.value} FCFA</span>
                      <span style={{fontSize:10, color:"#888", minWidth:32, textAlign:"right"}}>{c.pct}%</span>
                    </span>
                  </div>
                  <Prog value={c.pct} max={55} color={c.color} h={6}/>
                </div>
              ))}
            </Card>
          </div>

          {/* Section 4 — Sensibilité prix API */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Sensibilité au prix des API</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Scénario</div>
                <div style={{flex:1, textAlign:"right"}}>Prix API</div>
                <div style={{flex:1, textAlign:"right"}}>Coût unit.</div>
                <div style={{flex:1, textAlign:"right"}}>Marge</div>
                <div style={{width:75, textAlign:"right"}}>Marge %</div>
              </div>
              {[
                {scenario:"Contrat cadre -5%", api:"30", cost:"56", margin:"43", marginPct:"43%", color:"#1D9E75"},
                {scenario:"Actuel", api:"32", cost:"58", margin:"41", marginPct:"41%", color:"#534AB7", highlight:true},
                {scenario:"Hausse +10%", api:"35", cost:"61", margin:"38", marginPct:"38%", color:"#BA7517"},
                {scenario:"Hausse +20%", api:"38", cost:"64", margin:"35", marginPct:"35%", color:"#D85A30"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.highlight?"#EEEDFE":"transparent"}}>
                  <div style={{flex:2, fontWeight:r.highlight?700:600, color:r.highlight?"#534AB7":"#333"}}>{r.scenario}</div>
                  <div style={{flex:1, textAlign:"right"}}>{r.api}</div>
                  <div style={{flex:1, textAlign:"right", color:"#666"}}>{r.cost}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.margin}</div>
                  <div style={{width:75, textAlign:"right"}}>
                    <span style={{color:r.color, fontWeight:700}}>{r.marginPct}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, fontSize:11, color:"#888", lineHeight:1.6, fontStyle:"italic"}}>
              Sensibilité limitée — la couverture de change forward sur 30% des approvisionnements et la diversification fournisseurs (Cipla, Dr. Reddy's, Aurobindo) limitent l'exposition à des chocs extrêmes au-delà de +20%.
            </div>
          </div>

          {/* Section 5 — Break-even et levier opérationnel */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Break-even et levier opérationnel</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
              <Card style={{padding:16, background:"#EEEDFE", borderLeft:"3px solid #534AB7"}}>
                <div style={{fontSize:11, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8}}>Break-even</div>
                <div style={{fontSize:22, fontWeight:700, color:"#534AB7", marginBottom:6}}>18M unités/an</div>
                <div style={{fontSize:11.5, color:"#444", lineHeight:1.6}}>
                  Soit <strong>36% de la capacité installée</strong> et <strong>1,7x sous la production actuelle</strong> (31M unités). La société opère bien au-delà du seuil de rentabilité avec une marge de sécurité confortable.
                </div>
              </Card>
              <Card style={{padding:16, background:"#EAF3DE", borderLeft:"3px solid #1D9E75"}}>
                <div style={{fontSize:11, fontWeight:700, color:"#1D9E75", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8}}>Levier opérationnel</div>
                <div style={{fontSize:22, fontWeight:700, color:"#1D9E75", marginBottom:6}}>+779M FCFA</div>
                <div style={{fontSize:11.5, color:"#444", lineHeight:1.6}}>
                  Avec 41 FCFA de marge contribution unitaire, passer de 31M à 50M unités générerait un gain de marge de <strong>+779M FCFA</strong>, soit <strong>+260% d'EBITDA</strong> — sans CAPEX additionnel sur la ligne actuelle.
                </div>
              </Card>
            </div>
          </div>

          {/* Section 6 — Expansion Sénégal */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Unit economics expansion Sénégal</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              La marge contribution sur le marché sénégalais est estimée entre <strong>43 et 45 FCFA par unité</strong> (vs 41 FCFA en CI), soit un différentiel de +5 à +10% de rentabilité unitaire. Ce différentiel s'explique par trois facteurs : (i) un prix moyen public légèrement supérieur sur les AO PNA (+8% vs PSP-CI sur les molécules essentielles), (ii) une moindre concentration concurrentielle qui réduit la pression prix sur le canal officinal, et (iii) un coût unitaire de production stable grâce à la mutualisation industrielle sur le site de Yopougon (pas de duplication CAPEX). Les coûts logistiques additionnels (transport Abidjan-Dakar, droits de douane intra-UEMOA, stockage local) sont estimés à 4-5 FCFA par unité, déjà intégrés dans la marge cible. Sur l'horizon 2027-2028, l'expansion représenterait un gain de marge incrémental de 12 à 18M FCFA par million d'unités vendues.
            </p>
          </div>

          {/* Section 7 — Benchmarks sectoriels */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Benchmarks sectoriels</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Ratio</div>
                <div style={{flex:1, textAlign:"right"}}>{mandat.short}</div>
                <div style={{flex:1, textAlign:"right"}}>Médiane</div>
                <div style={{flex:1, textAlign:"right"}}>Quartile</div>
                <div style={{flex:1, textAlign:"right"}}>Source</div>
              </div>
              {[
                {ratio:"Marge contribution", company:"41 FCFA", median:"32 FCFA", quartile:"Q3", source:"Pharma UEMOA", ok:true},
                {ratio:"Coût API / coût total", company:"55%", median:"60%", quartile:"Q4", source:"IFC 2024", ok:true},
                {ratio:"Capacité utilisée", company:"62%", median:"70%", quartile:"Q2", source:"—", ok:false},
                {ratio:"Break-even / capacité", company:"36%", median:"45%", quartile:"Q4", source:"—", ok:true},
                {ratio:"Marge brute par SKU haut volume", company:"32%", median:"28%", quartile:"Q3", source:"Knowledge", ok:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center"}}>
                  <div style={{flex:2}}>{r.ratio}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.company}</div>
                  <div style={{flex:1, textAlign:"right", color:"#888"}}>{r.median}</div>
                  <div style={{flex:1, textAlign:"right"}}>
                    <span style={{color:r.ok?"#1D9E75":"#BA7517", fontWeight:700, fontSize:11}}>{r.quartile}</span>
                  </div>
                  <div style={{flex:1, textAlign:"right", color:"#888", fontSize:10, fontStyle:"italic"}}>{r.source}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 8 — Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Unit economics calculés à partir des inputs_history 2022-2025 fournis par le DAF de la société et croisés avec les benchmarks knowledge_base pharma UEMOA. Sensibilités à recouper en DD avec un échantillon de SKU haut volume.
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function PnLPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 8);
  const [openTreatment, setOpenTreatment] = useState(0);
  const [openNote, setOpenNote] = useState(null);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>États financiers PnL</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* Section 1 — Compte de résultat */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>États financiers — Compte de résultat</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Compte de résultat historique 3 ans — SYSCOHADA</h3>

            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:3}}>FCFA (M)</div>
                <div style={{flex:1, textAlign:"right"}}>2023</div>
                <div style={{flex:1, textAlign:"right"}}>2024</div>
                <div style={{flex:1, textAlign:"right"}}>2025</div>
                <div style={{flex:1.2, textAlign:"right"}}>Δ 3 ans</div>
              </div>
              {[
                {l:"Chiffre d'affaires net", v:["1 730","2 045","2 410"], delta:"+18% CAGR", bold:true},
                {l:"Coût des ventes", v:["-659","-779","-916"], delta:"", indent:true},
                {l:"% Coût des ventes / CA", v:["38.1%","38.1%","38.0%"], delta:"", indent:true, italic:true},
                {l:"Marge brute", v:["1 071","1 266","1 494"], delta:"62% → 62%", bold:true, deltaColor:"#1D9E75"},
                {l:"% Marge brute", v:["61.9%","61.9%","62.0%"], delta:"", indent:true, italic:true},
                {l:"Charges externes", v:["-340","-405","-475"], delta:"", indent:true},
                {l:"Frais de personnel", v:["-280","-330","-385"], delta:"", indent:true},
                {l:"% Masse salariale / CA", v:["16.2%","16.1%","16.0%"], delta:"", indent:true, italic:true},
                {l:"Autres charges d'exploitation", v:["-70","-80","-114"], delta:"", indent:true},
                {l:"EBITDA déclaré", v:["381","451","520"], delta:"22.0% → 21.6%", bold:true, deltaColor:"#1D9E75"},
                {l:"(-) Retraitement rémunération dirigeant", v:["-30","-30","-30"], delta:"", indent:true, italic:true},
                {l:"(-) Retraitement charges non récurrentes", v:["-10","-10","-10"], delta:"", indent:true, italic:true},
                {l:"EBITDA retraité", v:["341","411","480"], delta:"19.7% → 19.9%", bold:true, deltaColor:"#534AB7", highlight:true},
                {l:"Dotations amort. & prov.", v:["-65","-72","-80"], delta:"", indent:true},
                {l:"Résultat d'exploitation EBIT", v:["276","339","400"], delta:"", bold:true},
                {l:"Résultat financier", v:["-30","-35","-40"], delta:"", indent:true},
                {l:"Résultat avant IS", v:["246","304","360"], delta:"", bold:true},
                {l:"Impôt société", v:["-62","-76","-70"], delta:"", indent:true},
                {l:"Résultat net", v:["184","228","290"], delta:"+25% CAGR", bold:true, deltaColor:"#1D9E75"},
                {l:"% Marge nette", v:["10.6%","11.1%","12.0%"], delta:"", indent:true, italic:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"7px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", background:r.highlight?"#EEEDFE":r.bold?"#fafaf7":"transparent"}}>
                  <div style={{flex:3, paddingLeft:r.indent?16:0, fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.highlight?"#534AB7":"#333"}}>{r.l}</div>
                  {r.v.map((v, vi) => (
                    <div key={vi} style={{flex:1, textAlign:"right", fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.highlight?"#534AB7":"#333"}}>{v}</div>
                  ))}
                  <div style={{flex:1.2, textAlign:"right", fontSize:10, fontWeight:r.bold?700:400, color:r.deltaColor||"#888", fontStyle:r.italic?"italic":"normal"}}>{r.delta}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, fontSize:10, color:"#888", lineHeight:1.6, fontStyle:"italic"}}>
              <strong style={{fontStyle:"normal"}}>Notes :</strong> Liasses 2023-2024 non certifiées par commissaire aux comptes (CAC désigné en cours de procédure). Retraitements estimatifs basés sur entretien DAF du 12/04 — à confirmer en DD financière. Format SYSCOHADA OHADA. Taux IS appliqué : 25% (régime droit commun CI), à valider avec quittances DGI. D&A calculées par paliers selon le tableau d'amortissement transmis.
            </div>
          </div>

          {/* Section 2 — Analyse croissance CA */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Analyse de la croissance du CA</h3>
            <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le CAGR du chiffre d'affaires sur 3 ans atteint <strong>+18%</strong>, soit 1,8x la médiane sectorielle de la pharma UEMOA (10%) sur la même période. Cette dynamique place {mandat.short} dans le quartile supérieur du secteur sur la dimension croissance, en cohérence avec le positionnement de challenger #2 sur les AO hospitaliers ivoiriens.
            </p>
            <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              La croissance est tirée à <strong>62% par le canal public</strong> (AO PSP) et à <strong>38% par le canal privé</strong>, ratio cohérent avec la mécanique commerciale de la société. Toutefois, la <strong>concentration top-3 clients à 62% du CA 2025</strong> dépasse significativement le seuil benchmark de 50% retenu par les LP du fonds (red flag actif — voir §1 Résumé exécutif).
            </p>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              La décomposition du CA par ligne de service / molécule au-delà du niveau familial agrégé n'a pas été fournie à ce stade. Une cartographie SKU haut volume sera demandée en DD pour identifier les concentrations sous-jacentes (top-10 SKU = 60-70% du CA estimé) et le pricing power réel de la société sur les molécules essentielles.
            </p>
          </div>

          {/* Section 3 — Analyse marge brute */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Analyse de la marge brute</h3>
            <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              La marge brute est remarquablement stable à <strong>~62%</strong> sur les 3 exercices (61,9% en 2023, 61,9% en 2024, 62,0% en 2025), ce qui place la société dans le quartile Q3 du benchmark sectoriel pharma UEMOA (médiane 60%, P25 55%, P75 65%). La stabilité de la marge sur une période de croissance soutenue (+18% CAGR) est un signal positif sur la discipline de pricing et l'absence d'effet d'éviction concurrentielle.
            </p>
            <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le modèle est <strong>asset-light sur la production</strong> (l'unité de Yopougon est sous-utilisée à 62%) avec un coût des ventes dominé par les API (55% du coût total, cf. §6 Unit economics). Cette structure protège la marge brute en cas de hausse modérée des volumes — le levier opérationnel jouera principalement au niveau de l'EBITDA grâce à l'absorption des charges fixes.
            </p>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              <strong>Risque de retraitement SYSCOHADA</strong> : l'imputation des charges externes et du conditionnement entre coût des ventes et autres charges d'exploitation devra être revue en DD. Un reclassement défavorable pourrait abaisser la marge brute déclarée de 1 à 2 points (cible ajustée 60-61%), sans impact sur l'EBITDA mais avec un effet sur le benchmarking comparatif.
            </p>
          </div>

          {/* Section 4 — Retraitements EBITDA */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Retraitements EBITDA</h3>
            {[
              {
                title:"Concentration clients — 62% CA sur top-3",
                severity:"HIGH", color:"#A32D2D", bg:"#FBE6DC", border:"#D85A30",
                body:"Les 3 principaux clients (CHU Cocody, PSP-CI, Pharmacie Centrale) représentent 62% du CA 2025, dépassant largement le seuil benchmark de 50% retenu par les LP institutionnels du fonds. Aucune ventilation détaillée des contrats n'a été fournie : durée, récurrence, clauses de sortie, indexation. Atténuation possible si les AO hospitaliers s'avèrent récurrents (taux de reconduction historique 80%) — à valider en DD par cartographie complète. Si la concentration réelle dépasse 70% après cartographie, le dossier passe en Hold.",
              },
              {
                title:"Rémunération dirigeant — non documentée",
                severity:"HIGH", color:"#A32D2D", bg:"#FBE6DC", border:"#D85A30",
                body:"Le ratio masse salariale / CA s'établit à 16,0% en 2025, soit 4 points sous la médiane sectorielle estimée (~12% pour les sociétés pharma comparables incluant rémunération dirigeant complète). Écart cohérent avec une rémunération dirigeant non déclarée estimée entre 80M et 120M FCFA/an, normalement absorbée par la SCI Kouassi via les loyers du bail commercial. Retraitement retenu : -30M FCFA par an (milieu de fourchette) intégré dans l'EBITDA retraité. Si la rémunération réelle dépasse 150M FCFA après clarification DD, EBITDA retraité < 18%, scénario deal breaker.",
              },
              {
                title:"Liasses 2023-2024 non certifiées",
                severity:"MEDIUM", color:"#BA7517", bg:"#FFF8F0", border:"#BA7517",
                body:"Les liasses fiscales SYSCOHADA des exercices 2023 et 2024 n'ont pas été certifiées par un commissaire aux comptes (CAC), alors que les seuils OHADA imposent cette désignation depuis le franchissement de 250M FCFA de CA en 2022. La société est en infraction réglementaire. Désignation d'un CAC inscrit OEC-CI en cours, première certification attendue sur l'exercice 2025 (en cours d'audit). Risque de retraitement SYSCOHADA limité à 2-3% de l'EBITDA selon les premières observations du CAC.",
              },
              {
                title:"Charges non récurrentes / personnelles",
                severity:"LOW", color:"#534AB7", bg:"#EEEDFE", border:"#534AB7",
                body:"Identification de 8-12M FCFA/an de charges non récurrentes ou personnelles imputées à la société : véhicule Toyota Land Cruiser à usage privé du DG (4M/an d'entretien et carburant), frais de représentation atypiques (3-5M/an), assurances multirisques surdimensionnées sur la SCI Kouassi (3M/an). Retraitement retenu : -10M FCFA par an dans l'EBITDA retraité. Régularisation engagée par le fondateur dans le plan de structuration 100 jours.",
              },
            ].map((t, i) => (
              <Card key={i} style={{padding:0, marginBottom:8, background:t.bg, borderLeft:`3px solid ${t.border}`, overflow:"hidden"}}>
                <div onClick={() => setOpenTreatment(openTreatment === i ? -1 : i)} style={{padding:14, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
                  <div style={{display:"flex", alignItems:"center", gap:10, flex:1}}>
                    <span style={{color:t.color, fontSize:14, fontWeight:700}}>✕</span>
                    <span style={{fontSize:12.5, fontWeight:700, color:"#333"}}>{t.title}</span>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:t.color, letterSpacing:0.5}}>{t.severity}</span>
                  </div>
                  <span style={{fontSize:11, color:"#888", fontWeight:700, transition:"transform 0.15s", transform:openTreatment===i?"rotate(90deg)":"none"}}>▶</span>
                </div>
                {openTreatment === i && (
                  <div style={{padding:"0 14px 14px", fontSize:11.5, color:"#444", lineHeight:1.7}}>
                    {t.body}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Section 5 — Taux d'imposition effectif */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Taux d'imposition effectif</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le taux d'IS de droit commun en Côte d'Ivoire est de <strong>25%</strong> sur les bénéfices imposables. Le taux effectif observé sur la période s'établit autour de <strong>~19%</strong> (62/246 en 2023, 76/304 en 2024, 70/360 en 2025), soit un écart de 6 points avec le taux légal qui peut s'expliquer par les déductions standards SYSCOHADA, l'amortissement accéléré sur les équipements industriels, et un possible bénéfice partiel du régime du Code des investissements 2018 sur les nouveaux équipements (à vérifier). Points à clarifier en DD fiscale : (i) quittances IS et état de paiement à jour, (ii) déclarations TVA mensuelles 2024-2025 et solde de TVA déductible, (iii) certificats CNPS sur les déclarations sociales 2023-2025, (iv) périmètre exact des exonérations Code des investissements (CGI art. 87 et suivants) et conditions de maintien.
            </p>
          </div>

          {/* Section 6 — Benchmarks sectoriels */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Positionnement vs benchmarks sectoriels</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Ratio</div>
                <div style={{flex:1, textAlign:"right"}}>Cible</div>
                <div style={{flex:1, textAlign:"right"}}>P25</div>
                <div style={{flex:1, textAlign:"right"}}>Médiane</div>
                <div style={{flex:1, textAlign:"right"}}>Quartile</div>
              </div>
              {[
                {ratio:"Marge brute", company:"62.0%", p25:"55%", median:"60%", quartile:"Q3", warn:false},
                {ratio:"Marge EBITDA déclarée", company:"21.6%", p25:"15%", median:"20%", quartile:"Q3", warn:false},
                {ratio:"Marge EBITDA retraitée", company:"19.9%", p25:"15%", median:"20%", quartile:"Q2", warn:false},
                {ratio:"Croissance CA (CAGR 3 ans)", company:"+18%", p25:"10%", median:"15%", quartile:"Q3", warn:false},
                {ratio:"Marge nette", company:"12.0%", p25:"5%", median:"9%", quartile:"Q3", warn:false},
                {ratio:"Concentration clients top-3", company:"62%", p25:"35%", median:"45%", quartile:">P75 ⚠", warn:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.warn?"#FBE6DC":"transparent"}}>
                  <div style={{flex:2, fontWeight:r.warn?700:400, color:r.warn?"#A32D2D":"#333"}}>{r.ratio}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.company}</div>
                  <div style={{flex:1, textAlign:"right", color:"#888"}}>{r.p25}</div>
                  <div style={{flex:1, textAlign:"right", color:"#888"}}>{r.median}</div>
                  <div style={{flex:1, textAlign:"right"}}>
                    <span style={{color:r.warn?"#A32D2D":r.quartile==="Q2"?"#BA7517":"#1D9E75", fontWeight:700, fontSize:11}}>{r.quartile}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888", fontStyle:"italic"}}>
              Source : base de connaissance pharma UEMOA (IFC 2024 · 14 entreprises) — score pertinence 0.95
            </div>
          </div>

          {/* Section 7 — Synthèse PnL */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Synthèse PnL</h3>
            <Card accent="#534AB7" style={{padding:14, background:"#fafaf7"}}>
              <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
                {mandat.short} présente un <strong>profil financier solide</strong> sur la dimension P&L, avec une marge brute Q3 stable à 62%, un EBITDA retraité à 19,9% (Q2 du benchmark sectoriel) et une croissance du CA à +18% CAGR sur 3 ans (Q3). La marge nette de 12% se situe également dans le quartile supérieur du secteur. La trajectoire de profitabilité absolue est positive sur toute la période : le résultat net progresse de +25% CAGR, plus rapidement que le CA, signalant un début d'effet de levier opérationnel.
              </p>
              <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
                Le <strong>red flag structurel</strong> reste la concentration clients top-3 à 62% du CA, qui dépasse significativement le seuil P75 du secteur (45%). Atténuation possible si les contrats hospitaliers PSP et Pharmacie Centrale s'avèrent récurrents et indexés — cartographie clients prioritaire en DD financière et commerciale.
              </p>
              <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
                La <strong>fiabilité des données</strong> est limitée par l'absence de certification CAC sur les exercices 2023 et 2024. Les retraitements EBITDA appliqués (-40M FCFA par an, soit -8 à -9% de l'EBITDA déclaré) sont conservateurs et compatibles avec les normes du fonds. Le profil financier est <strong>compatible avec la fourchette ticket {mandat.ticket}</strong> et avec les hypothèses de valorisation indicatives 11-14M USD pré-money (cf. §1 Résumé exécutif).
              </p>
            </Card>
          </div>

          {/* Section 8 — Notes complémentaires (accordion) */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Notes complémentaires</h3>
            {[
              {
                title:"Évolution du CA et drivers de croissance",
                body:"La croissance organique de +18% CAGR est portée à 70% par la conquête de nouveaux contrats hospitaliers (passage de 4 à 12 AO actifs entre 2022 et 2025) et à 30% par l'effet de répétition sur les molécules essentielles déjà au portefeuille. Le mix produits évolue progressivement vers les antipaludéens (+CAGR 22%) et les antihypertenseurs (+CAGR 25%) au détriment des antalgiques génériques (CAGR +12%) plus exposés à la concurrence des importations. Le canal privé officinal contribue à 38% de la croissance malgré une part de CA inférieure (40%), signe d'une dynamique commerciale forte sur ce segment via les 3 grossistes-répartiteurs. La capacité de production sous-utilisée à 62% absorbe sans CAPEX une croissance de volume jusqu'à 50M unités/an — la nouvelle ligne de production cofinancée par l'opération viendra prendre le relais à partir de 2027.",
              },
              {
                title:"Analyse de la marge brute",
                body:"La stabilité de la marge brute à 62% sur 3 années consécutives est un signal de discipline opérationnelle. Le coût des ventes représente 38% du CA et est dominé par les API (55%), les excipients (14%), le conditionnement (9%), la main-d'œuvre directe (14%) et l'énergie (9%) — cf. §6 Unit economics. Le risque principal sur la marge brute est la sensibilité au prix des API indiens : une hausse de +20% des prix d'achat dégraderait la marge contribution unitaire de 41 à 35 FCFA et la marge brute déclarée de 62% à 58%. Couverture forward partielle sur 30% des approvisionnements et diversification fournisseurs (Cipla, Dr. Reddy's, Aurobindo) atténuent ce risque mais ne le neutralisent pas complètement. Recommandation DD : valider les contrats cadres en cours et la stratégie de stockage de sécurité (3 mois sur API critiques aujourd'hui).",
              },
              {
                title:"EBITDA retraité — méthodologie et retraitements",
                body:"L'EBITDA retraité est obtenu par déduction de deux postes : (i) -30M FCFA par an de rémunération dirigeant non déclarée, calculée comme l'écart entre le ratio masse salariale / CA observé (16%) et la médiane sectorielle ajustée à 17% incluant rémunération dirigeant complète, soit 1 point de CA = 30M FCFA en 2025 ; (ii) -10M FCFA par an de charges non récurrentes / personnelles identifiées par revue analytique (véhicule Land Cruiser, assurances surdimensionnées SCI Kouassi, frais de représentation atypiques). Total retraitement -40M FCFA, soit -7,7% de l'EBITDA déclaré 2025. EBITDA retraité 2025 = 480M FCFA, marge 19,9%. Le retraitement est conservateur et conforme aux pratiques de retraitement standard sur PME africaines. Recouper en DD avec audit des conventions réglementées (cf. §2 Actionnariat & gouvernance) et examen détaillé des comptes 626 et 628 SYSCOHADA.",
              },
              {
                title:"Taux d'imposition et conformité fiscale",
                body:"Le taux effectif d'IS observé (~19%) est inférieur de 6 points au taux légal (25%) et appelle une investigation DD. Trois pistes explicatives : déductions standards (amortissement linéaire des équipements industriels, prorata temporis sur le bail commercial, charges externes déductibles), amortissement accéléré sur les nouveaux équipements installés en 2023-2024 (4 ans au lieu de 8), et un possible bénéfice partiel du régime Code des investissements 2018 (exonération IS 5 ans sur les nouveaux investissements > 500M FCFA, à condition de maintien des emplois). Risques fiscaux à investiguer : exhaustivité des déclarations TVA mensuelles, état des cotisations CNPS et IPRES, conformité du retraitement de la masse salariale dirigeant (qui reclasse une partie des charges en loyers SCI Kouassi — risque de requalification fiscale en avantage en nature dirigeant).",
              },
              {
                title:"Benchmarks et positionnement sectoriel",
                body:"Le positionnement de la société dans le panel pharma UEMOA (14 entreprises, données IFC 2024) est cohérent avec un profil de challenger en phase de scale-up. La marge brute (62%, Q3), la marge EBITDA déclarée (21,6%, Q3) et la marge nette (12%, Q3) placent la société dans le tercile supérieur sur l'ensemble des indicateurs de profitabilité. La marge EBITDA retraitée (19,9%) reste juste au niveau de la médiane (20%, Q2), ce qui constitue le principal point de vigilance sur la performance ajustée. La croissance du CA (+18% CAGR) est exceptionnelle dans le secteur (médiane +15% sur l'ensemble du panel) et témoigne d'une exécution commerciale supérieure. Le seul indicateur négatif structurel reste la concentration clients top-3 à 62% — au-delà du P75 sectoriel (45%) — qui doit être adressée en priorité en DD.",
              },
            ].map((n, i) => (
              <Card key={i} style={{padding:0, marginBottom:6, overflow:"hidden"}}>
                <div onClick={() => setOpenNote(openNote === i ? null : i)} style={{padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
                  <span style={{fontSize:12.5, fontWeight:600, color:"#333"}}>{i+1}. {n.title}</span>
                  <span style={{fontSize:11, color:"#888", fontWeight:700, transition:"transform 0.15s", transform:openNote===i?"rotate(90deg)":"none"}}>▶</span>
                </div>
                {openNote === i && (
                  <div style={{padding:"0 14px 14px", fontSize:11.5, color:"#444", lineHeight:1.7, borderTop:"1px solid #F1EFE8", paddingTop:12}}>
                    {n.body}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Source des données : liasses SYSCOHADA 2023-2024 (non certifiées) + liasse 2025 en cours d'audit par CAC nouvellement désigné. Retraitements EBITDA estimatifs calibrés sur entretien DAF du 12/04 et revue analytique des comptes 64-65-67. Concentration clients red flag actif. Tous les chiffres marqués sont à recouper en DD financière.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function BilanPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 9);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>États financiers Bilan</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* Section 1 — Bilan simplifié */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>États financiers — Bilan et trésorerie</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Bilan simplifié 3 ans — SYSCOHADA</h3>

            {/* ACTIF */}
            <div style={{fontSize:11, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6}}>Actif</div>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:3}}>FCFA (M)</div>
                <div style={{flex:1, textAlign:"right"}}>2023</div>
                <div style={{flex:1, textAlign:"right"}}>2024</div>
                <div style={{flex:1, textAlign:"right"}}>2025</div>
                <div style={{flex:1.4, textAlign:"right"}}>Évolution</div>
              </div>
              {[
                {l:"Immobilisations nettes", v:["480","420","380"], delta:"-21%", bold:true, deltaColor:"#BA7517"},
                {l:"équipements production", v:["320","290","260"], delta:"Amort. linéaire", indent:true, italic:true},
                {l:"agencements", v:["100","85","75"], delta:"Salle blanche BPF", indent:true, italic:true},
                {l:"matériel roulant", v:["60","45","45"], delta:"Land Cruiser SCI ⚠", indent:true, italic:true, warn:true},
                {l:"Stocks", v:["180","210","250"], delta:"+39%", bold:true, deltaColor:"#1D9E75"},
                {l:"API + excipients", v:["110","130","160"], delta:"1 mois de prod.", indent:true, italic:true},
                {l:"produits finis", v:["70","80","90"], delta:"Stock tampon", indent:true, italic:true},
                {l:"Créances clients", v:["280","320","360"], delta:"+29%", bold:true, deltaColor:"#BA7517"},
                {l:"créances PSP", v:["230","260","288"], delta:"80% des créances ⚠", indent:true, italic:true, warn:true},
                {l:"créances grossistes", v:["50","60","72"], delta:"Paiement 15-30j", indent:true, italic:true},
                {l:"Autres actifs courants", v:["110","130","170"], delta:"+55%", bold:true, deltaColor:"#BA7517"},
                {l:"Trésorerie", v:["50","70","40"], delta:"Volatile", bold:true, deltaColor:"#D85A30"},
                {l:"TOTAL ACTIF", v:["1 100","1 150","1 200"], delta:"+9%", bold:true, deltaColor:"#1D9E75", total:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"7px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", background:r.total?"#EEEDFE":r.bold?"#fafaf7":"transparent"}}>
                  <div style={{flex:3, paddingLeft:r.indent?16:0, fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.total?"#534AB7":"#333"}}>{r.l}</div>
                  {r.v.map((v, vi) => (
                    <div key={vi} style={{flex:1, textAlign:"right", fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.total?"#534AB7":"#333"}}>{v}</div>
                  ))}
                  <div style={{flex:1.4, textAlign:"right", fontSize:10, fontWeight:r.bold?700:400, color:r.warn?"#A32D2D":r.deltaColor||"#888", fontStyle:r.italic?"italic":"normal"}}>{r.delta}</div>
                </div>
              ))}
            </div>

            {/* PASSIF */}
            <div style={{fontSize:11, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6}}>Passif</div>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:3}}>FCFA (M)</div>
                <div style={{flex:1, textAlign:"right"}}>2023</div>
                <div style={{flex:1, textAlign:"right"}}>2024</div>
                <div style={{flex:1, textAlign:"right"}}>2025</div>
                <div style={{flex:1.4, textAlign:"right"}}>Évolution</div>
              </div>
              {[
                {l:"Capitaux propres", v:["420","560","720"], delta:"+71%", bold:true, deltaColor:"#1D9E75"},
                {l:"capital social", v:["50","50","50"], delta:"Stable", indent:true, italic:true},
                {l:"réserves + RAN", v:["186","282","380"], delta:"Rétention profits", indent:true, italic:true},
                {l:"résultat exercice", v:["184","228","290"], delta:"", indent:true, italic:true},
                {l:"Dettes financières MLT", v:["300","260","220"], delta:"-27%", bold:true, deltaColor:"#1D9E75"},
                {l:"prêt MLT NSIA", v:["300","260","220"], delta:"Taux 9.5% · Éch. 2028", indent:true, italic:true},
                {l:"Facilité de caisse NSIA", v:["150","120","100"], delta:"Renouvellement annuel", bold:true, deltaColor:"#888"},
                {l:"Dettes fournisseurs", v:["160","140","120"], delta:"-25%", bold:true, deltaColor:"#BA7517"},
                {l:"Autres passifs courants", v:["70","70","40"], delta:"-43%", bold:true, deltaColor:"#1D9E75"},
                {l:"TOTAL PASSIF", v:["1 100","1 150","1 200"], delta:"Équilibré ✓", bold:true, deltaColor:"#1D9E75", total:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"7px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", background:r.total?"#EEEDFE":r.bold?"#fafaf7":"transparent"}}>
                  <div style={{flex:3, paddingLeft:r.indent?16:0, fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.total?"#534AB7":"#333"}}>{r.l}</div>
                  {r.v.map((v, vi) => (
                    <div key={vi} style={{flex:1, textAlign:"right", fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.italic?"#888":r.total?"#534AB7":"#333"}}>{v}</div>
                  ))}
                  <div style={{flex:1.4, textAlign:"right", fontSize:10, fontWeight:r.bold?700:400, color:r.deltaColor||"#888", fontStyle:r.italic?"italic":"normal"}}>{r.delta}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 — Analyse du BFR */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Analyse du BFR</h3>

            {/* KPIs BFR */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8, marginBottom:14}}>
              {[
                {label:"BFR 2025", value:"490M", sub:"17.4% du CA", color:"#534AB7"},
                {label:"Jours clients", value:"46j", sub:"vs 30j contractuels", color:"#BA7517"},
                {label:"Jours stocks", value:"32j", sub:"normatif, cible 60j", color:"#1D9E75"},
                {label:"Jours fournisseurs", value:"15j", sub:"court, achats spot", color:"#BA7517"},
                {label:"BFR/CA méd. secteur", value:"12%", sub:"⚠ écart sectoriel", color:"#D85A30", warn:true},
              ].map((k, i) => (
                <div key={i} style={{padding:12, background:k.warn?"#FBE6DC":"#fff", borderRadius:8, border:`1px solid ${k.warn?"#D85A30":"#F1EFE8"}`, textAlign:"center"}}>
                  <div style={{fontSize:9.5, color:"#888", marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:18, fontWeight:700, color:k.color}}>{k.value}</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:3, lineHeight:1.4}}>{k.sub}</div>
                </div>
              ))}
            </div>

            <p style={{margin:"0 0 12px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le BFR de la société progresse de manière continue depuis 3 ans, passant de 14% du CA en 2023 à <strong>17,4% en 2025</strong>, soit 5 points au-dessus de la médiane sectorielle pharma UEMOA (12%). La hausse est principalement tirée par les créances clients (+29% sur 3 ans), dont <strong>80% concernent la PSP (Pharmacie de la Santé Publique)</strong>. Sur les 360M FCFA de créances 2025, environ <strong>90M FCFA sont en retard de plus de 90 jours</strong>, en cohérence avec les délais de paiement effectifs du secteur public ivoirien (90-120j vs 30j contractuels).
            </p>
            <p style={{margin:"0 0 14px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Cette dynamique est <strong>structurelle au secteur</strong> et ne traduit pas une dégradation de la qualité du portefeuille clients. Toutefois, elle pèse sur la trésorerie disponible et limite la flexibilité opérationnelle. L'injection de capital prévue par l'opération doit absorber 15% du ticket en fonds de roulement (cf. §1 Résumé exécutif), soit environ 413M FCFA dédiés à la résorption progressive du BFR vers la médiane sectorielle.
            </p>

            {/* Décomposition BFR */}
            <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Décomposition du BFR</div>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              <div style={{display:"flex", padding:"8px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:3}}>Composante</div>
                <div style={{flex:1, textAlign:"right"}}>2023</div>
                <div style={{flex:1, textAlign:"right"}}>2025</div>
                <div style={{flex:2.5}}>Commentaire</div>
              </div>
              {[
                {l:"(+) Stocks", v23:"180", v25:"250", delta:"+39%", note:"Hausse cohérente avec la croissance volume", bold:false},
                {l:"(+) Créances clients", v23:"280", v25:"360", delta:"+29%", note:"PSP ⚠ — 80% du portefeuille", bold:false, warn:true},
                {l:"(-) Dettes fournisseurs", v23:"-160", v25:"-120", delta:"-25%", note:"Achats spot, peu de crédit fournisseur", bold:false},
                {l:"BFR", v23:"300", v25:"490", delta:"+63%", note:"Progression supérieure au CA", bold:true},
                {l:"BFR / CA", v23:"15%", v25:"17.4%", delta:"vs médiane 12%", note:"Quartile Q4 défavorable", bold:true, italic:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"8px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.bold?"#fafaf7":"transparent"}}>
                  <div style={{flex:3, fontWeight:r.bold?700:400, fontStyle:r.italic?"italic":"normal", color:r.warn?"#A32D2D":r.italic?"#888":"#333"}}>{r.l}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:r.bold?700:400, color:r.italic?"#888":"#666"}}>{r.v23}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:r.bold?700:400, color:r.italic?"#888":"#333"}}>{r.v25}</div>
                  <div style={{flex:2.5, fontSize:10, color:r.warn?"#A32D2D":"#888", paddingLeft:8, fontStyle:"italic"}}>{r.delta} · {r.note}</div>
                </div>
              ))}
            </div>

            {/* Leviers */}
            <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Leviers de réduction du BFR</div>
            {[
              {n:1, title:"Affacturage créances PSP", body:"Mise en place d'un contrat d'affacturage avec NSIA Banque sur les créances PSP-CI. Coût estimé 3-4% face value, soit 8-12M FCFA/an. Effet immédiat sur la trésorerie : avance jusqu'à 80% des créances éligibles, réduction de 30 jours sur le cycle de cash."},
              {n:2, title:"Extension canal privé", body:"Augmentation de la part du canal privé de 40% à 50% du CA d'ici 2027. Effet mécanique sur les jours clients blended : passage de 46j à 38j. Cohérent avec le plan commercial (200 pharmacies cibles vs 80 aujourd'hui)."},
              {n:3, title:"Contrats-cadres fournisseurs API", body:"Négociation de contrats-cadres avec les 3 API indiens principaux (Cipla, Dr. Reddy's, Aurobindo) pour obtenir 30-45 jours de crédit fournisseur vs 15j en achat spot aujourd'hui. Effet : +30M FCFA de crédit fournisseur permanent."},
              {n:4, title:"Stock tampon API", body:"Renforcement du stock de sécurité API de 1 à 2 mois sur les molécules critiques (paracétamol, amoxicilline, artéméther). Réduit le risque de rupture en AO mais augmente le BFR de 50-70M FCFA. Trade-off à arbitrer en DD opérationnelle."},
            ].map(l => (
              <div key={l.n} style={{display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderTop:l.n>1?"1px solid #f8f8f6":"none"}}>
                <span style={{padding:"3px 9px", borderRadius:10, fontSize:11, fontWeight:700, background:"#EEEDFE", color:"#534AB7", flexShrink:0, marginTop:1}}>{l.n}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:3}}>{l.title}</div>
                  <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{l.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Section 3 — Endettement */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Endettement</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:14}}>
              {[
                {label:"Dette nette / EBITDA", value:"0.88x", sub:"vs seuil 2x", color:"#1D9E75"},
                {label:"Gearing (D/E)", value:"0.44x", sub:"vs seuil 1.5x", color:"#1D9E75"},
                {label:"Désendettement 3 ans", value:"1.6x → 0.88x", sub:"Trajectoire vertueuse", color:"#1D9E75"},
                {label:"Capacité emprunt résiduelle", value:"~680M", sub:"Marge d'endettement", color:"#534AB7"},
              ].map((k, i) => (
                <div key={i} style={{padding:12, background:"#fff", borderRadius:8, border:"1px solid #F1EFE8", textAlign:"center"}}>
                  <div style={{fontSize:9.5, color:"#888", marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:k.value.length>8?14:18, fontWeight:700, color:k.color, lineHeight:1.2}}>{k.value}</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:3, lineHeight:1.4}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              La dette totale est <strong>exclusivement bancaire</strong> (prêt MLT NSIA + facilité de caisse) — aucune dette informelle, prêt actionnaire ou compte courant n'apparaît au passif. Le désendettement est naturel via le remboursement annuel du prêt MLT (montant indexé sur la trésorerie disponible) combiné à la croissance de l'EBITDA. La capacité d'emprunt résiduelle, calculée sur un seuil prudentiel de Dette nette / EBITDA = 2x, s'élève à environ <strong>680M FCFA</strong>, soit ~50% du tour de table envisagé. Cette flexibilité bilancielle constitue une réserve de financement utile pour le plan d'expansion sénégalais sans compromettre la solidité du bilan.
            </p>
          </div>

          {/* Section 4 — Trésorerie */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Analyse de la trésorerie</h3>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              La trésorerie disponible est <strong>volatile</strong> sur les 3 derniers exercices (50M en 2023, 70M en 2024, 40M en 2025), avec des creux récurrents en fin de trimestre alignés sur les échéances fiscales (TVA, IS) et les remboursements MLT. Le solde minimum observé sur 12 mois est de <strong>15M FCFA</strong>, bien en dessous du seuil de confort opérationnel estimé à <strong>55M FCFA</strong> (équivalent à 1 mois de masse salariale + 0,5 mois de charges externes). Le free cash flow opérationnel ressort à <strong>~180M FCFA/an</strong> (EBITDA retraité - CAPEX maintenance - intérêts - IS), avec un CAPEX maintenance régulier de 30M/an. Le free cash flow disponible <strong>~150M FCFA/an</strong> couvre le service de la dette (144M/an de remboursement MLT + intérêts) mais ne laisse pas de marge significative pour absorber un choc de BFR ou un imprévu opérationnel. L'injection en capital de l'opération vient sécuriser ce point.
            </p>
          </div>

          {/* Section 5 — Red flags bilan et conclusion */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Red flags bilan et conclusion</h3>
            <div style={{padding:"6px 14px", borderRadius:14, fontSize:11.5, fontWeight:700, color:"#1D9E75", background:"#EAF3DE", display:"inline-block", marginBottom:12, letterSpacing:0.3}}>
              Pas de red flag financier majeur — Pas de dettes cachées ou informelles
            </div>
            <p style={{margin:"0 0 10px", fontSize:12, color:"#444", lineHeight:1.7}}>2 points de vigilance identifiés :</p>
            {[
              {
                title:"BFR en hausse continue (14% → 17.4% du CA)",
                body:"Tirée principalement par les créances PSP (80% des créances clients). Cible post-investissement : ramener le BFR sous 14% du CA dans les 18 mois post-closing via les 4 leviers identifiés (affacturage, canal privé, contrats-cadres fournisseurs, optimisation stocks).",
              },
              {
                title:"Trésorerie volatile avec creux dangereux",
                body:"Solde minimum 15M FCFA observé, soit nettement sous le seuil de confort opérationnel de 55M. L'injection en capital prévue par l'opération résout structurellement ce problème : la part fonds de roulement (15% du ticket = ~413M FCFA) couvre le BFR additionnel et reconstitue un coussin de trésorerie au-delà de 6 mois de charges fixes.",
              },
            ].map((p, i) => (
              <Card key={i} accent="#BA7517" style={{padding:12, marginBottom:8, background:"#FFF8F0"}}>
                <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                  <span style={{color:"#BA7517", fontSize:14, fontWeight:700, flexShrink:0}}>·</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:4}}>{p.title}</div>
                    <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>{p.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Section 6 — VNA */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Valeur nette d'actif / VNA</h3>
            <Card accent="#534AB7" style={{padding:14, background:"#fafaf7"}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9.5, color:"#888", marginBottom:3}}>Capitaux propres 2025</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#534AB7"}}>720M FCFA</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:2}}>Valeur comptable</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9.5, color:"#888", marginBottom:3}}>Pre-money indicatif</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#534AB7"}}>10-14M EUR</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:2}}>≈ 6.5-9.2 Mds FCFA</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9.5, color:"#888", marginBottom:3}}>Multiple capitaux propres</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#534AB7"}}>9-13x</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:2}}>Goodwill implicite ~90%</div>
                </div>
              </div>
              <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>
                Le multiple Pre-money / Capitaux propres de <strong>9-13x</strong> est cohérent avec un profil de croissance soutenue (CAGR +18%), un moat réglementaire défensif (3 couches de barrières BPF), et une capacité de production sous-utilisée à 62% qui constitue une option de croissance gratuite. Le goodwill implicite de ~90% reflète la valeur des actifs intangibles non comptabilisés : portefeuille de 42 AMM, certifications BPF, relations clients institutionnels établies, base AO récurrente.
              </p>
            </Card>
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Données issues des liasses SYSCOHADA 2023-2025 et des relevés bancaires NSIA sur 12 mois glissants. Ratios calculés sur le périmètre de la SARL PharmaCi (hors SCI Kouassi). Bilan 2023-2024 non certifié, exercice 2025 en cours d'audit.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function ThesePage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 10);
  const [openNote, setOpenNote] = useState(null);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Thèse d'investissement</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* Section 1 — Pourquoi investir : 5 arguments */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Thèse d'investissement</h2>
            <h3 style={{margin:"4px 0 18px", fontSize:14, color:"#534AB7", fontWeight:700}}>Pourquoi investir — 5 arguments structurés</h3>

            {[
              {
                n:1, color:"#534AB7", bg:"#EEEDFE",
                title:"Positionnement sectoriel défensif dans le marché ivoirien, plateforme UEMOA structurante",
                bullets:[
                  "La Côte d'Ivoire représente ~40% du PIB UEMOA et concentre les flux logistiques régionaux (port d'Abidjan = hub maritime n°1 de l'Afrique de l'Ouest francophone)",
                  "Croissance des PME logistiques régionales estimée entre 10 et 25%/an sur l'horizon 2026-2030, soutenue par la digitalisation des chaînes d'approvisionnement",
                  "Demande contra-cyclique : les flux logistiques essentiels (santé, agroalimentaire, distribution) sont peu sensibles aux ralentissements macroéconomiques",
                  "Barrières d'entrée réglementaires significatives (agréments OOAS, certifications BPF, AMM nationales et UEMOA, historique de fourniture exigé sur AO publics)",
                  "Alignement avec la thèse de fonds Adiwale Partners : positionnement mid-market UEMOA, profils familial-industriels, secteurs essentiels à fort impact réel",
                ],
              },
              {
                n:2, color:"#185FA5", bg:"#E3EDF7",
                title:"EBITDA retraité positif, marge dans le benchmark sectoriel — sous réserve de confirmation DD",
                bullets:[
                  "EBITDA déclaré 520M FCFA en 2025 [non vérifié DD], EBITDA retraité estimé à 480M FCFA après application des retraitements standards",
                  "Retraitements appliqués cohérents avec les pratiques sectorielles PME logistique/pharma CI : rémunération dirigeant non déclarée (-30M), charges non récurrentes ou personnelles (-10M)",
                  "Marge EBITDA retraitée 19,9% positionnée dans la fourchette cible benchmark sectoriel (15-30%, médiane 20% pour la pharma UEMOA)",
                  "Red flag documentaire actif (liasses 2023-2024 non certifiées) — pénalité de scoring estimée à -5 points sur la note ESONO globale jusqu'à régularisation CAC",
                ],
              },
              {
                n:3, color:"#1D9E75", bg:"#EAF3DE",
                title:"Structuration equity pure, alignée sur les intérêts du dirigeant, sans risque de service de dette post-closing",
                bullets:[
                  "Augmentation de capital equity pure proposée — pas de dette mezzanine, pas de preferred shares ni de mécanismes de remboursement contraignants",
                  "Pre-money indicatif 10-14M EUR (8-10x EBITDA retraité [non vérifié DD]), participation visée 19-24% post-money (minoritaire actif protégé)",
                  "Ticket révisé à 3,2M EUR (vs fourchette pre-screening initiale 4-6M EUR) — réconciliation nécessaire avant IC2 entre les besoins en fonds (CAPEX, BFR, expansion) et la dilution acceptable du fondateur",
                  "Bilan post-closing désendetté avec capacité d'emprunt résiduelle ~680M FCFA pour absorber les phases d'investissement futures sans nouvelle dilution",
                ],
              },
              {
                n:4, color:"#BA7517", bg:"#FFF8F0",
                title:"Rendements attractifs avec protection du capital dans tous les scénarios, sensibilité WACC maîtrisée",
                bullets:[
                  "Scénario base : MOIC 2,8x / IRR 22% sur horizon 5-7 ans — cohérent avec les benchmarks fonds africains mid-market sur la période 2018-2024",
                  "Scénario bear : MOIC 1,8x / IRR 12% — capital pleinement protégé même en cas de stagnation du marché et d'absence d'expansion régionale",
                  "Scénario bull : MOIC 4,1x / IRR 33% — sur exécution complète du plan d'expansion régionale (CI + SN + BF)",
                  "WACC UEMOA PME 16-22% — sensibilité testée, valorisation pre-money résiliente jusqu'à WACC 25%",
                ],
              },
              {
                n:5, color:"#D85A30", bg:"#FBE6DC",
                title:"Dirigeant aligné, gouvernance post-deal structurée avec protections minoritaires standards AUSCGIE",
                bullets:[
                  "Siège au Conseil d'Administration garanti pour le fonds + désignation d'un administrateur indépendant sectoriel proposé par le fonds",
                  "Droits de veto sur les décisions stratégiques : CAPEX > 100M FCFA, nouvel endettement > 1x EBITDA, cessions d'actifs significatifs, rémunération du DG",
                  "Reporting financier trimestriel certifié + reporting opérationnel mensuel sur les indicateurs clés (carnet de commandes, cash position, top clients)",
                  "Clauses tag-along, drag-along et droit de première offre conformes aux standards AUSCGIE OHADA — protections minoritaires usuelles dans la zone",
                ],
              },
            ].map(arg => (
              <Card key={arg.n} style={{padding:14, marginBottom:10, background:arg.bg, borderLeft:`3px solid ${arg.color}`}}>
                <div style={{display:"flex", gap:14, alignItems:"flex-start"}}>
                  <div style={{width:34, height:34, borderRadius:17, background:arg.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, flexShrink:0}}>
                    {arg.n}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:700, color:"#333", marginBottom:8, lineHeight:1.4}}>{arg.title}</div>
                    <ul style={{margin:0, paddingLeft:18, fontSize:11.5, color:"#444", lineHeight:1.7}}>
                      {arg.bullets.map((b, i) => (<li key={i} style={{marginBottom:3}}>{b}</li>))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Section 2 — Structuration proposée */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Structuration proposée</h3>

            {/* Fiche structuration */}
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:1}}>Paramètre</div>
                <div style={{flex:2}}>Valeur</div>
              </div>
              {[
                {
                  param:"Pre-money", value:"10-14M EUR",
                  detail:"8-10x EBITDA retraité [non vérifié DD]",
                  highlight:true,
                },
                {
                  param:"Ticket", value:"3,2M EUR",
                  detail:"Equity pure · inférieur à la fourchette pre-screening initiale 4-6M EUR",
                  highlight:false, warn:true,
                },
                {
                  param:"Participation", value:"19-24% post-money",
                  detail:"Minoritaire actif",
                  highlight:false,
                },
                {
                  param:"Horizon", value:"5-7 ans",
                  detail:"Sortie cible 2031-2033",
                  highlight:false,
                },
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.warn?"#FFF8F0":r.highlight?"#EEEDFE":"transparent"}}>
                  <div style={{flex:1, fontWeight:600, color:"#333"}}>{r.param}</div>
                  <div style={{flex:2}}>
                    <div style={{fontSize:13, fontWeight:700, color:r.warn?"#A32D2D":r.highlight?"#534AB7":"#333"}}>{r.value}</div>
                    <div style={{fontSize:10, color:"#888", fontStyle:"italic", marginTop:2}}>{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <p style={{margin:"0 0 14px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Structuration en <strong>equity pure</strong> sans dette mezzanine ni preferred shares, conformément à la demande du dirigeant qui recherche un partenaire stratégique de long terme plutôt qu'un financement structurellement contraignant. Cette structuration permet d'aligner les intérêts financiers entre le fondateur et le fonds tout en préservant la trésorerie opérationnelle pour absorber le BFR et financer l'expansion régionale.
            </p>

            {/* Gouvernance post-deal */}
            <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Gouvernance post-deal</div>
            <Card style={{padding:14, background:"#fafaf7"}}>
              <ul style={{margin:0, paddingLeft:18, fontSize:11.5, color:"#444", lineHeight:1.8}}>
                <li>Siège au Conseil d'Administration</li>
                <li>Désignation d'un administrateur indépendant sectoriel proposé par le fonds</li>
                <li>Droits de veto sur CAPEX significatifs, nouvel endettement, cessions et rémunération du DG</li>
                <li>Reporting trimestriel financier certifié + reporting mensuel opérationnel</li>
                <li>Clauses tag-along, drag-along (standards AUSCGIE OHADA)</li>
                <li>Droit de première offre sur toute cession future de titres par le fondateur</li>
                <li>Audit annuel certifié obligatoire par CAC inscrit OEC-CI</li>
              </ul>
            </Card>
          </div>

          {/* Section 3 — Scénarios de sortie */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Scénarios de sortie</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14}}>
              {[
                {
                  label:"Bear case", subtitle:"Marché stagne",
                  moic:"1.8x", irr:"IRR 12%",
                  rows:[
                    ["Croissance CA", "8%/an"],
                    ["Expansion régionale", "Pas d'expansion"],
                    ["Sortie", "6x EBITDA · cession industrielle"],
                    ["Valorisation sortie", "~18M EUR [non vérifié DD]"],
                    ["Capital", "Protégé"],
                  ],
                  color:"#666", bg:"#fafaf7", border:"#888",
                },
                {
                  label:"Base case", subtitle:"Exécution du plan",
                  moic:"2.8x", irr:"IRR 22%",
                  rows:[
                    ["Croissance CA", "15%/an"],
                    ["Expansion régionale", "Partielle sous-régionale"],
                    ["Sortie", "8x EBITDA · trade sale / secondaire"],
                    ["Valorisation sortie", "~32M EUR [non vérifié DD]"],
                    ["Repreneur cible", "AfricInvest, Amethis"],
                  ],
                  color:"#534AB7", bg:"#EEEDFE", border:"#534AB7",
                  highlight:true,
                },
                {
                  label:"Bull case", subtitle:"Expansion réussie",
                  moic:"4.1x", irr:"IRR 33%",
                  rows:[
                    ["Croissance CA", "22%/an"],
                    ["Expansion régionale", "CI + SN + BF complète"],
                    ["Sortie", "10x EBITDA · prime croissance"],
                    ["Valorisation sortie", "~50M EUR [non vérifié DD]"],
                    ["Multiple", "Hors fourchette standard"],
                  ],
                  color:"#1D9E75", bg:"#EAF3DE", border:"#1D9E75",
                },
              ].map((s, i) => (
                <Card key={i} style={{padding:14, background:s.bg, borderLeft:`3px solid ${s.border}`, position:"relative"}}>
                  {s.highlight && (
                    <div style={{position:"absolute", top:-8, right:10, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:s.border, letterSpacing:0.5}}>SCÉNARIO CENTRAL</div>
                  )}
                  <div style={{fontSize:12, fontWeight:700, color:s.color, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2}}>{s.label}</div>
                  <div style={{fontSize:11, color:"#888", fontStyle:"italic", marginBottom:10}}>« {s.subtitle} »</div>
                  <div style={{padding:"10px 0", borderTop:`1px solid ${s.border}40`, borderBottom:`1px solid ${s.border}40`, marginBottom:10, textAlign:"center"}}>
                    <div style={{fontSize:24, fontWeight:700, color:s.color, lineHeight:1.1}}>{s.moic}</div>
                    <div style={{fontSize:11, color:s.color, fontWeight:600, marginTop:2}}>{s.irr}</div>
                  </div>
                  {s.rows.map(([k, v], j) => (
                    <div key={j} style={{display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:10.5, borderBottom:j<s.rows.length-1?"1px solid #f8f8f6":"none", gap:8}}>
                      <span style={{color:"#888"}}>{k}</span>
                      <span style={{fontWeight:600, color:"#333", textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            <Card style={{padding:14, background:"#fafaf7"}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Type de sortie envisagé</div>
              <p style={{margin:0, fontSize:11.5, lineHeight:1.7, color:"#444"}}>
                <strong>Sortie primaire</strong> envisagée à horizon 5-7 ans via une <strong>cession à un opérateur logistique régional ou panafricain</strong> en stratégie de consolidation sectorielle (acteur indien, marocain, sud-africain, ou groupe panafricain en construction). <strong>Sortie secondaire</strong> via revente à un fonds de capital-investissement de taille supérieure (typiquement <strong>AfricInvest, Amethis, Mediterrania Capital</strong>) en cas de poursuite du plan d'expansion. <strong>IPO BRVM</strong> théoriquement envisageable à horizon 7+ ans mais peu probable au regard de la taille de la société et des contraintes de liquidité du marché régional. <strong>Valorisation de sortie en scénario base ~32M EUR</strong> à 8x EBITDA retraité année 5 [non vérifié DD], cohérente avec les multiples de transactions M&A observés dans la zone (Pharmivoire 2023 : 8,2x · Strides Africa 2024 : 9,1x).
              </p>
            </Card>
          </div>

          {/* Section 4 — Notes complémentaires */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Notes complémentaires</h3>
            {[
              {
                title:"Cinq arguments d'investissement détaillés",
                body:"Les cinq arguments présentés en partie 1 répondent aux quatre dimensions classiques d'une thèse PE mid-market : (i) la qualité du marché et du positionnement (argument 1), (ii) la solidité des fondamentaux financiers et leur scalabilité (arguments 2 et 4), (iii) la qualité de la structuration et de la gouvernance (arguments 3 et 5), et (iv) la capacité de génération de rendement ajusté du risque (argument 4). L'absence de risques rédhibitoires identifiés au stade du pré-screening 360°, combinée à un score d'adéquation fonds de 83% (5/6 critères Match), justifie le passage en instruction approfondie. Les trois zones de risque résiduel (concentration clients top-3 à 62%, EBITDA retraité juste sous la médiane sectorielle, gouvernance familiale à structurer) sont toutes adressables dans le cadre de la due diligence et du plan 100 jours post-closing.",
              },
              {
                title:"Stratégie de sortie",
                body:"La stratégie de sortie privilégie un horizon de 5 à 7 ans avec un objectif central de cession à un opérateur industriel régional ou panafricain dans le cadre d'un mouvement de consolidation sectorielle. Trois canaux de sortie sont identifiés et hiérarchisés : (1) cession industrielle à un acteur stratégique (Cipla Africa, Aurobindo, Saidal, Mylan/Viatris, Adcock Ingram) dans le cadre de leur stratégie d'implantation en Afrique de l'Ouest francophone — scénario privilégié au regard du moat BPF et du portefeuille AMM, (2) cession secondaire à un fonds de taille supérieure (AfricInvest IV, Amethis Africa Fund III, Mediterrania Capital IV) cherchant à scaler une plateforme régionale — scénario probable si le plan d'expansion est partiellement exécuté, (3) IPO BRVM peu probable mais théoriquement envisageable au-delà de 7 ans si la BRVM atteint une liquidité suffisante. Le multiple de sortie cible base case 8x EBITDA retraité est conservateur au regard des comparables transactionnels (médiane sectorielle 8,2x, range 6,8-9,1x).",
              },
              {
                title:"Conditions préalables à IC2 (3 conditions non négociables)",
                body:"L'instruction du dossier en IC2 est conditionnée à la levée stricte de trois conditions identifiées comme non négociables par le MD : (1) Cartographie clients top-10 avec ancienneté contractuelle, taux de récurrence des AO et part de CA — la concentration top-3 doit être démontrée comme étant majoritairement composée d'AO récurrents (>70% de récurrence) ; à défaut, le dossier passe en Hold, (2) Confirmation de la rémunération dirigeant retraitée par audit ou certification du commissaire aux comptes nouvellement désigné — l'EBITDA retraité minimum acceptable est de 18% (vs 19,9% actuel) ; en deçà, deal breaker, (3) Engagement écrit signé du fondateur sur le plan de structuration de gouvernance 100 jours, incluant les 6 points convenus en entretien du 8 avril (formalisation CA, recrutement DAF, double signature bancaire, régularisation AG, séparation comptes, assurance homme-clé). Le passage en IC2 ne pourra être proposé tant que ces trois conditions ne sont pas formellement levées et documentées dans le dossier.",
              },
            ].map((n, i) => (
              <Card key={i} style={{padding:0, marginBottom:6, overflow:"hidden"}}>
                <div onClick={() => setOpenNote(openNote === i ? null : i)} style={{padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
                  <span style={{fontSize:12.5, fontWeight:600, color:"#333"}}>{i+1}. {n.title}</span>
                  <span style={{fontSize:11, color:"#888", fontWeight:700, transition:"transform 0.15s", transform:openNote===i?"rotate(90deg)":"none"}}>▶</span>
                </div>
                {openNote === i && (
                  <div style={{padding:"0 14px 14px", fontSize:11.5, color:"#444", lineHeight:1.7, borderTop:"1px solid #F1EFE8", paddingTop:12}}>
                    {n.body}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Validé par", "K. N'Guessan (MD)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Approfondissement structurel post-pré-screening. Chiffres déclaratifs maintenus avec flag [non vérifié DD] dans l'attente de la due diligence financière. Ticket révisé à 3,2M EUR (vs 4-6M EUR pré-screening) suite aux échanges avec le fondateur. 3 conditions préalables à IC2 formalisées et validées par le MD.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function AccompagnementPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 11);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Accompagnement demandé</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* Section 1 — Utilisation des fonds */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 14px", fontSize:18, fontWeight:700}}>Accompagnement et value creation</h2>
            <h3 style={{margin:"0 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Utilisation des fonds détaillée</h3>

            {[
              {
                pct:60, color:"#534AB7", bg:"#EEEDFE",
                title:"Nouvelle ligne de production (CAPEX industriel)",
                amount:"1.92M EUR",
                bullets:[
                  "Fournisseur retenu : Sejong Pharmatech (Corée du Sud) — référent BPF UEMOA pour la zone",
                  "Capacité additionnelle : +50M unités/an (passage de 50M à 100M unités/an au total)",
                  "Délai d'installation et qualification : 9 à 12 mois",
                  "ROI estimatif : payback < 3 ans grâce au levier opérationnel sur les charges fixes",
                  "Acompte initial 40% (0,77M EUR) décaissé en M+2 sur la tranche 1",
                ],
              },
              {
                pct:25, color:"#185FA5", bg:"#E3EDF7",
                title:"Expansion Sénégal",
                amount:"0.80M EUR",
                bullets:[
                  "Ouverture d'un bureau à Dakar (loyer + aménagement) — implantation T2 2027",
                  "Recrutement d'un Directeur Pays Sénégal : budget 15-20M FCFA/an + équipe initiale 4 personnes",
                  "Certification BPF Sénégal : délai 6 à 12 mois post-implantation, prérequis pour accéder aux AO PNA",
                  "Premiers 5 AO PSP/PNA ciblés sur Dakar, Thiès, Saint-Louis",
                  "CA SN prévisionnel année 1 : 300 à 500M FCFA (déclaratif, à confirmer en DD)",
                ],
              },
              {
                pct:15, color:"#1D9E75", bg:"#EAF3DE",
                title:"Fonds de roulement additionnel",
                amount:"0.48M EUR",
                bullets:[
                  "Stock tampon API porté de 1 à 2 mois sur les molécules critiques (paracétamol, amoxicilline, artéméther)",
                  "Exploration d'un contrat d'affacturage NSIA Banque sur les créances PSP",
                  "Cible BFR/CA ramené de 17,4% à <14% à M+12",
                  "Aucune part du ticket allouée au remboursement de dette existante",
                ],
              },
            ].map((u, i) => (
              <Card key={i} style={{padding:14, marginBottom:10, background:u.bg, borderLeft:`3px solid ${u.color}`}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:8, flexWrap:"wrap"}}>
                  <div style={{display:"flex", alignItems:"center", gap:10, flex:1}}>
                    <span style={{fontSize:24, fontWeight:700, color:u.color, lineHeight:1, minWidth:55}}>{u.pct}%</span>
                    <span style={{fontSize:13, fontWeight:700, color:"#333"}}>{u.title}</span>
                  </div>
                  <span style={{fontSize:11, color:u.color, fontWeight:700}}>{u.amount}</span>
                </div>
                <div style={{marginBottom:12}}>
                  <Prog value={u.pct} color={u.color} h={6}/>
                </div>
                <ul style={{margin:0, paddingLeft:18, fontSize:11.5, color:"#444", lineHeight:1.7}}>
                  {u.bullets.map((b, j) => (<li key={j} style={{marginBottom:3}}>{b}</li>))}
                </ul>
              </Card>
            ))}
          </div>

          {/* Section 2 — Plan de value creation 3 horizons */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Plan de value creation — 3 horizons temporels</h3>

            {/* Horizon 1 */}
            <Card style={{padding:0, marginBottom:12, overflow:"hidden", borderLeft:"3px solid #D85A30"}}>
              <div style={{padding:"12px 14px", background:"#FBE6DC", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:11, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:0.5}}>Horizon 1 — 100 jours post-closing</div>
                  <div style={{fontSize:13, fontWeight:700, color:"#333", marginTop:2}}>Structuration</div>
                </div>
                <span style={{padding:"3px 10px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:"#D85A30", letterSpacing:0.5}}>NON NÉGOCIABLE</span>
              </div>
              <div style={{padding:14}}>
                <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>6 chantiers</div>
                {[
                  {n:1, title:"Recrutement DAF", timing:"S1-S8", kpi:"En poste avant M+2"},
                  {n:2, title:"Formalisation CA 3 membres", timing:"S2-S4", kpi:"PV nomination avant M+1"},
                  {n:3, title:"Régularisation AG 2024-2025", timing:"S2-S6", kpi:"0 AG manquante avant M+2"},
                  {n:4, title:"Séparation comptes perso/pro", timing:"S1-S4", kpi:"100% flux pro avant M+1"},
                  {n:5, title:"Double signature bancaire", timing:"Dès DAF", kpi:"Procédure testée avant M+3"},
                  {n:6, title:"Assurance homme-clé", timing:"S4-S8", kpi:"Police souscrite avant M+2"},
                ].map(c => (
                  <div key={c.n} style={{display:"flex", gap:10, alignItems:"center", padding:"7px 0", borderBottom:c.n<6?"1px solid #f8f8f6":"none"}}>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, background:"#FBE6DC", color:"#A32D2D", flexShrink:0, minWidth:22, textAlign:"center"}}>{c.n}</span>
                    <span style={{flex:2, fontSize:12, fontWeight:600, color:"#333"}}>{c.title}</span>
                    <span style={{flex:1, fontSize:10, color:"#888", fontStyle:"italic", textAlign:"right"}}>{c.timing}</span>
                    <span style={{flex:2, fontSize:11, color:"#444", textAlign:"right"}}>KPI : <strong>{c.kpi}</strong></span>
                  </div>
                ))}
                <div style={{marginTop:12, padding:10, background:"#fafaf7", borderRadius:5, fontSize:11, color:"#444", lineHeight:1.6}}>
                  <strong>Budget H1 :</strong> ~25M FCFA · <strong>Milestone décaissement tranche 2 :</strong> validation des 6 points en 6 mois maximum
                </div>
              </div>
            </Card>

            {/* Horizon 2 */}
            <Card style={{padding:0, marginBottom:12, overflow:"hidden", borderLeft:"3px solid #BA7517"}}>
              <div style={{padding:"12px 14px", background:"#FFF8F0"}}>
                <div style={{fontSize:11, fontWeight:700, color:"#BA7517", textTransform:"uppercase", letterSpacing:0.5}}>Horizon 2 — 6 mois post-closing</div>
                <div style={{fontSize:13, fontWeight:700, color:"#333", marginTop:2}}>Accélération</div>
              </div>
              <div style={{padding:14}}>
                <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>5 leviers opérationnels</div>
                {[
                  {n:1, title:"Commande ligne Sejong", timing:"M+2", kpi:"Acompte 40% = 0,77M EUR"},
                  {n:2, title:"Recrutement DRH", timing:"M+3-4", kpi:"En poste avant M+5"},
                  {n:3, title:"Certification BPF Sénégal", timing:"M+3-6", kpi:"Dossier déposé ANRP-SN"},
                  {n:4, title:"Contrats-cadres fournisseurs API", timing:"M+2-4", kpi:"Cible -5% sur prix d'achat"},
                  {n:5, title:"Extension réseau distribution privé", timing:"M+3-6", kpi:"120 → 200 pharmacies · +200M FCFA/an"},
                ].map(l => (
                  <div key={l.n} style={{display:"flex", gap:10, alignItems:"center", padding:"7px 0", borderBottom:l.n<5?"1px solid #f8f8f6":"none"}}>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, background:"#FFF8F0", color:"#BA7517", flexShrink:0, minWidth:22, textAlign:"center"}}>{l.n}</span>
                    <span style={{flex:2, fontSize:12, fontWeight:600, color:"#333"}}>{l.title}</span>
                    <span style={{flex:1, fontSize:10, color:"#888", fontStyle:"italic", textAlign:"right"}}>{l.timing}</span>
                    <span style={{flex:2, fontSize:11, color:"#444", textAlign:"right"}}>KPI : <strong>{l.kpi}</strong></span>
                  </div>
                ))}
                <div style={{marginTop:12, padding:10, background:"#fafaf7", borderRadius:5, fontSize:11, color:"#444"}}>
                  <strong>Budget cumulé H2 :</strong> ~2,5M EUR
                </div>
              </div>
            </Card>

            {/* Horizon 3 */}
            <Card style={{padding:0, marginBottom:0, overflow:"hidden", borderLeft:"3px solid #1D9E75"}}>
              <div style={{padding:"12px 14px", background:"#EAF3DE"}}>
                <div style={{fontSize:11, fontWeight:700, color:"#1D9E75", textTransform:"uppercase", letterSpacing:0.5}}>Horizon 3 — 12 mois post-closing</div>
                <div style={{fontSize:13, fontWeight:700, color:"#333", marginTop:2}}>Exécution</div>
              </div>
              <div style={{padding:14}}>
                <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>4 jalons</div>
                {[
                  {n:1, title:"Nouvelle ligne opérationnelle", timing:"M+9-12", kpi:"Taux utilisation > 80%"},
                  {n:2, title:"Première réponse AO Sénégal", timing:"M+12", kpi:"≥ 2 AO remportés"},
                  {n:3, title:"Recrutement directeur pays SN", timing:"M+10-12", kpi:"En poste M+12"},
                  {n:4, title:"Reporting trimestriel opérationnel", timing:"En continu", kpi:"Format ESONO standard"},
                ].map(j => (
                  <div key={j.n} style={{display:"flex", gap:10, alignItems:"center", padding:"7px 0", borderBottom:j.n<4?"1px solid #f8f8f6":"none"}}>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, background:"#EAF3DE", color:"#1D9E75", flexShrink:0, minWidth:22, textAlign:"center"}}>{j.n}</span>
                    <span style={{flex:2, fontSize:12, fontWeight:600, color:"#333"}}>{j.title}</span>
                    <span style={{flex:1, fontSize:10, color:"#888", fontStyle:"italic", textAlign:"right"}}>{j.timing}</span>
                    <span style={{flex:2, fontSize:11, color:"#444", textAlign:"right"}}>KPI : <strong>{j.kpi}</strong></span>
                  </div>
                ))}
                <div style={{marginTop:12, padding:10, background:"#fafaf7", borderRadius:5, fontSize:11, color:"#444"}}>
                  <strong>Budget total 12 mois :</strong> 3,2M EUR (100% du ticket)
                </div>
              </div>
            </Card>
          </div>

          {/* Section 3 — KPIs de suivi trimestriel */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>KPIs de suivi trimestriel</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2.5}}>KPI</div>
                <div style={{flex:1, textAlign:"right"}}>Actuel T0</div>
                <div style={{flex:1, textAlign:"right"}}>Cible M+6</div>
                <div style={{flex:1, textAlign:"right"}}>Cible M+12</div>
              </div>
              {[
                {kpi:"CA (Mds FCFA)", t0:"2.82", m6:"3.0", m12:"≥ 3.5"},
                {kpi:"Marge EBITDA retraitée", t0:"10.6%", m6:"11.5%", m12:"≥ 13%"},
                {kpi:"Taux utilisation capacité", t0:"62%", m6:"70%", m12:"≥ 80%"},
                {kpi:"Concentration top-3 clients", t0:"62%", m6:"55%", m12:"< 50%", warn:true},
                {kpi:"BFR / CA", t0:"17.4%", m6:"16%", m12:"< 14%", warn:true},
                {kpi:"AO actifs (CI + SN)", t0:"12", m6:"14", m12:"≥ 18"},
                {kpi:"Effectifs CDI", t0:"127", m6:"135", m12:"≥ 155"},
                {kpi:"Checklist gouvernance (/7)", t0:"0/7", m6:"7/7", m12:"7/7", critical:true},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.critical?"#EEEDFE":"transparent"}}>
                  <div style={{flex:2.5, fontWeight:600, color:r.warn?"#A32D2D":r.critical?"#534AB7":"#333"}}>{r.kpi}</div>
                  <div style={{flex:1, textAlign:"right", color:"#666"}}>{r.t0}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:600}}>{r.m6}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:700, color:r.warn?"#1D9E75":r.critical?"#534AB7":"#1D9E75"}}>{r.m12}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4 — Mécanisme de décaissement */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Mécanisme de décaissement</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14}}>
              <Card style={{padding:14, background:"#EEEDFE", borderLeft:"3px solid #534AB7"}}>
                <div style={{fontSize:10, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6}}>Tranche 1 — Au closing</div>
                <div style={{fontSize:24, fontWeight:700, color:"#534AB7", marginBottom:4}}>2,24M EUR</div>
                <div style={{fontSize:11, color:"#534AB7", fontWeight:600, marginBottom:10}}>70% du ticket</div>
                <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>
                  Décaissement immédiat au closing pour financer les recrutements prioritaires (DAF, DRH) et l'acompte 40% sur la commande Sejong (0,77M EUR).
                </p>
              </Card>
              <Card style={{padding:14, background:"#FFF8F0", borderLeft:"3px solid #BA7517"}}>
                <div style={{fontSize:10, fontWeight:700, color:"#BA7517", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6}}>Tranche 2 — Conditionnée</div>
                <div style={{fontSize:24, fontWeight:700, color:"#BA7517", marginBottom:4}}>0,96M EUR</div>
                <div style={{fontSize:11, color:"#BA7517", fontWeight:600, marginBottom:10}}>30% du ticket · M+6 max</div>
                <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>
                  Conditionnée à la validation des 6 milestones de structuration H1 dans 6 mois max après le closing.
                </p>
              </Card>
            </div>
            <Card accent="#D85A30" style={{padding:12, background:"#FBE6DC"}}>
              <div style={{fontSize:11, fontWeight:700, color:"#A32D2D", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Clause de non-réalisation</div>
              <p style={{margin:0, fontSize:11.5, lineHeight:1.6, color:"#444"}}>
                En cas de non-réalisation des 6 milestones H1 dans le délai imparti : <strong>clause de renégociation</strong> de la valorisation et des termes de gouvernance, ou <strong>put option</strong> de sortie anticipée du fonds avec rachat des titres au prix d'origine majoré du taux de placement de référence (BCEAO + 200bps).
              </p>
            </Card>
          </div>

          {/* Section 5 — Valeur ajoutée non-financière */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Valeur ajoutée non-financière du fonds</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
              {[
                {
                  n:1, color:"#534AB7", bg:"#EEEDFE", icon:"🎯",
                  title:"Réseau de recrutement",
                  body:"Profils pré-identifiés sur les 3 postes critiques (DAF, DRH, Directeur Pays Sénégal) issus du réseau du fonds et des cabinets de chasse partenaires (Michael Page Africa, Fed Africa).",
                },
                {
                  n:2, color:"#185FA5", bg:"#E3EDF7", icon:"📋",
                  title:"Méthodologie gouvernance",
                  body:"Templates PV AG, charte CA, règlement intérieur conformes AUSCGIE OHADA, validés sur 15+ participations actives du fonds. Transmission de la méthodologie de structuration 100 jours.",
                },
                {
                  n:3, color:"#1D9E75", bg:"#EAF3DE", icon:"🤝",
                  title:"Accès DFI",
                  body:"Mise en relation privilégiée avec Proparco, BII, FMO pour co-investissement futur ou ligne de dette subordonnée. Accès facilité aux programmes Team Europe d'appui aux PME africaines.",
                },
                {
                  n:4, color:"#BA7517", bg:"#FFF8F0", icon:"📈",
                  title:"Préparation à la sortie",
                  body:"Book d'acquéreurs potentiels constitué sur 12-18 mois avant la fenêtre de sortie : industriels régionaux (Cipla Africa, Aurobindo, Saidal) et fonds secondaires (AfricInvest, Amethis, Mediterrania).",
                },
              ].map(l => (
                <Card key={l.n} style={{padding:14, background:l.bg, borderLeft:`3px solid ${l.color}`}}>
                  <div style={{display:"flex", gap:10, alignItems:"flex-start"}}>
                    <div style={{width:30, height:30, borderRadius:15, background:l.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0}}>{l.n}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:5}}>{l.title}</div>
                      <p style={{margin:0, fontSize:11, lineHeight:1.6, color:"#444"}}>{l.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1 (draft)"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function ESGRisquesPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 12);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>ESG / Risques</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* SECTION 1 — ESG, impact et risques + ODD */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>ESG, impact et risques</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Impact et alignement ODD</h3>

            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:1.5}}>ODD</div>
                <div style={{width:90}}>Qualification</div>
                <div style={{flex:3}}>Impact</div>
                <div style={{width:90, textAlign:"center"}}>Note</div>
              </div>
              {[
                {odd:"ODD 3 — Santé", qual:"Indirect", qualColor:"#BA7517", impact:"Impact via fiabilité chaîne d'approvisionnement (médicaments, denrées). Non quantifié.", note:"n/d", noteColor:"#888"},
                {odd:"ODD 8 — Travail décent", qual:"Direct", qualColor:"#1D9E75", impact:"Emplois formels dans secteur à 70%+ d'informalité (source INS-CI 2023, à confirmer). Nombre exact n/d.", note:"À DD", noteColor:"#BA7517"},
                {odd:"ODD 9 — Industrie & Infra.", qual:"Direct", qualColor:"#1D9E75", impact:"Modernisation logistique corridor Abidjan-Ouagadougou-Bamako. LPI CI = 2,9/5 (Banque Mondiale 2023).", note:"Confirmé", noteColor:"#1D9E75"},
                {odd:"ODD 5 — Genre", qual:"Potentiel", qualColor:"#534AB7", impact:"Secteur structurellement masculin (<15% femmes). Éligibilité 2X conditionnelle à engagement contractuel.", note:"À structurer", noteColor:"#534AB7"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start"}}>
                  <div style={{flex:1.5, fontWeight:600, paddingRight:8}}>{r.odd}</div>
                  <div style={{width:90}}>
                    <span style={{padding:"2px 7px", borderRadius:8, fontSize:9.5, fontWeight:700, color:"#fff", background:r.qualColor, letterSpacing:0.3}}>{r.qual}</span>
                  </div>
                  <div style={{flex:3, color:"#444", lineHeight:1.5, fontSize:11, paddingRight:8}}>{r.impact}</div>
                  <div style={{width:90, textAlign:"center"}}>
                    <span style={{fontSize:10, fontWeight:700, color:r.noteColor}}>{r.note}</span>
                  </div>
                </div>
              ))}
            </div>

            <p style={{margin:"14px 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              <strong>ODD 8 — Travail décent.</strong> {mandat.short} opère dans un secteur structurellement informel (estimé à 70%+ d'emploi non déclaré selon l'INS-CI 2023, source à confirmer). La formalisation des contrats CDI et l'affiliation CNPS constituent un levier d'impact direct sur les conditions de travail. Le nombre d'emplois formels précis n'a pas été documenté à ce stade et représente un point de vérification prioritaire en DD sociale.
            </p>
            <p style={{margin:"0 0 10px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              <strong>ODD 9 — Industrie & Infrastructure.</strong> La modernisation des flottes et la digitalisation des chaînes d'approvisionnement sur le corridor Abidjan-Ouagadougou-Bamako contribuent à améliorer le Logistics Performance Index ivoirien (2,9/5 selon Banque Mondiale 2023). L'investissement projet sur des véhicules récents, le tracking GPS et la traçabilité documentaire renforce directement la qualité de l'infrastructure logistique régionale.
            </p>
            <p style={{margin:0, fontSize:12, lineHeight:1.7, color:"#444"}}>
              <strong>ODD 5 — Genre.</strong> L'impact direct sur l'égalité femmes-hommes est limité par le profil structurellement masculin du secteur (moins de 15% de femmes employées en logistique terrestre en CI selon IFC Gender in Transport 2022). Un impact indirect significatif est possible via les services logistiques rendus aux commerçantes des marchés de gros, à explorer en DD si segment ciblé. L'éligibilité aux critères 2X de l'IFC est conditionnelle à des engagements contractuels post-investissement.
            </p>
          </div>

          {/* SECTION 2 — IRIS+ */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Indicateurs d'impact IRIS+</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
              {[
                {code:"OI1638", label:"Emplois à plein temps", actual:"n/d", target:"À définir en DD", method:"Registre CNPS", color:"#888"},
                {code:"OI5765", label:"Emplois femmes (%)", actual:"n/d (<15%)", target:"≥20% à M+24", method:"Registre CNPS + organigramme", color:"#534AB7"},
                {code:"PI1279", label:"Revenus nets (FCFA)", actual:"n/d", target:"À définir en DD", method:"Liasses SYSCOHADA certifiées", color:"#888"},
                {code:"OI3160", label:"Formation employés (h/an/ETP)", actual:"n/d", target:"≥20h/an", method:"Registre formation interne", color:"#1D9E75"},
                {code:"PI9259", label:"Émissions GES évitées (tCO2eq)", actual:"n/d", target:"Calcul post-audit flotte", method:"Audit flotte ADEME / GHG Protocol", color:"#185FA5"},
                {code:"OI7215", label:"Accidents du travail (tx fréquence)", actual:"n/d", target:"-20% vs baseline", method:"Registre CNPS + déclarations internes", color:"#D85A30"},
              ].map((k, i) => (
                <Card key={i} style={{padding:14, borderLeft:`3px solid ${k.color}`}}>
                  <div style={{marginBottom:8}}>
                    <span style={{padding:"2px 7px", borderRadius:8, fontSize:9, fontWeight:700, color:"#fff", background:k.color, letterSpacing:0.5}}>{k.code}</span>
                  </div>
                  <div style={{fontSize:12, fontWeight:700, color:"#333", marginBottom:12, lineHeight:1.4, minHeight:32}}>{k.label}</div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10}}>
                    <div>
                      <div style={{fontSize:9, color:"#888", marginBottom:2, textTransform:"uppercase", letterSpacing:0.4}}>Actuel</div>
                      <div style={{fontSize:11, fontWeight:600, color:"#666"}}>{k.actual}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9, color:"#888", marginBottom:2, textTransform:"uppercase", letterSpacing:0.4}}>Cible M+24</div>
                      <div style={{fontSize:11, fontWeight:700, color:k.color}}>{k.target}</div>
                    </div>
                  </div>
                  <div style={{fontSize:9.5, color:"#888", fontStyle:"italic", paddingTop:8, borderTop:"1px solid #f8f8f6", lineHeight:1.4}}>
                    Méthode : {k.method}
                  </div>
                </Card>
              ))}
            </div>
            <Card accent="#BA7517" style={{padding:12, background:"#FFF8F0", marginTop:12}}>
              <div style={{fontSize:11, color:"#444", lineHeight:1.6}}>
                Tous les indicateurs sont à <strong>baseline n/d</strong> à ce stade — les valeurs actuelles seront documentées en DD sociale et financière. Les cibles seront définies <strong>contractuellement dans le pacte d'actionnaires</strong> et feront l'objet d'un <strong>reporting semestriel</strong> si co-investissement DFI confirmé.
              </div>
            </Card>
          </div>

          {/* SECTION 3 — 2X Criteria */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 6px", fontSize:15, fontWeight:700}}>Éligibilité 2X Criteria IFC</h3>
            <p style={{margin:"0 0 14px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Le secteur logistique est <strong>structurellement défavorable</strong> aux critères 2X (source IFC Gender in Transport 2022 — moins de 10% de femmes en direction et moins de 15% en effectifs en Afrique de l'Ouest). L'éligibilité 2X nécessite de satisfaire <strong>au moins un critère parmi les quatre</strong>, ce qui suppose un engagement contractuel post-closing.
            </p>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Critère 2X</div>
                <div style={{flex:1.2}}>Actuel</div>
                <div style={{flex:1.6}}>Post-investissement</div>
                <div style={{flex:2.5}}>Analyse</div>
              </div>
              {[
                {crit:"Leadership", subtitle:"≥30% femmes en direction", actual:"n/d", post:"Engagement contractuel", analysis:"Secteur CI <10% femmes en direction. Cible atteignable via recrutements DAF / DRH structurels 100 jours.", warn:false},
                {crit:"Emploi", subtitle:"≥30% femmes effectifs", actual:"n/d (<15%)", post:"20% à M+24 · 30% à M+48", analysis:"Cible 30% difficile à court terme dans logistique terrestre. Plan progressif avec quotas sur fonctions support et admin.", warn:true},
                {crit:"Produits / Services", subtitle:"Bénéfice direct femmes", actual:"Non applicable", post:"Potentiel si fret marché ciblé", analysis:"À explorer si segment services aux commerçantes de marchés de gros est ciblé en stratégie commerciale.", warn:false},
                {crit:"Chaîne de valeur", subtitle:"≥30% femmes", actual:"n/d", post:"Potentiel si politique formalisée", analysis:"Non documenté à ce stade. Cartographie fournisseurs et politique achats genre à formaliser en H2.", warn:false},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start", background:r.warn?"#fafaf7":"transparent"}}>
                  <div style={{flex:2}}>
                    <div style={{fontWeight:700, color:"#333"}}>{r.crit}</div>
                    <div style={{fontSize:10, color:"#888", marginTop:2, fontStyle:"italic"}}>{r.subtitle}</div>
                  </div>
                  <div style={{flex:1.2, fontWeight:600, color:"#666", fontSize:11}}>{r.actual}</div>
                  <div style={{flex:1.6, fontWeight:600, color:"#534AB7", fontSize:11, paddingRight:8}}>{r.post}</div>
                  <div style={{flex:2.5, color:"#444", lineHeight:1.5, fontSize:11}}>{r.analysis}</div>
                </div>
              ))}
            </div>
            <Card accent="#BA7517" style={{padding:14, background:"#FFF8F0", marginTop:12}}>
              <div style={{fontSize:11.5, fontWeight:700, color:"#BA7517", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Conclusion 2X — Non éligible à ce stade</div>
              <p style={{margin:"0 0 8px", fontSize:11.5, color:"#444", lineHeight:1.6}}>L'éligibilité 2X est conditionnelle à 3 engagements contractuels :</p>
              <ul style={{margin:0, paddingLeft:18, fontSize:11.5, color:"#444", lineHeight:1.8}}>
                <li>Engagement emploi femmes ≥30% à M+48 (jalon intermédiaire 20% à M+24)</li>
                <li>Politique de recrutement avec mainstreaming genre formalisée et auditée annuellement</li>
                <li>Exploration du critère chaîne de valeur via cartographie fournisseurs et politique achats inclusive</li>
              </ul>
            </Card>
          </div>

          {/* SECTION 4 — IFC PS */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Conformité IFC Performance Standards</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{width:50}}>PS</div>
                <div style={{flex:1.8}}>Performance Standard</div>
                <div style={{width:160}}>Conformité</div>
                <div style={{flex:3}}>Analyse</div>
              </div>
              {[
                {ps:"PS1", title:"Évaluation & gestion des risques E&S", status:"Présumé non conforme", color:"#BA7517", icon:"⚠", analysis:"SGES non formalisé, pas de politique E&S, pas de mécanisme de plaintes. Mise en place d'un Système de Gestion E&S dans 6 mois post-closing (budget 10-15M FCFA).", critical:false},
                {ps:"PS2", title:"Main d'œuvre & conditions de travail", status:"Partielle", color:"#BA7517", icon:"⚠", analysis:"CDI vs contrats précaires, affiliation CNPS, respect SMIG CI (75 000 FCFA/mois), comité hygiène-sécurité, registre accidents. Audit social complet en DD.", critical:false},
                {ps:"PS3", title:"Efficacité ressources & prévention pollution", status:"Partielle", color:"#BA7517", icon:"⚠", analysis:"Huiles usagées, pneus, carburant. Plan de gestion des déchets véhicules à formaliser. Filière de traitement à identifier (recyclage huiles et pneus en CI).", critical:false},
                {ps:"PS4", title:"Santé, sécurité & sûreté communautés", status:"Risque critique", color:"#D85A30", icon:"⚠⚠", analysis:"Accidents de la route. Taux d'accidents mortels logistique CI parmi les plus élevés AOF. Plan sécurité routière obligatoire : formation chauffeurs, GPS tracking, entretien préventif, assurance RC.", critical:true},
                {ps:"PS5", title:"Acquisition de terres & réinstallation", status:"N/A", color:"#1D9E75", icon:"✓", analysis:"Logistique sans acquisition foncière prévue dans le plan d'investissement.", critical:false},
                {ps:"PS6", title:"Conservation biodiversité", status:"N/A", color:"#1D9E75", icon:"✓", analysis:"Activité urbaine et périurbaine, pas d'habitat naturel sensible impacté.", critical:false},
                {ps:"PS7", title:"Populations autochtones", status:"N/A", color:"#1D9E75", icon:"✓", analysis:"Zone d'opération urbaine d'Abidjan, hors périmètres de populations autochtones.", critical:false},
                {ps:"PS8", title:"Patrimoine culturel", status:"N/A", color:"#1D9E75", icon:"✓", analysis:"Zone industrielle et commerciale, pas de patrimoine culturel concerné.", critical:false},
              ].map((p, i, arr) => (
                <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start", background:p.critical?"#FBE6DC":"transparent"}}>
                  <div style={{width:50}}>
                    <span style={{padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, color:"#fff", background:p.color}}>{p.ps}</span>
                  </div>
                  <div style={{flex:1.8, fontWeight:600, color:"#333", paddingRight:8, fontSize:11.5}}>{p.title}</div>
                  <div style={{width:160, display:"flex", alignItems:"center", gap:6}}>
                    <span style={{color:p.color, fontSize:13, fontWeight:700}}>{p.icon}</span>
                    <span style={{fontSize:10.5, fontWeight:700, color:p.color}}>{p.status}</span>
                  </div>
                  <div style={{flex:3, color:"#444", lineHeight:1.5, fontSize:11}}>{p.analysis}</div>
                </div>
              ))}
            </div>
            <Card accent="#534AB7" style={{padding:14, background:"#fafaf7", marginTop:12}}>
              <div style={{fontSize:11.5, fontWeight:700, color:"#534AB7", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Synthèse IFC Performance Standards</div>
              <p style={{margin:0, fontSize:11.5, color:"#444", lineHeight:1.7}}>
                <strong>4 PS applicables</strong> (PS1 à PS4) — non conforme PS1, partiellement conforme PS2 / PS3 / PS4. Le <strong>PS4 (sécurité routière)</strong> constitue le risque E&S le plus matériel du dossier et requiert un plan d'action prioritaire. <strong>Budget total de mise en conformité : 20-35M FCFA</strong>, à inscrire comme <strong>condition contractuelle</strong> avec délai de 12 mois post-closing si un DFI co-investit dans l'opération.
              </p>
            </Card>
          </div>

          {/* SECTION 5 — DFI */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 6px", fontSize:15, fontWeight:700}}>Attractivité DFI</h3>
            <p style={{margin:"0 0 14px", fontSize:12, lineHeight:1.7, color:"#444"}}>
              Identification des co-investisseurs institutionnels potentiels alignés avec le profil ESG et le secteur de la cible. Les tickets cibles et les instruments seront affinés post-DD et après confirmation des données financières certifiées.
            </p>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
              {[
                {name:"Proparco", country:"FR", focus:"Secteur privé · UEMOA", ticket:"À déterminer", instrument:"Equity ou dette subordonnée", color:"#185FA5", priority:"Prioritaire", prioColor:"#1D9E75"},
                {name:"BII", country:"UK", focus:"British International Investment", ticket:"À déterminer", instrument:"Equity minoritaire active", color:"#534AB7", priority:"À évaluer", prioColor:"#BA7517"},
                {name:"FMO", country:"NL", focus:"Banque néerlandaise dév.", ticket:"À déterminer", instrument:"Equity + dette mezzanine", color:"#1D9E75", priority:"À évaluer", prioColor:"#BA7517"},
                {name:"I&P", country:"FR / CI", focus:"Investisseurs & Partenaires", ticket:"À déterminer", instrument:"Equity active minoritaire", color:"#BA7517", priority:"Prioritaire", prioColor:"#1D9E75"},
              ].map((d, i) => (
                <Card key={i} style={{padding:14, borderTop:`3px solid ${d.color}`}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4}}>
                    <span style={{fontSize:14, fontWeight:700, color:"#333"}}>{d.name}</span>
                    <span style={{fontSize:9, color:"#888", fontWeight:600}}>{d.country}</span>
                  </div>
                  <div style={{fontSize:10, color:"#888", fontStyle:"italic", marginBottom:12, minHeight:24, lineHeight:1.3}}>{d.focus}</div>
                  <div style={{padding:"8px 0", borderTop:"1px solid #f8f8f6", borderBottom:"1px solid #f8f8f6", marginBottom:8}}>
                    <div style={{fontSize:9, color:"#888", marginBottom:2, textTransform:"uppercase", letterSpacing:0.4}}>Ticket</div>
                    <div style={{fontSize:11, fontWeight:600, color:"#888", fontStyle:"italic"}}>{d.ticket}</div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:9, color:"#888", marginBottom:2, textTransform:"uppercase", letterSpacing:0.4}}>Instrument</div>
                    <div style={{fontSize:10.5, color:"#444", lineHeight:1.4}}>{d.instrument}</div>
                  </div>
                  <span style={{padding:"3px 8px", borderRadius:10, fontSize:9.5, fontWeight:700, color:"#fff", background:d.prioColor, letterSpacing:0.4}}>{d.priority}</span>
                </Card>
              ))}
            </div>
            <Card accent="#BA7517" style={{padding:12, background:"#FFF8F0", marginTop:12}}>
              <div style={{fontSize:11, color:"#444", lineHeight:1.6}}>
                <strong>Attractivité DFI modérée</strong>, conditionnelle à (i) la vérification des données financières en DD, (ii) la mise en conformité E&S sur les 4 PS applicables, (iii) l'engagement contractuel sur les critères 2X. Premiers contacts informels à privilégier post-IC2.
              </div>
            </Card>
          </div>

          {/* SECTION 6 — Matrice des risques */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Matrice des risques</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:1.5}}>Risque</div>
                <div style={{width:75, textAlign:"center"}}>Prob.</div>
                <div style={{width:75, textAlign:"center"}}>Impact</div>
                <div style={{flex:3}}>Mitigation</div>
                <div style={{width:85, textAlign:"center"}}>Niveau</div>
              </div>
              {[
                {risk:"Sécurité routière", prob:"Haute", impact:"Haut", mit:"Plan sécurité routière : formation chauffeurs, GPS tracking, entretien préventif, assurance RC. KPI : taux fréquence accidents <5 pour 1M km à M+24.", level:"Critical", color:"#D85A30", bg:"#FBE6DC"},
                {risk:"Concentration client", prob:"Confirmée", impact:"Haut", mit:"Cartographie clients obligatoire en DD. Si top 3 >70% du CA → condition suspensive de diversification. Cible : top 3 <50% à M+36.", level:"Critical", color:"#D85A30", bg:"#FBE6DC"},
                {risk:"Audit financier", prob:"Confirmée", impact:"Haut", mit:"Audit financier 3 ans obligatoire en DD. EBITDA retraité à recalculer post-audit. Deal en hold jusqu'à réception et validation des états financiers certifiés.", level:"Critical", color:"#D85A30", bg:"#FBE6DC"},
                {risk:"Homme-clé", prob:"Moyenne", impact:"Haut", mit:"Assurance homme-clé (plafond 500M FCFA), recrutement DAF + directeur opérations, plan de succession formalisé dans les 100 jours post-closing.", level:"High", color:"#BA7517", bg:"#FFF8F0"},
                {risk:"Réglementaire licences", prob:"Moyenne", impact:"Haut", mit:"Audit réglementaire en DD : licences, autorisations, conformité flotte. Toute non-conformité = condition suspensive de régularisation avant closing.", level:"High", color:"#BA7517", bg:"#FFF8F0"},
                {risk:"Absence SGES", prob:"Confirmée", impact:"Moyen", mit:"Budget 10-15M FCFA, condition contractuelle de mise en œuvre dans les 6 mois post-closing avec accompagnement d'un consultant E&S certifié.", level:"High", color:"#BA7517", bg:"#FFF8F0"},
                {risk:"Compétition marché", prob:"Moyenne", impact:"Moyen", mit:"Différenciation par qualité de service, traçabilité documentaire, positionnement B2B corporate haut de gamme. Monitoring trimestriel des parts de marché.", level:"Medium", color:"#185FA5", bg:"#E3EDF7"},
                {risk:"Risque pays CI", prob:"Faible", impact:"Moyen", mit:"CI stable (PIB +6,5%, notation Ba3 Moody's). Country Risk Premium intégré au WACC (180 bps). Diversification UEMOA prévue dans le plan de croissance.", level:"Medium", color:"#185FA5", bg:"#E3EDF7"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start"}}>
                  <div style={{flex:1.5, fontWeight:700, color:"#333", paddingRight:8}}>{r.risk}</div>
                  <div style={{width:75, textAlign:"center", fontSize:10.5, color:"#666"}}>{r.prob}</div>
                  <div style={{width:75, textAlign:"center", fontSize:10.5, color:"#666"}}>{r.impact}</div>
                  <div style={{flex:3, color:"#444", lineHeight:1.5, fontSize:11, paddingRight:8}}>{r.mit}</div>
                  <div style={{width:85, textAlign:"center"}}>
                    <span style={{padding:"3px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:r.color, letterSpacing:0.5}}>{r.level}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 7 — Récap red flags SYSCOHADA */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Récapitulatif des red flags SYSCOHADA</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2.5}}>Facteur</div>
                <div style={{flex:1.5}}>Statut</div>
                <div style={{width:100, textAlign:"center"}}>Sévérité</div>
                <div style={{width:90, textAlign:"right"}}>Pénalité</div>
              </div>
              {[
                {factor:"Absence audit financier 3 ans", status:"Documents non parsables", severity:"Critical", penalty:"-25 pts", color:"#D85A30"},
                {factor:"Concentration clients top-3", status:"Non documentée", severity:"High", penalty:"-10 pts", color:"#BA7517"},
                {factor:"SGES E&S non formalisé", status:"Présumé absent", severity:"High", penalty:"-5 pts", color:"#BA7517"},
                {factor:"Données IRIS+ baseline n/d", status:"Tous indicateurs", severity:"Medium", penalty:"-3 pts", color:"#185FA5"},
              ].map((f, i, arr) => (
                <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center"}}>
                  <div style={{flex:2.5, fontWeight:600, color:"#333"}}>{f.factor}</div>
                  <div style={{flex:1.5, color:"#666", fontStyle:"italic", fontSize:11}}>{f.status}</div>
                  <div style={{width:100, textAlign:"center"}}>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:f.color, letterSpacing:0.5}}>{f.severity}</span>
                  </div>
                  <div style={{width:90, textAlign:"right", fontWeight:700, color:f.color}}>{f.penalty}</div>
                </div>
              ))}
            </div>

            <Card style={{padding:16, background:"#fafaf7"}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14}}>
                <div style={{textAlign:"center", padding:12, background:"#fff", borderRadius:6, border:"1px solid #F1EFE8"}}>
                  <div style={{fontSize:10, color:"#888", marginBottom:4, textTransform:"uppercase", letterSpacing:0.4}}>Score avant pénalités</div>
                  <div style={{fontSize:24, fontWeight:700, color:"#534AB7"}}>57<span style={{fontSize:14, color:"#888"}}>/100</span></div>
                </div>
                <div style={{textAlign:"center", padding:12, background:"#FBE6DC", borderRadius:6, border:"1px solid #D85A30"}}>
                  <div style={{fontSize:10, color:"#A32D2D", marginBottom:4, textTransform:"uppercase", letterSpacing:0.4, fontWeight:700}}>Score après pénalités</div>
                  <div style={{fontSize:24, fontWeight:700, color:"#A32D2D"}}>14<span style={{fontSize:14, color:"#A32D2D"}}>/100</span></div>
                </div>
                <div style={{textAlign:"center", padding:12, background:"#fff", borderRadius:6, border:"1px solid #F1EFE8"}}>
                  <div style={{fontSize:10, color:"#888", marginBottom:4, textTransform:"uppercase", letterSpacing:0.4}}>Seuil mid-market</div>
                  <div style={{fontSize:24, fontWeight:700, color:"#1D9E75"}}>50<span style={{fontSize:14, color:"#888"}}>/100</span></div>
                </div>
              </div>
              <div style={{marginTop:14, padding:10, background:"#FBE6DC", borderRadius:5, fontSize:11.5, color:"#A32D2D", lineHeight:1.6, fontWeight:600, textAlign:"center"}}>
                ⚠ Score post-pénalités très en dessous du seuil de passage — le dossier ne peut pas être présenté en IC2 sans levée préalable du red flag critique (audit financier 3 ans).
              </div>
            </Card>
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Validé par", "K. N'Guessan (MD)"],
                ["Version", "IC1"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Version IC1 produite sans documents parsables. Enrichissement par rapport au pre-screening (vide) via standards IFC PS, IRIS+, 2X Criteria, et benchmarks sectoriels logistique CI. Toutes les données non documentées sont signalées <strong>n/d</strong> dans le corps du texte.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function AnnexesPage({mandat, sections, setSections, toast, role}) {
  const sec = sections.find(s => s.id === 13);
  const [openNote, setOpenNote] = useState(null);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : M. Diop</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Annexes</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* SECTION 1 — Inventaire documentaire */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Annexes</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Inventaire documentaire</h3>

            {/* KPIs documentaires */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:14}}>
              {[
                {label:"Documents fournis", value:"7", sub:"sur 16 attendus", color:"#1D9E75"},
                {label:"Partiels", value:"2", sub:"à compléter en DD", color:"#BA7517"},
                {label:"Manquants critiques", value:"6", sub:"bloquants pour IC2", color:"#D85A30"},
                {label:"Couverture globale", value:"50%", sub:"Niveau N1.5", color:"#534AB7"},
              ].map((k, i) => (
                <div key={i} style={{padding:12, background:"#fff", borderRadius:8, border:"1px solid #F1EFE8", textAlign:"center"}}>
                  <div style={{fontSize:10, color:"#888", marginBottom:4}}>{k.label}</div>
                  <div style={{fontSize:20, fontWeight:700, color:k.color}}>{k.value}</div>
                  <div style={{fontSize:9.5, color:"#888", marginTop:3, lineHeight:1.4}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Documents fournis */}
            <div style={{fontSize:11, fontWeight:700, color:"#1D9E75", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8, display:"flex", alignItems:"center", gap:8}}>
              <Dot color="#1D9E75"/> Documents fournis (9)
            </div>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              {[
                {status:"ok", name:"Liasses SYSCOHADA 2023", meta:"PDF · 42 p.", note:"Non certifié — retraitements EBITDA basés sur données déclaratives."},
                {status:"warn", name:"Liasses SYSCOHADA 2024", meta:"PDF · 38 p.", note:"Non certifié — certification par CAC recommandée avant closing."},
                {status:"ok", name:"Liasses SYSCOHADA 2025", meta:"PDF · 40 p.", note:"Certifié avec réserves par Cabinet Diallo — réserves à détailler en DD."},
                {status:"ok", name:"Pitch deck", meta:"PDF · 18 p. · v3 mars 2026", note:"Base de l'analyse commerciale et stratégique."},
                {status:"ok", name:"Statuts SARL + RCCM", meta:"À jour 2024", note:"Cohérence avec actionnariat déclaré vérifiée."},
                {status:"ok", name:"Relevés bancaires NSIA", meta:"12 mois glissants", note:"Compte courant + épargne. Cohérence avec CA déclaré à vérifier en DD."},
                {status:"ok", name:"Quittances CNPS 2024-2025", meta:"À jour", note:"Conformité sociale confirmée sur la période."},
                {status:"warn", name:"Quittances fiscales IS uniquement", meta:"À jour", note:"Patentes et TVA non vérifiées — risque de redressement fiscal résiduel non provisionné."},
                {status:"ok", name:"Budget prévisionnel", meta:"Fourni", note:"Hypothèses de croissance à challenger en DD (cohérence avec benchmarks logistique 10-25%/an)."},
              ].map((d, i, arr) => {
                const color = d.status === "ok" ? "#1D9E75" : "#BA7517";
                const icon = d.status === "ok" ? "✓" : "⚠";
                const bg = d.status === "ok" ? "transparent" : "#FFF8F0";
                return (
                  <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start", background:bg, gap:10}}>
                    <div style={{width:22, flexShrink:0, color:color, fontSize:14, fontWeight:700, lineHeight:1.3}}>{icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:3, flexWrap:"wrap"}}>
                        <span style={{fontWeight:700, color:"#333"}}>{d.name}</span>
                        <span style={{fontSize:10, color:"#888", fontStyle:"italic"}}>{d.meta}</span>
                      </div>
                      <div style={{fontSize:11, color:"#666", lineHeight:1.5}}>{d.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Documents manquants */}
            <div style={{fontSize:11, fontWeight:700, color:"#D85A30", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8, display:"flex", alignItems:"center", gap:8}}>
              <Dot color="#D85A30"/> Documents manquants (7)
            </div>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden", marginBottom:14}}>
              {[
                {status:"ko", name:"PV AG 2024 et 2025", meta:"Condition suspensive", note:"À régulariser dans les 100 jours post-closing.", critical:false},
                {status:"ko", name:"Pacte d'actionnaires", meta:"Inexistant", note:"À rédiger avec conseil juridique du fonds avant closing — bloquant pour gouvernance post-investissement.", critical:true},
                {status:"ko", name:"Organigramme détaillé + CV dirigeants", meta:"Demandé pour DD", note:"L'évaluation management repose uniquement sur l'entretien visite site du 11 avril 2026.", critical:true},
                {status:"ko", name:"Liste clients top 10 + part de CA", meta:"Absent", note:"Risque de concentration client non quantifiable à ce stade — bloquant pour DD commerciale.", critical:true},
                {status:"ko", name:"Contrats commerciaux clés", meta:"Absent", note:"À collecter en DD pour valider la récurrence des revenus.", critical:false},
                {status:"ko", name:"Règlement intérieur", meta:"Absent", note:"À formaliser post-closing dans le cadre du plan de gouvernance.", critical:false},
                {status:"warn", name:"Certification liasses 2023-2024 par CAC indépendant", meta:"Recommandé", note:"Avant closing pour sécuriser la base des retraitements EBITDA historiques.", critical:false},
              ].map((d, i, arr) => {
                const color = d.status === "ko" ? "#D85A30" : "#BA7517";
                const icon = d.status === "ko" ? "✗" : "⚠";
                const bg = d.critical ? "#FBE6DC" : d.status === "warn" ? "#FFF8F0" : "transparent";
                return (
                  <div key={i} style={{display:"flex", padding:"11px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start", background:bg, gap:10}}>
                    <div style={{width:22, flexShrink:0, color:color, fontSize:14, fontWeight:700, lineHeight:1.3}}>{icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, marginBottom:3, flexWrap:"wrap"}}>
                        <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                          <span style={{fontWeight:700, color:"#333"}}>{d.name}</span>
                          {d.critical && <span style={{padding:"2px 7px", borderRadius:8, fontSize:9, fontWeight:700, color:"#fff", background:"#D85A30", letterSpacing:0.4}}>CRITIQUE</span>}
                        </div>
                        <span style={{fontSize:10, color:"#888", fontStyle:"italic"}}>{d.meta}</span>
                      </div>
                      <div style={{fontSize:11, color:"#666", lineHeight:1.5}}>{d.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note synthèse */}
            <Card accent="#BA7517" style={{padding:14, background:"#FFF8F0"}}>
              <div style={{fontSize:11.5, fontWeight:700, color:"#BA7517", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Synthèse documentaire</div>
              <p style={{margin:"0 0 8px", fontSize:11.5, color:"#444", lineHeight:1.7}}>
                <strong>8 documents fournis sur 16 attendus (50% de couverture).</strong> 3 documents critiques manquants avant IC2 : organigramme + CV dirigeants, liste clients top 10, PV AG 2024-2025. Pacte d'actionnaires à créer.
              </p>
              <p style={{margin:0, fontSize:11.5, color:"#444", lineHeight:1.7}}>
                <strong>Niveau global N1.5</strong> — suffisant pour IC1 informatif, <strong>insuffisant pour décision définitive</strong>.
              </p>
            </Card>
          </div>

          {/* SECTION 2 — Références knowledge base */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Références knowledge base utilisées</h3>
            {[
              {
                n:1, color:"#534AB7", bg:"#EEEDFE",
                title:"Benchmarks sectoriels logistique",
                source:"Base de connaissances interne",
                data:"Marge EBITDA 15-30% · Marge brute 55-70% · Croissance CA 10-25%/an · Payback 1-3 ans",
                usage:"Sections 6, 7, 9",
              },
              {
                n:2, color:"#185FA5", bg:"#E3EDF7",
                title:"Multiples de valorisation transport / logistique PME Afrique",
                source:"AfricInvest, Development Partners — transactions 2020-2025",
                data:"4-6× EBITDA · 0,5-1× CA",
                usage:"Section 9",
              },
              {
                n:3, color:"#1D9E75", bg:"#EAF3DE",
                title:"Damodaran Country Risk Premium 2025",
                source:"Aswath Damodaran — NYU Stern",
                data:"CRP Côte d'Ivoire 4,8% — intégré dans le WACC (fourchette UEMOA retenue : 16-22% PME non cotées)",
                usage:"Section 9",
              },
              {
                n:4, color:"#BA7517", bg:"#FFF8F0",
                title:"Paramètres SYSCOHADA CI",
                source:"Base de connaissances interne",
                data:"IS 25% · Charges patronales ~18% · TVA 18% · Taux bancaire PME 8-14% · EUR/XOF 655,957",
                usage:"Tous retraitements financiers",
              },
            ].map(r => (
              <Card key={r.n} style={{padding:14, marginBottom:8, background:r.bg, borderLeft:`3px solid ${r.color}`}}>
                <div style={{display:"flex", gap:12, alignItems:"flex-start"}}>
                  <div style={{width:28, height:28, borderRadius:14, background:r.color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0}}>
                    {r.n}
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:12.5, fontWeight:700, color:"#333", marginBottom:3}}>{r.title}</div>
                    <div style={{fontSize:10.5, color:"#888", fontStyle:"italic", marginBottom:8}}>{r.source}</div>
                    <div style={{fontSize:11.5, color:"#444", lineHeight:1.6, marginBottom:6}}>{r.data}</div>
                    <div style={{paddingTop:6, borderTop:`1px solid ${r.color}30`, fontSize:10, color:r.color, fontWeight:600}}>
                      Utilisé dans : <strong>{r.usage}</strong>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <Card accent="#888" style={{padding:10, background:"#fafaf7", marginTop:8}}>
              <div style={{fontSize:10.5, color:"#666", lineHeight:1.6, fontStyle:"italic"}}>
                Note : les références pharma du pre-screening (IFC Pharma Africa, Directive UEMOA pharma) ont été retirées car hors-sujet pour ce deal logistique.
              </div>
            </Card>
          </div>

          {/* SECTION 3 — Historique des modifications */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Historique des modifications</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{width:110}}>Date</div>
                <div style={{width:130}}>Auteur</div>
                <div style={{flex:1}}>Action</div>
              </div>
              {[
                {date:"08 avr. 2026", author:"S. Koné", action:"Création du dossier — entretien DG + collecte premiers documents", role:"analyste"},
                {date:"10 avr. 2026", author:"S. Koné", action:"Sections 2, 3 rédigées (actionnariat, top management)", role:"analyste"},
                {date:"11 avr. 2026", author:"S. Koné", action:"Visite site Yopougon — rédaction sections 4, 8 (services, bilan)", role:"analyste"},
                {date:"12 avr. 2026", author:"S. Koné", action:"Section 6 rédigée (unit economics)", role:"analyste"},
                {date:"13 avr. 2026", author:"S. Koné", action:"Section 7 rédigée (PnL avec retraitements EBITDA)", role:"analyste"},
                {date:"14 avr. 2026", author:"S. Koné", action:"Sections 9, 10 rédigées (thèse, accompagnement)", role:"analyste"},
                {date:"15 avr. 2026", author:"S. Koné", action:"Section 11 rédigée (ESG / Risques)", role:"analyste"},
                {date:"16 avr. 2026", author:"K. N'Guessan", action:"Section 1 (résumé exécutif) rédigée et auto-générée", role:"partner"},
                {date:"17 avr. 2026", author:"A. Diallo", action:"Review IM des sections 2-11", role:"senior"},
                {date:"18 avr. 2026", author:"K. N'Guessan", action:"Validation MD des sections 5, 9, 11 — passage en IC1", role:"partner", milestone:true},
                {date:"18 avr. 2026", author:"S. Koné", action:"Section 12 (Annexes) rédigée en IC1 : correction références KB, consolidation inventaire documentaire, ajout conditions avant IC2", role:"analyste"},
              ].map((h, i, arr) => {
                const roleColor = h.role === "partner" ? "#D85A30" : h.role === "senior" ? "#185FA5" : "#534AB7";
                return (
                  <div key={i} style={{display:"flex", padding:"10px 12px", fontSize:11.5, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"flex-start", background:h.milestone?"#EAF3DE":"transparent"}}>
                    <div style={{width:110, fontSize:11, color:"#666", fontWeight:600}}>{h.date}</div>
                    <div style={{width:130, display:"flex", alignItems:"center", gap:6}}>
                      <Dot color={roleColor} s={6}/>
                      <span style={{fontSize:11, fontWeight:600, color:"#333"}}>{h.author}</span>
                    </div>
                    <div style={{flex:1, color:"#444", lineHeight:1.5, fontSize:11, paddingLeft:8, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                      <span>{h.action}</span>
                      {h.milestone && <span style={{padding:"2px 7px", borderRadius:8, fontSize:9, fontWeight:700, color:"#fff", background:"#1D9E75", letterSpacing:0.4}}>JALON IC1</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:10, display:"flex", gap:14, fontSize:10, color:"#888", flexWrap:"wrap"}}>
              <div style={{display:"flex", alignItems:"center", gap:5}}><Dot color="#534AB7" s={6}/> Analyste</div>
              <div style={{display:"flex", alignItems:"center", gap:5}}><Dot color="#185FA5" s={6}/> IM / Senior</div>
              <div style={{display:"flex", alignItems:"center", gap:5}}><Dot color="#D85A30" s={6}/> Partner / MD</div>
            </div>
          </div>

          {/* SECTION 4 — Notes complémentaires (accordion) */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Notes complémentaires</h3>
            {[
              {
                title:"Périmètre et objectif des annexes",
                body:"Cette section consolide l'inventaire documentaire et les références méthodologiques mobilisées pour la production de la note d'investissement IC1. L'objectif est de fournir au comité d'investissement une vue exhaustive (i) du niveau de couverture documentaire atteint, (ii) des bases de connaissance utilisées pour les retraitements et benchmarks, et (iii) de l'historique de production du dossier. Le taux de couverture actuel de 50% (8 documents pleinement fournis sur 16 attendus) est jugé suffisant pour un IC1 informatif mais reste insuffisant pour une décision définitive en IC2. Les conditions de levée des trois blocages critiques sont détaillées dans le bloc dédié ci-dessous.",
              },
              {
                title:"Inventaire documentaire détaillé par dimension",
                body:"**Dimension financière (N2)** — Liasses 2023 et 2024 non certifiées, liasse 2025 certifiée avec réserves par le Cabinet Diallo (réserves à détailler en DD), relevés bancaires NSIA sur 12 mois glissants, budget prévisionnel fourni. Quittances fiscales limitées à l'IS — patentes et TVA non vérifiées, exposant à un risque de redressement fiscal résiduel non provisionné dans les retraitements EBITDA.\n\n**Dimension juridique (N2)** — Statuts SARL et RCCM à jour, quittances CNPS conformes sur 2024-2025, quittances IS à jour. PV AG 2024 et 2025 absents — condition suspensive de régularisation dans les 100 jours post-closing pour mise en conformité avec l'Acte Uniforme OHADA.\n\n**Dimension commerciale (N1)** — Pitch deck et budget prévisionnel fournis, mais liste des clients top 10 avec parts de CA et contrats commerciaux clés totalement absents. Blocage majeur pour la due diligence commerciale et l'évaluation du risque de concentration client.\n\n**Dimension RH & Gouvernance (N0)** — Organigramme détaillé, CV dirigeants, pacte d'actionnaires et règlement intérieur tous absents. Configuration documentaire inacceptable pour un deal mid-market de 3,2M EUR — l'évaluation du management repose actuellement sur le seul entretien de visite site du 11 avril 2026.",
              },
              {
                title:"Qualité globale du dossier et conditions avant IC2",
                body:"**Niveau global N1.5** — stable par rapport au pre-screening, aucun document additionnel reçu depuis. Suffisant pour un IC1 informatif, insuffisant pour une décision définitive d'engagement.\n\n**3 conditions à lever avant IC2** :\n\n(1) Organigramme détaillé + CV dirigeants — pour permettre l'évaluation indépendante des compétences clés et l'identification des risques homme-clé.\n\n(2) Liste des clients top 10 avec parts de CA et type de contrat — pour quantifier le risque de concentration et confirmer la récurrence des revenus.\n\n(3) Régularisation PV AG 2024-2025 + initiation du pacte d'actionnaires — pour sécuriser la gouvernance post-investissement et la conformité OHADA.\n\n**Recommandation complémentaire** : certification des liasses 2023-2024 par un CAC indépendant avant closing pour sécuriser la base des retraitements EBITDA historiques utilisés dans la valorisation.",
              },
            ].map((n, i) => (
              <Card key={i} style={{padding:0, marginBottom:6, overflow:"hidden"}}>
                <div onClick={() => setOpenNote(openNote === i ? null : i)} style={{padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
                  <span style={{fontSize:12.5, fontWeight:600, color:"#333"}}>{i+1}. {n.title}</span>
                  <span style={{fontSize:11, color:"#888", fontWeight:700, transition:"transform 0.15s", transform:openNote===i?"rotate(90deg)":"none"}}>▶</span>
                </div>
                {openNote === i && (
                  <div style={{padding:"0 14px 14px", fontSize:11.5, color:"#444", lineHeight:1.7, borderTop:"1px solid #F1EFE8", paddingTop:12, whiteSpace:"pre-line"}}>
                    {n.body.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>)}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Version", "IC1"],
                ["Statut", ST[sec.status].l],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Passage pre-screening → IC1 : correction des références KB (retrait des refs pharma hors sujet), consolidation de l'inventaire documentaire (aucun nouveau document reçu depuis le pre-screening), ajout des conditions documentaires avant IC2, mise à jour de l'historique des modifications jusqu'au 18 avril 2026.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && sec.status === "submitted" && (
            <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
          )}
        </Card>
      </div>
    </div>
  );
}

function MemoSection({mandat, sections, setSections, toast, active, role}) {
  // §1 — Résumé exécutif has its own dedicated page
  if (active === 1) {
    return <ResumeExecutifPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §2 — Actionnariat & gouvernance has its own dedicated page
  if (active === 2) {
    return <ActionnariatGouvernancePage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §3 — Top management has its own dedicated page
  if (active === 3) {
    return <TopManagementPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §4 — Services has its own dedicated page
  if (active === 4) {
    return <ServicesPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §5 — Concurrence & marché has its own dedicated page
  if (active === 5) {
    return <ConcurrenceMarchePage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §6 — Unit economics has its own dedicated page
  if (active === 6) {
    return <UnitEconomicsPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §8 — PnL has its own dedicated page
  if (active === 8) {
    return <PnLPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §9 — Bilan has its own dedicated page
  if (active === 9) {
    return <BilanPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §10 — Thèse d'investissement has its own dedicated page
  if (active === 10) {
    return <ThesePage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §11 — Accompagnement demandé has its own dedicated page
  if (active === 11) {
    return <AccompagnementPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §12 — ESG / Risques has its own dedicated page
  if (active === 12) {
    return <ESGRisquesPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }
  // §13 — Annexes has its own dedicated page
  if (active === 13) {
    return <AnnexesPage mandat={mandat} sections={sections} setSections={setSections} toast={toast} role={role}/>;
  }

  const sec = sections.find(s => s.id === active);
  if (!sec) return null;
  const nonAuto = sections.filter(s => !s.auto);
  const val = nonAuto.filter(s => s.status === "validated").length;
  const total = nonAuto.length;
  const tagV = sec.status==="validated"?"success":sec.status==="correction"?"coral":sec.status==="submitted"?"purple":sec.status==="draft"?"warn":"default";

  function handleSubmit() {
    setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"submitted"} : s));
    toast("Section soumise au senior", "info");
  }
  function handleRegenerate() {
    toast("Régénération IA...", "info");
    setTimeout(() => {
      setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"draft"} : s));
      toast("Section régénérée");
    }, 1200);
  }

  return (
    <div style={{padding:20, maxWidth:780}}>
      <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
        <div>
          <h3 style={{margin:0, fontSize:16}}>§{sec.id} — {sec.label}</h3>
          <div style={{fontSize:11, color:"#888", marginTop:2}}>3 sources · MAJ il y a 2h · Auteur : {mandat.analyste}</div>
        </div>
        <Tag v={tagV}>{ST[sec.status].l}</Tag>
      </div>
      <div style={{display:"flex", gap:3, marginBottom:14}}>
        {sections.map(s => (<div key={s.id} style={{flex:1, height:4, borderRadius:2, background:ST[s.status].c}}/>))}
      </div>
      {sec.status === "correction" && (
        <Card accent="#D85A30" style={{marginBottom:12, background:"#FBE6DC"}}>
          <div style={{fontSize:11, fontWeight:600, color:"#D85A30", marginBottom:4}}>⚠ Demande de correction · S. Diop</div>
          <div style={{fontSize:12, color:"#333"}}>{sec.comment}</div>
        </Card>
      )}
      {sec.status !== "empty" && (
        <div style={{display:"flex", gap:14}}>
          <Card style={{flex:3, padding:16}}>
            <div style={{fontSize:12, lineHeight:1.7, color:"#333"}}>
              <p style={{margin:"0 0 10px"}}>{sectionContent(sec, mandat).p1}</p>
              <p style={{margin:"0 0 10px"}}>{sectionContent(sec, mandat).p2}</p>
              <p style={{margin:0, color:"#888", fontStyle:"italic"}}>Référence : {sectionContent(sec, mandat).ref}</p>
            </div>
          </Card>
          <div style={{flex:1, minWidth:120}}>
            <div style={{fontSize:9, fontWeight:700, color:"#888", textTransform:"uppercase", marginBottom:6}}>Sources</div>
            {sectionContent(sec, mandat).sources.map(([n, p], i) => (
              <div key={i} style={{padding:"6px 8px", background:"#f8f8f6", borderRadius:4, marginBottom:4, fontSize:10}}>
                <div style={{fontWeight:600}}>{n}</div>
                <div style={{color:"#888"}}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {sec.status === "empty" && (
        <Card style={{textAlign:"center", padding:28, background:"#f8f8f6"}}>
          <div style={{fontSize:13, color:"#888", marginBottom:10}}>Section vide</div>
          <Btn primary small onClick={() => {
            setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"draft"} : s));
            toast("Génération IA...", "info");
          }}>Générer avec IA</Btn>
        </Card>
      )}
      {sec.status === "submitted" && (
        <div style={{marginTop:14, padding:10, background:"#EEEDFE", borderRadius:6, fontSize:11, color:"#534AB7"}}>⏳ En attente de review senior</div>
      )}
      {sec.status === "validated" && (
        <div style={{marginTop:14, padding:10, background:"#EAF3DE", borderRadius:6, fontSize:11, color:"#1D9E75"}}>✓ Validé par S. Diop le 15/04</div>
      )}
      {(role === "senior" || role === "partner") && sec.status === "submitted" && (
        <ReviewPanel sec={sec} setSections={setSections} toast={toast}/>
      )}
      <div style={{display:"flex", justifyContent:"space-between", marginTop:14}}>
        <Btn small onClick={handleRegenerate}>↻ Régénérer</Btn>
        {sec.status !== "submitted" && sec.status !== "validated" && sec.status !== "empty" && (
          <Btn primary small onClick={handleSubmit}>Soumettre au senior</Btn>
        )}
      </div>
    </div>
  );
}

function sectionContent(sec, mandat) {
  const map = {
    2: {p1:`L'actionnariat de ${mandat.name} est principalement détenu par les fondateurs (J. Diabaté 65%, A. Touré 20%) et un investisseur historique local (15%).`, p2:"La gouvernance s'articule autour d'un conseil de surveillance trimestriel et d'un comité d'audit semestriel récemment mis en place.", ref:"Statuts SARL (2020), PV AG 2025", sources:[["Statuts","p.4-8"],["PV AG 2025","p.2"]]},
    6: {p1:"Le modèle économique repose sur la distribution de génériques sous AMM africaine, avec une marge brute moyenne de 38% et un cycle d'exploitation à 78 jours.", p2:"La part des contrats hospitaliers (60% du CA) garantit une récurrence forte mais un BFR tendu sur les créances publiques.", ref:"Liasse SYSCOHADA 2025, P&L mensuel 2025", sources:[["Liasse 2025","p.12-18"],["P&L mensuel","p.3"]]},
    7: {p1:`${mandat.name} affiche un CA 2025 de 2,82 Mds FCFA (+17,5% YoY), avec une marge EBITDA de 12,1% et un résultat net de 215M FCFA.`, p2:"La structure de coûts révèle une masse salariale en hausse de +22% (vs +17% pour le CA), à surveiller sur les exercices suivants.", ref:"Liasse SYSCOHADA 2025, Relevés NSIA Q1 2026", sources:[["Liasse 2025","p.12-18"],["NSIA Q1","p.3"]]},
    9: {p1:"Le bilan présente un total actif de 1,85 Md FCFA, dont 720M en actifs immobilisés et 1,13 Md en actifs circulants.", p2:"Le passif court terme inclut 480M de dettes fournisseurs et 145M de dettes fiscales et sociales. La structure financière est saine avec un gearing de 0,4.", ref:"Liasse SYSCOHADA 2025 (bilan détaillé p.20-28)", sources:[["Liasse 2025","p.20-28"],["Note méthodo","p.1"]]},
    10: {p1:`L'opportunité d'investissement repose sur trois piliers : (i) une position de marché établie sur un segment porteur (CAGR +12% sur la pharma régionale), (ii) une équipe dirigeante expérimentée avec un track-record sur 15 ans, et (iii) un plan de transformation industrielle visant à doubler les capacités de production locale d'ici 2028.`, p2:"Le projet d'investissement vise principalement le financement de l'extension de l'unité de production et le BFR lié à la croissance des contrats hospitaliers.", ref:"Pitch deck (synthèse stratégique)", sources:[["Pitch deck","p.4-7"],["Liasse 2025","p.18"]]},
  };
  return map[sec.id] || {p1:`Contenu généré pour la section ${sec.label}. Cette section synthétise les informations clés à partir des sources documentaires fournies par le mandant.`, p2:"Les éléments quantitatifs sont automatiquement extraits et mis à jour à chaque ajout de document.", ref:"sources documents internes", sources:[["Doc. interne","p.1"]]};
}

function ReviewPanel({sec, setSections, toast}) {
  const [comment, setComment] = useState("");
  return (
    <Card accent="#534AB7" style={{marginTop:14, padding:12, background:"#fafaf7"}}>
      <div style={{fontSize:11, fontWeight:600, color:"#534AB7", marginBottom:8, letterSpacing:0.5, textTransform:"uppercase"}}>Action senior / partner</div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Commentaire (requis pour renvoi à l'analyste)" style={{width:"100%", minHeight:50, padding:6, fontSize:11, border:"1px solid #F1EFE8", borderRadius:4, fontFamily:"inherit", resize:"vertical", marginBottom:8}}/>
      <div style={{display:"flex", gap:6}}>
        <Btn primary small onClick={() => {
          setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"validated"} : s));
          toast("Section validée ✓");
        }}>✓ Valider</Btn>
        <Btn small onClick={() => {
          setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"validated"} : s));
          toast("Section éditée + validée ✓");
        }}>✏ Éditer + Valider</Btn>
        <Btn small onClick={() => {
          if (!comment) { toast("Commentaire requis", "warning"); return; }
          setSections(ss => ss.map(s => s.id === sec.id ? {...s, status:"correction", comment} : s));
          toast("Renvoyée à l'analyste", "info");
        }} style={{color:"#D85A30", borderColor:"#D85A30"}}>↩ Renvoyer</Btn>
      </div>
    </Card>
  );
}

function ValorisationPage({mandat, role, toast}) {
  const [openNote, setOpenNote] = useState(null);

  return (
    <div style={{padding:"0 0 20px"}}>
      {/* Action bar */}
      <div style={{padding:"12px 20px", borderBottom:"1px solid #F1EFE8", background:"#fff", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
        <Tag v="purple">Due Diligence</Tag>
        <span style={{fontSize:11, color:"#888"}}>Lead : S. Koné</span>
        <span style={{flex:1}}/>
        <Btn primary small onClick={() => toast("Due diligence lancée","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>✦</span> Lancer la due diligence
        </Btn>
        <Btn primary small onClick={() => toast("Gestion du deal","info")} style={{display:"flex", alignItems:"center", gap:6}}>
          <span>⚙</span> Gérer le deal
        </Btn>
      </div>

      <div style={{padding:20, maxWidth:920}}>
        <Card style={{padding:20, marginBottom:16, boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
          {/* Card header */}
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap"}}>
            <div style={{fontSize:14, color:"#666"}}>Valorisation</div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <Btn small onClick={() => toast("Édition","info")}>✏ Éditer</Btn>
              <Btn small onClick={() => toast("Régénération IA en cours...","info")}>↻ Régénérer</Btn>
            </div>
          </div>

          {/* SECTION 1 — EV Synthèse */}
          <div style={{marginBottom:24}}>
            <h2 style={{margin:"0 0 4px", fontSize:18, fontWeight:700}}>Valorisation</h2>
            <h3 style={{margin:"4px 0 14px", fontSize:14, color:"#534AB7", fontWeight:700}}>Enterprise Value pondéré</h3>

            <Card style={{padding:20, background:"#EEEDFE", borderLeft:"3px solid #534AB7"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14}}>
                <div style={{flex:1, minWidth:240}}>
                  <div style={{fontSize:10, fontWeight:700, color:"#534AB7", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6}}>EV Synthèse — valeur pondérée globale</div>
                  <div style={{fontSize:30, fontWeight:700, color:"#534AB7", lineHeight:1}}>12,5 M EUR</div>
                  <div style={{fontSize:11, color:"#534AB7", marginTop:8}}>Méthode pondérée DCF (50%) + Multiples (35%) + ANCC (15%)</div>
                </div>
                <span style={{padding:"4px 12px", borderRadius:14, fontSize:11, fontWeight:700, color:"#1D9E75", background:"#EAF3DE", letterSpacing:0.4}}>Convergence des méthodes ±10%</span>
              </div>
            </Card>
          </div>

          {/* SECTION 2 — Détail des méthodes */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Détail des méthodes de valorisation</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10}}>
              {[
                {name:"DCF", subtitle:"Discounted Cash Flow", weight:"50%", value:"12,0 M EUR", color:"#534AB7", bg:"#EEEDFE", hypos:["WACC 18,5%", "Croissance terminale 3,0%", "Horizon explicite 5 ans"]},
                {name:"Multiples", subtitle:"Comparables transactionnels", weight:"35%", value:"13,2 M EUR", color:"#185FA5", bg:"#E3EDF7", hypos:["8,0x EBITDA retraité", "Médiane sectorielle 7,9x", "4 comparables retenus"]},
                {name:"ANCC", subtitle:"Actif Net Comptable Corrigé", weight:"15%", value:"12,0 M EUR", color:"#1D9E75", bg:"#EAF3DE", hypos:["Capitaux propres 720M FCFA", "Goodwill implicite ~90%", "Multiple 9-13x book value"]},
              ].map((m, i) => (
                <Card key={i} style={{padding:14, background:m.bg, borderLeft:`3px solid ${m.color}`}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4}}>
                    <span style={{fontSize:15, fontWeight:700, color:m.color}}>{m.name}</span>
                    <span style={{padding:"2px 8px", borderRadius:10, fontSize:9.5, fontWeight:700, color:"#fff", background:m.color, letterSpacing:0.4}}>Pond. {m.weight}</span>
                  </div>
                  <div style={{fontSize:10, color:"#888", fontStyle:"italic", marginBottom:10}}>{m.subtitle}</div>
                  <div style={{padding:"10px 0", borderTop:`1px solid ${m.color}30`, borderBottom:`1px solid ${m.color}30`, marginBottom:10, textAlign:"center"}}>
                    <div style={{fontSize:9, color:"#888", marginBottom:3, textTransform:"uppercase", letterSpacing:0.4}}>Enterprise Value</div>
                    <div style={{fontSize:20, fontWeight:700, color:m.color}}>{m.value}</div>
                  </div>
                  <div style={{fontSize:9, color:"#888", marginBottom:5, textTransform:"uppercase", letterSpacing:0.4, fontWeight:600}}>Hypothèses clés</div>
                  <ul style={{margin:0, paddingLeft:14, fontSize:11, color:"#444", lineHeight:1.7}}>
                    {m.hypos.map((h, j) => (<li key={j}>{h}</li>))}
                  </ul>
                </Card>
              ))}
            </div>

            {/* Pondération visuelle */}
            <Card style={{padding:14, marginTop:12, background:"#fafaf7"}}>
              <div style={{fontSize:11, fontWeight:700, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Méthodologie de pondération</div>
              <div style={{display:"flex", gap:14, marginBottom:10, flexWrap:"wrap"}}>
                {[
                  {label:"DCF", value:50, color:"#534AB7"},
                  {label:"Multiples", value:35, color:"#185FA5"},
                  {label:"ANCC", value:15, color:"#1D9E75"},
                ].map((p, i) => (
                  <div key={i} style={{flex:1, minWidth:140}}>
                    <div style={{display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:11}}>
                      <span style={{fontWeight:600}}>{p.label}</span>
                      <span style={{fontWeight:700, color:p.color}}>{p.value}%</span>
                    </div>
                    <Prog value={p.value} color={p.color} h={6}/>
                  </div>
                ))}
              </div>
              <p style={{margin:0, fontSize:11, color:"#666", lineHeight:1.6, fontStyle:"italic"}}>
                Pondération privilégiant le DCF comme méthode intrinsèque pour une cible en croissance soutenue avec capacité de production sous-utilisée. Les multiples confirment la cohérence sectorielle. L'ANCC apporte un plancher de valeur lié au moat industriel (BPF, AMM, équipements certifiés).
              </p>
            </Card>
          </div>

          {/* SECTION 3 — Scénarios Bear / Base / Bull */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Scénarios de valorisation</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10}}>
              {[
                {
                  label:"Bear", subtitle:"Marché stagne",
                  ev:"9,5 M EUR", evRange:"7,2 - 11,2",
                  drivers:[["Croissance CA","+8%/an"],["Marge EBITDA","Compression 16%"],["Multiple sortie","6,0x EBITDA"]],
                  color:"#991B1B", bg:"#FEE2E2", border:"#D85A30",
                },
                {
                  label:"Base", subtitle:"Exécution du plan",
                  ev:"12,5 M EUR", evRange:"10,0 - 14,0",
                  drivers:[["Croissance CA","+15%/an"],["Marge EBITDA","Stable 20%"],["Multiple sortie","8,0x EBITDA"]],
                  color:"#1E40AF", bg:"#DBEAFE", border:"#185FA5",
                  highlight:true,
                },
                {
                  label:"Bull", subtitle:"Expansion réussie",
                  ev:"16,0 M EUR", evRange:"14,0 - 18,5",
                  drivers:[["Croissance CA","+22%/an"],["Marge EBITDA","Expansion 24%"],["Multiple sortie","10,0x EBITDA"]],
                  color:"#065F46", bg:"#D1FAE5", border:"#1D9E75",
                },
              ].map((s, i) => (
                <Card key={i} style={{padding:16, background:s.bg, borderLeft:`3px solid ${s.border}`, position:"relative"}}>
                  {s.highlight && (
                    <div style={{position:"absolute", top:-8, right:10, padding:"2px 8px", borderRadius:10, fontSize:9, fontWeight:700, color:"#fff", background:s.border, letterSpacing:0.5}}>SCÉNARIO RETENU</div>
                  )}
                  <div style={{fontSize:13, fontWeight:700, color:s.color, textTransform:"uppercase", letterSpacing:0.6, marginBottom:2}}>{s.label}</div>
                  <div style={{fontSize:11, color:s.color, fontStyle:"italic", marginBottom:14, opacity:0.85}}>« {s.subtitle} »</div>
                  <div style={{padding:"12px 0", borderTop:`1px solid ${s.border}40`, borderBottom:`1px solid ${s.border}40`, marginBottom:12, textAlign:"center"}}>
                    <div style={{fontSize:9, color:s.color, marginBottom:3, textTransform:"uppercase", letterSpacing:0.4, opacity:0.7}}>EV Central</div>
                    <div style={{fontSize:24, fontWeight:700, color:s.color, lineHeight:1.1}}>{s.ev}</div>
                    <div style={{fontSize:10, color:s.color, opacity:0.8, marginTop:4}}>Fourchette : {s.evRange} M EUR</div>
                  </div>
                  <div style={{fontSize:9, color:s.color, marginBottom:6, textTransform:"uppercase", letterSpacing:0.4, fontWeight:600, opacity:0.7}}>Drivers</div>
                  {s.drivers.map(([k, v], j) => (
                    <div key={j} style={{display:"flex", justifyContent:"space-between", padding:"5px 0", fontSize:10.5, borderBottom:j<s.drivers.length-1?`1px solid ${s.border}20`:"none"}}>
                      <span style={{color:s.color, opacity:0.7}}>{k}</span>
                      <span style={{fontWeight:700, color:s.color}}>{v}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          </div>

          {/* SECTION 4 — Structuration du deal */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Structuration du deal</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Paramètre</div>
                <div style={{flex:1, textAlign:"right"}}>Valeur</div>
                <div style={{flex:2.5}}>Commentaire</div>
              </div>
              {[
                {param:"Pre-money", value:"12,5 M EUR", color:"#534AB7", comment:"Aligné sur EV synthèse pondéré (DCF + Multiples + ANCC)", highlight:true},
                {param:"Ticket recommandé", value:"3,2 M EUR", color:"#BA7517", comment:"Equity pure · révisé vs fourchette pre-screening 4-6M EUR", highlight:true},
                {param:"Post-money", value:"15,7 M EUR", color:"#185FA5", comment:"Pre-money + ticket equity"},
                {param:"Equity stake fonds", value:"20,4%", color:"#1D9E75", comment:"Minoritaire actif protégé par droits standard AUSCGIE"},
                {param:"Participation fondateur", value:"79,6%", color:"#666", comment:"Maintien du contrôle majoritaire post-closing"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.highlight?"#EEEDFE":"transparent"}}>
                  <div style={{flex:2, fontWeight:600, color:"#333"}}>{r.param}</div>
                  <div style={{flex:1, textAlign:"right", fontSize:14, fontWeight:700, color:r.color}}>{r.value}</div>
                  <div style={{flex:2.5, fontSize:11, color:"#666", fontStyle:"italic", paddingLeft:10}}>{r.comment}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 5 — Retours attendus */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 14px", fontSize:15, fontWeight:700}}>Retours attendus (horizon 5-7 ans)</h3>
            <div style={{border:"1px solid #F1EFE8", borderRadius:6, overflow:"hidden"}}>
              <div style={{display:"flex", padding:"10px 12px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
                <div style={{flex:2}}>Scénario</div>
                <div style={{flex:1, textAlign:"right"}}>EV sortie</div>
                <div style={{flex:1, textAlign:"right"}}>MOIC</div>
                <div style={{flex:1, textAlign:"right"}}>IRR</div>
                <div style={{flex:1.2, textAlign:"right"}}>Plus-value</div>
              </div>
              {[
                {scenario:"Bear", ev:"18 M EUR", moic:"1,8x", irr:"12%", upside:"+2,6 M EUR", color:"#991B1B", bg:"#FEE2E2"},
                {scenario:"Base", ev:"32 M EUR", moic:"2,8x", irr:"22%", upside:"+5,8 M EUR", color:"#1E40AF", bg:"#DBEAFE", highlight:true},
                {scenario:"Bull", ev:"50 M EUR", moic:"4,1x", irr:"33%", upside:"+9,9 M EUR", color:"#065F46", bg:"#D1FAE5"},
              ].map((r, i, arr) => (
                <div key={i} style={{display:"flex", padding:"12px", fontSize:12, borderBottom:i<arr.length-1?"1px solid #f8f8f6":"none", alignItems:"center", background:r.highlight?r.bg:"transparent"}}>
                  <div style={{flex:2, fontWeight:700, color:r.color}}>{r.scenario}</div>
                  <div style={{flex:1, textAlign:"right", color:"#666"}}>{r.ev}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:700, color:r.color}}>{r.moic}</div>
                  <div style={{flex:1, textAlign:"right", fontWeight:700, color:r.color}}>{r.irr}</div>
                  <div style={{flex:1.2, textAlign:"right", fontWeight:600, color:"#666"}}>{r.upside}</div>
                </div>
              ))}
            </div>
            <Card accent="#534AB7" style={{padding:12, background:"#EEEDFE", marginTop:12}}>
              <div style={{fontSize:11, color:"#444", lineHeight:1.6}}>
                Hypothèses sortie : <strong>cession industrielle ou secondaire</strong> à horizon 5-7 ans (2031-2033). Multiple de sortie cible base case <strong>8,0x EBITDA</strong>, cohérent avec les comparables transactionnels secteur (médiane 8,2x). MOIC base 2,8x conforme aux benchmarks fonds africains mid-market 2018-2024.
              </div>
            </Card>
          </div>

          {/* SECTION 6 — Hypothèses & méthodologie (accordion) */}
          <div style={{marginBottom:24}}>
            <h3 style={{margin:"0 0 12px", fontSize:15, fontWeight:700}}>Hypothèses & méthodologie</h3>
            {[
              {
                title:"DCF — Hypothèses détaillées",
                body:"Modèle DCF construit sur un horizon explicite de 5 ans (2026-2030) suivi d'une valeur terminale Gordon-Shapiro. **WACC retenu 18,5%** calibré sur (i) un coût des capitaux propres de 22% via CAPM (Rf 3,5% + βe 1,2 × MRP 8% + CRP UEMOA 4,8% — source Damodaran 2025), (ii) un coût de la dette après IS de 7,5% (taux bancaire PME UEMOA 10% × (1 - 25% IS)), et (iii) une structure cible D/(D+E) = 30%. **Croissance terminale 3,0%** alignée avec la croissance démographique UEMOA long terme. Sensibilité testée : valorisation pre-money résiliente entre WACC 16% et 22%, range 10,5-14,2 M EUR.",
              },
              {
                title:"Multiples — Comparables retenus",
                body:"4 comparables transactionnels secteur pharma Afrique 2022-2024 :\n\n**Pharmivoire CI (2023)** — 8,2x EBITDA · 1,4x CA · acquéreur Investec / Helios IP\n**Cipharm CI (2022)** — 7,5x EBITDA · 1,2x CA · extension capital Sanofi\n**Strides Africa (2024)** — 9,1x EBITDA · 1,6x CA · acquéreur Mediterrania Capital\n**Saidal Algérie (2023)** — 6,8x EBITDA · 1,0x CA · sovereign fund\n\n**Médiane retenue : 7,9x EBITDA**, appliquée à l'EBITDA retraité 2025 de 480M FCFA (~730k EUR). Décote de 5% appliquée pour reflet du contexte mid-market PME UEMOA vs transactions cotées.",
              },
              {
                title:"ANCC — Actif Net Comptable Corrigé",
                body:"Capitaux propres comptables 2025 : 720M FCFA (~1,1 M EUR). Multiple capitaux propres / pre-money implicite : 9-13x, traduisant un goodwill significatif lié à des actifs intangibles non comptabilisés :\n\n**Portefeuille de 42 AMM** (autorisations de mise sur le marché) construit sur 12 ans — valeur de reconstitution estimée 180-220M FCFA\n\n**Certifications BPF UEMOA** — investissement initial 200-400M FCFA + 18-24 mois de qualification\n\n**Relations clients institutionnels PSP-CI** — historique de fourniture 12+ ans, taux de reconduction AO 80%\n\n**Capacité de production sous-utilisée 38%** — option de croissance gratuite, équivalent à 779M FCFA d'EBITDA additionnel potentiel",
              },
              {
                title:"Pondération et triangulation",
                body:"La pondération **DCF 50% + Multiples 35% + ANCC 15%** reflète la conviction sur les fondamentaux intrinsèques (DCF) tout en intégrant la discipline de marché (multiples sectoriels) et le plancher de valeur (ANCC). Cette pondération est cohérente avec les pratiques de valorisation Esono BA sur les deals mid-market UEMOA.\n\nLa **convergence des trois méthodes dans une fourchette 12,0-13,2 M EUR** (écart max 10%) renforce la conviction sur la valorisation centrale de 12,5 M EUR. Aucune méthode ne ressort comme outlier statistique, ce qui est rare et constitue un signal positif sur la robustesse du dossier financier.",
              },
            ].map((n, i) => (
              <Card key={i} style={{padding:0, marginBottom:6, overflow:"hidden"}}>
                <div onClick={() => setOpenNote(openNote === i ? null : i)} style={{padding:"12px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10}}>
                  <span style={{fontSize:12.5, fontWeight:600, color:"#333"}}>{i+1}. {n.title}</span>
                  <span style={{fontSize:11, color:"#888", fontWeight:700, transition:"transform 0.15s", transform:openNote===i?"rotate(90deg)":"none"}}>▶</span>
                </div>
                {openNote === i && (
                  <div style={{padding:"0 14px 14px", fontSize:11.5, color:"#444", lineHeight:1.7, borderTop:"1px solid #F1EFE8", paddingTop:12, whiteSpace:"pre-line"}}>
                    {n.body.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>)}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Inline review for senior/partner */}
          {(role === "senior" || role === "partner") && (
            <Card accent="#185FA5" style={{padding:12, marginBottom:14, background:"#F4F9FE"}}>
              <div style={{fontSize:11, fontWeight:600, color:"#185FA5", marginBottom:6, letterSpacing:0.5, textTransform:"uppercase"}}>Validation hypothèses ({role === "partner" ? "partner" : "senior"})</div>
              <div style={{fontSize:11, color:"#666", marginBottom:10, lineHeight:1.6}}>WACC à 18,5% me semble approprié vu le risque pays (CI = Ba3 Moody's) et la maturité de la société. Comparables locaux (Cipharm, Pharmivoire) supportent un multiple à 8x. Convergence des 3 méthodes ±10% est un signal positif.</div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                <Btn primary small onClick={() => toast("Hypothèses validées ✓")}>✓ Valider hypothèses</Btn>
                <Btn small onClick={() => toast("Renvoyée à l'analyste","info")} style={{color:"#D85A30", borderColor:"#D85A30"}}>↩ Renvoyer</Btn>
              </div>
            </Card>
          )}

          {/* Métadonnées */}
          <Card style={{padding:14, background:"#fafaf7"}}>
            <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.6, marginBottom:10}}>Métadonnées du document</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 14px", fontSize:11}}>
              {[
                ["Rédigé par", "S. Koné (Analyste)"],
                ["Review par", "A. Diallo (IM)"],
                ["Validé par", "K. N'Guessan (MD)"],
                ["Version", "IC1"],
                ["Méthode pondération", "DCF 50% + Mult 35% + ANCC 15%"],
                ["Convergence méthodes", "±10% (forte)"],
              ].map(([l, v], i) => (
                <div key={i} style={{display:"flex", justifyContent:"space-between", padding:"3px 0"}}>
                  <span style={{color:"#888"}}>{l} :</span>
                  <span style={{fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8", fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.5}}>
              Valorisation indicative IC1 — à recouper en DD financière avec audit certifié des EBITDA retraités. Les multiples comparables sont issus de la base de connaissances Esono BA (transactions 2022-2024) et de Mergermarket Africa. Sensibilité WACC testée jusqu'à 22%, valorisation résiliente.
            </div>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>
              Dernière modif : <strong>K. N'Guessan</strong> · 08 mai, 15:05
            </div>
          </Card>
        </Card>
      </div>
    </div>
  );
}

function TeaserPage({mandat, role, toast}) {
  const [warns, setWarns] = useState([
    {id:1, text:'"Yopougon" — zone industrielle identifiable', ok:false},
    {id:2, text:'CA 2,82 Mds — recoupement possible avec déclarations DGI', ok:false},
    {id:3, text:'Top 3 clients hospitaliers nommés', ok:false},
  ]);
  const allOk = warns.every(w => w.ok);
  function resolve(id) {
    setWarns(ws => ws.map(w => w.id === id ? {...w, ok:true} : w));
    toast("Mention anonymisée ✓");
  }
  return (
    <div style={{padding:20, maxWidth:680}}>
      <h3 style={{margin:"0 0 4px", fontSize:16}}>Teaser anonymisé</h3>
      <div style={{fontSize:11, color:"#888", marginBottom:14}}>1 page envoyée aux fonds avant signature de NDA — anonymat strict du mandant</div>
      <Card style={{padding:18, marginBottom:12}}>
        <Tag v="info" s={{marginBottom:10, display:"inline-block"}}>PROJET ALPHA</Tag>
        <h3 style={{margin:"0 0 8px", fontSize:14}}>Acteur pharmaceutique en Afrique de l'Ouest</h3>
        <p style={{fontSize:11, color:"#666", lineHeight:1.6, margin:"0 0 10px"}}>Société pharmaceutique basée dans une métropole d'Afrique de l'Ouest, spécialisée dans la distribution et la production locale de médicaments génériques. Acteur établi servant les marchés hospitalier et officinal depuis plus de 15 ans.</p>
        <div style={{display:"flex", gap:10, marginTop:10, paddingTop:10, borderTop:"1px solid #F1EFE8"}}>
          <KPI label="CA 2025" value="~3 Mds" color="#534AB7"/>
          <KPI label="Croiss. 3a" value="+18%/an" color="#1D9E75"/>
          <KPI label="EBITDA mg" value="~12%" color="#185FA5"/>
          <KPI label="Ticket" value="11-14M$" color="#BA7517"/>
        </div>
      </Card>
      <Card style={{padding:14, marginBottom:12}}>
        <div style={{fontSize:11, fontWeight:600, marginBottom:8, color:"#666", textTransform:"uppercase", letterSpacing:0.5}}>Vérification anonymisation</div>
        {warns.map(w => (
          <div key={w.id} style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f8f8f6"}}>
            <div style={{display:"flex", alignItems:"center", gap:8, fontSize:11}}>
              <Dot color={w.ok?"#1D9E75":"#D85A30"}/>
              <span style={{color:w.ok?"#888":"#333", textDecoration:w.ok?"line-through":"none"}}>{w.text}</span>
            </div>
            {!w.ok && <Btn small onClick={() => resolve(w.id)}>Anonymiser</Btn>}
            {w.ok && <Tag v="success">Résolu</Tag>}
          </div>
        ))}
      </Card>
      {role === "partner" && allOk && (
        <Card accent="#D85A30" style={{padding:12, marginBottom:12, background:"#FFF8F0"}}>
          <div style={{fontSize:11, fontWeight:600, color:"#D85A30", marginBottom:6, letterSpacing:0.5, textTransform:"uppercase"}}>Approbation partner — diffusion</div>
          <div style={{fontSize:11, color:"#666", marginBottom:10}}>L'anonymisation est complète. Le teaser peut être diffusé aux fonds sélectionnés.</div>
          <div style={{display:"flex", gap:6}}>
            <Btn primary small onClick={() => toast("Teaser approuvé pour diffusion ✓")}>✓ Approuver le teaser</Btn>
            <Btn small onClick={() => toast("Aperçu PDF généré")}>👁 Aperçu PDF</Btn>
          </div>
        </Card>
      )}
      {role !== "partner" && (
        <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
          <Btn small onClick={() => toast("Aperçu généré")}>👁 Aperçu PDF</Btn>
          <Btn primary small disabled={!allOk} onClick={() => toast("Teaser soumis pour validation", "info")}>Soumettre au partner</Btn>
        </div>
      )}
      {!allOk && role !== "partner" && (
        <p style={{fontSize:10, color:"#888", textAlign:"right", marginTop:4}}>Résolvez les {warns.filter(w=>!w.ok).length} alertes avant soumission</p>
      )}
    </div>
  );
}

function FondsPage({mandat, toast}) {
  const [fonds, setFonds] = useState([
    {id:1, name:"Adiwale Partners", score:92, status:"Intéressé", checked:true, last:"NDA signée 14/04"},
    {id:2, name:"AfricInvest", score:85, status:"Teaser envoyé", checked:true, last:"Envoi 10/04"},
    {id:3, name:"Helios Investment", score:78, status:"Pas de réponse", checked:true, last:"Envoi 08/04"},
    {id:4, name:"Mediterrania Capital", score:71, status:"Décliné", checked:false, last:"NoGo 12/04"},
    {id:5, name:"Proparco", score:88, status:"Non contacté", checked:false, last:"-"},
  ]);
  const [note, setNote] = useState("");
  const [showH, setShowH] = useState(false);
  function toggle(id) { setFonds(fs => fs.map(f => f.id === id ? {...f, checked:!f.checked} : f)); }
  return (
    <div style={{padding:20, maxWidth:760}}>
      <h3 style={{margin:"0 0 4px", fontSize:16}}>Fonds & matching</h3>
      <div style={{fontSize:11, color:"#888", marginBottom:14}}>{fonds.filter(f=>f.checked).length} fonds engagés sur {mandat.short}</div>
      {fonds.map(f => (
        <Card key={f.id} style={{marginBottom:6, padding:10, opacity:!f.checked?0.55:1}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <input type="checkbox" checked={f.checked} onChange={() => toggle(f.id)}/>
              <div>
                <div style={{fontSize:12, fontWeight:600}}>{f.name}</div>
                <div style={{fontSize:10, color:"#888"}}>{f.last}</div>
              </div>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <Tag v={f.status==="Intéressé"?"success":f.status==="Décliné"?"coral":f.status==="Pas de réponse"?"warn":"info"}>{f.status}</Tag>
              <span style={{fontSize:10, color:"#888"}}>Score {f.score}</span>
            </div>
          </div>
        </Card>
      ))}
      <Card style={{padding:12, marginTop:12, background:"#f8f8f6", border:"none"}}>
        <div style={{fontSize:11, fontWeight:600, marginBottom:6, color:"#666"}}>Note privée (non partagée)</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Adiwale demandé un appel mardi prochain..." style={{width:"100%", minHeight:50, padding:6, fontSize:11, border:"1px solid #F1EFE8", borderRadius:4, fontFamily:"inherit", resize:"vertical"}}/>
      </Card>
      <Card accent="#BA7517" style={{padding:12, marginTop:10, background:"#FFF8F0"}}>
        <div style={{fontSize:11, fontWeight:600, color:"#BA7517", marginBottom:4}}>⚠ Relances suggérées</div>
        <div style={{fontSize:11, color:"#666"}}>Helios Investment — pas de réponse depuis 7j</div>
      </Card>
      <div style={{display:"flex", gap:6, marginTop:14}}>
        <Btn small onClick={() => toast("IM envoyé aux fonds engagés ✓")}>📧 Envoyer IM</Btn>
        <Btn small onClick={() => toast("Relance envoyée")}>↻ Relancer</Btn>
        <Btn primary small onClick={() => setShowH(true)}>→ Handoff PE</Btn>
      </div>
      {showH && (
        <Modal2 title="Handoff BA → PE" onClose={() => setShowH(false)}>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            <p style={{margin:0, fontSize:12, lineHeight:1.6}}>Transférer le dossier <strong>{mandat.name}</strong> vers le module PE pour le suivi de la due diligence par le fonds Adiwale Partners ?</p>
            <div style={{padding:10, background:"#f8f8f6", borderRadius:5, fontSize:11}}>
              <div style={{marginBottom:4}}><strong>Fonds repreneur :</strong> Adiwale Partners</div>
              <div style={{marginBottom:4}}><strong>Ticket :</strong> {mandat.ticket}</div>
              <div><strong>Stage :</strong> Term sheet en cours</div>
            </div>
            <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
              <Btn small onClick={() => setShowH(false)}>Annuler</Btn>
              <Btn primary small onClick={() => {setShowH(false); toast("Dossier transféré au module PE ✓");}}>Confirmer le handoff</Btn>
            </div>
          </div>
        </Modal2>
      )}
    </div>
  );
}

function MandatShell({mandat, role, sections, setSections, docs, setDocs, toast, onBack}) {
  const initial = useMemo(() => {
    if (role === "senior" || role === "partner") {
      const sub = sections.find(s => s.status === "submitted");
      if (sub) return `memo-${sub.id}`;
    }
    const cor = sections.find(s => s.status === "correction");
    if (cor) return `memo-${cor.id}`;
    return "memo-2";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [active, setActive] = useState(initial);
  const nonAuto = sections.filter(s => !s.auto);
  const validatedCount = nonAuto.filter(s => s.status === "validated").length;
  const totalNonAuto = nonAuto.length;
  const memoStatus = validatedCount === totalNonAuto ? "validated" : sections.some(s => s.status === "correction") ? "correction" : sections.some(s => s.status === "submitted") ? "submitted" : "draft";
  const dataStatus = docs.length >= 6 ? "validated" : docs.length > 0 ? "draft" : "empty";

  const groups = [
    {label:"Données", progress:`${docs.length}/${docs.length + MISSING.length}`, status:dataStatus, items:[
      {id:"upload", label:"Upload documents", icon:Upload, status:docs.length>0?"validated":"empty"},
      {id:"info", label:"Informations de l'analyste", icon:User, status:"validated"},
      {id:"benchmarks", label:"Benchmarks", icon:BarChart3, status:"validated"},
      {id:"sources", label:"Sources & références", icon:BookOpen, status:"validated"},
    ]},
    {label:"Pré-screening", status:"validated", items:[{id:"prescreen", label:"Pré-screening", icon:Search, status:"validated"}]},
    {label:"Mémo investissement", progress:`${validatedCount}/${totalNonAuto}`, status:memoStatus, items: sections.map(s => ({id:`memo-${s.id}`, label:`§${s.id} ${s.label}`, icon:FileText, status:s.status}))},
    {label:"Valorisation", status:"draft", items:[{id:"valo", label:"Valorisation", icon:TrendingUp, status:"draft"}]},
    {label:"Teaser", status:"draft", items:[{id:"teaser", label:"Teaser", icon:Target, status:"draft"}]},
  ];
  if (role === "partner") {
    groups.push({label:"Diffusion", status:"draft", items:[{id:"fonds", label:"Fonds & matching", icon:Briefcase, status:"draft"}]});
  }

  function renderContent() {
    if (active === "upload") return <UploadPage mandat={mandat} docs={docs} setDocs={setDocs} toast={toast}/>;
    if (active === "info") return <InfoAnalystePage mandat={mandat} role={role} toast={toast}/>;
    if (active === "benchmarks") return <BenchmarksPage mandat={mandat}/>;
    if (active === "sources") return <SourcesPage mandat={mandat} docs={docs}/>;
    if (active === "prescreen") return <PreScreenPage mandat={mandat} role={role} toast={toast}/>;
    if (active.startsWith("memo-")) {
      const sid = parseInt(active.replace("memo-", ""));
      return <MemoSection mandat={mandat} sections={sections} setSections={setSections} toast={toast} active={sid} role={role}/>;
    }
    if (active === "valo") return <ValorisationPage mandat={mandat} role={role} toast={toast}/>;
    if (active === "teaser") return <TeaserPage mandat={mandat} role={role} toast={toast}/>;
    if (active === "fonds") return <FondsPage mandat={mandat} toast={toast}/>;
    return null;
  }

  return (
    <div style={{background:"#FAFAFA", minHeight:"100vh"}}>
      <SubHeader onBack={onBack}>
        <span style={{fontSize:13, fontWeight:700, color:"#111827"}}>{mandat.name}</span>
        <span style={{fontSize:11, color:"#6B7280"}}>· {mandat.sector} · {mandat.country} · {mandat.ticket}</span>
        <span style={{flex:1}}/>
        <Tag v={STAGES.find(s=>s.id===mandat.stage)?.id==="im"?"purple":"default"}>{STAGES.find(s=>s.id===mandat.stage)?.label}</Tag>
      </SubHeader>
      <div style={{display:"flex", minHeight:580}}>
        <MandatSideNav groups={groups} active={active} onSelect={setActive}/>
        <div style={{flex:1, overflowY:"auto", minWidth:0, background:"#FAFAFA"}}>{renderContent()}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// CROSS-MANDAT VIEWS
// ════════════════════════════════════════════════════════

function S3({toast, onBack}) {
  return (
    <div>
      <SubHeader onBack={onBack}><span style={{fontSize:12, fontWeight:600}}>Vue consolidée — Tous mandats</span></SubHeader>
      <div style={{padding:20, maxWidth:680}}>
        <Card style={{padding:14, marginBottom:12}}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Charge par analyste</div>
          {[["F. Bamba", 5, 78], ["M. Koné", 6, 65]].map(([n, count, load], i) => (
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:11}}>
                <span style={{fontWeight:600}}>{n}</span>
                <span style={{color:"#888"}}>{count} mandats · {load}% charge</span>
              </div>
              <Prog value={load} color={load>75?"#D85A30":"#534AB7"}/>
            </div>
          ))}
        </Card>
        <Card style={{padding:14, marginBottom:12}}>
          <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Sections en attente de review</div>
          {[["PharmaCi", "§6, §8", "1j"], ["MediLab", "§4", "3j"]].map(([n, secs, age], i) => (
            <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #f8f8f6", fontSize:11}}>
              <span style={{fontWeight:600, flex:1}}>{n}</span>
              <span style={{color:"#888", flex:1}}>{secs}</span>
              <Tag v={age==="3j"?"coral":"warn"}>{age}</Tag>
            </div>
          ))}
        </Card>
        <Card accent="#BA7517" style={{padding:12, background:"#FFF8F0"}}>
          <div style={{fontSize:11, fontWeight:600, color:"#BA7517", marginBottom:6}}>⚠ Alertes</div>
          <ul style={{margin:0, paddingLeft:18, fontSize:11, color:"#666"}}>
            <li>2 sections MediLab en attente depuis +3j</li>
            <li>SolarFarm CI : valuation à finaliser cette semaine (deadline mandat)</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function P6({toast, onBack}) {
  const [f, sF] = useState({name:"", sector:"Pharma", country:"Côte d'Ivoire", dirigeant:"", tL:"", tH:"", success:"3", retainer:"5", analyste:"F. Bamba", senior:"S. Diop"});
  const u = (k, v) => sF(p => ({...p, [k]:v}));
  function inp(l, k, ph) { return (
    <div style={{flex:1, marginBottom:8}}>
      <label style={{fontSize:10, fontWeight:600, color:"#666", display:"block", marginBottom:3}}>{l}</label>
      <input value={f[k]} onChange={e => u(k, e.target.value)} placeholder={ph} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5}}/>
    </div>
  ); }
  function sel(l, k, opts) { return (
    <div style={{flex:1, marginBottom:8}}>
      <label style={{fontSize:10, fontWeight:600, color:"#666", display:"block", marginBottom:3}}>{l}</label>
      <select value={f[k]} onChange={e => u(k, e.target.value)} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5}}>
        {opts.map(o => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  ); }
  return (
    <div>
      <SubHeader onBack={onBack}><span style={{fontSize:12, fontWeight:600}}>Nouveau mandat</span></SubHeader>
      <div style={{padding:20, maxWidth:520, margin:"0 auto"}}>
        <Card style={{padding:16, marginBottom:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:10}}>Société</div>
          {inp("Raison sociale", "name", "Ex: PharmaCi Industries SA")}
          <div style={{display:"flex", gap:10}}>
            {sel("Secteur", "sector", ["Pharma","Agro","Énergie","Transport","IT","Diagnostic","EdTech","Food","Aquaculture","Green"])}
            {sel("Pays", "country", ["Côte d'Ivoire","Sénégal","Burkina Faso","Togo","Mali","Guinée","Bénin"])}
          </div>
          {inp("Dirigeant principal", "dirigeant", "Ex: J. Diabaté")}
        </Card>
        <Card style={{padding:16, marginBottom:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:10}}>Équipe assignée</div>
          <div style={{display:"flex", gap:10}}>
            {sel("Analyste", "analyste", ["F. Bamba","M. Koné","A. Diallo"])}
            {sel("Senior analyste", "senior", ["S. Diop","K. Cissé"])}
          </div>
        </Card>
        <Card style={{padding:16, marginBottom:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:10}}>Fourchette ticket recherché (M USD)</div>
          <div style={{display:"flex", gap:10}}>
            {inp("Bas", "tL", "10")}
            {inp("Haut", "tH", "14")}
          </div>
        </Card>
        <Card style={{padding:16, marginBottom:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:10}}>Honoraires</div>
          <div style={{display:"flex", gap:10}}>
            {inp("Success fee (%)", "success", "3")}
            {inp("Retainer (k USD)", "retainer", "5")}
          </div>
        </Card>
        <Btn primary disabled={!f.name} onClick={() => {toast(`Mandat "${f.name}" enregistré ✓`); onBack();}} style={{width:"100%"}}>Enregistrer</Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PARTNER TABS — Équipe / Candidature / Paramètres
// ════════════════════════════════════════════════════════

function EquipePage({toast}) {
  const [members, setMembers] = useState([
    {id:1, name:"K. Cissé", role:"partner", email:"k.cisse@esono-ba.com", phone:"+225 07 11 22 33 44", joined:"01/01/2024", mandates:11, lastActive:"il y a 2h", status:"active"},
    {id:2, name:"S. Diop", role:"senior", email:"s.diop@esono-ba.com", phone:"+221 77 555 12 34", joined:"15/02/2024", mandates:11, lastActive:"il y a 1h", status:"active"},
    {id:3, name:"F. Bamba", role:"analyste", email:"f.bamba@esono-ba.com", phone:"+225 05 88 77 66 55", joined:"03/06/2024", mandates:5, lastActive:"il y a 30 min", status:"active"},
    {id:4, name:"M. Koné", role:"analyste", email:"m.kone@esono-ba.com", phone:"+225 01 22 33 44 55", joined:"10/09/2024", mandates:6, lastActive:"il y a 4h", status:"active"},
    {id:5, name:"A. Diallo", role:"analyste", email:"a.diallo@esono-ba.com", phone:"-", joined:"-", mandates:0, lastActive:"-", status:"invited"},
  ]);
  const [showInvite, setShowInvite] = useState(false);
  const [invForm, setInvForm] = useState({name:"", email:"", role:"analyste"});
  const [openMember, setOpenMember] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function invite() {
    if (!invForm.name || !invForm.email) { toast("Nom et email requis","warning"); return; }
    setMembers([...members, {id:Date.now(), name:invForm.name, role:invForm.role, email:invForm.email, phone:"-", joined:"-", mandates:0, lastActive:"-", status:"invited"}]);
    setInvForm({name:"", email:"", role:"analyste"});
    setShowInvite(false);
    toast("Invitation envoyée ✓");
  }
  function openManage(m) { setOpenMember(m); setEditForm({...m}); setConfirmDelete(false); }
  function closeManage() { setOpenMember(null); setEditForm(null); setConfirmDelete(false); }
  function saveMember() {
    setMembers(ms => ms.map(m => m.id === editForm.id ? {...m, ...editForm} : m));
    toast("Membre mis à jour ✓");
    closeManage();
  }
  function deleteMember() {
    setMembers(ms => ms.filter(m => m.id !== openMember.id));
    toast(`${openMember.name} supprimé`,"warning");
    closeManage();
  }
  function toggleStatus() {
    setEditForm(f => ({...f, status: f.status === "active" ? "disabled" : "active"}));
  }

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
        <div>
          <div style={{fontSize:11, color:"#888"}}>{members.filter(m=>m.status==="active").length} membre{members.filter(m=>m.status==="active").length>1?"s":""} actif{members.filter(m=>m.status==="active").length>1?"s":""} · {members.filter(m=>m.status==="invited").length} invitation{members.filter(m=>m.status==="invited").length>1?"s":""} en cours</div>
        </div>
        <Btn primary small onClick={() => setShowInvite(true)}>+ Inviter un membre</Btn>
      </div>

      <Card style={{padding:0, overflow:"hidden", marginBottom:14}}>
        <div style={{display:"flex", padding:"10px 14px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7"}}>
          <div style={{flex:2}}>Membre</div>
          <div style={{width:90}}>Rôle</div>
          <div style={{flex:2}}>Email</div>
          <div style={{width:80, textAlign:"right"}}>Mandats</div>
          <div style={{width:120, textAlign:"right"}}>Dernière activité</div>
          <div style={{width:90, textAlign:"right"}}>Actions</div>
        </div>
        {members.map(m => (
          <div key={m.id} style={{display:"flex", padding:"12px 14px", borderBottom:"1px solid #F1EFE8", fontSize:12, alignItems:"center"}}>
            <div style={{flex:2, fontWeight:600, display:"flex", alignItems:"center", gap:8}}>
              <span>{m.name}</span>
              {m.status === "invited" && <Tag v="warn">Invité</Tag>}
              {m.status === "disabled" && <Tag v="default">Désactivé</Tag>}
            </div>
            <div style={{width:90}}>
              <Tag v={m.role==="partner"?"coral":m.role==="senior"?"info":"purple"}>{m.role}</Tag>
            </div>
            <div style={{flex:2, color:"#666", fontSize:11}}>{m.email}</div>
            <div style={{width:80, textAlign:"right", fontWeight:600}}>{m.mandates}</div>
            <div style={{width:120, textAlign:"right", color:"#888", fontSize:10}}>{m.lastActive}</div>
            <div style={{width:90, textAlign:"right"}}>
              <Btn small onClick={() => openManage(m)}>Gérer</Btn>
            </div>
          </div>
        ))}
      </Card>

      <Card style={{padding:14}}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:10}}>Permissions par rôle</div>
        <div style={{display:"flex", padding:"6px 0", fontSize:9, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", letterSpacing:0.5}}>
          <div style={{flex:2}}>Action</div>
          <div style={{flex:1, textAlign:"center"}}>Analyste</div>
          <div style={{flex:1, textAlign:"center"}}>Senior</div>
          <div style={{flex:1, textAlign:"center"}}>Partner</div>
        </div>
        {[
          ["Voir tous les mandats","✗","✓","✓"],
          ["Éditer une section IM","✓","✓","✓"],
          ["Uploader des documents","✓","✓","✓"],
          ["Valider une section IM","✗","✓","✓"],
          ["Valider l'IM globalement","✗","✗","✓"],
          ["Valider la valuation","✗","✓","✓"],
          ["Approuver la diffusion teaser","✗","✗","✓"],
          ["Signer un nouveau mandat","✗","✗","✓"],
          ["Gérer les fonds & matching","✗","✗","✓"],
          ["Examiner les candidatures","✗","✗","✓"],
          ["Gérer l'équipe","✗","✗","✓"],
          ["Modifier les paramètres du fonds","✗","✗","✓"],
        ].map(([n, a, s, p], i) => (
          <div key={i} style={{display:"flex", padding:"6px 0", borderBottom:"1px solid #f8f8f6", fontSize:11, alignItems:"center"}}>
            <div style={{flex:2}}>{n}</div>
            <div style={{flex:1, textAlign:"center", color:a==="✓"?"#1D9E75":"#ccc", fontWeight:700, fontSize:13}}>{a}</div>
            <div style={{flex:1, textAlign:"center", color:s==="✓"?"#1D9E75":"#ccc", fontWeight:700, fontSize:13}}>{s}</div>
            <div style={{flex:1, textAlign:"center", color:p==="✓"?"#1D9E75":"#ccc", fontWeight:700, fontSize:13}}>{p}</div>
          </div>
        ))}
      </Card>

      {showInvite && (
        <Modal2 title="Inviter un membre dans l'équipe" onClose={() => setShowInvite(false)}>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            <div>
              <label style={{fontSize:11, fontWeight:600, color:"#666", display:"block", marginBottom:3}}>Nom complet</label>
              <input value={invForm.name} onChange={e => setInvForm({...invForm, name:e.target.value})} placeholder="Ex: A. Diallo" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5}}/>
            </div>
            <div>
              <label style={{fontSize:11, fontWeight:600, color:"#666", display:"block", marginBottom:3}}>Email professionnel</label>
              <input value={invForm.email} onChange={e => setInvForm({...invForm, email:e.target.value})} placeholder="email@esono-ba.com" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5}}/>
            </div>
            <div>
              <label style={{fontSize:11, fontWeight:600, color:"#666", display:"block", marginBottom:3}}>Rôle</label>
              <select value={invForm.role} onChange={e => setInvForm({...invForm, role:e.target.value})} style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5}}>
                <option value="analyste">Analyste</option>
                <option value="senior">Senior analyste</option>
                <option value="partner">Partner</option>
              </select>
            </div>
            <div style={{padding:10, background:"#f8f8f6", borderRadius:5, fontSize:10, color:"#888", lineHeight:1.5}}>
              Un email d'invitation sera envoyé. Le compte sera créé après acceptation et premier login.
            </div>
            <div style={{display:"flex", gap:6, justifyContent:"flex-end", marginTop:6}}>
              <Btn small onClick={() => setShowInvite(false)}>Annuler</Btn>
              <Btn primary small onClick={invite}>Envoyer l'invitation</Btn>
            </div>
          </div>
        </Modal2>
      )}

      {openMember && editForm && (
        <Modal2 title={`Gérer — ${openMember.name}`} onClose={closeManage} wide>
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
              <Tag v={editForm.role==="partner"?"coral":editForm.role==="senior"?"info":"purple"}>{editForm.role}</Tag>
              {editForm.status === "invited" && <Tag v="warn">Invité</Tag>}
              {editForm.status === "disabled" && <Tag v="default">Désactivé</Tag>}
              {editForm.status === "active" && <Tag v="success">Actif</Tag>}
              <span style={{flex:1}}/>
              <span style={{fontSize:11, color:"#888"}}>Membre depuis {editForm.joined}</span>
            </div>

            <Card style={{padding:14}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Informations</div>
              <div style={{display:"flex", gap:10, marginBottom:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Nom complet</label>
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name:e.target.value})} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Rôle</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role:e.target.value})} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}>
                    <option value="analyste">Analyste</option>
                    <option value="senior">Senior analyste</option>
                    <option value="partner">Partner</option>
                  </select>
                </div>
              </div>
              <div style={{display:"flex", gap:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Email</label>
                  <input value={editForm.email} onChange={e => setEditForm({...editForm, email:e.target.value})} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Téléphone</label>
                  <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone:e.target.value})} style={{width:"100%", padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
                </div>
              </div>
            </Card>

            <Card style={{padding:14}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Activité</div>
              <div style={{display:"flex", gap:14, fontSize:11}}>
                <div><span style={{color:"#888"}}>Mandats actifs :</span> <strong>{openMember.mandates}</strong></div>
                <div><span style={{color:"#888"}}>Dernière activité :</span> <strong>{openMember.lastActive}</strong></div>
              </div>
            </Card>

            <Card accent="#BA7517" style={{padding:14, background:"#FFF8F0"}}>
              <div style={{fontSize:11, fontWeight:600, color:"#BA7517", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Zone d'administration</div>
              <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:10}}>
                <Btn small onClick={toggleStatus}>{editForm.status === "active" ? "Désactiver le compte" : "Réactiver le compte"}</Btn>
                <span style={{fontSize:10, color:"#888"}}>Le membre désactivé ne peut plus se connecter mais ses contributions sont conservées.</span>
              </div>
              {!confirmDelete ? (
                <Btn small onClick={() => setConfirmDelete(true)} style={{color:"#D85A30", borderColor:"#D85A30"}}>🗑 Supprimer définitivement</Btn>
              ) : (
                <div style={{padding:10, background:"#FBE6DC", borderRadius:5, marginTop:6}}>
                  <div style={{fontSize:11, color:"#A32D2D", marginBottom:8, fontWeight:600}}>Supprimer définitivement {openMember.name} ?</div>
                  <div style={{fontSize:10, color:"#A32D2D", marginBottom:8}}>Cette action est irréversible. Les mandats actifs seront réassignés.</div>
                  <div style={{display:"flex", gap:6}}>
                    <Btn small onClick={() => setConfirmDelete(false)}>Annuler</Btn>
                    <Btn small onClick={deleteMember} style={{color:"#fff", background:"#D85A30", borderColor:"#D85A30"}}>Confirmer la suppression</Btn>
                  </div>
                </div>
              )}
            </Card>

            <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
              <Btn small onClick={closeManage}>Annuler</Btn>
              <Btn primary small onClick={saveMember}>Enregistrer les modifications</Btn>
            </div>
          </div>
        </Modal2>
      )}
    </div>
  );
}

function CandidaturePage({toast}) {
  const [view, setView] = useState("list"); // list | form
  const [formConfig, setFormConfig] = useState({
    title:"Appel à candidatures Esono BA — Q3 2026",
    description:"Vous êtes une PME africaine en croissance recherchant un financement de 2 à 25M USD ? Candidatez pour un accompagnement structuré par Esono BA jusqu'à la mise en relation avec des fonds qualifiés.",
    startDate:"15/05/2026",
    endDate:"30/06/2026",
    fields:[
      {id:1, label:"Raison sociale", type:"text", required:true},
      {id:2, label:"Pays d'opération", type:"select", required:true, options:["Côte d'Ivoire","Sénégal","Burkina Faso","Togo","Mali","Guinée","Bénin","Niger"]},
      {id:3, label:"Secteur d'activité", type:"select", required:true, options:["Pharma","Agro","Énergie","Transport","FinTech","Diagnostic","EdTech","Food","IT","Santé"]},
      {id:4, label:"Description de l'activité", type:"textarea", required:true},
      {id:5, label:"Année de création", type:"number", required:true},
      {id:6, label:"Chiffre d'affaires 2025 (USD)", type:"number", required:true},
      {id:7, label:"Ticket recherché (M USD)", type:"text", required:true},
      {id:8, label:"Référent / Contact", type:"text", required:true},
      {id:9, label:"Email de contact", type:"email", required:true},
      {id:10, label:"Téléphone", type:"text", required:false},
    ],
  });
  const [apps, setApps] = useState([
    {id:1, name:"Boulangerie Atlantique", sector:"Agro", country:"CI", ticket:"3-5M", date:"05/05/2026", source:"Formulaire", status:"new", score:78, contact:"O. Bakayoko", desc:"Réseau de 12 boulangeries industrielles en zone Abidjan, recherche financement extension Bouaké et acquisition d'une nouvelle ligne de production."},
    {id:2, name:"AgriTech Bamako", sector:"Agro", country:"ML", ticket:"8M", date:"03/05/2026", source:"Formulaire", status:"reviewing", score:85, contact:"M. Coulibaly", desc:"Solution data pour les coopératives rizicoles, traction 3K agriculteurs sur 4 régions."},
    {id:3, name:"FinHub Abidjan", sector:"FinTech", country:"CI", ticket:"12M", date:"01/05/2026", source:"Formulaire", status:"reviewing", score:91, contact:"K. Touré", desc:"Plateforme de paiement B2B inter-entreprises, 250M FCFA TPV mensuel, croissance +15%/mois."},
    {id:4, name:"GreenBuild SN", sector:"Construction", country:"SN", ticket:"6M", date:"28/04/2026", source:"Formulaire", status:"accepted", score:72, contact:"F. Sarr", desc:"Construction durable, 8 projets délivrés sur 3 ans à Dakar et Saint-Louis."},
    {id:5, name:"E-Santé Lomé", sector:"Santé", country:"TG", ticket:"4M", date:"25/04/2026", source:"Formulaire", status:"rejected", score:45, contact:"D. Adjavon", desc:"Plateforme téléconsultation, traction limitée (200 utilisateurs actifs)."},
  ]);
  const [openApp, setOpenApp] = useState(null);

  if (view === "form") {
    return <CandidatureFormBuilder config={formConfig} setConfig={setFormConfig} onBack={() => setView("list")} toast={toast}/>;
  }

  function changeStatus(id, status) {
    setApps(as => as.map(a => a.id === id ? {...a, status} : a));
    if (status === "reviewing") toast("Candidature mise en revue","info");
    if (status === "accepted") toast("Candidature acceptée — créer le mandat ?");
    if (status === "rejected") toast("Candidature refusée","info");
  }

  const counts = {
    new: apps.filter(a => a.status === "new").length,
    reviewing: apps.filter(a => a.status === "reviewing").length,
    accepted: apps.filter(a => a.status === "accepted").length,
    rejected: apps.filter(a => a.status === "rejected").length,
  };

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10, flexWrap:"wrap"}}>
        <div style={{fontSize:11, color:"#888", flex:1, minWidth:200}}>Gérez l'appel à candidatures, sa diffusion et les réponses reçues.</div>
        <Btn primary onClick={() => setView("form")}>⚙ Gérer le formulaire</Btn>
      </div>

      <Card style={{padding:14, marginBottom:14}}>
        <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Diffusion de l'appel</div>
        <div style={{display:"flex", gap:14, flexWrap:"wrap", marginBottom:12}}>
          <div style={{flex:1, minWidth:160}}>
            <div style={{fontSize:10, color:"#888"}}>Statut</div>
            <div style={{fontSize:13, fontWeight:600, color:"#1D9E75", marginTop:4, display:"flex", alignItems:"center", gap:6}}>
              <Dot color="#1D9E75" s={8}/> Actif
            </div>
          </div>
          <div style={{flex:1, minWidth:160}}>
            <div style={{fontSize:10, color:"#888"}}>Période</div>
            <div style={{fontSize:13, fontWeight:600, marginTop:4}}>{formConfig.startDate} → {formConfig.endDate}</div>
          </div>
          <div style={{flex:2, minWidth:240}}>
            <div style={{fontSize:10, color:"#888"}}>Lien public</div>
            <div style={{display:"flex", gap:5, marginTop:4}}>
              <input readOnly value="https://esono-ba.com/candidature/q3-2026" style={{flex:1, padding:6, fontSize:11, border:"1px solid #F1EFE8", borderRadius:5, color:"#666", fontFamily:"monospace"}}/>
              <Btn small onClick={() => toast("Lien copié ✓")}>📋</Btn>
            </div>
          </div>
        </div>
        <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
          <Btn small onClick={() => toast("Diffusion mise en pause","warning")} style={{color:"#BA7517", borderColor:"#BA7517"}}>⏸ Mettre en pause</Btn>
        </div>
      </Card>

      <div style={{fontSize:12, fontWeight:600, color:"#444", marginBottom:8}}>Réponses reçues — {apps.length} candidature{apps.length>1?"s":""}</div>

      <div style={{display:"flex", gap:6, marginBottom:14}}>
        <Card style={{flex:1, padding:12, textAlign:"center"}}>
          <div style={{fontSize:18, fontWeight:700, color:"#534AB7"}}>{counts.new}</div>
          <div style={{fontSize:10, color:"#888", marginTop:2}}>Nouvelles</div>
        </Card>
        <Card style={{flex:1, padding:12, textAlign:"center"}}>
          <div style={{fontSize:18, fontWeight:700, color:"#BA7517"}}>{counts.reviewing}</div>
          <div style={{fontSize:10, color:"#888", marginTop:2}}>En revue</div>
        </Card>
        <Card style={{flex:1, padding:12, textAlign:"center"}}>
          <div style={{fontSize:18, fontWeight:700, color:"#1D9E75"}}>{counts.accepted}</div>
          <div style={{fontSize:10, color:"#888", marginTop:2}}>Acceptées</div>
        </Card>
        <Card style={{flex:1, padding:12, textAlign:"center"}}>
          <div style={{fontSize:18, fontWeight:700, color:"#888"}}>{counts.rejected}</div>
          <div style={{fontSize:10, color:"#888", marginTop:2}}>Refusées</div>
        </Card>
      </div>

      <Card style={{padding:0, overflow:"hidden"}}>
        <div style={{display:"flex", padding:"10px 14px", fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", borderBottom:"1px solid #F1EFE8", background:"#fafaf7", letterSpacing:0.5}}>
          <div style={{flex:2}}>Candidat</div>
          <div style={{width:90}}>Secteur</div>
          <div style={{width:60}}>Ticket</div>
          <div style={{width:75}}>Reçue</div>
          <div style={{width:55, textAlign:"center"}}>Score IA</div>
          <div style={{width:90}}>Statut</div>
          <div style={{width:100, textAlign:"right"}}>Actions</div>
        </div>
        {apps.map(a => (
          <div key={a.id} onClick={() => setOpenApp(a)} style={{display:"flex", padding:"12px 14px", borderBottom:"1px solid #F1EFE8", fontSize:11, alignItems:"center", cursor:"pointer"}}>
            <div style={{flex:2}}>
              <div style={{fontWeight:600}}>{a.name}</div>
              <div style={{fontSize:10, color:"#888"}}>{a.contact} · {a.country}</div>
            </div>
            <div style={{width:90, color:"#666"}}>{a.sector}</div>
            <div style={{width:60, color:"#534AB7", fontWeight:600}}>{a.ticket}</div>
            <div style={{width:75, color:"#888", fontSize:10}}>{a.date}</div>
            <div style={{width:55, textAlign:"center"}}>
              <span style={{padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700, color:a.score>=80?"#1D9E75":a.score>=60?"#BA7517":"#D85A30", background:a.score>=80?"#EAF3DE":a.score>=60?"#FFF8F0":"#FBE6DC"}}>{a.score}</span>
            </div>
            <div style={{width:90}}>
              <Tag v={a.status==="new"?"purple":a.status==="reviewing"?"warn":a.status==="accepted"?"success":"default"}>
                {a.status==="new"?"Nouvelle":a.status==="reviewing"?"En revue":a.status==="accepted"?"Acceptée":"Refusée"}
              </Tag>
            </div>
            <div style={{width:100, textAlign:"right"}}>
              {a.status === "new" && (
                <Btn small onClick={(e) => {e.stopPropagation(); changeStatus(a.id, "reviewing");}}>Examiner</Btn>
              )}
              {a.status === "reviewing" && (
                <div style={{display:"flex", gap:3, justifyContent:"flex-end"}}>
                  <Btn small onClick={(e) => {e.stopPropagation(); changeStatus(a.id, "accepted");}} style={{color:"#1D9E75", borderColor:"#1D9E75", padding:"4px 8px"}}>✓</Btn>
                  <Btn small onClick={(e) => {e.stopPropagation(); changeStatus(a.id, "rejected");}} style={{color:"#D85A30", borderColor:"#D85A30", padding:"4px 8px"}}>✗</Btn>
                </div>
              )}
              {a.status === "accepted" && (
                <Btn primary small onClick={(e) => {e.stopPropagation(); toast("Création du mandat...");}}>→ Mandat</Btn>
              )}
            </div>
          </div>
        ))}
      </Card>

      {openApp && (
        <Modal2 title={openApp.name} onClose={() => setOpenApp(null)} wide>
          <div style={{display:"flex", flexDirection:"column", gap:12}}>
            <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
              <Tag v={openApp.status==="new"?"purple":openApp.status==="reviewing"?"warn":openApp.status==="accepted"?"success":"default"}>{openApp.status==="new"?"Nouvelle":openApp.status==="reviewing"?"En revue":openApp.status==="accepted"?"Acceptée":"Refusée"}</Tag>
              <span style={{fontSize:11, color:"#888"}}>· {openApp.sector} · {openApp.country} · ticket {openApp.ticket}</span>
              <span style={{flex:1}}/>
              <span style={{padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700, color:openApp.score>=80?"#1D9E75":openApp.score>=60?"#BA7517":"#D85A30", background:openApp.score>=80?"#EAF3DE":openApp.score>=60?"#FFF8F0":"#FBE6DC"}}>Score IA {openApp.score}</span>
            </div>
            <Card style={{padding:12, background:"#fafaf7", border:"none"}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Description</div>
              <p style={{margin:0, fontSize:12, lineHeight:1.6}}>{openApp.desc}</p>
            </Card>
            <Card style={{padding:12}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Contact candidat</div>
              <div style={{display:"flex", gap:14, fontSize:11, flexWrap:"wrap"}}>
                <div><span style={{color:"#888"}}>Référent :</span> <strong>{openApp.contact}</strong></div>
                <div><span style={{color:"#888"}}>Source :</span> {openApp.source}</div>
                <div><span style={{color:"#888"}}>Reçue :</span> {openApp.date}</div>
              </div>
            </Card>
            <Card accent="#534AB7" style={{padding:12, background:"#fafaf7"}}>
              <div style={{fontSize:11, fontWeight:600, color:"#534AB7", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Pré-screening IA</div>
              {[
                ["Secteur autorisé par la thèse fonds", true],
                ["Géographie éligible UEMOA/CEDEAO", true],
                ["Ticket dans la fourchette 2-25M USD", true],
                ["Ancienneté société ≥ 3 ans", openApp.score >= 60],
                ["Documentation initiale fournie", openApp.score >= 70],
              ].map(([label, ok], i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"4px 0", fontSize:11}}>
                  <CheckCircle status={ok?"validated":"empty"} size={12}/>
                  <span>{label}</span>
                </div>
              ))}
            </Card>
            <div style={{display:"flex", gap:6, justifyContent:"flex-end", marginTop:6}}>
              {openApp.status === "new" && (
                <>
                  <Btn small onClick={() => {changeStatus(openApp.id, "rejected"); setOpenApp(null);}} style={{color:"#D85A30", borderColor:"#D85A30"}}>✗ Refuser</Btn>
                  <Btn primary small onClick={() => {changeStatus(openApp.id, "reviewing"); setOpenApp(null);}}>Mettre en revue</Btn>
                </>
              )}
              {openApp.status === "reviewing" && (
                <>
                  <Btn small onClick={() => {changeStatus(openApp.id, "rejected"); setOpenApp(null);}} style={{color:"#D85A30", borderColor:"#D85A30"}}>✗ Refuser</Btn>
                  <Btn primary small onClick={() => {changeStatus(openApp.id, "accepted"); setOpenApp(null);}}>✓ Accepter</Btn>
                </>
              )}
              {openApp.status === "accepted" && (
                <Btn primary small onClick={() => {toast("Création du mandat..."); setOpenApp(null);}}>→ Créer le mandat</Btn>
              )}
            </div>
          </div>
        </Modal2>
      )}
    </div>
  );
}

function CandidatureFormBuilder({config, setConfig, onBack, toast}) {
  const [draft, setDraft] = useState({...config});
  const [previewMode, setPreviewMode] = useState(false);

  function updateField(id, key, value) {
    setDraft({...draft, fields: draft.fields.map(f => f.id === id ? {...f, [key]:value} : f)});
  }
  function removeField(id) {
    setDraft({...draft, fields: draft.fields.filter(f => f.id !== id)});
  }
  function addField() {
    setDraft({...draft, fields:[...draft.fields, {id:Date.now(), label:"Nouveau champ", type:"text", required:false}]});
  }
  function save() {
    setConfig(draft);
    toast("Formulaire enregistré ✓");
    onBack();
  }

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, gap:10, flexWrap:"wrap"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span onClick={onBack} style={{cursor:"pointer", color:"#888", fontSize:13, display:"flex", alignItems:"center", gap:4}}>
            <ChevronLeft size={14}/> Candidatures
          </span>
          <span style={{color:"#ddd"}}>|</span>
          <span style={{fontSize:14, fontWeight:600}}>Gérer le formulaire</span>
        </div>
        <div style={{display:"flex", gap:6}}>
          <Btn small primary={!previewMode} onClick={() => setPreviewMode(false)}>✏ Éditer</Btn>
          <Btn small primary={previewMode} onClick={() => setPreviewMode(true)}>👁 Aperçu</Btn>
        </div>
      </div>

      {!previewMode ? (
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
          {/* Editor */}
          <div>
            <Card style={{padding:14, marginBottom:12}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>En-tête du formulaire</div>
              <div style={{marginBottom:10}}>
                <label style={{fontSize:10, color:"#888"}}>Titre</label>
                <input value={draft.title} onChange={e => setDraft({...draft, title:e.target.value})} style={{width:"100%", padding:8, fontSize:13, fontWeight:600, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
              </div>
              <div>
                <label style={{fontSize:10, color:"#888"}}>Description</label>
                <textarea value={draft.description} onChange={e => setDraft({...draft, description:e.target.value})} style={{width:"100%", minHeight:70, padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3, fontFamily:"inherit", resize:"vertical"}}/>
              </div>
            </Card>

            <Card style={{padding:14, marginBottom:12}}>
              <div style={{fontSize:11, fontWeight:600, color:"#666", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5}}>Période d'ouverture</div>
              <div style={{display:"flex", gap:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Date de début</label>
                  <input type="text" value={draft.startDate} onChange={e => setDraft({...draft, startDate:e.target.value})} placeholder="JJ/MM/AAAA" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:10, color:"#888"}}>Date de fin</label>
                  <input type="text" value={draft.endDate} onChange={e => setDraft({...draft, endDate:e.target.value})} placeholder="JJ/MM/AAAA" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
                </div>
              </div>
              <div style={{fontSize:10, color:"#888", marginTop:6, lineHeight:1.5}}>Les candidatures ne sont acceptées que pendant cette période. Le formulaire devient inaccessible en dehors.</div>
            </Card>

            <Card style={{padding:14}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                <div style={{fontSize:11, fontWeight:600, color:"#666", textTransform:"uppercase", letterSpacing:0.5}}>Champs du formulaire ({draft.fields.length})</div>
                <Btn small onClick={addField}>+ Ajouter</Btn>
              </div>
              {draft.fields.map((f, i) => (
                <div key={f.id} style={{padding:"10px 0", borderBottom:i<draft.fields.length-1?"1px solid #f8f8f6":"none"}}>
                  <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:6}}>
                    <span style={{fontSize:10, color:"#888", fontWeight:700, width:18}}>{i+1}.</span>
                    <input value={f.label} onChange={e => updateField(f.id, "label", e.target.value)} style={{flex:1, padding:5, fontSize:12, fontWeight:600, border:"1px solid #F1EFE8", borderRadius:4}}/>
                    <span onClick={() => removeField(f.id)} style={{cursor:"pointer", color:"#D85A30", fontSize:14, padding:"4px 6px"}}>🗑</span>
                  </div>
                  <div style={{display:"flex", gap:6, alignItems:"center", paddingLeft:24}}>
                    <select value={f.type} onChange={e => updateField(f.id, "type", e.target.value)} style={{padding:4, fontSize:10, border:"1px solid #F1EFE8", borderRadius:4}}>
                      <option value="text">Texte court</option>
                      <option value="textarea">Texte long</option>
                      <option value="number">Nombre</option>
                      <option value="email">Email</option>
                      <option value="select">Liste déroulante</option>
                      <option value="date">Date</option>
                    </select>
                    <label style={{fontSize:10, display:"flex", alignItems:"center", gap:4, cursor:"pointer"}}>
                      <input type="checkbox" checked={f.required} onChange={e => updateField(f.id, "required", e.target.checked)}/>
                      Requis
                    </label>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Preview side */}
          <div>
            <div style={{position:"sticky", top:0}}>
              <div style={{fontSize:10, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8}}>Aperçu en temps réel</div>
              <Card style={{padding:24, background:"#fafaf7"}}>
                <FormPreview config={draft}/>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <Card style={{padding:30, maxWidth:640, margin:"0 auto", background:"#fafaf7"}}>
          <FormPreview config={draft}/>
        </Card>
      )}

      <div style={{display:"flex", justifyContent:"flex-end", gap:6, marginTop:18}}>
        <Btn onClick={onBack}>Annuler</Btn>
        <Btn primary onClick={save}>Enregistrer</Btn>
      </div>
    </div>
  );
}

function FormPreview({config}) {
  return (
    <div>
      <div style={{padding:"3px 10px", borderRadius:12, background:"#EAF3DE", color:"#1D9E75", fontSize:10, fontWeight:600, display:"inline-block", marginBottom:10}}>
        Ouvert du {config.startDate} au {config.endDate}
      </div>
      <h3 style={{margin:"0 0 8px", fontSize:18, fontWeight:700}}>{config.title}</h3>
      <p style={{fontSize:12, color:"#666", lineHeight:1.6, margin:"0 0 18px"}}>{config.description}</p>

      {config.fields.map(f => (
        <div key={f.id} style={{marginBottom:12}}>
          <label style={{fontSize:11, fontWeight:600, color:"#444", display:"block", marginBottom:4}}>
            {f.label} {f.required && <span style={{color:"#D85A30"}}>*</span>}
          </label>
          {f.type === "text" && <input disabled style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, background:"#fff"}}/>}
          {f.type === "email" && <input disabled type="email" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, background:"#fff"}}/>}
          {f.type === "number" && <input disabled type="number" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, background:"#fff"}}/>}
          {f.type === "date" && <input disabled type="date" style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, background:"#fff"}}/>}
          {f.type === "textarea" && <textarea disabled style={{width:"100%", minHeight:70, padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, fontFamily:"inherit", background:"#fff"}}/>}
          {f.type === "select" && (
            <select disabled style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, background:"#fff"}}>
              <option>— Sélectionner —</option>
              {(f.options || []).map(o => (<option key={o}>{o}</option>))}
            </select>
          )}
        </div>
      ))}

      <Btn primary disabled style={{width:"100%", marginTop:10}}>Envoyer ma candidature</Btn>
    </div>
  );
}

function ParametresPage({toast}) {
  const [section, setSection] = useState("fonds");
  const sections = [
    {id:"fonds", label:"Fonds"},
    {id:"devise", label:"Devise & formats"},
    {id:"criteres", label:"Critères d'investissement"},
    {id:"these", label:"Thèse d'investissement"},
  ];
  const [fund, setFund] = useState({name:"Esono Banque d'Affaires", legal:"Esono BA SAS", contact:"contact@esono-ba.com", website:"https://esono-ba.com", address:"Abidjan, Plateau, Immeuble Botreau Roussel"});
  const [fmt, setFmt] = useState({currency:"USD", date:"DD/MM/YYYY", lang:"FR", num:"1 234,56"});
  const [crit, setCrit] = useState({tMin:"2", tMax:"25", sectors:["Pharma","Agro","Énergie","FinTech","Diagnostic","EdTech","Food","IT","Aquaculture","Santé"], excluded:["Tabac","Alcool","Armes","Jeux d'argent"], geos:["Côte d'Ivoire","Sénégal","Mali","Burkina Faso","Togo","Bénin","Guinée","Niger"], minAge:"3", esg:true});
  const [these, setThese] = useState("Esono BA structure des opérations de levée de fonds (capital-développement et capital-transmission) pour des PME africaines à fort potentiel d'impact, sur les secteurs de la santé, de l'agro, de l'énergie et du numérique. Tickets 2-25M USD, géographie UEMOA + CEDEAO. Critères ESG stricts (exclusion tabac, alcool, armes, jeu).\n\nLa proposition de valeur repose sur trois piliers : (i) accès à un réseau qualifié de fonds DFI et privés actifs en Afrique francophone, (ii) production d'une documentation IM auditable grâce à l'IA appliquée aux données financières SYSCOHADA, (iii) accompagnement opérationnel post-deal pour sécuriser l'exécution des plans de croissance.");

  return (
    <div>
      <div style={{display:"flex", borderBottom:"1px solid #F1EFE8", marginBottom:18, paddingBottom:0, gap:0}}>
        {sections.map(s => (
          <div key={s.id} onClick={() => setSection(s.id)} style={{padding:"8px 14px", fontSize:11, fontWeight:600, cursor:"pointer", color:section===s.id?"#534AB7":"#666", borderBottom:section===s.id?"2px solid #534AB7":"2px solid transparent", marginBottom:-1, transition:"all 0.15s"}}>
            {s.label}
          </div>
        ))}
      </div>

      {section === "fonds" && (
        <div style={{maxWidth:560}}>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Identité du fonds</div>
            {[["Nom commercial","name"],["Raison sociale","legal"],["Email contact","contact"],["Site web","website"],["Adresse","address"]].map(([l,k]) => (
              <div key={k} style={{marginBottom:10}}>
                <label style={{fontSize:10, fontWeight:600, color:"#888", display:"block", marginBottom:3}}>{l}</label>
                <input value={fund[k]} onChange={e => setFund({...fund, [k]:e.target.value})} style={{width:"100%", padding:8, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, fontFamily:"inherit"}}/>
              </div>
            ))}
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:10, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Logo</div>
            <div style={{border:"2px dashed #d0cfc8", borderRadius:6, padding:24, textAlign:"center", cursor:"pointer", background:"#fafaf7"}} onClick={() => toast("Logo uploadé ✓")}>
              <Upload size={18} style={{color:"#888", marginBottom:6}}/>
              <div style={{fontSize:12, color:"#666"}}>Cliquer pour uploader (PNG, SVG, JPG)</div>
            </div>
          </Card>
          <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
            <Btn primary small onClick={() => toast("Paramètres du fonds sauvegardés ✓")}>Sauvegarder</Btn>
          </div>
        </div>
      )}

      {section === "devise" && (
        <div style={{maxWidth:560}}>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Devise par défaut</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {["USD","EUR","FCFA","GBP"].map(c => (
                <Btn key={c} small primary={fmt.currency===c} onClick={() => setFmt({...fmt, currency:c})}>{c}</Btn>
              ))}
            </div>
            <p style={{fontSize:10, color:"#888", marginTop:8, marginBottom:0, lineHeight:1.5}}>Cette devise est utilisée par défaut pour les valuations, fourchettes de prix et présentation aux fonds. Vous pourrez la modifier au cas par cas.</p>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Format de date</div>
            <div style={{display:"flex", gap:6}}>
              {["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(d => (
                <Btn key={d} small primary={fmt.date===d} onClick={() => setFmt({...fmt, date:d})}>{d}</Btn>
              ))}
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Format des nombres</div>
            <div style={{display:"flex", gap:6}}>
              {["1 234,56","1,234.56","1.234,56"].map(n => (
                <Btn key={n} small primary={fmt.num===n} onClick={() => setFmt({...fmt, num:n})}>{n}</Btn>
              ))}
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Langue de l'interface</div>
            <div style={{display:"flex", gap:6}}>
              {["FR","EN"].map(l => (
                <Btn key={l} small primary={fmt.lang===l} onClick={() => setFmt({...fmt, lang:l})}>{l}</Btn>
              ))}
            </div>
          </Card>
          <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
            <Btn primary small onClick={() => toast("Préférences sauvegardées ✓")}>Sauvegarder</Btn>
          </div>
        </div>
      )}

      {section === "criteres" && (
        <div style={{maxWidth:680}}>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Fourchette ticket (M USD)</div>
            <div style={{display:"flex", gap:14}}>
              <div style={{flex:1}}>
                <label style={{fontSize:10, color:"#888"}}>Minimum</label>
                <input value={crit.tMin} onChange={e => setCrit({...crit, tMin:e.target.value})} style={{width:"100%", padding:6, fontSize:13, fontWeight:600, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:10, color:"#888"}}>Maximum</label>
                <input value={crit.tMax} onChange={e => setCrit({...crit, tMax:e.target.value})} style={{width:"100%", padding:6, fontSize:13, fontWeight:600, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3}}/>
              </div>
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:6, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Secteurs autorisés ({crit.sectors.length})</div>
            <p style={{fontSize:10, color:"#888", margin:"0 0 10px"}}>Cliquer sur un secteur pour le retirer de la liste autorisée</p>
            <div style={{display:"flex", gap:5, flexWrap:"wrap", marginBottom:10}}>
              {crit.sectors.map(s => (
                <span key={s} onClick={() => setCrit({...crit, sectors:crit.sectors.filter(x => x !== s)})} style={{padding:"4px 10px", borderRadius:14, fontSize:11, fontWeight:600, background:"#EAF3DE", color:"#1D9E75", cursor:"pointer"}}>✓ {s} ×</span>
              ))}
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:6, textTransform:"uppercase", color:"#D85A30", letterSpacing:0.5}}>Secteurs exclus ({crit.excluded.length})</div>
            <p style={{fontSize:10, color:"#888", margin:"0 0 10px"}}>Exclusions ESG strictes — les candidatures sur ces secteurs sont automatiquement filtrées</p>
            <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
              {crit.excluded.map(s => (
                <span key={s} style={{padding:"4px 10px", borderRadius:14, fontSize:11, fontWeight:600, background:"#FBE6DC", color:"#D85A30"}}>✗ {s}</span>
              ))}
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:6, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Géographies cibles ({crit.geos.length})</div>
            <div style={{display:"flex", gap:5, flexWrap:"wrap", marginTop:10}}>
              {crit.geos.map(g => (
                <span key={g} onClick={() => setCrit({...crit, geos:crit.geos.filter(x => x !== g)})} style={{padding:"4px 10px", borderRadius:14, fontSize:11, fontWeight:600, background:"#EEEDFE", color:"#534AB7", cursor:"pointer"}}>{g} ×</span>
              ))}
            </div>
          </Card>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Critères additionnels</div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10, color:"#888"}}>Ancienneté minimum société (années)</label>
              <input value={crit.minAge} onChange={e => setCrit({...crit, minAge:e.target.value})} style={{width:120, padding:6, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, marginTop:3, marginLeft:8}}/>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:8, padding:"6px 0"}}>
              <input type="checkbox" checked={crit.esg} onChange={e => setCrit({...crit, esg:e.target.checked})}/>
              <span style={{fontSize:12}}>Appliquer la grille ESG IFC sur toutes les candidatures</span>
            </div>
          </Card>
          <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
            <Btn primary small onClick={() => toast("Critères d'investissement sauvegardés ✓")}>Sauvegarder</Btn>
          </div>
        </div>
      )}

      {section === "these" && (
        <div style={{maxWidth:680}}>
          <Card style={{padding:16, marginBottom:12}}>
            <div style={{fontSize:12, fontWeight:600, marginBottom:6, textTransform:"uppercase", color:"#666", letterSpacing:0.5}}>Thèse d'investissement du fonds</div>
            <p style={{fontSize:11, color:"#888", margin:"0 0 12px", lineHeight:1.5}}>Cette thèse est utilisée par l'IA pour personnaliser les analyses, le pré-screening des candidatures et la rédaction des IM.</p>
            <textarea value={these} onChange={e => setThese(e.target.value)} style={{width:"100%", minHeight:240, padding:10, fontSize:12, border:"1px solid #F1EFE8", borderRadius:5, fontFamily:"inherit", resize:"vertical", lineHeight:1.6}}/>
            <div style={{marginTop:8, fontSize:10, color:"#888"}}>{these.length} caractères</div>
          </Card>
          <Card accent="#534AB7" style={{padding:12, background:"#fafaf7", marginBottom:12}}>
            <div style={{fontSize:11, fontWeight:600, color:"#534AB7", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>Aperçu IA — usage de la thèse</div>
            <ul style={{margin:0, paddingLeft:18, fontSize:11, color:"#666", lineHeight:1.7}}>
              <li>Pré-screening automatique des candidatures contre les critères</li>
              <li>Personnalisation du ton et de l'angle des sections IM</li>
              <li>Suggestions de fonds matchant la thèse</li>
              <li>Génération du teaser avec storytelling aligné</li>
            </ul>
          </Card>
          <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
            <Btn primary small onClick={() => toast("Thèse d'investissement sauvegardée ✓")}>Sauvegarder</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// PARTNER HOME (with tabs)
// ════════════════════════════════════════════════════════

function SyntheseTab({mandats, role, onMandatClick}) {
  const activeCount = mandats.filter(m => m.stage !== "close").length;
  const kpis = [
    {l:"Mandats actifs", v:activeCount},
    {l:"En structuration", v:mandats.filter(m => ["recus","im"].includes(m.stage)).length},
    {l:"En diffusion", v:mandats.filter(m => ["interets","nego"].includes(m.stage)).length},
    {l:"Closé YTD", v:mandats.filter(m => m.stage === "close").length},
  ];
  return (
    <>
      <Card style={{display:"flex", marginBottom:16, padding:16}}>
        {kpis.map((k, i) => (<KPI key={i} label={k.l} value={k.v} color="#534AB7"/>))}
      </Card>
      <KanbanBoard mandats={mandats} role={role} onCardClick={onMandatClick}/>
      <Card style={{marginTop:16, padding:18}}>
        <div style={{fontSize:14, fontWeight:700, marginBottom:12, color:"#111827"}}>Synthèse business</div>
        <div style={{display:"flex", gap:10}}>
          <KPI label="Pipeline value" value="~85M$" color="#534AB7"/>
          <KPI label="Success fees pot." value="2.55M$" color="#16A34A"/>
          <KPI label="Closed YTD" value="2 deals" color="#3B82F6"/>
          <KPI label="Win rate" value="40%" color="#D97706"/>
        </div>
      </Card>
      <Card style={{marginTop:12, padding:16}}>
        <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:"#111827"}}>Activité récente</div>
        {[
          ["Adiwale Partners a signé NDA sur PharmaCi", "il y a 2h", "#16A34A"],
          ["F. Bamba a soumis §6 PharmaCi pour review", "il y a 4h", "#534AB7"],
          ["S. Diop a renvoyé §9 pour correction", "hier", "#DC2626"],
          ["AgriPro BF — term sheet reçue de Helios", "hier", "#16A34A"],
        ].map(([txt, when, c], i) => (
          <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #F3F4F6", fontSize:12}}>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <Dot color={c}/>
              <span style={{color:"#374151"}}>{txt}</span>
            </div>
            <span style={{color:"#6B7280", fontSize:11}}>{when}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function MandatsTab({mandats, role, onMandatClick, setWorkspace, toast}) {
  const [filter, setFilter] = useState("all");
  const [openMenu, setOpenMenu] = useState(null);
  const filtered = filter === "all" ? mandats : mandats.filter(m => m.stage === filter);
  const tagV = {im:"purple", interets:"warn", nego:"coral", recus:"default", close:"default"};
  return (
    <>
      <div style={{display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center"}}>
        <Btn small primary={filter==="all"} onClick={() => setFilter("all")}>Tous ({mandats.length})</Btn>
        {STAGES.map(s => (
          <Btn key={s.id} small primary={filter===s.id} onClick={() => setFilter(s.id)}>
            {s.label} ({mandats.filter(m => m.stage === s.id).length})
          </Btn>
        ))}
        <div style={{flex:1}}/>
        <Btn primary small onClick={() => setWorkspace("p6")}>+ Mandat</Btn>
      </div>
      <Card style={{padding:0, overflow:"hidden"}}>
        <div style={{display:"flex", padding:"10px 14px", fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", borderBottom:"1px solid #E5E7EB", background:"#F9FAFB", letterSpacing:0.5}}>
          <div style={{flex:2}}>Entreprise</div>
          <div style={{flex:1}}>Secteur</div>
          <div style={{width:60}}>Pays</div>
          <div style={{width:90}}>Stage</div>
          <div style={{width:75, textAlign:"right"}}>Ticket</div>
          <div style={{flex:1}}>Analyste</div>
          <div style={{width:40, textAlign:"right"}}></div>
        </div>
        {filtered.map(m => (
          <div key={m.id} onClick={() => onMandatClick(m)} style={{display:"flex", padding:"12px 14px", borderBottom:"1px solid #F3F4F6", fontSize:12, alignItems:"center", cursor:"pointer", position:"relative", transition:"background 0.1s"}}
            onMouseEnter={e => e.currentTarget.style.background="#F9FAFB"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            <div style={{flex:2, fontWeight:600, color:"#111827"}}>{m.name}</div>
            <div style={{flex:1, color:"#6B7280"}}>{m.sector}</div>
            <div style={{width:60, color:"#6B7280"}}>{m.country}</div>
            <div style={{width:90}}><Tag v={tagV[m.stage] || "default"}>{STAGES.find(s=>s.id===m.stage)?.label}</Tag></div>
            <div style={{width:75, textAlign:"right", color:"#534AB7", fontWeight:700}}>{m.ticket}</div>
            <div style={{flex:1, color:"#6B7280"}}>{m.analyste}</div>
            <div style={{width:40, textAlign:"right", position:"relative"}}>
              <span onClick={e => {e.stopPropagation(); setOpenMenu(openMenu===m.id?null:m.id);}} style={{cursor:"pointer", padding:"4px 8px", borderRadius:4, color:"#6B7280", fontSize:18, lineHeight:1, display:"inline-block"}}>⋯</span>
              {openMenu === m.id && (
                <div onClick={e => e.stopPropagation()} style={{position:"absolute", right:0, top:24, background:"#fff", border:"1px solid #E5E7EB", borderRadius:6, boxShadow:"0 4px 12px rgba(0,0,0,0.08)", zIndex:10, minWidth:140}}>
                  <div onClick={() => {setOpenMenu(null); toast("Édition du mandat","info");}} style={{padding:"8px 12px", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, color:"#374151"}}
                    onMouseEnter={e => e.currentTarget.style.background="#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                    <span>✏</span><span>Modifier</span>
                  </div>
                  <div onClick={() => {setOpenMenu(null); toast("Mandat supprimé","warning");}} style={{padding:"8px 12px", fontSize:12, cursor:"pointer", color:"#DC2626", display:"flex", alignItems:"center", gap:6, borderTop:"1px solid #E5E7EB"}}
                    onMouseEnter={e => e.currentTarget.style.background="#FEE2E2"}
                    onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                    <span>🗑</span><span>Supprimer</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function PartnerHome({mandats, sections, docs, role, switchRole, onMandatClick, setWorkspace, toast}) {
  const [tab, setTab] = useState("synthese");
  const tabs = [
    {id:"synthese", label:"Synthèse", icon:BarChart3},
    {id:"mandats", label:"Mandats", icon:Briefcase},
    {id:"equipe", label:"Équipe", icon:Users},
    {id:"candidature", label:"Candidature", icon:Inbox},
    {id:"parametres", label:"Paramètres", icon:Settings},
  ];
  const tabLabel = tabs.find(t => t.id === tab).label;
  const activeCount = mandats.filter(m => m.stage !== "close").length;
  const closedCount = mandats.filter(m => m.stage === "close").length;

  return (
    <div style={{background:"#FAFAFA", minHeight:"100vh"}}>
      <div style={{padding:"20px 24px 0", background:"#fff", borderBottom:"1px solid #E5E7EB"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
          <div>
            <div style={{fontSize:10, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8, fontWeight:700}}>ESONO · BANQUE D'AFFAIRES</div>
            <h2 style={{margin:"6px 0 0", fontSize:24, fontWeight:700, color:"#111827"}}>{tabLabel}</h2>
          </div>
          <div style={{display:"flex", gap:6}}>
            <Tag v="success">{activeCount} actifs</Tag>
            <Tag>{closedCount} closé</Tag>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", marginBottom:16, gap:6}}>
          {[["analyste","F. Bamba","ANALYSTE"],["senior","S. Diop","SENIOR ANALYSTE"],["partner","K. Cissé","PARTNER"]].map(([r, n, t]) => (
            <div key={r} onClick={() => switchRole(r)} style={{padding:"6px 12px", borderRadius:6, fontSize:11, cursor:"pointer", background:role===r?RC[r]:"transparent", color:role===r?"#fff":"#6B7280", border:role===r?`1px solid ${RC[r]}`:"1px solid #E5E7EB", fontWeight:600, lineHeight:1.3}}>
              <div>{n}</div>
              <div style={{fontSize:8, opacity:0.85}}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex", alignItems:"center", gap:0, marginBottom:-1}}>
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <div key={t.id} onClick={() => setTab(t.id)} style={{padding:"10px 16px", fontSize:13, fontWeight:600, cursor:"pointer", color:isActive?"#534AB7":"#6B7280", borderBottom:isActive?"2px solid #534AB7":"2px solid transparent", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s"}}>
                <Icon size={14}/>
                <span>{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{padding:"20px 24px 28px"}}>
        {tab === "synthese" && <SyntheseTab mandats={mandats} role={role} onMandatClick={onMandatClick}/>}
        {tab === "mandats" && <MandatsTab mandats={mandats} role={role} onMandatClick={onMandatClick} setWorkspace={setWorkspace} toast={toast}/>}
        {tab === "equipe" && <EquipePage toast={toast}/>}
        {tab === "candidature" && <CandidaturePage toast={toast}/>}
        {tab === "parametres" && <ParametresPage toast={toast}/>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════

export default function App() {
  const [role, setRole] = useState("partner");
  const [mandats] = useState(MANDATS_INIT.map(m => ({...m})));
  const [sections, setSections] = useState(SECS.map(s => ({...s})));
  const [docs, setDocs] = useState([...DOCS_INIT]);
  const [viewMode, setViewMode] = useState("kanban");
  const [workspace, setWorkspace] = useState(null);
  const [openMandat, setOpenMandat] = useState(null);
  const [toast, setToast] = useState(null);
  const T = useCallback((m, t="success") => {setToast({m, t}); setTimeout(()=>setToast(null), 3000);}, []);

  function switchRole(r) {setRole(r); setOpenMandat(null); setWorkspace(null);}
  function goBack() {setOpenMandat(null); setWorkspace(null);}
  function handleCard(m) {
    if (role==="analyste" && m.analyste!=="F. Bamba") return;
    setOpenMandat(m);
    setWorkspace("shell");
  }

  const wrap = (children) => (
    <div style={{fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:"#111827", minHeight:"100vh", background:"#FAFAFA"}}>
      <style>{`@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}} body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}`}</style>
      {children}
      {toast && <Toast2 message={toast.m} type={toast.t} onClose={() => setToast(null)}/>}
    </div>
  );

  // Workspace views
  if (workspace === "shell" && openMandat) return wrap(<MandatShell mandat={openMandat} role={role} sections={sections} setSections={setSections} docs={docs} setDocs={setDocs} toast={T} onBack={goBack}/>);
  if (workspace === "s3") return wrap(<S3 toast={T} onBack={goBack}/>);
  if (workspace === "p6") return wrap(<P6 toast={T} onBack={goBack}/>);

  // Partner home with tabs
  if (role === "partner") {
    return wrap(<PartnerHome mandats={mandats} sections={sections} docs={docs} role={role} switchRole={switchRole} onMandatClick={handleCard} setWorkspace={setWorkspace} toast={T}/>);
  }

  // Analyste / Senior home
  const activeCount = mandats.filter(m => m.stage !== "close").length;
  const closedCount = mandats.filter(m => m.stage === "close").length;
  const kpis = role === "senior" ? [
    {l:"Mandats actifs", v:activeCount},
    {l:"À reviewer", v:mandats.reduce((s, m) => s + (m.reviewPending||0), 0)},
    {l:"Analystes", v:2},
    {l:"Sections en review", v:sections.filter(s => s.status === "submitted").length},
  ] : [
    {l:"Mes mandats", v:mandats.filter(m => m.analyste === "F. Bamba").length},
    {l:"À corriger", v:sections.filter(s => s.status === "correction").length},
    {l:"Sections OK", v:`${sections.filter(s => s.status === "validated").length}/13`},
    {l:"Docs manquants", v:MISSING.length},
  ];

  return wrap(
    <>
      <div style={{padding:"20px 24px 0", background:"#fff", borderBottom:"1px solid #E5E7EB"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14}}>
          <div>
            <div style={{fontSize:10, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8, fontWeight:700}}>ESONO · BANQUE D'AFFAIRES</div>
            <h2 style={{margin:"6px 0 0", fontSize:24, fontWeight:700, color:"#111827"}}>Pipeline mandats</h2>
          </div>
          <div style={{display:"flex", gap:6}}>
            <Tag v="success">{activeCount} actifs</Tag>
            <Tag>{closedCount} closé</Tag>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", marginBottom:18, gap:6}}>
          {[["analyste","F. Bamba","ANALYSTE"],["senior","S. Diop","SENIOR ANALYSTE"],["partner","K. Cissé","PARTNER"]].map(([r, n, t]) => (
            <div key={r} onClick={() => switchRole(r)} style={{padding:"6px 12px", borderRadius:6, fontSize:11, cursor:"pointer", background:role===r?RC[r]:"transparent", color:role===r?"#fff":"#6B7280", border:role===r?`1px solid ${RC[r]}`:"1px solid #E5E7EB", fontWeight:600, lineHeight:1.3}}>
              <div>{n}</div>
              <div style={{fontSize:8, opacity:0.85}}>{t}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"20px 24px 0"}}>
        <Card style={{display:"flex", marginBottom:16, padding:16}}>
          {kpis.map((k, i) => (<KPI key={i} label={k.l} value={k.v} color={RC[role]}/>))}
        </Card>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:6, padding:"0 24px", marginBottom:10, flexWrap:"wrap"}}>
        {[["kanban","Kanban"],["table","Table"]].map(([id, l]) => (
          <Btn key={id} small primary={viewMode===id} onClick={() => setViewMode(id)}>{l}</Btn>
        ))}
        <div style={{flex:1}}/>
        {role === "senior" && (<Btn small onClick={() => setWorkspace("s3")}>Vue conso</Btn>)}
      </div>
      <div style={{padding:"0 24px 24px"}}>
        {viewMode === "kanban" ? (
          <KanbanBoard mandats={mandats} role={role} onCardClick={handleCard}/>
        ) : (
          <MandatTable mandats={mandats} role={role} onRow={handleCard}/>
        )}
        <Card style={{marginTop:12, padding:16}}>
          <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:"#111827"}}>Activité récente</div>
          {[
            ["Adiwale Partners a signé NDA sur PharmaCi", "il y a 2h", "#16A34A"],
            ["F. Bamba a soumis §6 PharmaCi pour review", "il y a 4h", "#534AB7"],
            ["S. Diop a renvoyé §9 pour correction", "hier", "#DC2626"],
            ["AgriPro BF — term sheet reçue de Helios", "hier", "#16A34A"],
          ].map(([txt, when, c], i) => (
            <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #F3F4F6", fontSize:12}}>
              <div style={{display:"flex", alignItems:"center", gap:8}}>
                <Dot color={c}/>
                <span style={{color:"#374151"}}>{txt}</span>
              </div>
              <span style={{color:"#6B7280", fontSize:11}}>{when}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}