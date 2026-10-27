(() => {
const $ = id => document.getElementById(id);
const cfg = window.PARISH_CONFIG || {};
const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_URL.includes("COLLEZ_ICI") && !cfg.SUPABASE_ANON_KEY.includes("COLLEZ_ICI");
if (ready) $("setup").hidden = true;let db, profile, records = [];
const fields = ["nom","prenoms","sexe","date_naissance","lieu_naissance","telephone","adresse","village_quartier","groupe_ethnique","situation_matrimoniale","nom_pere","nom_mere","date_bapteme","lieu_bapteme","groupe_paroissial","observations"];
if (!ready) { $("loginMsg").textContent = "Configurez d’abord config.js avec les paramètres Supabase."; }
else if (window.supabase) { db = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY); start(); }
else $("loginMsg").textContent = "Connexion Internet nécessaire pour charger la bibliothèque Supabase.";

async function start() {
$("loginForm").addEventListener("submit", login);
$("logout").addEventListener("click", async()=>{await db.auth.signOut(); showLogin();});
$("personForm").addEventListener("submit", save);
$("cancel").addEventListener("click", resetForm);
$("search").addEventListener("input", render);
$("export").addEventListener("click", exportCsv);
const {data:{session}} = await db.auth.getSession();
if(session) await showApp(session.user);
db.auth.onAuthStateChange((_e,s)=>setTimeout(()=>s?showApp(s.user):showLogin(),0));
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
async function login(e) {
e.preventDefault(); $("loginMsg").textContent="Connexion…";
const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
if(error){$("loginMsg").textContent="Connexion impossible : vérifiez vos identifiants.";return;}
await showApp(data.user);
}
async function showApp(user) {
const {data:p,error}=await db.from("utilisateurs_paroisse").select("nom_complet,role,actif").eq("user_id",user.id).maybeSingle();
if(error||!p||!p.actif||!["cure","vicaire","secretariat"].includes(p.role)){
await db.auth.signOut();showLogin();$("loginMsg").textContent="Compte non autorisé. L’administrateur doit créer votre profil.";return;
}
profile=p;$("login").hidden=true;$("app").hidden=false;$("profile").textContent=`Connecté : ${p.nom_complet} — rôle : ${p.role}`;await load();
}
function showLogin(){profile=null;$("app").hidden=true;$("login").hidden=false;}
async function load(){
$("rows").innerHTML="<tr><td colspan='5'>Chargement…</td></tr>";
const {data,error}=await db.from("paroissiens").select("*").order("nom").limit(5000);
if(error){$("rows").innerHTML="<tr><td colspan='5'>Chargement impossible. Vérifiez les politiques RLS.</td></tr>";return;}
records=data||[];render();
}
async function save(e){
e.preventDefault();const payload={};fields.forEach(f=>payload[f]=$(f).value.trim()||null);
$("save").disabled=true;$("formMsg").textContent="Enregistrement…";
try{
const id=$("recordId").value;
if(id){const {error}=await db.from("paroissiens").update(payload).eq("id",id);if(error)throw error;$("formMsg").textContent="Fiche modifiée.";}
else{const {data,error}=await db.from("paroissiens").insert(payload).select("id").single();if(error)throw error;
const num="PSE-"+String(data.id).padStart(6,"0");const {error:e2}=await db.from("paroissiens").update({numero_identification:num}).eq("id",data.id);if(e2)throw e2;$("formMsg").textContent="Fiche enregistrée : "+num;}
resetForm(false);await load();
}catch(err){console.error(err);$("formMsg").textContent="Échec. Vérifiez les champs et les autorisations Supabase.";}
finally{$("save").disabled=false;}
}
function resetForm(clear=true){$("personForm").reset();$("recordId").value="";$("formTitle").textContent="Ajouter un paroissien";$("save").textContent="Enregistrer";$("cancel").hidden=true;if(clear)$("formMsg").textContent="";}
function edit(p){$("recordId").value=p.id;fields.forEach(f=>$(f).value=p[f]||"");$("formTitle").textContent="Modifier un paroissien";$("save").textContent="Enregistrer les modifications";$("cancel").hidden=false;window.scrollTo({top:0,behavior:"smooth"});}
async function remove(p){if(profile?.role!=="cure"){alert("Suppression réservée au curé dans l’interface.");return;}if(!confirm(`Supprimer la fiche de ${p.nom} ${p.prenoms} ?`))return;const {error}=await db.from("paroissiens").delete().eq("id",p.id);if(error){alert("Suppression impossible.");return;}await load();}
function render(){
const q=$("search").value.trim().toLocaleLowerCase("fr");
const list=records.filter(p=>[p.numero_identification,p.nom,p.prenoms,p.telephone,p.village_quartier].some(v=>String(v||"").toLocaleLowerCase("fr").includes(q)));
$("count").textContent=list.length+" fiche(s) affichée(s)";$("rows").innerHTML="";
if(!list.length){$("rows").innerHTML="<tr><td colspan='5'>Aucun résultat.</td></tr>";return;}
list.forEach(p=>{const tr=document.createElement("tr");[p.numero_identification||"—",`${p.nom||""} ${p.prenoms||""}`.trim(),p.telephone||"—",p.village_quartier||"—"].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td);});
const td=document.createElement("td"),b=document.createElement("button");b.className="secondary tiny";b.textContent="Modifier";b.onclick=()=>edit(p);td.appendChild(b);
if(profile?.role==="cure"){const d=document.createElement("button");d.className="danger tiny";d.textContent="Supprimer";d.onclick=()=>remove(p);td.appendChild(d);}tr.appendChild(td);$("rows").appendChild(tr);});
}
function exportCsv(){
if(!records.length){alert("Aucune donnée à exporter.");return;}
const cols=["numero_identification",...fields,"date_inscription"],cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
const csv=[cols.map(cell).join(";"),...records.map(p=>cols.map(c=>cell(p[c])).join(";"))].join("\r\n");
const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="registre-paroissiens.csv";a.click();URL.revokeObjectURL(url);
}
})();
