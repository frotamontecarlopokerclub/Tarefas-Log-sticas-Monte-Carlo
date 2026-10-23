
(function(){
"use strict";

/* ---------- Constantes ---------- */
const TIPOS=["Transferência entre unidades","Retirada","Entrega","Abastecimento de estoque","Evento (montagem/desmontagem)","Remanejamento","Coleta em fornecedor","Outro"];
const PRIOS=[["normal","Normal"],["alta","Alta"],["urgente","Urgente"]];
const CANAIS=["WhatsApp","Telefone","E-mail","Pessoalmente","Pedido no sistema","Outro"];
const UNIDADES=["un","cx","kg","L","pct","fardo","peça","palete","engradado","barril"];
const LOCAL_TIPOS=["Clube","Restaurante","Centro de distribuição","Escritório","Prédio","Residência da chefia","Residência de funcionário","Fornecedor","Outro"];
const FUNCOES=["Motorista","Ajudante","Coordenador","Operador","Eletricista","Encanador","Técnico de refrigeração","Técnico de ar-condicionado","Pedreiro","Pintor","Marceneiro","Serralheiro","Manutenção geral","Supervisor de manutenção"];
const ST={registrada:"Registrada",agendada:"Agendada",em_rota:"Em rota",concluida:"Concluída",cancelada:"Cancelada"};
const ABERTOS=["registrada","agendada","em_rota"];
const MCATS=["Elétrica","Hidráulica","Ar-condicionado","Refrigeração","Cozinha industrial","Civil / alvenaria","Pintura","Marcenaria","Serralheria","Gerador / energia","Incêndio / segurança","Elevador","TI / telefonia","Jardinagem","Limpeza técnica","Outros"];
const MPRIOS=[["urgente","Urgente"],["alta","Alta"],["normal","Normal"],["baixa","Baixa"]];
const MPRIO_SOL=[["normal","Normal · pode ser nos próximos dias"],["alta","Alta · está atrapalhando o trabalho"],["urgente","Urgente · risco, vazamento ou parou a operação"],["baixa","Baixa · pode esperar"]];
const MST={aberto:"Chamado aberto",agendada:"Programada",em_execucao:"Em execução",aguardando:"Aguardando",concluida:"Concluída",cancelada:"Cancelada"};
const MABERTOS=["aberto","agendada","em_execucao","aguardando"];
const FREQS=[["semanal","Semanal",{d:7}],["quinzenal","Quinzenal",{d:14}],["mensal","Mensal",{m:1}],["bimestral","Bimestral",{m:2}],["trimestral","Trimestral",{m:3}],["semestral","Semestral",{m:6}],["anual","Anual",{m:12}]];
const SLA_PADRAO={urgente:4,alta:24,normal:72,baixa:168};
const CUSTO_TIPOS=["Peça","Material","Serviço de terceiro","Mão de obra","Outro"];
const ESPERAS=["Peça ou material","Orçamento","Prestador","Liberação do setor","Outro"];
const AREAS=[["logistica","Logística"],["manutencao","Manutenção"],["ambas","Logística e manutenção"]];

/* ---------- Estado ---------- */
const S={areaAcesso:"ambas",os:[],locais:[],setores:[],equipe:[],veiculos:[],config:{toleranciaMin:15},
  uid:null,role:null,meName:"",demo:false,loaded:{os:false},names:{},pedidos:[],meus:[],relatorios:[],perfis:[],recovery:false,authMsg:"",meuSetor:null,
  fromPedido:null,recusando:null,pTab:"aguardando",rm:null,copyOpen:false,recorrencias:[],solicitantes:[],meuTelefone:"",dupFrom:null,editRec:null,novaRec:false,recDel:null,
  route:"painel",openId:null,action:null,editId:null,routeArg:null,
  area:(()=>{try{return localStorage.getItem("mc-area")==="man"?"man":"log"}catch(e){return "log"}})(),
  manutencoes:[],equipamentos:[],prestadores:[],planos:[],missing:{},mOpen:null,mAct:null,mEditId:null,eqEdit:null,editEq:null,planEdit:null,planX:null,planDel:null,
  mlf:{status:"abertas",q:"",local:"",cat:"",tipo:""},mf:(()=>{try{return Object.assign({periodo:"30",local:"",cat:""},JSON.parse(localStorage.getItem("mc-man-f")||"{}"))}catch(e){return {periodo:"30",local:"",cat:""}}})(),ef:{q:"",local:"",cat:"",inativos:false},
  f:{periodo:"30",setor:"",local:""},
  lf:{status:"abertas",q:"",setor:"",local:"",tipo:""},cadTab:"locais",cadEdit:null};

const app=document.getElementById("app"),layer=document.getElementById("layer");

/* ---------- Utilidades ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const byId=(arr,id)=>arr.find(x=>x.id===id);
const nomeLocal=id=>(byId(S.locais,id)||{}).nome||"—";
const siglaLocal=l=>l?(l.sigla||l.nome):"";
const nomeSetor=id=>{const st=byId(S.setores,id);if(!st)return "—";const l=st.localId?byId(S.locais,st.localId):null;return st.nome+(l?" · "+siglaLocal(l):"")};
const ORDEM_SIGLA=["M.C.","M.G.","Doryo","Cardoso","CD 1"];
function gruposSetores(lista){
  const g=new Map();
  lista.forEach(st=>{const k=st.localId||"";if(!g.has(k))g.set(k,[]);g.get(k).push(st)});
  const chave=k=>{const l=byId(S.locais,k);const i=l?ORDEM_SIGLA.indexOf(l.sigla):-1;return [k?0:1,i<0?99:i,l?l.nome:"zzz"]};
  return [...g.entries()].sort((a,b)=>{const x=chave(a[0]),y=chave(b[0]);return x[0]-y[0]||x[1]-y[1]||String(x[2]).localeCompare(String(y[2]),"pt-BR")})
    .map(([k,arr])=>({local:byId(S.locais,k),itens:arr.sort(sortNome)}));
}
function optsSetores(sel,vazio,incluirId){
  const lista=S.setores.filter(x=>x.ativo!==false||x.id===sel||x.id===incluirId);
  return (vazio!=null?`<option value="">${esc(vazio)}</option>`:"")+gruposSetores(lista).map(gp=>`<optgroup label="${esc(gp.local?gp.local.nome+(gp.local.sigla&&gp.local.sigla!==gp.local.nome?" ("+gp.local.sigla+")":""):"Sem local")}">${gp.itens.map(x=>`<option value="${esc(x.id)}"${x.id===sel?" selected":""}>${esc(x.nome)}${gp.local?" · "+esc(siglaLocal(gp.local)):""}</option>`).join("")}</optgroup>`).join("");
}
const nomeVeic=id=>{const v=byId(S.veiculos,id);return v?(v.nome+(v.placa?" · "+v.placa:"")):"—"};
const nomeEquipe=ids=>(ids||[]).map(i=>(byId(S.equipe,i)||{}).nome).filter(Boolean).join(", ")||"—";
const T=iso=>iso?new Date(iso).getTime():NaN;
const pad=n=>String(n).padStart(2,"0");
const fData=iso=>{if(!iso)return"—";const d=new Date(iso);return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"})};
const fHora=iso=>{if(!iso)return"";const d=new Date(iso);return pad(d.getHours())+":"+pad(d.getMinutes())};
const fDH=iso=>iso?fData(iso)+" "+fHora(iso):"—";
const fDur=ms=>{if(!isFinite(ms)||ms<0)return"—";const m=Math.round(ms/60000);if(m<60)return m+" min";const h=Math.floor(m/60),r=m%60;if(h<24)return h+" h"+(r?" "+pad(r):"");const d=Math.floor(h/24);return d+" d "+(h%24)+" h"};
const toInput=iso=>{if(!iso)return"";const d=new Date(iso);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes())};
const fromInput=v=>v?new Date(v).toISOString():null;
const nowISO=()=>new Date().toISOString();
const dayKey=d=>{d=new Date(d);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
const codigo=o=>"OS-"+String(o.numero||0).padStart(4,"0");
const tolMs=()=>(Number(S.config.toleranciaMin)||0)*60000;
function prazo(o){return T(o.previstoAte)||((T(o.agendadoPara)||NaN)+2*3600000)}
function atrasada(o){ // aberta e passou do prazo
  if(!ABERTOS.includes(o.status))return false;const p=prazo(o);return isFinite(p)&&Date.now()>p+tolMs()}
function concluidaComAtraso(o){if(o.status!=="concluida")return false;const p=prazo(o);return isFinite(p)&&T(o.concluidoEm)>p+tolMs()}
function tResposta(o){const a=T(o.agendadaEm),s=T(o.solicitadoEm||o.criadoEm);return a-s}
function tExec(o){return T(o.concluidoEm)-T(o.iniciadoEm)}
function rotaTxt(o){return nomeLocal(o.origemId)+" → "+nomeLocal(o.destinoId)}
function toast(msg){$$(".toast").forEach(x=>x.remove());const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
function sortNome(a,b){return (a.nome||"").localeCompare(b.nome||"","pt-BR")}
const ativos=arr=>arr.filter(x=>x.ativo!==false).sort(sortNome);

/* ---------- Dados (Supabase) ---------- */
const CFG=window.MC_CONFIG||{};
let sb=null;
const camel=k=>k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const snake=k=>k.replace(/[A-Z]/g,c=>"_"+c.toLowerCase());
function fromDb(r){const o={};for(const k in r)o[camel(k)]=r[k];return o}
function toDb(o){const r={};for(const k in o){let v=o[k];if(v===undefined)continue;if(/Id$/.test(k)&&v==="")v=null;r[snake(k)]=v}return r}
const novoId=()=>(crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
const PAPEL_ROLE={logistica:"log",setor:"sol",leitura:"ver"};

async function boot(){
  try{ const ls=localStorage.getItem("mc-log-f"); if(ls) Object.assign(S.f,JSON.parse(ls)); }catch(e){}
  if(!CFG.supabaseUrl||!CFG.supabaseAnonKey||!window.supabase){ S.demo=true; S.role="log"; loadDemo(); buildNav(); route(); return; }
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
  sb.auth.onAuthStateChange((ev)=>{
    if(ev==="PASSWORD_RECOVERY"){ S.recovery=true; renderAuth("nova-senha"); }
    if(ev==="SIGNED_OUT"){ location.hash=""; location.reload(); }
  });
  const {data:{session}}=await sb.auth.getSession();
  if(S.recovery) return;
  if(/type=recovery/.test(location.hash)) return;
  if(!session) return renderAuth("entrar");
  await startSession(session);
}
async function startSession(session){
  S.uid=session.user.id;
  let perfil=null;
  for(let i=0;i<3&&!perfil;i++){ const r=await sb.from("perfis").select("*").eq("id",S.uid).maybeSingle(); perfil=r.data; if(!perfil) await new Promise(r=>setTimeout(r,600)); }
  if(!perfil) return renderAuth("pendente");
  S.meName=perfil.nome||session.user.email; S.meuSetor=perfil.setor_id; S.meuTelefone=perfil.telefone||""; S.podeLocal=perfil.pode_cadastrar_local===true; S.areaAcesso=perfil.area_acesso||"ambas";
  if(!PAPEL_ROLE[perfil.papel]) return renderAuth(perfil.papel==="bloqueado"?"bloqueado":"pendente");
  S.role=PAPEL_ROLE[perfil.papel];
  if(areaFixa()) S.area=areaFixa();
  document.body.classList.remove("auth");
  buildNav(); if(!location.hash||location.hash.length<2) location.replace("#"+navCfg().home); route();
  await Promise.all(["locais","setores","equipe","veiculos","config","os","pedidos","relatorios","perfis","recorrencias","solicitantes","manutencoes","equipamentos","prestadores","planos"].map(carregar));
  buildNav(); render();
  if(isLog()) gerarRecorrentes(); if(isMan()) gerarPreventivas();
  assinarTempoReal();
}
async function carregar(t){
  let q=sb.from(t).select("*");
  if(t==="os") q=q.order("criado_em",{ascending:false}).limit(3000);
  if(t==="pedidos") q=q.order("criado_em",{ascending:false}).limit(1000);
  if(t==="manutencoes") q=q.order("criado_em",{ascending:false}).limit(3000);
  const {data,error}=await q;
  if(error){ console.warn(t,error); if(error.code==="42P01"||error.code==="PGRST205"||/does not exist|schema cache|Could not find the table/i.test(error.message||"")) S.missing[t]=true; return; }
  S.missing[t]=false;
  if(t==="config"){ const c=data[0]; if(c) S.config={toleranciaMin:c.tolerancia_min,checklist:Array.isArray(c.checklist)?c.checklist:null,whatsappAuto:c.whatsapp_auto===true,slaMan:c.sla_manutencao&&typeof c.sla_manutencao==="object"?c.sla_manutencao:null}; return; }
  if(t==="perfis"){ S.perfis=data.map(fromDb); S.perfis.forEach(p=>S.names[p.id]=p.nome||p.email||""); return; }
  if(t==="pedidos"){ const l=data.map(r=>{const p=fromDb(r);p.pid=p.id;p.uid=p.solicitanteId;return p});
    if(isLog()){S.pedidos=l;S.loaded.pedidos=true} else {S.meus=l.filter(p=>p.uid===S.uid);S.loaded.meus=true} return; }
  S[t]=data.map(fromDb); S.loaded[t]=true;
}
const recarga={};
function assinarTempoReal(){
  sb.channel("logistica-mc").on("postgres_changes",{event:"*",schema:"public"},pl=>{
    const t=pl.table; clearTimeout(recarga[t]);
    recarga[t]=setTimeout(async()=>{ await carregar(t); if(t==="pedidos"||t==="perfis") buildNav(); if(t==="recorrencias"&&isLog()) gerarRecorrentes(); if(t==="planos"&&isMan()) gerarPreventivas(); if(t==="perfis"){const me=S.perfis.find(x=>x.id===S.uid);if(me&&(me.areaAcesso||"ambas")!==S.areaAcesso){location.reload();return}} if(t==="manutencoes") buildNav(); render(); },250);
  }).subscribe();
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&sb) Promise.all(["os","pedidos","manutencoes"].map(carregar)).then(()=>{buildNav();render()}); });
}
async function sair(){ if(sb) await sb.auth.signOut(); else location.reload(); }

function localUpsertOS(id,data){const i=S.os.findIndex(o=>o.id===id); if(i>=0)S.os[i]=Object.assign({},S.os[i],data); else S.os.unshift(Object.assign({id},data));}
async function saveOS(id,data){
  if(S.demo){ localUpsertOS(id,data); render(); return Object.assign({id},data); }
  const ex=S.os.some(o=>o.id===id);
  if(ex){ const {error}=await sb.from("os").update(toDb(data)).eq("id",id); if(error) throw error; localUpsertOS(id,data); render(); return byId(S.os,id); }
  const {data:row,error}=await sb.from("os").insert(toDb(Object.assign({id},data))).select().single(); if(error) throw error;
  const o=fromDb(row); localUpsertOS(id,o); render(); return o;
}
function hist(o,s,nota){return (o.historico||[]).concat([{s,em:nowISO(),por:S.uid||null,nota:nota||""}])}
async function resolveNames(){ /* nomes vêm da tabela de perfis */ }

/* ---------- Telas de acesso ---------- */
function renderAuth(mode){
  document.body.classList.add("auth"); S.role=null;
  const err=`<p class="err" id="aErr" role="alert"></p>`;
  const card=(t,p,body)=>`<div class="auth-wrap"><section class="auth-card"><h1>${t}</h1>${p?`<p class="auth-p">${p}</p>`:""}${body}</section></div>`;
  let h="";
  if(mode==="entrar") h=card("Entrar","Ordens de serviço de logística e manutenção do Grupo.",`<form id="aF" class="auth-f" novalidate>
      <div class="field"><label for="aEm">E-mail</label><input type="email" id="aEm" autocomplete="username" required></div>
      <div class="field"><label for="aPw">Senha</label><input type="password" id="aPw" autocomplete="current-password" required></div>${err}
      <button class="btn pri" type="submit" id="aOk">Entrar</button></form>
      <div class="auth-links"><button class="lnk" data-auth="criar" type="button">Criar conta</button><button class="lnk" data-auth="esqueci" type="button">Esqueci minha senha</button></div>`);
  if(mode==="criar") h=card("Criar conta","Depois do cadastro, a coordenação de Facilities libera o seu acesso.",`<form id="aF" class="auth-f" novalidate>
      <div class="field"><label for="aNm">Nome completo</label><input type="text" id="aNm" autocomplete="name" required></div>
      <div class="field"><label for="aEm">E-mail</label><input type="email" id="aEm" autocomplete="username" required></div>
      <div class="field"><label for="aPw">Senha</label><input type="password" id="aPw" autocomplete="new-password" minlength="8" required><span class="hint">Mínimo de 8 caracteres</span></div>${err}
      <button class="btn pri" type="submit" id="aOk">Criar conta</button></form>
      <div class="auth-links"><button class="lnk" data-auth="entrar" type="button">Já tenho conta</button></div>`);
  if(mode==="esqueci") h=card("Recuperar senha","Informe seu e-mail. Enviaremos um link para você criar uma nova senha.",`<form id="aF" class="auth-f" novalidate>
      <div class="field"><label for="aEm">E-mail</label><input type="email" id="aEm" autocomplete="username" required></div>${err}
      <button class="btn pri" type="submit" id="aOk">Enviar link</button></form>
      <div class="auth-links"><button class="lnk" data-auth="entrar" type="button">Voltar para entrar</button></div>`);
  if(mode==="nova-senha") h=card("Nova senha","Escolha uma nova senha para entrar no sistema.",`<form id="aF" class="auth-f" novalidate>
      <div class="field"><label for="aPw">Nova senha</label><input type="password" id="aPw" autocomplete="new-password" minlength="8" required><span class="hint">Mínimo de 8 caracteres</span></div>${err}
      <button class="btn pri" type="submit" id="aOk">Salvar nova senha</button></form>`);
  if(mode==="enviado") h=card("Confira seu e-mail",S.authMsg||"",`<div class="auth-links"><button class="lnk" data-auth="entrar" type="button">Voltar para entrar</button></div>`);
  if(mode==="pendente") h=card("Cadastro recebido","Seu acesso aguarda liberação da coordenação de Facilities. Avise a coordenação e tente de novo depois.",`<div class="auth-f"><button class="btn pri" id="aRe" type="button">Verificar de novo</button><button class="btn" id="aOut" type="button">Sair</button></div>`);
  if(mode==="bloqueado") h=card("Acesso bloqueado","Seu acesso a este sistema foi bloqueado. Fale com a coordenação de Facilities.",`<div class="auth-f"><button class="btn" id="aOut" type="button">Sair</button></div>`);
  app.innerHTML=h;
  $$("[data-auth]").forEach(b=>b.onclick=()=>renderAuth(b.dataset.auth));
  const out=$("#aOut");if(out)out.onclick=sair;
  const re=$("#aRe");if(re)re.onclick=async()=>{const {data:{session}}=await sb.auth.getSession();if(session)startSession(session);else renderAuth("entrar")};
  const f=$("#aF"); if(!f) return; const fe=$("#aEm"); if(fe) fe.focus();
  const msg=e=>{const m=(e&&e.message)||"";
    if(/Invalid login/i.test(m))return "E-mail ou senha incorretos.";
    if(/not confirmed/i.test(m))return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if(/already registered|already been registered/i.test(m))return "Este e-mail já tem cadastro. Use Entrar ou Esqueci minha senha.";
    if(/at least|weak/i.test(m))return "A senha precisa ter pelo menos 8 caracteres.";
    if(/rate limit|security purposes/i.test(m))return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    return "Não foi possível concluir. Verifique os dados e a conexão.";};
  f.onsubmit=async ev=>{ev.preventDefault();const b=$("#aOk"),E=$("#aErr");E.textContent="";
    const em=($("#aEm")||{}).value?.trim(),pw=($("#aPw")||{}).value||"";
    if(fe&&!/^\S+@\S+\.\S+$/.test(em)){E.textContent="Informe um e-mail válido.";return}
    if(mode!=="esqueci"&&mode!=="entrar"&&pw.length<8){E.textContent="A senha precisa ter pelo menos 8 caracteres.";return}
    b.disabled=true;
    try{
      if(mode==="entrar"){const {data,error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)throw error;await startSession(data.session);}
      if(mode==="criar"){const nm=$("#aNm").value.trim();if(!nm){E.textContent="Informe seu nome.";b.disabled=false;return}
        const {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{nome:nm},emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
        if(data.session) await startSession(data.session); else {S.authMsg="Enviamos um link de confirmação para "+em+". Abra o e-mail, confirme o cadastro e depois entre no sistema.";renderAuth("enviado");}}
      if(mode==="esqueci"){const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});if(error)throw error;
        S.authMsg="Se houver um cadastro com "+em+", você vai receber um link para criar uma nova senha.";renderAuth("enviado");}
      if(mode==="nova-senha"){const {data,error}=await sb.auth.updateUser({password:pw});if(error)throw error;S.recovery=false;history.replaceState(null,"",location.pathname);
        toast("Senha alterada");const {data:{session}}=await sb.auth.getSession();await startSession(session);}
    }catch(e){console.warn(e);E.textContent=msg(e);b.disabled=false;}
  };
}

/* ---------- Usuários (cadastro de acessos) ---------- */
const PAPEIS=[["pendente","Aguardando liberação"],["logistica","Facilities · equipe"],["setor","Solicitante (pedidos e chamados)"],["leitura","Somente leitura"],["bloqueado","Bloqueado"]];
function renderUsuarios(){
  const ps=(S.perfis||[]).slice().sort((a,b)=>((a.papel!=="pendente")-(b.papel!=="pendente"))||(a.nome||"").localeCompare(b.nome||"","pt-BR"));
  return `<section class="card"><div class="card-h"><h2>Usuários</h2><span class="sub">Quem se cadastra fica aguardando até a coordenação liberar</span></div><div class="card-b">
    <p style="margin:0 0 10px;color:var(--mute);max-width:72ch">Facilities · equipe opera as OS. Na coluna de área, escolha <b>Só logística</b> para motoristas e ajudantes, <b>Só manutenção</b> para técnicos, ou <b>As duas áreas</b> para a coordenação. Só quem tem as duas áreas administra os usuários. Solicitante faz pedidos à logística, abre chamados de manutenção e acompanha os seus. Marque “Cadastra fornecedor” para que ele possa incluir um fornecedor novo direto no pedido. Somente leitura vê OS e painel, mas não faz pedidos.</p>
    ${S.demo?`<p style="color:var(--mute)">No modo demonstração não há usuários.</p>`:""}
    ${ps.map(p=>`<div class="usr-row${p.papel==="bloqueado"?" off":""}"><span class="n">${esc(p.nome||"Sem nome")}${p.id===S.uid?' <span style="color:var(--faint);font-weight:500">você</span>':""}</span>
      <span class="m">${esc(p.email||"")}</span>
      <select id="pp-${esc(p.id)}" aria-label="Acesso de ${esc(p.nome||"")}"${p.id===S.uid?" disabled":""}>${optsS(PAPEIS,p.papel)}</select>
      <select id="pa-${esc(p.id)}" aria-label="Área de ${esc(p.nome||"")}" title="Área de atuação na equipe de Facilities"${p.id===S.uid||p.papel!=="logistica"?" disabled":""}>${optsS(AREAS_ACESSO,p.papel==="logistica"?(p.areaAcesso||"ambas"):"ambas")}</select>
      <select id="ps-${esc(p.id)}" aria-label="Setor de ${esc(p.nome||"")}"${p.id===S.uid?" disabled":""}>${optsSetores(p.setorId||"","Sem setor")}</select>
      <label class="chk sm" title="Pode cadastrar fornecedor novo ao fazer pedido"><input type="checkbox" id="pl-${esc(p.id)}"${p.papel==="logistica"||p.podeCadastrarLocal?" checked":""}${p.papel!=="setor"||p.id===S.uid?" disabled":""}> Cadastra fornecedor</label>
      ${p.id===S.uid?"<span></span>":`<button class="btn sm pri" data-pp="${esc(p.id)}" type="button">Salvar</button>`}</div>`).join("")}
  </div></section>`;
}
function bindUsuarios(){
  $$("[id^='pp-']").forEach(sel=>sel.addEventListener("change",()=>{const id=sel.id.slice(3);const ar=$("#pa-"+id);if(ar){ar.disabled=sel.value!=="logistica";if(sel.value!=="logistica")ar.value="ambas"}const c=$("#pl-"+id);if(!c)return;c.disabled=sel.value!=="setor";if(sel.value==="logistica")c.checked=true;else if(sel.value!=="setor")c.checked=false}));
  $$("[data-pp]").forEach(b=>b.onclick=async()=>{const id=b.dataset.pp;b.disabled=true;
    const papel=$("#pp-"+id).value;
    const area=papel==="logistica"?$("#pa-"+id).value:"ambas";
    let {error}=await sb.rpc("definir_acesso_area",{alvo:id,novo_papel:papel,novo_setor:$("#ps-"+id).value||null,pode_local:papel==="setor"&&$("#pl-"+id).checked,nova_area:area});
    if(error&&/definir_acesso_area|schema cache|Could not find the function/i.test(error.message||"")){ ({error}=await sb.rpc("definir_acesso",{alvo:id,novo_papel:papel,novo_setor:$("#ps-"+id).value||null,pode_local:papel==="setor"&&$("#pl-"+id).checked})); if(!error&&area!=="ambas") toast("Rode o script 09 no Supabase para salvar a área."); }
    if(error&&/definir_acesso|function|schema cache/i.test(error.message||"")){ ({error}=await sb.rpc("definir_papel",{alvo:id,novo_papel:papel,novo_setor:$("#ps-"+id).value||null})); if(!error) toast("Rode o script 06 no Supabase para salvar a permissão de fornecedor."); }
    b.disabled=false; if(error){toast(error.message||"Não foi possível salvar.");return} await carregar("perfis"); buildNav(); toast("Acesso atualizado"); renderCadastros();});
}

const AREAS_ACESSO=[["ambas","As duas áreas"],["logistica","Só logística"],["manutencao","Só manutenção"]];
function isStaff(){return S.role==="log"}
function isLog(){return S.role==="log"&&S.areaAcesso!=="manutencao"}
function isMan(){return S.role==="log"&&S.areaAcesso!=="logistica"}
function isAdmin(){return S.role==="log"&&S.areaAcesso==="ambas"}
function areaFixa(){return S.role!=="log"?null:S.areaAcesso==="logistica"?"log":S.areaAcesso==="manutencao"?"man":null}
const LABELS={painel:"Painel",ordens:"Ordens",pedidos:"Pedidos",agenda:"Agenda",relatorio:"Relatório",cadastros:"Cadastros",nova:"Nova OS",solicitar:"Novo pedido",meus:"Meus pedidos",
  "m-painel":"Painel","m-ordens":"Chamados e OS","m-prev":"Preventivas","m-equip":"Equipamentos","m-nova":"Nova OS","m-chamado":"Abrir chamado","m-meus":"Meus chamados","m-eq":"Equipamento"};
const ICO={painel:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',ordens:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',pedidos:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  relatorio:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 17v-4M12 17V8M16 17v-6"/>',cadastros:'<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  meus:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',sair:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',mais:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  prev:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  equip:'<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3"/>'};
Object.assign(ICO,{"m-painel":ICO.painel,"m-ordens":ICO.wrench,"m-prev":ICO.prev,"m-equip":ICO.equip,"m-meus":ICO.meus,"m-eq":ICO.equip});
const svgI=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
function navCfg(){
  if(S.area==="man"){
    if(S.role==="log")return {top:["m-painel","m-ordens","m-prev","m-equip","cadastros"],cta:"m-nova",mob:["m-painel","m-ordens","m-nova","m-prev"],more:["m-equip","cadastros"],home:"m-ordens"};
    if(S.role==="sol")return {top:["m-meus","m-equip"],cta:"m-chamado",mob:["m-meus","m-chamado","m-equip"],more:[],home:"m-meus"};
    return {top:["m-painel","m-ordens","m-prev","m-equip"],cta:null,mob:["m-painel","m-ordens","m-prev","m-equip"],more:[],home:"m-painel"};
  }
  if(S.role==="log")return {top:["painel","ordens","pedidos","agenda","relatorio","cadastros"],cta:"nova",mob:["painel","ordens","nova","agenda"],more:["pedidos","relatorio","cadastros"],home:"painel"};
  if(S.role==="sol")return {top:["meus","ordens","agenda","painel","relatorio"],cta:"solicitar",mob:["meus","ordens","solicitar","painel"],more:["agenda","relatorio"],home:"meus"};
  return {top:["painel","ordens","agenda","relatorio"],cta:null,mob:["painel","ordens","agenda","relatorio"],more:[],home:"painel"};
}
const pendentes=()=>S.pedidos.filter(x=>x.status==="aguardando").length;
const chamadosNovos=()=>isMan()?S.manutencoes.filter(m=>m.status==="aberto").length:0;
const usuariosPendentes=()=>isAdmin()?(S.perfis||[]).filter(p=>p.papel==="pendente").length:0;
function buildNav(){
  const c=navCfg(),pd=pendentes(),up=usuariosPendentes(),cn=chamadosNovos(),bd=r=>r==="pedidos"&&pd?`<span class="bdg">${pd}</span>`:r==="m-ordens"&&cn?`<span class="bdg" title="Chamados aguardando triagem">${cn}</span>`:r==="cadastros"&&up?`<span class="bdg" title="Usuários aguardando liberação">${up}</span>`:"";
  const sw=$("#areaSw");if(sw){sw.innerHTML=S.role&&!areaFixa()?`<button type="button" data-area="log" aria-pressed="${S.area!=="man"}">Logística${S.area==="man"&&pd?` <span class="bdg">${pd}</span>`:""}</button><button type="button" data-area="man" aria-pressed="${S.area==="man"}">Manutenção${S.area!=="man"&&cn?` <span class="bdg">${cn}</span>`:""}</button>`:"";
    $$("[data-area]",sw).forEach(b=>b.onclick=()=>{if(S.area===b.dataset.area)return;S.area=b.dataset.area;try{localStorage.setItem("mc-area",S.area)}catch(e){}const h="#"+navCfg().home;buildNav();if(location.hash===h)route();else location.hash=h;});}
  $("#topnav").innerHTML=c.top.map(r=>`<a href="#${r}" data-r="${r}">${LABELS[r]}${bd(r)}</a>`).join("")+(c.cta?`<a href="#${c.cta}" class="btn-new" data-r="${c.cta}">${LABELS[c.cta]}</a>`:"")+(S.demo?"":`<button class="who" id="sairTop" type="button" title="Sair do sistema">${esc(S.meName)} · Sair</button>`);
  const LM=Object.assign({},LABELS,{meus:"Pedidos",solicitar:"Pedir","m-ordens":"Chamados","m-equip":"Equip.","m-chamado":"Chamado","m-meus":"Chamados"});
  const mob=c.mob.map(r=>r===c.cta?`<a href="#${r}" data-r="${r}" class="new"><span class="c">${svgI("plus")}</span>${LM[r]}</a>`:`<a href="#${r}" data-r="${r}">${svgI(r)}${LM[r]}${bd(r)}</a>`);
  if(c.more.length||!S.demo) mob.push(`<button type="button" id="maisB">${svgI("mais")}Mais${(c.more.includes("pedidos")&&pd)||up?`<span class="bdg">${(c.more.includes("pedidos")?pd:0)+up}</span>`:""}</button>`);
  const st=$("#sairTop");if(st)st.onclick=sair;
  const bn=$("#bnav");bn.innerHTML=mob.join("");bn.style.setProperty("--n",mob.length);
  const mb=$("#maisB");if(mb)mb.onclick=()=>{
    $("#sheetL").innerHTML=`<div class="sheet" id="sh"><div class="sheet-in" role="menu">${c.more.map(r=>`<a href="#${r}" role="menuitem">${svgI(r)}${LABELS[r]}${bd(r)}</a>`).join("")}${S.demo?"":`<a href="#" role="menuitem" id="sairM">${svgI("sair")}Sair${S.meName?` <span class="sub-n">${esc(S.meName)}</span>`:""}</a>`}</div></div>`;
    $("#sh").onclick=e=>{if(e.target.closest("#sairM")){e.preventDefault();sair();return}$("#sheetL").innerHTML=""};};
  markNav();
}
function markNav(){const c=navCfg();$$("[data-r]").forEach(a=>a.setAttribute("aria-current",a.dataset.r===S.route?"page":"false"));const mb=$("#maisB");if(mb)mb.setAttribute("aria-current",c.more.includes(S.route)&&!c.mob.includes(S.route)?"page":"false")}



/* ---------- Roteamento ---------- */
const ROTAS_LOG=["painel","ordens","pedidos","agenda","relatorio","nova","solicitar","meus"];
function route(){
  const hh=(location.hash||"").slice(1);const [h0,arg]=hh.split("/");let h=h0||"";
  if(document.body.classList.contains("auth")) return;
  if(!S.role){S.route=h||"painel";render(true);return}
  let novaArea=h.startsWith("m-")?"man":ROTAS_LOG.includes(h)?"log":null;
  let bloq=false;if(areaFixa()&&novaArea&&novaArea!==areaFixa()){novaArea=null;h="";bloq=true}
  if(novaArea&&novaArea!==S.area){S.area=novaArea;try{localStorage.setItem("mc-area",S.area)}catch(e){}buildNav()}
  if(h==="m-chamado"&&isMan())h="m-nova";
  const c=navCfg();const ok=c.top.concat(c.more,c.mob,c.cta?[c.cta]:[],["m-eq"]);
  S.route=ok.includes(h)?h:c.home; S.routeArg=ok.includes(h)?(arg||null):null;
  if(bloq){try{history.replaceState(null,"","#"+S.route)}catch(e){}}
  $("#sheetL").innerHTML="";
  markNav();
  render(true); window.scrollTo(0,0);
}
window.addEventListener("hashchange",()=>{ if(S.openId||S.mOpen)closeOS(); if(location.hash!=="#nova"){S.editId=null;S.fromPedido=null;S.dupFrom=null;S.editRec=null;S.novaRec=false} if(location.hash!=="#m-nova")S.mEditId=null; S.eqEdit=null;S.editEq=null;S.planEdit=null;S.planDel=null; route(); });

/* ---------- Render principal ---------- */
let formMounted=false;
function render(force){
  if(document.body.classList.contains("auth")) return;
  if(!S.role&&!S.demo){app.innerHTML=`<div class="empty"><h3>Conectando…</h3><p>Carregando o sistema de Facilities.</p></div>`;return}
  if(S.route==="nova"||S.route==="solicitar"){ if(force||!formMounted){ S.route==="nova"?renderForm():renderSolicitar(); formMounted=true; } else (S.route==="nova"?refreshFormOptions:refreshPedOptions)(); }
  else if(S.route==="m-nova"||S.route==="m-chamado"){ if(force||!formMounted){ S.route==="m-nova"?renderMNova():renderMChamado(); formMounted=true; } else refreshPickers(); }
  else { formMounted=false;
    const fn={painel:renderPainel,ordens:renderOrdens,agenda:renderAgenda,cadastros:renderCadastros,pedidos:renderPedidos,meus:renderMeus,relatorio:renderRelatorio,
      "m-painel":renderMPainel,"m-ordens":renderMOrdens,"m-prev":renderMPrev,"m-equip":renderMEquip,"m-eq":renderMEq,"m-meus":renderMMeus}[S.route]||renderPainel;
    // preserva foco em campos de busca
    const ae=document.activeElement, aid=ae&&ae.id, pos=ae&&ae.selectionStart;
    if(!force&&((S.route==="cadastros"&&S.cadEdit)||(S.route==="pedidos"&&S.recusando)||(S.route==="m-equip"&&S.eqEdit)||(S.route==="m-prev"&&S.planEdit)||(S.route==="m-eq"&&S.editEq))) { /* não redesenha durante edição */ }
    else fn();
    if(aid){const el=document.getElementById(aid); if(el&&el!==ae){el.focus(); try{if(pos!=null)el.setSelectionRange(pos,pos)}catch(e){}}}
  }
  if(S.openId&&!S.action) renderDrawer();
  if(S.mOpen&&!S.mAct) renderMDrawer();
}
function banner(){
  if(S.demo) return `<div class="banner"><b>Modo demonstração.</b> O arquivo config.js ainda não tem o endereço e a chave do Supabase. Os dados abaixo são exemplos e não são salvos.
    <span class="demo-roles">Ver como: ${[["log:ambas","Coordenação"],["log:logistica","Equipe logística"],["log:manutencao","Equipe manutenção"],["sol:ambas","Solicitante"],["ver:ambas","Leitura"]].map(([k,l])=>`<button type="button" class="btn sm${S.role+":"+S.areaAcesso===k?" pri":""}" data-demorole="${k}">${l}</button>`).join("")}</span></div>`;
  if(S.role==="ver") return `<div class="banner"><b>Somente leitura.</b> Seu acesso permite consultar as OS e os indicadores. Para fazer pedidos e abrir chamados, peça à coordenação o acesso de Solicitante.</div>`;
  return "";
}
function loading(){ return !S.demo && !S.loaded.os ? `<div class="empty"><h3>Carregando ordens de serviço…</h3><p>Buscando os dados no servidor.</p></div>` : null }

/* ---------- Filtro de período (painel) ---------- */
function periodRange(p){
  const now=new Date(); let a,b=new Date(now.getTime()+86400000*365);
  const sod=d=>{d=new Date(d);d.setHours(0,0,0,0);return d};
  if(p==="hoje"){a=sod(now);b=new Date(a.getTime()+86400000)}
  else if(p==="mes"){a=new Date(now.getFullYear(),now.getMonth(),1);b=new Date(now.getFullYear(),now.getMonth()+1,1)}
  else if(p==="mesant"){a=new Date(now.getFullYear(),now.getMonth()-1,1);b=new Date(now.getFullYear(),now.getMonth(),1)}
  else if(p==="ano"){a=new Date(now.getFullYear(),0,1);b=new Date(now.getFullYear()+1,0,1)}
  else {const n=Number(p)||30; a=sod(new Date(now.getTime()-(n-1)*86400000)); b=new Date(sod(now).getTime()+86400000)}
  return [a,b];
}
const refDate=o=>o.solicitadoEm||o.criadoEm||o.agendadoPara;
function inPainel(o){
  const [a,b]=periodRange(S.f.periodo); const t=T(refDate(o));
  if(!(t>=a.getTime()&&t<b.getTime()))return false;
  if(S.f.setor&&o.setorId!==S.f.setor)return false;
  if(S.f.local&&o.origemId!==S.f.local&&o.destinoId!==S.f.local)return false;
  return true;
}
function opts(arr,sel,empty){return (empty!=null?`<option value="">${esc(empty)}</option>`:"")+arr.map(x=>`<option value="${esc(x.id)}"${x.id===sel?" selected":""}>${esc(x.nome)}</option>`).join("")}
function optsS(arr,sel){return arr.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}"${v===sel?" selected":""}>${esc(l)}</option>`}).join("")}

/* ---------- PAINEL ---------- */
function avg(a){a=a.filter(x=>isFinite(x)&&x>=0);return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN}
function groupCount(list,keyFn){const m=new Map();list.forEach(o=>{const ks=[].concat(keyFn(o)).filter(Boolean);ks.forEach(k=>m.set(k,(m.get(k)||[]).concat([o])))});return [...m.entries()].sort((a,b)=>b[1].length-a[1].length)}

function renderPainel(){
  const L=loading();
  const perOpts=[["hoje","Hoje"],["7","Últimos 7 dias"],["30","Últimos 30 dias"],["mes","Este mês"],["mesant","Mês anterior"],["90","Últimos 90 dias"],["ano","Este ano"]];
  const list=S.os.filter(inPainel);
  const val=list.filter(o=>o.status!=="cancelada");
  const conc=val.filter(o=>o.status==="concluida");
  const abertasAgora=S.os.filter(o=>ABERTOS.includes(o.status));
  const atrasAgora=abertasAgora.filter(atrasada);
  const noPrazo=conc.filter(o=>!concluidaComAtraso(o)&&isFinite(prazo(o)));
  const comPrazo=conc.filter(o=>isFinite(prazo(o)));
  const pct=comPrazo.length?Math.round(noPrazo.length/comPrazo.length*100):null;
  const tr=avg(val.map(tResposta)), te=avg(conc.map(tExec));
  const canc=list.filter(o=>o.status==="cancelada").length;

  let h=`<div class="head"><div><h1>Painel da <em>logística</em></h1><p>Demanda, prazos e tempos de atendimento das movimentações entre as unidades do Grupo.</p></div>
  <div class="act"><button class="btn" id="exp" type="button">Exportar CSV</button></div></div>${banner()}
  <div class="filters">
    <div class="field"><label for="fPer">Período</label><select id="fPer">${optsS(perOpts,S.f.periodo)}</select></div>
    <div class="field"><label for="fSet">Setor solicitante</label><select id="fSet">${optsSetores(S.f.setor,"Todos os setores")}</select></div>
    <div class="field"><label for="fLoc">Unidade (origem ou destino)</label><select id="fLoc">${opts(ativos(S.locais),S.f.local,"Todas as unidades")}</select></div>
  </div>`;
  if(L){app.innerHTML=h+L;bindPainel();return}

  h+=`<div class="kpis">
    ${kpi("OS no período",val.length,"",canc?canc+" cancelada"+(canc>1?"s":""):"Sem cancelamentos")}
    ${kpi("Concluídas",conc.length,"",val.length?Math.round(conc.length/val.length*100)+"% do período":"—")}
    ${kpi("Em aberto agora",abertasAgora.length,"",countSt(abertasAgora))}
    ${kpi("Atrasadas agora",atrasAgora.length,"","Passaram da previsão de término",atrasAgora.length?"alert":"")}
    ${kpi("Concluídas no prazo",pct==null?"—":pct,pct==null?"":"%",comPrazo.length?noPrazo.length+" de "+comPrazo.length+" OS":"Sem conclusões no período",pct!=null&&pct>=90?"good":(pct!=null&&pct<75?"alert":""))}
    ${kpi("Tempo de resposta",durNum(tr),durUnit(tr),"Do pedido ao agendamento")}
    ${kpi("Tempo de execução",durNum(te),durUnit(te),"Da saída à conclusão com foto")}
    ${(()=>{const kmT=conc.reduce((s2,o)=>s2+(kmRodados(o)||0),0);const comKm=conc.filter(o=>kmRodados(o)!=null).length;return kpi("Km rodados",kmT?kmT.toLocaleString("pt-BR"):"0","km",comKm?comKm+(comKm>1?" missões":" missão")+" com km · média "+fKm(Math.round(kmT/comKm)):"Sem missões com km no período")})()}
  </div>`;

  if(!val.length){
    h+=`<div class="empty"><h3>Nenhuma OS neste período</h3><p>Quando a logística registrar as primeiras ordens de serviço, os indicadores aparecem aqui.${isLog()?' <a href="#nova">Registrar a primeira OS</a>.':""}</p></div>`;
    app.innerHTML=h;bindPainel();return;
  }

  // por dia
  const [a,b]=periodRange(S.f.periodo);
  const days=[];const endT=Math.min(b.getTime(),Date.now()+7*86400000);const startT=Math.max(a.getTime(),endT-120*86400000);
  const ndays=Math.max(Math.round((endT-startT)/86400000),1);
  for(let i=0;i<ndays;i++){const d=new Date(startT+i*86400000+3600000);days.push(dayKey(d))}
  const cnt={};val.forEach(o=>{const k=dayKey(refDate(o));cnt[k]=(cnt[k]||0)+1});
  const series=days.map(k=>({k,v:cnt[k]||0}));

  h+=`<div class="grid3">
    <section class="card span2"><div class="card-h"><h2>Ordens por dia</h2><span class="sub">pela data do pedido</span></div><div class="card-b"><div class="chart" id="chDia"></div></div></section>
    <section class="card"><div class="card-h"><h2>Situação das OS</h2><span class="sub">${val.length} no período</span></div><div class="card-b">${statusSplit(list)}</div></section>
  </div>`;

  const porSetor=groupCount(val,o=>o.setorId);
  const porTipo=groupCount(val,o=>o.tipo);
  h+=`<div class="grid2">
    <section class="card"><div class="card-h"><h2>Setores solicitantes</h2><span class="sub">OS · tempo médio de resposta</span></div><div class="card-b">${hbars(porSetor.slice(0,10).map(([k,l])=>({n:nomeSetor(k),v:l.length,x:fDur(avg(l.map(tResposta)))})))}</div></section>
    <section class="card"><div class="card-h"><h2>Tipos de serviço</h2><span class="sub">OS · tempo médio de execução</span></div><div class="card-b">${hbars(porTipo.map(([k,l])=>({n:k,v:l.length,x:fDur(avg(l.filter(o=>o.status==="concluida").map(tExec)))})))}</div></section>
  </div>`;

  const rotas=groupCount(val,o=>o.origemId+"|"+o.destinoId).slice(0,8);
  h+=`<section class="card" style="margin-bottom:16px"><div class="card-h"><h2>Rotas mais frequentes</h2><span class="sub">origem → destino</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Rota</th><th class="r">OS</th><th class="r">Concluídas</th><th class="r">No prazo</th><th class="r">Execução média</th></tr></thead><tbody>
  ${rotas.map(([k,l])=>{const [o,d]=k.split("|");const c=l.filter(x=>x.status==="concluida");const cp=c.filter(x=>isFinite(prazo(x)));const np=cp.filter(x=>!concluidaComAtraso(x)).length;
    return `<tr><td><b>${esc(nomeLocal(o))}</b> <span class="arrow">→</span> <b>${esc(nomeLocal(d))}</b></td><td class="r num">${l.length}</td><td class="r num">${c.length}</td><td class="r num">${cp.length?Math.round(np/cp.length*100)+"%":"—"}</td><td class="r num">${fDur(avg(c.map(tExec)))}</td></tr>`}).join("")}
  </tbody></table></div></section>`;

  // veículos e equipe
  const porVeic=groupCount(val,o=>o.veiculoId);
  const porEq=groupCount(val,o=>o.equipeIds||[]);
  h+=`<div class="grid2">
    <section class="card"><div class="card-h"><h2>Veículos</h2><span class="sub">uso no período</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Veículo</th><th class="r">OS</th><th class="r">Horas em rota</th><th class="r">Km rodados</th><th class="r">Problemas no checklist</th></tr></thead><tbody>
    ${porVeic.length?porVeic.map(([k,l])=>{const c=l.filter(o=>o.status==="concluida");const hrs=c.reduce((s,o)=>s+(isFinite(tExec(o))?tExec(o):0),0)/3600000;const km=c.reduce((s,o)=>s+(kmRodados(o)||0),0);
      return `<tr><td><b>${esc(nomeVeic(k))}</b></td><td class="r num">${l.length}</td><td class="r num">${hrs.toFixed(1).replace(".",",")}</td><td class="r num">${km?km.toLocaleString("pt-BR"):"—"}</td><td class="r num">${l.reduce((s2,o)=>s2+((o.checklist&&o.checklist.problemas)||0),0)||"—"}</td></tr>`}).join(""):`<tr><td colspan="5">Nenhum veículo informado.</td></tr>`}
    </tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>Equipe</h2><span class="sub">participação nas OS</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Pessoa</th><th class="r">OS</th><th class="r">Concluídas</th><th class="r">No prazo</th></tr></thead><tbody>
    ${porEq.length?porEq.map(([k,l])=>{const c=l.filter(o=>o.status==="concluida");const cp=c.filter(o=>isFinite(prazo(o)));const np=cp.filter(o=>!concluidaComAtraso(o)).length;const p=byId(S.equipe,k);
      return `<tr><td><b>${esc(p?p.nome:"—")}</b>${p&&p.funcao?` <span style="color:var(--faint)">${esc(p.funcao)}</span>`:""}</td><td class="r num">${l.length}</td><td class="r num">${c.length}</td><td class="r num">${cp.length?Math.round(np/cp.length*100)+"%":"—"}</td></tr>`}).join(""):`<tr><td colspan="4">Nenhuma equipe informada.</td></tr>`}
    </tbody></table></div></section>
  </div>`;

  // destinos
  const porDest=groupCount(val,o=>[...new Set(paradasDe(o).map(p=>p.localId).filter(Boolean))]);
  h+=`<section class="card"><div class="card-h"><h2>Unidades mais atendidas</h2><span class="sub">OS com a unidade como origem ou destino</span></div><div class="card-b">${hbars(porDest.slice(0,12).map(([k,l])=>({n:nomeLocal(k),v:l.length,x:""})))}</div></section>`;

  app.innerHTML=h; bindPainel(); drawBars($("#chDia"),series);
}
function durNum(ms){if(!isFinite(ms))return"—";const m=Math.round(ms/60000);if(m<60)return m;if(m<1440)return (m/60).toFixed(1).replace(".",",");return (m/1440).toFixed(1).replace(".",",")}
function durUnit(ms){if(!isFinite(ms))return"";const m=ms/60000;return m<60?"min":m<1440?"h":"dias"}
function kpi(k,v,u,d,cls){return `<div class="kpi ${cls||""}"><div class="k">${esc(k)}</div><div class="v num">${esc(v)}${u?`<small>${esc(u)}</small>`:""}</div><div class="d">${esc(d)}</div></div>`}
function countSt(l){const c={};l.forEach(o=>c[o.status]=(c[o.status]||0)+1);return ABERTOS.filter(s=>c[s]).map(s=>c[s]+" "+ST[s].toLowerCase()).join(" · ")||"Nada pendente"}
function statusSplit(list){
  const keys=["concluida","em_rota","agendada","registrada","cancelada"];const c={};list.forEach(o=>c[o.status]=(c[o.status]||0)+1);const tot=list.length||1;
  const late=list.filter(o=>atrasada(o)||concluidaComAtraso(o)).length;
  return `<div class="split" role="img" aria-label="Distribuição por situação">${keys.filter(k=>c[k]).map(k=>`<i style="width:${c[k]/tot*100}%;background:var(--s-${{concluida:"ok",em_rota:"rota",agendada:"age",registrada:"reg",cancelada:"can"}[k]})" title="${ST[k]}: ${c[k]}"></i>`).join("")}</div>
  <table class="t"><tbody>${keys.map(k=>`<tr><td><span class="st ${k}">${ST[k]}</span></td><td class="r num"><b>${c[k]||0}</b></td><td class="r num" style="color:var(--faint)">${Math.round((c[k]||0)/tot*100)}%</td></tr>`).join("")}
  <tr><td><span class="late">Com atraso (abertas ou concluídas)</span></td><td class="r num"><b>${late}</b></td><td class="r num" style="color:var(--faint)">${Math.round(late/tot*100)}%</td></tr></tbody></table>`;
}
function hbars(rows){
  if(!rows.length)return `<p style="color:var(--mute)">Sem dados no período.</p>`;
  const mx=Math.max(...rows.map(r=>r.v),1);
  return `<div class="hb">${rows.map(r=>`<div class="hb-r"><span class="n">${esc(r.n)}</span><span class="v num">${r.v}${r.x&&r.x!=="—"?`<small>${esc(r.x)}</small>`:""}</span><div class="track"><div class="fill" style="width:${r.v/mx*100}%"></div></div></div>`).join("")}</div>`;
}
function drawBars(el,series){
  if(!el)return; const W=Math.max(el.clientWidth,300),H=220,ml=30,mr=6,mt=10,mb=26;
  const mx=Math.max(1,...series.map(s=>s.v)); const step=mx<=5?1:mx<=10?2:mx<=25?5:Math.ceil(mx/5/5)*5; const top=Math.ceil(mx/step)*step;
  const iw=W-ml-mr, ih=H-mt-mb, n=series.length, bw=iw/n, gap=Math.min(Math.max(bw*.25,1),6);
  const y=v=>mt+ih-(v/top)*ih;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ordens de serviço por dia">`;
  for(let v=0;v<=top;v+=step){s+=`<line class="gl" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`}
  const lblEvery=Math.ceil(n/(iw/46));
  const today=dayKey(new Date());
  series.forEach((d,i)=>{const x=ml+i*bw+gap/2,w=Math.max(bw-gap,1),yy=y(d.v),hh=mt+ih-yy;
    if(d.v>0){const r=Math.min(4,w/2,hh);s+=`<path class="b${d.k>today?" dim":""}" data-i="${i}" d="M${x},${mt+ih} V${yy+r} Q${x},${yy} ${x+r},${yy} H${x+w-r} Q${x+w},${yy} ${x+w},${yy+r} V${mt+ih} Z"/>`}
    if(i%lblEvery===0){const [Y,M,D]=d.k.split("-");s+=`<text class="ax" x="${x+w/2}" y="${H-8}" text-anchor="middle">${D}/${M}</text>`}
  });
  s+=`<rect x="${ml}" y="${mt}" width="${iw}" height="${ih}" fill="transparent" id="hit"/></svg>`;
  el.innerHTML=s; const tip=document.createElement("div");tip.className="tip";tip.hidden=true;el.appendChild(tip);
  const svg=el.querySelector("svg");
  const move=e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)*(W/r.width);const i=Math.floor((px-ml)/bw);if(i<0||i>=n){tip.hidden=true;return}
    const d=series[i];const [Y,M,D]=d.k.split("-");const dt=new Date(+Y,+M-1,+D);
    tip.innerHTML=`<b>${d.v} OS</b> · ${esc(dt.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit"}))}`;
    tip.hidden=false;tip.style.left=((ml+i*bw+bw/2)*(r.width/W))+"px";tip.style.top=(y(d.v)*(r.height/H))+"px";
    $$(".b",svg).forEach(b=>b.style.opacity=(+b.dataset.i===i?1:""));};
  svg.addEventListener("pointermove",move);svg.addEventListener("pointerleave",()=>{tip.hidden=true;$$(".b",svg).forEach(b=>b.style.opacity="")});
}
function bindPainel(){
  const sv=()=>{try{localStorage.setItem("mc-log-f",JSON.stringify(S.f))}catch(e){}};
  $("#fPer").onchange=e=>{S.f.periodo=e.target.value;sv();renderPainel()};
  $("#fSet").onchange=e=>{S.f.setor=e.target.value;sv();renderPainel()};
  $("#fLoc").onchange=e=>{S.f.local=e.target.value;sv();renderPainel()};
  const ex=$("#exp"); if(ex){ ex.onclick=()=>exportCSV(); }
}
async function exportCSV(listArg,suf){
  const list=Array.isArray(listArg)?listArg:S.os.filter(inPainel);
  const cols=["OS","Situação","Atraso","Tipo","Prioridade","Setor","Solicitante","Canal","Pedido em","Origem","Detalhe origem","Destino","Detalhe destino","Itens","Início agendado","Previsão de término","Equipe","Veículo","Agendada em","Saída em","Concluída em","Resposta (min)","Execução (min)","Km inicial","Km final","Km rodados","WhatsApp de quem pediu","Avisado em","Recebido por","Assinatura","Fotos","Observações"];
  const q=v=>{v=v==null?"":String(v);return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  const m=ms=>isFinite(ms)&&ms>=0?Math.round(ms/60000):"";
  const rows=list.map(o=>[codigo(o),ST[o.status],atrasada(o)||concluidaComAtraso(o)?"Sim":"Não",o.tipo,o.prioridade,nomeSetor(o.setorId),o.solicitante,o.canal,fDH(o.solicitadoEm),nomeLocal(o.origemId),o.origemDetalhe,nomeLocal(o.destinoId),o.destinoDetalhe,
    (o.itens||[]).map(i=>`${i.qtd||""} ${i.un||""} ${i.desc||""}`.trim()).join(" | "),fDH(o.agendadoPara),fDH(o.previstoAte),nomeEquipe(o.equipeIds),nomeVeic(o.veiculoId),fDH(o.agendadaEm),fDH(o.iniciadoEm),fDH(o.concluidoEm),m(tResposta(o)),m(tExec(o)),o.kmInicial??"",o.kmFinal??"",kmRodados(o)??"",o.solicitanteTelefone||"",fDH(o.avisadoEm).replace("—",""),(o.conclusao||{}).recebidoPor||"",(o.conclusao||{}).assinatura?"Sim":"Não",((o.conclusao||{}).fotos||[]).length,o.observacoes||""].map(q).join(";"));
  const csv="﻿"+cols.join(";")+"\n"+rows.join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");
  a.href=url;a.download="logistica-os-"+(suf||dayKey(new Date()))+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/* ---------- ORDENS ---------- */
function filtraLista(){
  const f=S.lf,q=f.q.trim().toLowerCase();
  return S.os.filter(o=>{
    if(f.status==="abertas"&&!ABERTOS.includes(o.status))return false;
    if(f.status==="atrasadas"&&!atrasada(o))return false;
    if(["em_rota","concluida","cancelada","registrada","agendada"].includes(f.status)&&o.status!==f.status)return false;
    if(f.setor&&o.setorId!==f.setor)return false;
    if(f.tipo&&o.tipo!==f.tipo)return false;
    if(f.local&&o.origemId!==f.local&&o.destinoId!==f.local)return false;
    if(q){const hay=[codigo(o),o.solicitante,o.tipo,paradasDe(o).map(p=>nomeLocal(p.localId)).join(" "),nomeSetor(o.setorId),nomeEquipe(o.equipeIds),nomeVeic(o.veiculoId),o.observacoes,(o.itens||[]).map(i=>i.desc).join(" ")].join(" ").toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
}
function rowHTML(o){
  const late=atrasada(o),lateC=concluidaComAtraso(o);
  return `<button class="row" type="button" data-open="${esc(o.id)}">
    <span class="cod num">${codigo(o)}<small>${esc(o.tipo||"")}</small></span>
    <span class="rt"><b>${esc(nomeLocal(o.origemId))} <span class="arrow">→</span> ${esc(nomeLocal(o.destinoId))}${extraParadas(o)}</b><span>${esc(itensResumo(o))}</span></span>
    <span class="meta"><div><b class="num">${fDH(o.agendadoPara)}</b>${o.prioridade&&o.prioridade!=="normal"?` · <span class="prio-${o.prioridade}">${o.prioridade==="urgente"?"Urgente":"Alta"}</span>`:""}</div><div>${esc(nomeSetor(o.setorId))}${o.solicitante?" · "+esc(o.solicitante):""}</div></span>
    <span class="meta meta2"><div>${esc(nomeEquipe(o.equipeIds))}</div><div>${esc(nomeVeic(o.veiculoId))}</div></span>
    <span class="stc"><span class="st ${o.status}">${ST[o.status]||o.status}</span>${late?`<span class="late">Atrasada</span>`:lateC?`<span class="late">Concluída com atraso</span>`:""}</span>
  </button>`;
}
function itensResumo(o){const it=o.itens||[];if(!it.length)return "Sem itens informados";const s=it.slice(0,3).map(i=>(i.qtd?i.qtd+" "+(i.un||"")+" ":"")+(i.desc||"")).join(", ");return s+(it.length>3?" e mais "+(it.length-3):"")}
function renderOrdens(){
  const L=loading();const f=S.lf;
  const segs=[["abertas","Em aberto"],["atrasadas","Atrasadas"],["registrada","Registradas"],["agendada","Agendadas"],["em_rota","Em rota"],["concluida","Concluídas"],["cancelada","Canceladas"],["todas","Todas"]];
  const cnt=k=>k==="todas"?S.os.length:k==="abertas"?S.os.filter(o=>ABERTOS.includes(o.status)).length:k==="atrasadas"?S.os.filter(atrasada).length:S.os.filter(o=>o.status===k).length;
  let h=`<div class="head"><div><h1>Ordens de <em>serviço</em></h1><p>Todas as movimentações registradas pela logística, da solicitação à entrega com foto.</p></div>${isLog()?`<div class="act"><a class="btn pri" href="#nova">Nova OS</a></div>`:""}</div>${banner()}
  <div class="seg" role="group" aria-label="Situação">${segs.map(([k,l])=>`<button type="button" data-seg="${k}" aria-pressed="${f.status===k}">${l}<span class="c num">${S.loaded.os||S.demo?cnt(k):""}</span></button>`).join("")}</div>
  <div class="filters">
    <div class="field grow"><label for="lq">Buscar</label><input type="search" id="lq" placeholder="Número, solicitante, item, local, equipe…" value="${esc(f.q)}"></div>
    <details class="fx" id="fx"${f.more||window.innerWidth>760?" open":""}><summary class="btn sm">Filtros${(f.setor||f.local||f.tipo)?" ativos":""}</summary><div class="fx-in">
    <div class="field"><label for="lSet">Setor</label><select id="lSet">${optsSetores(f.setor,"Todos")}</select></div>
    <div class="field"><label for="lLoc">Unidade</label><select id="lLoc">${opts(ativos(S.locais),f.local,"Todas")}</select></div>
    <div class="field"><label for="lTip">Tipo</label><select id="lTip"><option value="">Todos</option>${optsS(TIPOS,f.tipo)}</select></div>
  </div></details></div>`;
  if(L){app.innerHTML=h+L;bindOrdens();return}
  let list=filtraLista();
  if(["abertas","atrasadas","registrada","agendada","em_rota"].includes(f.status)) list.sort((a,b)=>(T(a.agendadoPara)||9e15)-(T(b.agendadoPara)||9e15));
  if(!S.os.length) h+=`<div class="empty"><h3>Nenhuma OS registrada ainda</h3><p>Cada pedido que chegar à logística, por WhatsApp, telefone ou pessoalmente, vira uma OS aqui.${isLog()?' <a href="#nova">Registrar a primeira</a>.':""}</p></div>`;
  else if(!list.length) h+=`<div class="empty"><h3>Nenhuma OS com esses filtros</h3><p>Ajuste a situação, o setor ou a busca.</p></div>`;
  else h+=`<div class="list">${list.slice(0,300).map(rowHTML).join("")}</div>${list.length>300?`<p style="color:var(--mute);margin-top:10px">Mostrando 300 de ${list.length}. Use a busca ou os filtros para refinar.</p>`:""}`;
  app.innerHTML=h;bindOrdens();
}
function bindOrdens(){
  $$("[data-seg]").forEach(b=>b.onclick=()=>{S.lf.status=b.dataset.seg;renderOrdens()});
  let tm;$("#lq").oninput=e=>{clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{S.lf.q=v;renderOrdens()},220)};
  $("#fx").ontoggle=e=>{S.lf.more=e.target.open};
  $("#lSet").onchange=e=>{S.lf.setor=e.target.value;renderOrdens()};
  $("#lLoc").onchange=e=>{S.lf.local=e.target.value;renderOrdens()};
  $("#lTip").onchange=e=>{S.lf.tipo=e.target.value;renderOrdens()};
  bindOpen();
}
function bindOpen(){$$("[data-open]").forEach(b=>b.onclick=()=>openOS(b.dataset.open))}

/* ---------- AGENDA ---------- */
function renderAgenda(){
  const L=loading();
  let h=`<div class="head"><div><h1>Agenda da <em>equipe</em></h1><p>Serviços programados para os próximos 7 dias, com as OS atrasadas no topo.</p></div></div>${banner()}`;
  if(L){app.innerHTML=h+L;return}
  const atr=S.os.filter(atrasada).sort((a,b)=>T(a.agendadoPara)-T(b.agendadoPara));
  const semData=S.os.filter(o=>ABERTOS.includes(o.status)&&!o.agendadoPara);
  const sod=new Date();sod.setHours(0,0,0,0);
  const ag=o=>`<button class="ag" type="button" data-open="${esc(o.id)}"><span class="h num">${o.agendadoPara?fHora(o.agendadoPara):"--:--"}<small>${codigo(o)}</small></span>
    <span class="x"><b>${esc(nomeLocal(o.origemId))} <span class="arrow">→</span> ${esc(nomeLocal(o.destinoId))}${extraParadas(o)}</b><span>${o.recorrenciaId?"Rota fixa · ":""}${esc(o.tipo||"")} · ${esc(nomeEquipe(o.equipeIds))} · ${esc(nomeVeic(o.veiculoId))}</span></span>
    <span class="stc"><span class="st ${o.status}">${ST[o.status]}</span>${atrasada(o)?`<span class="late">Atrasada</span>`:""}</span></button>`;
  if(atr.length) h+=`<div class="day"><h2 style="color:var(--s-late)">Atrasadas <span>${atr.length}</span></h2>${atr.map(o=>ag(o).replace('<span class="h num">',`<span class="h num" style="font-size:13px">${fData(o.agendadoPara)}<br>`)).join("")}</div>`;
  let any=false;
  for(let i=0;i<7;i++){
    const d=new Date(sod.getTime()+i*86400000),k=dayKey(d);
    const l=S.os.filter(o=>o.status!=="cancelada"&&o.agendadoPara&&dayKey(o.agendadoPara)===k&&!atrasada(o)).sort((a,b)=>T(a.agendadoPara)-T(b.agendadoPara));
    const nm=i===0?"Hoje":i===1?"Amanhã":d.toLocaleDateString("pt-BR",{weekday:"long"});
    if(l.length) any=true;
    h+=`<div class="day${i===0?" today":""}"><h2>${esc(nm.charAt(0).toUpperCase()+nm.slice(1))} <span>${d.toLocaleDateString("pt-BR",{day:"2-digit",month:"long"})} · ${l.length} OS</span></h2>${l.length?l.map(ag).join(""):`<p style="color:var(--faint);margin:0 0 6px">Nenhum serviço programado.</p>`}</div>`;
  }
  if(semData.length) h+=`<div class="day"><h2>Sem data definida <span>${semData.length}</span></h2>${semData.map(ag).join("")}</div>`;
  app.innerHTML=h;bindOpen();
}

/* ---------- FORMULÁRIO NOVA / EDITAR ---------- */
let FD=null; // estado do formulário
function blankForm(){
  const now=new Date();const st=new Date(now.getTime()+3600000);st.setMinutes(0,0,0);
  return {tipo:TIPOS[0],prioridade:"normal",setorId:"",solicitante:"",canal:"WhatsApp",solicitadoEm:nowISO(),
    origemId:"",origemDetalhe:"",destinoId:"",destinoDetalhe:"",paradas:[novaParada("retirada"),novaParada("entrega")],itens:[{desc:"",qtd:"",un:"un"}],
    agendadoPara:st.toISOString(),previstoAte:new Date(st.getTime()+2*3600000).toISOString(),equipeIds:[],veiculoId:"",observacoes:""};
}
function renderForm(){
  if(!isLog()){app.innerHTML=`<div class="head"><div><h1>Nova OS</h1></div></div>${banner()}`;return}
  const ed=S.editId?byId(S.os,S.editId):null;const fp=!ed&&S.fromPedido?S.fromPedido:null;
  const dup=!ed&&!fp&&S.dupFrom?byId(S.os,S.dupFrom):null;
  const rec=!ed&&!fp&&S.editRec?byId(S.recorrencias,S.editRec):null;
  FD=ed?JSON.parse(JSON.stringify(ed)):blankForm();
  if(ed) FD.paradas=JSON.parse(JSON.stringify(paradasDe(ed)));
  if(fp){const b=FD;const ag=fp.desejadoPara||b.agendadoPara;
    FD=Object.assign(b,{tipo:fp.tipo||b.tipo,prioridade:fp.prioridade||"normal",setorId:fp.setorId||"",solicitante:S.names[fp.uid]||"",canal:"Pedido no sistema",solicitadoEm:fp.criadoEm||b.solicitadoEm,
      paradas:[novaParada("retirada",fp.origemId,fp.origemDetalhe),novaParada("entrega",fp.destinoId,fp.destinoDetalhe)],itens:JSON.parse(JSON.stringify(fp.itens||[])),
      agendadoPara:ag,previstoAte:new Date(T(ag)+2*3600000).toISOString(),observacoes:[fp.observacoes,fp.contato?"Contato: "+fp.contato:""].filter(Boolean).join(" · "),
      solicitanteTelefone:fp.contato&&soDigitos(fp.contato).length>=10?fp.contato:((acharContato(S.names[fp.uid])||{}).telefone||"")});}
  if(dup){const c=JSON.parse(JSON.stringify(dup));
    Object.assign(FD,{tipo:c.tipo||FD.tipo,prioridade:c.prioridade||"normal",setorId:c.setorId||"",solicitante:c.solicitante||"",solicitanteTelefone:c.solicitanteTelefone||"",contatoId:c.contatoId||null,canal:c.canal||FD.canal,
      paradas:limparParadas(paradasDe(c)),itens:c.itens||[],equipeIds:c.equipeIds||[],veiculoId:c.veiculoId||"",observacoes:c.observacoes||""});}
  if(rec){const m=JSON.parse(JSON.stringify(rec.modelo||{}));const [hh,mm]=(rec.hora||"08:00").split(":").map(Number);const ini=new Date();ini.setHours(hh||0,mm||0,0,0);
    Object.assign(FD,m,{paradas:limparParadas(m.paradas&&m.paradas.length?m.paradas:FD.paradas),agendadoPara:ini.toISOString(),previstoAte:new Date(ini.getTime()+(rec.duracaoMin||120)*60000).toISOString(),
      equipeIds:m.equipeIds||[],itens:m.itens||[]});
    FD.rep={on:true,dias:(rec.diasSemana||[]).slice(),nome:rec.nome||""};}
  if(!FD.rep) FD.rep={on:!!S.novaRec,dias:[],nome:""};
  if(!FD.paradas||FD.paradas.length<2) FD.paradas=[novaParada("retirada"),novaParada("entrega")];
  if(!FD.itens||!FD.itens.length)FD.itens=[{desc:"",qtd:"",un:"un"}];
  const titulo=ed?"Editar <em>"+codigo(ed)+"</em>":rec?"Editar rota <em>fixa</em>":fp?"OS a partir do <em>pedido</em>":dup?"Cópia da <em>"+codigo(dup)+"</em>":FD.rep.on?"Nova rota <em>fixa</em>":"Nova ordem de <em>serviço</em>";
  const sub=ed?"Ajuste dados, paradas, itens, equipe ou horário. A alteração fica registrada no histórico."
    :rec?"As mudanças valem para as próximas OS geradas. As que já estão na Agenda não mudam."
    :fp?"Os dados vieram do pedido de "+esc(S.names[fp.uid]||"um setor")+". Confira, defina equipe e veículo e registre. O setor vê o número da OS em Meus pedidos."
    :dup?"Os dados foram copiados. Confira a data e o horário antes de registrar."
    :FD.rep.on?"Monte o modelo da rota: trajeto, itens, equipe, veículo e horário. Depois escolha os dias da semana."
    :"Lançamento rápido: trajeto, o que vai, quem pediu e quando. O restante fica em Mais detalhes.";
  const podeRepetir=!ed&&!fp;
  app.innerHTML=`<div class="head"><div><h1>${titulo}</h1><p>${sub}</p></div></div>${banner()}
  <form class="form" id="fOS" novalidate>
    <section class="fs"><h2>De onde e para onde</h2><p class="fs-sub">A ordem da lista é a ordem do percurso. Use mais paradas para várias retiradas ou entregas.</p>
      <div class="stops" id="stops"></div><div style="margin-top:10px"><button type="button" class="btn sm" id="addSt">Adicionar parada</button></div></section>
    <section class="fs"><h2>O que vai</h2><div class="items" id="items"></div>
      <div style="margin-top:10px"><button type="button" class="btn sm" id="addIt">Adicionar item</button></div></section>
    <section class="fs"><h2>Quem pediu e quando</h2><div class="fg">
      <div class="field"><label class="req" for="solic">Quem pediu</label><input type="text" id="solic" list="dlSolic" autocomplete="off" value="${esc(FD.solicitante)}" placeholder="Digite o nome; os cadastrados aparecem na lista">
        <datalist id="dlSolic">${S.solicitantes.filter(c=>c.ativo!==false).sort(sortNome).map(c=>`<option value="${esc(c.nome)}">${esc([nomeSetor(c.setorId)!=="—"?nomeSetor(c.setorId):"",fFone(c.telefone)].filter(Boolean).join(" · "))}</option>`).join("")}</datalist>
        <span class="hint" id="solHint">${acharContato(FD.solicitante)?"Contato cadastrado":"Se for alguém novo, o contato é salvo ao registrar"}</span></div>
      <div class="field"><label class="req" for="solTel">WhatsApp de quem pediu</label><input type="tel" id="solTel" inputmode="tel" value="${esc(FD.solicitanteTelefone||"")}" placeholder="(11) 99999-9999"><span class="hint">Recebe o aviso de conclusão</span></div>
      <div class="field"><label class="req" for="setor">Setor solicitante</label><select id="setor"></select><span class="hint">Preenchido sozinho quando o contato já tem setor</span></div>
      <div class="field"><label for="agPara">${FD.rep.on?"Horário de início":"Quando"}</label><input type="datetime-local" id="agPara" value="${toInput(FD.agendadoPara)}"><span class="hint" id="agHint">${FD.rep.on?"Na rota fixa vale o horário; a data é a de cada dia escolhido":""}</span></div>
      <div class="field full"><span class="lbl">Equipe</span><div class="chips" id="eqChips"></div></div>
      <div class="field"><label for="veic">Veículo</label><select id="veic"></select><span class="hint">Com equipe e veículo, a OS já entra agendada</span></div>
    </div></section>
    <details class="fs" id="fMais"${ed||rec||fp||dup||FD.rep.on?" open":""}><summary>Mais detalhes <small>tipo, prioridade, canal, horários, observações${podeRepetir?", rota fixa":""}</small></summary><div class="fg">
      <div class="field"><label for="tipo">Tipo de serviço</label><select id="tipo">${optsS(TIPOS,FD.tipo)}</select><span class="hint" id="tipoHint">${ed?"":"Se não escolher, o sistema define pelo trajeto"}</span></div>
      <div class="field"><label for="prio">Prioridade</label><select id="prio">${optsS(PRIOS,FD.prioridade)}</select></div>
      <div class="field"><label for="canal">Canal do pedido</label><select id="canal">${optsS(CANAIS.concat(["Rota fixa"]),FD.canal)}</select></div>
      <div class="field"><label for="solEm">Pedido recebido em</label><input type="datetime-local" id="solEm" value="${toInput(FD.solicitadoEm)}"><span class="hint">Base do tempo de resposta</span></div>
      <div class="field"><label for="prev">Previsão de término</label><input type="datetime-local" id="prev" value="${toInput(FD.previstoAte)}"><span class="hint">Usada para medir atraso. Padrão: 2 h após o início</span></div>
      <div class="field full"><label for="obs">Observações</label><textarea id="obs" placeholder="Cuidados com a carga, contato no local, acesso, horário de recebimento…">${esc(FD.observacoes)}</textarea></div>
      ${podeRepetir?`<div class="field full"><label class="chk"><input type="checkbox" id="rep"${FD.rep.on?" checked":""}${rec?" disabled":""}> Repetir toda semana (rota fixa)</label>
      <div id="repBox"${FD.rep.on?"":" hidden"} style="margin-top:12px"><div class="fg">
        <div class="field full"><span class="lbl req">Dias da semana</span><div class="chips" id="repDias">${DIAS.map((d,i)=>`<button type="button" class="chip" data-dia="${i}" aria-pressed="${FD.rep.dias.includes(i)}">${d}</button>`).join("")}</div></div>
        <div class="field full"><label for="repNome">Nome da rota fixa</label><input type="text" id="repNome" value="${esc(FD.rep.nome||"")}" placeholder="Ex.: Abastecimento do Doryo"></div></div>
        <p class="hint" style="margin:8px 0 0">As OS são criadas sozinhas com 7 dias de antecedência e aparecem na Agenda. Você gerencia em Cadastros → Rotas fixas.</p></div></div>`:""}
    </div></details>
    <div class="form-foot"><span class="err" id="fErr" role="alert"></span><a class="btn" href="${ed?"#ordens":rec?"#cadastros":"#painel"}" id="fCancel">Descartar</a><button class="btn pri" type="submit" id="fSave">${ed?"Salvar alterações":rec?"Salvar rota fixa":FD.rep.on?"Criar rota fixa":"Registrar OS"}</button></div>
  </form>`;
  refreshFormOptions(); renderItems();
  $("#addIt").onclick=()=>{readItems();FD.itens.push({desc:"",qtd:"",un:"un"});renderItems();const ins=$$("#items .item input[type=text]");ins[ins.length-1].focus()};
  $("#addSt").onclick=()=>{readStops();FD.paradas.push(novaParada("entrega"));renderStops();const s=$("#st-l-"+(FD.paradas.length-1)+"-q");if(s)s.focus()};
  $("#agPara").onchange=e=>{const a=fromInput(e.target.value);const p=fromInput($("#prev").value);if(a&&(!p||T(p)<=T(a))){$("#prev").value=toInput(new Date(T(a)+2*3600000).toISOString())}};
  $("#fCancel").onclick=e=>{const back=S.editId;S.editId=null;S.editRec=null;S.dupFrom=null;S.novaRec=false; if(ed){e.preventDefault();location.hash="#ordens";setTimeout(()=>openOS(back),50)} if(rec){S.cadTab="rotas"}};
  $("#fOS").onsubmit=submitForm;
  FD.tipoManual=!!(ed||rec||fp||dup);
  $("#tipo").addEventListener("change",()=>{FD.tipoManual=true;$("#tipoHint").textContent=""});
  $("#solic").addEventListener("input",()=>{const c=acharContato($("#solic").value);const h=$("#solHint");
    if(c){$("#solTel").value=c.telefone||"";if(c.setorId&&!$("#setor").value){$("#setor").value=c.setorId}h.textContent="Contato cadastrado"+(c.setorId?" · "+nomeSetor(c.setorId):"")}
    else h.textContent=$("#solic").value.trim()?"Contato novo: será salvo ao registrar":"Se for alguém novo, o contato é salvo ao registrar"});
  const rp=$("#rep");if(rp)rp.onchange=()=>{FD.rep.on=rp.checked;$("#repBox").hidden=!rp.checked;$("#fSave").textContent=rp.checked?"Criar rota fixa":"Registrar OS";$("#agHint").textContent=rp.checked?"Na rota fixa vale o horário; a data é a de cada dia escolhido":""};
  $$("[data-dia]").forEach(b=>b.onclick=()=>{const d=+b.dataset.dia;const i=FD.rep.dias.indexOf(d);if(i>=0)FD.rep.dias.splice(i,1);else FD.rep.dias.push(d);b.setAttribute("aria-pressed",i<0)});
}
function refreshFormOptions(){
  if(!FD||!$("#fOS"))return;
  const keep=(sel,val)=>{const el=$(sel);return el?(el.value||val):val};
  FD.setorId=keep("#setor",FD.setorId);FD.veiculoId=keep("#veic",FD.veiculoId);
  if(!$("#stops .lp")){ readStops(); renderStops(); } else refreshPickers();
  const inc=(arr,id)=>arr.filter(x=>x.ativo!==false||x.id===id).sort(sortNome);
  $("#setor").innerHTML=optsSetores(FD.setorId,"Selecione…");
  $("#veic").innerHTML=`<option value="">A definir</option>`+inc(S.veiculos,FD.veiculoId).map(v=>`<option value="${esc(v.id)}"${v.id===FD.veiculoId?" selected":""}>${esc(v.nome)}${v.placa?" · "+esc(v.placa):""}</option>`).join("");
  const eq=inc(S.equipe,null).filter(p=>(p.area||"logistica")!=="manutencao"||FD.equipeIds.includes(p.id)).concat(S.equipe.filter(p=>p.ativo===false&&FD.equipeIds.includes(p.id)));
  $("#eqChips").innerHTML=eq.length?eq.map(p=>`<button type="button" class="chip" data-eq="${esc(p.id)}" aria-pressed="${FD.equipeIds.includes(p.id)}">${esc(p.nome)}${p.funcao?`<small>${esc(p.funcao)}</small>`:""}</button>`).join(""):`<span class="hint">Cadastre a equipe em Cadastros.</span>`;
  $$("[data-eq]").forEach(b=>b.onclick=()=>{const id=b.dataset.eq;const i=FD.equipeIds.indexOf(id);if(i>=0)FD.equipeIds.splice(i,1);else FD.equipeIds.push(id);b.setAttribute("aria-pressed",i<0)});
}
function renderItems(){
  $("#items").innerHTML=FD.itens.map((it,i)=>`<div class="item">
    <input type="text" id="it-d-${i}" aria-label="Item ${i+1}" placeholder="Descrição do item (ex.: cadeiras dobráveis, fardos de água)" value="${esc(it.desc)}">
    <input type="number" id="it-q-${i}" aria-label="Quantidade" min="0" step="any" placeholder="Qtd" value="${esc(it.qtd)}">
    <select id="it-u-${i}" aria-label="Unidade">${optsS(UNIDADES,it.un||"un")}</select>
    <button type="button" class="x" data-rmit="${i}" aria-label="Remover item">×</button></div>`).join("");
  $$("[data-rmit]").forEach(b=>b.onclick=()=>{readItems();FD.itens.splice(+b.dataset.rmit,1);if(!FD.itens.length)FD.itens.push({desc:"",qtd:"",un:"un"});renderItems()});
}
function readItems(){FD.itens=FD.itens.map((_,i)=>({desc:$("#it-d-"+i).value.trim(),qtd:$("#it-q-"+i).value,un:$("#it-u-"+i).value}))}
async function submitForm(e){
  e.preventDefault(); readItems(); readStops();
  const v=id=>$(id).value;
  const ps=FD.paradas.map(p=>Object.assign({},p));
  if(!FD.tipoManual){const lo=byId(S.locais,(ps[0]||{}).localId)||{},ld=byId(S.locais,(ps[ps.length-1]||{}).localId)||{};
    $("#tipo").value=lo.tipo==="Fornecedor"?"Coleta em fornecedor":/^Residência/.test(ld.tipo||"")?"Entrega":lo.tipo==="Centro de distribuição"&&ld.tipo&&ld.tipo!=="Centro de distribuição"?"Abastecimento de estoque":TIPOS[0];}
  const d={tipo:v("#tipo"),prioridade:v("#prio"),setorId:v("#setor"),solicitante:v("#solic").trim(),solicitanteTelefone:v("#solTel").trim(),canal:v("#canal"),solicitadoEm:fromInput(v("#solEm"))||nowISO(),
    paradas:ps,origemId:(ps[0]||{}).localId||"",origemDetalhe:(ps[0]||{}).detalhe||"",destinoId:(ps[ps.length-1]||{}).localId||"",destinoDetalhe:(ps[ps.length-1]||{}).detalhe||"",
    itens:FD.itens.filter(i=>i.desc).map(i=>({desc:i.desc,qtd:i.qtd===""?"":Number(i.qtd),un:i.un})),
    agendadoPara:fromInput(v("#agPara")),previstoAte:fromInput(v("#prev")),equipeIds:FD.equipeIds.slice(),veiculoId:v("#veic"),observacoes:v("#obs").trim()};
  const errs=[];
  if(!d.setorId)errs.push("setor solicitante");
  if(!d.solicitante)errs.push("quem pediu");
  if(!d.solicitanteTelefone)errs.push("o WhatsApp de quem pediu");
  if(d.solicitanteTelefone&&!foneValido(d.solicitanteTelefone)){$("#fErr").textContent="O WhatsApp de quem pediu precisa ter DDD e número, por exemplo (11) 99999-9999.";return}
  const semLocal=ps.findIndex(p=>!p.localId); if(semLocal>=0)errs.push("o local da parada "+(semLocal+1));
  if(!d.itens.length)errs.push("pelo menos um item");
  const rep=FD.rep&&FD.rep.on&&!S.editId&&!S.fromPedido;
  if(rep&&!FD.rep.dias.length)errs.push("os dias da semana da rota fixa");
  if(rep&&!d.agendadoPara)errs.push("o horário de início");
  if(d.agendadoPara&&d.previstoAte&&T(d.previstoAte)<T(d.agendadoPara)){$("#fErr").textContent="A previsão de término precisa ser depois do início.";return}
  if(rep&&!FD.rep.dias.length){const m=$("#fMais");if(m)m.open=true}
  if(errs.length){$("#fErr").textContent="Preencha: "+errs.join(", ")+".";return}
  const rep2=ps.findIndex((p,i)=>i>0&&p.localId===ps[i-1].localId);
  if(rep2>0&&!FD.mesmoOk){FD.mesmoOk=true;$("#fErr").textContent="As paradas "+rep2+" e "+(rep2+1)+" estão no mesmo local ("+nomeLocal(ps[rep2].localId)+"). Se for um remanejamento interno, toque em "+($("#fSave").textContent)+" de novo; se não, corrija o trajeto.";return}
  $("#fErr").textContent="";const btn=$("#fSave");const txt=btn.textContent;btn.disabled=true;btn.textContent="Salvando…";
  try{ d.contatoId=await salvarContato(d.solicitante,d.solicitanteTelefone,d.setorId,S.fromPedido?S.fromPedido.uid:null); }catch(e){ console.warn("contato",e); delete d.contatoId; }
  const pronta=!!(d.agendadoPara&&d.equipeIds.length&&d.veiculoId);
  try{
    if(rep){
      const ini=new Date(d.agendadoPara);const dur=Math.max(15,Math.round(((T(d.previstoAte)||T(d.agendadoPara)+7200000)-T(d.agendadoPara))/60000));
      const modelo={tipo:d.tipo,prioridade:d.prioridade,setorId:d.setorId,solicitante:d.solicitante,solicitanteTelefone:d.solicitanteTelefone,contatoId:d.contatoId||null,paradas:limparParadas(ps),itens:d.itens,equipeIds:d.equipeIds,veiculoId:d.veiculoId,observacoes:d.observacoes};
      const nome=(FD.rep.nome||$("#repNome").value||"").trim()||(d.tipo+" · "+nomeLocal(d.origemId)+" → "+nomeLocal(d.destinoId));
      const dados={nome,diasSemana:FD.rep.dias.slice().sort(),hora:pad(ini.getHours())+":"+pad(ini.getMinutes()),duracaoMin:dur,modelo,ativo:true};
      const nomeIn=$("#repNome");if(nomeIn&&nomeIn.value.trim())dados.nome=nomeIn.value.trim();
      await salvarRecorrencia(S.editRec||null,dados);
      const n=await gerarRecorrentes();
      toast(S.editRec?"Rota fixa salva":"Rota fixa criada"+(n?" · "+n+" OS na agenda":""));
      S.editRec=null;S.novaRec=false;location.hash="#agenda";return;
    }
    if(S.editId){
      const o=byId(S.os,S.editId);let st=o.status,extra={};
      if(o.status==="registrada"&&pronta){st="agendada";extra.agendadaEm=nowISO()}
      else if(o.status==="agendada"&&!pronta){st="registrada";extra.agendadaEm=null}
      const nota=st!==o.status?"":"Dados alterados";
      await saveOS(o.id,Object.assign(d,extra,{status:st,atualizadoEm:nowISO(),historico:hist(o,st,nota)}));
      toast(codigo(o)+" atualizada");const id=o.id;S.editId=null;location.hash="#ordens";setTimeout(()=>openOS(id),60);
    }else{
      const id=novoId();
      const st=pronta?"agendada":"registrada";const now=nowISO();
      const fp=S.fromPedido;const dup=S.dupFrom?byId(S.os,S.dupFrom):null;
      if(fp){d.pedidoId=fp.pid;d.solicitanteId=fp.uid}
      d.paradas=limparParadas(d.paradas);
      if(S.demo) d.numero=S.os.reduce((m,o)=>Math.max(m,o.numero||0),0)+1;
      const doc=Object.assign(d,{status:st,criadoEm:now,criadoPor:S.uid||null,atualizadoEm:now,agendadaEm:pronta?now:null,
        historico:[{s:"registrada",em:now,por:S.uid||null,nota:dup?"OS registrada (cópia da "+codigo(dup)+")":"OS registrada"}].concat(pronta?[{s:"agendada",em:now,por:S.uid||null,nota:""}]:[])});
      const row=await saveOS(id,doc);const n=(row&&row.numero)||d.numero||0;
      if(fp){ try{ await marcarPedido(fp,{status:"convertido",osId:id,numero:n,respondidoEm:nowISO(),respondidoPor:S.uid||null}); }catch(e){console.warn(e)} S.fromPedido=null; }
      S.dupFrom=null;
      toast("OS-"+String(n).padStart(4,"0")+" registrada");location.hash="#ordens";setTimeout(()=>openOS(id),60);
    }
  }catch(err){console.error(err);btn.disabled=false;btn.textContent=txt;
    $("#fErr").textContent="Não foi possível salvar. Verifique a conexão e tente novamente."+(err&&err.message?" ("+err.message+")":"");}
}

/* ---------- DETALHE DA OS ---------- */
function openOS(id){S.openId=id;S.action=null;renderDrawer();}
function closeOS(){S.openId=null;S.action=null;S.copyOpen=false;S.mOpen=null;S.mAct=null;layer.innerHTML="";document.body.style.overflow=""}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($(".lb")){$(".lb").remove();return} if(S.openId||S.mOpen)closeOS()}});
function renderDrawer(){
  const o=byId(S.os,S.openId); if(!o){ if(S.loaded.os||S.demo) closeOS(); return; }
  const prevScroll=$(".dr")?$(".dr").scrollTop:0;
  const late=atrasada(o),lateC=concluidaComAtraso(o);
  const c=o.conclusao||{};
  const fotosHTML=(arr,rm)=>`<div class="photos">${arr.map((f,i)=>`<div class="ph"><button type="button" data-zoom="${esc(f.url)}" aria-label="Ampliar foto ${i+1}"><img src="${esc(f.url)}" alt="Foto ${i+1}" loading="lazy"></button>${rm?`<button type="button" class="rm" data-rmf="${i}" aria-label="Remover foto">×</button>`:""}</div>`).join("")}</div>`;
  const histIds=(o.historico||[]).map(h=>h.por).filter(Boolean); resolveNames(histIds);
  const tl=(o.historico||[]).slice().reverse().map(h=>`<li><time class="num">${fDH(h.em)}</time><span><span class="st ${h.s}">${ST[h.s]||h.s}</span>${h.nota?` · ${esc(h.nota)}`:""}${h.por&&S.names[h.por]?` <span style="color:var(--faint)">por ${esc(S.names[h.por])}</span>`:""}</span></li>`).join("");
  let acts="";
  const copyBtn=`<button class="btn" data-act="copiar">Copiar resumo</button>`;
  const avisarBtn=isLog()&&o.status==="concluida"?`<button class="btn ${o.avisadoEm?"":"wa"}" data-act="avisar">${o.avisadoEm||o.avisoStatus==="enviado"?"Avisar de novo no WhatsApp":"Avisar no WhatsApp"}</button>`:"";
  const extraActs=isLog()?avisarBtn+`<button class="btn" data-act="duplicar">Duplicar</button><button class="btn ghost danger" data-act="excluir">Excluir</button>`:"";
  if(isLog()){
    if(o.status==="registrada") acts=`<button class="btn pri" data-act="editar">Agendar equipe e veículo</button><button class="btn danger" data-act="cancelar">Cancelar OS</button>`;
    if(o.status==="agendada") acts=`<button class="btn pri" data-act="iniciar">Iniciar rota</button><button class="btn" data-act="editar">Editar</button><button class="btn danger" data-act="cancelar">Cancelar OS</button>`;
    if(o.status==="em_rota"){const ps=paradasDe(o),nx=proximaParada(o),ult=ps[ps.length-1];
      acts=(nx>=0?`<button class="btn pri" data-parada="${nx}">Registrar ${verboParada(ps[nx])} em ${esc(nomeLocal(ps[nx].localId))}</button>`
        :`<button class="btn pri" data-act="concluir">Concluir ${verboParada(ult)} em ${esc(nomeLocal(ult.localId))}</button>`)+`<button class="btn" data-act="editar">Editar</button>`;}
    if(o.status==="cancelada") acts=`<button class="btn" data-act="reabrir">Reabrir OS</button>`;
  }
  const A=S.action;
  let panel="";
  if(A&&A.t==="iniciar") panel=`<div class="panel" id="pan"><h3>Iniciar rota · saída do veículo</h3>${checklistPanelHTML(A)}<div class="fg">
      <div class="field"><label class="${o.veiculoId?"req":""}" for="kmI">Km inicial (odômetro na saída)</label><input type="number" id="kmI" inputmode="numeric" min="0" value="${esc(A.kmI==null?"":A.kmI)}" placeholder="${o.veiculoId?"Ex.: 124300":"Sem veículo definido"}">
        <span class="hint">${(()=>{const u=o.veiculoId?ultimoKm(o.veiculoId,o.id):null;return u?"Último registro deste veículo: "+fKm(u.km)+" ("+codigo(u.os)+", "+fDH(u.em)+")":o.veiculoId?"Primeiro registro deste veículo":""})()}</span></div></div>
      <p class="hint" style="margin:0">As fotos são tiradas em cada parada: na retirada, a mercadoria; na entrega, o material entregue a quem recebeu.</p>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk">Confirmar saída</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="concluir") panel=`<div class="panel" id="pan"><h3>${(()=>{const ps=paradasDe(o),u=ps[ps.length-1];return (u.tipo==="retirada"?"Retirada final":"Entrega")+" em "+esc(nomeLocal(u.localId))+(ps.length>1?` · parada ${ps.length} de ${ps.length}`:"")})()}</h3>
      <div class="field"><span class="lbl req">${paradasDe(o).slice(-1)[0].tipo==="retirada"?"Fotos da mercadoria":"Fotos do material entregue"}</span>${fotosHTML(A.fotos||[],true)}<div class="upl-row"><label class="upl"><input type="file" accept="image/*" capture="environment" id="upC" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="4"/></svg><span>Tirar foto</span></label><label class="upl alt"><input type="file" accept="image/*" multiple id="upCg" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg><span>Escolher da galeria</span></label></div><span class="hint">Mostre os itens no local, de preferência com quem recebeu. Ao menos uma foto.</span></div>
      <div class="field"><span class="lbl">Assinatura de quem recebeu</span><div class="sig" id="sigBox"><canvas id="sigC" aria-label="Área de assinatura"></canvas><span class="sig-ph" id="sigPh"${(A.sig||[]).length?" hidden":""}>Assine aqui com o dedo</span></div>
        <div class="actions"><button type="button" class="btn sm ghost" id="sigClr">Limpar assinatura</button></div></div>
      <div class="fg"><div class="field"><label for="rec">Recebido por</label><input type="text" id="rec" value="${esc(A.rec||"")}" placeholder="Nome de quem recebeu"></div>
      <div class="field"><label class="${o.veiculoId?"req":""}" for="kmF">Km final (odômetro na chegada)</label><input type="number" id="kmF" inputmode="numeric" min="0" value="${esc(A.kmF||"")}" placeholder="${o.kmInicial!=null?"Saída: "+o.kmInicial:"Ex.: 124360"}">
        <span class="hint" id="kmHint">${o.kmInicial!=null?"Saída: "+fKm(o.kmInicial)+(A.kmF&&Number(A.kmF)>=o.kmInicial?" · rodou "+fKm(Number(A.kmF)-o.kmInicial):""):""}</span></div>
      <div class="field full"><label for="cObs">Observações da entrega</label><textarea id="cObs" placeholder="Divergências, avarias, itens faltantes…">${esc(A.obs||"")}</textarea></div></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk"${A.busy?" disabled":""}>Encerrar OS</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="parada"){const pp=paradasDe(o)[A.idx];const ent=pp.tipo==="entrega";
    panel=`<div class="panel" id="pan"><h3>${ent?"Entrega":"Retirada"} em ${esc(nomeLocal(pp.localId))} · parada ${A.idx+1} de ${paradasDe(o).length}</h3>
      <div class="field"><span class="lbl req">${ent?"Fotos do material entregue":"Fotos da mercadoria retirada"}</span>${fotosHTML(A.fotos||[],true)}<div class="upl-row"><label class="upl"><input type="file" accept="image/*" capture="environment" id="upP" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="4"/></svg><span>Tirar foto</span></label><label class="upl alt"><input type="file" accept="image/*" multiple id="upPg" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg><span>Escolher da galeria</span></label></div></div>
      ${ent?`<div class="field"><span class="lbl">Assinatura de quem recebeu</span><div class="sig" id="sigBox"><canvas id="sigC" aria-label="Área de assinatura"></canvas><span class="sig-ph" id="sigPh"${(A.sig||[]).length?" hidden":""}>Assine aqui com o dedo</span></div>
        <div class="actions"><button type="button" class="btn sm ghost" id="sigClr">Limpar assinatura</button></div></div>`:""}
      <div class="fg"><div class="field"><label for="rec">${ent?"Recebido por":"Quem liberou no local"}</label><input type="text" id="rec" value="${esc(A.rec||"")}" placeholder="${ent?"Nome de quem recebeu":"Opcional: nome de quem entregou a mercadoria"}"></div>
      <div class="field full"><label for="cObs">Observações</label><textarea id="cObs" placeholder="Divergências, avarias, itens faltantes…">${esc(A.obs||"")}</textarea></div></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk"${A.busy?" disabled":""}>Registrar ${ent?"entrega":"retirada"}</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;}
  if(A&&A.t==="avisar") panel=`<div class="panel" id="pan"><h3>Avisar quem pediu no WhatsApp</h3>
      ${A.falhaAuto?`<p class="err" style="margin:0">O envio automático não foi concluído: ${esc(A.falhaAuto)}. Você pode tentar de novo ou enviar pelo seu WhatsApp.</p>`:""}
      <div class="fg"><div class="field"><label class="req" for="waTel">WhatsApp${o.solicitante?" de "+esc(o.solicitante):""}</label><input type="tel" id="waTel" inputmode="tel" value="${esc(A.fone||"")}" placeholder="(11) 99999-9999"><span class="hint">Com DDD. O número fica salvo na OS.</span></div></div>
      <div class="field"><label for="waMsg">Mensagem</label><textarea id="waMsg" rows="8">${esc(A.msg||"")}</textarea></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions">${S.config.whatsappAuto?`<button class="btn wa" id="pAuto" type="button">Enviar automaticamente</button><button class="btn" id="pOk" type="button">Abrir no meu WhatsApp</button>`:`<button class="btn wa" id="pOk" type="button">Abrir conversa no WhatsApp</button>`}<button class="btn ghost" id="pNo" type="button">Agora não</button></div></div>`;
  if(A&&A.t==="excluir") panel=`<div class="panel" id="pan"><h3>Excluir ${codigo(o)}?</h3><p style="margin:0;color:var(--mute)">A OS some do sistema, com histórico e indicadores. Para manter o registro, prefira Cancelar.${o.pedidoId?" O pedido do setor volta para Aguardando.":""}${o.recorrenciaId?" A rota fixa não vai recriar esta OS.":""}</p>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn danger" id="pOk">Excluir definitivamente</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="cancelar") panel=`<div class="panel" id="pan"><h3>Cancelar ${codigo(o)}</h3><div class="field"><label class="req" for="mot">Motivo do cancelamento</label><textarea id="mot" placeholder="Ex.: setor desistiu, item já entregue por outro meio…">${esc(A.mot||"")}</textarea></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn danger" id="pOk">Confirmar cancelamento</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;

  layer.innerHTML=`<div class="ov" id="ov"><aside class="dr" role="dialog" aria-modal="true" aria-labelledby="drT">
    <div class="dr-h"><div class="row1"><div><h2 id="drT" class="num">${codigo(o)}</h2><p>${esc(o.tipo||"")}${o.prioridade&&o.prioridade!=="normal"?" · Prioridade "+(o.prioridade==="urgente"?"urgente":"alta"):""}</p></div><button class="cl" id="drX" aria-label="Fechar">×</button></div>
      <span class="stl"><span class="st ${o.status}">${ST[o.status]}</span></span>${late?` <span class="stl"><span class="late">Atrasada</span></span>`:lateC?` <span class="stl"><span class="late">Concluída com atraso</span></span>`:""}</div>
    <div class="dr-b">
      ${!A?`<div class="actions">${acts}${copyBtn}${extraActs}</div>`:""}${S.copyOpen&&!A?copyPanel(o):""}${panel}
      <section class="card card-b" style="padding-top:16px">${stopsHTML(o,isLog()&&!A)}${o.recorrenciaId?`<p class="hint" style="margin:10px 0 0">Gerada pela rota fixa ${esc((byId(S.recorrencias,o.recorrenciaId)||{}).nome||"")}</p>`:""}</section>
      <section class="card card-b" style="padding-top:16px"><dl class="dl">
        <div><dt>Início agendado</dt><dd class="num">${fDH(o.agendadoPara)}</dd></div>
        <div><dt>Previsão de término</dt><dd class="num">${fDH(o.previstoAte)}</dd></div>
        <div><dt>Equipe</dt><dd>${esc(nomeEquipe(o.equipeIds))}</dd></div>
        <div><dt>Veículo</dt><dd>${esc(nomeVeic(o.veiculoId))}</dd></div>
        <div><dt>Setor solicitante</dt><dd>${esc(nomeSetor(o.setorId))}</dd></div>
        <div><dt>Quem pediu</dt><dd>${esc(o.solicitante||"—")}${o.canal?` <span style="color:var(--faint);font-weight:500">por ${esc(o.canal)}</span>`:""}</dd></div>
        <div><dt>Tempo de resposta</dt><dd class="num">${o.agendadaEm?fDur(tResposta(o)):"Aguardando agendamento"}</dd></div>
        <div><dt>Tempo de execução</dt><dd class="num">${o.concluidoEm?fDur(tExec(o)):o.iniciadoEm?"Em rota desde "+fHora(o.iniciadoEm):"—"}</dd></div>
        ${o.kmInicial!=null||o.kmFinal!=null?`<div><dt>Quilometragem</dt><dd class="num">${o.kmInicial!=null?Number(o.kmInicial).toLocaleString("pt-BR"):"—"} → ${o.kmFinal!=null?Number(o.kmFinal).toLocaleString("pt-BR"):"—"}${kmRodados(o)!=null?` · <b>rodou ${fKm(kmRodados(o))}</b>`:""}</dd></div>`:""}
        ${o.solicitanteTelefone?`<div><dt>WhatsApp de quem pediu</dt><dd class="num">${esc(fFone(o.solicitanteTelefone))}${o.avisoStatus==="enviado"?` <span style="color:var(--s-ok);font-weight:600">· aviso enviado automaticamente ${fDH(o.avisoAutoEm)}</span>`:o.avisadoEm?` <span style="color:var(--s-ok);font-weight:600">· avisado ${fDH(o.avisadoEm)}</span>`:o.avisoStatus==="erro"?` <span class="late">· falha no envio automático</span>`:""}</dd></div>`:""}
      </dl>${o.observacoes?`<p style="margin:14px 0 0;color:var(--mute)"><b style="color:var(--ink)">Observações:</b> ${esc(o.observacoes)}</p>`:""}</section>
      <section class="card"><div class="card-h"><h2>Itens</h2><span class="sub">${(o.itens||[]).length} ${(o.itens||[]).length===1?"item":"itens"}</span></div><div class="card-b tbl-wrap">
        ${(o.itens||[]).length?`<table class="t"><thead><tr><th>Descrição</th><th class="r">Qtd</th><th>Un.</th></tr></thead><tbody>${o.itens.map(i=>`<tr><td>${esc(i.desc)}</td><td class="r num">${esc(i.qtd===""?"—":String(i.qtd).replace(".",","))}</td><td>${esc(i.un||"")}</td></tr>`).join("")}</tbody></table>`:`<p style="color:var(--mute)">Nenhum item informado.</p>`}</div></section>
      ${checklistViewHTML(o)}
      ${(o.fotosRetirada||[]).length?`<section class="card"><div class="card-h"><h2>Fotos da retirada</h2></div><div class="card-b">${fotosHTML(o.fotosRetirada)}</div></section>`:""}
      ${o.status==="concluida"?`<section class="card"><div class="card-h"><h2>Entrega</h2><span class="sub num">${fDH(o.concluidoEm)}</span></div><div class="card-b">${(c.fotos||[]).length?fotosHTML(c.fotos):""}
        <dl class="dl" style="margin-top:12px"><div><dt>Recebido por</dt><dd>${esc(c.recebidoPor||"—")}</dd></div></dl>
        ${c.assinatura?`<div style="margin-top:12px"><span class="lbl">Assinatura</span><div class="sig-view" style="margin-top:4px"><img src="${esc(c.assinatura.url)}" alt="Assinatura de ${esc(c.recebidoPor||"quem recebeu")}"></div></div>`:""}${c.obs?`<p style="margin:10px 0 0;color:var(--mute)">${esc(c.obs)}</p>`:""}</div></section>`:""}
      ${o.status==="cancelada"?`<section class="card card-b" style="padding-top:16px"><b>Motivo do cancelamento:</b> ${esc(o.motivoCancelamento||"—")}</section>`:""}
      <section class="card"><div class="card-h"><h2>Histórico</h2></div><div class="card-b"><ul class="tl">${tl}</ul></div></section>
    </div></aside></div>`;
  document.body.style.overflow="hidden";
  const dr=$(".dr"); if(dr) dr.scrollTop=prevScroll;
  if(dr&&A&&A.t==="avisar"&&!A.visto){A.visto=true;dr.scrollTop=0;const t=$("#waTel");if(t&&!t.value)t.focus();}
  $("#drX").onclick=closeOS; $("#ov").onclick=e=>{if(e.target.id==="ov")closeOS()};
  $$("[data-zoom]",layer).forEach(b=>b.onclick=()=>{const lb=document.createElement("div");lb.className="lb";lb.innerHTML=`<img src="${esc(b.dataset.zoom)}" alt="Foto ampliada">`;lb.onclick=()=>lb.remove();document.body.appendChild(lb)});
  $$("[data-act]",layer).forEach(b=>b.onclick=()=>doAct(o,b.dataset.act));
  $$("[data-parada]",layer).forEach(b=>b.onclick=()=>{S.copyOpen=false;S.action={t:"parada",idx:+b.dataset.parada,fotos:[],sig:[]};renderDrawer();const p=$("#pan");if(p)p.scrollIntoView({block:"nearest"})});
  const cx=$("#cpX");if(cx)cx.onclick=()=>{S.copyOpen=false;renderDrawer()};
  const ct=$("#cpT");if(ct){ct.focus();ct.select();}
  if(A) bindPanel(o);
}
function syncPanelFields(){const A=S.action;if(!A)return;const g=id=>{const e=$("#"+id);return e?e.value:undefined};
  if(g("kmI")!==undefined)A.kmI=g("kmI");if(g("kmF")!==undefined)A.kmF=g("kmF");if(g("rec")!==undefined)A.rec=g("rec");if(g("cObs")!==undefined)A.obs=g("cObs");if(g("mot")!==undefined)A.mot=g("mot");if(g("waTel")!==undefined)A.fone=g("waTel");if(g("waMsg")!==undefined)A.msg=g("waMsg");syncChecklist();}
function rerenderPanel(){syncPanelFields();renderDrawer()}
function resumo(o){
  const it=(o.itens||[]).map(i=>"• "+[i.qtd===""||i.qtd==null?"":String(i.qtd).replace(".",","),i.un||"",i.desc].filter(Boolean).join(" ")).join("\n");
  const pr=o.prioridade==="urgente"?" — URGENTE":o.prioridade==="alta"?" — prioridade alta":"";
  const L=[`*${codigo(o)} · ${o.tipo||"Serviço"}*${pr}`,`Situação: ${ST[o.status]||o.status}`,
    ...(multi(o)?["Paradas:\n"+paradasDe(o).map((p,i)=>`${i+1}. ${p.tipo==="retirada"?"Retirada":"Entrega"} · ${nomeLocal(p.localId)}${p.detalhe?" ("+p.detalhe+")":""}${p.status==="feita"?" ✔":""}`).join("\n")]
      :[`Retirada: ${nomeLocal(o.origemId)}${o.origemDetalhe?" ("+o.origemDetalhe+")":""}`,`Entrega: ${nomeLocal(o.destinoId)}${o.destinoDetalhe?" ("+o.destinoDetalhe+")":""}`]),
    o.agendadoPara?`Quando: ${fData(o.agendadoPara)}, das ${fHora(o.agendadoPara)}${o.previstoAte?" às "+fHora(o.previstoAte):""}`:"Quando: a definir",
    `Equipe: ${nomeEquipe(o.equipeIds)}`,`Veículo: ${nomeVeic(o.veiculoId)}`];
  if(it)L.push("Itens:\n"+it);
  if(o.observacoes)L.push("Obs.: "+o.observacoes);
  L.push(`Pedido: ${nomeSetor(o.setorId)}${o.solicitante?" · "+o.solicitante:""}`);
  if(o.status==="concluida")L.push(`Entregue em ${fDH(o.concluidoEm)}${(o.conclusao||{}).recebidoPor?" · recebido por "+o.conclusao.recebidoPor:""}`);
  return L.join("\n");
}
function copyPanel(o){const t=resumo(o);return `<div class="panel copybox"><h3>Resumo da ${codigo(o)}</h3><label class="lbl" for="cpT">Texto selecionado. Copie e cole no WhatsApp.</label><textarea id="cpT" readonly>${esc(t)}</textarea>
  <div class="actions"><a class="btn pri" href="https://wa.me/?text=${encodeURIComponent(t)}" target="_blank" rel="noopener">Abrir no WhatsApp</a><button class="btn ghost" id="cpX" type="button">Fechar</button></div></div>`}
async function doAct(o,a){
  if(a==="copiar"){const t=resumo(o);let ok=false;try{await navigator.clipboard.writeText(t);ok=true}catch(e){}
    if(ok){toast("Resumo copiado. Cole no WhatsApp.");S.copyOpen=true;renderDrawer();}else{S.copyOpen=true;renderDrawer();}return}
  if(a==="avisar"){S.copyOpen=false;S.action={t:"avisar",fone:telefoneSugerido(o),msg:msgConclusao(o)};renderDrawer();const p=$("#pan");if(p)p.scrollIntoView({block:"nearest"});return}
  if(a==="duplicar"){S.dupFrom=o.id;S.editId=null;S.fromPedido=null;S.editRec=null;closeOS();if(location.hash==="#nova")route();else location.hash="#nova";return}
  if(a==="concluir"){const ps=paradasDe(o);const falta=ps.slice(0,-1).map((p,i)=>paradaFeita(o,p,i)?null:i+1).filter(Boolean);
    if(falta.length){toast("Registre antes a"+(falta.length>1?"s paradas ":" parada ")+falta.join(", ")+".");return}}
  if(a==="editar"){S.editId=o.id;closeOS();if(location.hash==="#nova")route();else location.hash="#nova";return}
  if(a==="reabrir"){const st=(o.agendadoPara&&(o.equipeIds||[]).length&&o.veiculoId)?"agendada":"registrada";
    try{await saveOS(o.id,{status:st,canceladoEm:null,atualizadoEm:nowISO(),historico:hist(o,st,"OS reaberta")});toast(codigo(o)+" reaberta")}catch(e){toast("Não foi possível reabrir.")}return}
  S.copyOpen=false;S.action={t:a,fotos:[],sig:[]};
  if(a==="iniciar"){ S.action.ck=itensChecklist().map(nome=>({nome,ok:null,obs:""})); const u=o.veiculoId?ultimoKm(o.veiculoId,o.id):null; if(u) S.action.kmI=u.km; }
  renderDrawer();const p=$("#pan");if(p)p.scrollIntoView({block:"nearest"});
}
async function compress(file){
  try{
    const bmp=await createImageBitmap(file,{imageOrientation:"from-image"});
    const mx=1600,sc=Math.min(1,mx/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas");c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);
    c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",.82));
  }catch(e){return file}
}
async function enviarArquivo(blob,ext,type){
  const path=(S.role==="sol"?"chamados/":"")+new Date().getFullYear()+"/"+pad(new Date().getMonth()+1)+"/"+novoId()+"."+ext;
  const {error}=await sb.storage.from("fotos").upload(path,blob,{contentType:type,upsert:false});if(error)throw error;
  const {data}=sb.storage.from("fotos").getPublicUrl(path);return {id:path,url:data.publicUrl};
}
async function uploadFiles(files,errEl){
  const out=[];
  for(const f of files){
    const blob=await compress(f);
    if(S.demo){ out.push({id:"local",url:URL.createObjectURL(blob)}); continue; }
    try{out.push(await enviarArquivo(blob,"jpg","image/jpeg"));}
    catch(e){ if(errEl) errEl.textContent="Falha ao enviar a foto. Verifique a conexão e tente novamente."; }
  }
  return out;
}
function initSig(A){
  const box=$("#sigBox"),cv=$("#sigC");if(!box||!cv)return;
  const dpr=window.devicePixelRatio||1,W=box.clientWidth,H=box.clientHeight;cv.width=W*dpr;cv.height=H*dpr;
  const ctx=cv.getContext("2d");ctx.scale(dpr,dpr);ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=2.4;ctx.strokeStyle="#140C0B";
  const draw=()=>{ctx.clearRect(0,0,W,H);A.sig.forEach(st=>{if(!st.length)return;ctx.beginPath();ctx.moveTo(st[0][0]*W,st[0][1]*H);st.forEach(p=>ctx.lineTo(p[0]*W,p[1]*H));if(st.length===1)ctx.lineTo(st[0][0]*W+.1,st[0][1]*H);ctx.stroke()})};
  draw();let cur=null;
  const pt=e=>{const r=cv.getBoundingClientRect();return [Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]};
  cv.onpointerdown=e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);cur=[pt(e)];A.sig.push(cur);$("#sigPh").hidden=true;draw()};
  cv.onpointermove=e=>{if(!cur)return;e.preventDefault();cur.push(pt(e));draw()};
  cv.onpointerup=cv.onpointercancel=()=>{cur=null};
  $("#sigClr").onclick=()=>{A.sig=[];$("#sigPh").hidden=false;draw()};
}
function sigBlob(A){return new Promise(res=>{const W=600,H=220,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  x.fillStyle="#FFFFFF";x.fillRect(0,0,W,H);x.lineCap="round";x.lineJoin="round";x.lineWidth=3.2;x.strokeStyle="#140C0B";
  A.sig.forEach(st=>{if(!st.length)return;x.beginPath();x.moveTo(st[0][0]*W,st[0][1]*H);st.forEach(p=>x.lineTo(p[0]*W,p[1]*H));if(st.length===1)x.lineTo(st[0][0]*W+.1,st[0][1]*H);x.stroke()});
  c.toBlob(b=>res(b),"image/png")})}
function bindPanel(o){
  const A=S.action;
  if(A.t==="concluir"||A.t==="parada") initSig(A);
  const pa=$("#pAuto");if(pa)pa.onclick=async()=>{syncPanelFields();const err=$("#pErr");const tel=(A.fone||"").trim();
    if(!foneValido(tel)){err.textContent="Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.";return}
    pa.disabled=true;pa.textContent="Enviando…";
    if(soDigitos(tel)!==soDigitos(o.solicitanteTelefone)){ try{await saveOS(o.id,{solicitanteTelefone:tel})}catch(e){} }
    const r=await enviarAvisoAuto(byId(S.os,o.id)||o);
    if(r&&r.ok){S.action=null;toast("Aviso enviado no WhatsApp para "+fFone(tel));renderDrawer();}
    else{pa.disabled=false;pa.textContent="Enviar automaticamente";err.textContent="Não foi enviado: "+((r&&(r.detalhe||r.erro))||"sem resposta")+". Confira em Cadastros → Regras ou envie pelo seu WhatsApp.";}};
  const kf=$("#kmF");if(kf)kf.oninput=()=>{const h=$("#kmHint");if(!h||o.kmInicial==null)return;const v=Number(kf.value);h.textContent="Saída: "+fKm(o.kmInicial)+(kf.value!==""&&v>=o.kmInicial?" · rodou "+fKm(v-o.kmInicial):kf.value!==""?" · valor menor que a saída":"")};
  $$("[data-ck]",layer).forEach(b=>b.onclick=()=>{syncPanelFields();const c=A.ck[+b.dataset.ck];c.ok=b.dataset.v==="1";if(c.ok)c.obs="";renderDrawer();const f=$("#ck-o-"+b.dataset.ck);if(f)f.focus()});
  $("#pNo").onclick=()=>{S.action=null;renderDrawer()};
  $$("[data-rmf]",layer).forEach(b=>b.onclick=()=>{A.fotos.splice(+b.dataset.rmf,1);rerenderPanel()});
  $$("[data-up]",layer).forEach(up=>up.onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;syncPanelFields();
    const lbl=up.parentElement;(lbl.querySelector("span").textContent="Enviando "+fs.length+" foto"+(fs.length>1?"s":"")+"…");$$("[data-up]",layer).forEach(x=>x.disabled=true);
    A.busy=true;const r=await uploadFiles(fs,$("#pErr"));A.busy=false;A.fotos=A.fotos.concat(r);rerenderPanel()});
  $("#pOk").onclick=async()=>{
    syncPanelFields();const err=$("#pErr");const btn=$("#pOk");
    if(A.busy){err.textContent="Aguarde o envio das fotos.";return}
    try{
      if(A.t==="iniciar"){
        const sem=A.ck.findIndex(c=>c.ok===null);if(sem>=0){err.textContent="Responda o checklist: "+A.ck[sem].nome+".";return}
        const semObs=A.ck.findIndex(c=>c.ok===false&&!(c.obs||"").trim());if(semObs>=0){err.textContent="Descreva o problema em: "+A.ck[semObs].nome+".";return}
        const kmTxt=String(A.kmI==null?"":A.kmI).trim();
        if(o.veiculoId&&kmTxt===""){err.textContent="Informe o km inicial do veículo (odômetro na saída).";return}
        const km=kmTxt===""?null:Math.round(Number(kmTxt));
        if(km!=null&&(!isFinite(km)||km<0)){err.textContent="Km inicial inválido.";return}
        const u=o.veiculoId?ultimoKm(o.veiculoId,o.id):null;
        if(km!=null&&u&&km<u.km&&!A.kmOk){A.kmOk=true;err.textContent="O km informado ("+fKm(km)+") é menor que o último registro do veículo ("+fKm(u.km)+" na "+codigo(u.os)+"). Confira o odômetro. Se estiver certo, toque em Confirmar saída de novo.";return}
        btn.disabled=true;const probs=A.ck.filter(c=>!c.ok).length;
        const checklist={itens:A.ck.map(c=>({nome:c.nome,ok:c.ok,obs:(c.obs||"").trim()})),problemas:probs,em:nowISO(),por:S.uid||null};
        await saveOS(o.id,{status:"em_rota",iniciadoEm:nowISO(),kmInicial:km,checklist,atualizadoEm:nowISO(),historico:hist(o,"em_rota","Saída do veículo"+(probs?" · checklist com "+probs+" problema"+(probs>1?"s":""):""))});
        S.action=null;toast(codigo(o)+" em rota");}
      if(A.t==="concluir"){
        if(!A.fotos.length){err.textContent="Anexe ao menos uma foto da entrega.";return}
        const kmTxt=String(A.kmF==null?"":A.kmF).trim();
        if(o.veiculoId&&kmTxt===""){err.textContent="Informe o km final do veículo (odômetro na chegada).";return}
        const km=kmTxt===""?null:Math.round(Number(kmTxt));
        if(km!=null&&(!isFinite(km)||km<0)){err.textContent="Km final inválido.";return}
        if(km!=null&&o.kmInicial!=null&&km<o.kmInicial){err.textContent="O km final ("+fKm(km)+") é menor que o km de saída ("+fKm(o.kmInicial)+").";return}
        if(km!=null&&o.kmInicial!=null&&km-o.kmInicial>1500&&!A.kmOk){A.kmOk=true;err.textContent="A missão ficaria com "+fKm(km-o.kmInicial)+" rodados. Confira o odômetro. Se estiver certo, toque em Encerrar OS de novo.";return}
        const temSig=(A.sig||[]).some(st=>st.length>1);
        if(temSig&&!(A.rec||"").trim()){err.textContent="Informe o nome de quem assinou.";return}
        btn.disabled=true;btn.textContent="Salvando…";
        let assinatura=null;
        if(temSig){const b=await sigBlob(A);
          if(S.demo) assinatura={id:"local",url:URL.createObjectURL(b)};
          else { try{assinatura=await enviarArquivo(b,"png","image/png")}catch(e){btn.disabled=false;btn.textContent="Encerrar OS";err.textContent="Falha ao enviar a assinatura. Tente novamente.";return} }}
        const extraP={};
        {const ps=JSON.parse(JSON.stringify(paradasDe(o)));const u=ps.length-1;ps[u]=Object.assign(ps[u],{status:"feita",feitoEm:nowISO(),fotos:A.fotos,assinatura,pessoa:(A.rec||"").trim(),obs:(A.obs||"").trim()});extraP.paradas=ps;}
        await saveOS(o.id,Object.assign(extraP,{status:"concluida",concluidoEm:nowISO(),kmFinal:km,conclusao:{fotos:A.fotos,assinatura,recebidoPor:(A.rec||"").trim(),obs:(A.obs||"").trim()},atualizadoEm:nowISO(),historico:hist(o,"concluida","Entrega confirmada com foto")}));
        S.action=null;toast(codigo(o)+" concluída");
        const o2=byId(S.os,o.id)||o; const fone=telefoneSugerido(o2);
        if(S.config.whatsappAuto&&foneValido(fone)){
          if(!o2.solicitanteTelefone){ try{await saveOS(o2.id,{solicitanteTelefone:fone})}catch(e){} }
          renderDrawer(); toast("Enviando aviso no WhatsApp…");
          const r=await enviarAvisoAuto(byId(S.os,o.id)||o2);
          if(r&&r.ok){ toast("Aviso enviado no WhatsApp para "+fFone(fone)); renderDrawer(); return; }
          S.action={t:"avisar",fone,msg:msgConclusao(o2),falhaAuto:(r&&(r.detalhe||r.erro))||"sem resposta"};
        } else S.action={t:"avisar",fone,msg:msgConclusao(o2)}; }
      if(A.t==="parada"){
        const ps=JSON.parse(JSON.stringify(paradasDe(o)));const pp=ps[A.idx];const ent=pp.tipo==="entrega";
        if(!A.fotos.length){err.textContent=ent?"Anexe ao menos uma foto do material entregue.":"Anexe ao menos uma foto da mercadoria retirada.";return}
        const temSig=(A.sig||[]).some(st=>st.length>1);
        if(temSig&&!(A.rec||"").trim()){err.textContent="Informe o nome de quem assinou.";return}
        btn.disabled=true;btn.textContent="Salvando…";let assinatura=null;
        if(temSig){const b=await sigBlob(A);
          if(S.demo) assinatura={id:"local",url:URL.createObjectURL(b)};
          else { try{assinatura=await enviarArquivo(b,"png","image/png")}catch(e){btn.disabled=false;btn.textContent="Registrar "+(ent?"entrega":"retirada");err.textContent="Falha ao enviar a assinatura. Tente novamente.";return} }}
        Object.assign(pp,{status:"feita",feitoEm:nowISO(),fotos:A.fotos,assinatura,pessoa:(A.rec||"").trim(),obs:(A.obs||"").trim()});
        await saveOS(o.id,{paradas:ps,atualizadoEm:nowISO(),historico:hist(o,"em_rota",(ent?"Entrega":"Retirada")+" em "+nomeLocal(pp.localId)+" registrada com foto (parada "+(A.idx+1)+")")});
        S.action=null;toast((ent?"Entrega":"Retirada")+" em "+nomeLocal(pp.localId)+" registrada");}
      if(A.t==="avisar"){
        const tel=(A.fone||"").trim(); if(!foneValido(tel)){err.textContent="Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.";return}
        const url="https://wa.me/"+foneWa(tel)+"?text="+encodeURIComponent(A.msg||msgConclusao(o));
        const w=window.open(url,"_blank","noopener"); if(!w) location.href=url;
        try{ await saveOS(o.id,{solicitanteTelefone:tel,avisadoEm:nowISO(),atualizadoEm:nowISO(),historico:hist(o,o.status,"Aviso de conclusão aberto no WhatsApp para "+fFone(tel))}); }catch(e){console.warn(e)}
        S.action=null; renderDrawer(); return; }
      if(A.t==="excluir"){btn.disabled=true;await excluirOS(o);toast(codigo(o)+" excluída");closeOS();render();return;}
      if(A.t==="cancelar"){
        if(!(A.mot||"").trim()){err.textContent="Informe o motivo.";return}
        btn.disabled=true;
        await saveOS(o.id,{status:"cancelada",canceladoEm:nowISO(),motivoCancelamento:A.mot.trim(),atualizadoEm:nowISO(),historico:hist(o,"cancelada",A.mot.trim())});
        S.action=null;toast(codigo(o)+" cancelada");}
      renderDrawer();
    }catch(e){console.error(e);btn.disabled=false;err.textContent="Não foi possível salvar. Verifique a conexão e tente novamente."}
  };
}

/* ---------- PARADAS ---------- */
const PTIPOS=[["retirada","Retirada"],["entrega","Entrega"]];
const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
function paradasDe(o){
  if(o.paradas&&o.paradas.length) return o.paradas;
  return [{id:"p0",tipo:"retirada",localId:o.origemId||"",detalhe:o.origemDetalhe||"",status:"pendente"},
          {id:"p1",tipo:"entrega",localId:o.destinoId||"",detalhe:o.destinoDetalhe||"",status:"pendente"}];
}
const multi=o=>(o.paradas||[]).length>2;
// Parada já registrada? (OS antigas iniciadas com foto na saída contam a 1ª retirada como feita)
function paradaFeita(o,p,i){return p.status==="feita"||(i===0&&p.tipo==="retirada"&&(o.fotosRetirada||[]).length>0)}
function proximaParada(o){const ps=paradasDe(o);for(let i=0;i<ps.length-1;i++)if(!paradaFeita(o,ps[i],i))return i;return -1}
const verboParada=p=>p.tipo==="retirada"?"retirada":"entrega";
const extraParadas=o=>multi(o)?` (+${o.paradas.length-2} parada${o.paradas.length>3?"s":""})`:"";
const novaParada=(tipo,localId,detalhe)=>({id:"p"+Math.random().toString(36).slice(2,8),tipo:tipo||"entrega",localId:localId||"",detalhe:detalhe||"",status:"pendente"});
const limparParadas=ps=>(ps||[]).map(p=>({id:p.id||novaParada().id,tipo:p.tipo,localId:p.localId,detalhe:p.detalhe||"",status:"pendente"}));
function localOptions(id){
  const inc=S.locais.filter(x=>x.ativo!==false||x.id===id).sort(sortNome);const g={};
  inc.forEach(l=>{(g[l.tipo||"Outro"]=g[l.tipo||"Outro"]||[]).push(l)});
  return `<option value="">Selecione o local…</option>`+Object.keys(g).sort((a,b)=>LOCAL_TIPOS.indexOf(a)-LOCAL_TIPOS.indexOf(b)).map(k=>`<optgroup label="${esc(k)}">${g[k].map(x=>`<option value="${esc(x.id)}"${x.id===id?" selected":""}>${esc(x.nome)}</option>`).join("")}</optgroup>`).join("");
}
function renderStops(){
  const box=$("#stops");if(!box)return;
  box.innerHTML=FD.paradas.map((p,i)=>`<div class="stop">
    <span class="sn num" aria-hidden="true">${i+1}</span>
    <select id="st-t-${i}" aria-label="Tipo da parada ${i+1}">${optsS(PTIPOS,p.tipo)}</select>
    ${pickerHTML("st-l-"+i,p.localId,"Local da parada "+(i+1),true)}
    <input type="text" id="st-d-${i}" list="dl-st-${i}" autocomplete="off" aria-label="Detalhe da parada ${i+1}" placeholder="Setor ou detalhe (ex.: Cozinha 2º Andar)" value="${esc(p.detalhe||"")}"><datalist id="dl-st-${i}">${subsetoresOpts(p.localId)}</datalist>
    <button type="button" class="x" data-stup="${i}" aria-label="Subir parada ${i+1}"${i===0?" disabled":""}>↑</button>
    <button type="button" class="x" data-strm="${i}" aria-label="Remover parada ${i+1}"${FD.paradas.length<=2?" disabled":""}>×</button></div>
    <div class="lp-new stop-new" id="st-l-${i}-new" hidden></div>`).join("");
  $$("[data-strm]").forEach(b=>b.onclick=()=>{readStops();FD.paradas.splice(+b.dataset.strm,1);FD.mesmoOk=false;renderStops()});
  $$("[data-stup]").forEach(b=>b.onclick=()=>{readStops();const i=+b.dataset.stup;const t=FD.paradas[i-1];FD.paradas[i-1]=FD.paradas[i];FD.paradas[i]=t;renderStops()});
  $$("#stops select").forEach(s=>s.addEventListener("change",()=>{FD.mesmoOk=false}));
  FD.paradas.forEach((_,i)=>bindPicker("st-l-"+i,id=>{FD.mesmoOk=false;const dl=$("#dl-st-"+i);if(dl)dl.innerHTML=subsetoresOpts(id)}));
}
function readStops(){ if(!$("#stops"))return; FD.paradas=FD.paradas.map((p,i)=>{const t=$("#st-t-"+i);if(!t)return p;return Object.assign({},p,{tipo:t.value,localId:$("#st-l-"+i).value,detalhe:$("#st-d-"+i).value.trim()})}); }
function stopsHTML(o,canAct){
  const ps=paradasDe(o);const M=multi(o);
  const ultimo=ps.length-1;const nx=o.status==="em_rota"?proximaParada(o):-2;
  return `<div class="route2">${ps.map((p,i)=>{
    const feita=paradaFeita(o,p,i)||(i===ultimo&&o.status==="concluida");
    const btn=canAct&&o.status==="em_rota"&&!feita&&i!==ultimo&&i!==nx?`<button class="btn sm" data-parada="${i}" type="button">Registrar ${verboParada(p)}</button>`:"";
    return `<div class="rs${feita?" ok":""}"><span class="rd ${p.tipo}" aria-hidden="true"></span><div class="rc">
      <div class="rt1"><b>${esc(nomeLocal(p.localId))}</b><span class="rk">${p.tipo==="retirada"?"Retirada":"Entrega"}${M?` · parada ${i+1}`:""}${i===nx||(nx===-1&&i===ultimo&&o.status==="em_rota")?` · <b class="prox">próxima</b>`:""}</span>${linksRota(p.localId)}</div>
      ${(byId(S.locais,p.localId)||{}).endereco?`<span class="rdet">${esc(byId(S.locais,p.localId).endereco)}</span>`:""}
      ${p.detalhe?`<span class="rdet">${esc(p.detalhe)}</span>`:""}
      ${feita&&p.feitoEm?`<span class="rdone">Feita ${fDH(p.feitoEm)}${p.pessoa?" · "+esc(p.pessoa):""}</span>`:""}
      ${(p.fotos||[]).length?`<div class="photos sm">${p.fotos.map((f,j)=>`<div class="ph"><button type="button" data-zoom="${esc(f.url)}" aria-label="Ampliar foto da parada ${i+1}"><img src="${esc(f.url)}" alt="Foto da parada ${i+1}" loading="lazy"></button></div>`).join("")}</div>`:""}
      ${p.assinatura?`<div class="sig-view sm"><img src="${esc(p.assinatura.url)}" alt="Assinatura na parada ${i+1}"></div>`:""}
      ${p.obs?`<span class="rdet">${esc(p.obs)}</span>`:""}
      ${btn}</div></div>`}).join("")}</div>`;
}

/* ---------- CAMPO DE LOCAL COM BUSCA E CADASTRO RÁPIDO ---------- */
const canAddLocal=()=>S.demo||isStaff()||(S.role==="sol"&&S.podeLocal===true);
function subsetoresOpts(localId){return localId?S.setores.filter(x=>x.ativo!==false&&x.localId===localId).sort(sortNome).map(x=>`<option value="${esc(x.nome)}"></option>`).join(""):""}
function localTxt(l){return [l.tipo,l.endereco].filter(Boolean).join(" · ")}
function pickerHTML(hid,valueId,label,fora){
  const l=valueId?byId(S.locais,valueId):null;
  return `<div class="lp" data-lp="${esc(hid)}">
    <input type="hidden" id="${esc(hid)}" value="${esc(valueId||"")}">
    <input type="text" class="lp-in" id="${esc(hid)}-q" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${esc(hid)}-ls" aria-label="${esc(label)}" autocomplete="off" placeholder="Buscar local pelo nome…" value="${esc(l?l.nome:"")}">
    <div class="lp-ls" id="${esc(hid)}-ls" role="listbox" hidden></div>
    ${fora?"":`<div class="lp-new" id="${esc(hid)}-new" hidden></div>`}</div>`;
}
function bindPicker(hid,onChange){
  const box=$(`[data-lp="${hid}"]`);if(!box||box.dataset.bound)return;box.dataset.bound="1";
  const hidden=$("#"+CSS.escape(hid)),q=$("#"+CSS.escape(hid)+"-q"),ls=$("#"+CSS.escape(hid)+"-ls"),nw=$("#"+CSS.escape(hid)+"-new");
  let hi=-1,items=[];
  const close=()=>{ls.hidden=true;q.setAttribute("aria-expanded","false");hi=-1};
  const escolher=id=>{const l=byId(S.locais,id);hidden.value=id||"";q.value=l?l.nome:"";close();nw.hidden=true;box.classList.remove("lp-err");if(onChange)onChange(id)};
  const lista=()=>{
    const t=normNome(q.value);
    items=S.locais.filter(l=>l.ativo!==false||l.id===hidden.value).filter(l=>!t||normNome(l.nome).includes(t)||normNome(l.endereco).includes(t))
      .sort((a,b)=>{const as=normNome(a.nome).startsWith(t)?0:1,bs=normNome(b.nome).startsWith(t)?0:1;return as-bs||(LOCAL_TIPOS.indexOf(a.tipo||"Outro")-LOCAL_TIPOS.indexOf(b.tipo||"Outro"))||sortNome(a,b)}).slice(0,40);
    const add=canAddLocal()?`<button type="button" class="lp-add" data-lpadd>+ Cadastrar novo local${q.value.trim()?` “${esc(q.value.trim())}”`:""}</button>`:"";
    ls.innerHTML=(items.length?items.map((l,i)=>`<button type="button" role="option" class="lp-op${i===hi?" hi":""}" data-lpid="${esc(l.id)}" aria-selected="${l.id===hidden.value}"><b>${esc(l.nome)}</b><small>${esc(localTxt(l))}</small></button>`).join("")
      :`<p class="lp-vazio">Nenhum local encontrado${canAddLocal()?".":". Peça à logística para cadastrar."}</p>`)+add;
    ls.hidden=false;q.setAttribute("aria-expanded","true");
  };
  q.addEventListener("focus",()=>{q.select();lista()});
  q.addEventListener("input",()=>{hidden.value="";hi=-1;lista();if(onChange)onChange("")});
  q.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){e.preventDefault();if(ls.hidden)lista();hi=Math.min(hi+1,items.length-1);lista()}
    else if(e.key==="ArrowUp"){e.preventDefault();hi=Math.max(hi-1,0);lista()}
    else if(e.key==="Enter"){if(!ls.hidden&&items[hi>=0?hi:0]){e.preventDefault();escolher(items[hi>=0?hi:0].id)}}
    else if(e.key==="Escape"){close()}});
  q.addEventListener("blur",()=>setTimeout(()=>{if(box.contains(document.activeElement)||nw.contains(document.activeElement))return;close();if(!nw.hidden)return;
    if(!hidden.value&&q.value.trim()){const ex=S.locais.find(l=>l.ativo!==false&&normNome(l.nome)===normNome(q.value));if(ex)escolher(ex.id);else box.classList.add("lp-err")}
    else box.classList.remove("lp-err")},150));
  ls.addEventListener("pointerdown",e=>e.preventDefault());
  ls.addEventListener("click",e=>{const op=e.target.closest("[data-lpid]");if(op){escolher(op.dataset.lpid);return}
    if(e.target.closest("[data-lpadd]")){close();abrirNovoLocal()}});
  function abrirNovoLocal(){
    const nome=q.value.trim();const log=isLog()||S.demo;
    nw.innerHTML=`<div class="lp-form"><b>Novo local</b>
      <div class="fg"><div class="field"><label class="req" for="${esc(hid)}-nn">Nome</label><input type="text" id="${esc(hid)}-nn" value="${esc(nome)}" placeholder="Ex.: Atacadão Vila Sônia"></div>
      <div class="field"><label for="${esc(hid)}-nt">Tipo</label>${log?`<select id="${esc(hid)}-nt">${optsS(LOCAL_TIPOS,"Fornecedor")}</select>`:`<input type="text" id="${esc(hid)}-nt" value="Fornecedor" disabled>`}</div>
      <div class="field full"><label for="${esc(hid)}-ne">Endereço</label><input type="text" id="${esc(hid)}-ne" placeholder="Rua, número, bairro – cidade"><span class="hint">Usado no botão de rota do Maps e do Waze</span></div>
      <div class="field full"><label for="${esc(hid)}-nc">Contato no local</label><input type="text" id="${esc(hid)}-nc" placeholder="Opcional: nome e telefone de quem atende"></div></div>
      <p class="err" id="${esc(hid)}-nerr" role="alert"></p>
      <div class="actions"><button type="button" class="btn pri sm" data-lpsave>Salvar local</button><button type="button" class="btn ghost sm" data-lpcx>Cancelar</button></div></div>`;
    nw.hidden=false;const nn=$("#"+CSS.escape(hid)+"-nn");nn.focus();if(nome)$("#"+CSS.escape(hid)+"-ne").focus();
    let forcar=false;
    nw.querySelector("[data-lpcx]").onclick=()=>{nw.hidden=true;q.focus()};
    nw.querySelector("[data-lpsave]").onclick=async()=>{
      const err=$("#"+CSS.escape(hid)+"-nerr");err.innerHTML="";
      const d={nome:nn.value.trim(),tipo:log?$("#"+CSS.escape(hid)+"-nt").value:"Fornecedor",endereco:$("#"+CSS.escape(hid)+"-ne").value.trim(),contato:$("#"+CSS.escape(hid)+"-nc").value.trim(),ativo:true};
      if(!d.nome){err.textContent="Informe o nome do local.";nn.focus();return}
      const n=normNome(d.nome);
      const parecido=S.locais.find(l=>{const m=normNome(l.nome);return m===n||(n.length>=4&&(m.includes(n)||n.includes(m)&&m.length>=4))});
      if(parecido&&!forcar){forcar=true;
        err.innerHTML=`Já existe “${esc(parecido.nome)}”${parecido.endereco?" ("+esc(parecido.endereco)+")":""}. <button type="button" class="lnk" data-lpuse="${esc(parecido.id)}">Usar esse</button> ou toque em Salvar local de novo para cadastrar mesmo assim.`;
        err.querySelector("[data-lpuse]").onclick=()=>escolher(parecido.id);return}
      const b=nw.querySelector("[data-lpsave]");b.disabled=true;b.textContent="Salvando…";
      try{
        let novo;
        if(S.demo){novo=Object.assign({id:novoId()},d)}
        else{const {data,error}=await sb.from("locais").insert(d).select().single();if(error)throw error;novo=fromDb(data)}
        S.locais.push(novo);escolher(novo.id);toast("Local “"+novo.nome+"” cadastrado");
      }catch(e){console.error(e);b.disabled=false;b.textContent="Salvar local";
        err.textContent=/row-level security/i.test(e.message||"")?"Seu acesso não permite cadastrar locais. Peça à logística.":"Não foi possível salvar. Verifique a conexão e tente novamente."}
    };
  }
}
function refreshPickers(){$$(".lp").forEach(box=>{const hid=box.dataset.lp;const h=$("#"+CSS.escape(hid)),q=$("#"+CSS.escape(hid)+"-q");if(!h||!q||document.activeElement===q)return;const l=byId(S.locais,h.value);if(l)q.value=l.nome})}
function linksRota(localId){
  const l=byId(S.locais,localId);if(!l||!l.endereco)return "";
  const e=encodeURIComponent(l.endereco);
  return `<span class="rlinks"><a href="https://www.google.com/maps/search/?api=1&query=${e}" target="_blank" rel="noopener">Maps</a><a href="https://waze.com/ul?q=${e}&navigate=yes" target="_blank" rel="noopener">Waze</a></span>`;
}

/* ---------- QUILOMETRAGEM ---------- */
function kmRodados(o){return (o.kmFinal!=null&&o.kmInicial!=null&&o.kmFinal>=o.kmInicial)?o.kmFinal-o.kmInicial:null}
function ultimoKm(veiculoId,excetoId){
  let best=null;
  S.os.forEach(o=>{if(o.veiculoId!==veiculoId||o.id===excetoId)return;
    [[o.kmFinal,o.concluidoEm],[o.kmInicial,o.iniciadoEm]].forEach(([k,t])=>{if(k!=null&&k!==""&&(!best||k>best.km))best={km:Number(k),em:t,os:o}})});
  return best;
}
const fKm=n=>n==null||n===""?"—":Number(n).toLocaleString("pt-BR")+" km";
/* ---------- WHATSAPP ---------- */
function soDigitos(t){return String(t||"").replace(/\D/g,"")}
function foneWa(t){let d=soDigitos(t);if(!d)return "";if(d.startsWith("0"))d=d.replace(/^0+/,"");if(d.length===10||d.length===11)d="55"+d;return d}
function foneValido(t){const d=foneWa(t);return d.length>=12&&d.length<=13}
function fFone(t){const d=soDigitos(t).replace(/^55(?=\d{10,11}$)/,"");if(d.length===11)return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return t||""}
function msgConclusao(o){
  const c=o.conclusao||{};const ps=paradasDe(o);const fim=ps[ps.length-1]||{};
  const nome=(o.solicitante||"").trim().split(/\s+/)[0];
  const it=(o.itens||[]).slice(0,6).map(i=>"• "+[i.qtd===""||i.qtd==null?"":String(i.qtd).replace(".",","),i.un||"",i.desc].filter(Boolean).join(" ")).join("\n");
  const foto=(c.fotos||[])[0];
  return [`Olá${nome?", "+nome:""}! Sua solicitação *${codigo(o)}* foi concluída ✅`,
    `Entregue em ${nomeLocal(fim.localId||o.destinoId)}${fim.detalhe||o.destinoDetalhe?" ("+(fim.detalhe||o.destinoDetalhe)+")":""} em ${fDH(o.concluidoEm)}${c.recebidoPor?", recebido por "+c.recebidoPor:""}.`,
    it?"Itens:\n"+it:"",
    foto&&/^https?:/.test(foto.url)?"Foto da entrega: "+foto.url:"",
    "Logística · Grupo Monte Carlo"].filter(Boolean).join("\n\n");
}
const normNome=t=>String(t||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
function acharContato(nome){const n=normNome(nome);return n?S.solicitantes.find(c=>c.ativo!==false&&normNome(c.nome)===n):null}
async function salvarContato(nome,tel,setorId,perfilId){
  nome=String(nome||"").trim();tel=String(tel||"").trim();if(!nome||!tel)return null;
  const ex=acharContato(nome);
  if(ex){const patch={};if(soDigitos(ex.telefone)!==soDigitos(tel))patch.telefone=tel;if(!ex.setorId&&setorId)patch.setorId=setorId;if(!ex.perfilId&&perfilId)patch.perfilId=perfilId;
    if(Object.keys(patch).length){ if(!S.demo){const {error}=await sb.from("solicitantes").update(toDb(patch)).eq("id",ex.id);if(error)throw error;} Object.assign(ex,patch); }
    return ex.id;}
  const novo={id:novoId(),nome,telefone:tel,setorId:setorId||null,perfilId:perfilId||null,ativo:true};
  if(!S.demo){const {error}=await sb.from("solicitantes").insert(toDb(novo));if(error)throw error;}
  S.solicitantes.push(novo);return novo.id;
}
async function enviarAvisoAuto(o){
  if(S.demo){await new Promise(r=>setTimeout(r,300));const patch={avisoStatus:"enviado",avisoAutoEm:nowISO(),avisadoEm:nowISO(),historico:hist(o,o.status,"Aviso de conclusão enviado automaticamente no WhatsApp (demonstração)")};localUpsertOS(o.id,patch);return {ok:true,para:foneWa(o.solicitanteTelefone)}}
  try{
    const {data,error}=await sb.functions.invoke("enviar-whatsapp",{body:{os_id:o.id}});
    if(error){let det="";try{const j=await error.context.json();det=j.detalhe||j.erro||""}catch(e){}return {ok:false,erro:"falha",detalhe:det||error.message}}
    await carregar("os");return data||{ok:false,erro:"sem_resposta"};
  }catch(e){return {ok:false,erro:"falha",detalhe:e.message}}
}
function telefoneSugerido(o){
  if(o.solicitanteTelefone) return o.solicitanteTelefone;
  const c=o.contatoId?byId(S.solicitantes,o.contatoId):acharContato(o.solicitante); if(c&&c.telefone) return c.telefone;
  if(o.pedidoId){const p=S.pedidos.find(x=>x.pid===o.pedidoId)||S.meus.find(x=>x.pid===o.pedidoId);if(p&&p.contato&&soDigitos(p.contato).length>=10)return p.contato;}
  return "";
}

/* ---------- CHECKLIST DO VEÍCULO ---------- */
const CHECK_PADRAO=["Pneus calibrados e sem avarias","Combustível suficiente para a rota","Luzes, setas e freios funcionando","Baú ou caçamba limpos","Carga amarrada e protegida","Documentos do veículo a bordo"];
const itensChecklist=()=>(S.config.checklist&&S.config.checklist.length?S.config.checklist:CHECK_PADRAO);
function checklistPanelHTML(A){
  return `<div class="field"><span class="lbl req">Checklist do veículo</span><div class="ck">${A.ck.map((c,i)=>`<div class="ck-r">
    <span class="ck-n">${esc(c.nome)}</span>
    <span class="ck-b"><button type="button" class="chip" data-ck="${i}" data-v="1" aria-pressed="${c.ok===true}">OK</button><button type="button" class="chip warn" data-ck="${i}" data-v="0" aria-pressed="${c.ok===false}">Problema</button></span>
    ${c.ok===false?`<input type="text" id="ck-o-${i}" class="ck-o" aria-label="Descreva o problema em ${esc(c.nome)}" placeholder="Descreva o problema" value="${esc(c.obs||"")}">`:""}</div>`).join("")}</div></div>`;
}
function checklistViewHTML(o){
  const ck=o.checklist;if(!ck||!(ck.itens||[]).length)return "";
  return `<section class="card"><div class="card-h"><h2>Checklist do veículo</h2><span class="sub">${ck.problemas?`<span class="late">${ck.problemas} problema${ck.problemas>1?"s":""}</span>`:"Tudo OK"} · ${fDH(ck.em)}</span></div><div class="card-b"><ul class="ckv">${ck.itens.map(c=>`<li><span class="${c.ok?"ok":"late"}">${c.ok?"OK":"Problema"}</span> ${esc(c.nome)}${c.obs?` <span class="rdet">· ${esc(c.obs)}</span>`:""}</li>`).join("")}</ul></div></section>`;
}
function syncChecklist(){const A=S.action;if(!A||!A.ck)return;A.ck.forEach((c,i)=>{const e=$("#ck-o-"+i);if(e)c.obs=e.value})}

/* ---------- EXCLUIR OS ---------- */
async function excluirOS(o){
  if(o.recorrenciaId&&o.dataRecorrencia){const r=byId(S.recorrencias,o.recorrenciaId);
    if(r){const pulos=(r.pulos||[]).concat([String(o.dataRecorrencia).slice(0,10)]);
      if(S.demo) r.pulos=pulos; else { const {error}=await sb.from("recorrencias").update({pulos}).eq("id",r.id); if(error) throw error; r.pulos=pulos; }}}
  if(o.pedidoId){const p=S.pedidos.find(x=>x.pid===o.pedidoId); if(p){ try{await marcarPedido(p,{status:"aguardando",osId:null,numero:null,respondidoEm:null})}catch(e){console.warn(e)} }}
  if(!S.demo){ const {error}=await sb.from("os").delete().eq("id",o.id); if(error) throw error; }
  S.os=S.os.filter(x=>x.id!==o.id);
}

/* ---------- ROTAS FIXAS (recorrências) ---------- */
let gerando=false;
function dataLocal(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
async function gerarRecorrentes(){
  if(!isLog()||gerando)return 0; gerando=true; let n=0;
  try{
    const hoje=new Date();hoje.setHours(0,0,0,0);
    for(const r of S.recorrencias.filter(x=>x.ativo!==false)){
      const base=new Date(r.criadoEm||Date.now());base.setHours(0,0,0,0);
      for(let i=0;i<7;i++){
        const d=new Date(hoje.getTime()+i*86400000+3600000);d.setHours(0,0,0,0);
        if(d<base)continue;
        const ds=dataLocal(d);
        if(!(r.diasSemana||[]).includes(d.getDay()))continue;
        if((r.pulos||[]).includes(ds))continue;
        if(S.os.some(o=>o.recorrenciaId===r.id&&String(o.dataRecorrencia||"").slice(0,10)===ds))continue;
        const [hh,mm]=(r.hora||"08:00").split(":").map(Number);const ini=new Date(d);ini.setHours(hh||0,mm||0,0,0);
        const m=r.modelo||{};const now=nowISO();
        const pronta=!!((m.equipeIds||[]).length&&m.veiculoId);const st=pronta?"agendada":"registrada";
        const ps=limparParadas(m.paradas&&m.paradas.length?m.paradas:paradasDe({}));
        const doc={tipo:m.tipo||TIPOS[0],prioridade:m.prioridade||"normal",setorId:m.setorId||"",solicitante:m.solicitante||"",solicitanteTelefone:m.solicitanteTelefone||"",contatoId:m.contatoId||null,canal:"Rota fixa",solicitadoEm:now,
          paradas:ps,origemId:(ps[0]||{}).localId||"",origemDetalhe:(ps[0]||{}).detalhe||"",destinoId:(ps[ps.length-1]||{}).localId||"",destinoDetalhe:(ps[ps.length-1]||{}).detalhe||"",
          itens:JSON.parse(JSON.stringify(m.itens||[])),agendadoPara:ini.toISOString(),previstoAte:new Date(ini.getTime()+(r.duracaoMin||120)*60000).toISOString(),
          equipeIds:(m.equipeIds||[]).slice(),veiculoId:m.veiculoId||"",observacoes:m.observacoes||"",recorrenciaId:r.id,dataRecorrencia:ds,
          status:st,criadoEm:now,criadoPor:S.uid||null,atualizadoEm:now,agendadaEm:pronta?now:null,
          historico:[{s:"registrada",em:now,por:S.uid||null,nota:"Gerada pela rota fixa "+(r.nome||"")}].concat(pronta?[{s:"agendada",em:now,por:S.uid||null,nota:""}]:[])};
        if(S.demo) doc.numero=S.os.reduce((mx,o)=>Math.max(mx,o.numero||0),0)+1;
        try{ await saveOS(novoId(),doc); n++; }
        catch(e){ if(!(e&&(e.code==="23505"||/duplicate/i.test(e.message||"")))) console.warn(e); }
      }
    }
  } finally { gerando=false; }
  if(n&&!S.demo) await carregar("os");
  if(n) render();
  return n;
}
async function salvarRecorrencia(id,data){
  if(S.demo){ if(id){Object.assign(byId(S.recorrencias,id),data);return byId(S.recorrencias,id)} const r=Object.assign({id:novoId(),criadoEm:nowISO(),pulos:[]},data);S.recorrencias.push(r);return r; }
  if(id){ const {error}=await sb.from("recorrencias").update(toDb(data)).eq("id",id); if(error) throw error; await carregar("recorrencias"); return byId(S.recorrencias,id); }
  const {data:row,error}=await sb.from("recorrencias").insert(toDb(data)).select().single(); if(error) throw error; await carregar("recorrencias"); return fromDb(row);
}
function renderRotasFixas(){
  const list=S.recorrencias.slice().sort((a,b)=>((a.ativo===false)-(b.ativo===false))||(a.nome||"").localeCompare(b.nome||"","pt-BR"));
  const diasTxt=r=>(r.diasSemana||[]).slice().sort().map(d=>DIAS[d]).join(", ")||"Nenhum dia";
  return `<section class="card"><div class="card-h"><h2>Rotas fixas</h2><span class="sub">As OS são criadas sozinhas com 7 dias de antecedência e aparecem na Agenda</span></div><div class="card-b">
    ${isLog()?`<a class="btn sm" href="#nova" id="novaRec">Nova rota fixa</a>`:""}
    ${list.length?list.map(r=>{const m=r.modelo||{};const ps=m.paradas||[];
      return `<div class="rec-row${r.ativo===false?" off":""}"><div class="rec-n"><b>${esc(r.nome)}</b>${r.ativo===false?` <span style="color:var(--faint);font-weight:500">pausada</span>`:""}
        <span class="m">${esc(ps.length?ps.map(p=>nomeLocal(p.localId)).join(" → "):"")}</span></div>
        <span class="m">${esc(diasTxt(r))} · ${esc(r.hora||"")} · ${fDur((r.duracaoMin||120)*60000)}</span>
        <span class="m">${esc(nomeEquipe(m.equipeIds))} · ${esc(nomeVeic(m.veiculoId))}</span>
        ${isLog()?(S.recDel===r.id?`<span class="actions"><span class="err">Excluir a rota? As OS já criadas continuam.</span><button class="btn sm danger" data-rdel2="${esc(r.id)}" type="button">Excluir</button><button class="btn sm ghost" data-rdelx type="button">Voltar</button></span>`
          :`<span class="actions"><button class="btn sm ghost" data-red="${esc(r.id)}" type="button">Editar</button><button class="btn sm ghost" data-rtg="${esc(r.id)}" type="button">${r.ativo===false?"Reativar":"Pausar"}</button><button class="btn sm ghost danger" data-rdel="${esc(r.id)}" type="button">Excluir</button></span>`):"<span></span>"}</div>`}).join(""):`<p style="color:var(--mute)">Nenhuma rota fixa ainda. Crie uma para serviços que se repetem toda semana, como o abastecimento de uma unidade.</p>`}
  </div></section>`;
}
function bindRotasFixas(){
  const nr=$("#novaRec");if(nr)nr.onclick=e=>{e.preventDefault();S.novaRec=true;S.editRec=null;S.editId=null;if(location.hash==="#nova")route();else location.hash="#nova"};
  $$("[data-red]").forEach(b=>b.onclick=()=>{S.editRec=b.dataset.red;S.editId=null;S.novaRec=false;if(location.hash==="#nova")route();else location.hash="#nova"});
  $$("[data-rtg]").forEach(b=>b.onclick=async()=>{const r=byId(S.recorrencias,b.dataset.rtg);try{await salvarRecorrencia(r.id,{ativo:r.ativo===false});if(r.ativo!==false)toast("Rota pausada");else{toast("Rota reativada");await gerarRecorrentes()}renderCadastros()}catch(e){toast("Não foi possível alterar.")}});
  $$("[data-rdel]").forEach(b=>b.onclick=()=>{S.recDel=b.dataset.rdel;renderCadastros()});
  $$("[data-rdelx]").forEach(b=>b.onclick=()=>{S.recDel=null;renderCadastros()});
  $$("[data-rdel2]").forEach(b=>b.onclick=async()=>{const id=b.dataset.rdel2;try{ if(S.demo){S.recorrencias=S.recorrencias.filter(r=>r.id!==id)} else { const {error}=await sb.from("recorrencias").delete().eq("id",id); if(error)throw error; await carregar("recorrencias"); } S.recDel=null;toast("Rota fixa excluída");renderCadastros()}catch(e){toast("Não foi possível excluir.")}});
}

/* ---------- CADASTROS ---------- */
const CAD={
  locais:{t:"Locais",col:"locais",desc:"Clubes, restaurante, centros de distribuição, escritórios, prédio e residências atendidas.",
    f:[["nome","Nome","text"],["sigla","Sigla","text"],["tipo","Tipo","select",LOCAL_TIPOS],["endereco","Endereço","text"],["contato","Contato no local","text"]],
    m:x=>[[x.sigla,x.tipo].filter(Boolean).join(" · "),x.endereco||x.contato]},
  setores:{t:"Setores",col:"setores",desc:"Setores que pedem serviços à logística. Base do indicador de demanda por setor.",
    f:[["nome","Nome","text"],["localId","Local","local"]],m:x=>{const l=byId(S.locais,x.localId);return [l?l.nome:(x.unidade||"Sem local"),""]}},
  solicitantes:{t:"Solicitantes",col:"solicitantes",desc:"Quem pede serviços à logística. O WhatsApp cadastrado recebe o aviso de conclusão.",
    f:[["nome","Nome","text"],["telefone","WhatsApp","tel"],["setorId","Setor","setor"]],m:x=>[fFone(x.telefone),x.setorId?nomeSetor(x.setorId):""]},
  equipe:{t:"Equipe",col:"equipe",desc:"Motoristas, ajudantes, técnicos e coordenação que executam as OS. A área define em qual lista a pessoa aparece.",
    f:[["nome","Nome","text"],["funcao","Função","select",FUNCOES],["area","Área","select",AREAS],["telefone","Telefone","tel"]],m:x=>[[x.funcao,(AREAS.find(a=>a[0]===(x.area||"logistica"))||[,""])[1]].filter(Boolean).join(" · "),x.telefone]},
  prestadores:{t:"Prestadores",col:"prestadores",desc:"Empresas e profissionais terceirizados da manutenção. O painel soma OS e custos por prestador.",
    f:[["nome","Nome","text"],["especialidade","Especialidade","select",MCATS],["telefone","Telefone","tel"],["contato","Contato","text"],["documento","CNPJ / CPF","text"]],m:x=>[[x.especialidade,x.telefone].filter(Boolean).join(" · "),x.contato||x.documento]},
  veiculos:{t:"Veículos",col:"veiculos",desc:"Frota usada nas movimentações. O painel soma horas em rota e km rodados.",
    f:[["nome","Modelo / apelido","text"],["placa","Placa","text"],["tipo","Tipo","select",["Carro","Utilitário","Van","Caminhão 3/4","Caminhão toco","Moto","Outro"]],["capacidade","Capacidade","text"]],m:x=>{const u=ultimoKm(x.id);return [[x.placa,x.tipo].filter(Boolean).join(" · "),u?"Odômetro: "+fKm(u.km)+" · "+fData(u.em):"Odômetro: sem registro"]}}
};
function renderCadastros(){
  const tabs=[["locais","Locais"],["setores","Setores"],["solicitantes","Solicitantes"],["equipe","Equipe"],["veiculos","Veículos"],["prestadores","Prestadores"],["rotas","Rotas fixas"],["usuarios","Usuários"],["config","Regras"]]
    .filter(([k])=>!((k==="veiculos"||k==="rotas")&&S.role==="log"&&!isLog())&&!(k==="prestadores"&&S.role==="log"&&!isMan())&&!(k==="usuarios"&&S.role==="log"&&!isAdmin()));
  if(!tabs.some(t=>t[0]===S.cadTab)) S.cadTab="locais";
  const tab=S.cadTab;
  let h=`<div class="head"><div><h1>Cadastros</h1><p>Listas usadas na abertura das OS. Itens desativados somem dos formulários, mas o histórico continua com o nome.</p></div></div>${banner()}
  <div class="seg" role="group" aria-label="Cadastro">${tabs.map(([k,l])=>`<button type="button" data-ct="${k}" aria-pressed="${tab===k}">${l}${k==="usuarios"?(usuariosPendentes()?`<span class="bdg">${usuariosPendentes()}</span>`:""):k==="rotas"?`<span class="c num">${S.recorrencias.filter(x=>x.ativo!==false).length}</span>`:k!=="config"?`<span class="c num">${S[k].filter(x=>x.ativo!==false).length}</span>`:""}</button>`).join("")}</div>`;
  if(tab==="usuarios"){ app.innerHTML=h+renderUsuarios(); bindCad(); bindUsuarios(); return; }
  if(tab==="rotas"){ app.innerHTML=h+renderRotasFixas(); bindCad(); bindRotasFixas(); return; }
  if(tab==="config"){
    h+=(isLog()||!isStaff()?`<section class="card"><div class="card-h"><h2>Tolerância de atraso</h2></div><div class="card-b"><p style="margin:0 0 12px;color:var(--mute);max-width:62ch">Uma OS conta como atrasada quando é concluída depois da previsão de término somada a esta tolerância. OS abertas viram atrasadas quando o relógio passa desse ponto.</p>
      <div class="filters"><div class="field"><label for="tol">Tolerância (minutos)</label><input type="number" id="tol" min="0" step="5" value="${esc(S.config.toleranciaMin)}"${isLog()?"":" disabled"}></div>${isLog()?`<button class="btn pri" id="tolOk" type="button">Salvar</button>`:""}</div></div></section>
      <section class="card" style="margin-top:16px"><div class="card-h"><h2>Checklist do veículo</h2></div><div class="card-b"><p style="margin:0 0 12px;color:var(--mute);max-width:62ch">Itens que a equipe confere antes de iniciar a rota. Um item por linha. Se algum tiver problema, a descrição fica registrada na OS e soma no painel do veículo.</p>
      <div class="field"><label for="ckTxt">Itens</label><textarea id="ckTxt" rows="8"${isLog()?"":" disabled"}>${esc(itensChecklist().join("\n"))}</textarea></div>${isLog()?`<div class="actions" style="margin-top:10px"><button class="btn pri" id="ckOk" type="button">Salvar checklist</button></div>`:""}</div></section>
      <section class="card" style="margin-top:16px"><div class="card-h"><h2>WhatsApp automático</h2><span class="sub">${S.config.whatsappAuto?"<span style='color:var(--s-ok);font-weight:700'>Ligado</span>":"Desligado"}</span></div><div class="card-b">
        <p style="margin:0 0 12px;color:var(--mute);max-width:66ch">Ligado, o aviso de conclusão sai sozinho pelo número oficial da empresa assim que a OS é encerrada, sem abrir o WhatsApp de quem entregou. Requer a configuração da Meta e da função enviar-whatsapp no Supabase (veja o guia). Desligado, o sistema abre a conversa no WhatsApp de quem está usando.</p>
        ${isLog()?`<div class="filters"><div class="field"><label for="waTest">Enviar teste para</label><input type="tel" id="waTest" inputmode="tel" placeholder="(11) 99999-9999" value="${esc(S.meuTelefone||"")}"></div><button class="btn" id="waTestOk" type="button">Enviar mensagem de teste</button></div>
        <label class="chk" style="margin-top:6px"><input type="checkbox" id="waAuto"${S.config.whatsappAuto?" checked":""}> Enviar o aviso de conclusão automaticamente</label>
        <p class="err" id="waErr" role="alert" style="margin:8px 0 0"></p>`:""}</div></section>`:"")+(isMan()||!isStaff()?`
      <section class="card" style="margin-top:16px"><div class="card-h"><h2>Prazos da manutenção</h2><span class="sub">horas a partir da abertura do chamado</span></div><div class="card-b"><p style="margin:0 0 12px;color:var(--mute);max-width:66ch">Quando a OS não tem um prazo definido na triagem, vale o prazo da prioridade. É a base dos indicadores de atraso e de conclusão no prazo.</p>
        <div class="filters">${MPRIOS.map(([k,l])=>`<div class="field"><label for="sla-${k}">${l} (h)</label><input type="number" id="sla-${k}" min="1" step="1" value="${esc(slaH(k))}"${isMan()?"":" disabled"}></div>`).join("")}${isMan()?`<button class="btn pri" id="slaOk" type="button">Salvar prazos</button>`:""}</div></div></section>`:"");
    app.innerHTML=h;bindCad();return;
  }
  const C=CAD[tab];let list=S[tab].slice().sort((a,b)=>((a.ativo===false)-(b.ativo===false))||sortNome(a,b));
  if(tab==="setores"){const at=gruposSetores(list.filter(x=>x.ativo!==false)).flatMap(g=>g.itens);list=at.concat(list.filter(x=>x.ativo===false))}
  const ed=S.cadEdit;
  const editor=(x,id)=>`<form class="cad-edit" data-form="${esc(id||"")}">${C.f.map(([k,l,t,o])=>`<div class="field"><label for="ce-${k}">${l}</label>${t==="setor"?`<select id="ce-${k}">${optsSetores((x||{})[k]||"","Sem setor")}</select>`:t==="local"?`<select id="ce-${k}">${opts(S.locais.filter(l=>l.ativo!==false||l.id===(x||{})[k]).sort(sortNome),(x||{})[k]||"","Sem local")}</select>`:t==="select"?`<select id="ce-${k}">${optsS(o,(x||{})[k]||(Array.isArray(o[0])?o[0][0]:o[0]))}</select>`:`<input type="${t}" id="ce-${k}" value="${esc((x||{})[k]||"")}">`}</div>`).join("")}
    <div class="actions"><button class="btn pri sm" type="submit">Salvar</button><button class="btn sm ghost" type="button" data-cx>Cancelar</button></div></form>`;
  h+=`<section class="card"><div class="card-h"><h2>${C.t}</h2><span class="sub">${esc(C.desc)}</span></div><div class="card-b">
    ${isStaff()?(ed==="__new"?editor(null,""):`<button class="btn sm" data-new type="button">Adicionar</button>`):""}
    ${list.length?list.map(x=>ed===x.id?editor(x,x.id):`<div class="cad-row${x.ativo===false?" off":""}"><span class="n">${esc(x.nome)}${x.ativo===false?` <span style="color:var(--faint);font-weight:500">desativado</span>`:""}</span><span class="m">${esc((C.m(x)[0])||"")}</span><span class="m">${esc((C.m(x)[1])||"")}</span>
      ${isStaff()?`<span class="actions"><button class="btn sm ghost" data-ed="${esc(x.id)}" type="button">Editar</button><button class="btn sm ghost" data-tg="${esc(x.id)}" type="button">${x.ativo===false?"Reativar":"Desativar"}</button></span>`:"<span></span>"}</div>`).join(""):`<p style="color:var(--mute)">Nenhum cadastro ainda.</p>`}
  </div></section>`;
  app.innerHTML=h;bindCad();
}
function bindCad(){
  $$("[data-ct]").forEach(b=>b.onclick=()=>{S.cadTab=b.dataset.ct;S.cadEdit=null;renderCadastros()});
  const tol=$("#tolOk");if(tol)tol.onclick=async()=>{const v=Math.max(0,Number($("#tol").value)||0);
    try{ if(S.demo){S.config.toleranciaMin=v}else{ const {error}=await sb.from("config").update({tolerancia_min:v}).eq("id",1); if(error)throw error; S.config.toleranciaMin=v; } toast("Tolerância salva");}catch(e){toast("Não foi possível salvar.")}};
  const cko=$("#ckOk");if(cko)cko.onclick=async()=>{const itens=$("#ckTxt").value.split("\n").map(x=>x.trim()).filter(Boolean);if(!itens.length){toast("Informe ao menos um item.");return}
    try{ if(!S.demo){ const {error}=await sb.from("config").update({checklist:itens}).eq("id",1); if(error)throw error; } S.config.checklist=itens; toast("Checklist salvo"); }catch(e){toast("Não foi possível salvar. Rode o script 03 no Supabase.")}};
  const wt=$("#waTestOk");if(wt)wt.onclick=async()=>{const tel=$("#waTest").value.trim();const E=$("#waErr");E.textContent="";
    if(!foneValido(tel)){E.textContent="Informe o WhatsApp com DDD.";return}
    if(S.demo){toast("No modo demonstração nada é enviado.");return}
    wt.disabled=true;wt.textContent="Enviando…";
    try{const {data,error}=await sb.functions.invoke("enviar-whatsapp",{body:{teste_numero:tel}});
      let r=data; if(error){let det="";try{const j=await error.context.json();det=j.detalhe||j.erro}catch(e){} r={ok:false,detalhe:det||error.message}}
      if(r&&r.ok){toast("Teste enviado para "+fFone(tel)+". Confira o celular.");}
      else E.textContent="Não foi enviado: "+((r&&(r.detalhe||r.erro))||"sem resposta")+(r&&r.erro==="nao_configurado"?" Cadastre os segredos no Supabase.":"");
    }catch(e){E.textContent="Não foi possível falar com a função enviar-whatsapp. Confira se ela foi publicada no Supabase."}
    wt.disabled=false;wt.textContent="Enviar mensagem de teste";};
  const wa=$("#waAuto");if(wa)wa.onchange=async()=>{const v=wa.checked;
    try{ if(!S.demo){const {error}=await sb.from("config").update({whatsapp_auto:v}).eq("id",1);if(error)throw error;} S.config.whatsappAuto=v; toast(v?"Envio automático ligado":"Envio automático desligado"); renderCadastros(); }
    catch(e){wa.checked=!v;toast("Não foi possível salvar. Rode o script 05 no Supabase.")}};
  const so=$("#slaOk");if(so)so.onclick=async()=>{const v={};MPRIOS.forEach(([k])=>v[k]=Math.max(1,Math.round(Number($("#sla-"+k).value)||SLA_PADRAO[k])));
    try{ if(!S.demo){const {error}=await sb.from("config").update({sla_manutencao:v}).eq("id",1);if(error)throw error;} S.config.slaMan=v; toast("Prazos salvos"); }catch(e){toast("Não foi possível salvar. Rode o script 08 no Supabase.")}};
  const nb=$("[data-new]");if(nb)nb.onclick=()=>{S.cadEdit="__new";renderCadastros();const f=$("#ce-nome");if(f)f.focus()};
  $$("[data-ed]").forEach(b=>b.onclick=()=>{S.cadEdit=b.dataset.ed;renderCadastros()});
  $$("[data-cx]").forEach(b=>b.onclick=()=>{S.cadEdit=null;renderCadastros()});
  $$("[data-tg]").forEach(b=>b.onclick=async()=>{const x=byId(S[S.cadTab],b.dataset.tg);const on=x.ativo===false;
    try{ if(S.demo){x.ativo=on;renderCadastros()} else { const {error}=await sb.from(CAD[S.cadTab].col).update({ativo:on}).eq("id",x.id); if(error)throw error; await carregar(CAD[S.cadTab].col); renderCadastros(); } }catch(e){toast("Não foi possível alterar.")}});
  $$("[data-form]").forEach(f=>f.onsubmit=async e=>{e.preventDefault();const C=CAD[S.cadTab];const d={};C.f.forEach(([k])=>d[k]=$("#ce-"+k).value.trim());
    if(!d.nome){toast("Informe o nome.");return}
    if(S.cadTab==="setores"&&!d.localId) d.localId=null;
    if(S.cadTab==="equipe"&&S.missing.manutencoes) delete d.area;
    if(S.cadTab==="solicitantes"){ if(!foneValido(d.telefone)){toast("Informe o WhatsApp com DDD.");return} if(!d.setorId) d.setorId=null; }
    const id=f.dataset.form||novoId();
    try{
      if(S.demo){const x=byId(S[S.cadTab],id);if(x)Object.assign(x,d);else S[S.cadTab].push(Object.assign({id,ativo:true},d))}
      else{ const r=f.dataset.form? await sb.from(C.col).update(toDb(d)).eq("id",f.dataset.form) : await sb.from(C.col).insert(toDb(Object.assign({ativo:true},d))); if(r.error) throw r.error; await carregar(C.col); }
      S.cadEdit=null;renderCadastros();toast("Salvo");
    }catch(err){toast("Não foi possível salvar.")}
  });
}

/* ---------- PEDIDOS DOS SETORES ---------- */
const PST={aguardando:"Aguardando a logística",convertido:"Virou OS",recusado:"Recusado",cancelado:"Cancelado por você"};
async function marcarPedido(p,patch){
  if(S.demo){const arr=[S.pedidos,S.meus];arr.forEach(a=>{const x=a.find(y=>y.pid===p.pid);if(x)Object.assign(x,patch)});render();return}
  const {error}=await sb.from("pedidos").update(toDb(patch)).eq("id",p.pid); if(error) throw error;
  [S.pedidos,S.meus].forEach(a=>{const x=a.find(y=>y.pid===p.pid);if(x)Object.assign(x,patch)}); buildNav(); render();
}
function pedidoResumo(p){const it=p.itens||[];return it.slice(0,3).map(i=>(i.qtd?i.qtd+" "+(i.un||"")+" ":"")+(i.desc||"")).join(", ")+(it.length>3?" e mais "+(it.length-3):"")}
function pedCard(p,mode){
  const o=p.osId?byId(S.os,p.osId):null;
  let side="";
  if(mode==="log"&&p.status==="aguardando") side=`<button class="btn pri sm" data-conv="${esc(p.pid)}" type="button">Criar OS</button><button class="btn sm danger" data-rec="${esc(p.pid)}" type="button">Recusar</button>`;
  if(mode==="sol"&&p.status==="aguardando") side=`<button class="btn sm" data-canc="${esc(p.pid)}" type="button">Cancelar pedido</button>`;
  if(o) side+=`<button class="btn sm" data-open="${esc(o.id)}" type="button">Ver ${codigo(o)}</button>`;
  const stTxt=p.status==="convertido"?`Virou OS-${String(p.numero||0).padStart(4,"0")}${o?" · "+ST[o.status]:""}`:(PST[p.status]||p.status);
  return `<article class="ped">
    <div style="min-width:0">
      ${mode==="log"?`<div class="who2">${esc(S.names[p.uid]||"Solicitante")}<small>${esc(nomeSetor(p.setorId))} · pedido ${fDH(p.criadoEm)}</small></div>`:`<div class="who2">${esc(p.tipo||"Pedido")}<small>pedido ${fDH(p.criadoEm)}</small></div>`}
      <div class="rt"><b>${esc(nomeLocal(p.origemId))}</b> <span class="arrow">→</span> <b>${esc(nomeLocal(p.destinoId))}</b></div>
      <div class="meta">${esc(pedidoResumo(p))}</div>
      <div class="meta">Para ${p.desejadoPara?fDH(p.desejadoPara):"quando possível"}${p.prioridade&&p.prioridade!=="normal"?` · <span class="prio-${p.prioridade}">${p.prioridade==="urgente"?"Urgente":"Alta"}</span>`:""}${mode==="log"?" · "+esc(p.tipo||""):""}</div>
      ${p.observacoes?`<div class="meta">Obs.: ${esc(p.observacoes)}</div>`:""}
      ${p.contato?`<div class="meta">Contato: ${esc(p.contato)}</div>`:""}
      ${p.status==="recusado"&&p.motivo?`<div class="meta"><b style="color:var(--s-late)">Motivo:</b> ${esc(p.motivo)}</div>`:""}
    </div>
    <div class="side"><span class="pst ${esc(p.status)}">${esc(stTxt)}</span>${side}</div>
    ${mode==="log"&&S.recusando===p.pid?`<div class="full panel"><div class="field"><label class="req" for="recMot">Motivo da recusa</label><textarea id="recMot" placeholder="Ex.: item não está no CD, pedir direto ao fornecedor…"></textarea></div><span class="err" id="recErr" role="alert"></span>
      <div class="actions"><button class="btn danger" id="recOk" type="button">Confirmar recusa</button><button class="btn ghost" id="recNo" type="button">Voltar</button></div></div>`:""}
  </article>`;
}
function renderPedidos(){
  const tabs=[["aguardando","Aguardando"],["convertido","Viraram OS"],["recusado","Recusados"],["todos","Todos"]];
  const cnt=k=>k==="todos"?S.pedidos.length:S.pedidos.filter(p=>p.status===k).length;
  let list=S.pedidos.filter(p=>S.pTab==="todos"||p.status===S.pTab).sort((a,b)=>S.pTab==="aguardando"?T(a.criadoEm)-T(b.criadoEm):T(b.criadoEm)-T(a.criadoEm));
  let h=`<div class="head"><div><h1>Pedidos dos <em>setores</em></h1><p>Solicitações feitas pelos setores no sistema. Crie a OS a partir do pedido ou recuse explicando o motivo; o setor acompanha a resposta em Meus pedidos.</p></div></div>${banner()}
  <div class="seg" role="group" aria-label="Situação do pedido">${tabs.map(([k,l])=>`<button type="button" data-pt="${k}" aria-pressed="${S.pTab===k}">${l}<span class="c num">${cnt(k)}</span></button>`).join("")}</div>`;
  if(!S.demo&&!S.loaded.pedidos) h+=`<div class="empty"><h3>Carregando pedidos…</h3></div>`;
  else if(!list.length) h+=`<div class="empty"><h3>${S.pTab==="aguardando"?"Nenhum pedido aguardando":"Nada por aqui"}</h3><p>Quando um setor fizer um pedido pelo sistema, ele aparece aqui na hora.</p></div>`;
  else h+=`<div class="list">${list.map(p=>pedCard(p,"log")).join("")}</div>`;
  app.innerHTML=h;
  $$("[data-pt]").forEach(b=>b.onclick=()=>{S.pTab=b.dataset.pt;S.recusando=null;renderPedidos()});
  $$("[data-conv]").forEach(b=>b.onclick=()=>{S.fromPedido=S.pedidos.find(p=>p.pid===b.dataset.conv);S.editId=null;if(location.hash==="#nova")route();else location.hash="#nova"});
  $$("[data-rec]").forEach(b=>b.onclick=()=>{S.recusando=b.dataset.rec;renderPedidos();const t=$("#recMot");if(t)t.focus()});
  const no=$("#recNo");if(no)no.onclick=()=>{S.recusando=null;renderPedidos()};
  const ok=$("#recOk");if(ok)ok.onclick=async()=>{const m=$("#recMot").value.trim();if(!m){$("#recErr").textContent="Informe o motivo.";return}
    const p=S.pedidos.find(x=>x.pid===S.recusando);ok.disabled=true;
    try{await marcarPedido(p,{status:"recusado",motivo:m,respondidoEm:nowISO(),respondidoPor:S.uid||null});S.recusando=null;toast("Pedido recusado");renderPedidos()}
    catch(e){ok.disabled=false;$("#recErr").textContent="Não foi possível salvar. Tente novamente."}};
  bindOpen();
}
function renderMeus(){
  const list=S.meus.slice().sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  const ag=list.filter(p=>p.status==="aguardando").length;
  let h=`<div class="head"><div><h1>Meus <em>pedidos</em></h1><p>Acompanhe o que você pediu à logística. Quando o pedido vira OS, o número aparece aqui e você vê a situação da entrega até a foto final.</p></div><div class="act"><a class="btn pri" href="#solicitar">Novo pedido</a></div></div>${banner()}`;
  if(!S.demo&&!S.loaded.meus) h+=`<div class="empty"><h3>Carregando seus pedidos…</h3></div>`;
  else if(!list.length) h+=`<div class="empty"><h3>Você ainda não fez pedidos</h3><p>Precisa levar, buscar ou remanejar algo entre as unidades? <a href="#solicitar">Faça um pedido à logística</a>.</p></div>`;
  else h+=`<p style="color:var(--mute);margin:0 0 12px">${ag?ag+" aguardando resposta da logística.":"Nenhum pedido aguardando resposta."}</p><div class="list">${list.map(p=>pedCard(p,"sol")).join("")}</div>`;
  app.innerHTML=h;
  $$("[data-canc]").forEach(b=>b.onclick=async()=>{const p=S.meus.find(x=>x.pid===b.dataset.canc);b.disabled=true;
    try{await marcarPedido(p,{status:"cancelado",respondidoEm:nowISO()});toast("Pedido cancelado")}catch(e){b.disabled=false;toast("Não foi possível cancelar.")}});
  bindOpen();
}
function renderSolicitar(){
  if(S.role==="ver"){app.innerHTML=`<div class="head"><div><h1>Novo pedido</h1></div></div>${banner()}`;return}
  const st=new Date(Date.now()+3*3600000);st.setMinutes(0,0,0);
  FD={tipo:TIPOS[0],prioridade:"normal",setorId:S.meuSetor||"",origemId:"",origemDetalhe:"",destinoId:"",destinoDetalhe:"",itens:[{desc:"",qtd:"",un:"un"}],agendadoPara:st.toISOString(),equipeIds:[],veiculoId:""};
  app.innerHTML=`<div class="head"><div><h1>Pedido à <em>logística</em></h1><p>Descreva o que precisa ser levado, de onde e para onde. A logística responde criando a OS com equipe e veículo, e você acompanha em Meus pedidos.</p></div></div>${banner()}
  <form class="form" id="fOS" novalidate>
    <section class="fs"><h2>O que você precisa</h2><div class="fg">
      <div class="field"><label class="req" for="tipo">Tipo de serviço</label><select id="tipo">${optsS(TIPOS,FD.tipo)}</select></div>
      <div class="field"><label for="prio">Urgência</label><select id="prio">${optsS(PRIOS,FD.prioridade)}</select></div>
      <div class="field"><label class="req" for="setor">Seu setor</label><select id="setor"></select></div>
      <div class="field"><label class="req" for="cont">Seu WhatsApp</label><input type="tel" id="cont" inputmode="tel" value="${esc(S.meuTelefone||"")}" placeholder="(11) 99999-9999"><span class="hint">Você recebe aqui o aviso de entrega</span></div>
    </div></section>
    <section class="fs"><h2>Trajeto</h2><div class="fg">
      <div class="field"><label class="req" for="orig-q">Retirar em</label>${pickerHTML("orig",FD.origemId,"Retirar em")}</div>
      <div class="field"><label for="origD">Detalhe da retirada</label><input type="text" id="origD" list="dl-origD" autocomplete="off" placeholder="Setor ou detalhe (ex.: estoque seco)"><datalist id="dl-origD"></datalist></div>
      <div class="field"><label class="req" for="dest-q">Entregar em</label>${pickerHTML("dest",FD.destinoId,"Entregar em")}</div>
      <div class="field"><label for="destD">Detalhe da entrega</label><input type="text" id="destD" list="dl-destD" autocomplete="off" placeholder="Setor ou detalhe (ex.: Cozinha 2º Andar)"><datalist id="dl-destD"></datalist></div>
    </div></section>
    <section class="fs"><h2>Itens</h2><div class="items" id="items"></div><div style="margin-top:10px"><button type="button" class="btn sm" id="addIt">Adicionar item</button></div></section>
    <section class="fs"><h2>Quando</h2><div class="fg">
      <div class="field"><label for="agPara">Precisa para</label><input type="datetime-local" id="agPara" value="${toInput(FD.agendadoPara)}"><span class="hint">A logística confirma o horário ao criar a OS</span></div>
      <div class="field full"><label for="obs">Observações</label><textarea id="obs" placeholder="Cuidados com a carga, acesso ao local, horário de recebimento…"></textarea></div>
    </div></section>
    <div class="form-foot"><span class="err" id="fErr" role="alert"></span><a class="btn" href="#meus">Descartar</a><button class="btn pri" type="submit" id="fSave">Enviar pedido</button></div>
  </form>`;
  refreshPedOptions();renderItems();
  $("#addIt").onclick=()=>{readItems();FD.itens.push({desc:"",qtd:"",un:"un"});renderItems();const ins=$$("#items .item input[type=text]");ins[ins.length-1].focus()};
  ["orig","dest"].forEach(h=>bindPicker(h,id=>{FD.mesmoOk=false;const dl=$("#dl-"+h+"D");if(dl)dl.innerHTML=subsetoresOpts(id)}));
  $("#fOS").onsubmit=submitPedido;
}
function refreshPedOptions(){
  if(!FD||!$("#fOS"))return;
  const keep=(sel,val)=>{const el=$(sel);return el?(el.value||val):val};
  FD.setorId=keep("#setor",FD.setorId);FD.origemId=keep("#orig",FD.origemId);FD.destinoId=keep("#dest",FD.destinoId);
  const grp=id=>{const g={};ativos(S.locais).forEach(l=>{(g[l.tipo||"Outro"]=g[l.tipo||"Outro"]||[]).push(l)});
    return `<option value="">Selecione…</option>`+Object.keys(g).sort((a,b)=>LOCAL_TIPOS.indexOf(a)-LOCAL_TIPOS.indexOf(b)).map(k=>`<optgroup label="${esc(k)}">${g[k].map(x=>`<option value="${esc(x.id)}"${x.id===id?" selected":""}>${esc(x.nome)}</option>`).join("")}</optgroup>`).join("")};
  $("#setor").innerHTML=optsSetores(FD.setorId,"Selecione…");refreshPickers();
}
async function submitPedido(e){
  e.preventDefault();readItems();const v=id=>$(id).value;
  const d={tipo:v("#tipo"),prioridade:v("#prio"),setorId:v("#setor"),contato:v("#cont").trim(),origemId:v("#orig"),origemDetalhe:v("#origD").trim(),destinoId:v("#dest"),destinoDetalhe:v("#destD").trim(),
    itens:FD.itens.filter(i=>i.desc).map(i=>({desc:i.desc,qtd:i.qtd===""?"":Number(i.qtd),un:i.un})),desejadoPara:fromInput(v("#agPara")),observacoes:v("#obs").trim(),status:"aguardando",criadoEm:nowISO()};
  const errs=[];if(!d.setorId)errs.push("seu setor");if(!d.contato)errs.push("seu WhatsApp");
  if(d.contato&&!foneValido(d.contato)){$("#fErr").textContent="Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.";return}if(!d.origemId)errs.push("onde retirar");if(!d.destinoId)errs.push("onde entregar");if(!d.itens.length)errs.push("pelo menos um item");
  if(errs.length){$("#fErr").textContent="Preencha: "+errs.join(", ")+".";return}
  if(d.origemId===d.destinoId&&!FD.mesmoOk){FD.mesmoOk=true;$("#fErr").textContent="Retirada e entrega estão no mesmo local ("+nomeLocal(d.origemId)+"). Se estiver certo, toque em Enviar pedido de novo.";return}
  const btn=$("#fSave");btn.disabled=true;btn.textContent="Enviando…";$("#fErr").textContent="";
  const pid=novoId();
  try{
    if(S.demo){S.meus.unshift(Object.assign({uid:S.uid,pid},d));S.pedidos.unshift(Object.assign({uid:S.uid,pid},d));}
    else{ const row=Object.assign({},d); delete row.criadoEm; const {error}=await sb.from("pedidos").insert(toDb(row)); if(error) throw error; await carregar("pedidos"); }
    if(!S.demo&&soDigitos(d.contato)!==soDigitos(S.meuTelefone)){ try{ const {error}=await sb.from("perfis").update({telefone:d.contato}).eq("id",S.uid); if(!error) S.meuTelefone=d.contato; }catch(e){} } else S.meuTelefone=d.contato;
    toast("Pedido enviado à logística");location.hash="#meus";
  }catch(err){console.error(err);btn.disabled=false;btn.textContent="Enviar pedido";
    $("#fErr").textContent=err&&/row-level security/i.test(err.message||"")?"Seu acesso não permite enviar pedidos. Peça à coordenação o acesso de Setor.":"Não foi possível enviar. Verifique a conexão e tente novamente.";}
}

/* ---------- RELATÓRIO MENSAL ---------- */
function mesKey(d){d=new Date(d);return d.getFullYear()+"-"+pad(d.getMonth()+1)}
function mesNome(k){const [y,m]=k.split("-");const s=new Date(+y,+m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});return s.charAt(0).toUpperCase()+s.slice(1)}
function mesStats(k){
  const all=S.os.filter(o=>mesKey(refDate(o))===k);const val=all.filter(o=>o.status!=="cancelada");const conc=val.filter(o=>o.status==="concluida");
  const cp=conc.filter(o=>isFinite(prazo(o)));const np=cp.filter(o=>!concluidaComAtraso(o)).length;
  const km=conc.reduce((s,o)=>s+(kmRodados(o)||0),0);
  return {all,val,conc,canc:all.length-val.length,pct:cp.length?Math.round(np/cp.length*100):null,tr:avg(val.map(tResposta)),te:avg(conc.map(tExec)),km,late:conc.filter(concluidaComAtraso)};
}
function dlt(a,b,fmt,lowerBetter){
  if(a==null||b==null||!isFinite(a)||!isFinite(b))return "Sem base no mês anterior";
  const d=a-b;if(Math.abs(d)<1e-9)return "Igual ao mês anterior";
  const up=d>0;const word=lowerBetter?(up?"pior":"melhor"):"";
  return (up?"▲ ":"▼ ")+fmt(Math.abs(d))+" vs mês anterior"+(word?" ("+word+")":"");
}
function renderRelatorio(){
  const months=[];const n=new Date();for(let i=0;i<12;i++){months.push(mesKey(new Date(n.getFullYear(),n.getMonth()-i,1)))}
  if(!S.rm)S.rm=n.getDate()<=5?months[1]:months[0];
  const k=S.rm;const [y,m]=k.split("-");const prevK=mesKey(new Date(+y,+m-2,1));
  const A=mesStats(k),B=mesStats(prevK);
  const fe=S.relatorios.find(r=>r.id===k);
  let h=`<div class="head"><div><h1>Relatório <em>mensal</em></h1><p>Fechamento do mês com comparação ao mês anterior. No dia 1º, o fechamento automático registra a análise do mês que terminou.</p></div>
    <div class="act"><button class="btn" id="expM" type="button">Exportar CSV do mês</button></div></div>${banner()}
  <div class="filters"><div class="field"><label for="rmS">Mês</label><select id="rmS">${months.map(x=>`<option value="${x}"${x===k?" selected":""}>${esc(mesNome(x))}</option>`).join("")}</select></div></div>`;
  if(loading()){app.innerHTML=h+loading();bindRel();return}
  if(fe) h+=`<section class="fech"><h2>Fechamento de ${esc(mesNome(k))}</h2>${String(fe.resumo||"").split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join("")}
    ${(fe.destaques||[]).length?`<b>Pontos de atenção</b><ul>${fe.destaques.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>`:""}<div class="when">Registrado em ${fDH(fe.geradoEm)}</div></section>`;
  const num=v=>String(v);
  h+=`<div class="kpis">
    <div class="kpi"><div class="k">OS no mês</div><div class="v num">${A.val.length}</div><div class="delta">${dlt(A.val.length,B.val.length,num)}</div></div>
    <div class="kpi"><div class="k">Concluídas</div><div class="v num">${A.conc.length}</div><div class="delta">${dlt(A.conc.length,B.conc.length,num)}</div></div>
    <div class="kpi ${A.pct!=null&&A.pct<75?"alert":A.pct>=90?"good":""}"><div class="k">No prazo</div><div class="v num">${A.pct==null?"—":A.pct}${A.pct==null?"":"<small>%</small>"}</div><div class="delta">${dlt(A.pct,B.pct,x=>Math.round(x)+" p.p.")}</div></div>
    <div class="kpi"><div class="k">Tempo de resposta</div><div class="v num">${durNum(A.tr)}<small>${durUnit(A.tr)}</small></div><div class="delta">${dlt(A.tr,B.tr,fDur,true)}</div></div>
    <div class="kpi"><div class="k">Tempo de execução</div><div class="v num">${durNum(A.te)}<small>${durUnit(A.te)}</small></div><div class="delta">${dlt(A.te,B.te,fDur,true)}</div></div>
    <div class="kpi"><div class="k">Km rodados</div><div class="v num">${A.km?A.km.toLocaleString("pt-BR"):"—"}</div><div class="delta">${dlt(A.km||null,B.km||null,x=>Math.round(x).toLocaleString("pt-BR")+" km")}</div></div>
    <div class="kpi"><div class="k">Canceladas</div><div class="v num">${A.canc}</div><div class="delta">${dlt(A.canc,B.canc,num)}</div></div>
  </div>`;
  if(!A.all.length){h+=`<div class="empty"><h3>Nenhuma OS em ${esc(mesNome(k))}</h3><p>Escolha outro mês ou aguarde os primeiros registros.</p></div>`;app.innerHTML=h;bindRel();return}
  const porSetor=groupCount(A.val,o=>o.setorId),porTipo=groupCount(A.val,o=>o.tipo),rotas=groupCount(A.val,o=>o.origemId+"|"+o.destinoId).slice(0,6);
  h+=`<div class="grid2">
    <section class="card"><div class="card-h"><h2>Setores que mais pediram</h2></div><div class="card-b">${hbars(porSetor.slice(0,8).map(([x,l])=>({n:nomeSetor(x),v:l.length,x:""})))}</div></section>
    <section class="card"><div class="card-h"><h2>Tipos de serviço</h2></div><div class="card-b">${hbars(porTipo.map(([x,l])=>({n:x,v:l.length,x:""})))}</div></section></div>
  <div class="grid2">
    <section class="card"><div class="card-h"><h2>Rotas principais</h2></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Rota</th><th class="r">OS</th><th class="r">Execução média</th></tr></thead><tbody>
      ${rotas.map(([x,l])=>{const [a,b]=x.split("|");return `<tr><td><b>${esc(nomeLocal(a))}</b> <span class="arrow">→</span> <b>${esc(nomeLocal(b))}</b></td><td class="r num">${l.length}</td><td class="r num">${fDur(avg(l.filter(o=>o.status==="concluida").map(tExec)))}</td></tr>`}).join("")}</tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>Concluídas com atraso</h2><span class="sub">${A.late.length} OS</span></div><div class="card-b tbl-wrap">${A.late.length?`<table class="t"><thead><tr><th>OS</th><th>Rota</th><th class="r">Atraso</th></tr></thead><tbody>
      ${A.late.sort((a,b)=>(T(b.concluidoEm)-prazo(b))-(T(a.concluidoEm)-prazo(a))).slice(0,10).map(o=>`<tr><td><button class="lnk num" data-open="${esc(o.id)}" type="button">${codigo(o)}</button></td><td>${esc(nomeLocal(o.origemId))} <span class="arrow">→</span> ${esc(nomeLocal(o.destinoId))}</td><td class="r num">${fDur(T(o.concluidoEm)-prazo(o))}</td></tr>`).join("")}</tbody></table>`:`<p style="color:var(--mute)">Nenhuma OS concluída com atraso. Bom trabalho.</p>`}</div></section></div>`;
  if(isLog()){
    const ps=S.pedidos.filter(p=>mesKey(p.criadoEm)===k);
    if(ps.length){const cv=ps.filter(p=>p.status==="convertido");
      h+=`<section class="card"><div class="card-h"><h2>Pedidos feitos pelos setores no sistema</h2></div><div class="card-b"><table class="t"><tbody>
        <tr><td>Recebidos</td><td class="r num"><b>${ps.length}</b></td></tr><tr><td>Viraram OS</td><td class="r num"><b>${cv.length}</b></td></tr>
        <tr><td>Recusados</td><td class="r num"><b>${ps.filter(p=>p.status==="recusado").length}</b></td></tr>
        <tr><td>Tempo médio até virar OS</td><td class="r num"><b>${fDur(avg(cv.map(p=>T(p.respondidoEm)-T(p.criadoEm))))}</b></td></tr></tbody></table></div></section>`;}
  }
  app.innerHTML=h;bindRel();bindOpen();
  function bindRel(){$("#rmS").onchange=e=>{S.rm=e.target.value;renderRelatorio()};
    const ex=$("#expM");if(ex){ex.onclick=()=>exportCSV(mesStats(S.rm).all,S.rm)}}
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-demorole]");if(!b||!S.demo)return;const [r,ar]=b.dataset.demorole.split(":");S.role=r;S.areaAcesso=ar||"ambas";if(areaFixa()){S.area=areaFixa();const h="#"+navCfg().home;buildNav();if(location.hash===h)route();else location.hash=h;return}buildNav();route();});

/* =====================================================================
   MANUTENÇÃO · Facilities
   ===================================================================== */
const codM=m=>"MAN-"+String(m.numero||0).padStart(4,"0");
const fBRL=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const numBR=v=>{if(v==null||v==="")return "";const n=Number(String(v).replace(/\./g,"").replace(",","."));return isFinite(n)?n:""};
const custoLinha=c=>(Number(c.valor)||0)*(c.qtd===""||c.qtd==null?1:(Number(c.qtd)||0));
const custoTotal=m=>(m.custos||[]).reduce((s,c)=>s+custoLinha(c),0);
const slaH=p=>Number(((S.config.slaMan)||SLA_PADRAO)[p]||SLA_PADRAO[p]||72);
function prazoM(m){return T(m.prazo)||(T(m.criadoEm)+slaH(m.prioridade||"normal")*3600000)}
function mAtrasada(m){return MABERTOS.includes(m.status)&&isFinite(prazoM(m))&&Date.now()>prazoM(m)}
function mConclAtraso(m){return m.status==="concluida"&&isFinite(prazoM(m))&&T(m.concluidoEm)>prazoM(m)}
const tAtend=m=>T(m.iniciadoEm)-T(m.criadoEm);
const tSolucao=m=>T(m.concluidoEm)-T(m.criadoEm);
const nomeEquip=id=>{const e=byId(S.equipamentos,id);return e?e.nome+(e.codigo?" · "+e.codigo:""):"—"};
const nomePrest=id=>(byId(S.prestadores,id)||{}).nome||"—";
const executorTxt=m=>m.executor==="terceiro"?(m.prestadorId?nomePrest(m.prestadorId):"Prestador a definir"):((m.equipeIds||[]).length?nomeEquipe(m.equipeIds):"Equipe a definir");
const tituloM=m=>m.titulo||String(m.descricao||"").split("\n")[0].slice(0,90)||(m.tipo==="preventiva"?"Preventiva":"Manutenção");
const ondeM=m=>[nomeLocal(m.localId)!=="—"?nomeLocal(m.localId):"",m.localDetalhe,m.setorId?nomeSetor(m.setorId).split(" · ")[0]:"",m.equipamentoId?nomeEquip(m.equipamentoId):""].filter(Boolean).join(" · ")||"Local não informado";
const areaDe=p=>p.area||"logistica";
const equipeMan=incl=>S.equipe.filter(p=>(p.ativo!==false&&areaDe(p)!=="logistica")||(incl||[]).includes(p.id)).sort(sortNome);
const freqInfo=k=>(FREQS.find(f=>f[0]===k)||FREQS[2]);
function mhist(m,s,nota){return (m.historico||[]).concat([{s,em:nowISO(),por:S.uid||null,nota:nota||""}])}
const faltaMan=()=>!S.demo&&S.missing&&S.missing.manutencoes;
function avisoSQL(){return faltaMan()?`<div class="banner"><b>Falta um passo no Supabase.</b> Rode o arquivo <code>supabase/08_manutencao.sql</code> no SQL Editor para ativar a manutenção. Veja o README, atualização 10.</div>`:""}

/* ---------- gravação ---------- */
function localUpsertM(id,data){const i=S.manutencoes.findIndex(o=>o.id===id);if(i>=0)S.manutencoes[i]=Object.assign({},S.manutencoes[i],data);else S.manutencoes.unshift(Object.assign({id},data))}
async function saveM(id,data){
  if(S.demo){ if(!byId(S.manutencoes,id)&&!data.numero) data.numero=S.manutencoes.reduce((mx,o)=>Math.max(mx,o.numero||0),0)+1; localUpsertM(id,data);render();return byId(S.manutencoes,id) }
  const ex=S.manutencoes.some(o=>o.id===id);
  if(ex){const {error}=await sb.from("manutencoes").update(toDb(data)).eq("id",id);if(error)throw error;localUpsertM(id,data);render();return byId(S.manutencoes,id)}
  const {data:row,error}=await sb.from("manutencoes").insert(toDb(Object.assign({id},data))).select().single();if(error)throw error;
  const o=fromDb(row);localUpsertM(id,o);render();return o;
}
async function saveCadM(t,id,data){
  if(S.demo){const x=id&&byId(S[t],id);if(x){Object.assign(x,data);return x}const r=Object.assign({id:novoId(),ativo:true,criadoEm:nowISO()},data);S[t].push(r);return r}
  if(id){const {error}=await sb.from(t).update(toDb(data)).eq("id",id);if(error)throw error;await carregar(t);return byId(S[t],id)}
  const {data:row,error}=await sb.from(t).insert(toDb(data)).select().single();if(error)throw error;await carregar(t);return fromDb(row);
}
async function apagarCadM(t,id){ if(!S.demo){const {error}=await sb.from(t).delete().eq("id",id);if(error)throw error;await carregar(t)} else S[t]=S[t].filter(x=>x.id!==id) }

/* ---------- peças de interface reaproveitadas ---------- */
const fotosM=(arr,rm)=>`<div class="photos">${(arr||[]).map((f,i)=>`<div class="ph"><button type="button" data-zoom="${esc(f.url)}" aria-label="Ampliar foto ${i+1}"><img src="${esc(f.url)}" alt="Foto ${i+1}" loading="lazy"></button>${rm?`<button type="button" class="rm" data-rmf="${i}" aria-label="Remover foto">×</button>`:""}</div>`).join("")}</div>`;
const uplHTML=(idc,idg)=>`<div class="upl-row"><label class="upl"><input type="file" accept="image/*" capture="environment" id="${idc}" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="4"/></svg><span>Tirar foto</span></label><label class="upl alt"><input type="file" accept="image/*" multiple id="${idg}" data-up><svg class="upl-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg><span>Escolher da galeria</span></label></div>`;
const sigHTML=(A,lbl)=>`<div class="field"><span class="lbl">${esc(lbl)}</span><div class="sig" id="sigBox"><canvas id="sigC" aria-label="Área de assinatura"></canvas><span class="sig-ph" id="sigPh"${(A.sig||[]).length?" hidden":""}>Assine aqui com o dedo</span></div><div class="actions"><button type="button" class="btn sm ghost" id="sigClr">Limpar assinatura</button></div></div>`;
function bindZoom(root){$$("[data-zoom]",root).forEach(b=>b.onclick=()=>{const lb=document.createElement("div");lb.className="lb";lb.innerHTML=`<img src="${esc(b.dataset.zoom)}" alt="Foto ampliada">`;lb.onclick=()=>lb.remove();document.body.appendChild(lb)})}
// liga botões de foto: arr é a lista que recebe as fotos; redraw redesenha
function bindUploads(root,getArr,redraw,errEl,setBusy){
  $$("[data-rmf]",root).forEach(b=>b.onclick=()=>{getArr().splice(+b.dataset.rmf,1);redraw()});
  $$("[data-up]",root).forEach(up=>up.onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;
    up.parentElement.querySelector("span").textContent="Enviando "+fs.length+" foto"+(fs.length>1?"s":"")+"…";$$("[data-up]",root).forEach(x=>x.disabled=true);
    if(setBusy)setBusy(true);const r=await uploadFiles(fs,errEl);if(setBusy)setBusy(false);getArr().push(...r);redraw()});
}
function optsEquip(localId,sel){
  const lista=S.equipamentos.filter(e=>(e.ativo!==false||e.id===sel)&&(!localId||e.localId===localId||e.id===sel)).sort(sortNome);
  return `<option value="">${lista.length?"Nenhum equipamento específico":"Nenhum equipamento cadastrado"+(localId?" neste local":"")}</option>`+lista.map(e=>`<option value="${esc(e.id)}"${e.id===sel?" selected":""}>${esc(e.nome)}${e.codigo?" · "+esc(e.codigo):""}${!localId&&e.localId?" ("+esc(siglaLocal(byId(S.locais,e.localId)))+")":""}</option>`).join("");
}
const optsPrest=sel=>`<option value="">Escolha o prestador…</option>`+S.prestadores.filter(p=>p.ativo!==false||p.id===sel).sort(sortNome).map(p=>`<option value="${esc(p.id)}"${p.id===sel?" selected":""}>${esc(p.nome)}${p.especialidade?" · "+esc(p.especialidade):""}</option>`).join("");
function execHTML(X){ // X: {executor,equipeIds,prestadorId}
  const eq=equipeMan(X.equipeIds);
  return `<div class="field full"><span class="lbl">Quem executa</span><div class="seg2" role="group" aria-label="Quem executa"><button type="button" data-exe="interno" aria-pressed="${X.executor!=="terceiro"}">Equipe interna</button><button type="button" data-exe="terceiro" aria-pressed="${X.executor==="terceiro"}">Prestador (terceiro)</button></div></div>
    <div class="field full" id="exInt"${X.executor==="terceiro"?" hidden":""}><span class="lbl">Técnicos</span><div class="chips">${eq.length?eq.map(p=>`<button type="button" class="chip" data-meq="${esc(p.id)}" aria-pressed="${(X.equipeIds||[]).includes(p.id)}">${esc(p.nome)}${p.funcao?`<small>${esc(p.funcao)}</small>`:""}</button>`).join(""):`<span class="hint">Cadastre os técnicos em Cadastros → Equipe, com área Manutenção.</span>`}</div></div>
    <div class="field full" id="exTer"${X.executor==="terceiro"?"":" hidden"}><label for="mPrest">Prestador</label><select id="mPrest">${optsPrest(X.prestadorId)}</select>${S.prestadores.length?"":`<span class="hint">Cadastre prestadores em Cadastros → Prestadores.</span>`}</div>`;
}
function bindExec(root,X){
  $$("[data-exe]",root).forEach(b=>b.onclick=()=>{X.executor=b.dataset.exe;$$("[data-exe]",root).forEach(x=>x.setAttribute("aria-pressed",x===b));$("#exInt",root).hidden=X.executor==="terceiro";$("#exTer",root).hidden=X.executor!=="terceiro"});
  $$("[data-meq]",root).forEach(b=>b.onclick=()=>{const id=b.dataset.meq;X.equipeIds=X.equipeIds||[];const i=X.equipeIds.indexOf(id);if(i>=0)X.equipeIds.splice(i,1);else X.equipeIds.push(id);b.setAttribute("aria-pressed",i<0)});
  const ps=$("#mPrest",root);if(ps)ps.onchange=()=>{X.prestadorId=ps.value};
}
const executorOk=X=>X.executor==="terceiro"?!!X.prestadorId:(X.equipeIds||[]).length>0;

/* ---------- LISTA ---------- */
function filtraM(){
  const f=S.mlf,q=f.q.trim().toLowerCase();
  return S.manutencoes.filter(m=>{
    if(f.status==="novos"&&m.status!=="aberto")return false;
    if(f.status==="abertas"&&!MABERTOS.includes(m.status))return false;
    if(f.status==="atrasadas"&&!mAtrasada(m))return false;
    if(["agendada","em_execucao","aguardando","concluida","cancelada"].includes(f.status)&&m.status!==f.status)return false;
    if(f.local&&m.localId!==f.local)return false;
    if(f.cat&&m.categoria!==f.cat)return false;
    if(f.tipo&&m.tipo!==f.tipo)return false;
    if(q){const hay=[codM(m),m.titulo,m.descricao,m.solicitante,m.categoria,ondeM(m),executorTxt(m),m.solucao,m.diagnostico].join(" ").toLowerCase();if(!hay.includes(q))return false}
    return true;
  });
}
function mRowHTML(m){
  const late=mAtrasada(m),lateC=mConclAtraso(m);const pr=m.prioridade||"normal";const ct=custoTotal(m);
  return `<button class="row" type="button" data-mopen="${esc(m.id)}">
    <span class="cod num">${codM(m)}<small>${m.tipo==="preventiva"?"Preventiva":"Corretiva"}</small></span>
    <span class="rt"><b>${esc(tituloM(m))}</b><span>${esc(ondeM(m))}</span></span>
    <span class="meta"><div>${MABERTOS.includes(m.status)?`Prazo <b class="num">${fDH(new Date(prazoM(m)).toISOString())}</b>`:m.concluidoEm?`Concluída <b class="num">${fDH(m.concluidoEm)}</b>`:`Aberta <b class="num">${fDH(m.criadoEm)}</b>`}${pr!=="normal"?` · <span class="prio-${pr}">${esc((MPRIOS.find(p=>p[0]===pr)||[,""])[1])}</span>`:""}</div><div>${esc(m.categoria||"Sem categoria")}</div></span>
    <span class="meta meta2"><div>${esc(m.status==="aberto"?"Aguardando triagem":executorTxt(m))}</div><div>${ct?`<span class="money">${fBRL(ct)}</span>`:m.agendadoPara?"Programada "+fDH(m.agendadoPara):""}</div></span>
    <span class="stc"><span class="st ${m.status}">${MST[m.status]||m.status}</span>${m.status==="aguardando"&&m.aguardandoMotivo?`<span class="late" style="color:var(--s-wait)">${esc(m.aguardandoMotivo.split(":")[0])}</span>`:late?`<span class="late">Atrasada</span>`:lateC?`<span class="late">Concluída com atraso</span>`:""}</span>
  </button>`;
}
function renderMOrdens(){
  const f=S.mlf;
  const segs=[["novos","Chamados novos"],["abertas","Em aberto"],["atrasadas","Atrasadas"],["agendada","Programadas"],["em_execucao","Em execução"],["aguardando","Aguardando"],["concluida","Concluídas"],["cancelada","Canceladas"],["todas","Todas"]];
  const L=S.manutencoes;
  const cnt=k=>k==="todas"?L.length:k==="novos"?L.filter(m=>m.status==="aberto").length:k==="abertas"?L.filter(m=>MABERTOS.includes(m.status)).length:k==="atrasadas"?L.filter(mAtrasada).length:L.filter(m=>m.status===k).length;
  let h=`<div class="head"><div><h1>Chamados e <em>OS</em></h1><p>Chamados abertos pelos setores e ordens de manutenção corretiva e preventiva, da triagem à conclusão com foto.</p></div>${isMan()?`<div class="act"><a class="btn pri" href="#m-nova">Nova OS de manutenção</a></div>`:""}</div>${banner()}${avisoSQL()}
  <div class="seg" role="group" aria-label="Situação">${segs.map(([k,l])=>`<button type="button" data-mseg="${k}" aria-pressed="${f.status===k}">${l}<span class="c num">${cnt(k)}</span></button>`).join("")}</div>
  <div class="filters">
    <div class="field grow"><label for="mq">Buscar</label><input type="search" id="mq" placeholder="Número, problema, local, equipamento, técnico…" value="${esc(f.q)}"></div>
    <details class="fx" id="mfx"${f.more||window.innerWidth>760?" open":""}><summary class="btn sm">Filtros${(f.local||f.cat||f.tipo)?" ativos":""}</summary><div class="fx-in">
    <div class="field"><label for="mLocF">Local</label><select id="mLocF">${opts(ativos(S.locais).filter(l=>l.tipo!=="Fornecedor"),f.local,"Todos")}</select></div>
    <div class="field"><label for="mCatF">Categoria</label><select id="mCatF"><option value="">Todas</option>${optsS(MCATS,f.cat)}</select></div>
    <div class="field"><label for="mTipF">Tipo</label><select id="mTipF">${optsS([["","Todos"],["corretiva","Corretiva"],["preventiva","Preventiva"]],f.tipo)}</select></div>
  </div></details></div>`;
  if(!S.demo&&!S.loaded.manutencoes&&!faltaMan()){app.innerHTML=h+`<div class="empty"><h3>Carregando manutenções…</h3></div>`;bindMOrdens();return}
  let list=filtraM();
  if(f.status!=="concluida"&&f.status!=="cancelada"&&f.status!=="todas") list.sort((a,b)=>({urgente:0,alta:1,normal:2,baixa:3}[a.prioridade]-{urgente:0,alta:1,normal:2,baixa:3}[b.prioridade])||prazoM(a)-prazoM(b));
  else list.sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  if(!L.length) h+=`<div class="empty"><h3>Nenhuma manutenção registrada ainda</h3><p>Os chamados dos setores aparecem aqui assim que são abertos.${isMan()?' Você também pode <a href="#m-nova">registrar uma OS</a> ou criar um <a href="#m-prev">plano preventivo</a>.':""}</p></div>`;
  else if(!list.length) h+=`<div class="empty"><h3>Nada com esses filtros</h3><p>${f.status==="novos"?"Nenhum chamado esperando triagem.":"Ajuste a situação, o local ou a busca."}</p></div>`;
  else h+=`<div class="list">${list.slice(0,300).map(mRowHTML).join("")}</div>`;
  app.innerHTML=h;bindMOrdens();
}
function bindMOrdens(){
  $$("[data-mseg]").forEach(b=>b.onclick=()=>{S.mlf.status=b.dataset.mseg;renderMOrdens()});
  let tm;$("#mq").oninput=e=>{clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{S.mlf.q=v;renderMOrdens()},220)};
  $("#mfx").ontoggle=e=>{S.mlf.more=e.target.open};
  $("#mLocF").onchange=e=>{S.mlf.local=e.target.value;renderMOrdens()};
  $("#mCatF").onchange=e=>{S.mlf.cat=e.target.value;renderMOrdens()};
  $("#mTipF").onchange=e=>{S.mlf.tipo=e.target.value;renderMOrdens()};
  bindMOpen();
}
function bindMOpen(root){$$("[data-mopen]",root).forEach(b=>b.onclick=()=>openM(b.dataset.mopen))}

/* ---------- MEUS CHAMADOS (setor) ---------- */
function mCard(m){
  return `<button class="mcard" type="button" data-mopen="${esc(m.id)}"><div style="min-width:0"><div class="t">${esc(tituloM(m))}</div><div class="m">${codM(m)} · aberto ${fDH(m.criadoEm)}</div><div class="m">${esc(ondeM(m))}</div>
    ${m.status!=="aberto"&&m.status!=="cancelada"?`<div class="m">Atendimento: ${esc(executorTxt(m))}${m.agendadoPara?" · "+fDH(m.agendadoPara):""}</div>`:""}
    ${m.status==="aguardando"&&m.aguardandoMotivo?`<div class="m" style="color:var(--s-wait)">Aguardando ${esc(m.aguardandoMotivo.toLowerCase())}</div>`:""}
    ${m.status==="concluida"&&m.solucao?`<div class="m"><b style="color:var(--ink)">Solução:</b> ${esc(m.solucao)}</div>`:""}</div>
    <div class="side"><span class="st ${m.status}">${m.status==="aberto"?"Aguardando triagem":MST[m.status]}</span></div></button>`;
}
function renderMMeus(){
  const list=S.manutencoes.filter(m=>m.solicitanteId===S.uid||S.demo&&m.solicitanteId==="demo").sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  const ab=list.filter(m=>MABERTOS.includes(m.status)).length;
  let h=`<div class="head"><div><h1>Meus <em>chamados</em></h1><p>Acompanhe os chamados de manutenção que você abriu: quem vai atender, quando, e a foto do serviço pronto.</p></div><div class="act"><a class="btn pri" href="#m-chamado">Abrir chamado</a></div></div>${banner()}${avisoSQL()}`;
  if(!S.demo&&!S.loaded.manutencoes&&!faltaMan()) h+=`<div class="empty"><h3>Carregando seus chamados…</h3></div>`;
  else if(!list.length) h+=`<div class="empty"><h3>Você ainda não abriu chamados</h3><p>Algo quebrado, com vazamento, sem funcionar? <a href="#m-chamado">Abra um chamado</a> com uma foto. Se o equipamento tiver etiqueta, aponte a câmera para o QR Code.</p></div>`;
  else h+=`<p style="color:var(--mute);margin:0 0 12px">${ab?ab+" em andamento.":"Nenhum chamado em andamento."}</p><div class="list">${list.map(mCard).join("")}</div>`;
  app.innerHTML=h;bindMOpen();
}

/* ---------- ABRIR CHAMADO (setor) ---------- */
let MF=null;
function localDoSetor(id){const s=byId(S.setores,id);return s?s.localId||"":""}
function renderMChamado(){
  if(S.role==="ver"){app.innerHTML=`<div class="head"><div><h1>Abrir chamado</h1></div></div>${banner()}`;return}
  const eq=S.routeArg?byId(S.equipamentos,S.routeArg):null;
  MF={localId:eq?eq.localId||"":localDoSetor(S.meuSetor),setorId:eq&&eq.setorId?eq.setorId:(S.meuSetor||""),equipamentoId:eq?eq.id:"",fotos:[],busy:false};
  app.innerHTML=`<div class="head"><div><h1>Abrir chamado de <em>manutenção</em></h1><p>Conte o que aconteceu e mande uma foto. A equipe de Facilities faz a triagem, define quem atende e você acompanha em Meus chamados.</p></div></div>${banner()}${avisoSQL()}
  <form class="form" id="fM" novalidate>
    ${eq?`<div class="hint-box">Chamado para o equipamento <b>${esc(eq.nome)}</b>${eq.codigo?" ("+esc(eq.codigo)+")":""}${eq.localId?" · "+esc(nomeLocal(eq.localId)):""}.</div>`:""}
    <section class="fs"><h2>O que está acontecendo?</h2><div class="fg">
      <div class="field full"><label class="req" for="mDesc">Descreva o problema</label><textarea id="mDesc" rows="4" placeholder="Ex.: ar-condicionado do salão pingando água em cima da mesa 4; tomada da bancada sem energia"></textarea></div>
      <div class="field full"><span class="lbl">Fotos do problema</span><div id="mFotos">${fotosM(MF.fotos,true)}</div>${uplHTML("mUp","mUpg")}<span class="hint">Ajuda muito a equipe a já levar a peça certa.</span></div>
      <div class="field"><label for="mPrio">Urgência</label><select id="mPrio">${optsS(MPRIO_SOL,"normal")}</select></div>
      <div class="field"><label for="mCat">Tipo de problema</label><select id="mCat"><option value="">Não sei</option>${optsS(MCATS,eq&&eq.categoria||"")}</select></div>
    </div></section>
    <section class="fs"><h2>Onde</h2><div class="fg">
      <div class="field"><label class="req" for="mLoc-q">Local</label>${pickerHTML("mLoc",MF.localId,"Local")}</div>
      <div class="field"><label for="mSet">Setor</label><select id="mSet">${optsSetores(MF.setorId,"Selecione…")}</select></div>
      <div class="field"><label for="mDet">Onde exatamente</label><input type="text" id="mDet" placeholder="Ex.: banheiro masculino do 2º andar"></div>
      <div class="field"><label for="mEq">Equipamento</label><select id="mEq">${optsEquip(MF.localId,MF.equipamentoId)}</select></div>
    </div></section>
    <section class="fs"><h2>Contato</h2><div class="fg">
      <div class="field"><label class="req" for="mTel">Seu WhatsApp</label><input type="tel" id="mTel" inputmode="tel" value="${esc(S.meuTelefone||"")}" placeholder="(11) 99999-9999"><span class="hint">Para a equipe falar com você e avisar quando terminar</span></div>
    </div></section>
    <div class="form-foot"><span class="err" id="fErr" role="alert"></span><a class="btn" href="#m-meus">Descartar</a><button class="btn pri" type="submit" id="fSave">Enviar chamado</button></div>
  </form>`;
  bindMChamado();
}
function bindMChamado(){
  bindPicker("mLoc",id=>{MF.localId=id;const e=$("#mEq");const cur=e.value;e.innerHTML=optsEquip(id,byId(S.equipamentos,cur)&&byId(S.equipamentos,cur).localId===id?cur:"")});
  $("#mEq").onchange=e=>{const q=byId(S.equipamentos,e.target.value);if(q&&q.localId&&!$("#mLoc").value){$("#mLoc").value=q.localId;$("#mLoc-q").value=nomeLocal(q.localId)}if(q&&q.categoria&&!$("#mCat").value)$("#mCat").value=q.categoria};
  const redraw=()=>{$("#mFotos").innerHTML=fotosM(MF.fotos,true);$$("[data-up]").forEach(x=>{x.disabled=false;x.value=""});$("#mUp").parentElement.querySelector("span").textContent="Tirar foto";$("#mUpg").parentElement.querySelector("span").textContent="Escolher da galeria";bindUploads($("#fM"),()=>MF.fotos,redraw,$("#fErr"),v=>MF.busy=v);bindZoom($("#mFotos"))};
  bindUploads($("#fM"),()=>MF.fotos,redraw,$("#fErr"),v=>MF.busy=v);
  $("#fM").onsubmit=async e=>{e.preventDefault();const err=$("#fErr");
    if(MF.busy){err.textContent="Aguarde o envio das fotos.";return}
    const d={descricao:$("#mDesc").value.trim(),prioridade:$("#mPrio").value,categoria:$("#mCat").value||null,localId:$("#mLoc").value,setorId:$("#mSet").value,localDetalhe:$("#mDet").value.trim(),equipamentoId:$("#mEq").value,solicitanteTelefone:$("#mTel").value.trim()};
    const errs=[];if(!d.descricao)errs.push("a descrição do problema");if(!d.localId)errs.push("o local");if(!d.solicitanteTelefone)errs.push("seu WhatsApp");
    if(errs.length){err.textContent="Preencha: "+errs.join(", ")+".";return}
    if(!foneValido(d.solicitanteTelefone)){err.textContent="Informe o WhatsApp com DDD, por exemplo (11) 99999-9999.";return}
    const btn=$("#fSave");btn.disabled=true;btn.textContent="Enviando…";err.textContent="";
    const now=nowISO();const id=novoId();
    Object.assign(d,{status:"aberto",tipo:"corretiva",solicitanteId:S.uid||null,solicitante:S.meName||"",fotosAbertura:MF.fotos,criadoEm:now,atualizadoEm:now,historico:[{s:"aberto",em:now,por:S.uid||null,nota:"Chamado aberto"+(MF.fotos.length?" com "+MF.fotos.length+" foto"+(MF.fotos.length>1?"s":""):"")}]});
    if(!S.demo){delete d.criadoEm;delete d.atualizadoEm}
    try{const row=await saveM(id,d);
      if(!S.demo&&soDigitos(d.solicitanteTelefone)!==soDigitos(S.meuTelefone)){try{const {error}=await sb.from("perfis").update({telefone:d.solicitanteTelefone}).eq("id",S.uid);if(!error)S.meuTelefone=d.solicitanteTelefone}catch(x){}}else S.meuTelefone=d.solicitanteTelefone;
      toast(codM(row||d)+" aberto. A equipe de Facilities já foi avisada.");location.hash=isMan()?"#m-ordens":"#m-meus";
    }catch(x){console.error(x);btn.disabled=false;btn.textContent="Enviar chamado";
      err.textContent=/row-level security/i.test(x.message||"")?"Seu acesso não permite abrir chamados. Peça à coordenação o acesso de Solicitante.":/does not exist|schema cache/i.test(x.message||"")?"A manutenção ainda não foi ativada no Supabase (script 08).":"Não foi possível enviar. Verifique a conexão e tente novamente."}
  };
}

/* ---------- NOVA / EDITAR OS DE MANUTENÇÃO (Facilities) ---------- */
function renderMNova(){
  if(!isMan()){location.replace("#m-chamado"+(S.routeArg?"/"+S.routeArg:""));return}
  const ed=S.mEditId?byId(S.manutencoes,S.mEditId):null;
  const eq=!ed&&S.routeArg?byId(S.equipamentos,S.routeArg):null;
  MF=ed?JSON.parse(JSON.stringify(ed)):{tipo:"corretiva",prioridade:"normal",categoria:eq&&eq.categoria||"",localId:eq?eq.localId||"":"",setorId:eq?eq.setorId||"":"",equipamentoId:eq?eq.id:"",localDetalhe:"",descricao:"",solicitante:"",solicitanteTelefone:"",
    executor:"interno",equipeIds:[],prestadorId:"",agendadoPara:null,prazo:null,observacoes:"",fotosAbertura:[]};
  MF.fotosAbertura=MF.fotosAbertura||[];MF.equipeIds=MF.equipeIds||[];MF.busy=false;
  const abrir=!!ed||false;
  app.innerHTML=`<div class="head"><div><h1>${ed?"Editar <em>"+codM(ed)+"</em>":"Nova OS de <em>manutenção</em>"}</h1><p>${ed?"Ajuste os dados. A alteração fica registrada no histórico.":"Registre o problema. Com técnico ou prestador definido, a OS já entra como programada; sem isso, fica como chamado aberto para a triagem."}</p></div></div>${banner()}${avisoSQL()}
  <form class="form" id="fM" novalidate>
    <section class="fs"><h2>O quê e onde</h2><div class="fg">
      <div class="field full"><label class="req" for="mDesc">Problema ou serviço</label><textarea id="mDesc" rows="3" placeholder="Ex.: trocar o reator da luminária do corredor; vazamento na pia da cozinha">${esc(MF.descricao||"")}</textarea></div>
      <div class="field"><label class="req" for="mLoc-q">Local</label>${pickerHTML("mLoc",MF.localId,"Local")}</div>
      <div class="field"><label for="mEq">Equipamento</label><select id="mEq">${optsEquip(MF.localId,MF.equipamentoId)}</select></div>
      <div class="field"><label for="mCat">Categoria</label><select id="mCat"><option value="">Selecione…</option>${optsS(MCATS,MF.categoria||"")}</select></div>
      <div class="field"><label for="mPrio">Prioridade</label><select id="mPrio">${optsS(MPRIOS,MF.prioridade||"normal")}</select><span class="hint" id="slaH">Prazo padrão: ${fDur(slaH(MF.prioridade||"normal")*3600000)}</span></div>
      <div class="field full"><span class="lbl">Fotos do problema</span><div id="mFotos">${fotosM(MF.fotosAbertura,true)}</div>${uplHTML("mUp","mUpg")}</div>
    </div></section>
    <details class="fs" id="mMais"${abrir?" open":""}><summary>Mais detalhes <small>setor, quem pediu, programação, prazo</small></summary><div class="fg">
      <div class="field"><label for="mTipo">Tipo</label><select id="mTipo">${optsS([["corretiva","Corretiva"],["preventiva","Preventiva"]],MF.tipo)}</select></div>
      <div class="field"><label for="mSet">Setor</label><select id="mSet">${optsSetores(MF.setorId||"","Selecione…")}</select></div>
      <div class="field"><label for="mDet">Onde exatamente</label><input type="text" id="mDet" value="${esc(MF.localDetalhe||"")}" placeholder="Ex.: banheiro masculino do 2º andar"></div>
      <div class="field"><label for="mSol">Quem pediu</label><input type="text" id="mSol" list="dlSolicM" autocomplete="off" value="${esc(MF.solicitante||"")}" placeholder="Opcional"><datalist id="dlSolicM">${S.solicitantes.filter(c=>c.ativo!==false).sort(sortNome).map(c=>`<option value="${esc(c.nome)}"></option>`).join("")}</datalist></div>
      <div class="field"><label for="mTel">WhatsApp de quem pediu</label><input type="tel" id="mTel" inputmode="tel" value="${esc(MF.solicitanteTelefone||"")}" placeholder="Opcional · recebe o aviso de conclusão"></div>
      ${execHTML(MF)}
      <div class="field"><label for="mAg">Programado para</label><input type="datetime-local" id="mAg" value="${toInput(MF.agendadoPara)}"></div>
      <div class="field"><label for="mPz">Prazo para concluir</label><input type="datetime-local" id="mPz" value="${toInput(MF.prazo)}"><span class="hint">Vazio = prazo padrão da prioridade</span></div>
      <div class="field full"><label for="mObs">Observações</label><textarea id="mObs" placeholder="Acesso, horário liberado pelo setor, material necessário…">${esc(MF.observacoes||"")}</textarea></div>
    </div></details>
    <div class="form-foot"><span class="err" id="fErr" role="alert"></span><a class="btn" href="#m-ordens" id="fCancel">Descartar</a><button class="btn pri" type="submit" id="fSave">${ed?"Salvar alterações":"Registrar OS"}</button></div>
  </form>`;
  bindPicker("mLoc",id=>{const e=$("#mEq");const cur=e.value;e.innerHTML=optsEquip(id,byId(S.equipamentos,cur)&&byId(S.equipamentos,cur).localId===id?cur:"")});
  $("#mEq").onchange=e=>{const q=byId(S.equipamentos,e.target.value);if(!q)return;if(q.localId&&!$("#mLoc").value){$("#mLoc").value=q.localId;$("#mLoc-q").value=nomeLocal(q.localId)}if(q.categoria&&!$("#mCat").value)$("#mCat").value=q.categoria;if(q.setorId&&!$("#mSet").value)$("#mSet").value=q.setorId};
  $("#mPrio").onchange=e=>{$("#slaH").textContent="Prazo padrão: "+fDur(slaH(e.target.value)*3600000)};
  $("#mSol").addEventListener("input",()=>{const c=acharContato($("#mSol").value);if(c){if(!$("#mTel").value)$("#mTel").value=c.telefone||"";if(c.setorId&&!$("#mSet").value)$("#mSet").value=c.setorId}});
  bindExec($("#fM"),MF);
  const redraw=()=>{$("#mFotos").innerHTML=fotosM(MF.fotosAbertura,true);$$("[data-up]").forEach(x=>{x.disabled=false;x.value=""});$("#mUp").parentElement.querySelector("span").textContent="Tirar foto";$("#mUpg").parentElement.querySelector("span").textContent="Escolher da galeria";bindUploads($("#fM"),()=>MF.fotosAbertura,redraw,$("#fErr"),v=>MF.busy=v);bindZoom($("#mFotos"))};
  bindUploads($("#fM"),()=>MF.fotosAbertura,redraw,$("#fErr"),v=>MF.busy=v);
  $("#fCancel").onclick=e=>{const back=S.mEditId;S.mEditId=null;if(back){e.preventDefault();location.hash="#m-ordens";setTimeout(()=>openM(back),50)}};
  $("#fM").onsubmit=submitMNova;
}
async function submitMNova(e){
  e.preventDefault();const err=$("#fErr");if(MF.busy){err.textContent="Aguarde o envio das fotos.";return}
  const v=id=>$(id).value;
  const d={descricao:v("#mDesc").trim(),localId:v("#mLoc"),equipamentoId:v("#mEq"),categoria:v("#mCat")||null,prioridade:v("#mPrio"),fotosAbertura:MF.fotosAbertura,tipo:v("#mTipo"),setorId:v("#mSet"),localDetalhe:v("#mDet").trim(),
    solicitante:v("#mSol").trim(),solicitanteTelefone:v("#mTel").trim(),executor:MF.executor||"interno",equipeIds:MF.executor==="terceiro"?[]:(MF.equipeIds||[]).slice(),prestadorId:MF.executor==="terceiro"?(MF.prestadorId||""):"",
    agendadoPara:fromInput(v("#mAg")),prazo:fromInput(v("#mPz")),observacoes:v("#mObs").trim()};
  const errs=[];if(!d.descricao)errs.push("o problema ou serviço");if(!d.localId)errs.push("o local");
  if(errs.length){err.textContent="Preencha: "+errs.join(", ")+".";return}
  if(d.solicitanteTelefone&&!foneValido(d.solicitanteTelefone)){err.textContent="O WhatsApp de quem pediu precisa ter DDD e número.";$("#mMais").open=true;return}
  const btn=$("#fSave");const txt=btn.textContent;btn.disabled=true;btn.textContent="Salvando…";err.textContent="";
  const pronto=executorOk(d);const now=nowISO();
  try{
    if(S.mEditId){const m=byId(S.manutencoes,S.mEditId);let st=m.status,extra={};
      if(m.status==="aberto"&&pronto){st="agendada";extra.triadoEm=now}
      await saveM(m.id,Object.assign(d,extra,{status:st,atualizadoEm:now,historico:mhist(m,st,st!==m.status?"Programada na edição":"Dados alterados")}));
      const id=m.id;S.mEditId=null;toast(codM(m)+" atualizada");location.hash="#m-ordens";setTimeout(()=>openM(id),60);
    }else{
      const id=novoId();const st=pronto?"agendada":"aberto";
      Object.assign(d,{status:st,solicitanteId:S.uid||null,criadoEm:now,atualizadoEm:now,triadoEm:pronto?now:null,custos:[],
        historico:[{s:"aberto",em:now,por:S.uid||null,nota:"OS registrada por Facilities"}].concat(pronto?[{s:"agendada",em:now,por:S.uid||null,nota:"Executor: "+executorTxt(d)}]:[])});
      if(!d.solicitante) d.solicitante="";
      const row=await saveM(id,d);toast(codM(row||d)+" registrada");location.hash="#m-ordens";setTimeout(()=>openM(id),60);
    }
  }catch(x){console.error(x);btn.disabled=false;btn.textContent=txt;err.textContent="Não foi possível salvar. "+(x&&x.message?"("+x.message+")":"Verifique a conexão.")}
}

/* ---------- DETALHE DA MANUTENÇÃO ---------- */
function openM(id){S.mOpen=id;S.mAct=null;renderMDrawer()}
function renderMDrawer(){
  const m=byId(S.manutencoes,S.mOpen);if(!m){if(S.loaded.manutencoes||S.demo)closeOS();return}
  const prev=$(".dr")?$(".dr").scrollTop:0;const A=S.mAct;const log=isMan();
  const late=mAtrasada(m),lateC=mConclAtraso(m);const ct=custoTotal(m);
  const meu=m.solicitanteId&&m.solicitanteId===S.uid;
  let acts="";
  if(log){
    if(m.status==="aberto") acts=`<button class="btn pri" data-mact="triagem">Fazer triagem</button><button class="btn" data-mact="editar">Editar</button><button class="btn danger" data-mact="cancelar">Cancelar</button>`;
    if(m.status==="agendada") acts=`<button class="btn pri" data-mact="iniciar">Iniciar serviço</button><button class="btn" data-mact="triagem">Reprogramar</button><button class="btn danger" data-mact="cancelar">Cancelar</button>`;
    if(m.status==="em_execucao") acts=`<button class="btn pri" data-mact="concluir">Concluir serviço</button><button class="btn" data-mact="pausar">Aguardando peça ou orçamento</button><button class="btn" data-mact="custos">Lançar custos</button>`;
    if(m.status==="aguardando") acts=`<button class="btn pri" data-mact="retomar">Retomar serviço</button><button class="btn" data-mact="concluir">Concluir serviço</button><button class="btn" data-mact="custos">Lançar custos</button>`;
    if(m.status==="concluida") acts=`${m.solicitanteTelefone?`<button class="btn wa" data-mact="avisar">${m.avisadoEm?"Avisar de novo no WhatsApp":"Avisar no WhatsApp"}</button>`:""}<button class="btn" data-mact="custos">Lançar custos</button>`;
    if(m.status==="cancelada") acts=`<button class="btn" data-mact="reabrir">Reabrir</button>`;
    acts+=`<button class="btn" data-mact="editar"${m.status==="aberto"?" hidden":""}>Editar</button><button class="btn ghost danger" data-mact="excluir">Excluir</button>`;
  } else if(meu&&m.status==="aberto") acts=`<button class="btn danger" data-mact="cancelar">Cancelar chamado</button>`;
  let panel="";
  if(A&&A.t==="triagem") panel=`<div class="panel" id="pan"><h3>${m.status==="aberto"?"Triagem do chamado":"Reprogramar"}</h3><div class="fg">
      <div class="field"><label for="tCat">Categoria</label><select id="tCat" data-a="categoria"><option value="">Selecione…</option>${optsS(MCATS,A.categoria||"")}</select></div>
      <div class="field"><label for="tPrio">Prioridade</label><select id="tPrio" data-a="prioridade">${optsS(MPRIOS,A.prioridade)}</select></div>
      ${execHTML(A)}
      <div class="field"><label for="tAg">Programado para</label><input type="datetime-local" id="tAg" data-a="ag" value="${esc(A.ag||"")}"></div>
      <div class="field"><label for="tPz">Prazo para concluir</label><input type="datetime-local" id="tPz" data-a="pz" value="${esc(A.pz||"")}"><span class="hint">Vazio = ${fDur(slaH(A.prioridade)*3600000)} a partir da abertura</span></div>
      <div class="field full"><label for="tObs">Orientação para a equipe</label><textarea id="tObs" data-a="obs" placeholder="Material a levar, falar com…, horário liberado">${esc(A.obs||"")}</textarea></div></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk">Salvar programação</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="iniciar") panel=`<div class="panel" id="pan"><h3>Iniciar serviço</h3>
      <div class="field"><span class="lbl">Fotos do antes</span>${fotosM(A.fotos,true)}${uplHTML("upA","upAg")}<span class="hint">Opcional. Mostra a situação encontrada.</span></div>
      <div class="field"><label for="iDiag">Diagnóstico inicial</label><textarea id="iDiag" data-a="diag" placeholder="O que foi encontrado no local">${esc(A.diag||"")}</textarea></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk"${A.busy?" disabled":""}>Começar agora</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="pausar") panel=`<div class="panel" id="pan"><h3>Aguardando para continuar</h3>
      <div class="field"><span class="lbl req">O que falta</span><div class="chips">${ESPERAS.map(x=>`<button type="button" class="chip" data-esp="${esc(x)}" aria-pressed="${A.esp===x}">${esc(x)}</button>`).join("")}</div></div>
      <div class="fg"><div class="field full"><label for="pDet">Detalhe</label><input type="text" id="pDet" data-a="det" value="${esc(A.det||"")}" placeholder="Ex.: compressor 18.000 BTU pedido ao fornecedor"></div>
      <div class="field"><label for="pOrc">Valor do orçamento (R$)</label><input type="text" id="pOrc" data-a="orc" inputmode="decimal" value="${esc(A.orc||"")}" placeholder="Opcional"></div></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk">Marcar como aguardando</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  const custosHTML=()=>`<div class="field"><span class="lbl">Custos</span><div class="cu" id="cuL">${A.custos.map((c,i)=>`<div class="cu-r"><input type="text" id="cu-d-${i}" aria-label="Descrição do custo ${i+1}" placeholder="Descrição (ex.: compressor)" value="${esc(c.desc||"")}"><select id="cu-t-${i}" aria-label="Tipo">${optsS(CUSTO_TIPOS,c.tipo||CUSTO_TIPOS[0])}</select><input type="number" id="cu-q-${i}" aria-label="Quantidade" min="0" step="any" placeholder="Qtd" value="${esc(c.qtd==null?"":c.qtd)}"><input type="text" id="cu-v-${i}" inputmode="decimal" aria-label="Valor unitário" placeholder="R$ unit." value="${esc(c.valor==null||c.valor===""?"":String(c.valor).replace(".",","))}"><button type="button" class="x" data-curm="${i}" aria-label="Remover custo">×</button></div>`).join("")}</div>
      <div class="actions" style="margin-top:6px"><button type="button" class="btn sm" id="cuAdd">Adicionar custo</button><span class="cu-tot" id="cuTot">Total: <span class="money">${fBRL(A.custos.reduce((s,c)=>s+custoLinha(c),0))}</span></span></div></div>`;
  if(A&&A.t==="custos") panel=`<div class="panel" id="pan"><h3>Custos de ${codM(m)}</h3>${custosHTML()}
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk">Salvar custos</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="concluir") panel=`<div class="panel" id="pan"><h3>Concluir serviço</h3>
      ${(A.ck||[]).length?`<div class="field"><span class="lbl req">Checklist da preventiva</span><div class="ck">${A.ck.map((c,i)=>`<div class="ck-r"><span class="ck-n">${esc(c.nome)}</span><span class="ck-b ck3"><button type="button" class="chip" data-mck="${i}" data-v="ok" aria-pressed="${c.r==="ok"}">Feito</button><button type="button" class="chip" data-mck="${i}" data-v="na" aria-pressed="${c.r==="na"}">Não se aplica</button><button type="button" class="chip warn" data-mck="${i}" data-v="pb" aria-pressed="${c.r==="pb"}">Problema</button></span>${c.r==="pb"?`<input type="text" id="mck-o-${i}" class="ck-o" placeholder="Descreva o problema" value="${esc(c.obs||"")}">`:""}</div>`).join("")}</div></div>`:""}
      <div class="fg"><div class="field full"><label for="cDiag">Diagnóstico</label><textarea id="cDiag" data-a="diag" placeholder="Causa do problema">${esc(A.diag||"")}</textarea></div>
      <div class="field full"><label class="req" for="cSol">O que foi feito</label><textarea id="cSol" data-a="sol" placeholder="Ex.: trocado o capacitor e limpos os filtros; testado por 20 minutos">${esc(A.sol||"")}</textarea></div></div>
      <div class="field"><span class="lbl req">Fotos do serviço pronto</span>${fotosM(A.fotos,true)}${uplHTML("upD","upDg")}</div>
      ${custosHTML()}
      ${sigHTML(A,"Assinatura de quem recebeu o serviço")}
      <div class="fg"><div class="field"><label for="cRec">Recebido por</label><input type="text" id="cRec" data-a="rec" value="${esc(A.rec||"")}" placeholder="Nome de quem conferiu no setor"></div></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn pri" id="pOk"${A.busy?" disabled":""}>Encerrar ${codM(m)}</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="avisar") panel=`<div class="panel" id="pan"><h3>Avisar quem pediu</h3>
      <div class="fg"><div class="field"><label class="req" for="waTel">WhatsApp${m.solicitante?" de "+esc(m.solicitante):""}</label><input type="tel" id="waTel" data-a="fone" inputmode="tel" value="${esc(A.fone||"")}"></div></div>
      <div class="field"><label for="waMsg">Mensagem</label><textarea id="waMsg" data-a="msg" rows="7">${esc(A.msg||"")}</textarea></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn wa" id="pOk" type="button">Abrir conversa no WhatsApp</button><button class="btn ghost" id="pNo" type="button">Agora não</button></div></div>`;
  if(A&&A.t==="cancelar") panel=`<div class="panel" id="pan"><h3>Cancelar ${codM(m)}</h3><div class="field"><label class="req" for="mot">Motivo</label><textarea id="mot" data-a="mot" placeholder="Ex.: resolvido pelo próprio setor; chamado duplicado">${esc(A.mot||"")}</textarea></div>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn danger" id="pOk">Confirmar cancelamento</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  if(A&&A.t==="excluir") panel=`<div class="panel" id="pan"><h3>Excluir ${codM(m)}?</h3><p style="margin:0;color:var(--mute)">Some do sistema, com histórico, custos e indicadores. Para manter o registro, prefira Cancelar.</p>
      <span class="err" id="pErr" role="alert"></span><div class="actions"><button class="btn danger" id="pOk">Excluir definitivamente</button><button class="btn ghost" id="pNo">Voltar</button></div></div>`;
  const tl=(m.historico||[]).slice().reverse().map(h=>`<li><time class="num">${fDH(h.em)}</time><span><span class="st ${h.s}">${MST[h.s]||h.s}</span>${h.nota?` · ${esc(h.nota)}`:""}${h.por&&S.names[h.por]?` <span style="color:var(--faint)">por ${esc(S.names[h.por])}</span>`:""}</span></li>`).join("");
  const eqp=m.equipamentoId?byId(S.equipamentos,m.equipamentoId):null;
  const ck=m.checklist&&(m.checklist.itens||[]).length?m.checklist:null;
  layer.innerHTML=`<div class="ov" id="ov"><aside class="dr" role="dialog" aria-modal="true" aria-labelledby="drT">
    <div class="dr-h"><div class="row1"><div><h2 id="drT" class="num">${codM(m)}</h2><p>${m.tipo==="preventiva"?"Preventiva":"Corretiva"}${m.categoria?" · "+esc(m.categoria):""}${m.prioridade&&m.prioridade!=="normal"?" · Prioridade "+esc(((MPRIOS.find(p=>p[0]===m.prioridade)||[,""])[1]).toLowerCase()):""}</p></div><button class="cl" id="drX" aria-label="Fechar">×</button></div>
      <span class="stl"><span class="st ${m.status}">${MST[m.status]}</span></span>${late?` <span class="stl"><span class="late">Atrasada</span></span>`:lateC?` <span class="stl"><span class="late">Concluída com atraso</span></span>`:""}</div>
    <div class="dr-b">
      ${!A&&acts?`<div class="actions">${acts}</div>`:""}${panel}
      <section class="card card-b" style="padding-top:16px"><h3 style="font-size:17px;margin:0 0 6px">${esc(tituloM(m))}</h3>
        ${m.descricao&&m.descricao!==tituloM(m)?`<p style="margin:0 0 8px;white-space:pre-line">${esc(m.descricao)}</p>`:""}
        ${(m.fotosAbertura||[]).length?fotosM(m.fotosAbertura):""}
        ${m.status==="aguardando"&&m.aguardandoMotivo?`<p class="hint-box" style="margin:10px 0 0">Aguardando: ${esc(m.aguardandoMotivo)}${m.orcamento?" · orçamento "+fBRL(m.orcamento):""}</p>`:""}</section>
      <section class="card card-b" style="padding-top:16px"><dl class="dl">
        <div><dt>Local</dt><dd>${esc(nomeLocal(m.localId))}${m.localDetalhe?` <span style="color:var(--faint);font-weight:500">· ${esc(m.localDetalhe)}</span>`:""}${linksRota(m.localId)}</dd></div>
        <div><dt>Setor</dt><dd>${esc(nomeSetor(m.setorId))}</dd></div>
        <div><dt>Equipamento</dt><dd>${eqp?`<a href="#m-eq/${esc(eqp.id)}" class="lnk">${esc(nomeEquip(eqp.id))}</a>`:"—"}</dd></div>
        <div><dt>Quem pediu</dt><dd>${esc(m.solicitante||(m.solicitanteId&&S.names[m.solicitanteId])||"—")}${m.solicitanteTelefone?` <span class="num" style="color:var(--faint);font-weight:500">· ${esc(fFone(m.solicitanteTelefone))}</span>`:""}</dd></div>
        <div><dt>Quem executa</dt><dd>${esc(m.status==="aberto"?"Aguardando triagem":executorTxt(m))}</dd></div>
        <div><dt>Programado para</dt><dd class="num">${fDH(m.agendadoPara)}</dd></div>
        <div><dt>Prazo</dt><dd class="num">${fDH(new Date(prazoM(m)).toISOString())}${m.prazo?"":` <span style="color:var(--faint);font-weight:500">(padrão da prioridade)</span>`}</dd></div>
        <div><dt>Aberto em</dt><dd class="num">${fDH(m.criadoEm)}</dd></div>
        <div><dt>Tempo até o atendimento</dt><dd class="num">${m.iniciadoEm?fDur(tAtend(m)):"—"}</dd></div>
        <div><dt>Tempo de solução</dt><dd class="num">${m.concluidoEm?fDur(tSolucao(m)):m.iniciadoEm?"Em andamento desde "+fDH(m.iniciadoEm):"—"}</dd></div>
      </dl>${m.observacoes?`<p style="margin:14px 0 0;color:var(--mute)"><b style="color:var(--ink)">Orientação:</b> ${esc(m.observacoes)}</p>`:""}${m.planoId?`<p class="hint" style="margin:10px 0 0">Gerada pelo plano preventivo ${esc((byId(S.planos,m.planoId)||{}).nome||"")}</p>`:""}</section>
      ${m.diagnostico||m.solucao||(m.fotosAntes||[]).length||(m.fotosDepois||[]).length?`<section class="card"><div class="card-h"><h2>Execução</h2>${m.concluidoEm?`<span class="sub num">${fDH(m.concluidoEm)}</span>`:""}</div><div class="card-b">
        ${m.diagnostico?`<p style="margin:0 0 8px"><b>Diagnóstico:</b> ${esc(m.diagnostico)}</p>`:""}${m.solucao?`<p style="margin:0 0 8px"><b>O que foi feito:</b> ${esc(m.solucao)}</p>`:""}
        ${(m.fotosAntes||[]).length?`<span class="lbl">Antes</span>${fotosM(m.fotosAntes)}`:""}${(m.fotosDepois||[]).length?`<span class="lbl" style="margin-top:10px;display:block">Depois</span>${fotosM(m.fotosDepois)}`:""}
        ${m.recebidoPor?`<dl class="dl" style="margin-top:12px"><div><dt>Recebido por</dt><dd>${esc(m.recebidoPor)}</dd></div></dl>`:""}
        ${m.assinatura?`<div style="margin-top:12px"><span class="lbl">Assinatura</span><div class="sig-view" style="margin-top:4px"><img src="${esc(m.assinatura.url)}" alt="Assinatura"></div></div>`:""}</div></section>`:""}
      ${ck?`<section class="card"><div class="card-h"><h2>Checklist</h2><span class="sub">${ck.problemas?`<span class="late">${ck.problemas} problema${ck.problemas>1?"s":""}</span>`:"Sem problemas"}</span></div><div class="card-b"><ul class="ckv">${ck.itens.map(c=>`<li><span class="${c.r==="pb"?"late":"ok"}">${c.r==="ok"?"Feito":c.r==="na"?"N/A":c.r==="pb"?"Problema":"—"}</span> ${esc(c.nome)}${c.obs?` <span class="rdet">· ${esc(c.obs)}</span>`:""}</li>`).join("")}</ul></div></section>`:""}
      ${(m.custos||[]).length||m.orcamento?`<section class="card"><div class="card-h"><h2>Custos</h2><span class="sub money">${fBRL(ct)}</span></div><div class="card-b tbl-wrap">${(m.custos||[]).length?`<table class="t"><thead><tr><th>Descrição</th><th>Tipo</th><th class="r">Qtd</th><th class="r">Valor</th></tr></thead><tbody>${m.custos.map(c=>`<tr><td>${esc(c.desc||"")}</td><td>${esc(c.tipo||"")}</td><td class="r num">${esc(c.qtd===""||c.qtd==null?"1":String(c.qtd).replace(".",","))}</td><td class="r money">${fBRL(custoLinha(c))}</td></tr>`).join("")}</tbody></table>`:""}${m.orcamento?`<p style="margin:8px 0 0;color:var(--mute)">Orçamento informado: ${fBRL(m.orcamento)}</p>`:""}</div></section>`:""}
      ${m.status==="cancelada"?`<section class="card card-b" style="padding-top:16px"><b>Motivo do cancelamento:</b> ${esc(m.motivoCancelamento||"—")}</section>`:""}
      <section class="card"><div class="card-h"><h2>Histórico</h2></div><div class="card-b"><ul class="tl">${tl}</ul></div></section>
    </div></aside></div>`;
  document.body.style.overflow="hidden";const dr=$(".dr");if(dr)dr.scrollTop=prev;
  $("#drX").onclick=closeOS;$("#ov").onclick=e=>{if(e.target.id==="ov")closeOS()};
  bindZoom(layer);
  $$("[data-mact]",layer).forEach(b=>b.onclick=()=>mAct(m,b.dataset.mact));
  if(A) bindMPanel(m);
}
function syncMA(){const A=S.mAct;if(!A)return;$$("[data-a]",layer).forEach(e=>{A[e.dataset.a]=e.value});
  if(A.custos&&$("#cuL")) A.custos=A.custos.map((_,i)=>({desc:($("#cu-d-"+i)||{}).value||"",tipo:($("#cu-t-"+i)||{}).value||"",qtd:($("#cu-q-"+i)||{}).value===""?"":Number(($("#cu-q-"+i)||{}).value),valor:numBR(($("#cu-v-"+i)||{}).value)}));
  (A.ck||[]).forEach((c,i)=>{const e=$("#mck-o-"+i);if(e)c.obs=e.value});}
function redrawM(){syncMA();renderMDrawer()}
function msgM(m){const nome=(m.solicitante||"").split(" ")[0];
  return `Olá${nome?", "+nome:""}! Seu chamado ${codM(m)} foi concluído.\n\n${tituloM(m)}\n${ondeM(m)}\n\nO que foi feito: ${m.solucao||"serviço realizado"}\nConcluído em ${fDH(m.concluidoEm)}.\n\nQualquer problema, é só responder esta mensagem.\nFacilities · Grupo Monte Carlo`}
async function mAct(m,a){
  if(a==="editar"){S.mEditId=m.id;closeOS();if(location.hash==="#m-nova")route();else location.hash="#m-nova";return}
  if(a==="retomar"){try{await saveM(m.id,{status:"em_execucao",aguardandoMotivo:null,atualizadoEm:nowISO(),historico:mhist(m,"em_execucao","Serviço retomado")});toast(codM(m)+" retomada")}catch(e){toast("Não foi possível salvar.")}return}
  if(a==="reabrir"){try{await saveM(m.id,{status:"aberto",canceladoEm:null,atualizadoEm:nowISO(),historico:mhist(m,"aberto","Reaberta")});toast(codM(m)+" reaberta")}catch(e){toast("Não foi possível reabrir.")}return}
  const A={t:a,fotos:[],sig:[]};
  if(a==="triagem") Object.assign(A,{categoria:m.categoria||"",prioridade:m.prioridade||"normal",executor:m.executor||"interno",equipeIds:(m.equipeIds||[]).slice(),prestadorId:m.prestadorId||"",ag:toInput(m.agendadoPara),pz:toInput(m.prazo),obs:m.observacoes||""});
  if(a==="iniciar") A.diag=m.diagnostico||"";
  if(a==="custos") A.custos=JSON.parse(JSON.stringify(m.custos||[]));
  if(a==="concluir"){A.custos=JSON.parse(JSON.stringify(m.custos||[]));A.diag=m.diagnostico||"";
    const pl=m.planoId?byId(S.planos,m.planoId):null;const itens=(m.checklist&&m.checklist.itens)||((pl&&pl.checklist)||[]).map(n=>({nome:n}));A.ck=itens.map(c=>({nome:c.nome,r:c.r||null,obs:c.obs||""}));}
  if(a==="pausar"){A.esp=null;A.orc=m.orcamento?String(m.orcamento).replace(".",","):""}
  if(a==="avisar"){A.fone=m.solicitanteTelefone||"";A.msg=msgM(m)}
  S.mAct=A;renderMDrawer();const p=$("#pan");if(p)p.scrollIntoView({block:"nearest"});
}
function bindMPanel(m){
  const A=S.mAct;const err=$("#pErr");
  if(A.t==="concluir") initSig(A);
  if(A.t==="triagem") bindExec(layer,A);
  $("#pNo").onclick=()=>{S.mAct=null;renderMDrawer()};
  bindUploads(layer,()=>A.fotos,redrawM,err,v=>A.busy=v);
  $$("[data-esp]",layer).forEach(b=>b.onclick=()=>{A.esp=b.dataset.esp;$$("[data-esp]",layer).forEach(x=>x.setAttribute("aria-pressed",x===b))});
  $$("[data-mck]",layer).forEach(b=>b.onclick=()=>{syncMA();const c=A.ck[+b.dataset.mck];c.r=b.dataset.v;if(c.r!=="pb")c.obs="";renderMDrawer();const f=$("#mck-o-"+b.dataset.mck);if(f)f.focus()});
  const ca=$("#cuAdd");if(ca)ca.onclick=()=>{syncMA();A.custos.push({desc:"",tipo:CUSTO_TIPOS[0],qtd:1,valor:""});renderMDrawer();const ins=$$("#cuL input[type=text]");if(ins.length)ins[ins.length-2].focus()};
  $$("[data-curm]",layer).forEach(b=>b.onclick=()=>{syncMA();A.custos.splice(+b.dataset.curm,1);renderMDrawer()});
  $$("#cuL input",layer).forEach(i=>i.addEventListener("input",()=>{syncMA();const t=$("#cuTot");if(t)t.innerHTML=`Total: <span class="money">${fBRL(A.custos.reduce((s,c)=>s+custoLinha(c),0))}</span>`}));
  const ag=$("#tAg");if(ag)ag.onchange=()=>{};
  $("#pOk").onclick=async()=>{
    syncMA();const btn=$("#pOk");err.textContent="";
    if(A.busy){err.textContent="Aguarde o envio das fotos.";return}
    const now=nowISO();const limpos=()=>(A.custos||[]).filter(c=>(c.desc||"").trim()||c.valor!=="").map(c=>({desc:(c.desc||"").trim(),tipo:c.tipo,qtd:c.qtd===""?1:c.qtd,valor:c.valor===""?0:c.valor}));
    try{
      if(A.t==="triagem"){
        const d={categoria:A.categoria||null,prioridade:A.prioridade,executor:A.executor,equipeIds:A.executor==="terceiro"?[]:(A.equipeIds||[]),prestadorId:A.executor==="terceiro"?(A.prestadorId||""):"",agendadoPara:fromInput(A.ag),prazo:fromInput(A.pz),observacoes:(A.obs||"").trim()};
        if(!executorOk(d)){err.textContent=d.executor==="terceiro"?"Escolha o prestador.":"Escolha ao menos um técnico.";return}
        if(d.prazo&&T(d.prazo)<Date.now()-60000&&!A.pzOk){A.pzOk=true;err.textContent="O prazo informado já passou. Toque em Salvar de novo para manter.";return}
        btn.disabled=true;const st=m.status==="aberto"?"agendada":m.status;
        await saveM(m.id,Object.assign(d,{status:st,triadoEm:m.triadoEm||now,atualizadoEm:now,historico:mhist(m,st,(m.status==="aberto"?"Triagem: ":"Reprogramada: ")+executorTxt(d)+(d.agendadoPara?" · "+fDH(d.agendadoPara):""))}));
        S.mAct=null;toast(codM(m)+" programada");}
      if(A.t==="iniciar"){btn.disabled=true;
        await saveM(m.id,{status:"em_execucao",iniciadoEm:m.iniciadoEm||now,fotosAntes:(m.fotosAntes||[]).concat(A.fotos),diagnostico:(A.diag||"").trim()||m.diagnostico||null,atualizadoEm:now,historico:mhist(m,"em_execucao","Serviço iniciado"+(A.fotos.length?" com foto do antes":""))});
        S.mAct=null;toast(codM(m)+" em execução");}
      if(A.t==="pausar"){
        if(!A.esp){err.textContent="Escolha o que está faltando.";return}
        const orc=numBR(A.orc);if(A.orc&&orc===""){err.textContent="Valor do orçamento inválido.";return}
        btn.disabled=true;const motivo=A.esp+((A.det||"").trim()?": "+A.det.trim():"");
        await saveM(m.id,{status:"aguardando",aguardandoMotivo:motivo,orcamento:orc===""?m.orcamento||null:orc,atualizadoEm:now,historico:mhist(m,"aguardando",motivo)});
        S.mAct=null;toast(codM(m)+" aguardando");}
      if(A.t==="custos"){const cs=limpos();if(cs.some(c=>!c.desc)){err.textContent="Descreva cada custo.";return}
        btn.disabled=true;await saveM(m.id,{custos:cs,atualizadoEm:now,historico:mhist(m,m.status,"Custos: "+fBRL(cs.reduce((s,c)=>s+custoLinha(c),0)))});S.mAct=null;toast("Custos salvos");}
      if(A.t==="concluir"){
        const semR=(A.ck||[]).findIndex(c=>!c.r);if(semR>=0){err.textContent="Responda o checklist: "+A.ck[semR].nome+".";return}
        const semO=(A.ck||[]).findIndex(c=>c.r==="pb"&&!(c.obs||"").trim());if(semO>=0){err.textContent="Descreva o problema em: "+A.ck[semO].nome+".";return}
        if(!(A.sol||"").trim()){err.textContent="Conte o que foi feito.";return}
        if(!A.fotos.length){err.textContent="Anexe ao menos uma foto do serviço pronto.";return}
        const cs=limpos();if(cs.some(c=>!c.desc)){err.textContent="Descreva cada custo.";return}
        const temSig=(A.sig||[]).some(st=>st.length>1);if(temSig&&!(A.rec||"").trim()){err.textContent="Informe o nome de quem assinou.";return}
        btn.disabled=true;btn.textContent="Salvando…";let assinatura=null;
        if(temSig){const b=await sigBlob(A);if(S.demo)assinatura={id:"local",url:URL.createObjectURL(b)};else{try{assinatura=await enviarArquivo(b,"png","image/png")}catch(e){btn.disabled=false;btn.textContent="Encerrar "+codM(m);err.textContent="Falha ao enviar a assinatura.";return}}}
        const probs=(A.ck||[]).filter(c=>c.r==="pb").length;
        await saveM(m.id,{status:"concluida",concluidoEm:now,iniciadoEm:m.iniciadoEm||now,diagnostico:(A.diag||"").trim()||null,solucao:A.sol.trim(),fotosDepois:A.fotos,custos:cs,assinatura,recebidoPor:(A.rec||"").trim()||null,aguardandoMotivo:null,
          checklist:(A.ck||[]).length?{itens:A.ck.map(c=>({nome:c.nome,r:c.r,obs:(c.obs||"").trim()})),problemas:probs,em:now}:m.checklist||null,
          atualizadoEm:now,historico:mhist(m,"concluida","Serviço concluído com foto"+(cs.length?" · custo "+fBRL(cs.reduce((s,c)=>s+custoLinha(c),0)):"")+(probs?" · "+probs+" problema"+(probs>1?"s":"")+" no checklist":""))});
        toast(codM(m)+" concluída");const m2=byId(S.manutencoes,m.id)||m;
        S.mAct=m2.solicitanteTelefone&&foneValido(m2.solicitanteTelefone)?{t:"avisar",fone:m2.solicitanteTelefone,msg:msgM(m2),fotos:[],sig:[]}:null;}
      if(A.t==="avisar"){const tel=(A.fone||"").trim();if(!foneValido(tel)){err.textContent="Informe o WhatsApp com DDD.";return}
        const url="https://wa.me/"+foneWa(tel)+"?text="+encodeURIComponent(A.msg||msgM(m));const w=window.open(url,"_blank","noopener");if(!w)location.href=url;
        try{await saveM(m.id,{solicitanteTelefone:tel,avisadoEm:now,historico:mhist(m,m.status,"Aviso aberto no WhatsApp para "+fFone(tel))})}catch(e){console.warn(e)}S.mAct=null;}
      if(A.t==="cancelar"){if(!(A.mot||"").trim()){err.textContent="Informe o motivo.";return}btn.disabled=true;
        await saveM(m.id,{status:"cancelada",canceladoEm:now,motivoCancelamento:A.mot.trim(),historico:mhist(m,"cancelada",A.mot.trim())});S.mAct=null;toast(codM(m)+" cancelada");}
      if(A.t==="excluir"){btn.disabled=true;if(m.planoId&&m.dataPlano){const p=byId(S.planos,m.planoId);if(p){try{await saveCadM("planos",p.id,{pulos:(p.pulos||[]).concat([String(m.dataPlano).slice(0,10)])})}catch(e){console.warn(e)}}}
        if(!S.demo){const {error}=await sb.from("manutencoes").delete().eq("id",m.id);if(error)throw error}S.manutencoes=S.manutencoes.filter(x=>x.id!==m.id);toast(codM(m)+" excluída");closeOS();render();return;}
      renderMDrawer();
    }catch(e){console.error(e);btn.disabled=false;err.textContent="Não foi possível salvar. Verifique a conexão e tente novamente."+(e&&e.message?" ("+e.message+")":"")}
  };
}

/* ---------- PREVENTIVAS ---------- */
function addFreq(d,k,n){const f=freqInfo(k)[2];const x=new Date(d);if(f.d)x.setDate(x.getDate()+f.d*n);else{const dia=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+f.m*n);const fim=new Date(x.getFullYear(),x.getMonth()+1,0).getDate();x.setDate(Math.min(dia,fim))}return x}
function ocorrencias(p,de,ate){ // datas (YYYY-MM-DD) do plano entre de e ate
  const [y,mo,d]=String(p.inicio||dataLocal(new Date())).slice(0,10).split("-").map(Number);const ini=new Date(y,mo-1,d);const out=[];
  for(let n=0;n<2000;n++){const x=addFreq(ini,p.frequencia,n);if(x>ate)break;if(x>=de)out.push(dataLocal(x))}
  return out;
}
function proximaPrev(p){const hoje=new Date();hoje.setHours(0,0,0,0);const r=ocorrencias(p,hoje,new Date(hoje.getTime()+400*86400000)).filter(ds=>!(p.pulos||[]).includes(ds));return r[0]||null}
const fDia=ds=>{if(!ds)return "—";const [y,m,d]=ds.split("-");return d+"/"+m+"/"+y.slice(2)};
let gerandoP=false;
async function gerarPreventivas(){
  if(!isMan()||gerandoP||faltaMan())return 0;gerandoP=true;let n=0;
  try{
    const hoje=new Date();hoje.setHours(0,0,0,0);const ate=new Date(hoje.getTime()+14*86400000);
    for(const p of S.planos.filter(x=>x.ativo!==false)){
      const cri=new Date(p.criadoEm||Date.now());cri.setHours(0,0,0,0);
      for(const ds of ocorrencias(p,cri,ate)){
        if((p.pulos||[]).includes(ds))continue;
        if(S.manutencoes.some(m=>m.planoId===p.id&&String(m.dataPlano||"").slice(0,10)===ds))continue;
        const [hh,mm]=(p.hora||"08:00").split(":").map(Number);const [Y,M,D]=ds.split("-").map(Number);const ini=new Date(Y,M-1,D,hh||0,mm||0);
        const eq=p.equipamentoId?byId(S.equipamentos,p.equipamentoId):null;const now=nowISO();
        const d={tipo:"preventiva",status:executorOk(p)?"agendada":"aberto",categoria:p.categoria||(eq&&eq.categoria)||null,prioridade:"normal",titulo:p.nome,descricao:p.instrucoes||p.nome,
          localId:p.localId||(eq&&eq.localId)||"",setorId:p.setorId||(eq&&eq.setorId)||"",equipamentoId:p.equipamentoId||"",executor:p.executor||"interno",equipeIds:(p.equipeIds||[]).slice(),prestadorId:p.prestadorId||"",
          agendadoPara:ini.toISOString(),prazo:new Date(ini.getTime()+Math.max(p.duracaoMin||120,60)*60000+86400000).toISOString(),planoId:p.id,dataPlano:ds,
          checklist:(p.checklist||[]).length?{itens:p.checklist.map(nome=>({nome})),problemas:0}:null,solicitante:"",custos:[],
          criadoEm:now,atualizadoEm:now,triadoEm:executorOk(p)?now:null,historico:[{s:"aberto",em:now,por:S.uid||null,nota:"Gerada pelo plano preventivo "+p.nome}].concat(executorOk(p)?[{s:"agendada",em:now,por:S.uid||null,nota:""}]:[])};
        if(!S.demo){delete d.criadoEm}
        try{await saveM(novoId(),d);n++}catch(e){if(!(e&&(e.code==="23505"||/duplicate/i.test(e.message||""))))console.warn(e)}
      }
    }
  }finally{gerandoP=false}
  if(n&&!S.demo)await carregar("manutencoes");if(n)render();return n;
}
function planoForm(p){
  const X=S.planX;const eqs=S.equipamentos.filter(e=>e.ativo!==false||e.id===X.equipamentoId).sort(sortNome);
  return `<form class="eq-form" id="plF" novalidate>
    <div class="field full"><label class="req" for="plN">Nome do plano</label><input type="text" id="plN" value="${esc(X.nome||"")}" placeholder="Ex.: Limpeza de filtros dos splits do salão"></div>
    <div class="field"><label for="plE">Equipamento</label><select id="plE"><option value="">Nenhum (serviço no local)</option>${eqs.map(e=>`<option value="${esc(e.id)}"${e.id===X.equipamentoId?" selected":""}>${esc(e.nome)}${e.codigo?" · "+esc(e.codigo):""}</option>`).join("")}</select></div>
    <div class="field"><label for="plL">Local</label><select id="plL">${opts(ativos(S.locais).filter(l=>l.tipo!=="Fornecedor"),X.localId||"","Do equipamento")}</select></div>
    <div class="field"><label for="plC">Categoria</label><select id="plC"><option value="">Selecione…</option>${optsS(MCATS,X.categoria||"")}</select></div>
    <div class="field"><label class="req" for="plFq">Frequência</label><select id="plFq">${optsS(FREQS.map(f=>[f[0],f[1]]),X.frequencia||"mensal")}</select></div>
    <div class="field"><label class="req" for="plI">Primeira data</label><input type="date" id="plI" value="${esc(X.inicio||dataLocal(new Date()))}"></div>
    <div class="field"><label for="plH">Horário</label><input type="time" id="plH" value="${esc(X.hora||"08:00")}"></div>
    ${execHTML(X)}
    <div class="field full"><label for="plK">Checklist (um item por linha)</label><textarea id="plK" rows="5" placeholder="Limpar filtros&#10;Verificar dreno&#10;Medir corrente do compressor">${esc((X.checklist||[]).join("\n"))}</textarea></div>
    <div class="field full"><label for="plT">Instruções</label><textarea id="plT" placeholder="Opcional: cuidados, ferramentas, contato do setor">${esc(X.instrucoes||"")}</textarea></div>
    <div class="full"><span class="err" id="plErr" role="alert"></span><div class="actions"><button class="btn pri" type="submit">${p?"Salvar plano":"Criar plano"}</button><button class="btn ghost" type="button" id="plX">Cancelar</button></div></div>
  </form>`;
}
function renderMPrev(){
  const hoje=new Date();hoje.setHours(0,0,0,0);const ate=new Date(hoje.getTime()+30*86400000);
  const ativosP=S.planos.filter(p=>p.ativo!==false);
  const prox=[];ativosP.forEach(p=>ocorrencias(p,hoje,ate).filter(ds=>!(p.pulos||[]).includes(ds)).forEach(ds=>prox.push({p,ds,m:S.manutencoes.find(m=>m.planoId===p.id&&String(m.dataPlano||"").slice(0,10)===ds)})));
  prox.sort((a,b)=>a.ds<b.ds?-1:1);
  const prevs=S.manutencoes.filter(m=>m.tipo==="preventiva");
  const vencidas=prevs.filter(m=>MABERTOS.includes(m.status)&&T(m.agendadoPara)<hoje.getTime());
  const conc90=prevs.filter(m=>m.status==="concluida"&&T(m.concluidoEm)>Date.now()-90*86400000);
  const emDia=conc90.length?Math.round(conc90.filter(m=>!mConclAtraso(m)).length/conc90.length*100):null;
  const ed=S.planEdit;
  let h=`<div class="head"><div><h1>Manutenção <em>preventiva</em></h1><p>Planos que se repetem por equipamento ou local. O sistema cria as OS sozinho com 14 dias de antecedência, já com o checklist e a equipe.</p></div>${isMan()&&!ed?`<div class="act"><button class="btn pri" id="plNovo" type="button">Novo plano</button></div>`:""}</div>${banner()}${avisoSQL()}
  <div class="kpis">${kpi("Planos ativos",ativosP.length,"",S.planos.length-ativosP.length?(S.planos.length-ativosP.length)+" pausado(s)":"Nenhum pausado")}${kpi("Próximos 30 dias",prox.length,"","Preventivas programadas")}${kpi("Vencidas em aberto",vencidas.length,"","Passaram da data marcada",vencidas.length?"alert":"")}${kpi("Feitas no prazo",emDia==null?"—":emDia,emDia==null?"":"%",conc90.length?conc90.length+" concluídas em 90 dias":"Sem conclusões em 90 dias",emDia!=null&&emDia>=90?"good":emDia!=null&&emDia<75?"alert":"")}</div>`;
  if(ed) h+=`<section class="card" style="margin-bottom:16px"><div class="card-h"><h2>${ed==="__new"?"Novo plano preventivo":"Editar plano"}</h2></div><div class="card-b">${planoForm(ed==="__new"?null:byId(S.planos,ed))}</div></section>`;
  h+=`<div class="grid2"><section class="card"><div class="card-h"><h2>Planos</h2><span class="sub">${S.planos.length}</span></div><div class="card-b">
    ${S.planos.length?S.planos.slice().sort((a,b)=>((a.ativo===false)-(b.ativo===false))||sortNome(a,b)).map(p=>{const nx=p.ativo===false?null:proximaPrev(p);const ult=prevs.filter(m=>m.planoId===p.id&&m.status==="concluida").sort((a,b)=>T(b.concluidoEm)-T(a.concluidoEm))[0];
      return `<div class="pl-row${p.ativo===false?" off":""}"><div><b>${esc(p.nome)}</b>${p.ativo===false?` <span style="color:var(--faint);font-weight:500">pausado</span>`:""}<div class="m">${esc(p.equipamentoId?nomeEquip(p.equipamentoId):nomeLocal(p.localId))}</div></div>
        <span class="m">${esc(freqInfo(p.frequencia)[1])} · ${esc(p.hora||"")}<br>${esc(executorOk(p)?executorTxt(p):"Sem executor definido")}</span>
        <span class="m">Próxima: <b class="num" style="color:var(--ink)">${fDia(nx)}</b><br>Última: <span class="num">${ult?fData(ult.concluidoEm):"—"}</span></span>
        ${isMan()?(S.planDel===p.id?`<span class="actions"><span class="err">Excluir? As OS já criadas continuam.</span><button class="btn sm danger" data-pldel2="${esc(p.id)}" type="button">Excluir</button><button class="btn sm ghost" data-pldelx type="button">Voltar</button></span>`:`<span class="actions"><button class="btn sm ghost" data-pled="${esc(p.id)}" type="button">Editar</button><button class="btn sm ghost" data-pltg="${esc(p.id)}" type="button">${p.ativo===false?"Reativar":"Pausar"}</button><button class="btn sm ghost danger" data-pldel="${esc(p.id)}" type="button">Excluir</button></span>`):"<span></span>"}</div>`}).join("")
      :`<p style="color:var(--mute)">Nenhum plano ainda. Exemplos: limpeza de filtros de ar-condicionado (mensal), teste do gerador (quinzenal), recarga de extintores (anual), limpeza da caixa d'água (semestral).</p>`}
  </div></section>
  <section class="card"><div class="card-h"><h2>Próximos 30 dias</h2><span class="sub">${prox.length}</span></div><div class="card-b">
    ${prox.length?`<ul class="tl">${prox.slice(0,40).map(x=>`<li><time class="num">${fDia(x.ds)}</time><span>${x.m?`<button class="lnk" type="button" data-mopen="${esc(x.m.id)}">${codM(x.m)}</button> · `:""}<b>${esc(x.p.nome)}</b>${x.m?` · <span class="st ${x.m.status}">${MST[x.m.status]}</span>`:` <span style="color:var(--faint)">· a OS será criada ${x.ds<=dataLocal(new Date(Date.now()+14*86400000))?"em instantes":"14 dias antes"}</span>`}</span></li>`).join("")}</ul>`:`<p style="color:var(--mute)">Nada programado.</p>`}
    ${vencidas.length?`<h3 style="font-size:14px;margin:14px 0 6px;color:var(--s-late)">Vencidas em aberto</h3><div class="list">${vencidas.map(mRowHTML).join("")}</div>`:""}
  </div></section></div>`;
  app.innerHTML=h;bindMPrev();
}
function bindMPrev(){
  bindMOpen();
  const nv=$("#plNovo");if(nv)nv.onclick=()=>{S.planEdit="__new";S.planX={frequencia:"mensal",executor:"interno",equipeIds:[],inicio:dataLocal(new Date()),hora:"08:00",checklist:[]};renderMPrev();$("#plN").focus()};
  $$("[data-pled]").forEach(b=>b.onclick=()=>{const p=byId(S.planos,b.dataset.pled);S.planEdit=p.id;S.planX=JSON.parse(JSON.stringify(p));S.planX.equipeIds=S.planX.equipeIds||[];renderMPrev();window.scrollTo(0,0)});
  $$("[data-pltg]").forEach(b=>b.onclick=async()=>{const p=byId(S.planos,b.dataset.pltg);try{await saveCadM("planos",p.id,{ativo:p.ativo===false});toast(p.ativo===false?"Plano pausado":"Plano reativado");if(p.ativo!==false)await gerarPreventivas();renderMPrev()}catch(e){toast("Não foi possível alterar.")}});
  $$("[data-pldel]").forEach(b=>b.onclick=()=>{S.planDel=b.dataset.pldel;renderMPrev()});
  $$("[data-pldelx]").forEach(b=>b.onclick=()=>{S.planDel=null;renderMPrev()});
  $$("[data-pldel2]").forEach(b=>b.onclick=async()=>{try{await apagarCadM("planos",b.dataset.pldel2);S.planDel=null;toast("Plano excluído");renderMPrev()}catch(e){toast("Não foi possível excluir.")}});
  const f=$("#plF");if(!f)return;
  bindExec(f,S.planX);
  $("#plE").onchange=e=>{const q=byId(S.equipamentos,e.target.value);if(q){if(q.categoria&&!$("#plC").value)$("#plC").value=q.categoria;if(!$("#plN").value.trim())$("#plN").value="Preventiva · "+q.nome}};
  $("#plX").onclick=()=>{S.planEdit=null;renderMPrev()};
  f.onsubmit=async e=>{e.preventDefault();const X=S.planX;const er=$("#plErr");
    const d={nome:$("#plN").value.trim(),equipamentoId:$("#plE").value,localId:$("#plL").value,categoria:$("#plC").value||null,frequencia:$("#plFq").value,inicio:$("#plI").value,hora:$("#plH").value||"08:00",
      executor:X.executor||"interno",equipeIds:X.executor==="terceiro"?[]:(X.equipeIds||[]),prestadorId:X.executor==="terceiro"?(X.prestadorId||""):"",checklist:$("#plK").value.split("\n").map(x=>x.trim()).filter(Boolean),instrucoes:$("#plT").value.trim()};
    if(!d.nome){er.textContent="Informe o nome do plano.";return}if(!d.equipamentoId&&!d.localId){er.textContent="Escolha o equipamento ou o local.";return}if(!d.inicio){er.textContent="Informe a primeira data.";return}
    if(!d.localId&&d.equipamentoId){const q=byId(S.equipamentos,d.equipamentoId);d.localId=q&&q.localId||""}
    try{await saveCadM("planos",S.planEdit==="__new"?null:S.planEdit,d);const nov=S.planEdit==="__new";S.planEdit=null;const n=await gerarPreventivas();toast((nov?"Plano criado":"Plano salvo")+(n?" · "+n+" OS na agenda":""));renderMPrev()}
    catch(x){console.error(x);er.textContent="Não foi possível salvar."+(x&&x.message?" ("+x.message+")":"")}};
}

/* ---------- EQUIPAMENTOS ---------- */
const urlEquip=id=>location.origin+location.pathname+"#m-eq/"+id;
let qrP=null;
function carregarQR(){if(window.qrcode)return Promise.resolve();if(qrP)return qrP;qrP=new Promise((res,rej)=>{const s=document.createElement("script");s.src="assets/qrcode.js";s.onload=()=>res();s.onerror=()=>{qrP=null;rej()};document.head.appendChild(s)});return qrP}
function qrSVG(txt){try{const q=window.qrcode(0,"M");q.addData(txt);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})}catch(e){return ""}}
async function imprimirEtiquetas(lista){
  try{await carregarQR()}catch(e){toast("Não foi possível carregar o gerador de QR Code.");return}
  const lb=lista.map(e=>`<div class="lb"><div class="q">${qrSVG(urlEquip(e.id))}</div><div class="t"><b>${esc(e.nome)}</b>${e.codigo?`<span class="c">${esc(e.codigo)}</span>`:""}<span>${esc(nomeLocal(e.localId))}${e.setorId?" · "+esc(nomeSetor(e.setorId).split(" · ")[0]):""}</span><small>Problema? Aponte a câmera e abra um chamado.</small><i>Facilities · Grupo Monte Carlo</i></div></div>`).join("");
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;margin:0;color:#140C0B}.g{display:grid;grid-template-columns:repeat(3,62mm);gap:4mm}.lb{border:1px dashed #999;border-radius:2mm;padding:3mm;display:flex;gap:3mm;height:34mm;box-sizing:border-box;break-inside:avoid}.q{width:28mm;flex:none}.q svg{width:28mm;height:28mm}.t{display:flex;flex-direction:column;font-size:8pt;line-height:1.25;min-width:0}.t b{font-size:9.5pt}.c{font-weight:700;color:#420804}small{margin-top:auto;font-size:7pt}i{font-size:6.5pt;color:#83582B;font-style:normal;font-weight:700}</style></head><body><div class="g">${lb}</div></body></html>`;
  const fr=document.createElement("iframe");fr.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";document.body.appendChild(fr);
  fr.contentDocument.open();fr.contentDocument.write(html);fr.contentDocument.close();
  setTimeout(()=>{try{fr.contentWindow.focus();fr.contentWindow.print()}catch(e){}setTimeout(()=>fr.remove(),60000)},300);
}
function statsEquip(id){const l=S.manutencoes.filter(m=>m.equipamentoId===id&&m.status!=="cancelada");const c=l.filter(m=>m.status==="concluida").sort((a,b)=>T(b.concluidoEm)-T(a.concluidoEm));
  return {n:l.length,corr:l.filter(m=>m.tipo==="corretiva").length,abertas:l.filter(m=>MABERTOS.includes(m.status)).length,custo:l.reduce((s,m)=>s+custoTotal(m),0),ult:c[0]||null}}
function eqForm(x){x=x||{};
  return `<form class="eq-form" id="eqF" data-eq="${esc(x.id||"")}" novalidate>
    <div class="field"><label class="req" for="eqN">Nome</label><input type="text" id="eqN" value="${esc(x.nome||"")}" placeholder="Ex.: Ar split salão 1"></div>
    <div class="field"><label for="eqCo">Patrimônio / código</label><input type="text" id="eqCo" value="${esc(x.codigo||"")}" placeholder="Ex.: AC-001"></div>
    <div class="field"><label for="eqC">Categoria</label><select id="eqC"><option value="">Selecione…</option>${optsS(MCATS,x.categoria||"")}</select></div>
    <div class="field"><label class="req" for="eqL">Local</label><select id="eqL">${opts(ativos(S.locais).filter(l=>l.tipo!=="Fornecedor"||l.id===x.localId),x.localId||"","Selecione…")}</select></div>
    <div class="field"><label for="eqS">Setor</label><select id="eqS">${optsSetores(x.setorId||"","Sem setor")}</select></div>
    <div class="field"><label for="eqMa">Marca</label><input type="text" id="eqMa" value="${esc(x.marca||"")}"></div>
    <div class="field"><label for="eqMo">Modelo</label><input type="text" id="eqMo" value="${esc(x.modelo||"")}"></div>
    <div class="field"><label for="eqSe">Nº de série</label><input type="text" id="eqSe" value="${esc(x.serie||"")}"></div>
    <div class="field"><label for="eqIn">Instalado em</label><input type="date" id="eqIn" value="${esc(x.instaladoEm||"")}"></div>
    <div class="field"><label for="eqGa">Garantia até</label><input type="date" id="eqGa" value="${esc(x.garantiaAte||"")}"></div>
    <div class="field full"><label for="eqO">Observações</label><textarea id="eqO" placeholder="Capacidade, voltagem, fornecedor da instalação…">${esc(x.obs||"")}</textarea></div>
    <div class="full"><span class="err" id="eqErr" role="alert"></span><div class="actions"><button class="btn pri" type="submit">Salvar equipamento</button><button class="btn ghost" type="button" id="eqX">Cancelar</button></div></div></form>`;
}
function renderMEquip(){
  const f=S.ef;const q=normNome(f.q);
  const lista=S.equipamentos.filter(e=>(f.inativos||e.ativo!==false)&&(!f.local||e.localId===f.local)&&(!f.cat||e.categoria===f.cat)&&(!q||normNome([e.nome,e.codigo,e.marca,e.modelo,e.serie,nomeLocal(e.localId)].join(" ")).includes(q)));
  const grupos=new Map();lista.forEach(e=>{const k=e.localId||"";if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(e)});
  const ordem=[...grupos.keys()].sort((a,b)=>{const la=byId(S.locais,a),lb=byId(S.locais,b);const ia=la?ORDEM_SIGLA.indexOf(la.sigla):-1,ib=lb?ORDEM_SIGLA.indexOf(lb.sigla):-1;return (a?0:1)-(b?0:1)||(ia<0?99:ia)-(ib<0?99:ib)||nomeLocal(a).localeCompare(nomeLocal(b),"pt-BR")});
  const ed=S.eqEdit;
  let h=`<div class="head"><div><h1>Equipa<em>mentos</em></h1><p>Cadastro com histórico de cada equipamento. Cole a etiqueta com QR Code: qualquer pessoa aponta a câmera e abre o chamado já com o equipamento certo.</p></div>
    <div class="act">${lista.length?`<button class="btn" id="eqPrint" type="button">Imprimir etiquetas (${lista.length})</button>`:""}${isMan()&&!ed?`<button class="btn pri" id="eqNovo" type="button">Novo equipamento</button>`:""}</div></div>${banner()}${avisoSQL()}
  ${ed==="__new"?`<section class="card" style="margin-bottom:16px"><div class="card-h"><h2>Novo equipamento</h2></div><div class="card-b">${eqForm(null)}</div></section>`:""}
  <div class="filters"><div class="field grow"><label for="eqQ">Buscar</label><input type="search" id="eqQ" value="${esc(f.q)}" placeholder="Nome, patrimônio, marca, modelo…"></div>
    <div class="field"><label for="eqLF">Local</label><select id="eqLF">${opts(ativos(S.locais).filter(l=>l.tipo!=="Fornecedor"),f.local,"Todos")}</select></div>
    <div class="field"><label for="eqCF">Categoria</label><select id="eqCF"><option value="">Todas</option>${optsS(MCATS,f.cat)}</select></div>
    <label class="chk sm" style="align-self:end;margin-bottom:10px"><input type="checkbox" id="eqIF"${f.inativos?" checked":""}> Mostrar desativados</label></div>`;
  if(!S.equipamentos.length) h+=`<div class="empty"><h3>Nenhum equipamento cadastrado</h3><p>Comece pelos que mais dão chamado: ar-condicionado, geladeiras e freezers, máquinas da cozinha, bombas, gerador.</p></div>`;
  else if(!lista.length) h+=`<div class="empty"><h3>Nada com esses filtros</h3></div>`;
  else h+=`<section class="card"><div class="card-b">${ordem.map(k=>`<div class="eq-g"><h3>${esc(k?nomeLocal(k):"Sem local")}</h3>${grupos.get(k).sort(sortNome).map(e=>{const s=statsEquip(e.id);
      return ed===e.id?eqForm(e):`<div class="eq-row${e.ativo===false?" off":""}"><span class="n">${esc(e.nome)}<small>${esc([e.codigo,e.categoria].filter(Boolean).join(" · ")||"Sem código")}</small></span>
        <span class="m">${esc([e.marca,e.modelo].filter(Boolean).join(" ")||"—")}${e.setorId?"<br>"+esc(nomeSetor(e.setorId)):""}</span>
        <span class="m">${s.n} chamado${s.n===1?"":"s"}${s.abertas?` · <b style="color:var(--s-new)">${s.abertas} em aberto</b>`:""}${s.custo?` · <span class="money">${fBRL(s.custo)}</span>`:""}<br>Último serviço: ${s.ult?fData(s.ult.concluidoEm):"—"}</span>
        <span class="actions"><a class="btn sm" href="#m-eq/${esc(e.id)}">Ver</a>${isMan()?`<button class="btn sm ghost" data-eqed="${esc(e.id)}" type="button">Editar</button><button class="btn sm ghost" data-eqtg="${esc(e.id)}" type="button">${e.ativo===false?"Reativar":"Desativar"}</button>`:""}</span></div>`}).join("")}</div>`).join("")}</div></section>`;
  app.innerHTML=h;bindMEquip(lista);
}
function bindMEquip(lista){
  let tm;$("#eqQ").oninput=e=>{clearTimeout(tm);const v=e.target.value;tm=setTimeout(()=>{S.ef.q=v;renderMEquip()},220)};
  $("#eqLF").onchange=e=>{S.ef.local=e.target.value;renderMEquip()};$("#eqCF").onchange=e=>{S.ef.cat=e.target.value;renderMEquip()};$("#eqIF").onchange=e=>{S.ef.inativos=e.target.checked;renderMEquip()};
  const pr=$("#eqPrint");if(pr)pr.onclick=()=>imprimirEtiquetas(lista.filter(e=>e.ativo!==false));
  const nv=$("#eqNovo");if(nv)nv.onclick=()=>{S.eqEdit="__new";renderMEquip();$("#eqN").focus()};
  $$("[data-eqed]").forEach(b=>b.onclick=()=>{S.eqEdit=b.dataset.eqed;renderMEquip()});
  $$("[data-eqtg]").forEach(b=>b.onclick=async()=>{const e=byId(S.equipamentos,b.dataset.eqtg);try{await saveCadM("equipamentos",e.id,{ativo:e.ativo===false});renderMEquip()}catch(x){toast("Não foi possível alterar.")}});
  bindEqForm(()=>{S.eqEdit=null;render(true)});
}
function bindEqForm(depois){
  const f=$("#eqF");if(!f)return;
  $("#eqX").onclick=()=>{S.eqEdit=null;depois()};
  $("#eqL").onchange=e=>{const st=$("#eqS");if(st.value&&localDoSetor(st.value)!==e.target.value)st.value=""};
  $("#eqS").onchange=e=>{const l=localDoSetor(e.target.value);if(l&&!$("#eqL").value)$("#eqL").value=l};
  f.onsubmit=async e=>{e.preventDefault();const er=$("#eqErr");
    const d={nome:$("#eqN").value.trim(),codigo:$("#eqCo").value.trim()||null,categoria:$("#eqC").value||null,localId:$("#eqL").value,setorId:$("#eqS").value,marca:$("#eqMa").value.trim(),modelo:$("#eqMo").value.trim(),serie:$("#eqSe").value.trim(),instaladoEm:$("#eqIn").value||null,garantiaAte:$("#eqGa").value||null,obs:$("#eqO").value.trim()};
    if(!d.nome){er.textContent="Informe o nome.";return}if(!d.localId){er.textContent="Escolha o local.";return}
    if(d.codigo&&S.equipamentos.some(x=>x.id!==f.dataset.eq&&normNome(x.codigo)===normNome(d.codigo))){er.textContent="Já existe um equipamento com o código "+d.codigo+".";return}
    try{await saveCadM("equipamentos",f.dataset.eq||null,d);toast("Equipamento salvo");depois()}catch(x){console.error(x);er.textContent=/duplicate|unique/i.test(x.message||"")?"Esse código já está em uso.":"Não foi possível salvar."}};
}
function renderMEq(){
  const e=byId(S.equipamentos,S.routeArg);
  if(!e){app.innerHTML=`<div class="head"><div><h1>Equipamento</h1></div></div>${avisoSQL()}<div class="empty"><h3>${S.demo||S.loaded.equipamentos?"Equipamento não encontrado":"Carregando…"}</h3><p><a href="#m-equip">Ver todos os equipamentos</a></p></div>`;return}
  const s=statsEquip(e.id);const hist=S.manutencoes.filter(m=>m.equipamentoId===e.id).sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  const pls=S.planos.filter(p=>p.equipamentoId===e.id&&p.ativo!==false);
  const abrir=isMan()?"#m-nova/"+e.id:"#m-chamado/"+e.id;const pode=isMan()||S.role==="sol";
  const gar=e.garantiaAte?(T(e.garantiaAte+"T23:59")>Date.now()?"Em garantia até "+fDia(e.garantiaAte):"Garantia vencida em "+fDia(e.garantiaAte)):"";
  let h=`<div class="head"><div><h1>${esc(e.nome)}</h1><p>${esc([e.codigo,e.categoria,nomeLocal(e.localId)].filter(x=>x&&x!=="—").join(" · "))}</p></div><div class="act">${pode?`<a class="btn pri" href="${abrir}">Abrir chamado</a>`:""}</div></div>${banner()}
  ${S.editEq===e.id?`<section class="card" style="margin-bottom:16px"><div class="card-b">${eqForm(e)}</div></section>`:""}
  <div class="eqd"><div>
    <div class="kpis">${kpi("Chamados",s.n,"",s.corr+" corretiva"+(s.corr===1?"":"s"))}${kpi("Em aberto",s.abertas,"",s.abertas?"Em atendimento":"Nada pendente",s.abertas?"alert":"")}${kpi("Custo acumulado",fBRL(s.custo),"","Peças e serviços","money-k")}${kpi("Último serviço",s.ult?fData(s.ult.concluidoEm):"—","",s.ult?codM(s.ult):"Sem conclusões")}</div>
    <section class="card"><div class="card-b" style="padding-top:16px"><dl class="dl">
      <div><dt>Local</dt><dd>${esc(nomeLocal(e.localId))}</dd></div><div><dt>Setor</dt><dd>${esc(nomeSetor(e.setorId))}</dd></div>
      <div><dt>Marca e modelo</dt><dd>${esc([e.marca,e.modelo].filter(Boolean).join(" ")||"—")}</dd></div><div><dt>Nº de série</dt><dd>${esc(e.serie||"—")}</dd></div>
      <div><dt>Instalado em</dt><dd class="num">${fDia(e.instaladoEm)}</dd></div><div><dt>Garantia</dt><dd>${esc(gar||"—")}</dd></div>
      <div><dt>Preventivas</dt><dd>${pls.length?pls.map(p=>esc(p.nome)+" · "+esc(freqInfo(p.frequencia)[1].toLowerCase())+" · próxima "+fDia(proximaPrev(p))).join("<br>"):"Nenhum plano"}</dd></div>
    </dl>${e.obs?`<p style="margin:12px 0 0;color:var(--mute)">${esc(e.obs)}</p>`:""}${isMan()&&S.editEq!==e.id?`<div class="actions" style="margin-top:12px"><button class="btn sm" id="eqEd" type="button">Editar dados</button></div>`:""}</div></section>
    <section class="card" style="margin-top:16px"><div class="card-h"><h2>Histórico</h2><span class="sub">${hist.length}</span></div><div class="card-b">${hist.length?`<div class="list">${hist.map(mRowHTML).join("")}</div>`:`<p style="color:var(--mute)">Nenhum chamado para este equipamento.</p>`}</div></section>
  </div>
  <section class="card"><div class="card-h"><h2>Etiqueta</h2></div><div class="card-b"><div class="qr" id="eqQR" aria-label="QR Code do equipamento"></div><p class="hint" style="margin:8px 0">Leva para esta página. Quem está logado abre o chamado com um toque.</p><button class="btn sm" id="eqEt" type="button">Imprimir etiqueta</button></div></section></div>`;
  app.innerHTML=h;bindMOpen();
  carregarQR().then(()=>{const q=$("#eqQR");if(q)q.innerHTML=qrSVG(urlEquip(e.id))}).catch(()=>{const q=$("#eqQR");if(q)q.textContent="QR Code indisponível"});
  $("#eqEt").onclick=()=>imprimirEtiquetas([e]);
  const ee=$("#eqEd");if(ee)ee.onclick=()=>{S.editEq=e.id;renderMEq()};
  bindEqForm(()=>{S.editEq=null;renderMEq()});
}

/* ---------- PAINEL DA MANUTENÇÃO ---------- */
function inMPainel(m){const [a,b]=periodRange(S.mf.periodo);const t=T(m.criadoEm);if(!(t>=a.getTime()&&t<b.getTime()))return false;if(S.mf.local&&m.localId!==S.mf.local)return false;if(S.mf.cat&&m.categoria!==S.mf.cat)return false;return true}
function renderMPainel(){
  const perOpts=[["hoje","Hoje"],["7","Últimos 7 dias"],["30","Últimos 30 dias"],["mes","Este mês"],["mesant","Mês anterior"],["90","Últimos 90 dias"],["ano","Este ano"]];
  const list=S.manutencoes.filter(inMPainel);const val=list.filter(m=>m.status!=="cancelada");const conc=val.filter(m=>m.status==="concluida");
  const abertas=S.manutencoes.filter(m=>MABERTOS.includes(m.status));const novos=abertas.filter(m=>m.status==="aberto");const atr=abertas.filter(mAtrasada);
  const cp=conc.filter(m=>isFinite(prazoM(m)));const np=cp.filter(m=>!mConclAtraso(m)).length;const pct=cp.length?Math.round(np/cp.length*100):null;
  const ta=avg(val.map(tAtend)),ts=avg(conc.map(tSolucao));const custo=val.reduce((s,m)=>s+custoTotal(m),0);
  const prev=val.filter(m=>m.tipo==="preventiva");const prevPct=val.length?Math.round(prev.length/val.length*100):0;
  let h=`<div class="head"><div><h1>Painel da <em>manutenção</em></h1><p>Chamados, prazos, tempo de solução e custos da infraestrutura das unidades.</p></div><div class="act"><button class="btn" id="mExp" type="button">Exportar CSV</button></div></div>${banner()}${avisoSQL()}
  <div class="filters"><div class="field"><label for="mfPer">Período</label><select id="mfPer">${optsS(perOpts,S.mf.periodo)}</select></div>
    <div class="field"><label for="mfLoc">Local</label><select id="mfLoc">${opts(ativos(S.locais).filter(l=>l.tipo!=="Fornecedor"),S.mf.local,"Todos")}</select></div>
    <div class="field"><label for="mfCat">Categoria</label><select id="mfCat"><option value="">Todas</option>${optsS(MCATS,S.mf.cat)}</select></div></div>
  <div class="kpis">
    ${kpi("Chamados no período",val.length,"",prev.length?prev.length+" preventiva"+(prev.length>1?"s":"")+" ("+prevPct+"%)":"Nenhuma preventiva")}
    ${kpi("Aguardando triagem",novos.length,"","Chamados novos agora",novos.length?"alert":"")}
    ${kpi("Em aberto agora",abertas.length,"",MABERTOS.filter(s=>s!=="aberto").map(s=>abertas.filter(m=>m.status===s).length+" "+MST[s].toLowerCase()).join(" · "))}
    ${kpi("Atrasadas agora",atr.length,"","Passaram do prazo",atr.length?"alert":"")}
    ${kpi("Concluídas no prazo",pct==null?"—":pct,pct==null?"":"%",cp.length?np+" de "+cp.length:"Sem conclusões",pct!=null&&pct>=90?"good":pct!=null&&pct<75?"alert":"")}
    ${kpi("Tempo até o atendimento",durNum(ta),durUnit(ta),"Da abertura ao início")}
    ${kpi("Tempo de solução",durNum(ts),durUnit(ts),"Da abertura à conclusão")}
    ${kpi("Custo no período",fBRL(custo),"",conc.length?"Média "+fBRL(custo/Math.max(val.filter(m=>custoTotal(m)>0).length,1))+" por OS com custo":"Peças e serviços","money-k")}
  </div>`;
  if(!val.length){h+=`<div class="empty"><h3>Nenhum chamado neste período</h3><p>Os indicadores aparecem conforme os chamados forem abertos e concluídos.</p></div>`;app.innerHTML=h;bindMPainel();return}
  const [a,b]=periodRange(S.mf.periodo);const endT=Math.min(b.getTime(),Date.now()+86400000);const startT=Math.max(a.getTime(),endT-120*86400000);const nd=Math.max(Math.round((endT-startT)/86400000),1);
  const cnt={};val.forEach(m=>{const k=dayKey(m.criadoEm);cnt[k]=(cnt[k]||0)+1});const series=[];for(let i=0;i<nd;i++){const k=dayKey(new Date(startT+i*86400000+3600000));series.push({k,v:cnt[k]||0})}
  const sc={};list.forEach(m=>sc[m.status]=(sc[m.status]||0)+1);const tot=list.length||1;
  const cor={aberto:"new",agendada:"age",em_execucao:"rota",aguardando:"wait",concluida:"ok",cancelada:"can"};
  h+=`<div class="grid3"><section class="card span2"><div class="card-h"><h2>Chamados por dia</h2><span class="sub">pela data de abertura</span></div><div class="card-b"><div class="chart" id="chM"></div></div></section>
    <section class="card"><div class="card-h"><h2>Situação</h2><span class="sub">${list.length} no período</span></div><div class="card-b"><div class="split" role="img" aria-label="Distribuição por situação">${Object.keys(MST).filter(k=>sc[k]).map(k=>`<i style="width:${sc[k]/tot*100}%;background:var(--s-${cor[k]})" title="${MST[k]}: ${sc[k]}"></i>`).join("")}</div>
      <table class="t"><tbody>${Object.keys(MST).map(k=>`<tr><td><span class="st ${k}">${MST[k]}</span></td><td class="r num"><b>${sc[k]||0}</b></td><td class="r num" style="color:var(--faint)">${Math.round((sc[k]||0)/tot*100)}%</td></tr>`).join("")}</tbody></table></div></section></div>`;
  const porCat=groupCount(val,m=>m.categoria||"Sem categoria"),porLoc=groupCount(val,m=>m.localId||"");
  h+=`<div class="grid2"><section class="card"><div class="card-h"><h2>Categorias</h2><span class="sub">chamados · tempo médio de solução</span></div><div class="card-b">${hbars(porCat.slice(0,10).map(([k,l])=>({n:k,v:l.length,x:fDur(avg(l.filter(m=>m.status==="concluida").map(tSolucao)))})))}</div></section>
    <section class="card"><div class="card-h"><h2>Locais</h2><span class="sub">chamados · custo</span></div><div class="card-b">${hbars(porLoc.slice(0,10).map(([k,l])=>({n:k?nomeLocal(k):"Sem local",v:l.length,x:fBRL(l.reduce((s,m)=>s+custoTotal(m),0))})))}</div></section></div>`;
  const porEq=groupCount(val.filter(m=>m.equipamentoId),m=>m.equipamentoId).slice(0,10);
  h+=`<section class="card" style="margin-bottom:16px"><div class="card-h"><h2>Equipamentos com mais chamados</h2><span class="sub">candidatos a troca ou a preventiva</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Equipamento</th><th class="r">Chamados</th><th class="r">Corretivas</th><th class="r">Custo</th><th class="r">Solução média</th></tr></thead><tbody>
    ${porEq.length?porEq.map(([k,l])=>`<tr><td><a class="lnk" href="#m-eq/${esc(k)}"><b>${esc(nomeEquip(k))}</b></a> <span style="color:var(--faint)">${esc(nomeLocal((byId(S.equipamentos,k)||{}).localId))}</span></td><td class="r num">${l.length}</td><td class="r num">${l.filter(m=>m.tipo==="corretiva").length}</td><td class="r money">${fBRL(l.reduce((s,m)=>s+custoTotal(m),0))}</td><td class="r num">${fDur(avg(l.filter(m=>m.status==="concluida").map(tSolucao)))}</td></tr>`).join(""):`<tr><td colspan="5">Nenhum chamado ligado a equipamento no período.</td></tr>`}</tbody></table></div></section>`;
  const terc=val.filter(m=>m.executor==="terceiro");const porPr=groupCount(terc,m=>m.prestadorId||"");const porTec=groupCount(val.filter(m=>m.executor!=="terceiro"),m=>m.equipeIds||[]);
  h+=`<div class="grid2"><section class="card"><div class="card-h"><h2>Prestadores</h2><span class="sub">${terc.length} OS com terceiros</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Prestador</th><th class="r">OS</th><th class="r">Concluídas</th><th class="r">Custo</th></tr></thead><tbody>
      ${porPr.length?porPr.map(([k,l])=>`<tr><td><b>${esc(k?nomePrest(k):"A definir")}</b></td><td class="r num">${l.length}</td><td class="r num">${l.filter(m=>m.status==="concluida").length}</td><td class="r money">${fBRL(l.reduce((s,m)=>s+custoTotal(m),0))}</td></tr>`).join(""):`<tr><td colspan="4">Nenhuma OS com terceiros.</td></tr>`}</tbody></table></div></section>
    <section class="card"><div class="card-h"><h2>Equipe interna</h2><span class="sub">participação</span></div><div class="card-b tbl-wrap"><table class="t"><thead><tr><th>Técnico</th><th class="r">OS</th><th class="r">Concluídas</th><th class="r">No prazo</th></tr></thead><tbody>
      ${porTec.length?porTec.map(([k,l])=>{const c=l.filter(m=>m.status==="concluida");const cp2=c.filter(m=>isFinite(prazoM(m)));const p=byId(S.equipe,k);return `<tr><td><b>${esc(p?p.nome:"—")}</b>${p&&p.funcao?` <span style="color:var(--faint)">${esc(p.funcao)}</span>`:""}</td><td class="r num">${l.length}</td><td class="r num">${c.length}</td><td class="r num">${cp2.length?Math.round(cp2.filter(m=>!mConclAtraso(m)).length/cp2.length*100)+"%":"—"}</td></tr>`}).join(""):`<tr><td colspan="4">Nenhuma OS com equipe interna.</td></tr>`}</tbody></table></div></section></div>`;
  app.innerHTML=h;bindMPainel();drawBars($("#chM"),series);
  const sv=$("#chM svg");if(sv)sv.setAttribute("aria-label","Chamados de manutenção por dia");
}
function bindMPainel(){
  const sv=()=>{try{localStorage.setItem("mc-man-f",JSON.stringify(S.mf))}catch(e){}};
  $("#mfPer").onchange=e=>{S.mf.periodo=e.target.value;sv();renderMPainel()};$("#mfLoc").onchange=e=>{S.mf.local=e.target.value;sv();renderMPainel()};$("#mfCat").onchange=e=>{S.mf.cat=e.target.value;sv();renderMPainel()};
  $("#mExp").onclick=()=>exportCSVM(S.manutencoes.filter(inMPainel));
}
function exportCSVM(list){
  const cols=["OS","Situação","Atraso","Tipo","Categoria","Prioridade","Problema","Local","Onde","Setor","Equipamento","Patrimônio","Quem pediu","WhatsApp","Aberto em","Triagem em","Programado para","Prazo","Iniciado em","Concluído em","Atendimento (min)","Solução (min)","Executor","Técnicos / prestador","Aguardando","Diagnóstico","O que foi feito","Custo total (R$)","Itens de custo","Recebido por","Fotos"];
  const q=v=>{v=v==null?"":String(v);return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};const mn=ms=>isFinite(ms)&&ms>=0?Math.round(ms/60000):"";
  const rows=list.map(m=>{const e=byId(S.equipamentos,m.equipamentoId)||{};return [codM(m),MST[m.status],mAtrasada(m)||mConclAtraso(m)?"Sim":"Não",m.tipo,m.categoria,m.prioridade,m.descricao,nomeLocal(m.localId),m.localDetalhe,nomeSetor(m.setorId),e.nome||"",e.codigo||"",m.solicitante,m.solicitanteTelefone,fDH(m.criadoEm),fDH(m.triadoEm),fDH(m.agendadoPara),fDH(new Date(prazoM(m)).toISOString()),fDH(m.iniciadoEm),fDH(m.concluidoEm),mn(tAtend(m)),mn(tSolucao(m)),m.executor==="terceiro"?"Terceiro":"Interno",executorTxt(m),m.aguardandoMotivo,m.diagnostico,m.solucao,custoTotal(m).toFixed(2).replace(".",","),(m.custos||[]).map(c=>`${c.qtd||1}x ${c.desc} (${c.tipo}) ${fBRL(c.valor)}`).join(" | "),m.recebidoPor,(m.fotosAbertura||[]).length+(m.fotosAntes||[]).length+(m.fotosDepois||[]).length].map(q).join(";")});
  const csv="﻿"+cols.join(";")+"\n"+rows.join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="manutencao-"+dayKey(new Date())+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/* ---------- Demonstração da manutenção ---------- */
function loadDemoMan(){
  const now=Date.now();let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};const pick=a=>a[Math.floor(rnd()*a.length)];
  S.equipe.push(...[["Técnico Elétrica","Eletricista"],["Técnico Hidráulica","Encanador"],["Técnico Refrigeração","Técnico de refrigeração"],["Manutenção geral","Manutenção geral"]].map(([n,f],i)=>({id:"t"+i,nome:n,funcao:f,area:"manutencao",ativo:true})));
  S.prestadores=[["Frio Total Climatização","Ar-condicionado"],["Hidro Já","Hidráulica"],["Eletro SP","Elétrica"]].map(([n,e],i)=>({id:"pr"+i,nome:n,especialidade:e,telefone:"(11) 3333-000"+i,ativo:true}));
  S.equipamentos=[["Ar split salão 1","AC-001","Ar-condicionado","mc","s0"],["Ar split salão 2","AC-002","Ar-condicionado","mc","s0"],["Câmara fria","RF-001","Refrigeração","mc","s1"],["Forno combinado","CZ-001","Cozinha industrial","mc","s1"],["Gerador 150 kVA","GE-001","Gerador / energia","mc",""],["Ar split VIP","AC-010","Ar-condicionado","mg","s6"],["Freezer bar VIP","RF-010","Refrigeração","mg","s6"],["Bomba de recalque","HD-001","Hidráulica","cm","s10"],["Coifa cozinha","CZ-020","Cozinha industrial","dr",""],["Elevador social","EL-001","Elevador","cm",""]]
    .map(([n,c,cat,l,s],i)=>({id:"q"+i,nome:n,codigo:c,categoria:cat,localId:l,setorId:s,marca:["LG","Springer","Rational","Cummins","Consul"][i%5],modelo:"",ativo:true,criadoEm:new Date(now-200*86400000).toISOString()}));
  S.planos=[{id:"pl0",nome:"Limpeza de filtros dos splits do salão",equipamentoId:"q0",localId:"mc",categoria:"Ar-condicionado",frequencia:"mensal",inicio:dataLocal(new Date(now-40*86400000)),hora:"09:00",executor:"interno",equipeIds:["t2"],checklist:["Limpar filtros","Verificar dreno","Medir temperatura de saída"],pulos:[],ativo:true,criadoEm:new Date(now-60*86400000).toISOString()},
    {id:"pl1",nome:"Teste do gerador com carga",equipamentoId:"q4",localId:"mc",categoria:"Gerador / energia",frequencia:"quinzenal",inicio:dataLocal(new Date(now-20*86400000)),hora:"07:30",executor:"interno",equipeIds:["t0"],checklist:["Nível de óleo","Nível de diesel","Partida e 15 min com carga","Bateria"],pulos:[],ativo:true,criadoEm:new Date(now-60*86400000).toISOString()},
    {id:"pl2",nome:"Limpeza da caixa d'água",localId:"cm",categoria:"Hidráulica",frequencia:"semestral",inicio:dataLocal(new Date(now+12*86400000)),hora:"08:00",executor:"terceiro",prestadorId:"pr1",equipeIds:[],checklist:["Esvaziar e escovar","Desinfetar","Emitir laudo"],pulos:[],ativo:true,criadoEm:new Date(now-10*86400000).toISOString()}];
  const probs=[["Ar pingando água em cima da mesa","Ar-condicionado","q0"],["Ar não gela","Ar-condicionado","q5"],["Câmara fria com temperatura alta","Refrigeração","q2"],["Tomada da bancada sem energia","Elétrica",""],["Vazamento na pia da cozinha","Hidráulica",""],["Lâmpadas queimadas no corredor","Elétrica",""],["Porta do banheiro não fecha","Marcenaria",""],["Infiltração no teto do salão VIP","Civil / alvenaria",""],["Freezer fazendo barulho","Refrigeração","q6"],["Descarga vazando","Hidráulica",""],["Forno não liga","Cozinha industrial","q3"],["Pintura descascando na fachada","Pintura",""]];
  const locs=["mc","mc","mc","mg","mg","dr","cm"];const out=[];
  for(let i=0;i<46;i++){const [t,cat,eq]=pick(probs);const e=eq?S.equipamentos.find(x=>x.id===eq):null;const ab=now-(rnd()*45)*86400000;const pr=rnd()<.12?"urgente":rnd()<.3?"alta":rnd()<.15?"baixa":"normal";
    const age=(now-ab)/86400000;let st=age>6?(rnd()<.06?"cancelada":"concluida"):age>2?pick(["concluida","concluida","em_execucao","aguardando","agendada"]):pick(["aberto","aberto","agendada","em_execucao"]);
    const terc=rnd()<.3;const ini=ab+(1+rnd()*30)*3600000;const fim=ini+(1+rnd()*40)*3600000;
    const custos=st==="concluida"&&rnd()<.6?[{desc:pick(["Capacitor","Reator","Sifão","Disjuntor 20A","Gás R410","Dobradiça","Tinta acrílica"]),tipo:"Peça",qtd:1+Math.floor(rnd()*3),valor:Math.round(30+rnd()*400)}].concat(terc?[{desc:"Visita técnica",tipo:"Serviço de terceiro",qtd:1,valor:Math.round(150+rnd()*600)}]:[]):[];
    out.push({id:"m"+i,numero:i+1,status:st,tipo:"corretiva",categoria:cat,prioridade:pr,descricao:t,localId:e?e.localId:pick(locs),setorId:e?e.setorId:"",equipamentoId:eq,solicitante:pick(["Laura Souza","Marcos Lima","Chef Doryo","Gerência VIP"]),solicitanteId:i%7===0?"demo":"x",solicitanteTelefone:"(11) 99999-8888",
      executor:terc?"terceiro":"interno",equipeIds:st==="aberto"||terc?[]:[pick(["t0","t1","t2","t3"])],prestadorId:terc&&st!=="aberto"?pick(["pr0","pr1","pr2"]):"",criadoEm:new Date(ab).toISOString(),triadoEm:st==="aberto"?null:new Date(ab+3600000).toISOString(),
      agendadoPara:st==="aberto"?null:new Date(ab+(2+rnd()*20)*3600000).toISOString(),iniciadoEm:["em_execucao","aguardando","concluida"].includes(st)?new Date(ini).toISOString():null,concluidoEm:st==="concluida"?new Date(fim).toISOString():null,
      solucao:st==="concluida"?"Serviço realizado e testado.":null,aguardandoMotivo:st==="aguardando"?"Peça ou material: aguardando entrega do fornecedor":null,custos,fotosAbertura:[],fotosAntes:[],fotosDepois:[],motivoCancelamento:st==="cancelada"?"Resolvido pelo próprio setor":"",
      historico:[{s:"aberto",em:new Date(ab).toISOString(),nota:"Chamado aberto"}]});}
  S.manutencoes=out.sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  S.loaded.manutencoes=S.loaded.equipamentos=true;
}

/* ---------- Demonstração (sem banco) ---------- */
function loadDemo(){
  const L=[["mc","Monte Carlo Poker Club","Clube"],["mg","Mirage","Clube"],["dr","Restaurante Doryo","Restaurante"],["cd1","CD Principal","Centro de distribuição"],["esc","Escritório Central","Escritório"],["cm","Prédio Cardoso de Melo","Prédio"],["rc","Residência da diretoria","Residência da chefia"],["rf","Residência de funcionário","Residência de funcionário"],["fo","Fornecedor (atacado)","Fornecedor"]];
  S.locais=L.map(([id,nome,tipo])=>({id,nome,tipo,ativo:true}));
  S.setores=["Bar","Cozinha","Eventos","Manutenção","Compras","Diretoria","Salão de jogos","Administrativo","Doryo"].map((n,i)=>({id:"s"+i,nome:n,ativo:true}));
  S.equipe=[["Motorista A","Motorista"],["Motorista B","Motorista"],["Ajudante A","Ajudante"],["Ajudante B","Ajudante"],["Coordenação","Coordenador"]].map(([n,f],i)=>({id:"e"+i,nome:n,funcao:f,ativo:true}));
  S.veiculos=[["Van de carga","ABC1D23","Van"],["Utilitário","EFG4H56","Utilitário"],["Caminhão 3/4","IJK7L89","Caminhão 3/4"]].map(([n,p,t],i)=>({id:"v"+i,nome:n,placa:p,tipo:t,ativo:true}));
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};const pick=a=>a[Math.floor(rnd()*a.length)];
  const itens=[["Fardos de água 500 ml","fardo"],["Engradados de cerveja","engradado"],["Cadeiras dobráveis","un"],["Mesas de poker","un"],["Caixas de fichas","cx"],["Peixe fresco","kg"],["Arroz japonês","kg"],["Material de limpeza","cx"],["Toalhas de mesa","pct"],["Barris de chope","barril"],["Equipamento de som","un"],["Documentos","pct"]];
  const now=Date.now();const out=[];
  for(let i=0;i<64;i++){
    const day=Math.floor(rnd()*34)-27;const base=new Date(now+day*86400000);base.setHours(7+Math.floor(rnd()*12),rnd()<.5?0:30,0,0);
    const ag=base.getTime();const sol=ag-(1+rnd()*30)*3600000;const o=pick(L)[0];let d=pick(L)[0];if(d===o)d=L[(L.findIndex(x=>x[0]===o)+3)%L.length][0];
    let st;const past=ag<now-2*3600000;
    if(past){st=rnd()<.06?"cancelada":"concluida"}else if(ag<now){st=rnd()<.5?"em_rota":"agendada"}else st=rnd()<.15?"registrada":"agendada";
    const dur=(40+rnd()*150)*60000;const prev=ag+2*3600000;const ini=ag+(rnd()*50-15)*60000;const fim=ini+dur*(rnd()<.15?1.8:1);
    const its=[0,1].slice(0,1+Math.floor(rnd()*2)).map(()=>{const [desc,un]=pick(itens);return {desc,qtd:1+Math.floor(rnd()*20),un}});
    const km=20000+Math.floor(rnd()*30000);
    out.push({id:"d"+i,numero:i+1,tipo:pick(TIPOS.slice(0,7)),prioridade:rnd()<.12?"urgente":rnd()<.2?"alta":"normal",setorId:"s"+Math.floor(rnd()*9),solicitante:"",canal:pick(CANAIS),
      solicitadoEm:new Date(sol).toISOString(),origemId:o,destinoId:d,itens:its,agendadoPara:new Date(ag).toISOString(),previstoAte:new Date(prev).toISOString(),
      equipeIds:st==="registrada"?[]:["e"+Math.floor(rnd()*2),"e"+(2+Math.floor(rnd()*2))],veiculoId:st==="registrada"?"":"v"+Math.floor(rnd()*3),status:st,
      criadoEm:new Date(sol+20*60000).toISOString(),agendadaEm:st==="registrada"?null:new Date(sol+(20+rnd()*200)*60000).toISOString(),
      iniciadoEm:["em_rota","concluida"].includes(st)?new Date(ini).toISOString():null,concluidoEm:st==="concluida"?new Date(fim).toISOString():null,
      kmInicial:st==="concluida"?km:null,kmFinal:st==="concluida"?km+5+Math.floor(rnd()*40):null,
      conclusao:st==="concluida"?{fotos:[],recebidoPor:"",obs:""}:null,motivoCancelamento:st==="cancelada"?"Pedido cancelado pelo setor":"",
      historico:[{s:"registrada",em:new Date(sol+20*60000).toISOString(),nota:"OS registrada"}]});
  }
  out.forEach((o,i)=>{o.numero=i+1});
  S.os=out.sort((a,b)=>T(b.criadoEm)-T(a.criadoEm));
  const ex=[["Cozinha","dr","cd1",[{desc:"Arroz japonês",qtd:30,un:"kg"},{desc:"Shoyu",qtd:6,un:"cx"}],5],["Eventos","cd1","mg",[{desc:"Cadeiras dobráveis",qtd:80,un:"un"},{desc:"Toalhas de mesa",qtd:20,un:"pct"}],26],["Bar","cd1","mc",[{desc:"Engradados de cerveja",qtd:12,un:"engradado"}],2]];
  S.pedidos=ex.map(([st,o,d,it,h],i)=>({uid:"demo-u"+i,pid:"dp"+i,status:"aguardando",tipo:"Abastecimento de estoque",prioridade:i===2?"alta":"normal",setorId:"s"+["Bar","Cozinha","Eventos"].indexOf(st),origemId:o,destinoId:d,itens:it,
    desejadoPara:new Date(now+h*3600000).toISOString(),criadoEm:new Date(now-(i+1)*40*60000).toISOString(),observacoes:i===1?"Montagem do torneio de sábado":""}));
  S.pedidos.push({uid:"demo-u3",pid:"dp3",status:"convertido",osId:out[0].id,numero:out[0].numero,tipo:"Retirada",setorId:"s4",origemId:"fo",destinoId:"cd1",itens:[{desc:"Material de limpeza",qtd:10,un:"cx"}],criadoEm:new Date(now-86400000).toISOString(),respondidoEm:new Date(now-80000000).toISOString()});
  ["Ana (Cozinha)","Bruno (Eventos)","Carla (Bar)","Diego (Compras)"].forEach((n,i)=>S.names["demo-u"+i]=n);
  S.meus=S.pedidos.slice(1,4).map(x=>Object.assign({},x,{uid:"demo"}));S.uid="demo";S.names.demo="Você";
  const pm=new Date();pm.setDate(1);pm.setMonth(pm.getMonth()-1);
  S.locais.forEach(l=>{l.sigla={mc:"M.C.",mg:"M.G.",dr:"Doryo",cm:"Cardoso",cd1:"CD 1"}[l.id]||""});
  S.setores=[["Bar 2 Andar","mc"],["Cozinha 2º Andar","mc"],["Decoração e Eventos","mc"],["Manutenção","mc"],["Compras","mc"],["Valet","mc"],["Bar (Vip)","mg"],["Cozinha (VIP)","mg"],["Valet","mg"],["Decoração e Eventos","dr"],["Garagem","cm"],["Disponível","cd1"]]
    .map(([n,l],i)=>({id:"s"+i,nome:n,localId:l,ativo:true}));
  S.solicitantes=[{id:"c1",nome:"Laura Souza",telefone:"(11) 99999-8888",setorId:"s4",ativo:true},{id:"c2",nome:"Marcos Lima",telefone:"(11) 98888-7777",setorId:"s1",ativo:true}];
  S.recorrencias=[{id:"rec-demo",nome:"Abastecimento do Doryo",ativo:true,diasSemana:[2,5],hora:"09:00",duracaoMin:150,pulos:[],criadoEm:new Date(now-30*86400000).toISOString(),
    modelo:{tipo:"Abastecimento de estoque",prioridade:"normal",setorId:"s8",paradas:[novaParada("retirada","cd1","Estoque seco"),novaParada("retirada","fo","Peixaria"),novaParada("entrega","dr","Cozinha")],itens:[{desc:"Arroz japonês",qtd:30,un:"kg"},{desc:"Peixe fresco",qtd:12,un:"kg"}],equipeIds:["e0","e2"],veiculoId:"v1",observacoes:"Peixe em caixa térmica"}}];
  loadDemoMan();
  S.relatorios=[{id:pm.getFullYear()+"-"+pad(pm.getMonth()+1),geradoEm:new Date(now-12*86400000).toISOString(),resumo:"Exemplo de fechamento. O volume cresceu puxado por Eventos e Bar, e a rota CD → Mirage concentrou a maior parte das transferências. O tempo de resposta caiu, mas um terço das OS concluídas passou da previsão de término, quase todas em retiradas de fornecedor.",destaques:["Rever a previsão de término das retiradas em fornecedor, que costumam levar mais de 2 h.","Concentrar as entregas CD → Mirage em uma rota fixa pela manhã."]}];
}

/* ---------- Início ---------- */
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.route==="painel")renderPainel()},200)});
boot();
})();
