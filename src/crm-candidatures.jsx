import { useState, useRef, useEffect } from "react";

const STRUCTURES_INIT = ["Toutes", "TechCorp Paris", "InnoGroup Lyon", "StartupNord", "Groupe Medical Est"];

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

const INITIALS_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4","#84CC16"];

function getColor(name) {
  return INITIALS_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1)||0)) % INITIALS_COLORS.length];
}
function getInitials(name) {
  return name.split(" ").map(function(w){ return w[0]; }).join("").toUpperCase().slice(0,2);
}
function formatDateShort(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function timeAgo(iso) {
  if (!iso) return "";
  var diff = Date.now() - new Date(iso).getTime();
  var days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return "il y a " + days + "j";
  if (days < 30) return "il y a " + Math.floor(days/7) + "sem";
  return formatDateShort(iso);
}

// ── PERSISTANCE localStorage ──────────────────────────────────
function loadFromStorage(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return fallback;
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

// ── API CLAUDE ────────────────────────────────────────────────
async function extractCVData(base64PDF) {
  var prompt = "Extrais les informations du candidat depuis ce CV. Reponds UNIQUEMENT en JSON valide, sans markdown, sans balises, sans texte avant ou apres. Format exact avec ces cles: prenom, nom, email, telephone, poste, ville, linkedin, competences (tableau de strings), experience, formation, resume. Laisse la valeur vide si absent. Pour competences utilise un tableau vide si aucune. resume doit etre 2-3 phrases synthetisant le profil.";
  var requestBody = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64PDF } },
        { type: "text", text: prompt }
      ]
    }]
  };
  var res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(requestBody)
  });
  var data = await res.json();
  var block = data.content && data.content.find(function(b){ return b.type === "text"; });
  var text = block ? block.text : "{}";
  var clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
}

