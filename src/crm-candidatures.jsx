import { useState, useRef, useEffect, useCallback } from "react";

const STRUCTURES_INIT = ["Toutes", "TechCorp Paris", "InnoGroup Lyon", "StartupNord", "Groupe Medical Est"];

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const DRIVE_FILE_NAME = "crm-recrutement-data.json";

// ── GOOGLE DRIVE API ─────────────────────────────────────────

function loadGapiScript() {
  return new Promise(function(resolve) {
    if (window.gapi) { window.gapi.load("client", resolve); return; }
    var script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = function() { window.gapi.load("client", resolve); };
    document.head.appendChild(script);
  });
}

function loadGsiScript() {
  return new Promise(function(resolve) {
    if (window.google && window.google.accounts) { resolve(); return; }
    var script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

async function findDriveFile(token) {
  var res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27" + DRIVE_FILE_NAME + "%27&fields=files(id,name)",
    { headers: { "Authorization": "Bearer " + token } }
  );
  var data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0].id : null;
}

async function readDriveFile(token, fileId) {
  var res = await fetch(
    "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
    { headers: { "Authorization": "Bearer " + token } }
  );
  return await res.json();
}

async function saveDriveFile(token, fileId, data) {
  var body = JSON.stringify(data);
  if (fileId) {
    await fetch("https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=media", {
      method: "PATCH",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: body
    });
  } else {
    var boundary = "crm_boundary_001";
    var meta = JSON.stringify({ name: DRIVE_FILE_NAME, parents: ["appDataFolder"] });
    var multipart = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + meta + "\r\n--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + body + "\r\n--" + boundary + "--";
    var res2 = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "multipart/related; boundary=" + boundary },
      body: multipart
    });
    return await res2.json();
  }
}

const CONTACT_TYPES = {
  email: { label: "Email", color: "#3B82F6" },
  phone: { label: "Telephone", color: "#10B981" },
  sms: { label: "SMS", color: "#F59E0B" },
  linkedin: { label: "LinkedIn", color: "#0077B5" },
  entretien: { label: "Entretien", color: "#8B5CF6" },
};

const ETAPE_TAGS = {
  telephone: { label: "Telephone", color: "#0EA5E9", bg: "#E0F2FE", border: "#BAE6FD" },
  visio: { label: "Visio", color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE" },
  physique: { label: "Physique", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
  refus: { label: "Refus", color: "#EF4444", bg: "#FFF1F2", border: "#FECDD3" },
};

const STATUS_CONFIG = {
  nouveau: { label: "Nouveau", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  contacte: { label: "Contacte", bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
  entretien: { label: "Entretien", bg: "#F5F3FF", color: "#5B21B6", border: "#DDD6FE" },
  offre: { label: "Offre", bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  retenu: { label: "Retenu", bg: "#F0FDF4", color: "#14532D", border: "#86EFAC" },
  refuse: { label: "Refuse", bg: "#FFF1F2", color: "#9F1239", border: "#FECDD3" },
};

const INTERVIEW_QUESTIONS = [
  { id: "q1", phase: "Accroche", question: "Pouvez-vous vous presenter en quelques mots et m'expliquer ce qui vous a amene a postuler chez Ankor ?", tip: "Observer : spontaneite, connaissance d'Ankor, ton general" },
  { id: "q2", phase: "Accroche", question: "Qu'est-ce qui vous attire dans ce poste d'employe polyvalent en loisirs ?", tip: "Chercher : motivation reelle vs besoin d'emploi" },
  { id: "q3", phase: "Parcours", question: "Parlez-moi de votre derniere experience en contact avec le public. Quel etait votre role exactement ?", tip: "Relancer : volumes, type de public, situations difficiles" },
  { id: "q4", phase: "Parcours", question: "Avez-vous deja travaille en equipe dans un environnement qui bouge vite ? Comment vous organisiez-vous ?", tip: "Chercher : adaptabilite, sens des priorites, communication" },
  { id: "q5", phase: "Aptitudes", question: "Si un client se plaint que son experience n'etait pas a la hauteur de ses attentes, comment reagissez-vous ?", tip: "Evaluer : ecoute, gestion emotion, sens du service" },
  { id: "q6", phase: "Aptitudes", question: "On peut vous demander de passer d'une mission a une autre tres rapidement. Donnez-moi un exemple ou vous avez du vous adapter vite.", tip: "Observer : flexibilite, absence de rigidite" },
  { id: "q7", phase: "Aptitudes", question: "Comment vous sentez-vous face a un groupe d'enfants agites ou une situation de tension avec des clients ?", tip: "Chercher : sang-froid, experience, pas de sur-promesse" },
  { id: "q8", phase: "Disponibilites", question: "Quelles sont vos disponibilites sur les weekends, jours feries et periodes scolaires ?", tip: "Critique : Ankor tourne fort le WE et vacances" },
  { id: "q9", phase: "Disponibilites", question: "Avez-vous des contraintes particulieres que je dois connaitre (transport, garde d'enfants, autre emploi...) ?", tip: "Question ouverte, ne pas pieger" },
  { id: "q10", phase: "Cloture", question: "Avez-vous des questions sur le poste, l'equipe ou le fonctionnement d'Ankor ?", tip: "Un candidat qui ne pose aucune question est un signal faible" },
];

const CRITERIA = [
  { id: "dynamisme", label: "Dynamisme / Energie" },
  { id: "service", label: "Sens du service client" },
  { id: "flexibilite", label: "Flexibilite / Adaptabilite" },
  { id: "communication", label: "Qualite de communication" },
  { id: "motivation", label: "Motivation pour Ankor" },
  { id: "disponibilite", label: "Disponibilites adequates" },
];

const INITIALS_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4","#84CC16"];

function getColor(name) { return INITIALS_COLORS[(name.charCodeAt(0)+(name.charCodeAt(1)||0))%INITIALS_COLORS.length]; }
function getInitials(name) { return name.split(" ").map(function(w){return w[0];}).join("").toUpperCase().slice(0,2); }
function formatDateShort(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
}
function formatDateTime(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}) + " " + d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}
function timeAgo(iso) {
  if (!iso) return "";
  var diff = Date.now()-new Date(iso).getTime();
  var days = Math.floor(diff/86400000);
  if (days===0) return "aujourd'hui";
  if (days===1) return "hier";
  if (days<7) return "il y a "+days+"j";
  if (days<30) return "il y a "+Math.floor(days/7)+"sem";
  return formatDateShort(iso);
}

function loadFromStorage(key, fallback) {
  try { var r=localStorage.getItem(key); if(r) return JSON.parse(r); } catch(e) {}
  return fallback;
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key,JSON.stringify(value)); } catch(e) {}
}

// ── MIGRATION DES DONNEES ─────────────────────────────────────
// Cette fonction corrige les donnees existantes sans les effacer
function migrateCandidate(c) {
  // Corriger experience : tableau d'objets -> texte lisible
  var exp = c.experience;
  if (Array.isArray(exp)) {
    exp = exp.map(function(e) {
      if (typeof e === "string") return e;
      var parts = [];
      if (e.poste) parts.push(e.poste);
      if (e.entreprise) parts.push(e.entreprise);
      if (e.lieu) parts.push(e.lieu);
      if (e.periode) parts.push(e.periode);
      if (e.description) parts.push(e.description);
      if (e.missions && Array.isArray(e.missions)) parts.push(e.missions.join(", "));
      return parts.join(" — ");
    }).join("\n");
  }
  // Corriger formation : tableau d'objets -> texte lisible
  var form = c.formation;
  if (Array.isArray(form)) {
    form = form.map(function(f) {
      if (typeof f === "string") return f;
      var parts = [];
      if (f.diplome) parts.push(f.diplome);
      if (f.titre) parts.push(f.titre);
      if (f.etablissement) parts.push(f.etablissement);
      if (f.annee) parts.push(f.annee);
      if (f.description) parts.push(f.description);
      return parts.join(" — ");
    }).join("\n");
  }
  // Corriger competences : tableau d'objets -> tableau de strings
  var comp = c.competences;
  if (Array.isArray(comp)) {
    comp = comp.map(function(item) {
      if (typeof item === "string") return item;
      return item.label || item.nom || JSON.stringify(item);
    });
  }
  return Object.assign({
    contacts: [], notes: "", structures: [], status: "nouveau",
    createdAt: new Date().toISOString(), lastContactDate: null, cvData: null,
  }, c, {
    experience: exp || "",
    formation: form || "",
    competences: comp || [],
  });
}

function loadAndMigrateCandidates(fallback) {
  try {
    var raw = localStorage.getItem("crm_candidates");
    if (raw) {
      var data = JSON.parse(raw);
      return data.map(migrateCandidate);
    }
  } catch(e) {}
  return fallback;
}

async function extractCVData(base64PDF) {
  var prompt = "Extrais les informations du candidat depuis ce CV. Reponds UNIQUEMENT en JSON valide, sans markdown, sans balises. Cles: prenom, nom, email, telephone, poste, ville, linkedin, competences (tableau), experience, formation, resume (2-3 phrases). Vide si absent.";
  var res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":process.env.REACT_APP_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64PDF}},{type:"text",text:prompt}]}]})
  });
  var data = await res.json();
  var block = data.content&&data.content.find(function(b){return b.type==="text";});
  return JSON.parse((block?block.text:"{}").replace(/```json/g,"").replace(/```/g,"").trim());
}

// ── COMPOSANTS DE BASE ───────────────────────────────────────

function EtapeTag(props) {
  var cfg=ETAPE_TAGS[props.tag]; if(!cfg) return null;
  return <span style={{background:cfg.bg,color:cfg.color,border:"1px solid "+cfg.border,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{cfg.label}</span>;
}

function Badge(props) {
  var c=STATUS_CONFIG[props.status]; if(!c) return null;
  return <span style={{background:c.bg,color:c.color,border:"1px solid "+c.border,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{c.label}</span>;
}

function Avatar(props) {
  var name=props.name; var size=props.size||40;
  return <div style={{width:size,height:size,borderRadius:"50%",background:getColor(name),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:size*0.35,flexShrink:0}}>{getInitials(name)}</div>;
}

function Modal(props) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={function(e){if(e.target===e.currentTarget)props.onClose();}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:props.wide?900:700,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 25px 50px rgba(0,0,0,0.15)"}}>
        {props.children}
      </div>
    </div>
  );
}

function ConfirmDialog(props) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:400,width:"100%",boxShadow:"0 25px 50px rgba(0,0,0,0.2)"}}>
        <h3 style={{margin:"0 0 10px",fontSize:17,fontWeight:700,color:"#0f172a"}}>{props.title}</h3>
        <p style={{margin:"0 0 20px",fontSize:14,color:"#64748b",lineHeight:1.5}}>{props.message}</p>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={props.onCancel} style={{background:"#f1f5f9",color:"#64748b",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 18px",fontWeight:600,fontSize:13}}>Annuler</button>
          <button onClick={props.onConfirm} style={{background:props.danger?"#ef4444":"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 18px",fontWeight:600,fontSize:13}}>{props.confirmLabel||"Confirmer"}</button>
        </div>
      </div>
    </div>
  );
}

function CVViewer(props) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:3000,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",background:"#0f172a"}}>
        <span style={{color:"#fff",fontWeight:600,fontSize:15}}>CV du candidat</span>
        <button onClick={props.onClose} style={{background:"#334155",color:"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 16px",fontWeight:600,fontSize:13}}>Fermer</button>
      </div>
      <iframe src={"data:application/pdf;base64,"+props.pdfData} style={{flex:1,border:"none",width:"100%",height:"100%"}} title="CV" />
    </div>
  );
}

// ── CANEVAS ENTRETIEN TELEPHONIQUE ───────────────────────────