// ── COMPOSANTS UTILITAIRES ────────────────────────────────────
function EtapeTag(props) {
  var cfg = ETAPE_TAGS[props.tag];
  if (!cfg) return null;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: "1px solid " + cfg.border, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

function Badge(props) {
  var c = STATUS_CONFIG[props.status];
  return (
    <span style={{ background: c.bg, color: c.color, border: "1px solid " + c.border, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

function Avatar(props) {
  var name = props.name; var size = props.size || 40;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: getColor(name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

function ContactLog(props) {
  var contact = props.contact;
  var ct = CONTACT_TYPES[contact.type] || CONTACT_TYPES.email;
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ background: ct.color + "18", color: ct.color, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{ct.label}</span>
          {contact.etape && <EtapeTag tag={contact.etape} />}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{formatDateShort(contact.date)}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{timeAgo(contact.date)}</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{contact.note}</p>
    </div>
  );
}

function Modal(props) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={function(e){ if(e.target === e.currentTarget) props.onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: props.wide ? 900 : 700, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
        {props.children}
      </div>
    </div>
  );
}

// ── VIEWER PDF ────────────────────────────────────────────────
function CVViewer(props) {
  var pdfData = props.pdfData; var onClose = props.onClose;
  var url = "data:application/pdf;base64," + pdfData;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "#0f172a" }}>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>CV du candidat</span>
        <button onClick={onClose} style={{ background: "#334155", color: "#fff", border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 16px", fontWeight: 600, fontSize: 13 }}>
          Fermer
        </button>
      </div>
      <iframe src={url} style={{ flex: 1, border: "none", width: "100%", height: "100%" }} title="CV candidat" />
    </div>
  );
}

// ── ONGLET NOTES ──────────────────────────────────────────────
function NotesTab(props) {
  var candidate = props.candidate; var onUpdate = props.onUpdate;
  var notesState = useState(candidate.notes || "");
  var notes = notesState[0]; var setNotes = notesState[1];
  var savedState = useState(true);
  var saved = savedState[0]; var setSaved = savedState[1];
  function save() { onUpdate(Object.assign({}, candidate, { notes: notes })); setSaved(true); }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea value={notes} onChange={function(e){ setNotes(e.target.value); setSaved(false); }}
        placeholder="Notes libres sur ce candidat..."
        style={{ width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", padding: 14, fontSize: 14, resize: "vertical", minHeight: 200, fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }} />
      <button onClick={save} style={{ background: saved ? "#f1f5f9" : "#0f172a", color: saved ? "#94a3b8" : "#fff", border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, alignSelf: "flex-start" }}>
        {saved ? "Notes sauvegardees" : "Sauvegarder"}
      </button>
    </div>
  );
}

// ── FICHE CANDIDAT ────────────────────────────────────────────
function CandidateDetail(props) {
  var candidate = props.candidate; var onClose = props.onClose;
  var onUpdate = props.onUpdate; var structures = props.structures;

  var tabState = useState("profil"); var tab = tabState[0]; var setTab = tabState[1];
  var showAddState = useState(false); var showAddContact = showAddState[0]; var setShowAddContact = showAddState[1];
  var newContactState = useState({ type: "email", etape: "", note: "", date: new Date().toISOString().slice(0,10) });
  var newContact = newContactState[0]; var setNewContact = newContactState[1];
  var editStatusState = useState(candidate.status); var editStatus = editStatusState[0]; var setEditStatus = editStatusState[1];
  var editStructuresState = useState(candidate.structures || []); var editStructures = editStructuresState[0]; var setEditStructures = editStructuresState[1];
  var showCVState = useState(false); var showCV = showCVState[0]; var setShowCV = showCVState[1];

  var contacts = candidate.contacts || [];

  function addContact() {
    if (!newContact.note.trim()) return;
    var dateIso = newContact.date ? new Date(newContact.date).toISOString() : new Date().toISOString();
    var newEntry = { type: newContact.type, etape: newContact.etape, note: newContact.note, date: dateIso, id: Date.now() };
    var updated = Object.assign({}, candidate, {
      contacts: [newEntry].concat(contacts),
      lastContactDate: dateIso, status: editStatus, structures: editStructures
    });
    onUpdate(updated);
    setNewContact({ type: "email", etape: "", note: "", date: new Date().toISOString().slice(0,10) });
    setShowAddContact(false);
  }

  function saveChanges() {
    onUpdate(Object.assign({}, candidate, { status: editStatus, structures: editStructures }));
  }

  var tabs = [
    { id: "profil", label: "Profil" },
    { id: "contacts", label: "Contacts (" + contacts.length + ")" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <Modal onClose={onClose}>
      {showCV && candidate.cvData && <CVViewer pdfData={candidate.cvData} onClose={function(){ setShowCV(false); }} />}
      <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Avatar name={candidate.prenom + " " + candidate.nom} size={52} />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{candidate.prenom} {candidate.nom}</h2>
              <p style={{ margin: "2px 0 6px", color: "#64748b", fontSize: 14 }}>{candidate.poste}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Badge status={candidate.status} />
                {candidate.cvData && (
                  <button onClick={function(){ setShowCV(true); }} style={{
                    background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                    borderRadius: 20, padding: "2px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>Voir le CV</button>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8", padding: 4 }}>x</button>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 20 }}>
          {tabs.map(function(t) {
            return (
              <button key={t.id} onClick={function(){ setTab(t.id); }} style={{
                padding: "6px 16px", border: "none", cursor: "pointer", borderRadius: 8,
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                background: tab === t.id ? "#0f172a" : "transparent",
                color: tab === t.id ? "#fff" : "#64748b"
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "20px 28px 28px" }}>
        {tab === "profil" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Email", candidate.email], ["Telephone", candidate.telephone], ["Ville", candidate.ville], ["LinkedIn", candidate.linkedin]].map(function(item) {
                if (!item[1]) return null;
                return (
                  <div key={item[0]} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{item[0]}</div>
                    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{item[1]}</div>
                  </div>
                );
              })}
            </div>
            {candidate.resume && (
              <div style={{ background: "#fffbeb", borderRadius: 10, padding: 14, borderLeft: "3px solid #F59E0B" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#92400E", marginBottom: 4 }}>RESUME DU PROFIL</div>
                <p style={{ margin: 0, fontSize: 13, color: "#451a03", lineHeight: 1.6 }}>{candidate.resume}</p>
              </div>
            )}
            {candidate.experience && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>EXPERIENCE</div>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{candidate.experience}</p>
              </div>
            )}
            {candidate.formation && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>FORMATION</div>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{candidate.formation}</p>
              </div>
            )}
            {candidate.competences && candidate.competences.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>COMPETENCES</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {candidate.competences.map(function(c, i) {
                    return <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 500 }}>{c}</span>;
                  })}
                </div>
              </div>
            )}
            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>STATUT</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(STATUS_CONFIG).map(function(entry) {
                    var key = entry[0]; var cfg = entry[1];
                    return (
                      <button key={key} onClick={function(){ setEditStatus(key); }} style={{
                        padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: editStatus === key ? "2px solid " + cfg.color : "1px solid " + cfg.border,
                        background: editStatus === key ? cfg.bg : "#fff", color: cfg.color
                      }}>{cfg.label}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>STRUCTURE(S)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {structures.filter(function(s){ return s !== "Toutes"; }).map(function(s) {
                    return (
                      <button key={s} onClick={function(){
                        setEditStructures(function(prev) {
                          return prev.includes(s) ? prev.filter(function(x){ return x !== s; }) : prev.concat([s]);
                        });
                      }} style={{
                        padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 500,
                        border: editStructures.includes(s) ? "2px solid #0f172a" : "1px solid #e2e8f0",
                        background: editStructures.includes(s) ? "#0f172a" : "#fff",
                        color: editStructures.includes(s) ? "#fff" : "#64748b"
                      }}>{s}</button>
                    );
                  })}
                </div>
              </div>
              <button onClick={saveChanges} style={{ background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 14, alignSelf: "flex-start" }}>
                Enregistrer les modifications
              </button>
            </div>
          </div>
        )}

        {tab === "contacts" && (
          <div>
            <button onClick={function(){ setShowAddContact(!showAddContact); }} style={{ width: "100%", padding: "10px 16px", marginBottom: 16, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
              + Ajouter un contact
            </button>
            {showAddContact && (
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12, border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>TYPE DE CONTACT</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(CONTACT_TYPES).map(function(entry) {
                      var key = entry[0]; var ct = entry[1];
                      return (
                        <button key={key} onClick={function(){ setNewContact(function(p){ return Object.assign({}, p, {type: key}); }); }} style={{
                          padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                          border: newContact.type === key ? "2px solid " + ct.color : "1px solid #e2e8f0",
                          background: newContact.type === key ? ct.color + "18" : "#fff", color: ct.color
                        }}>{ct.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>ETAPE</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={function(){ setNewContact(function(p){ return Object.assign({}, p, {etape: ""}); }); }} style={{
                      padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      border: newContact.etape === "" ? "2px solid #64748b" : "1px solid #e2e8f0",
                      background: newContact.etape === "" ? "#f1f5f9" : "#fff", color: "#64748b"
                    }}>Aucune</button>
                    {Object.entries(ETAPE_TAGS).map(function(entry) {
                      var key = entry[0]; var cfg = entry[1];
                      return (
                        <button key={key} onClick={function(){ setNewContact(function(p){ return Object.assign({}, p, {etape: key}); }); }} style={{
                          padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
                          border: newContact.etape === key ? "2px solid " + cfg.color : "1px solid " + cfg.border,
                          background: newContact.etape === key ? cfg.bg : "#fff", color: cfg.color
                        }}>{cfg.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>DATE DU CONTACT</div>
                  <input type="date" value={newContact.date}
                    onChange={function(e){ var val = e.target.value; setNewContact(function(p){ return Object.assign({}, p, {date: val}); }); }}
                    style={{ borderRadius: 8, border: "1px solid #e2e8f0", padding: "7px 10px", fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>NOTES / RESUME DE L'ECHANGE</div>
                  <textarea value={newContact.note}
                    onChange={function(e){ var val = e.target.value; setNewContact(function(p){ return Object.assign({}, p, {note: val}); }); }}
                    placeholder="Resume de l'echange..."
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0", padding: 10, fontSize: 13, resize: "vertical", minHeight: 80, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addContact} style={{ background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 20px", fontWeight: 600, fontSize: 13 }}>Enregistrer</button>
                  <button onClick={function(){ setShowAddContact(false); }} style={{ background: "#f1f5f9", color: "#64748b", border: "none", cursor: "pointer", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13 }}>Annuler</button>
                </div>
              </div>
            )}
            {contacts.length === 0 ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: "24px 0", fontSize: 14 }}>Aucun contact enregistre</p>
            ) : (
              <div style={{ borderRadius: 10, border: "1px solid #f1f5f9", overflow: "hidden" }}>
                {contacts.map(function(c){ return <ContactLog key={c.id} contact={c} />; })}
              </div>
            )}
          </div>
        )}

        {tab === "notes" && <NotesTab candidate={candidate} onUpdate={onUpdate} />}
      </div>
    </Modal>
  );
}

// ── FORMULAIRE AJOUT ──────────────────────────────────────────
function AddCandidateForm(props) {
  var onAdd = props.onAdd; var onClose = props.onClose; var structures = props.structures;
  var formState = useState({ prenom: "", nom: "", email: "", telephone: "", poste: "", ville: "", resume: "", structures: [], status: "nouveau" });
  var form = formState[0]; var setForm = formState[1];
  var fileState = useState(null); var file = fileState[0]; var setFile = fileState[1];
  var cvDataState = useState(null); var cvData = cvDataState[0]; var setCvData = cvDataState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var errorState = useState(""); var error = errorState[0]; var setError = errorState[1];
  var fileRef = useRef();

  async function handleFile(f) {
    if (!f || f.type !== "application/pdf") { setError("Merci de selectionner un fichier PDF."); return; }
    setFile(f); setLoading(true); setError("");
    try {
      var b64 = await new Promise(function(res, rej) {
        var r = new FileReader();
        r.onload = function(){ res(r.result.split(",")[1]); };
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      setCvData(b64);
      var data = await extractCVData(b64);
      setForm(function(prev) {
        return Object.assign({}, prev, {
          prenom: data.prenom || prev.prenom, nom: data.nom || prev.nom,
          email: data.email || prev.email, telephone: data.telephone || prev.telephone,
          poste: data.poste || prev.poste, ville: data.ville || prev.ville,
          linkedin: data.linkedin || prev.linkedin, competences: data.competences || [],
          experience: data.experience || "", formation: data.formation || "",
          resume: data.resume || prev.resume,
        });
      });
    } catch(e) { setError("Erreur lors de l'extraction du CV. Vous pouvez remplir manuellement."); }
    finally { setLoading(false); }
  }

  function submit() {
    if (!form.prenom || !form.nom) { setError("Prenom et nom obligatoires."); return; }
    onAdd(Object.assign({}, form, {
      id: Date.now(), createdAt: new Date().toISOString(),
      contacts: [], notes: "", lastContactDate: null,
      cvData: cvData || null,
      cvName: file ? file.name : null
    }));
  }

  var fields = [["Prenom *", "prenom"], ["Nom *", "nom"], ["Email", "email"], ["Telephone", "telephone"], ["Poste / Fonction", "poste"], ["Ville", "ville"]];

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Nouveau candidat</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>x</button>
      </div>
      <div style={{ padding: "20px 28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div onClick={function(){ fileRef.current && fileRef.current.click(); }}
          onDrop={function(e){ e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={function(e){ e.preventDefault(); }}
          style={{ border: "2px dashed #e2e8f0", borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", background: file ? "#f0fdf4" : "#fafafa" }}>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={function(e){ handleFile(e.target.files[0]); }} />
          {loading ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Extraction des donnees en cours...</p>
          ) : file ? (
            <div>
              <p style={{ margin: 0, color: "#15803d", fontWeight: 600, fontSize: 14 }}>{file.name}</p>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 12 }}>Donnees extraites - CV sauvegarde</p>
            </div>
          ) : (
            <div>
              <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: 14 }}>Deposer le CV PDF ici</p>
              <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>ou cliquer pour selectionner</p>
            </div>
          )}
        </div>
        {error && <p style={{ margin: 0, color: "#dc2626", fontSize: 13, background: "#fff1f2", padding: 10, borderRadius: 8 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {fields.map(function(item) {
            return (
              <div key={item[1]}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>{item[0]}</label>
                <input value={form[item[1]] || ""} onChange={function(e){ var val = e.target.value; setForm(function(p){ var u = Object.assign({}, p); u[item[1]] = val; return u; }); }}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0", padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            );
          })}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 8 }}>STRUCTURE(S)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {structures.filter(function(s){ return s !== "Toutes"; }).map(function(s) {
              return (
                <button key={s} onClick={function(){
                  setForm(function(p){
                    var structs = p.structures.includes(s) ? p.structures.filter(function(x){ return x !== s; }) : p.structures.concat([s]);
                    return Object.assign({}, p, { structures: structs });
                  });
                }} style={{
                  padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 500,
                  border: form.structures.includes(s) ? "2px solid #0f172a" : "1px solid #e2e8f0",
                  background: form.structures.includes(s) ? "#0f172a" : "#fff",
                  color: form.structures.includes(s) ? "#fff" : "#64748b"
                }}>{s}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>RESUME / NOTES</label>
          <textarea value={form.resume || ""} onChange={function(e){ var val = e.target.value; setForm(function(p){ return Object.assign({}, p, {resume: val}); }); }}
            placeholder="Profil en quelques mots..."
            style={{ width: "100%", borderRadius: 8, border: "1px solid #e2e8f0", padding: 10, fontSize: 13, minHeight: 80, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <button onClick={submit} style={{ background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 15, marginTop: 4 }}>
          Creer la fiche candidat
        </button>
      </div>
    </Modal>
  );
}

// ── CARTE CANDIDAT ────────────────────────────────────────────
function CandidateCard(props) {
  var candidate = props.candidate; var onClick = props.onClick;
  var lastContact = candidate.contacts && candidate.contacts[0];
  return (
    <div onClick={onClick} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: 14, padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={candidate.prenom + " " + candidate.nom} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{candidate.prenom} {candidate.nom}</div>
            <Badge status={candidate.status} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{candidate.poste}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {candidate.structures && candidate.structures.map(function(s) {
          return <span key={s} style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{s}</span>;
        })}
        {candidate.cvData && (
          <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>CV</span>
        )}
      </div>
      {lastContact ? (
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: CONTACT_TYPES[lastContact.type] ? CONTACT_TYPES[lastContact.type].color : "#64748b", fontWeight: 700 }}>
              {CONTACT_TYPES[lastContact.type] ? CONTACT_TYPES[lastContact.type].label : lastContact.type}
            </span>
            {lastContact.etape && <EtapeTag tag={lastContact.etape} />}
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{formatDateShort(lastContact.date)}</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastContact.note}</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>Aucun contact</div>
      )}
    </div>
  );
}

// ── APP PRINCIPALE ────────────────────────────────────────────
var SAMPLE_DATA = [
  {
    id: 1, prenom: "Sophie", nom: "Martin", email: "sophie.martin@email.com",
    telephone: "06 12 34 56 78", poste: "Responsable RH", ville: "Paris",
    status: "entretien", structures: ["TechCorp Paris", "InnoGroup Lyon"],
    resume: "Professionnelle RH experimentee, 8 ans dans des structures tech. Forte expertise en recrutement et GPEC.",
    competences: ["Recrutement", "GPEC", "SIRH", "Management"],
    contacts: [
      { id: 1, type: "entretien", etape: "visio", note: "Entretien visio - profil tres interessant", date: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 2, type: "email", etape: "", note: "Envoi du test de personnalite", date: new Date(Date.now() - 5 * 86400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), notes: "", lastContactDate: new Date(Date.now() - 2 * 86400000).toISOString(), cvData: null
  },
  {
    id: 2, prenom: "Julien", nom: "Dupont", email: "j.dupont@pro.fr",
    telephone: "07 98 76 54 32", poste: "Developpeur Full Stack", ville: "Lyon",
    status: "offre", structures: ["TechCorp Paris"],
    resume: "Dev 5 ans experience React/Node.js, profil senior autonome.",
    competences: ["React", "Node.js", "AWS", "Docker"],
    contacts: [
      { id: 3, type: "phone", etape: "physique", note: "Entretien physique positif, offre en cours", date: new Date(Date.now() - 86400000).toISOString() },
    ],
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), notes: "Candidat tres motive.", lastContactDate: new Date(Date.now() - 86400000).toISOString(), cvData: null
  },
];

export default function CRMApp() {
  var candidatesState = useState(function(){ return loadFromStorage("crm_candidates", SAMPLE_DATA); });
  var candidates = candidatesState[0]; var setCandidates = candidatesState[1];
  var structuresState = useState(function(){ return loadFromStorage("crm_structures", STRUCTURES_INIT); });
  var structures = structuresState[0]; var setStructures = structuresState[1];

  var selectedState = useState(null); var selected = selectedState[0]; var setSelected = selectedState[1];
  var showAddState = useState(false); var showAdd = showAddState[0]; var setShowAdd = showAddState[1];
  var filterStatusState = useState("tous"); var filterStatus = filterStatusState[0]; var setFilterStatus = filterStatusState[1];
  var filterStructureState = useState("Toutes"); var filterStructure = filterStructureState[0]; var setFilterStructure = filterStructureState[1];
  var filterEtapeState = useState(""); var filterEtape = filterEtapeState[0]; var setFilterEtape = filterEtapeState[1];
  var searchState = useState(""); var search = searchState[0]; var setSearch = searchState[1];
  var newStructureState = useState(""); var newStructure = newStructureState[0]; var setNewStructure = newStructureState[1];
  var showStructureInputState = useState(false); var showStructureInput = showStructureInputState[0]; var setShowStructureInput = showStructureInputState[1];

  // Sauvegarde automatique a chaque changement
  useEffect(function(){ saveToStorage("crm_candidates", candidates); }, [candidates]);
  useEffect(function(){ saveToStorage("crm_structures", structures); }, [structures]);

  var filtered = candidates.filter(function(c) {
    var matchSearch = !search || (c.prenom + " " + c.nom + " " + (c.poste||"")).toLowerCase().indexOf(search.toLowerCase()) >= 0;
    var matchStatus = filterStatus === "tous" || c.status === filterStatus;
    var matchStruct = filterStructure === "Toutes" || (c.structures || []).indexOf(filterStructure) >= 0;
    var matchEtape = !filterEtape || (c.contacts || []).some(function(ct){ return ct.etape === filterEtape; });
    return matchSearch && matchStatus && matchStruct && matchEtape;
  });

  function updateCandidate(updated) {
    setCandidates(function(prev){ return prev.map(function(c){ return c.id === updated.id ? updated : c; }); });
    if (selected && selected.id === updated.id) setSelected(updated);
  }

  function addCandidate(c) {
    setCandidates(function(prev){ return [c].concat(prev); });
    setShowAdd(false);
  }

  function removeStructure(s) {
    setStructures(function(prev){ return prev.filter(function(x){ return x !== s; }); });
    if (filterStructure === s) setFilterStructure("Toutes");
  }

  var counts = {};
  Object.keys(STATUS_CONFIG).forEach(function(k) { counts[k] = candidates.filter(function(c){ return c.status === k; }).length; });
  var etapeCounts = {};
  Object.keys(ETAPE_TAGS).forEach(function(k) { etapeCounts[k] = candidates.filter(function(c){ return (c.contacts||[]).some(function(ct){ return ct.etape === k; }); }).length; });

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>

        <div style={{ width: 230, background: "#0f172a", flexShrink: 0, display: "flex", flexDirection: "column", padding: "24px 0" }}>
          <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff" }}>Recrutement</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{candidates.length} candidats</div>
          </div>
          <div style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8, paddingLeft: 8, letterSpacing: 1 }}>STATUT</div>
            {[{ key: "tous", label: "Tous", count: candidates.length }].concat(Object.entries(STATUS_CONFIG).map(function(e){ return { key: e[0], label: e[1].label, count: counts[e[0]] }; })).map(function(item) {
              return (
                <button key={item.key} onClick={function(){ setFilterStatus(item.key); }} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: filterStatus === item.key ? "#1e293b" : "transparent", color: filterStatus === item.key ? "#fff" : "#94a3b8",
                  fontSize: 13, fontWeight: filterStatus === item.key ? 600 : 400, marginBottom: 2
                }}>
                  <span>{item.label}</span>
                  <span style={{ background: "#1e293b", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "#94a3b8" }}>{item.count}</span>
                </button>
              );
            })}

            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", margin: "20px 0 8px", paddingLeft: 8, letterSpacing: 1 }}>ETAPE</div>
            <button onClick={function(){ setFilterEtape(""); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filterEtape === "" ? "#1e293b" : "transparent", color: filterEtape === "" ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: filterEtape === "" ? 600 : 400, marginBottom: 2 }}>
              <span>Toutes etapes</span>
            </button>
            {Object.entries(ETAPE_TAGS).map(function(entry) {
              var key = entry[0]; var cfg = entry[1];
              return (
                <button key={key} onClick={function(){ setFilterEtape(key); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filterEtape === key ? "#1e293b" : "transparent", color: filterEtape === key ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: filterEtape === key ? 600 : 400, marginBottom: 2 }}>
                  <span>{cfg.label}</span>
                  <span style={{ background: "#1e293b", borderRadius: 20, padding: "1px 7px", fontSize: 11, color: "#94a3b8" }}>{etapeCounts[key]}</span>
                </button>
              );
            })}

            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", margin: "20px 0 8px", paddingLeft: 8, letterSpacing: 1 }}>STRUCTURES</div>
            <button onClick={function(){ setFilterStructure("Toutes"); }} style={{ display: "block", width: "100%", padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filterStructure === "Toutes" ? "#1e293b" : "transparent", color: filterStructure === "Toutes" ? "#fff" : "#94a3b8", fontSize: 13, textAlign: "left", marginBottom: 2 }}>Toutes</button>
            {structures.filter(function(s){ return s !== "Toutes"; }).map(function(s) {
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
                  <button onClick={function(){ setFilterStructure(s); }} style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", background: filterStructure === s ? "#1e293b" : "transparent", color: filterStructure === s ? "#fff" : "#94a3b8", fontSize: 13, textAlign: "left", fontWeight: filterStructure === s ? 600 : 400 }}>{s}</button>
                  <button onClick={function(){ removeStructure(s); }} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 14, padding: "4px 6px", borderRadius: 4 }}>x</button>
                </div>
              );
            })}
            {showStructureInput ? (
              <div style={{ padding: "6px 4px", display: "flex", gap: 4 }}>
                <input value={newStructure} onChange={function(e){ setNewStructure(e.target.value); }}
                  onKeyDown={function(e){ if (e.key === "Enter" && newStructure.trim()) { setStructures(function(p){ return p.concat([newStructure.trim()]); }); setNewStructure(""); setShowStructureInput(false); }}}
                  placeholder="Nom..." autoFocus
                  style={{ flex: 1, borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#fff", padding: "4px 8px", fontSize: 12 }} />
                <button onClick={function(){ if (newStructure.trim()) { setStructures(function(p){ return p.concat([newStructure.trim()]); }); setNewStructure(""); setShowStructureInput(false); }}}
                  style={{ background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>+</button>
              </div>
            ) : (
              <button onClick={function(){ setShowStructureInput(true); }} style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: "6px 8px" }}>+ Ajouter une structure</button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, padding: 28, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
            <input value={search} onChange={function(e){ setSearch(e.target.value); }}
              placeholder="Rechercher un candidat..."
              style={{ flex: 1, borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 16px", fontSize: 14, background: "#fff", outline: "none" }} />
            <button onClick={function(){ setShowAdd(true); }} style={{ background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>+ Nouveau candidat</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginBottom: 16 }}>
            {["nouveau", "contacte", "entretien", "offre", "retenu"].map(function(k) {
              var cfg = STATUS_CONFIG[k];
              return (
                <div key={k} onClick={function(){ setFilterStatus(k); }} style={{ background: cfg.bg, border: "1px solid " + cfg.border, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{counts[k]}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {Object.entries(ETAPE_TAGS).map(function(entry) {
              var key = entry[0]; var cfg = entry[1];
              return (
                <button key={key} onClick={function(){ setFilterEtape(filterEtape === key ? "" : key); }} style={{
                  padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  border: filterEtape === key ? "2px solid " + cfg.color : "1px solid " + cfg.border,
                  background: filterEtape === key ? cfg.bg : "#fff", color: cfg.color
                }}>{cfg.label} ({etapeCounts[key]})</button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <p style={{ fontSize: 16, fontWeight: 500 }}>Aucun candidat trouve</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {filtered.map(function(c) {
                return <CandidateCard key={c.id} candidate={c} onClick={function(){ setSelected(c); }} />;
              })}
            </div>
          )}
        </div>
      </div>

      {selected && <CandidateDetail candidate={selected} onClose={function(){ setSelected(null); }} onUpdate={updateCandidate} structures={structures} />}
      {showAdd && <AddCandidateForm onAdd={addCandidate} onClose={function(){ setShowAdd(false); }} structures={structures} />}
    </div>
  );
}