function InterviewCanvas(props) {
  var candidate = props.candidate;
  var onClose = props.onClose;
  var onSave = props.onSave;

  var timerState = useState(0); var timer = timerState[0]; var setTimer = timerState[1];
  var runningState = useState(false); var running = runningState[0]; var setRunning = runningState[1];
  var scoresState = useState({}); var scores = scoresState[0]; var setScores = scoresState[1];
  var criteriaState = useState({}); var criteria = criteriaState[0]; var setCriteria = criteriaState[1];
  var checkedState = useState({}); var checked = checkedState[0]; var setChecked = checkedState[1];
  var notesState = useState({}); var notes = notesState[0]; var setNotes = notesState[1];
  var verdictState = useState(""); var verdict = verdictState[0]; var setVerdict = verdictState[1];
  var impressionState = useState(""); var impression = impressionState[0]; var setImpression = impressionState[1];
  var recruteurState = useState(""); var recruteur = recruteurState[0]; var setRecruteur = recruteurState[1];

  useEffect(function() {
    if (!running) return;
    var interval = setInterval(function(){ setTimer(function(t){return t+1;}); }, 1000);
    return function(){ clearInterval(interval); };
  }, [running]);

  function formatTimer(s) {
    var m = Math.floor(s/60); var sec = s%60;
    return (m<10?"0":"")+m+":"+(sec<10?"0":"")+sec;
  }

  var totalScore = Object.values(scores).reduce(function(a,b){return a+b;},0);
  var maxScore = INTERVIEW_QUESTIONS.length * 3;
  var scorePercent = maxScore > 0 ? Math.round((totalScore/maxScore)*100) : 0;
  var checkedCount = Object.values(checked).filter(Boolean).length;

  var phases = [];
  INTERVIEW_QUESTIONS.forEach(function(q) {
    if (phases.indexOf(q.phase) === -1) phases.push(q.phase);
  });

  var phaseColors = { "Accroche": "#3B82F6", "Parcours": "#8B5CF6", "Aptitudes": "#F59E0B", "Disponibilites": "#10B981", "Cloture": "#EF4444" };

  function getVerdictColor(v) {
    if (v==="GO") return {bg:"#f0fdf4",color:"#15803d",border:"#86efac"};
    if (v==="A revoir") return {bg:"#fffbeb",color:"#92400e",border:"#fde68a"};
    if (v==="Non") return {bg:"#fff1f2",color:"#9f1239",border:"#fecdd3"};
    return {bg:"#f1f5f9",color:"#64748b",border:"#e2e8f0"};
  }

  function saveAndClose() {
    var synthese = "=== ENTRETIEN TELEPHONIQUE - " + formatDateTime(new Date().toISOString()) + " ===\n";
    synthese += "Recruteur : " + (recruteur || "NC") + "\n";
    synthese += "Duree : " + formatTimer(timer) + "\n";
    synthese += "Score : " + totalScore + "/" + maxScore + " (" + scorePercent + "%)\n";
    synthese += "Verdict : " + (verdict || "Non defini") + "\n\n";
    synthese += "CRITERES :\n";
    CRITERIA.forEach(function(c) { synthese += "- " + c.label + " : " + (criteria[c.id]||0) + "/5\n"; });
    synthese += "\nQUESTIONS ABORDEES (" + checkedCount + "/" + INTERVIEW_QUESTIONS.length + ") :\n";
    INTERVIEW_QUESTIONS.forEach(function(q) {
      if (checked[q.id]) {
        synthese += "- [" + q.phase + "] " + q.question.slice(0,60) + "... (note: " + (scores[q.id]||0) + "/3)\n";
        if (notes[q.id]) synthese += "  Notes : " + notes[q.id] + "\n";
      }
    });
    if (impression) synthese += "\nIMPRESSION GENERALE :\n" + impression;

    var newContact = {
      id: Date.now(), type: "phone", etape: "telephone",
      note: synthese, date: new Date().toISOString(),
      isInterview: true, interviewScore: scorePercent, interviewVerdict: verdict
    };
    onSave(newContact);
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:"#0f172a",borderBottom:"2px solid #F59E0B",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontWeight:800,fontSize:16,color:"#F59E0B",letterSpacing:1}}>ANKOR — ENTRETIEN TEL.</div>
          <div style={{fontWeight:600,fontSize:14,color:"#fff"}}>{candidate.prenom} {candidate.nom}</div>
          <div style={{fontSize:12,color:"#94a3b8"}}>{candidate.poste}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:running?"#10B981":"#F59E0B",background:running?"#001a0a":"#1a1200",border:"1px solid "+(running?"#10B981":"#F59E0B"),padding:"4px 14px",borderRadius:6}}>
            {formatTimer(timer)}
          </div>
          <button onClick={function(){setRunning(!running);}} style={{background:running?"#dc2626":"#10B981",color:"#fff",border:"none",cursor:"pointer",borderRadius:6,padding:"6px 14px",fontWeight:700,fontSize:12}}>
            {running ? "PAUSE" : "START"}
          </button>
          <button onClick={function(){setTimer(0);setRunning(false);}} style={{background:"#334155",color:"#fff",border:"none",cursor:"pointer",borderRadius:6,padding:"6px 14px",fontWeight:600,fontSize:12}}>RESET</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Questions */}
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}>
            <input value={recruteur} onChange={function(e){setRecruteur(e.target.value);}} placeholder="Votre prenom (recruteur)..."
              style={{borderRadius:8,border:"1px solid #334155",background:"#1e293b",color:"#fff",padding:"6px 12px",fontSize:13,width:200}} />
            <div style={{fontSize:12,color:"#64748b"}}>{checkedCount}/{INTERVIEW_QUESTIONS.length} questions abordees</div>
            <div style={{flex:1,height:6,background:"#1e293b",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:"#F59E0B",width:(checkedCount/INTERVIEW_QUESTIONS.length*100)+"%",borderRadius:10,transition:"width 0.3s"}} />
            </div>
          </div>

          {phases.map(function(phase) {
            var phaseQs = INTERVIEW_QUESTIONS.filter(function(q){return q.phase===phase;});
            var pc = phaseColors[phase] || "#64748b";
            return (
              <div key={phase}>
                <div style={{fontSize:11,fontWeight:700,color:pc,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:3,height:14,background:pc,borderRadius:2}} />
                  {phase.toUpperCase()}
                </div>
                {phaseQs.map(function(q) {
                  var isChecked = checked[q.id];
                  var qScore = scores[q.id] || 0;
                  return (
                    <div key={q.id} style={{background:isChecked?"#1e293b":"#111827",border:"1px solid "+(isChecked?pc+"44":"#1e293b"),borderRadius:10,padding:14,marginBottom:8,transition:"all 0.2s"}}>
                      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        <input type="checkbox" checked={!!isChecked} onChange={function(e){setChecked(function(p){var u=Object.assign({},p);u[q.id]=e.target.checked;return u;});}}
                          style={{marginTop:3,width:16,height:16,cursor:"pointer",flexShrink:0}} />
                        <div style={{flex:1}}>
                          <p style={{margin:"0 0 6px",fontSize:13,color:"#e2e8f0",lineHeight:1.5,fontWeight:isChecked?500:400}}>{q.question}</p>
                          <p style={{margin:"0 0 8px",fontSize:11,color:"#64748b",fontStyle:"italic"}}>Tip : {q.tip}</p>
                          {isChecked && (
                            <div style={{display:"flex",flexDirection:"column",gap:8}}>
                              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                                <span style={{fontSize:11,color:"#94a3b8",minWidth:40}}>Note :</span>
                                {[1,2,3].map(function(s) {
                                  return <button key={s} onClick={function(){setScores(function(p){var u=Object.assign({},p);u[q.id]=s;return u;});}}
                                    style={{width:28,height:28,borderRadius:6,border:"1px solid "+(qScore>=s?"#F59E0B":"#334155"),background:qScore>=s?"#F59E0B":"#1e293b",color:qScore>=s?"#0f172a":"#64748b",cursor:"pointer",fontWeight:700,fontSize:12}}>
                                    {s}
                                  </button>;
                                })}
                                <span style={{fontSize:11,color:"#64748b"}}>/3</span>
                              </div>
                              <textarea value={notes[q.id]||""} onChange={function(e){var val=e.target.value;setNotes(function(p){var u=Object.assign({},p);u[q.id]=val;return u;});}}
                                placeholder="Notes sur la reponse..." style={{width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#e2e8f0",resize:"vertical",minHeight:50,fontFamily:"inherit",boxSizing:"border-box"}} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sidebar scoring */}
        <div style={{width:280,background:"#0f172a",borderLeft:"1px solid #1e293b",padding:16,overflowY:"auto",display:"flex",flexDirection:"column",gap:16,flexShrink:0}}>
          {/* Score global */}
          <div style={{background:"#1e293b",borderRadius:10,padding:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:10,letterSpacing:1}}>SCORE GLOBAL</div>
            <div style={{fontSize:36,fontWeight:800,color:"#F59E0B",lineHeight:1}}>{totalScore}<span style={{fontSize:16,color:"#64748b"}}>/{maxScore}</span></div>
            <div style={{marginTop:8,height:8,background:"#334155",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:scorePercent>=70?"#10B981":scorePercent>=40?"#F59E0B":"#EF4444",width:scorePercent+"%",borderRadius:10,transition:"width 0.3s"}} />
            </div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>{scorePercent}%</div>
          </div>

          {/* Criteres */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:10,letterSpacing:1}}>CRITERES</div>
            {CRITERIA.map(function(c) {
              var val = criteria[c.id] || 0;
              return (
                <div key={c.id} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>{c.label}</div>
                  <div style={{display:"flex",gap:4}}>
                    {[1,2,3,4,5].map(function(s) {
                      return <button key={s} onClick={function(){setCriteria(function(p){var u=Object.assign({},p);u[c.id]=s;return u;});}}
                        style={{flex:1,height:22,borderRadius:4,border:"none",background:val>=s?"#F59E0B":"#1e293b",cursor:"pointer",transition:"background 0.15s"}} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verdict */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:10,letterSpacing:1}}>VERDICT</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {["GO","A revoir","Non"].map(function(v) {
                var vc = getVerdictColor(v);
                return <button key={v} onClick={function(){setVerdict(v);}}
                  style={{padding:"8px 12px",borderRadius:8,border:"2px solid "+(verdict===v?vc.border:"#1e293b"),background:verdict===v?vc.bg:"#1e293b",color:verdict===v?vc.color:"#94a3b8",cursor:"pointer",fontWeight:700,fontSize:13,textAlign:"left"}}>
                  {v==="GO"?"GO - A convoquer":v==="A revoir"?"A revoir":"Non retenu"}
                </button>;
              })}
            </div>
          </div>

          {/* Impression */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,letterSpacing:1}}>IMPRESSION GENERALE</div>
            <textarea value={impression} onChange={function(e){setImpression(e.target.value);}}
              placeholder="Impression globale, feeling..."
              style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:10,fontSize:12,color:"#e2e8f0",resize:"vertical",minHeight:80,fontFamily:"inherit",boxSizing:"border-box"}} />
          </div>

          {/* Actions */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:"auto"}}>
            <button onClick={saveAndClose} style={{background:"#F59E0B",color:"#0f172a",border:"none",cursor:"pointer",borderRadius:8,padding:"10px 16px",fontWeight:800,fontSize:13}}>
              Sauvegarder dans la fiche
            </button>
            <button onClick={onClose} style={{background:"#1e293b",color:"#94a3b8",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:12}}>
              Fermer sans sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CONTACT LOG ──────────────────────────────────────────────

function ContactLog(props) {
  var contact = props.contact;
  var ct = CONTACT_TYPES[contact.type] || CONTACT_TYPES.email;
  var isInterview = contact.isInterview;
  return (
    <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",background:isInterview?"#fffbeb":"#fff"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{background:ct.color+"18",color:ct.color,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{ct.label}</span>
          {contact.etape && <EtapeTag tag={contact.etape} />}
          {isInterview && (
            <span style={{background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>
              Entretien tel. {contact.interviewScore}% — {contact.interviewVerdict}
            </span>
          )}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:12,color:"#64748b",fontWeight:600}}>{formatDateShort(contact.date)}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>{timeAgo(contact.date)}</div>
        </div>
      </div>
      {isInterview ? (
        <details style={{cursor:"pointer"}}>
          <summary style={{fontSize:12,color:"#92400e",fontWeight:600}}>Voir le compte-rendu complet</summary>
          <pre style={{marginTop:8,fontSize:11,color:"#374151",lineHeight:1.6,whiteSpace:"pre-wrap",background:"#f8fafc",borderRadius:6,padding:10}}>{contact.note}</pre>
        </details>
      ) : (
        <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.5}}>{contact.note}</p>
      )}
    </div>
  );
}

// ── NOTES TAB ────────────────────────────────────────────────

function NotesTab(props) {
  var candidate=props.candidate; var onUpdate=props.onUpdate;
  var notesState=useState(candidate.notes||""); var notes=notesState[0]; var setNotes=notesState[1];
  var savedState=useState(true); var saved=savedState[0]; var setSaved=savedState[1];
  function save(){onUpdate(Object.assign({},candidate,{notes:notes}));setSaved(true);}
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <textarea value={notes} onChange={function(e){setNotes(e.target.value);setSaved(false);}} placeholder="Notes libres..."
        style={{width:"100%",borderRadius:10,border:"1px solid #e2e8f0",padding:14,fontSize:14,resize:"vertical",minHeight:200,fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}} />
      <button onClick={save} style={{background:saved?"#f1f5f9":"#0f172a",color:saved?"#94a3b8":"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,alignSelf:"flex-start"}}>
        {saved?"Notes sauvegardees":"Sauvegarder"}
      </button>
    </div>
  );
}

// ── FICHE CANDIDAT ───────────────────────────────────────────

function CandidateDetail(props) {
  var candidate=props.candidate; var onClose=props.onClose; var onUpdate=props.onUpdate;
  var structures=props.structures; var onArchive=props.onArchive; var onRestore=props.onRestore;
  var onDelete=props.onDelete; var isArchived=props.isArchived;

  var tabState=useState("profil"); var tab=tabState[0]; var setTab=tabState[1];
  var showAddState=useState(false); var showAddContact=showAddState[0]; var setShowAddContact=showAddState[1];
  var newContactState=useState({type:"email",etape:"",note:"",date:new Date().toISOString().slice(0,10)});
  var newContact=newContactState[0]; var setNewContact=newContactState[1];
  var editStatusState=useState(candidate.status); var editStatus=editStatusState[0]; var setEditStatus=editStatusState[1];
  var editStructuresState=useState(candidate.structures||[]); var editStructures=editStructuresState[0]; var setEditStructures=editStructuresState[1];
  var showCVState=useState(false); var showCV=showCVState[0]; var setShowCV=showCVState[1];
  var confirmState=useState(null); var confirm=confirmState[0]; var setConfirm=confirmState[1];
  var showInterviewState=useState(false); var showInterview=showInterviewState[0]; var setShowInterview=showInterviewState[1];

  var contacts = candidate.contacts || [];

  function addContact() {
    if (!newContact.note.trim()) return;
    var dateIso = newContact.date ? new Date(newContact.date).toISOString() : new Date().toISOString();
    var newEntry = {type:newContact.type,etape:newContact.etape,note:newContact.note,date:dateIso,id:Date.now()};
    onUpdate(Object.assign({},candidate,{contacts:[newEntry].concat(contacts),lastContactDate:dateIso,status:editStatus,structures:editStructures}));
    setNewContact({type:"email",etape:"",note:"",date:new Date().toISOString().slice(0,10)});
    setShowAddContact(false);
  }

  function saveInterviewContact(newEntry) {
    onUpdate(Object.assign({},candidate,{contacts:[newEntry].concat(contacts),lastContactDate:newEntry.date}));
  }

  var tabs=[{id:"profil",label:"Profil"},{id:"contacts",label:"Contacts ("+contacts.length+")"},{id:"notes",label:"Notes"}];

  return (
    <Modal onClose={onClose}>
      {showCV && candidate.cvData && <CVViewer pdfData={candidate.cvData} onClose={function(){setShowCV(false);}} />}
      {showInterview && <InterviewCanvas candidate={candidate} onClose={function(){setShowInterview(false);}} onSave={saveInterviewContact} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} danger={confirm.danger} onCancel={function(){setConfirm(null);}} onConfirm={function(){confirm.action();setConfirm(null);}} />}

      <div style={{padding:"24px 28px 0",borderBottom:"1px solid #f1f5f9"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <Avatar name={candidate.prenom+" "+candidate.nom} size={52} />
            <div>
              <h2 style={{margin:0,fontSize:20,fontWeight:700,color:"#0f172a"}}>{candidate.prenom} {candidate.nom}</h2>
              <p style={{margin:"2px 0 4px",color:"#64748b",fontSize:14}}>{candidate.poste}</p>
              <div style={{fontSize:11,color:"#94a3b8"}}>Cree le {formatDateTime(candidate.createdAt)}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:6}}>
                {!isArchived && <Badge status={candidate.status} />}
                {isArchived && <span style={{background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}}>Archive</span>}
                {candidate.cvData && <button onClick={function(){setShowCV(true);}} style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:20,padding:"2px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Voir le CV</button>}
                {!isArchived && <button onClick={function(){setShowInterview(true);}} style={{background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a",borderRadius:20,padding:"2px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Entretien tel.</button>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#94a3b8",padding:4}}>x</button>
            <div style={{display:"flex",gap:6}}>
              {!isArchived && <button onClick={function(){setConfirm({title:"Archiver ?",message:"Le candidat sera archive et consultable depuis la section Archives.",confirmLabel:"Archiver",danger:false,action:function(){onArchive(candidate);onClose();}});}} style={{background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Archiver</button>}
              {isArchived && <button onClick={function(){setConfirm({title:"Restaurer ?",message:"Le candidat sera remis dans la liste active.",confirmLabel:"Restaurer",danger:false,action:function(){onRestore(candidate);onClose();}});}} style={{background:"#f0fdf4",color:"#15803d",border:"1px solid #86efac",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Restaurer</button>}
              <button onClick={function(){setConfirm({title:"Supprimer definitivement ?",message:"Cette action est irreversible.",confirmLabel:"Supprimer",danger:true,action:function(){onDelete(candidate);onClose();}});}} style={{background:"#fff1f2",color:"#ef4444",border:"1px solid #fecdd3",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Supprimer</button>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,paddingBottom:0}}>
          {tabs.map(function(t){return <button key={t.id} onClick={function(){setTab(t.id);}} style={{padding:"8px 18px",border:"none",cursor:"pointer",borderRadius:"8px 8px 0 0",fontSize:13,fontWeight:tab===t.id?600:400,background:tab===t.id?"#fff":"transparent",color:tab===t.id?"#0f172a":"#64748b",borderBottom:tab===t.id?"2px solid #0f172a":"2px solid transparent"}}>{t.label}</button>;})}
        </div>
      </div>

      <div style={{padding:"20px 28px 28px"}}>
        {tab==="profil" && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["Email",candidate.email],["Telephone",candidate.telephone],["Ville",candidate.ville],["LinkedIn",candidate.linkedin]].map(function(item){
                if(!item[1]) return null;
                return <div key={item[0]} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>{item[0]}</div><div style={{fontSize:13,color:"#1e293b",fontWeight:500}}>{item[1]}</div></div>;
              })}
            </div>
            {candidate.resume && <div style={{background:"#fffbeb",borderRadius:10,padding:14,borderLeft:"3px solid #F59E0B"}}><div style={{fontSize:11,fontWeight:600,color:"#92400E",marginBottom:4}}>RESUME DU PROFIL</div><p style={{margin:0,fontSize:13,color:"#451a03",lineHeight:1.6}}>{candidate.resume}</p></div>}
            {candidate.experience && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>EXPERIENCE</div>
                {Array.isArray(candidate.experience) ? (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {candidate.experience.map(function(exp,i){
                      if (typeof exp === "string") return <p key={i} style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.6}}>{exp}</p>;
                      return (
                        <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                          <div style={{fontWeight:600,fontSize:13,color:"#1e293b"}}>{exp.poste}{exp.entreprise?" — "+exp.entreprise:""}</div>
                          {exp.periode&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{exp.periode}{exp.lieu?" · "+exp.lieu:""}</div>}
                          {exp.description&&<div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.5}}>{exp.description}</div>}
                          {exp.missions&&Array.isArray(exp.missions)&&<div style={{fontSize:12,color:"#64748b",marginTop:4}}>{exp.missions.join(" · ")}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.6}}>{candidate.experience}</p>
                )}
              </div>
            )}
            {candidate.formation && (
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>FORMATION</div>
                {Array.isArray(candidate.formation) ? (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {candidate.formation.map(function(f,i){
                      if (typeof f === "string") return <p key={i} style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.6}}>{f}</p>;
                      return (
                        <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                          <div style={{fontWeight:600,fontSize:13,color:"#1e293b"}}>{f.diplome||f.titre||f.nom||""}{f.etablissement?" — "+f.etablissement:""}</div>
                          {f.annee&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{f.annee}</div>}
                          {f.description&&<div style={{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.5}}>{f.description}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{margin:0,fontSize:13,color:"#374151",lineHeight:1.6}}>{candidate.formation}</p>
                )}
              </div>
            )}
            {candidate.competences&&candidate.competences.length>0 && (
              <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:8}}>COMPETENCES</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{candidate.competences.map(function(c,i){var label=typeof c==="string"?c:(c.label||c.nom||JSON.stringify(c));return <span key={i} style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:500}}>{label}</span>;})}</div>
              </div>
            )}
            {!isArchived && (
              <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16,display:"flex",flexDirection:"column",gap:14}}>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:8}}>STATUT</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {Object.entries(STATUS_CONFIG).map(function(entry){var key=entry[0];var cfg=entry[1];return <button key={key} onClick={function(){setEditStatus(key);}} style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:editStatus===key?"2px solid "+cfg.color:"1px solid "+cfg.border,background:editStatus===key?cfg.bg:"#fff",color:cfg.color}}>{cfg.label}</button>;})}
                  </div>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:8}}>STRUCTURE(S)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {structures.filter(function(s){return s!=="Toutes";}).map(function(s){return <button key={s} onClick={function(){setEditStructures(function(prev){return prev.includes(s)?prev.filter(function(x){return x!==s;}):prev.concat([s]);});}} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:500,border:editStructures.includes(s)?"2px solid #0f172a":"1px solid #e2e8f0",background:editStructures.includes(s)?"#0f172a":"#fff",color:editStructures.includes(s)?"#fff":"#64748b"}}>{s}</button>;})}
                  </div>
                </div>
                <button onClick={function(){onUpdate(Object.assign({},candidate,{status:editStatus,structures:editStructures}));}} style={{background:"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:10,padding:"10px 20px",fontWeight:600,fontSize:14,alignSelf:"flex-start"}}>Enregistrer les modifications</button>
              </div>
            )}
          </div>
        )}

        {tab==="contacts" && (
          <div>
            {!isArchived && (
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <button onClick={function(){setShowAddContact(!showAddContact);}} style={{flex:1,padding:"10px 16px",background:"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:10,fontWeight:600,fontSize:14}}>+ Ajouter un contact</button>
                <button onClick={function(){setShowInterview(true);}} style={{padding:"10px 16px",background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a",cursor:"pointer",borderRadius:10,fontWeight:600,fontSize:14}}>Lancer entretien tel.</button>
              </div>
            )}
            {showAddContact && (
              <div style={{background:"#f8fafc",borderRadius:12,padding:16,marginBottom:16,display:"flex",flexDirection:"column",gap:12,border:"1px solid #e2e8f0"}}>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>TYPE</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {Object.entries(CONTACT_TYPES).map(function(entry){var key=entry[0];var ct=entry[1];return <button key={key} onClick={function(){setNewContact(function(p){return Object.assign({},p,{type:key});});}} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:newContact.type===key?"2px solid "+ct.color:"1px solid #e2e8f0",background:newContact.type===key?ct.color+"18":"#fff",color:ct.color}}>{ct.label}</button>;})}
                  </div>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>ETAPE</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={function(){setNewContact(function(p){return Object.assign({},p,{etape:""});});}} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,border:newContact.etape===""?"2px solid #64748b":"1px solid #e2e8f0",background:newContact.etape===""?"#f1f5f9":"#fff",color:"#64748b"}}>Aucune</button>
                    {Object.entries(ETAPE_TAGS).map(function(entry){var key=entry[0];var cfg=entry[1];return <button key={key} onClick={function(){setNewContact(function(p){return Object.assign({},p,{etape:key});});}} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,border:newContact.etape===key?"2px solid "+cfg.color:"1px solid "+cfg.border,background:newContact.etape===key?cfg.bg:"#fff",color:cfg.color}}>{cfg.label}</button>;})}
                  </div>
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>DATE</div>
                  <input type="date" value={newContact.date} onChange={function(e){var val=e.target.value;setNewContact(function(p){return Object.assign({},p,{date:val});});}} style={{borderRadius:8,border:"1px solid #e2e8f0",padding:"7px 10px",fontSize:13}} />
                </div>
                <div><div style={{fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:6}}>NOTES</div>
                  <textarea value={newContact.note} onChange={function(e){var val=e.target.value;setNewContact(function(p){return Object.assign({},p,{note:val});});}} placeholder="Resume de l'echange..." style={{width:"100%",borderRadius:8,border:"1px solid #e2e8f0",padding:10,fontSize:13,resize:"vertical",minHeight:80,fontFamily:"inherit",boxSizing:"border-box"}} />
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addContact} style={{background:"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 20px",fontWeight:600,fontSize:13}}>Enregistrer</button>
                  <button onClick={function(){setShowAddContact(false);}} style={{background:"#f1f5f9",color:"#64748b",border:"none",cursor:"pointer",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13}}>Annuler</button>
                </div>
              </div>
            )}
            {contacts.length===0 ? <p style={{color:"#94a3b8",textAlign:"center",padding:"24px 0",fontSize:14}}>Aucun contact enregistre</p>
              : <div style={{borderRadius:10,border:"1px solid #f1f5f9",overflow:"hidden"}}>{contacts.map(function(c){return <ContactLog key={c.id} contact={c} />;})}</div>}
          </div>
        )}
        {tab==="notes" && <NotesTab candidate={candidate} onUpdate={onUpdate} />}
      </div>
    </Modal>
  );
}

// ── FORMULAIRE NOUVEAU CANDIDAT ──────────────────────────────

function AddCandidateForm(props) {
  var onAdd=props.onAdd; var onClose=props.onClose; var structures=props.structures;
  var formState=useState({prenom:"",nom:"",email:"",telephone:"",poste:"",ville:"",resume:"",structures:[],status:"nouveau"});
  var form=formState[0]; var setForm=formState[1];
  var fileState=useState(null); var file=fileState[0]; var setFile=fileState[1];
  var cvDataState=useState(null); var cvData=cvDataState[0]; var setCvData=cvDataState[1];
  var loadingState=useState(false); var loading=loadingState[0]; var setLoading=loadingState[1];
  var errorState=useState(""); var error=errorState[0]; var setError=errorState[1];
  var fileRef=useRef();

  async function handleFile(f) {
    if(!f||f.type!=="application/pdf"){setError("PDF uniquement.");return;}
    setFile(f);setLoading(true);setError("");
    try {
      var b64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(",")[1]);};r.onerror=rej;r.readAsDataURL(f);});
      setCvData(b64);
      var data=await extractCVData(b64);
      setForm(function(prev){return Object.assign({},prev,{prenom:data.prenom||prev.prenom,nom:data.nom||prev.nom,email:data.email||prev.email,telephone:data.telephone||prev.telephone,poste:data.poste||prev.poste,ville:data.ville||prev.ville,linkedin:data.linkedin||prev.linkedin,competences:data.competences||[],experience:data.experience||"",formation:data.formation||"",resume:data.resume||prev.resume});});
    } catch(e){setError("Erreur extraction CV. Remplissez manuellement.");}
    finally{setLoading(false);}
  }

  function submit() {
    if(!form.prenom||!form.nom){setError("Prenom et nom obligatoires.");return;}
    onAdd(Object.assign({},form,{id:Date.now(),createdAt:new Date().toISOString(),contacts:[],notes:"",lastContactDate:null,cvData:cvData||null,cvName:file?file.name:null}));
  }

  var fields=[["Prenom *","prenom"],["Nom *","nom"],["Email","email"],["Telephone","telephone"],["Poste / Fonction","poste"],["Ville","ville"]];

  return (
    <Modal onClose={onClose}>
      <div style={{padding:"24px 28px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between"}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:700,color:"#0f172a"}}>Nouveau candidat</h2>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>x</button>
      </div>
      <div style={{padding:"20px 28px 28px",display:"flex",flexDirection:"column",gap:16}}>
        <div onClick={function(){fileRef.current&&fileRef.current.click();}} onDrop={function(e){e.preventDefault();handleFile(e.dataTransfer.files[0]);}} onDragOver={function(e){e.preventDefault();}}
          style={{border:"2px dashed #e2e8f0",borderRadius:12,padding:24,textAlign:"center",cursor:"pointer",background:file?"#f0fdf4":"#fafafa"}}>
          <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={function(e){handleFile(e.target.files[0]);}} />
          {loading?<p style={{margin:0,color:"#64748b",fontSize:14}}>Extraction en cours...</p>
            :file?<div><p style={{margin:0,color:"#15803d",fontWeight:600,fontSize:14}}>{file.name}</p><p style={{margin:"4px 0 0",color:"#64748b",fontSize:12}}>Donnees extraites - CV sauvegarde</p></div>
            :<div><p style={{margin:0,color:"#0f172a",fontWeight:600,fontSize:14}}>Deposer le CV PDF ici</p><p style={{margin:"4px 0 0",color:"#94a3b8",fontSize:12}}>ou cliquer pour selectionner</p></div>}
        </div>
        {error&&<p style={{margin:0,color:"#dc2626",fontSize:13,background:"#fff1f2",padding:10,borderRadius:8}}>{error}</p>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {fields.map(function(item){return(
            <div key={item[1]}><label style={{fontSize:11,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:4}}>{item[0]}</label>
              <input value={form[item[1]]||""} onChange={function(e){var val=e.target.value;setForm(function(p){var u=Object.assign({},p);u[item[1]]=val;return u;});}} style={{width:"100%",borderRadius:8,border:"1px solid #e2e8f0",padding:"8px 10px",fontSize:13,boxSizing:"border-box"}} />
            </div>);
          })}
        </div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:8}}>STRUCTURE(S)</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {structures.filter(function(s){return s!=="Toutes";}).map(function(s){return <button key={s} onClick={function(){setForm(function(p){var structs=p.structures.includes(s)?p.structures.filter(function(x){return x!==s;}):p.structures.concat([s]);return Object.assign({},p,{structures:structs});});}} style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:500,border:form.structures.includes(s)?"2px solid #0f172a":"1px solid #e2e8f0",background:form.structures.includes(s)?"#0f172a":"#fff",color:form.structures.includes(s)?"#fff":"#64748b"}}>{s}</button>;})}
          </div>
        </div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:4}}>RESUME / NOTES</label>
          <textarea value={form.resume||""} onChange={function(e){var val=e.target.value;setForm(function(p){return Object.assign({},p,{resume:val});});}} placeholder="Profil en quelques mots..." style={{width:"100%",borderRadius:8,border:"1px solid #e2e8f0",padding:10,fontSize:13,minHeight:80,resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} />
        </div>
        <button onClick={submit} style={{background:"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:10,padding:"12px 24px",fontWeight:700,fontSize:15,marginTop:4}}>Creer la fiche candidat</button>
      </div>
    </Modal>
  );
}

// ── CARTE CANDIDAT ───────────────────────────────────────────

function CandidateCard(props) {
  var candidate=props.candidate; var onClick=props.onClick; var selected=props.selected;
  var lastContact=candidate.contacts&&candidate.contacts[0];
  return (
    <div onClick={onClick} style={{background:selected?"#eff6ff":"#fff",border:"1px solid "+(selected?"#3B82F6":"#f1f5f9"),borderRadius:14,padding:"16px 18px",cursor:"pointer",display:"flex",flexDirection:"column",gap:8,transition:"all 0.15s"}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <Avatar name={candidate.prenom+" "+candidate.nom} size={42} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
            <div style={{fontWeight:700,fontSize:15,color:"#0f172a"}}>{candidate.prenom} {candidate.nom}</div>
            <Badge status={candidate.status} />
          </div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{candidate.poste}</div>
          <div style={{fontSize:11,color:"#cbd5e1",marginTop:2}}>Cree le {formatDateShort(candidate.createdAt)}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
        {candidate.structures&&candidate.structures.map(function(s){return <span key={s} style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:500}}>{s}</span>;})}
        {candidate.cvData&&<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>CV</span>}
      </div>
      {lastContact?(
        <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:CONTACT_TYPES[lastContact.type]?CONTACT_TYPES[lastContact.type].color:"#64748b",fontWeight:700}}>{CONTACT_TYPES[lastContact.type]?CONTACT_TYPES[lastContact.type].label:lastContact.type}</span>
            {lastContact.etape&&<EtapeTag tag={lastContact.etape} />}
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{formatDateShort(lastContact.date)}</span>
          </div>
          <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastContact.isInterview?"Entretien tel. — Score: "+lastContact.interviewScore+"% — "+lastContact.interviewVerdict:lastContact.note}</div>
        </div>
      ):<div style={{fontSize:12,color:"#cbd5e1",fontStyle:"italic"}}>Aucun contact</div>}
    </div>
  );
}

// ── SECTION ARCHIVES ─────────────────────────────────────────

function ArchiveSection(props) {
  var archives=props.archives; var onRestore=props.onRestore; var onDelete=props.onDelete;
  var selectedState=useState(null); var selected=selectedState[0]; var setSelected=selectedState[1];
  return (
    <div style={{flex:1,padding:28,minWidth:0}}>
      <h2 style={{margin:"0 0 20px",fontSize:20,fontWeight:700,color:"#0f172a"}}>Archives ({archives.length})</h2>
      {archives.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}><p style={{fontSize:16}}>Aucun candidat archive</p></div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {archives.map(function(c){return <CandidateCard key={c.id} candidate={c} onClick={function(){setSelected(c);}} />;}) }
        </div>
      )}
      {selected&&<CandidateDetail candidate={selected} onClose={function(){setSelected(null);}} onUpdate={function(){}} structures={[]} onArchive={function(){}} onRestore={function(c){onRestore(c);setSelected(null);}} onDelete={function(c){onDelete(c);setSelected(null);}} isArchived={true} />}
    </div>
  );
}

// ── APP PRINCIPALE ───────────────────────────────────────────

var SAMPLE_DATA = [
  {id:1,prenom:"Sophie",nom:"Martin",email:"sophie.martin@email.com",telephone:"06 12 34 56 78",poste:"Responsable RH",ville:"Paris",status:"entretien",structures:["TechCorp Paris","InnoGroup Lyon"],resume:"Professionnelle RH experimentee, 8 ans en structures tech. Forte expertise recrutement et GPEC.",competences:["Recrutement","GPEC","SIRH","Management"],contacts:[{id:1,type:"entretien",etape:"visio",note:"Entretien visio - profil tres interessant",date:new Date(Date.now()-2*86400000).toISOString()},{id:2,type:"email",etape:"",note:"Envoi test personnalite",date:new Date(Date.now()-5*86400000).toISOString()}],createdAt:new Date(Date.now()-7*86400000).toISOString(),notes:"",lastContactDate:new Date(Date.now()-2*86400000).toISOString(),cvData:null},
  {id:2,prenom:"Julien",nom:"Dupont",email:"j.dupont@pro.fr",telephone:"07 98 76 54 32",poste:"Employe Polyvalent",ville:"Lyon",status:"offre",structures:["Ankor"],resume:"Profil dynamique, experience en loisirs et accueil public.",competences:["Accueil","Animation","Caisse"],contacts:[{id:3,type:"phone",etape:"physique",note:"Entretien physique positif",date:new Date(Date.now()-86400000).toISOString()}],createdAt:new Date(Date.now()-10*86400000).toISOString(),notes:"Tres motive.",lastContactDate:new Date(Date.now()-86400000).toISOString(),cvData:null},
];

export default function CRMApp() {
  var candidatesState=useState(function(){return loadAndMigrateCandidates(SAMPLE_DATA);});
  var candidates=candidatesState[0]; var setCandidates=candidatesState[1];
  var archivesState=useState(function(){return loadFromStorage("crm_archives",[]);});
  var archives=archivesState[0]; var setArchives=archivesState[1];
  var structuresState=useState(function(){return loadFromStorage("crm_structures",STRUCTURES_INIT);});
  var structures=structuresState[0]; var setStructures=structuresState[1];

  // Google Drive state
  var gTokenState=useState(loadFromStorage("crm_gtoken",null)); var gToken=gTokenState[0]; var setGToken=gTokenState[1];
  var gFileIdState=useState(loadFromStorage("crm_gfileid",null)); var gFileId=gFileIdState[0]; var setGFileId=gFileIdState[1];
  var gStatusState=useState("idle"); var gStatus=gStatusState[0]; var setGStatus=gStatusState[1];
  var gSyncTimerState=useState(null); var gSyncTimer=gSyncTimerState[0]; var setGSyncTimer=gSyncTimerState[1];

  var selectedState=useState(null); var selected=selectedState[0]; var setSelected=selectedState[1];
  var showAddState=useState(false); var showAdd=showAddState[0]; var setShowAdd=showAddState[1];
  var filterStatusState=useState("tous"); var filterStatus=filterStatusState[0]; var setFilterStatus=filterStatusState[1];
  var filterStructureState=useState("Toutes"); var filterStructure=filterStructureState[0]; var setFilterStructure=filterStructureState[1];
  var filterEtapeState=useState(""); var filterEtape=filterEtapeState[0]; var setFilterEtape=filterEtapeState[1];
  var searchState=useState(""); var search=searchState[0]; var setSearch=searchState[1];
  var newStructureState=useState(""); var newStructure=newStructureState[0]; var setNewStructure=newStructureState[1];
  var showStructureInputState=useState(false); var showStructureInput=showStructureInputState[0]; var setShowStructureInput=showStructureInputState[1];
  var viewState=useState("actifs"); var view=viewState[0]; var setView=viewState[1];
  var selectionState=useState([]); var selection=selectionState[0]; var setSelection=selectionState[1];
  var confirmBulkState=useState(null); var confirmBulk=confirmBulkState[0]; var setConfirmBulk=confirmBulkState[1];
  var showBulkStatusState=useState(false); var showBulkStatus=showBulkStatusState[0]; var setShowBulkStatus=showBulkStatusState[1];

  // Sauvegarde localStorage
  useEffect(function(){saveToStorage("crm_candidates",candidates);},[candidates]);
  useEffect(function(){saveToStorage("crm_archives",archives);},[archives]);
  useEffect(function(){saveToStorage("crm_structures",structures);},[structures]);
  useEffect(function(){saveToStorage("crm_gtoken",gToken);},[gToken]);
  useEffect(function(){saveToStorage("crm_gfileid",gFileId);},[gFileId]);

  // Sync Drive avec debounce 3s
  var syncToDrive = useCallback(function(token, fileId, data) {
    if (!token) return;
    setGStatus("saving");
    saveDriveFile(token, fileId, data).then(function(res) {
      if (res && res.id && !fileId) { setGFileId(res.id); saveToStorage("crm_gfileid", res.id); }
      setGStatus("saved");
      setTimeout(function(){ setGStatus("connected"); }, 2000);
    }).catch(function() { setGStatus("error"); });
  }, []);

  useEffect(function() {
    if (!gToken) return;
    if (gSyncTimer) clearTimeout(gSyncTimer);
    var timer = setTimeout(function() {
      syncToDrive(gToken, gFileId, { candidates: candidates, archives: archives, structures: structures });
    }, 3000);
    setGSyncTimer(timer);
    return function(){ clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, archives, structures, gToken]);

  // Connexion Google
  function connectGoogle() {
    loadGsiScript().then(function() {
      var client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.appdata",
        callback: function(resp) {
          if (resp.error) { setGStatus("error"); return; }
          setGToken(resp.access_token);
          setGStatus("loading");
          findDriveFile(resp.access_token).then(function(fid) {
            if (fid) {
              setGFileId(fid);
              return readDriveFile(resp.access_token, fid).then(function(data) {
                if (data.candidates) setCandidates(data.candidates.map(migrateCandidate));
                if (data.archives) setArchives(data.archives);
                if (data.structures) setStructures(data.structures);
                setGStatus("connected");
              });
            } else {
              setGStatus("connected");
            }
          }).catch(function(){ setGStatus("error"); });
        }
      });
      client.requestAccessToken();
    });
  }

  function disconnectGoogle() {
    setGToken(null); setGFileId(null); setGStatus("idle");
    saveToStorage("crm_gtoken", null); saveToStorage("crm_gfileid", null);
  }

  var filtered=candidates.filter(function(c){
    var ms=!search||(c.prenom+" "+c.nom+" "+(c.poste||"")).toLowerCase().indexOf(search.toLowerCase())>=0;
    var mst=filterStatus==="tous"||c.status===filterStatus;
    var mstr=filterStructure==="Toutes"||(c.structures||[]).indexOf(filterStructure)>=0;
    var me=!filterEtape||(c.contacts||[]).some(function(ct){return ct.etape===filterEtape;});
    return ms&&mst&&mstr&&me;
  });

  function updateCandidate(updated){setCandidates(function(prev){return prev.map(function(c){return c.id===updated.id?updated:c;});});if(selected&&selected.id===updated.id)setSelected(updated);}
  function addCandidate(c){setCandidates(function(prev){return [c].concat(prev);});setShowAdd(false);}
  function archiveCandidate(c){setCandidates(function(prev){return prev.filter(function(x){return x.id!==c.id;});});setArchives(function(prev){return [Object.assign({},c,{archivedAt:new Date().toISOString()})].concat(prev);});}
  function restoreCandidate(c){setArchives(function(prev){return prev.filter(function(x){return x.id!==c.id;});});setCandidates(function(prev){return [c].concat(prev);});}
  function deleteCandidate(c){setCandidates(function(prev){return prev.filter(function(x){return x.id!==c.id;});});setArchives(function(prev){return prev.filter(function(x){return x.id!==c.id;});});}
  function removeStructure(s){setStructures(function(prev){return prev.filter(function(x){return x!==s;});});if(filterStructure===s)setFilterStructure("Toutes");}

  function toggleSelect(id){setSelection(function(prev){return prev.includes(id)?prev.filter(function(x){return x!==id;}):prev.concat([id]);});}
  function selectAll(){setSelection(filtered.map(function(c){return c.id;}));}
  function clearSelection(){setSelection([]);}
  function bulkArchive(){
    selection.forEach(function(id){var c=candidates.find(function(x){return x.id===id;});if(c)archiveCandidate(c);});
    setSelection([]);setConfirmBulk(null);
  }
  function bulkDelete(){
    selection.forEach(function(id){deleteCandidate({id:id});});
    setSelection([]);setConfirmBulk(null);
  }
  function bulkSetStatus(status){
    setCandidates(function(prev){return prev.map(function(c){return selection.includes(c.id)?Object.assign({},c,{status:status}):c;});});
    setSelection([]);setShowBulkStatus(false);
  }

  var counts={};Object.keys(STATUS_CONFIG).forEach(function(k){counts[k]=candidates.filter(function(c){return c.status===k;}).length;});
  var etapeCounts={};Object.keys(ETAPE_TAGS).forEach(function(k){etapeCounts[k]=candidates.filter(function(c){return(c.contacts||[]).some(function(ct){return ct.etape===k;});}).length;});

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f8fafc"}}>
      <div style={{display:"flex",minHeight:"100vh"}}>

        {/* SIDEBAR */}
        <div style={{width:230,background:"#0f172a",flexShrink:0,display:"flex",flexDirection:"column",padding:"24px 0"}}>
          <div style={{padding:"0 20px 20px",borderBottom:"1px solid #1e293b"}}>
            <div style={{fontWeight:800,fontSize:17,color:"#fff"}}>Recrutement</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{candidates.length} candidats actifs · {archives.length} archives</div>
            <div style={{marginTop:10}}>
              {gStatus==="idle" && (
                <button onClick={connectGoogle} style={{width:"100%",background:"#fff",color:"#0f172a",border:"none",cursor:"pointer",borderRadius:8,padding:"7px 10px",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                  <span style={{fontSize:14}}>G</span> Connecter Google Drive
                </button>
              )}
              {gStatus==="loading" && <div style={{fontSize:12,color:"#64748b",textAlign:"center",padding:"6px 0"}}>Chargement Drive...</div>}
              {gStatus==="connected" && (
                <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#10B981",flexShrink:0}} />
                    <span style={{fontSize:11,color:"#10B981",fontWeight:600}}>Drive connecte</span>
                  </div>
                  <button onClick={disconnectGoogle} style={{background:"none",border:"none",cursor:"pointer",color:"#475569",fontSize:11,padding:"2px 6px"}}>Deconnecter</button>
                </div>
              )}
              {gStatus==="saving" && (
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#F59E0B",flexShrink:0}} />
                  <span style={{fontSize:11,color:"#F59E0B",fontWeight:600}}>Sauvegarde...</span>
                </div>
              )}
              {gStatus==="saved" && (
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#10B981",flexShrink:0}} />
                  <span style={{fontSize:11,color:"#10B981",fontWeight:600}}>Sauvegarde OK</span>
                </div>
              )}
              {gStatus==="error" && (
                <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:"#EF4444",fontWeight:600}}>Erreur Drive</span>
                  <button onClick={connectGoogle} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:11,padding:"2px 6px"}}>Reconnecter</button>
                </div>
              )}
            </div>
          </div>

          {/* Vue */}
          <div style={{padding:"12px 12px 0"}}>
            <div style={{display:"flex",gap:4,marginBottom:16}}>
              <button onClick={function(){setView("actifs");}} style={{flex:1,padding:"6px",borderRadius:6,border:"none",cursor:"pointer",background:view==="actifs"?"#1e293b":"transparent",color:view==="actifs"?"#fff":"#64748b",fontSize:12,fontWeight:600}}>Actifs</button>
              <button onClick={function(){setView("archives");}} style={{flex:1,padding:"6px",borderRadius:6,border:"none",cursor:"pointer",background:view==="archives"?"#1e293b":"transparent",color:view==="archives"?"#fff":"#64748b",fontSize:12,fontWeight:600}}>Archives ({archives.length})</button>
            </div>

            {view==="actifs" && (
              <>
                <div style={{fontSize:10,fontWeight:700,color:"#475569",marginBottom:8,paddingLeft:8,letterSpacing:1}}>STATUT</div>
                {[{key:"tous",label:"Tous",count:candidates.length}].concat(Object.entries(STATUS_CONFIG).map(function(e){return{key:e[0],label:e[1].label,count:counts[e[0]]};})).map(function(item){
                  return <button key={item.key} onClick={function(){setFilterStatus(item.key);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 8px",borderRadius:8,border:"none",cursor:"pointer",background:filterStatus===item.key?"#1e293b":"transparent",color:filterStatus===item.key?"#fff":"#94a3b8",fontSize:13,fontWeight:filterStatus===item.key?600:400,marginBottom:2}}>
                    <span>{item.label}</span><span style={{background:"#1e293b",borderRadius:20,padding:"1px 7px",fontSize:11,color:"#94a3b8"}}>{item.count}</span>
                  </button>;
                })}

                <div style={{fontSize:10,fontWeight:700,color:"#475569",margin:"16px 0 8px",paddingLeft:8,letterSpacing:1}}>ETAPE</div>
                <button onClick={function(){setFilterEtape("");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 8px",borderRadius:8,border:"none",cursor:"pointer",background:filterEtape===""?"#1e293b":"transparent",color:filterEtape===""?"#fff":"#94a3b8",fontSize:13,fontWeight:filterEtape===""?600:400,marginBottom:2}}>
                  <span>Toutes etapes</span>
                </button>
                {Object.entries(ETAPE_TAGS).map(function(entry){var key=entry[0];var cfg=entry[1];return(
                  <button key={key} onClick={function(){setFilterEtape(key);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"7px 8px",borderRadius:8,border:"none",cursor:"pointer",background:filterEtape===key?"#1e293b":"transparent",color:filterEtape===key?"#fff":"#94a3b8",fontSize:13,fontWeight:filterEtape===key?600:400,marginBottom:2}}>
                    <span>{cfg.label}</span><span style={{background:"#1e293b",borderRadius:20,padding:"1px 7px",fontSize:11,color:"#94a3b8"}}>{etapeCounts[key]}</span>
                  </button>);
                })}

                <div style={{fontSize:10,fontWeight:700,color:"#475569",margin:"16px 0 8px",paddingLeft:8,letterSpacing:1}}>STRUCTURES</div>
                <button onClick={function(){setFilterStructure("Toutes");}} style={{display:"block",width:"100%",padding:"7px 8px",borderRadius:8,border:"none",cursor:"pointer",background:filterStructure==="Toutes"?"#1e293b":"transparent",color:filterStructure==="Toutes"?"#fff":"#94a3b8",fontSize:13,textAlign:"left",marginBottom:2}}>Toutes</button>
                {structures.filter(function(s){return s!=="Toutes";}).map(function(s){return(
                  <div key={s} style={{display:"flex",alignItems:"center",marginBottom:2}}>
                    <button onClick={function(){setFilterStructure(s);}} style={{flex:1,padding:"7px 8px",borderRadius:8,border:"none",cursor:"pointer",background:filterStructure===s?"#1e293b":"transparent",color:filterStructure===s?"#fff":"#94a3b8",fontSize:13,textAlign:"left",fontWeight:filterStructure===s?600:400}}>{s}</button>
                    <button onClick={function(){removeStructure(s);}} style={{background:"none",border:"none",cursor:"pointer",color:"#475569",fontSize:14,padding:"4px 6px",borderRadius:4}}>x</button>
                  </div>);
                })}
                {showStructureInput?(
                  <div style={{padding:"6px 4px",display:"flex",gap:4}}>
                    <input value={newStructure} onChange={function(e){setNewStructure(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&newStructure.trim()){setStructures(function(p){return p.concat([newStructure.trim()]);});setNewStructure("");setShowStructureInput(false);}}} placeholder="Nom..." autoFocus style={{flex:1,borderRadius:6,border:"1px solid #334155",background:"#1e293b",color:"#fff",padding:"4px 8px",fontSize:12}} />
                    <button onClick={function(){if(newStructure.trim()){setStructures(function(p){return p.concat([newStructure.trim()]);});setNewStructure("");setShowStructureInput(false);}}} style={{background:"#3b82f6",color:"#fff",border:"none",cursor:"pointer",borderRadius:6,padding:"4px 8px",fontSize:12}}>+</button>
                  </div>
                ):<button onClick={function(){setShowStructureInput(true);}} style={{color:"#475569",background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"6px 8px"}}>+ Ajouter une structure</button>}
              </>
            )}
          </div>
        </div>

        {/* MAIN */}
        {view==="archives" ? (
          <ArchiveSection archives={archives} onRestore={restoreCandidate} onDelete={deleteCandidate} />
        ) : (
          <div style={{flex:1,padding:28,minWidth:0}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
              <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Rechercher un candidat..." style={{flex:1,borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 16px",fontSize:14,background:"#fff",outline:"none"}} />
              <button onClick={function(){setShowAdd(true);}} style={{background:"#0f172a",color:"#fff",border:"none",cursor:"pointer",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:14,whiteSpace:"nowrap"}}>+ Nouveau candidat</button>
            </div>

            {/* BARRE SELECTION MULTIPLE */}
            {selection.length>0 ? (
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,background:"#0f172a",borderRadius:12,padding:"10px 16px",flexWrap:"wrap"}}>
                <span style={{color:"#fff",fontWeight:700,fontSize:14,marginRight:4}}>{selection.length} selectionne{selection.length>1?"s":""}</span>
                <div style={{flex:1,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <div style={{position:"relative"}}>
                    <button onClick={function(){setShowBulkStatus(!showBulkStatus);}} style={{background:"#1e293b",color:"#fff",border:"1px solid #334155",cursor:"pointer",borderRadius:8,padding:"6px 14px",fontWeight:600,fontSize:12}}>
                      Changer statut
                    </button>
                    {showBulkStatus&&(
                      <div style={{position:"absolute",top:"100%",left:0,marginTop:4,background:"#fff",borderRadius:10,boxShadow:"0 10px 30px rgba(0,0,0,0.15)",zIndex:100,padding:8,minWidth:160}}>
                        {Object.entries(STATUS_CONFIG).map(function(entry){var key=entry[0];var cfg=entry[1];return(
                          <button key={key} onClick={function(){bulkSetStatus(key);}} style={{display:"block",width:"100%",padding:"7px 12px",borderRadius:6,border:"none",cursor:"pointer",background:"#fff",color:cfg.color,fontWeight:600,fontSize:13,textAlign:"left"}}>
                            {cfg.label}
                          </button>
                        );})}
                      </div>
                    )}
                  </div>
                  <button onClick={function(){setConfirmBulk({title:"Archiver "+selection.length+" candidat(s) ?",message:"Ils seront deplaces dans les archives.",confirmLabel:"Archiver",danger:false,action:bulkArchive});}} style={{background:"#334155",color:"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 14px",fontWeight:600,fontSize:12}}>
                    Archiver
                  </button>
                  <button onClick={function(){setConfirmBulk({title:"Supprimer "+selection.length+" candidat(s) ?",message:"Cette action est irreversible.",confirmLabel:"Supprimer",danger:true,action:bulkDelete});}} style={{background:"#ef4444",color:"#fff",border:"none",cursor:"pointer",borderRadius:8,padding:"6px 14px",fontWeight:600,fontSize:12}}>
                    Supprimer
                  </button>
                </div>
                <button onClick={clearSelection} style={{background:"none",color:"#94a3b8",border:"none",cursor:"pointer",fontSize:18,padding:"0 4px"}}>x</button>
              </div>
            ):(
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
                <button onClick={selectAll} style={{background:"#f1f5f9",color:"#64748b",border:"1px solid #e2e8f0",cursor:"pointer",borderRadius:8,padding:"5px 14px",fontWeight:600,fontSize:12}}>
                  Tout selectionner ({filtered.length})
                </button>
              </div>
            )}

            {confirmBulk&&<ConfirmDialog title={confirmBulk.title} message={confirmBulk.message} confirmLabel={confirmBulk.confirmLabel} danger={confirmBulk.danger} onCancel={function(){setConfirmBulk(null);}} onConfirm={confirmBulk.action} />}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10,marginBottom:16}}>
              {["nouveau","contacte","entretien","offre","retenu"].map(function(k){var cfg=STATUS_CONFIG[k];return(
                <div key={k} onClick={function(){setFilterStatus(k);}} style={{background:cfg.bg,border:"1px solid "+cfg.border,borderRadius:12,padding:"12px 14px",cursor:"pointer"}}>
                  <div style={{fontSize:22,fontWeight:800,color:cfg.color}}>{counts[k]}</div>
                  <div style={{fontSize:11,fontWeight:600,color:cfg.color}}>{cfg.label}</div>
                </div>);
              })}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
              {Object.entries(ETAPE_TAGS).map(function(entry){var key=entry[0];var cfg=entry[1];return(
                <button key={key} onClick={function(){setFilterEtape(filterEtape===key?"":key);}} style={{padding:"5px 14px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,border:filterEtape===key?"2px solid "+cfg.color:"1px solid "+cfg.border,background:filterEtape===key?cfg.bg:"#fff",color:cfg.color}}>
                  {cfg.label} ({etapeCounts[key]})
                </button>);
              })}
            </div>

            {filtered.length===0?(
              <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}><p style={{fontSize:16,fontWeight:500}}>Aucun candidat trouve</p></div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                {filtered.map(function(c){
                  var isSelected=selection.includes(c.id);
                  return (
                    <div key={c.id} style={{position:"relative"}}>
                        <div onClick={function(e){e.stopPropagation();toggleSelect(c.id);}} style={{position:"absolute",top:12,right:12,zIndex:10,width:20,height:20,borderRadius:6,border:"2px solid "+(isSelected?"#0f172a":"#cbd5e1"),background:isSelected?"#0f172a":"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {isSelected&&<span style={{color:"#fff",fontSize:12,fontWeight:700,lineHeight:1}}>✓</span>}
                      </div>
                      <CandidateCard candidate={c} onClick={function(){setSelected(c);}} selected={isSelected} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selected&&<CandidateDetail candidate={selected} onClose={function(){setSelected(null);}} onUpdate={updateCandidate} structures={structures} onArchive={archiveCandidate} onRestore={restoreCandidate} onDelete={deleteCandidate} isArchived={false} />}
      {showAdd&&<AddCandidateForm onAdd={addCandidate} onClose={function(){setShowAdd(false);}} structures={structures} />}
    </div>
  );
}
