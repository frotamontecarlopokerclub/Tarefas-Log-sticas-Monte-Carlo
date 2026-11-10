/* =========================================================
   INVENTÁRIO CENTRAL — GRUPO MONTE CARLO
   Arquivo gerado a partir de src/js (não edite aqui).
   Módulos: 00_config.js, 01_util.js, 02_ui.js, 03_auth.js, 04_locais.js, 05_pecas_dashboard.js, 06_catalogo.js, 07_onde_esta.js, 08_cadastro.js, 09_movimentacao.js, 10_inventario.js, 11_historico.js, 12_administracao.js, 13_consulta_publica.js, 14_radios.js, 15_seguranca.js, 16_navegacao.js, 17_importar_radios.js, 99_inicio.js
========================================================= */

/* =========================================================
   INVENTÁRIO CENTRAL — GRUPO MONTE CARLO
   00 · CONFIGURAÇÃO E ESTADO GLOBAL

   Código-fonte organizado em módulos (pasta src/js).
   O arquivo app.js publicado é a junção destes módulos,
   na ordem do número de cada arquivo.
========================================================= */

const SUPABASE_URL = 'https://sxmimxomehdhyifqsgqa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NbyYYTsRnSqu_TMpQvzS6A_rJuyzq9_';

/* Lido antes do cliente do Supabase processar o link de redefinição de senha. */
const VEIO_DO_LINK_DE_NOVA_SENHA = /type=recovery/.test(window.location.hash);

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Sessão e perfil */
let usuarioLogado = null;
let perfilUsuario = null;
let nomeUsuarioLogado = '';

/* Dados carregados do banco */
let itens = [];
let itensCarregados = false;   // diferencia "carregando" de "não há peças"
let produtos = [];
let subsetores = [];
let movimentacoes = [];
let radios = [];

/* Marca e modelo padrão dos rádios (lista real vem de configuracoes.radio_modelos). */
let modelosRadio = [{ marca: 'Kytera', modelo: 'BP516 U(I)' }];

/*
   Locais: a lista abaixo é só a reserva para quando a tabela "locais"
   ainda não existe. O sistema carrega a lista real do banco ao iniciar.
*/
let LOCAIS = [
    'MONTE CARLO POKER CLUBE', 'MIRAGE', 'DORYO', 'ESCRITÓRIO CENTRAL', 'ESCRITÓRIO GUARARAPES',
    'CASAS DO CHEFE', 'CASAS DE FUNCIONÁRIOS', 'FLATS DO CHEFE', 'DEPÓSITOS'
].map((nome, indice) => ({ id: indice + 1, nome }));

let LOCAIS_TODOS = LOCAIS.map(local => ({ ...local, ativo: true }));

/* Constantes de negócio */
const STATUS_PECA = ['Ativo', 'Em manutenção', 'Baixado', 'Extraviado'];
const STATUS_RADIO = ['Ativo', 'Reserva', 'Em manutenção', 'Extraviado', 'Baixado'];
const PERFIS_GESTAO = ['administrador', 'gestor'];

const ROTULOS_MOVIMENTO = {
    ENTRADA: 'Cadastro',
    TRANSFERENCIA: 'Transferência',
    SAIDA_TEMPORARIA: 'Saída temporária',
    REMANEJAMENTO: 'Remanejamento',
    DEVOLUCAO: 'Devolução',
    STATUS: 'Mudança de status'
};

/* =========================================================
   01 · UTILITÁRIOS
========================================================= */

const numero = new Intl.NumberFormat('pt-BR');
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function escaparHTML(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* Para buscas: sem acento, minúsculo, espaços únicos. */
function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim().replace(/\s+/g, ' ');
}

/* Mesma regra do banco para comparar nomes (lower + trim). */
function chaveNome(valor) {
    return String(valor || '').toLowerCase().trim();
}

function definirTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.innerText = valor;
}

function valorCampo(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function dataCurta(valor) {
    if (!valor) return '';
    const data = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + 'T12:00:00') : new Date(valor);
    return data.toLocaleDateString('pt-BR');
}

function hojeISO() {
    const agora = new Date();
    return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function diasDesde(valor) {
    if (!valor) return null;
    return Math.max(0, Math.floor((Date.now() - new Date(valor).getTime()) / 86400000));
}

function formatarTelefone(valor) {
    const d = String(valor || '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return valor || '';
}

function compararTexto(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

/* Opções de <select> a partir de [{valor, texto}] mantendo a seleção atual. */
function preencherSelect(select, opcoes, primeira = null) {
    if (!select) return;
    const atual = select.value;
    select.innerHTML = (primeira !== null ? `<option value="">${escaparHTML(primeira)}</option>` : '') +
        opcoes.map(o => `<option value="${escaparHTML(o.valor)}">${escaparHTML(o.texto)}</option>`).join('');
    if ([...select.options].some(opcao => opcao.value === atual)) select.value = atual;
}

/*
   O Supabase devolve no máximo 1.000 linhas por consulta:
   busca em páginas até trazer tudo.
*/
async function buscarTodasLinhas(montarConsulta, tamanhoPagina = 1000) {
    const linhas = [];
    for (let inicio = 0; ; inicio += tamanhoPagina) {
        const { data, error } = await montarConsulta().range(inicio, inicio + tamanhoPagina - 1);
        if (error) throw error;
        linhas.push(...(data || []));
        if (!data || data.length < tamanhoPagina) return linhas;
    }
}

function mensagemErro(erro) {
    return erro?.message || erro?.error_description || 'Erro desconhecido.';
}

/* Mensagens do banco em português claro. */
function traduzirErro(erro) {
    const codigo = erro?.code;
    const texto = erro?.message || String(erro || '');

    if (codigo === '23505' && /produtos/.test(texto)) return 'Já existe uma peça com esse nome no catálogo.';
    if (codigo === '23505' && /locais/.test(texto)) return 'Já existe um local com esse nome.';
    if (codigo === '23505' && /radios/.test(texto)) return 'Já existe um rádio com esse número de série.';
    if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) {
        return 'Seu perfil não tem permissão para esta operação.';
    }
    if (/relation .* does not exist|Could not find the (table|function)/i.test(texto)) {
        return 'Uma atualização do banco ainda não foi executada no Supabase.';
    }
    return texto || 'Erro desconhecido.';
}

/* Identificador aleatório (funciona também em navegadores sem crypto.randomUUID). */
function gerarId() {
    if (window.crypto?.randomUUID) {
        try { return crypto.randomUUID(); } catch { /* página sem https */ }
    }
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =========================================================
   02 · INTERFACE: avisos, janelas, fotos, navegação
========================================================= */


/* =========================================================
   AVISOS (substituem o alert nas telas novas)
========================================================= */

function avisar(mensagem, tipo = 'sucesso') {
    let area = document.getElementById('mcAvisos');
    if (!area) {
        area = Object.assign(document.createElement('div'), { id: 'mcAvisos', className: 'mc-avisos' });
        area.setAttribute('aria-live', 'polite');
        document.body.appendChild(area);
    }

    const icones = { sucesso: 'fa-circle-check', erro: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const aviso = document.createElement('div');
    aviso.className = `mc-aviso mc-aviso-${tipo}`;
    aviso.innerHTML = `<i class="fa-solid ${icones[tipo] || icones.info}"></i><span>${escaparHTML(mensagem)}</span>`;
    area.appendChild(aviso);

    setTimeout(() => aviso.classList.add('saindo'), tipo === 'erro' ? 6000 : 3500);
    setTimeout(() => aviso.remove(), tipo === 'erro' ? 6400 : 3900);
}



/* =========================================================
   CONFIRMAÇÃO NA TELA (substitui o confirm do navegador)
   const sim = await confirmar({ titulo, mensagem, textoConfirmar, perigo })
========================================================= */

function confirmar({ titulo = 'Confirmar', mensagem = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false } = {}) {
    let modal = document.getElementById('mcConfirmar');
    if (!modal) {
        modal = Object.assign(document.createElement('div'), { id: 'mcConfirmar', className: 'mc-modal mc-confirmar', hidden: true });
        modal.innerHTML = `
            <div class="mc-modal-caixa" role="alertdialog" aria-modal="true" aria-labelledby="mcConfirmarTitulo" aria-describedby="mcConfirmarTexto">
                <header class="mc-modal-topo"><div><h3 id="mcConfirmarTitulo"></h3></div></header>
                <div class="mc-modal-corpo"><p id="mcConfirmarTexto" class="mc-confirmar-texto"></p></div>
                <footer class="mc-modal-rodape">
                    <button type="button" class="btn-secondary" id="mcConfirmarNao"></button>
                    <button type="button" class="btn-primary" id="mcConfirmarSim"></button>
                </footer>
            </div>`;
        document.body.appendChild(modal);
    }

    modal.querySelector('#mcConfirmarTitulo').textContent = titulo;
    modal.querySelector('#mcConfirmarTexto').textContent = mensagem;
    const sim = modal.querySelector('#mcConfirmarSim');
    const nao = modal.querySelector('#mcConfirmarNao');
    sim.textContent = textoConfirmar;
    nao.textContent = textoCancelar;
    sim.classList.toggle('btn-perigo', perigo);

    return new Promise(resolve => {
        const terminar = resposta => {
            modal.hidden = true;
            document.body.classList.remove('modal-aberto');
            sim.onclick = nao.onclick = modal.onclick = null;
            document.removeEventListener('keydown', teclas, true);
            resolve(resposta);
        };
        const teclas = evento => {
            if (evento.key === 'Escape') { evento.stopPropagation(); terminar(false); }
        };
        sim.onclick = () => terminar(true);
        nao.onclick = () => terminar(false);
        modal.onclick = evento => { if (evento.target === modal) terminar(false); };
        document.addEventListener('keydown', teclas, true);
        modal.hidden = false;
        document.body.classList.add('modal-aberto');
        setTimeout(() => (perigo ? nao : sim).focus(), 30);
    });
}


/* =========================================================
   FORMULÁRIO EM JANELA (substitui o prompt)
========================================================= */

let formularioAtual = null;

function garantirModalFormulario() {
    let modal = document.getElementById('mcModalForm');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'mcModalForm';
    modal.className = 'mc-modal';
    modal.hidden = true;
    modal.innerHTML = `
        <div class="mc-modal-caixa" role="dialog" aria-modal="true" aria-labelledby="mcModalTitulo">
            <header class="mc-modal-topo">
                <div>
                    <h3 id="mcModalTitulo"></h3>
                    <p id="mcModalSubtitulo"></p>
                </div>
                <button type="button" class="mc-modal-x" aria-label="Fechar" data-fechar>
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </header>
            <form id="mcModalCorpo" class="mc-modal-corpo" novalidate></form>
            <div id="mcModalErro" class="mc-modal-erro" hidden></div>
            <footer class="mc-modal-rodape">
                <button type="button" class="btn-secondary" data-fechar>Cancelar</button>
                <button type="submit" form="mcModalCorpo" class="btn-primary" id="mcModalSalvar">Salvar</button>
            </footer>
        </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', evento => {
        if (evento.target.closest('[data-fechar]')) cancelarFormulario();
        else if (evento.target === modal && !formularioAtual?.travado) cancelarFormulario();
    });
    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && !modal.hidden && !formularioAtual?.travado) cancelarFormulario();
    });
    modal.querySelector('#mcModalCorpo').addEventListener('submit', enviarFormulario);

    return modal;
}

function campoFormularioHTML(campo) {
    const id = `mcCampo_${campo.id}`;
    const valor = campo.valor ?? '';
    const obrigatorio = campo.obrigatorio ? 'required' : '';
    const classe = `input-group mc-campo ${campo.largo ? 'mc-campo-largo' : ''}`;
    const ajuda = campo.ajuda ? `<small>${escaparHTML(campo.ajuda)}</small>` : '';
    const rotulo = `<label for="${id}">${escaparHTML(campo.rotulo)}${campo.obrigatorio ? ' <b>*</b>' : ''}</label>`;

    if (campo.tipo === 'html') {
        return `<div class="mc-campo-largo">${campo.html || ''}</div>`;
    }
    if (campo.tipo === 'checkbox') {
        return `<label class="mc-check ${campo.largo ? 'mc-campo-largo' : ''}">
                    <input type="checkbox" id="${id}" ${valor ? 'checked' : ''}>
                    <span>${escaparHTML(campo.rotulo)}</span>
                </label>`;
    }
    if (campo.tipo === 'textarea') {
        return `<div class="${classe}">${rotulo}
                    <textarea id="${id}" rows="3" ${obrigatorio} placeholder="${escaparHTML(campo.placeholder || '')}">${escaparHTML(valor)}</textarea>${ajuda}</div>`;
    }
    if (campo.tipo === 'select') {
        const opcoes = (campo.opcoes || []).map(opcao =>
            `<option value="${escaparHTML(opcao.valor)}" ${String(opcao.valor) === String(valor) ? 'selected' : ''}>${escaparHTML(opcao.texto)}</option>`
        ).join('');
        return `<div class="${classe}">${rotulo}<select id="${id}" ${obrigatorio}>${opcoes}</select>${ajuda}</div>`;
    }
    if (campo.tipo === 'arquivo') {
        return `<div class="${classe} mc-campo-arquivo">${rotulo}
                    <input type="file" id="${id}" accept="${escaparHTML(campo.accept || '')}" ${obrigatorio}>${ajuda}</div>`;
    }
    if (campo.tipo === 'file') {
        const previa = campo.valor
            ? `<img src="${escaparHTML(campo.valor)}" alt="Foto atual" class="mc-previa-foto" id="${id}_previa">`
            : `<div class="mc-previa-foto mc-previa-vazia" id="${id}_previa"><i class="fa-solid fa-image"></i></div>`;
        return `<div class="${classe} mc-campo-foto">${rotulo}
                    <div class="mc-foto-linha">${previa}
                        <div><input type="file" id="${id}" accept="image/*">
                        <small>A imagem é reduzida automaticamente antes do envio.</small></div>
                    </div></div>`;
    }
    return `<div class="${classe}">${rotulo}
                <input id="${id}" type="${campo.tipo || 'text'}" value="${escaparHTML(valor)}" ${obrigatorio}
                    ${campo.lista ? `list="${campo.lista}"` : ''}
                    ${campo.min !== undefined ? `min="${campo.min}"` : ''}
                    ${campo.step ? `step="${campo.step}"` : ''}
                    ${campo.maxlength ? `maxlength="${campo.maxlength}"` : ''}
                    ${campo.inputmode ? `inputmode="${campo.inputmode}"` : ''}
                    placeholder="${escaparHTML(campo.placeholder || '')}" autocomplete="${campo.autocomplete || 'off'}">${ajuda}</div>`;
}

/*
   travado: só sai pelo botão de cancelar (sem X, Esc ou clique fora).
   aoCancelar: chamado quando a pessoa desiste.
*/
function abrirFormulario({ titulo, subtitulo = '', campos, textoSalvar = 'Salvar', aoSalvar, semCancelar = false,
                           textoCancelar = 'Cancelar', aoCancelar = null, travado = false, largo = false }) {
    const modal = garantirModalFormulario();
    modal.querySelector('.mc-modal-caixa')?.classList.toggle('mc-modal-largo', Boolean(largo));
    formularioAtual = { campos, aoSalvar, aoCancelar, travado };

    modal.querySelector('#mcModalTitulo').textContent = titulo;
    modal.querySelector('#mcModalSubtitulo').textContent = subtitulo;
    modal.querySelector('#mcModalSalvar').textContent = textoSalvar;
    modal.querySelector('.mc-modal-rodape [data-fechar]').hidden = semCancelar;
    modal.querySelector('.mc-modal-rodape [data-fechar]').textContent = textoCancelar;
    modal.querySelector('.mc-modal-x').hidden = travado;
    modal.querySelector('#mcModalErro').hidden = true;
    modal.querySelector('#mcModalCorpo').innerHTML = campos.map(campoFormularioHTML).join('');

    campos.filter(campo => campo.tipo === 'file').forEach(campo => {
        const entrada = document.getElementById(`mcCampo_${campo.id}`);
        entrada?.addEventListener('change', () => {
            const arquivo = entrada.files?.[0];
            const previa = document.getElementById(`mcCampo_${campo.id}_previa`);
            if (!arquivo || !previa) return;
            const img = Object.assign(document.createElement('img'), {
                src: URL.createObjectURL(arquivo), className: 'mc-previa-foto', id: previa.id, alt: 'Nova foto'
            });
            previa.replaceWith(img);
        });
    });

    modal.hidden = false;
    document.body.classList.add('modal-aberto');
    setTimeout(() => {
        // Só posiciona o cursor se a pessoa ainda não clicou em nenhum campo.
        if (modal.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return;
        modal.querySelector('input:not([type=checkbox]):not([type=file]), select, textarea')?.focus();
    }, 30);
}

function cancelarFormulario() {
    const aoCancelar = formularioAtual?.aoCancelar;
    fecharFormulario();
    aoCancelar?.();
}

function fecharFormulario() {
    const modal = document.getElementById('mcModalForm');
    if (modal) modal.hidden = true;
    document.body.classList.remove('modal-aberto');
    formularioAtual = null;
}

function lerFormulario() {
    const valores = {};
    formularioAtual.campos.forEach(campo => {
        const elemento = document.getElementById(`mcCampo_${campo.id}`);
        if (!elemento) return;
        if (campo.tipo === 'checkbox') valores[campo.id] = elemento.checked;
        else if (campo.tipo === 'file' || campo.tipo === 'arquivo') valores[campo.id] = elemento.files?.[0] || null;
        else if (campo.tipo === 'number') valores[campo.id] = elemento.value === '' ? null : Number(elemento.value);
        else valores[campo.id] = elemento.value.trim();
    });
    return valores;
}

async function enviarFormulario(evento) {
    evento.preventDefault();
    if (!formularioAtual) return;

    const modal = document.getElementById('mcModalForm');
    const erro = modal.querySelector('#mcModalErro');
    const botao = modal.querySelector('#mcModalSalvar');
    const valores = lerFormulario();

    const faltando = formularioAtual.campos.find(campo => campo.obrigatorio && !valores[campo.id] && valores[campo.id] !== 0);
    if (faltando) {
        erro.textContent = `Preencha o campo "${faltando.rotulo}".`;
        erro.hidden = false;
        document.getElementById(`mcCampo_${faltando.id}`)?.focus();
        return;
    }

    const textoBotao = botao.textContent;
    botao.disabled = true;
    botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    erro.hidden = true;

    try {
        await formularioAtual.aoSalvar(valores);
        fecharFormulario();
    } catch (falha) {
        console.error('ERRO NO FORMULÁRIO:', falha);
        erro.textContent = traduzirErro(falha);
        erro.hidden = false;
    } finally {
        botao.disabled = false;
        botao.textContent = textoBotao;
    }
}


/* =========================================================
   FOTOS — reduzidas no navegador antes do envio
   (fotos de celular têm 4–8 MB; viram ~200–400 KB)
========================================================= */

async function comprimirImagem(arquivo, ladoMaximo = 1600, qualidade = 0.82, sempreJpeg = false) {
    if (!arquivo?.type?.startsWith('image/') || /gif|svg/.test(arquivo.type)) return arquivo;

    try {
        const bitmap = await createImageBitmap(arquivo);
        const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
        if (!sempreJpeg && escala === 1 && arquivo.size < 600 * 1024) return arquivo;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * escala);
        canvas.height = Math.round(bitmap.height * escala);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise(resolver => canvas.toBlob(resolver, 'image/jpeg', qualidade));
        if (!blob || (!sempreJpeg && blob.size >= arquivo.size)) return arquivo;

        const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], nome, { type: 'image/jpeg' });
    } catch (erro) {
        if (sempreJpeg) throw erro;
        console.warn('Não foi possível reduzir a imagem; enviando original.', erro);
        return arquivo;
    }
}

/*
   Miniaturas: ao lado de "foto.jpg" o sistema grava "foto_mini.jpg"
   (≈ 30 KB). As listas carregam a miniatura; se ela não existir
   (fotos antigas), o navegador cai automaticamente na original.
*/
const PASTA_PUBLICA_FOTOS = '/storage/v1/object/public/inventario/';

function urlMiniatura(url) {
    if (!url || !url.includes(PASTA_PUBLICA_FOTOS) || /_mini\.jpg(\?|$)/.test(url)) return url || '';
    return url.replace(/\.[a-z0-9]+(\?.*)?$/i, '_mini.jpg');
}

function caminhoNoStorage(url) {
    const indice = String(url || '').indexOf(PASTA_PUBLICA_FOTOS);
    return indice < 0 ? null : decodeURIComponent(url.slice(indice + PASTA_PUBLICA_FOTOS.length).split('?')[0]);
}

/* <img> de lista: miniatura primeiro, original se faltar; clique amplia a original. */
function imgMiniatura(url, { classe = 'foto-tabela', alt = '' } = {}) {
    const original = escaparHTML(url);
    const mini = escaparHTML(urlMiniatura(url));
    return `<img src="${mini}" alt="${escaparHTML(alt)}" class="${classe}" loading="lazy"
                 onerror="if (this.src !== '${original}') this.src = '${original}';"
                 onclick="abrirModalFoto('${original}')">`;
}

/* Foto só para mostrar (sem ampliar ao tocar), com marcador quando não há foto. */
function fotoPequena(url, classe) {
    if (!url) return `<span class="${classe} foto-vazia"><i class="fa-solid fa-couch"></i></span>`;
    const original = escaparHTML(url);
    return `<img src="${escaparHTML(urlMiniatura(url))}" alt="" class="${classe}" loading="lazy"
                 onerror="this.onerror = null; this.src = '${original}';">`;
}

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const TAMANHO_MAXIMO_FOTO = 15 * 1024 * 1024;

async function enviarFoto(arquivo, pasta = 'inventario') {
    if (!TIPOS_FOTO.includes(arquivo?.type)) {
        throw new Error('Envie uma foto (JPG, PNG, WEBP, GIF ou HEIC).');
    }
    const final = await comprimirImagem(arquivo);
    if (final.size > TAMANHO_MAXIMO_FOTO) throw new Error('A foto passa de 15 MB. Escolha uma imagem menor.');
    const extensao = (final.name.split('.').pop() || 'jpg').toLowerCase();
    const id = gerarId();
    const caminho = `${pasta}/${id}.${extensao}`;

    const { error } = await supabaseClient.storage
        .from('inventario')
        .upload(caminho, final, { upsert: false, contentType: final.type });

    if (error) throw new Error('Erro ao enviar a foto: ' + error.message);

    // Miniatura: se falhar, a foto original continua valendo.
    try {
        const mini = await comprimirImagem(arquivo, 360, 0.78, true);
        await supabaseClient.storage.from('inventario')
            .upload(`${pasta}/${id}_mini.jpg`, mini, { upsert: false, contentType: 'image/jpeg' });
    } catch (erro) {
        console.warn('Miniatura não gerada:', erro);
    }

    return {
        caminho,
        url: supabaseClient.storage.from('inventario').getPublicUrl(caminho).data.publicUrl
    };
}


/* =========================================================
   FOTO AMPLIADA
   (antes o modal nunca aparecia: faltava o estilo do estado "aberto")
========================================================= */

function abrirModalFoto(url) {
    if (!url) return;
    const modal = document.getElementById('modalFoto');
    const imagem = document.getElementById('imagemModal');
    if (!modal || !imagem) return window.open(url, '_blank');
    imagem.src = url;
    modal.classList.add('active');
    document.body.classList.add('modal-aberto');
}

function fecharModalFoto(evento) {
    if (evento?.target && evento.currentTarget && evento.target !== evento.currentTarget) return;
    document.getElementById('modalFoto')?.classList.remove('active');
    if (document.getElementById('mcModalForm')?.hidden !== false) document.body.classList.remove('modal-aberto');
}


/* =========================================================
   NAVEGAÇÃO ENTRE TELAS
========================================================= */

const TELAS_PUBLICAS = ['loginTela', 'consultaPublicaTela'];

/* O que carregar ao entrar em cada tela. */
const AO_ABRIR_TELA = {
    dashboardTela: () => atualizarResumoDashboard(),
    historicoTela: () => carregarHistorico(),
    radiosTela: () => carregarRadios(),
    consultaPublicaTela: () => carregarConsultaPublica()
};

function abrirTela(idTela, elemento) {
    if (!usuarioLogado && !TELAS_PUBLICAS.includes(idTela)) {
        avisar('Entre com seu e-mail e senha primeiro.', 'info');
        return;
    }

    const tela = document.getElementById(idTela);
    if (!tela) return console.error('Tela não encontrada:', idTela);

    document.querySelectorAll('.tela').forEach(item => item.classList.remove('activeTela'));
    tela.classList.add('activeTela');

    document.querySelectorAll('.menu-item').forEach(menu => menu.classList.remove('active'));
    elemento?.classList.add('active');

    document.body.classList.toggle('login-mode', idTela === 'loginTela');
    document.body.classList.toggle('public-mode', idTela === 'consultaPublicaTela');

    document.getElementById('sidebar')?.classList.remove('open');
    window.scrollTo(0, 0);

    AO_ABRIR_TELA[idTela]?.();
    marcarBarraInferior();
}

function toggleSidebar() {
    if (document.body.classList.contains('login-mode') || document.body.classList.contains('public-mode')) return;
    document.getElementById('sidebar')?.classList.toggle('open');
}

/* No celular, tocar fora do menu fecha o menu. */
document.addEventListener('click', evento => {
    const sidebar = document.getElementById('sidebar');
    const botao = document.querySelector('.mobile-menu-btn');
    if (!sidebar || !botao || window.innerWidth > 900) return;
    if (evento.target.closest?.('#barraInferior')) return;   // o botão "Menu" da barra abre o menu
    if (!sidebar.contains(evento.target) && !botao.contains(evento.target)) sidebar.classList.remove('open');
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') fecharModalFoto();
});

/* =========================================================
   03 · LOGIN, PERFIL E MENUS
========================================================= */

function podeAdministrar() {
    return PERFIS_GESTAO.includes(String(perfilUsuario || '').toLowerCase());
}

function podeMovimentar() {
    return Boolean(usuarioLogado) && perfilUsuario !== 'consulta';
}

async function login(evento) {
    evento?.preventDefault();
    evento?.stopPropagation();

    const email = valorCampo('email');
    const password = document.getElementById('password')?.value || '';
    const botao = document.getElementById('btnLogin');
    const textoOriginal = botao?.innerHTML;

    erroLogin('');
    if (!email || !password) {
        erroLogin('Informe o e-mail e a senha.');
        return false;
    }

    try {
        if (botao) {
            botao.disabled = true;
            botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            console.error('ERRO LOGIN:', error);
            erroLogin(/invalid login|credentials/i.test(error.message)
                ? 'E-mail ou senha incorretos. Confira e tente de novo.'
                : /email not confirmed/i.test(error.message)
                    ? 'Este e-mail ainda não foi confirmado. Procure o administrador.'
                    : 'Não foi possível entrar: ' + error.message);
            return false;
        }

        usuarioLogado = data.user;
        await entrarNoSistema();
    } catch (erro) {
        console.error('ERRO AO REALIZAR LOGIN:', erro);
        if (erro?.message !== 'ACESSO_NEGADO') erroLogin('Sem conexão com o sistema. Confira a internet e tente de novo.');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = textoOriginal || '<i class="fa-solid fa-right-to-bracket"></i> Entrar no Sistema';
        }
    }

    return false;
}

function erroLogin(mensagem) {
    const caixa = document.getElementById('loginErro');
    if (!caixa) return mensagem && avisar(mensagem, 'erro');
    caixa.textContent = mensagem;
    caixa.hidden = !mensagem;
}

/* Depois do login (ou de uma sessão já salva): perfil, menus, dados. */
async function entrarNoSistema() {
    await verificarPerfil();
    document.body.classList.remove('login-mode');
    atualizarMenus();
    atualizarUsuarioInterface();
    abrirTela('ondeEstaTela', document.getElementById('menuOndeEsta'));
    await Promise.all([carregarDashboard(), carregarSubsetores()]);
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch (erro) {
        console.error('ERRO LOGOUT:', erro);
    }

    usuarioLogado = null;
    perfilUsuario = null;
    nomeUsuarioLogado = '';

    document.body.classList.add('login-mode');
    atualizarMenus();
    atualizarUsuarioInterface();
    abrirTela('loginTela');
}

/* Usuário inativo ou sem cadastro é desconectado na hora. */
async function verificarPerfil() {
    if (!usuarioLogado) {
        perfilUsuario = null;
        return;
    }

    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('perfil, nome, ativo')
        .ilike('email', usuarioLogado.email)
        .maybeSingle();

    if (error) {
        console.error('ERRO PERFIL:', error);
        perfilUsuario = 'consulta';
        nomeUsuarioLogado = usuarioLogado.email || '';
        return;
    }

    if (!data || data.ativo === false) {
        await supabaseClient.auth.signOut();
        usuarioLogado = null;
        perfilUsuario = null;
        erroLogin('Seu acesso está desativado ou ainda não foi liberado. Procure o administrador.');
        throw new Error('ACESSO_NEGADO');
    }

    nomeUsuarioLogado = String(data.nome || usuarioLogado.email || '').trim();
    perfilUsuario = String(data.perfil || 'consulta').trim().toLowerCase();
}

/*
   Quais menus cada perfil vê.
   · Consulta: procura e consulta (sem mover, cadastrar ou histórico).
   · Operacional: + mover, cadastrar e histórico.
   · Gestor/Administrador: + painel geral e administração.
*/
function atualizarMenus() {
    const logado = Boolean(usuarioLogado);
    const gestao = logado && podeAdministrar();
    const opera = logado && perfilUsuario !== 'consulta';

    const visiveis = {
        menuOndeEsta: logado,
        menuMovimentacao: opera,
        menuForaLugar: logado,
        menuCadastro: opera,
        menuRadios: logado,
        menuEstoque: logado,
        menuProdutos: logado,
        menuHistorico: opera,
        menuDashboard: gestao,
        menuAdministracao: gestao,
        menuLogout: logado,
        menuLogin: !logado
    };

    Object.entries(visiveis).forEach(([id, mostrar]) => {
        const menu = document.getElementById(id);
        if (menu) menu.style.display = mostrar ? 'flex' : 'none';
    });

    // Título de grupo só aparece se o grupo tiver algum item visível.
    document.querySelectorAll('.sidebar-menu .menu-grupo').forEach(titulo => {
        let algum = false;
        for (let irmao = titulo.nextElementSibling; irmao && !irmao.matches('.menu-grupo, .menu-separador'); irmao = irmao.nextElementSibling) {
            if (irmao.style.display !== 'none') algum = true;
        }
        titulo.hidden = !algum;
    });

    document.querySelectorAll('.somente-gestao').forEach(elemento => {
        elemento.style.display = gestao ? '' : 'none';
    });

    atualizarBarraInferior();
}

function atualizarUsuarioInterface() {
    const nome = nomeUsuarioLogado || usuarioLogado?.email || 'Visitante';
    const perfil = perfilUsuario || 'Acesso restrito';

    definirTexto('usuarioNomeSidebar', nome);
    definirTexto('usuarioPerfilSidebar', perfil);
    definirTexto('headerUsuarioNome', nome);
    definirTexto('headerUsuarioPerfil', perfil);

    ['usuarioSidebar', 'headerUsuario'].forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = usuarioLogado ? 'flex' : 'none';
    });
}


/* =========================================================
   ESQUECI MINHA SENHA
   1. A pessoa informa o e-mail → o Supabase envia um link.
   2. O link abre o sistema já logado → pedimos a nova senha.
========================================================= */

function esqueciSenha() {
    abrirFormulario({
        titulo: 'Redefinir senha',
        subtitulo: 'Enviaremos um link para o seu e-mail. Abra o link e escolha a nova senha.',
        textoSalvar: 'Enviar link',
        campos: [{ id: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, largo: true, valor: valorCampo('email') }],
        aoSalvar: async ({ email }) => {
            const destino = window.location.href.split('#')[0].split('?')[0];
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: destino });
            if (error) {
                throw new Error(/rate|limit/i.test(error.message)
                    ? 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.'
                    : error.message);
            }
            avisar('Se o e-mail estiver cadastrado, o link chegará em instantes. Confira também o spam.', 'info');
        }
    });
}

function pedirNovaSenha() {
    abrirFormulario({
        titulo: 'Escolha sua nova senha',
        subtitulo: 'Mínimo de 8 caracteres.',
        textoSalvar: 'Salvar nova senha',
        semCancelar: true,
        campos: [
            { id: 'senha', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, largo: true },
            { id: 'confirmacao', rotulo: 'Repita a nova senha', tipo: 'password', obrigatorio: true, largo: true }
        ],
        aoSalvar: async ({ senha, confirmacao }) => {
            if (senha.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
            if (senha !== confirmacao) throw new Error('As duas senhas não são iguais.');
            const { error } = await supabaseClient.auth.updateUser({ password: senha });
            if (error) throw error;
            history.replaceState(null, '', window.location.pathname);
            avisar('Senha alterada com sucesso.');
        }
    });
}

/* =========================================================
   04 · LOCAIS E SETORES
========================================================= */

async function carregarLocaisBanco() {
    try {
        const { data, error } = await supabaseClient
            .from('locais')
            .select('id, nome, ativo, ordem')
            .order('ordem', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data?.length) return;

        // Ativos primeiro (na ordem definida); os antigos/inativos no fim.
        LOCAIS_TODOS = [...data].sort((a, b) => Number(b.ativo !== false) - Number(a.ativo !== false));
        LOCAIS = data.filter(local => local.ativo !== false).map(local => ({ id: local.id, nome: local.nome }));
    } catch (erro) {
        console.warn('Tabela de locais indisponível; usando a lista reserva.', erro?.message || erro);
    }
}

function nomeLocal(localId) {
    const local = LOCAIS_TODOS.find(registro => String(registro.id) === String(localId));
    if (!local) return 'SEM LOCAL';
    return local.ativo === false ? `${local.nome} (inativo)` : local.nome;
}

function nomeSubsetor(subsetorId) {
    if (!subsetorId) return 'Sem setor definido';
    return subsetores.find(s => String(s.id) === String(subsetorId))?.nome || 'Sem setor definido';
}

/* "CASA 1 / Varanda" ou só "CASA 1" quando não há setor. */
function localCompleto(localId, subsetorId) {
    return subsetorId ? `${nomeLocal(localId)} / ${nomeSubsetor(subsetorId)}` : nomeLocal(localId);
}

const formatarLocalSubsetor = localCompleto;

/* Local / setor + o detalhe escrito à mão ("3º andar", "Casa 3"). */
function lugarCompleto(localId, subsetorId, ondeFica) {
    const base = localCompleto(localId, subsetorId);
    return ondeFica ? `${base} · ${ondeFica}` : base;
}

/* Onde a peça está agora / qual é o lugar fixo dela. */
function lugarDoItem(item) {
    return lugarCompleto(item?.local_id, item?.subsetor_id, item?.onde_fica);
}

function lugarFixoDoItem(item) {
    return lugarCompleto(item?.origem_local_id, item?.origem_subsetor_id, item?.origem_onde_fica);
}

function mesmoTexto(a, b) {
    return normalizarTexto(a) === normalizarTexto(b);
}

/* Sugestões para o campo "Onde fica": o que já foi usado no local + andares. */
const SUGESTOES_ONDE_FICA = ['Térreo', '1º andar', '2º andar', '3º andar', '4º andar', '5º andar', 'Subsolo', 'Mezanino'];

function sugestoesOndeFica(localId) {
    const usados = new Map();
    itens.forEach(item => {
        [[item.local_id, item.onde_fica], [item.origem_local_id, item.origem_onde_fica]].forEach(([local, texto]) => {
            if (!texto || (localId && String(local) !== String(localId))) return;
            usados.set(normalizarTexto(texto), texto);
        });
    });
    SUGESTOES_ONDE_FICA.forEach(texto => {
        if (!usados.has(normalizarTexto(texto))) usados.set(normalizarTexto(texto), texto);
    });
    return [...usados.values()];
}

function preencherSugestoesOndeFica(idLista, localId) {
    const lista = document.getElementById(idLista);
    if (!lista) return;
    lista.innerHTML = sugestoesOndeFica(localId).map(texto => `<option value="${escaparHTML(texto)}"></option>`).join('');
}

function setoresDoLocal(localId) {
    return subsetores
        .filter(s => String(s.local_id) === String(localId) && s.ativo !== false)
        .sort((a, b) => compararTexto(a.nome, b.nome));
}


/* ---------------- Setores ---------------- */

async function carregarSubsetores() {
    try {
        const { data, error } = await supabaseClient
            .from('subsetores')
            .select('*')
            .eq('ativo', true)
            .order('local_id', { ascending: true })
            .order('nome', { ascending: true });

        if (error) throw error;
        subsetores = Array.isArray(data) ? data : [];
    } catch (erro) {
        console.warn('Setores indisponíveis:', erro?.message || erro);
        subsetores = [];
    }

    popularSubsetoresMovimentacao();
    popularFiltroSubsetoresEstoque();
    popularFiltroSubsetoresDashboard();
    popularLocaisAdminSetor();
    renderizarSubsetoresAdmin();
    atualizarLinhasDistribuicao();
}

function popularSubsetoresMovimentacao() {
    const destino = valorCampo('destino');
    const select = document.getElementById('destinoSubsetor');
    if (!select) return;
    preencherSelect(select,
        destino ? setoresDoLocal(destino).map(s => ({ valor: s.id, texto: s.nome })) : [],
        'Sem setor');
}

function popularFiltroSubsetoresEstoque() {
    const lista = [...subsetores]
        .filter(s => s.ativo !== false)
        .sort((a, b) => compararTexto(nomeLocal(a.local_id), nomeLocal(b.local_id)) || compararTexto(a.nome, b.nome));
    preencherSelect(document.getElementById('filtroSubsetor'),
        lista.map(s => ({ valor: s.id, texto: `${nomeLocal(s.local_id)} / ${s.nome}` })), 'Todos os setores');
}

function popularFiltroSubsetoresDashboard() {
    const select = document.getElementById('filtroSubsetorDashboard');
    if (!select) return;
    const local = valorCampo('filtroLocalDashboard');
    const lista = subsetores
        .filter(s => s.ativo !== false && (!local || String(s.local_id) === local))
        .sort((a, b) => compararTexto(a.nome, b.nome));
    preencherSelect(select, lista.map(s => ({ valor: s.id, texto: s.nome })), 'Todos os setores');
}

function atualizarSubsetoresDashboardPorLocal() {
    popularFiltroSubsetoresDashboard();
    filtrarDashboard();
}


/* ---------------- Selects de locais ---------------- */

function carregarLocais() {
    const opcoes = LOCAIS.map(local => ({ valor: local.id, texto: local.nome }));
    preencherSelect(document.getElementById('destino'), opcoes, 'Selecione o Destino');
    carregarFiltroLocaisDashboard();
    definirTexto('totalLocais', LOCAIS.length);
}

function carregarFiltroLocaisDashboard() {
    const lista = [...LOCAIS].sort((a, b) => compararTexto(a.nome, b.nome));
    preencherSelect(document.getElementById('filtroLocalDashboard'),
        lista.map(local => ({ valor: local.id, texto: local.nome })), 'Todos os Locais');
}

/* Depois de criar/renomear/inativar um local: atualiza todas as telas. */
function atualizarLocaisNaTela() {
    carregarLocais();
    carregarSubsetores();
    popularFiltroLocalOndeEsta();
    renderizarLocaisAdmin();
}

/* =========================================================
   05 · PEÇAS (grupos por local) E DASHBOARD
========================================================= */

function quantidadeItem(item) {
    const quantidade = Number(item?.quantidade);
    return Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0;
}

function classeStatus(status) {
    return { 'Ativo': 'ativo', 'Em manutenção': 'manutencao', 'Baixado': 'baixado', 'Extraviado': 'extraviado' }[status] || '';
}

function temOrigem(item) {
    return item && item.origem_local_id !== undefined && item.origem_local_id !== null;
}

/* Está fora do local fixo (local ou setor diferente) e não foi baixado/extraviado. */
function estaForaDoLugar(item) {
    if (!temOrigem(item) || quantidadeItem(item) <= 0) return false;
    if (['Baixado', 'Extraviado'].includes(item.status)) return false;
    return String(item.local_id) !== String(item.origem_local_id) ||
           String(item.subsetor_id || '') !== String(item.origem_subsetor_id || '') ||
           !mesmoTexto(item.onde_fica, item.origem_onde_fica);
}

function retornoAtrasado(item) {
    return Boolean(item?.retorno_previsto) && item.retorno_previsto < hojeISO() && estaForaDoLugar(item);
}

function fotoDoItem(item) {
    if (item.foto_url) return item.foto_url;
    return produtos.find(produto => Number(produto.id) === Number(item.produto_id))?.foto_url || '';
}

function seloFora(item) {
    if (!estaForaDoLugar(item)) return '';
    const atrasado = retornoAtrasado(item);
    const prazo = item.retorno_previsto
        ? (atrasado ? ` · retorno atrasado (${dataCurta(item.retorno_previsto)})` : ` · volta até ${dataCurta(item.retorno_previsto)}`)
        : '';
    return `<span class="selo-fora ${atrasado ? 'atrasado' : ''}">
                <i class="fa-solid fa-arrow-right-arrow-left"></i>
                Fora do lugar · é de ${escaparHTML(lugarFixoDoItem(item))}${prazo}
            </span>`;
}


/* =========================================================
   CARREGAMENTO CENTRAL
   Uma única busca alimenta todas as telas que usam as peças.
========================================================= */

async function carregarItens() {
    try {
        itens = await buscarTodasLinhas(() =>
            supabaseClient.from('itens').select('*').gt('quantidade', 0).order('id', { ascending: false })
        );
        itensCarregados = true;
    } catch (erro) {
        console.error('ERRO AO CARREGAR ITENS:', erro);
        return;
    }

    renderizarTelasDePecas();
}

/* Telas que mostram as peças (e usam fotos/descrições do catálogo). */
function renderizarTelasDePecas() {
    renderizarItens();
    filtrarItens();
    carregarItensMovimentacao();
    popularFiltroLocalOndeEsta();
    renderizarOndeEsta();
    renderizarForaDoLugar();
    mostrarDistribuicaoAtual();
}

async function carregarDashboard() {
    try {
        await Promise.all([carregarItens(), carregarProdutos()]);
        renderizarTelasDePecas(); // de novo, agora com o catálogo carregado
        ultimaAtualizacao = Date.now();
        await atualizarResumoDashboard();
        gerarRelatorioLocais();
        carregarFiltroLocaisDashboard();
        filtrarDashboard();
    } catch (erro) {
        console.error('ERRO AO CARREGAR DASHBOARD:', erro);
    }
}

/* Números do topo do dashboard (calculados no banco). */
async function atualizarResumoDashboard() {
    const { data: resumo, error } = await supabaseClient.rpc('resumo_dashboard');

    if (error) {
        console.warn('resumo_dashboard indisponível, calculando no navegador:', error.message);
        resumoCalculadoNoNavegador();
    } else {
        definirTexto('totalItens', resumo.total_itens);
        definirTexto('totalMov', resumo.movimentacoes);
        definirTexto('totalBaixados', resumo.baixados);
        definirTexto('dashAtivo', resumo.ativos);
        definirTexto('dashManutencao', resumo.manutencao);
        definirTexto('dashBaixado', resumo.baixados);
        definirTexto('dashExtraviado', resumo.extraviados);
    }

    renderizarResumoExtra(error ? null : resumo);
    definirTexto('totalLocais', LOCAIS.length);
}

function resumoCalculadoNoNavegador() {
    const soma = status => itens.filter(i => !status || i.status === status).reduce((t, i) => t + quantidadeItem(i), 0);
    definirTexto('totalItens', soma());
    definirTexto('dashAtivo', soma('Ativo'));
    definirTexto('dashManutencao', soma('Em manutenção'));
    definirTexto('dashBaixado', soma('Baixado'));
    definirTexto('dashExtraviado', soma('Extraviado'));
}

function renderizarResumoExtra(resumo) {
    const area = document.getElementById('dashExtra');
    if (!area) return;

    const temDados = resumo && 'fora_do_lugar' in resumo;
    area.hidden = !temDados;
    if (!temDados) return;

    const fora = Number(resumo.fora_do_lugar) || 0;
    const atrasados = Number(resumo.retornos_atrasados) || 0;
    const valor = Number(resumo.valor_patrimonio) || 0;

    definirTexto('dashForaLugar', fora ? `${numero.format(fora)} peça(s)` : 'Tudo no lugar');
    definirTexto('dashAtrasados', atrasados ? `${numero.format(atrasados)} peça(s)` : 'Nenhum');
    definirTexto('dashValorPatrimonio', valor > 0 ? moeda.format(valor) : 'Não informado');

    document.getElementById('dashForaItem')?.classList.toggle('tem-alerta', fora > 0);
    document.getElementById('dashAtrasoItem')?.classList.toggle('tem-alerta', atrasados > 0);
}

/* Tabela "Quantidade por Item e Local". */
function gerarRelatorioLocais() {
    const tabela = document.getElementById('dashboardLocais');
    if (!tabela) return;

    const agrupado = {};
    itens.forEach(item => {
        const chave = `${item.tipo || item.nome || 'ITEM'}||${item.local_id}||${item.subsetor_id || ''}`;
        if (!agrupado[chave]) {
            agrupado[chave] = {
                item: item.tipo || item.nome || 'ITEM',
                local: nomeLocal(item.local_id),
                local_id: item.local_id,
                subsetor: nomeSubsetor(item.subsetor_id),
                subsetor_id: item.subsetor_id,
                quantidade: 0
            };
        }
        agrupado[chave].quantidade += quantidadeItem(item);
    });

    const registros = Object.values(agrupado).sort((a, b) => compararTexto(a.local, b.local) || compararTexto(a.item, b.item));

    if (!registros.length) {
        tabela.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhuma peça cadastrada.</td></tr>';
        return;
    }

    tabela.innerHTML = registros.map(r => `
        <tr>
            <td>${escaparHTML(r.item)}</td>
            <td data-local-id="${escaparHTML(r.local_id || '')}">${escaparHTML(r.local)}</td>
            <td data-subsetor-id="${escaparHTML(r.subsetor_id || '')}">${escaparHTML(r.subsetor)}</td>
            <td><strong>${r.quantidade}</strong></td>
        </tr>`).join('');
}

function filtrarDashboard() {
    const busca = valorCampo('filtroDashboard').toLowerCase();
    const filtroLocal = valorCampo('filtroLocalDashboard');
    const filtroSubsetor = valorCampo('filtroSubsetorDashboard');

    document.querySelectorAll('#dashboardLocais tr').forEach(linha => {
        if (linha.children.length < 4) return;
        const mostrar =
            (!busca || linha.textContent.toLowerCase().includes(busca)) &&
            (!filtroLocal || linha.children[1].dataset.localId === filtroLocal) &&
            (!filtroSubsetor || linha.children[2].dataset.subsetorId === filtroSubsetor);
        linha.style.display = mostrar ? '' : 'none';
    });
}

/* =========================================================
   06 · CATÁLOGO DE PEÇAS
========================================================= */

async function carregarProdutos() {
    try {
        produtos = await buscarTodasLinhas(() =>
            supabaseClient
                .from('vw_produtos_saldo')
                .select('*')
                .order('nome', { ascending: true })
        );
    } catch (erro) {
        console.warn('Catálogo de produtos indisponível:', erro?.message || erro);
        produtos = [];
    }

    popularListasCatalogo();
    popularFiltroCategoriasProduto();
    renderizarProdutos();
    atualizarDicaProduto();
}

function categoriasExistentes() {
    const mapa = new Map();
    produtos.forEach(produto => {
        const categoria = String(produto.categoria || '').trim();
        if (categoria) mapa.set(normalizarTexto(categoria), categoria);
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function popularListasCatalogo() {
    const garantirLista = id => {
        let lista = document.getElementById(id);
        if (!lista) {
            lista = Object.assign(document.createElement('datalist'), { id });
            document.body.appendChild(lista);
        }
        return lista;
    };

    garantirLista('dlProdutos').innerHTML = produtos
        .filter(produto => produto.ativo !== false)
        .map(produto => `<option value="${escaparHTML(produto.nome)}">${escaparHTML(produto.categoria || '')}</option>`)
        .join('');

    garantirLista('dlCategorias').innerHTML = categoriasExistentes()
        .map(categoria => `<option value="${escaparHTML(categoria)}"></option>`)
        .join('');
}

function popularFiltroCategoriasProduto() {
    const select = document.getElementById('filtroCategoriaProduto');
    if (!select) return;
    const atual = select.value;
    select.innerHTML = '<option value="">Todas as categorias</option>' +
        categoriasExistentes().map(categoria =>
            `<option value="${escaparHTML(categoria)}">${escaparHTML(categoria)}</option>`).join('');
    if ([...select.options].some(opcao => opcao.value === atual)) select.value = atual;
}

function produtoPorNome(nome) {
    const chave = chaveNome(nome);
    return chave ? produtos.find(produto => chaveNome(produto.nome) === chave) : null;
}

function situacaoProduto(produto) {
    return produto.ativo === false
        ? { classe: 'inativo', texto: 'Inativa' }
        : { classe: 'ativo', texto: 'Ativa' };
}

function renderizarProdutos() {
    const tbody = document.getElementById('listaProdutos');
    if (!tbody) return;

    const busca = normalizarTexto(document.getElementById('buscaProduto')?.value);
    const categoria = document.getElementById('filtroCategoriaProduto')?.value || '';
    const mostrarInativos = document.getElementById('filtroProdutosInativos')?.checked;
    const gestao = podeAdministrar();

    const lista = produtos.filter(produto =>
        (mostrarInativos || produto.ativo !== false) &&
        (!categoria || normalizarTexto(produto.categoria) === normalizarTexto(categoria)) &&
        (!busca || normalizarTexto(`${produto.nome} ${produto.categoria} ${produto.descricao}`).includes(busca))
    );

    definirTexto('produtosTotal', numero.format(lista.length));

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
            <i class="fa-solid fa-couch"></i>
            ${produtos.length ? 'Nenhuma peça encontrada com esses filtros.' : 'Nenhuma peça no catálogo.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(produto => {
        const situacao = situacaoProduto(produto);
        const total = Number(produto.saldo_total) || 0;
        const manutencao = Number(produto.saldo_manutencao) || 0;
        const valor = Number(produto.custo_unitario) || 0;
        const foto = produto.foto_url
            ? imgMiniatura(produto.foto_url)
            : '<div class="sem-foto"><i class="fa-solid fa-image"></i></div>';

        return `
            <tr class="${produto.ativo === false ? 'linha-inativa' : ''}">
                <td>${foto}</td>
                <td>
                    <strong>${escaparHTML(produto.nome)}</strong>
                    ${produto.descricao ? `<small class="celula-sub">${escaparHTML(produto.descricao)}</small>` : ''}
                </td>
                <td>${escaparHTML(produto.categoria || '—')}</td>
                <td class="num">
                    <strong>${numero.format(total)}</strong>
                    ${manutencao ? `<small class="celula-sub">${numero.format(manutencao)} em manutenção</small>` : ''}
                </td>
                <td class="num">${numero.format(Number(produto.locais) || 0)}</td>
                <td class="num">${valor ? moeda.format(valor) : '—'}</td>
                <td><span class="status-badge ${situacao.classe}">${situacao.texto}</span></td>
                <td>
                    <div class="acoes-tabela">
                        <button type="button" class="btn-icon" title="Onde está" onclick="verProdutoNoEstoque(${Number(produto.id)})">
                            <i class="fa-solid fa-location-dot"></i>
                        </button>
                        ${gestao ? `<button type="button" class="btn-icon" title="Editar peça" onclick="abrirProduto(${Number(produto.id)})">
                            <i class="fa-solid fa-pen"></i></button>` : ''}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function camposProduto(produto = {}) {
    const campos = [
        { id: 'nome', rotulo: 'Nome da peça', valor: produto.nome, obrigatorio: true, placeholder: 'Ex.: Mesa de jantar oval' },
        { id: 'categoria', rotulo: 'Categoria', valor: produto.categoria, lista: 'dlCategorias', placeholder: 'Ex.: Mesas, Quadros, Vasos',
          ajuda: 'Escolha uma existente para manter o padrão.' },
        { id: 'descricao', rotulo: 'Descrição', tipo: 'textarea', valor: produto.descricao, largo: true,
          placeholder: 'Cor, material, medidas, detalhes que ajudam a reconhecer a peça...' },
        { id: 'custo_unitario', rotulo: 'Valor de referência por peça (R$) — opcional', tipo: 'number', min: 0, step: '0.01',
          valor: produto.custo_unitario || '', placeholder: '0,00', ajuda: 'Para seguro e controle patrimonial.', largo: true },
        { id: 'foto', rotulo: 'Foto', tipo: 'file', valor: produto.foto_url, largo: true }
    ];
    if (produto.id) campos.push({ id: 'ativo', rotulo: 'Peça ativa (aparece nas sugestões do cadastro)', tipo: 'checkbox', valor: produto.ativo !== false, largo: true });
    return campos;
}

async function salvarProduto(id, valores) {
    let foto = null;

    try {
        if (valores.foto) foto = await enviarFoto(valores.foto, 'produtos');

        const dados = {
            nome: valores.nome,
            categoria: valores.categoria || null,
            custo_unitario: Math.max(0, Number(valores.custo_unitario) || 0),
            descricao: valores.descricao || null
        };
        if (foto) dados.foto_url = foto.url;
        if (id) dados.ativo = valores.ativo !== false;

        const consulta = id
            ? supabaseClient.from('produtos').update(dados).eq('id', id).select('id')
            : supabaseClient.from('produtos').insert([dados]).select('id');

        const { data, error } = await consulta;
        if (error) throw error;
        if (!data?.length) throw new Error('Seu perfil não tem permissão para esta operação.');
    } catch (erro) {
        if (foto) await supabaseClient.storage.from('inventario').remove([foto.caminho]);
        throw erro;
    }

    await carregarDashboard();
}

function novoProduto(nomeSugerido = '') {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador cria peças no catálogo.', 'erro');

    abrirFormulario({
        titulo: 'Nova peça no catálogo',
        subtitulo: 'Depois, use "Cadastrar peças" para informar quantidade, local e setor.',
        textoSalvar: 'Criar peça',
        campos: camposProduto({ nome: nomeSugerido }),
        aoSalvar: async valores => {
            await salvarProduto(null, valores);
            avisar(`Peça "${valores.nome}" criada no catálogo.`);
        }
    });
}

function abrirProduto(id) {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador edita o catálogo.', 'erro');
    const produto = produtos.find(registro => Number(registro.id) === Number(id));
    if (!produto) return avisar('Peça não encontrada. Atualize a página.', 'erro');

    const total = Number(produto.saldo_total) || 0;
    abrirFormulario({
        titulo: 'Editar peça',
        subtitulo: total
            ? `${numero.format(total)} peça(s) em ${produto.locais || 0} local(is). A alteração vale para todas.`
            : 'Nenhuma unidade cadastrada no momento.',
        campos: camposProduto(produto),
        aoSalvar: async valores => {
            await salvarProduto(id, valores);
            avisar('Peça atualizada.');
        }
    });
}

function verProdutoNoEstoque(id) {
    const produto = produtos.find(registro => Number(registro.id) === Number(id));
    if (!produto) return;
    abrirOndeEsta(produto.nome);
}

/* O botão de editar da tabela de Estoque agora edita o produto. */
function editarItem(id) {
    const item = itens.find(registro => Number(registro.id) === Number(id));
    if (!item) return avisar('Item não encontrado.', 'erro');
    if (!podeAdministrar()) {
        return avisar('Nome, categoria, descrição e foto ficam no Catálogo, editado por Gestor ou Administrador.', 'info');
    }
    if (!item.produto_id) return avisar('Execute a migração v4 para editar pelo catálogo.', 'erro');
    abrirProduto(item.produto_id);
}

/* =========================================================
   07 · ONDE ESTÁ? E FORA DO LUGAR
========================================================= */


/* ---------------- Onde está? ---------------- */

const LIMITE_GRUPOS_ONDE_ESTA = 40;
let temporizadorOndeEsta = null;

function abrirOndeEsta(texto) {
    abrirTela('ondeEstaTela', document.getElementById('menuOndeEsta'));
    const campo = document.getElementById('buscaOndeEsta');
    if (campo && texto !== undefined) campo.value = texto;
    renderizarOndeEsta();
    setTimeout(() => campo?.focus(), 50);
}

function popularFiltroLocalOndeEsta() {
    const select = document.getElementById('filtroLocalOndeEsta');
    if (!select) return;
    const atual = select.value;
    select.innerHTML = '<option value="">Todos os locais</option>' +
        LOCAIS.map(local => `<option value="${local.id}">${escaparHTML(local.nome)}</option>`).join('');
    if ([...select.options].some(opcao => opcao.value === atual)) select.value = atual;
}

function agruparPorPeca(lista) {
    const grupos = new Map();
    lista.forEach(item => {
        const chave = item.produto_id ? `p${item.produto_id}` : `n${chaveNome(item.nome)}`;
        if (!grupos.has(chave)) {
            const produto = produtos.find(registro => Number(registro.id) === Number(item.produto_id));
            grupos.set(chave, {
                nome: produto?.nome || item.nome,
                categoria: produto?.categoria || (item.tipo !== item.nome ? item.tipo : ''),
                descricao: produto?.descricao || item.descricao || '',
                foto: produto?.foto_url || item.foto_url || '',
                itens: []
            });
        }
        const grupo = grupos.get(chave);
        grupo.itens.push(item);
        if (!grupo.foto && item.foto_url) grupo.foto = item.foto_url;
    });
    return [...grupos.values()];
}

function renderizarOndeEsta() {
    const area = document.getElementById('resultadosOndeEsta');
    if (!area) return;

    const busca = normalizarTexto(document.getElementById('buscaOndeEsta')?.value);
    const localFiltro = document.getElementById('filtroLocalOndeEsta')?.value || '';
    const somenteFora = document.getElementById('filtroSomenteFora')?.checked;

    const lista = itens.filter(item => {
        if (quantidadeItem(item) <= 0) return false;
        if (localFiltro && String(item.local_id) !== localFiltro && String(item.origem_local_id) !== localFiltro) return false;
        if (somenteFora && !estaForaDoLugar(item)) return false;
        if (!busca) return true;
        const texto = normalizarTexto([
            item.nome, item.tipo, item.descricao,
            lugarDoItem(item),
            temOrigem(item) ? lugarFixoDoItem(item) : ''
        ].join(' '));
        return busca.split(' ').every(parte => texto.includes(parte));
    });

    const grupos = agruparPorPeca(lista)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    const totalPecas = lista.reduce((total, item) => total + quantidadeItem(item), 0);
    definirTexto('contadorOndeEsta', grupos.length
        ? `${numero.format(grupos.length)} tipo(s) de peça · ${numero.format(totalPecas)} peça(s)`
        : '');

    if (!grupos.length) {
        area.innerHTML = `
            <div class="onde-vazio">
                <i class="fa-solid fa-magnifying-glass-location"></i>
                <strong>${itens.length ? 'Nada encontrado' : itensCarregados ? 'Nenhuma peça cadastrada ainda' : 'Carregando inventário...'}</strong>
                <span>${itens.length
                    ? 'Tente outro nome, uma categoria (ex.: "vaso", "quadro") ou o nome de um local.'
                    : itensCarregados && podeMovimentar() ? 'Use "Cadastrar peças" para registrar a primeira.' : ''}</span>
            </div>`;
        return;
    }

    const mostrar = grupos.slice(0, LIMITE_GRUPOS_ONDE_ESTA);
    const movimentar = podeMovimentar();

    area.innerHTML = mostrar.map(grupo => {
        const total = grupo.itens.reduce((soma, item) => soma + quantidadeItem(item), 0);
        const fora = grupo.itens.filter(estaForaDoLugar).reduce((soma, item) => soma + quantidadeItem(item), 0);

        const linhas = grupo.itens
            .sort((a, b) => Number(estaForaDoLugar(b)) - Number(estaForaDoLugar(a)) ||
                            nomeLocal(a.local_id).localeCompare(nomeLocal(b.local_id), 'pt-BR'))
            .map(item => `
                <li class="${estaForaDoLugar(item) ? 'fora' : ''}">
                    <div class="onde-local">
                        <i class="fa-solid fa-location-dot"></i>
                        <div>
                            <strong>${escaparHTML(lugarDoItem(item))}</strong>
                            ${item.status !== 'Ativo' ? `<span class="status-badge ${classeStatus(item.status)}">${escaparHTML(item.status)}</span>` : ''}
                            ${seloFora(item)}
                        </div>
                    </div>
                    <div class="onde-qtd">${numero.format(quantidadeItem(item))}</div>
                    ${movimentar ? `
                    <div class="onde-acoes">
                        ${estaForaDoLugar(item) ? `<button type="button" class="btn-icon btn-devolver" title="Devolver ao local de origem"
                            onclick="devolverPeca(${Number(item.id)})"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
                        <button type="button" class="btn-icon" title="Movimentar" onclick="movimentarPeca(${Number(item.id)})">
                            <i class="fa-solid fa-right-left"></i></button>
                    </div>` : ''}
                </li>`).join('');

        const foto = grupo.foto
            ? imgMiniatura(grupo.foto, { classe: '' })
            : '<div class="onde-sem-foto"><i class="fa-solid fa-couch"></i></div>';

        return `
            <article class="onde-card">
                <div class="onde-foto">${foto}</div>
                <div class="onde-corpo">
                    <header>
                        <div>
                            <h3>${escaparHTML(grupo.nome)}</h3>
                            <p>${[grupo.categoria, grupo.descricao].filter(Boolean).map(escaparHTML).join(' · ') || '&nbsp;'}</p>
                        </div>
                        <div class="onde-total">
                            <strong>${numero.format(total)}</strong>
                            <span>peça(s)${fora ? ` · <b>${numero.format(fora)} fora</b>` : ''}</span>
                        </div>
                    </header>
                    <ul class="onde-lista">${linhas}</ul>
                </div>
            </article>`;
    }).join('') + (grupos.length > LIMITE_GRUPOS_ONDE_ESTA
        ? `<p class="onde-mais">Mostrando ${LIMITE_GRUPOS_ONDE_ESTA} de ${numero.format(grupos.length)}. Digite mais detalhes para refinar.</p>`
        : '');
}


/* =========================================================
   TELA "FORA DO LUGAR"
========================================================= */

function abrirForaDoLugar(somenteAtrasados = false) {
    abrirTela('foraLugarTela', document.getElementById('menuForaLugar'));
    const filtro = document.getElementById('filtroAtrasados');
    if (filtro) filtro.checked = Boolean(somenteAtrasados);
    renderizarForaDoLugar();
}

function popularFiltroOrigemFora() {
    const select = document.getElementById('filtroOrigemFora');
    if (!select) return;
    const atual = select.value;
    const origens = [...new Set(itens.filter(estaForaDoLugar).map(item => String(item.origem_local_id)))];
    select.innerHTML = '<option value="">Todas as origens</option>' + origens
        .sort((a, b) => nomeLocal(a).localeCompare(nomeLocal(b), 'pt-BR'))
        .map(id => `<option value="${id}">É de ${escaparHTML(nomeLocal(id))}</option>`).join('');
    if ([...select.options].some(opcao => opcao.value === atual)) select.value = atual;
}

function atualizarContadorFora() {
    const fora = itens.filter(estaForaDoLugar);
    const pecas = fora.reduce((total, item) => total + quantidadeItem(item), 0);
    const atrasadas = fora.filter(retornoAtrasado).length;

    const selo = document.getElementById('badgeForaLugar');
    if (selo) {
        selo.textContent = pecas > 99 ? '99+' : String(pecas);
        selo.hidden = pecas === 0;
        selo.classList.toggle('atrasado', atrasadas > 0);
    }
}

function renderizarForaDoLugar() {
    const tbody = document.getElementById('listaForaLugar');
    atualizarContadorFora();
    popularFiltroOrigemFora();
    if (!tbody) return;

    const busca = normalizarTexto(document.getElementById('buscaForaLugar')?.value);
    const origem = document.getElementById('filtroOrigemFora')?.value || '';
    const somenteAtrasados = document.getElementById('filtroAtrasados')?.checked;
    const movimentar = podeMovimentar();

    const lista = itens.filter(item =>
        estaForaDoLugar(item) &&
        (!origem || String(item.origem_local_id) === origem) &&
        (!somenteAtrasados || retornoAtrasado(item)) &&
        (!busca || normalizarTexto(`${item.nome} ${item.tipo} ${lugarDoItem(item)} ${lugarFixoDoItem(item)}`).includes(busca))
    ).sort((a, b) =>
        Number(retornoAtrasado(b)) - Number(retornoAtrasado(a)) ||
        String(a.fora_desde || '').localeCompare(String(b.fora_desde || ''))
    );

    const pecas = lista.reduce((total, item) => total + quantidadeItem(item), 0);
    definirTexto('totalForaLugar', numero.format(pecas));

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
            <i class="fa-solid fa-circle-check"></i>
            ${itens.some(estaForaDoLugar) ? 'Nada encontrado com esses filtros.' : 'Tudo no lugar! Nenhuma peça fora do local de origem.'}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const atrasado = retornoAtrasado(item);
        const dias = diasDesde(item.fora_desde);
        const foto = fotoDoItem(item);

        return `
            <tr class="${atrasado ? 'linha-atrasada' : ''}">
                <td>${foto
                    ? imgMiniatura(foto)
                    : '<div class="sem-foto"><i class="fa-solid fa-image"></i></div>'}</td>
                <td><strong>${escaparHTML(item.nome)}</strong>
                    ${item.status !== 'Ativo' ? `<small class="celula-sub">${escaparHTML(item.status)}</small>` : ''}</td>
                <td class="num"><strong>${numero.format(quantidadeItem(item))}</strong></td>
                <td>${escaparHTML(lugarDoItem(item))}</td>
                <td><span class="destino-origem"><i class="fa-solid fa-house"></i>
                    ${escaparHTML(lugarFixoDoItem(item))}</span></td>
                <td>${item.fora_desde
                    ? `${dataCurta(item.fora_desde)}<small class="celula-sub">${dias === 0 ? 'hoje' : `há ${dias} dia(s)`}</small>`
                    : '—'}</td>
                <td>${item.retorno_previsto
                    ? `<span class="status-badge ${atrasado ? 'baixado' : 'neutro'}">${atrasado ? 'Atrasado · ' : ''}${dataCurta(item.retorno_previsto)}</span>`
                    : '<span class="texto-suave">Sem prazo</span>'}</td>
                <td>${movimentar ? `
                    <div class="acoes-tabela">
                        <button type="button" class="btn-primary btn-small" onclick="devolverPeca(${Number(item.id)})">
                            <i class="fa-solid fa-rotate-left"></i> Devolver
                        </button>
                        <button type="button" class="btn-icon" title="Movimentar para outro lugar" onclick="movimentarPeca(${Number(item.id)})">
                            <i class="fa-solid fa-right-left"></i>
                        </button>
                    </div>` : ''}</td>
            </tr>`;
    }).join('');
}


/* =========================================================
   AÇÕES: DEVOLVER E MOVIMENTAR
========================================================= */

function devolverPeca(id) {
    if (!podeMovimentar()) return avisar('Seu perfil não pode movimentar peças.', 'erro');
    const item = itens.find(registro => Number(registro.id) === Number(id));
    if (!item) return avisar('Peça não encontrada. Atualize a página.', 'erro');

    const quantidade = quantidadeItem(item);

    abrirFormulario({
        titulo: `Devolver ${item.nome}`,
        subtitulo: `De ${lugarDoItem(item)} para ${lugarFixoDoItem(item)}`,
        textoSalvar: 'Confirmar devolução',
        campos: [
            { id: 'quantidade', rotulo: 'Quantidade que voltou', tipo: 'number', min: 1, step: '1', valor: quantidade,
              obrigatorio: true, ajuda: `Há ${quantidade} peça(s) fora. Informe menos se só uma parte voltou.` },
            { id: 'observacao', rotulo: 'Observação', tipo: 'textarea', largo: true, placeholder: 'Ex.: voltou do evento de sábado' }
        ],
        aoSalvar: async ({ quantidade: qtd, observacao }) => {
            if (!(qtd >= 1) || qtd > quantidade) throw new Error(`Informe uma quantidade entre 1 e ${quantidade}.`);
            const { error } = await supabaseClient.rpc('devolver_item', {
                p_item_id: Number(item.id),
                p_quantidade: Math.round(qtd),
                p_observacao: observacao || null
            });
            if (error) throw error;
            await carregarDashboard();
            await carregarHistorico();
            avisar(`${qtd} peça(s) devolvida(s) a ${nomeLocal(item.origem_local_id)}.`);
        }
    });
}

function movimentarPeca(id) {
    if (!podeMovimentar()) return avisar('Seu perfil não pode movimentar peças.', 'erro');
    abrirTela('movimentacaoTela', document.getElementById('menuMovimentacao'));
    limparFormularioMovimentacao();
    escolherPecaMov(id);
}

/* =========================================================
   08 · CADASTRO DE PEÇAS COM DISTRIBUIÇÃO POR LOCAL / SETOR

   Ex.: Cadeira Dealer Marrom — 100
        MONTE CARLO / Quarto Andar ...... 25
        MIRAGE / Vip .................... 10
========================================================= */

/* Dica do catálogo ao digitar o nome. */
function atualizarDicaProduto() {
    const campoNome = document.getElementById('nome');
    const campoCategoria = document.getElementById('tipoItem');
    const dica = document.getElementById('dicaProdutoCadastro');
    if (!campoNome || !dica) return;

    const nome = campoNome.value.trim();
    const produto = produtoPorNome(nome);

    if (!nome) {
        dica.className = 'mc-dica';
        dica.innerHTML = produtos.length
            ? `<i class="fa-solid fa-magnifying-glass"></i> Digite para buscar entre ${numero.format(produtos.length)} peças do catálogo.`
            : '';
        if (campoCategoria) campoCategoria.readOnly = false;
        mostrarDistribuicaoAtual();
        return;
    }

    if (produto) {
        if (campoCategoria) {
            campoCategoria.value = produto.categoria || '';
            campoCategoria.readOnly = true;
        }
        const total = Number(produto.saldo_total) || 0;
        dica.className = 'mc-dica mc-dica-ok';
        dica.innerHTML = `<i class="fa-solid fa-circle-check"></i> Peça já existe no catálogo ·
            <strong>${numero.format(total)}</strong> cadastrada(s) em ${numero.format(Number(produto.locais) || 0)} local(is).
            A quantidade será somada no local escolhido.`;
    } else {
        if (campoCategoria) campoCategoria.readOnly = false;
        dica.className = 'mc-dica mc-dica-novo';
        dica.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Peça nova — será criada no catálogo ao salvar.
            Confira nas sugestões se ela não existe com outro nome.`;
    }

    mostrarDistribuicaoAtual();
}

const NOVO_SETOR = '__novo__';
let contadorLinhasDistribuicao = 0;


/* =========================================================
   LINHAS
========================================================= */

function opcoesLocaisDistribuicao(selecionado = '') {
    return '<option value="">Selecione o local</option>' + LOCAIS
        .map(local => `<option value="${local.id}" ${String(local.id) === String(selecionado) ? 'selected' : ''}>${escaparHTML(local.nome)}</option>`)
        .join('');
}

function opcoesSetoresDistribuicao(localId, selecionado = '') {
    if (!localId) return '<option value="">Escolha o local primeiro</option>';

    const setores = subsetores
        .filter(setor => String(setor.local_id) === String(localId) && setor.ativo !== false)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { sensitivity: 'base' }));

    return '<option value="">Sem setor</option>' +
        setores.map(setor =>
            `<option value="${setor.id}" ${String(setor.id) === String(selecionado) ? 'selected' : ''}>${escaparHTML(setor.nome)}</option>`
        ).join('') +
        (podeAdministrar() ? `<option value="${NOVO_SETOR}">＋ Criar setor neste local…</option>` : '');
}

function adicionarLinhaDistribuicao(dados = {}) {
    const area = document.getElementById('linhasDistribuicao');
    if (!area) return;

    const id = ++contadorLinhasDistribuicao;
    const linha = document.createElement('div');
    linha.className = 'dist-linha';
    linha.dataset.linha = id;
    linha.innerHTML = `
        <select class="dist-local" aria-label="Local">${opcoesLocaisDistribuicao(dados.local_id)}</select>
        <select class="dist-setor" aria-label="Setor">${opcoesSetoresDistribuicao(dados.local_id, dados.subsetor_id)}</select>
        <input class="dist-onde" type="text" maxlength="80" list="sugestoesOndeFicaCad" autocomplete="off"
               placeholder="Onde fica (opcional)" aria-label="Onde fica" value="${escaparHTML(dados.onde_fica || '')}">
        <input class="dist-qtd" type="number" min="1" step="1" inputmode="numeric" placeholder="Qtde" aria-label="Quantidade"
               value="${dados.quantidade ? Number(dados.quantidade) : ''}">
        <button type="button" class="btn-icon btn-excluir dist-remover" title="Remover linha" aria-label="Remover linha">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    area.appendChild(linha);

    const local = linha.querySelector('.dist-local');
    const setor = linha.querySelector('.dist-setor');

    local.addEventListener('change', () => {
        setor.innerHTML = opcoesSetoresDistribuicao(local.value);
        recalcularDistribuicao();
    });
    setor.addEventListener('change', () => {
        if (setor.value === NOVO_SETOR) criarSetorNaLinha(linha);
        else recalcularDistribuicao();
    });
    linha.querySelector('.dist-qtd').addEventListener('input', recalcularDistribuicao);
    const onde = linha.querySelector('.dist-onde');
    onde.addEventListener('input', recalcularDistribuicao);
    onde.addEventListener('focus', () => preencherSugestoesOndeFica('sugestoesOndeFicaCad', local.value));
    linha.querySelector('.dist-remover').addEventListener('click', () => {
        linha.remove();
        if (!area.children.length) adicionarLinhaDistribuicao();
        recalcularDistribuicao();
    });

    recalcularDistribuicao();
    if (!dados.local_id) local.focus({ preventScroll: true });
}

function lerDistribuicao() {
    return [...document.querySelectorAll('#linhasDistribuicao .dist-linha')].map(linha => ({
        elemento: linha,
        local_id: linha.querySelector('.dist-local').value,
        subsetor_id: linha.querySelector('.dist-setor').value === NOVO_SETOR ? '' : linha.querySelector('.dist-setor').value,
        onde_fica: (linha.querySelector('.dist-onde')?.value || '').trim().replace(/\s+/g, ' '),
        quantidade: parseInt(linha.querySelector('.dist-qtd').value || '0', 10)
    }));
}

function recalcularDistribuicao() {
    const linhas = lerDistribuicao();
    const total = linhas.reduce((soma, linha) => soma + (linha.quantidade > 0 ? linha.quantidade : 0), 0);
    const esperado = parseInt(document.getElementById('totalEsperado')?.value || '0', 10);
    const status = document.getElementById('statusDistribuicao');

    definirTexto('totalDistribuido', numero.format(total));

    // Marca linhas repetidas (mesmo local + setor + onde fica).
    const vistos = new Map();
    linhas.forEach(linha => {
        linha.elemento.classList.remove('repetida');
        if (!linha.local_id) return;
        const chave = `${linha.local_id}|${linha.subsetor_id}|${normalizarTexto(linha.onde_fica)}`;
        if (vistos.has(chave)) {
            linha.elemento.classList.add('repetida');
            vistos.get(chave).classList.add('repetida');
        } else {
            vistos.set(chave, linha.elemento);
        }
    });

    if (!status) return;
    status.className = 'dist-status';

    if (!esperado) {
        status.textContent = linhas.filter(l => l.local_id && l.quantidade > 0).length > 1
            ? `em ${linhas.filter(l => l.local_id && l.quantidade > 0).length} locais/setores` : '';
        return;
    }
    if (total === esperado) {
        status.classList.add('ok');
        status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Fecha com o total';
    } else if (total < esperado) {
        status.classList.add('falta');
        status.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Faltam ${numero.format(esperado - total)} para distribuir`;
    } else {
        status.classList.add('sobra');
        status.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Passou ${numero.format(total - esperado)} do total`;
    }
}

function limparDistribuicao() {
    const area = document.getElementById('linhasDistribuicao');
    if (area) area.innerHTML = '';
    const esperado = document.getElementById('totalEsperado');
    if (esperado) esperado.value = '';
    adicionarLinhaDistribuicao();
    mostrarDistribuicaoAtual();
}

function criarSetorNaLinha(linha) {
    const local = linha.querySelector('.dist-local');
    const setor = linha.querySelector('.dist-setor');
    setor.value = '';

    if (!local.value) return avisar('Escolha o local antes de criar o setor.', 'info');

    abrirFormulario({
        titulo: 'Novo setor',
        subtitulo: `No local ${nomeLocal(local.value)}`,
        textoSalvar: 'Criar setor',
        campos: [{ id: 'nome', rotulo: 'Nome do setor', obrigatorio: true, placeholder: 'Ex.: Quarto Andar, Vip, Estoque', largo: true }],
        aoSalvar: async ({ nome }) => {
            const existente = subsetores.find(s =>
                String(s.local_id) === String(local.value) && normalizarTexto(s.nome) === normalizarTexto(nome));
            if (existente) {
                setor.innerHTML = opcoesSetoresDistribuicao(local.value, existente.id);
                recalcularDistribuicao();
                avisar(`O setor "${existente.nome}" já existia e foi selecionado.`, 'info');
                return;
            }

            const { data, error } = await supabaseClient
                .from('subsetores')
                .insert([{ local_id: Number(local.value), nome, ativo: true, created_by: usuarioLogado?.id }])
                .select('id');
            if (error) throw error;

            await carregarSubsetores();
            const novoId = data?.[0]?.id || subsetores.find(s =>
                String(s.local_id) === String(local.value) && normalizarTexto(s.nome) === normalizarTexto(nome))?.id;

            document.querySelectorAll('#linhasDistribuicao .dist-linha').forEach(outra => {
                const outroLocal = outra.querySelector('.dist-local').value;
                const outroSetor = outra.querySelector('.dist-setor');
                if (outroLocal === local.value) {
                    outroSetor.innerHTML = opcoesSetoresDistribuicao(outroLocal, outra === linha ? novoId : outroSetor.value);
                }
            });
            recalcularDistribuicao();
            avisar(`Setor "${nome}" criado em ${nomeLocal(local.value)}.`);
        }
    });
}


/* =========================================================
   PEÇA JÁ EXISTENTE: mostra onde ela está hoje
========================================================= */

function mostrarDistribuicaoAtual() {
    const caixa = document.getElementById('distribuicaoAtual');
    if (!caixa) return;

    const produto = produtoPorNome(document.getElementById('nome')?.value);
    const grupos = produto
        ? itens.filter(item => Number(item.produto_id) === Number(produto.id) && quantidadeItem(item) > 0)
        : [];

    if (!grupos.length) {
        caixa.hidden = true;
        caixa.innerHTML = '';
        return;
    }

    const total = grupos.reduce((soma, item) => soma + quantidadeItem(item), 0);
    caixa.hidden = false;
    caixa.innerHTML = `
        <div class="dist-atual-topo">
            <i class="fa-solid fa-circle-info"></i>
            <div>
                <strong>"${escaparHTML(produto.nome)}" já tem ${numero.format(total)} peça(s) cadastrada(s).</strong>
                <span>As quantidades abaixo serão <b>somadas</b> a estas. Para corrigir uma contagem, use Movimentações.</span>
            </div>
        </div>
        <ul>${grupos
            .sort((a, b) => quantidadeItem(b) - quantidadeItem(a))
            .map(item => `<li><span>${escaparHTML(lugarDoItem(item))}
                ${estaForaDoLugar(item) ? '<em>fora do lugar</em>' : ''}</span>
                <strong>${numero.format(quantidadeItem(item))}</strong></li>`).join('')}</ul>`;
}


/* =========================================================
   SALVAR
========================================================= */

async function salvarItem(event) {
    event?.preventDefault();
    event?.stopPropagation();

    if (!usuarioLogado) return avisar('Faça login primeiro.', 'erro'), false;
    if (perfilUsuario === 'consulta') return avisar('Seu perfil não pode cadastrar peças.', 'erro'), false;

    const valor = id => document.getElementById(id)?.value?.trim() || '';
    const nome = valor('nome');

    if (!nome) {
        document.getElementById('nome')?.focus();
        return avisar('Informe o nome da peça.', 'erro'), false;
    }

    const linhas = lerDistribuicao().filter(linha => linha.local_id || linha.quantidade);

    if (!linhas.length) return avisar('Informe pelo menos um local com quantidade.', 'erro'), false;

    const semLocal = linhas.find(linha => !linha.local_id);
    if (semLocal) {
        semLocal.elemento.querySelector('.dist-local').focus();
        return avisar('Há uma linha com quantidade mas sem local.', 'erro'), false;
    }

    const semQuantidade = linhas.find(linha => !(linha.quantidade >= 1));
    if (semQuantidade) {
        semQuantidade.elemento.querySelector('.dist-qtd').focus();
        return avisar(`Informe a quantidade em ${nomeLocal(semQuantidade.local_id)}.`, 'erro'), false;
    }

    if (document.querySelector('#linhasDistribuicao .dist-linha.repetida')) {
        return avisar('Há local/setor repetido. Junte as quantidades numa linha só.', 'erro'), false;
    }

    const total = linhas.reduce((soma, linha) => soma + linha.quantidade, 0);
    const esperado = parseInt(valor('totalEsperado') || '0', 10);
    if (esperado && esperado !== total && !(await confirmar({
        titulo: 'As quantidades não fecham',
        mensagem: `Você informou ${esperado} peças no total, mas a distribuição pelos locais soma ${total}.\n\nSalvar mesmo assim com ${total} peça(s)?`,
        textoConfirmar: `Salvar com ${total}`,
        textoCancelar: 'Corrigir'
    }))) {
        return false;
    }

    const botao = document.getElementById('btnSalvarItem');
    const textoBotao = botao?.innerHTML;
    if (botao) {
        botao.disabled = true;
        botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    }

    let foto = null;

    try {
        const arquivo = document.getElementById('foto')?.files?.[0];
        if (arquivo) foto = await enviarFoto(arquivo, 'inventario');

        const { data, error } = await supabaseClient.rpc('registrar_pecas', {
            p_nome: nome,
            p_distribuicao: linhas.map(linha => ({
                local_id: Number(linha.local_id),
                subsetor_id: linha.subsetor_id ? Number(linha.subsetor_id) : null,
                onde_fica: linha.onde_fica || null,
                quantidade: linha.quantidade
            })),
            p_categoria: valor('tipoItem') || null,
            p_descricao: valor('descricao') || null,
            p_foto_url: foto?.url || null,
            p_status: valor('status') || 'Ativo'
        });

        if (error) throw error;

        avisar(`${numero.format(data?.total ?? total)} peça(s) de "${nome}" cadastrada(s) em ${data?.linhas ?? linhas.length} local(is)/setor(es).`);

        limparFormularioCadastro();
        await carregarDashboard();
    } catch (erro) {
        console.error('ERRO AO CADASTRAR PEÇAS:', erro);
        if (foto) await supabaseClient.storage.from('inventario').remove([foto.caminho]);

        const mensagem = /registrar_pecas/.test(erro?.message || '') && /not find|does not exist/i.test(erro?.message || '')
            ? 'A migração v5 ainda não foi executada no Supabase.'
            : traduzirErro(erro);
        avisar('Não foi possível cadastrar: ' + mensagem, 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = textoBotao;
        }
    }

    return false;
}

function limparFormularioCadastro() {
    ['nome', 'tipoItem', 'descricao'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
    const status = document.getElementById('status');
    if (status) status.value = 'Ativo';
    const foto = document.getElementById('foto');
    if (foto) foto.value = '';
    const categoria = document.getElementById('tipoItem');
    if (categoria) categoria.readOnly = false;
    limparDistribuicao();
    atualizarDicaProduto();
}

/* Mantém o botão "Limpar" do formulário antigo funcionando. */
function limparFormulario() {
    limparFormularioCadastro();
}

/* Setores/locais mudaram: atualiza as linhas sem perder o que foi digitado. */
function atualizarLinhasDistribuicao() {
    document.querySelectorAll('#linhasDistribuicao .dist-linha').forEach(linha => {
        const local = linha.querySelector('.dist-local');
        const setor = linha.querySelector('.dist-setor');
        const atualLocal = local.value;
        const atualSetor = setor.value;
        local.innerHTML = opcoesLocaisDistribuicao(atualLocal);
        setor.innerHTML = opcoesSetoresDistribuicao(atualLocal, atualSetor);
    });
}

/* =========================================================
   09 · MOVER PEÇAS — assistente em 3 passos
   1. Qual peça?  2. Para onde? (vai voltar?)  3. Quantas?
========================================================= */

let passoMov = 1;
const LIMITE_LISTA_MOV = 40;

function pecasMovimentaveis() {
    return itens
        .filter(item => item.status !== 'Baixado' && quantidadeItem(item) > 0)
        .sort((a, b) => compararTexto(a.nome, b.nome) || compararTexto(nomeLocal(a.local_id), nomeLocal(b.local_id)));
}

function itemEscolhidoMov() {
    return itens.find(registro => String(registro.id) === String(document.getElementById('itemMov')?.value || ''));
}

/* Lista escondida (guarda o valor escolhido) + cartões do passo 1. */
function carregarItensMovimentacao() {
    const select = document.getElementById('itemMov');
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione a peça</option>' +
        pecasMovimentaveis().map(item => `<option value="${Number(item.id)}">${escaparHTML(item.nome)}</option>`).join('');
    if (valorAtual && [...select.options].some(opcao => opcao.value === valorAtual)) select.value = valorAtual;
    renderizarPecasMov();
}

function renderizarPecasMov() {
    const lista = document.getElementById('listaPecasMov');
    if (!lista) return;

    const termo = normalizarTexto(valorCampo('buscaPecaMov'));
    const todas = pecasMovimentaveis();
    const achadas = !termo ? todas : todas.filter(item => normalizarTexto([
        item.nome, item.tipo, lugarDoItem(item)
    ].join(' ')).includes(termo));

    if (!todas.length) {
        lista.innerHTML = `<div class="tela-vazia"><i class="fa-solid fa-box-open"></i>
            <strong>Nenhuma peça cadastrada ainda</strong><span>Cadastre as peças primeiro em "Cadastrar peças".</span></div>`;
        return;
    }
    if (!achadas.length) {
        lista.innerHTML = `<div class="tela-vazia"><i class="fa-solid fa-magnifying-glass"></i>
            <strong>Nenhuma peça encontrada</strong><span>Confira o nome ou procure pelo local.</span></div>`;
        return;
    }

    const visiveis = achadas.slice(0, LIMITE_LISTA_MOV);
    lista.innerHTML = visiveis.map(item => {
        const avisos = [
            item.status !== 'Ativo' ? `<em class="status-badge ${classeStatus(item.status)}">${escaparHTML(item.status)}</em>` : '',
            estaForaDoLugar(item) ? seloFora(item) : ''
        ].join('');
        return `<button type="button" class="mov-peca" onclick="escolherPecaMov(${Number(item.id)})">
                ${fotoPequena(fotoDoItem(item), 'mov-peca-foto')}
                <span class="mov-peca-texto">
                    <strong>${escaparHTML(item.nome)}</strong>
                    <small><i class="fa-solid fa-location-dot"></i> ${escaparHTML(lugarDoItem(item))}</small>
                    ${avisos ? `<span class="mov-peca-avisos">${avisos}</span>` : ''}
                </span>
                <span class="mov-peca-qtd"><b>${numero.format(quantidadeItem(item))}</b><small>peça(s)</small></span>
            </button>`;
    }).join('') + (achadas.length > visiveis.length
        ? `<p class="mov-lista-mais">Mostrando ${visiveis.length} de ${achadas.length}. Digite mais do nome para achar mais rápido.</p>` : '');
}

function escolherPecaMov(id) {
    const select = document.getElementById('itemMov');
    if (!select) return;
    if (![...select.options].some(opcao => opcao.value === String(id))) carregarItensMovimentacao();
    select.value = String(id);
    preencherOrigemAutomaticamente();
    mostrarPassoMov(2);
}

function mostrarPassoMov(passo) {
    passoMov = passo;
    document.querySelectorAll('#movimentacaoTela .mov-etapa').forEach(etapa => {
        etapa.hidden = Number(etapa.dataset.etapa) !== passo;
    });
    document.querySelectorAll('#movimentacaoTela .mov-passos li').forEach(item => {
        const n = Number(item.dataset.passo);
        item.classList.toggle('atual', n === passo);
        item.classList.toggle('feito', n < passo);
    });

    const voltar = document.getElementById('btnMovVoltar');
    const avancar = document.getElementById('btnMovAvancar');
    if (voltar) voltar.hidden = passo === 1;
    if (avancar) {
        avancar.hidden = passo === 1;   // no passo 1 basta tocar na peça
        avancar.innerHTML = passo === 3
            ? '<i class="fa-solid fa-check"></i> Confirmar'
            : 'Continuar <i class="fa-solid fa-arrow-right"></i>';
    }
    erroMov('');

    const item = itemEscolhidoMov();
    const escolhida = document.getElementById('movPecaEscolhida');
    if (escolhida) {
        escolhida.innerHTML = item ? `
            <div><span>Peça escolhida</span>
                <strong>${escaparHTML(item.nome)}</strong>
                <small>Está em ${escaparHTML(lugarDoItem(item))} · ${numero.format(quantidadeItem(item))} peça(s)</small>
            </div>
            <button type="button" class="btn-link" onclick="mostrarPassoMov(1)">Trocar</button>` : '';
    }

    if (passo === 1) setTimeout(() => document.getElementById('buscaPecaMov')?.focus(), 50);
    if (passo === 3) atualizarResumoMov();
    document.querySelector('#movimentacaoTela .mov-assistente')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function erroMov(mensagem) {
    const erro = document.getElementById('movErro');
    if (!erro) return;
    erro.textContent = mensagem;
    erro.hidden = !mensagem;
}

function avancarPassoMov() {
    const item = itemEscolhidoMov();
    if (passoMov === 1) {
        if (!item) return erroMov('Toque na peça que vai sair do lugar.');
        return mostrarPassoMov(2);
    }
    if (passoMov === 2) {
        if (!item) return mostrarPassoMov(1);
        const destino = valorCampo('destino');
        if (!destino) return erroMov('Escolha o local para onde a peça vai.');
        if (String(destino) === String(item.local_id) && valorCampo('destinoSubsetor') === String(item.subsetor_id || '') &&
            mesmoTexto(valorCampo('destinoOndeFica'), item.onde_fica)) {
            return erroMov('A peça já está neste lugar. Escolha outro local, setor ou "onde fica".');
        }
        return mostrarPassoMov(3);
    }
    return movimentarItem();
}

function voltarPassoMov() {
    if (passoMov > 1) mostrarPassoMov(passoMov - 1);
}

function ajustarQuantidadeMov(diferenca) {
    const campo = document.getElementById('quantidadeMov');
    if (!campo) return;
    const maximo = Number(campo.max) || Infinity;
    campo.value = Math.min(maximo, Math.max(1, (parseInt(campo.value, 10) || 0) + diferenca));
    atualizarResumoMov();
}

function atualizarResumoMov() {
    const resumo = document.getElementById('movResumo');
    const item = itemEscolhidoMov();
    if (!resumo || !item) return;

    const quantidade = parseInt(valorCampo('quantidadeMov') || '0', 10) || 0;
    const destino = lugarCompleto(valorCampo('destino'), valorCampo('destinoSubsetor') || null, valorCampo('destinoOndeFica'));
    const temporaria = document.querySelector('input[name="tipoMovimentacao"]:checked')?.value !== 'definitiva';
    const retorno = valorCampo('retornoPrevisto');

    resumo.innerHTML = `<i class="fa-solid fa-truck-ramp-box"></i>
        <p>Vão sair <b>${numero.format(quantidade)}</b> × <b>${escaparHTML(item.nome)}</b>
        de <b>${escaparHTML(lugarDoItem(item))}</b>
        para <b>${escaparHTML(destino)}</b>.
        ${temporaria
            ? (retorno ? `Devem voltar até <b>${escaparHTML(dataCurta(retorno))}</b>.` : 'Depois devem voltar para o lugar delas.')
            : 'Vão ficar lá de vez.'}</p>`;
}

function atualizarAjudaMovimentacao() {
    const item = itemEscolhidoMov();
    const tipo = document.querySelector('input[name="tipoMovimentacao"]:checked')?.value || 'temporaria';
    const destino = valorCampo('destino');
    const destinoSetor = valorCampo('destinoSubsetor');
    const info = document.getElementById('infoOrigemFixa');
    const grupoRetorno = document.getElementById('grupoRetornoPrevisto');

    if (grupoRetorno) grupoRetorno.style.display = tipo === 'temporaria' ? '' : 'none';
    preencherSugestoesOndeFica('sugestoesOndeFicaMov', destino);
    if (passoMov === 3) atualizarResumoMov();

    if (!info) return;
    if (!item || !temOrigem(item)) { info.innerHTML = ''; return; }

    const casa = lugarFixoDoItem(item);
    const voltaParaCasa = destino && String(destino) === String(item.origem_local_id) &&
                          String(destinoSetor) === String(item.origem_subsetor_id || '') &&
                          mesmoTexto(valorCampo('destinoOndeFica'), item.origem_onde_fica);

    let texto = `<i class="fa-solid fa-house"></i> Lugar fixo desta peça: <strong>${escaparHTML(casa)}</strong>.`;
    if (voltaParaCasa) texto += ' <b class="ok">Ela está voltando para o lugar dela.</b>';
    info.innerHTML = texto;
}

function preencherOrigemAutomaticamente() {
    const item = itemEscolhidoMov();
    const origem = document.getElementById('origemNome');
    const quantidade = document.getElementById('quantidadeMov');

    if (origem) origem.value = item ? lugarDoItem(item) : '';

    if (item && quantidade) {
        const disponivel = quantidadeItem(item);
        quantidade.max = disponivel;
        if (Number(quantidade.value) > disponivel || !quantidade.value) quantidade.value = disponivel;
        definirTexto('ajudaQuantidadeMov', `Há ${disponivel} peça(s) neste lugar.`);
    }

    atualizarAjudaMovimentacao();
}

function limparFormularioMovimentacao() {
    ['itemMov', 'destino', 'destinoSubsetor', 'destinoOndeFica', 'observacaoMov', 'statusMov', 'origemNome', 'retornoPrevisto', 'buscaPecaMov'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
    const quantidade = document.getElementById('quantidadeMov');
    if (quantidade) { quantidade.value = 1; quantidade.removeAttribute('max'); }
    const temporaria = document.querySelector('input[name="tipoMovimentacao"][value="temporaria"]');
    if (temporaria) temporaria.checked = true;
    const mais = document.querySelector('#movimentacaoTela .mov-mais');
    if (mais) mais.open = false;
    definirTexto('ajudaQuantidadeMov', '');
    popularSubsetoresMovimentacao();
    atualizarAjudaMovimentacao();
    renderizarPecasMov();
    mostrarPassoMov(1);
}

/* Uma única chamada ao banco: saldo, travas e validações são feitos lá. */
async function movimentarItem(evento) {
    evento?.preventDefault();
    evento?.stopPropagation();

    if (!podeMovimentar()) return avisar('Seu perfil não pode mover peças.', 'erro'), false;

    const item = itemEscolhidoMov();
    const destinoId = valorCampo('destino');
    const destinoSubsetorId = valorCampo('destinoSubsetor');
    const quantidade = parseInt(valorCampo('quantidadeMov') || '0', 10);

    if (!item) return mostrarPassoMov(1), false;
    if (!destinoId) return mostrarPassoMov(2), erroMov('Escolha o local para onde a peça vai.'), false;
    if (!(quantidade >= 1)) return erroMov('Informe quantas peças vão (pelo menos 1).'), false;
    if (quantidade > quantidadeItem(item)) return erroMov(`Só há ${quantidadeItem(item)} peça(s) neste lugar.`), false;

    const botao = document.getElementById('btnMovAvancar');
    if (botao) botao.disabled = true;

    try {
        const { data, error } = await supabaseClient.rpc('movimentar_item', {
            p_item_id: Number(item.id),
            p_destino_id: Number(destinoId),
            p_quantidade: quantidade,
            p_destino_subsetor_id: destinoSubsetorId ? Number(destinoSubsetorId) : null,
            p_status: valorCampo('statusMov') || null,
            p_observacao: valorCampo('observacaoMov') || null,
            p_definitivo: document.querySelector('input[name="tipoMovimentacao"]:checked')?.value === 'definitiva',
            p_retorno_previsto: valorCampo('retornoPrevisto') || null,
            p_destino_onde_fica: valorCampo('destinoOndeFica') || null
        });

        if (error) throw error;

        avisar(({
            SAIDA_TEMPORARIA: 'Pronto! As peças aparecem em "Fora do lugar" até voltarem.',
            REMANEJAMENTO: 'Pronto! O novo local agora é o lugar fixo das peças.',
            DEVOLUCAO: 'Pronto! As peças voltaram para o lugar delas.',
            STATUS: 'Pronto! Estado da peça alterado.'
        }[data?.tipo] || 'Movimentação registrada.'));

        await carregarDashboard();
        limparFormularioMovimentacao();
    } catch (erro) {
        console.error('ERRO AO MOVIMENTAR:', erro);
        erroMov('Não foi possível mover: ' + traduzirErro(erro));
        await carregarItens(); // o saldo pode ter mudado por outro usuário
    } finally {
        if (botao) botao.disabled = false;
    }

    return false;
}

/* =========================================================
   10 · INVENTÁRIO (tabela completa com o local fixo)
========================================================= */

function renderizarItens() {
    const tbody = document.getElementById('listaItens');
    if (!tbody) return;

    if (!itens.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state">${itensCarregados
            ? 'Nenhuma peça cadastrada ainda. Use "Cadastrar peças" para registrar a primeira.'
            : 'Carregando inventário...'}</td></tr>`;
        return;
    }

    const gestao = podeAdministrar();

    tbody.innerHTML = itens.map(item => {
        const foto = fotoDoItem(item);
        const fora = estaForaDoLugar(item);
        return `
            <tr data-subsetor-id="${item.subsetor_id ? Number(item.subsetor_id) : ''}" data-item-id="${Number(item.id)}">
                <td>${foto
                    ? imgMiniatura(foto)
                    : '<div class="sem-foto"><i class="fa-solid fa-image"></i></div>'}</td>
                <td><strong>${escaparHTML(item.nome || '—')}</strong>
                    ${item.descricao ? `<small class="celula-sub">${escaparHTML(item.descricao)}</small>` : ''}</td>
                <td>${escaparHTML(item.tipo && item.tipo !== item.nome ? item.tipo : '—')}</td>
                <td class="num"><strong>${numero.format(quantidadeItem(item))}</strong></td>
                <td>${escaparHTML(nomeLocal(item.local_id))}</td>
                <td>${item.subsetor_id ? escaparHTML(nomeSubsetor(item.subsetor_id)) : '<span class="texto-suave">Local inteiro</span>'}
                    ${item.onde_fica ? `<small class="celula-sub"><i class="fa-solid fa-location-crosshairs"></i> ${escaparHTML(item.onde_fica)}</small>` : ''}</td>
                <td>${fora
                    ? `<span class="selo-fora ${retornoAtrasado(item) ? 'atrasado' : ''}"><i class="fa-solid fa-house"></i>
                       ${escaparHTML(lugarFixoDoItem(item))}</span>`
                    : '<span class="texto-suave">No lugar</span>'}</td>
                <td><span class="status-badge ${classeStatus(item.status)}">${escaparHTML(item.status || 'Ativo')}</span></td>
                <td>
                    <div class="acoes-tabela">
                        ${podeMovimentar() ? `<button type="button" class="btn-icon" title="Movimentar" onclick="movimentarPeca(${Number(item.id)})">
                            <i class="fa-solid fa-right-left"></i></button>` : ''}
                        ${gestao ? `<button type="button" class="btn-icon btn-editar" title="Editar peça no catálogo" onclick="editarItem(${Number(item.id)})">
                            <i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="btn-icon btn-excluir" title="Excluir" onclick="excluirItem(${Number(item.id)})">
                            <i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function exportarExcel() {
    const visiveis = new Set(
        [...document.querySelectorAll('#listaItens tr')]
            .filter(linha => linha.style.display !== 'none')
            .map(linha => linha.dataset.itemId)
    );
    const lista = itens.filter(item => visiveis.size === 0 || visiveis.has(String(item.id)));
    if (!lista.length) return avisar('Nenhuma peça para exportar.', 'info');

    const colunas = ['PEÇA', 'CATEGORIA', 'DESCRIÇÃO', 'QUANTIDADE', 'LOCAL', 'SETOR', 'ONDE FICA',
                     'LOCAL FIXO', 'SETOR FIXO', 'ONDE FICA (FIXO)', 'FORA DO LUGAR', 'RETORNO PREVISTO', 'STATUS'];
    const linhas = lista.map(item => [
        item.nome || '',
        item.tipo && item.tipo !== item.nome ? item.tipo : '',
        item.descricao || '',
        quantidadeItem(item),
        nomeLocal(item.local_id),
        item.subsetor_id ? nomeSubsetor(item.subsetor_id) : '',
        item.onde_fica || '',
        temOrigem(item) ? nomeLocal(item.origem_local_id) : '',
        item.origem_subsetor_id ? nomeSubsetor(item.origem_subsetor_id) : '',
        item.origem_onde_fica || '',
        estaForaDoLugar(item) ? 'SIM' : 'NÃO',
        dataCurta(item.retorno_previsto),
        item.status || ''
    ].map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(';'));

    const csv = '﻿' + [colunas.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), {
        href: url, download: `inventario-monte-carlo-${hojeISO()}.csv`
    }).click();
    URL.revokeObjectURL(url);
}

function filtrarItens() {
    const busca = valorCampo('busca').toLowerCase();
    const filtroSubsetor = valorCampo('filtroSubsetor');
    let visiveis = 0;

    document.querySelectorAll('#listaItens tr').forEach(linha => {
        if (!linha.cells || linha.cells.length < 9) return;
        const mostrar =
            (!busca || linha.textContent.toLowerCase().includes(busca)) &&
            (!filtroSubsetor || String(linha.dataset.subsetorId || '') === filtroSubsetor);
        linha.style.display = mostrar ? '' : 'none';
        if (mostrar) visiveis++;
    });

    definirTexto('estoqueTotal', visiveis);
}

/* Só Gestor/Administrador (validado também no banco). */
async function excluirItem(id) {
    if (!podeAdministrar()) return avisar('Só Gestor ou Administrador pode excluir peças.', 'erro');

    const item = itens.find(registro => Number(registro.id) === Number(id));
    if (!item) return avisar('Peça não encontrada. Atualize a tela.', 'erro');

    if (!(await confirmar({
        titulo: 'Excluir este registro?',
        mensagem: `${item.nome || 'Peça'} — ${lugarDoItem(item)}\n\nEsta ação não pode ser desfeita.`,
        textoConfirmar: 'Excluir', perigo: true
    }))) return;

    try {
        const { error } = await supabaseClient.rpc('excluir_item', { p_item_id: Number(item.id) });
        if (error) throw error;
        avisar('Registro excluído.');
        await carregarDashboard();
    } catch (erro) {
        console.error('ERRO AO EXCLUIR ITEM:', erro);
        avisar('Não foi possível excluir: ' + traduzirErro(erro), 'erro');
    }
}

/* =========================================================
   11 · HISTÓRICO DE MOVIMENTAÇÕES
   (carrega ao abrir a tela — antes ficava vazio até recarregar a página)
========================================================= */

async function carregarHistorico() {
    const tabela = document.getElementById('historico');

    try {
        const { data, error } = await supabaseClient
            .from('movimentacoes')
            .select('*, usuarios:usuario_id(nome,email)')
            .order('data', { ascending: false })
            .limit(500);

        if (error) throw error;

        movimentacoes = data || [];
        if (!tabela) return;

        if (!movimentacoes.length) {
            tabela.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma movimentação ainda. Quando alguém mover uma peça, ela aparece aqui.</td></tr>';
            return;
        }

        tabela.innerHTML = movimentacoes.map(mov => {
            const item = itens.find(registro => Number(registro.id) === Number(mov.item_id));
            const nomeItem = mov.item_nome || item?.nome || '—';
            const origem = mov.origem_id ? lugarCompleto(mov.origem_id, mov.origem_subsetor_id, mov.origem_onde_fica) : '—';
            const destino = lugarCompleto(mov.destino_id, mov.destino_subsetor_id, mov.destino_onde_fica);
            const mudouStatus = mov.status_anterior && mov.status_novo && mov.status_anterior !== mov.status_novo;
            const observacao = [
                mudouStatus ? `${mov.status_anterior} → ${mov.status_novo}` : '',
                mov.retorno_previsto ? `Retorno previsto: ${new Date(mov.retorno_previsto + 'T12:00:00').toLocaleDateString('pt-BR')}` : '',
                mov.observacao || ''
            ].filter(Boolean).join(' · ') || '—';

            return `
                <tr>
                    <td><span class="mov-tipo mov-${escaparHTML(String(mov.tipo_movimento || '').toLowerCase())}">${escaparHTML(ROTULOS_MOVIMENTO[mov.tipo_movimento] || 'Movimentação')}</span></td>
                    <td><strong>${escaparHTML(nomeItem)}</strong></td>
                    <td>${escaparHTML(origem)}</td>
                    <td>${escaparHTML(destino)}</td>
                    <td>${Number(mov.quantidade) || 0}</td>
                    <td>${escaparHTML(observacao)}</td>
                    <td>${escaparHTML(mov.usuarios?.nome || mov.usuarios?.email || '—')}</td>
                    <td>${escaparHTML(mov.data ? new Date(mov.data).toLocaleString('pt-BR') : '—')}</td>
                </tr>`;
        }).join('');
    } catch (erro) {
        console.error('ERRO AO CARREGAR HISTÓRICO:', erro);
    }
}

/* =========================================================
   12 · ADMINISTRAÇÃO: usuários, locais, setores e auditoria
========================================================= */

async function abrirAdministracao() {
    if (!podeAdministrar()) return avisar('Só Gestor ou Administrador acessa a Administração.', 'erro');
    abrirTela('administracaoTela', document.getElementById('menuAdministracao'));
    await carregarSubsetores();
    renderizarLocaisAdmin();
    await Promise.all([carregarUsuariosAdmin(), carregarAuditoria()]);
}


/* ---------------- Usuários ---------------- */

async function carregarUsuariosAdmin() {
    const tbody = document.getElementById('listaUsuariosAdmin');
    if (!tbody) return;
    try {
        const { data, error } = await supabaseClient.from('usuarios')
            .select('id,email,nome,perfil,ativo,created_at').order('nome', { ascending: true });
        if (error) throw error;

        tbody.innerHTML = (data || []).map(u => `
            <tr>
                <td>${escaparHTML(u.nome || '—')}</td>
                <td>${escaparHTML(u.email || '—')}</td>
                <td>${escaparHTML(u.perfil || 'consulta')}</td>
                <td><span class="status-badge ${u.ativo === false ? 'inativo' : 'ativo'}">${u.ativo === false ? 'Inativo' : 'Ativo'}</span></td>
                <td class="admin-actions">
                    <button type="button" class="btn-secondary btn-small" onclick="alternarStatusUsuario('${escaparHTML(u.id)}', ${u.ativo !== false})">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty-state">Nenhum usuário encontrado.</td></tr>';
    } catch (erro) {
        console.error('ERRO USUÁRIOS:', erro);
    }
}

async function criarUsuario() {
    if (!podeAdministrar()) return avisar('Só Gestor ou Administrador cria usuários.', 'erro');
    const nome = valorCampo('novoUsuarioNome');
    const email = valorCampo('novoUsuarioEmail');
    const senha = document.getElementById('novoUsuarioSenha')?.value || '';
    const perfil = valorCampo('novoUsuarioPerfil') || 'consulta';
    if (!nome || !email || senha.length < 10) return avisar('Informe nome, e-mail e uma senha com pelo menos 10 caracteres.', 'erro');

    try {
        const { data, error } = await supabaseClient.functions.invoke('criar-usuario', { body: { nome, email, senha, perfil } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        avisar(`Usuário ${nome} criado. Passe a ele o e-mail e a senha.`);
        ['novoUsuarioNome', 'novoUsuarioEmail', 'novoUsuarioSenha'].forEach(id => { document.getElementById(id).value = ''; });
        await carregarUsuariosAdmin();
    } catch (erro) {
        avisar('Não foi possível criar o usuário: ' + traduzirErro(erro), 'erro');
    }
}

async function alternarStatusUsuario(id, ativoAtual) {
    if (!podeAdministrar()) return avisar('Sem permissão.', 'erro');
    if (String(id) === String(usuarioLogado?.id)) return avisar('Você não pode desativar o seu próprio acesso.', 'erro');
    if (ativoAtual && !(await confirmar({ titulo: 'Desativar este usuário?', mensagem: 'A pessoa não conseguirá mais entrar no sistema. Você pode reativar depois.', textoConfirmar: 'Desativar', perigo: true }))) return;
    const { error } = await supabaseClient.from('usuarios').update({ ativo: !ativoAtual }).eq('id', id);
    if (error) return avisar('Não foi possível alterar: ' + traduzirErro(error), 'erro');
    avisar(ativoAtual ? 'Usuário desativado.' : 'Usuário reativado.');
    await carregarUsuariosAdmin();
}


/* ---------------- Setores ---------------- */

function popularLocaisAdminSetor() {
    preencherSelect(document.getElementById('adminSubsetorLocal'),
        LOCAIS.map(local => ({ valor: local.id, texto: local.nome })), 'Selecione o local');
}

function renderizarSubsetoresAdmin() {
    const tbody = document.getElementById('listaSubsetoresAdmin');
    if (!tbody) return;
    tbody.innerHTML = subsetores.map(s => `
        <tr>
            <td>${escaparHTML(nomeLocal(s.local_id))}</td>
            <td><strong>${escaparHTML(s.nome)}</strong></td>
            <td><span class="status-badge ativo">Ativo</span></td>
            <td class="admin-actions">
                <button type="button" class="btn-secondary btn-small" onclick="editarSubsetor(${Number(s.id)})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-secondary btn-small" onclick="inativarSubsetor(${Number(s.id)})"><i class="fa-solid fa-ban"></i></button>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-state">Nenhum setor cadastrado.</td></tr>';
}

async function criarSubsetor() {
    if (!podeAdministrar()) return avisar('Só Gestor ou Administrador cria setores.', 'erro');
    const localId = valorCampo('adminSubsetorLocal');
    const nome = valorCampo('adminSubsetorNome');
    if (!localId || !nome) return avisar('Escolha o local e escreva o nome do setor.', 'erro');
    const { error } = await supabaseClient.from('subsetores')
        .insert([{ local_id: Number(localId), nome, ativo: true, created_by: usuarioLogado.id }]);
    if (error) return avisar('Não foi possível criar o setor: ' + traduzirErro(error), 'erro');
    document.getElementById('adminSubsetorNome').value = '';
    avisar(`Setor "${nome}" criado.`);
    await carregarSubsetores();
}

async function inativarSubsetor(id) {
    if (!podeAdministrar()) return avisar('Sem permissão.', 'erro');
    const atual = subsetores.find(s => Number(s.id) === Number(id));
    if (!atual || !(await confirmar({ titulo: `Desativar o setor "${atual.nome}"?`, mensagem: `${nomeLocal(atual.local_id)}\n\nEle deixa de aparecer nas listas. As peças que estão nele continuam registradas.`, textoConfirmar: 'Desativar', perigo: true }))) return;
    const { error } = await supabaseClient.from('subsetores').update({ ativo: false }).eq('id', id);
    if (error) return avisar('Não foi possível desativar: ' + traduzirErro(error), 'erro');
    avisar('Setor desativado.');
    await carregarSubsetores();
}

function editarSubsetor(id) {
    if (!podeAdministrar()) return avisar('Usuário sem permissão.', 'erro');
    const atual = subsetores.find(subsetor => Number(subsetor.id) === Number(id));
    if (!atual) return;

    abrirFormulario({
        titulo: 'Renomear setor',
        subtitulo: nomeLocal(atual.local_id),
        campos: [{ id: 'nome', rotulo: 'Nome do setor', valor: atual.nome, obrigatorio: true, largo: true }],
        aoSalvar: async ({ nome }) => {
            const { error } = await supabaseClient.from('subsetores').update({ nome }).eq('id', id);
            if (error) throw error;
            await carregarSubsetores();
            avisar('Setor renomeado.');
        }
    });
}


/* ---------------- Locais ---------------- */

function renderizarLocaisAdmin() {
    const tbody = document.getElementById('listaLocaisAdmin');
    if (!tbody) return;

    const unidadesPorLocal = {};
    itens.forEach(item => {
        unidadesPorLocal[item.local_id] = (unidadesPorLocal[item.local_id] || 0) + quantidadeItem(item);
    });

    tbody.innerHTML = LOCAIS_TODOS.map(local => {
        const ativo = local.ativo !== false;
        return `
            <tr class="${ativo ? '' : 'linha-inativa'}">
                <td><strong>${escaparHTML(local.nome)}</strong></td>
                <td>${numero.format(unidadesPorLocal[local.id] || 0)}</td>
                <td><span class="status-badge ${ativo ? 'ativo' : 'inativo'}">${ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td class="admin-actions">
                    <button type="button" class="btn-icon" title="Renomear" onclick="editarLocal(${Number(local.id)})">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="btn-icon" title="${ativo ? 'Inativar' : 'Reativar'}" onclick="alternarLocal(${Number(local.id)})">
                        <i class="fa-solid ${ativo ? 'fa-ban' : 'fa-rotate-left'}"></i>
                    </button>
                </td>
            </tr>`;
    }).join('') || '<tr><td colspan="4" class="empty-state">Nenhum local cadastrado.</td></tr>';
}

function novoLocal() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador gerencia locais.', 'erro');

    abrirFormulario({
        titulo: 'Novo local',
        subtitulo: 'O local fica disponível imediatamente em todas as telas.',
        textoSalvar: 'Criar local',
        campos: [{ id: 'nome', rotulo: 'Nome do local', obrigatorio: true, placeholder: 'Ex.: CASA 7', largo: true }],
        aoSalvar: async ({ nome }) => {
            const ordem = Math.max(0, ...LOCAIS_TODOS.map(local => Number(local.ordem) || 0)) + 1;
            const { error } = await supabaseClient.from('locais').insert([{ nome: nome.toUpperCase(), ordem }]);
            if (error) throw error;
            await carregarLocaisBanco();
            atualizarLocaisNaTela();
            avisar(`Local "${nome.toUpperCase()}" criado.`);
        }
    });
}

function editarLocal(id) {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador gerencia locais.', 'erro');
    const local = LOCAIS_TODOS.find(registro => Number(registro.id) === Number(id));
    if (!local) return;

    abrirFormulario({
        titulo: 'Renomear local',
        subtitulo: 'O nome muda em todo o sistema, inclusive no histórico.',
        campos: [{ id: 'nome', rotulo: 'Nome do local', valor: local.nome, obrigatorio: true, largo: true }],
        aoSalvar: async ({ nome }) => {
            const { error } = await supabaseClient.from('locais').update({ nome: nome.toUpperCase() }).eq('id', id);
            if (error) throw error;
            await carregarLocaisBanco();
            atualizarLocaisNaTela();
            avisar('Local renomeado.');
        }
    });
}

async function alternarLocal(id) {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador gerencia locais.', 'erro');
    const local = LOCAIS_TODOS.find(registro => Number(registro.id) === Number(id));
    if (!local) return;

    const ativar = local.ativo === false;
    const unidades = itens.filter(item => Number(item.local_id) === Number(id))
        .reduce((total, item) => total + quantidadeItem(item), 0);

    const mensagem = ativar
        ? `Reativar o local "${local.nome}"?`
        : `Inativar o local "${local.nome}"?` +
          (unidades ? `\n\nEle possui ${numero.format(unidades)} unidade(s). Elas continuam registradas lá, ` +
                      `mas não será possível enviar novos itens para este local.` : '');

    if (!(await confirmar({ titulo: ativar ? 'Reativar local' : 'Desativar local', mensagem, textoConfirmar: ativar ? 'Reativar' : 'Desativar', perigo: !ativar }))) return;

    const { error } = await supabaseClient.from('locais').update({ ativo: ativar }).eq('id', id);
    if (error) return avisar(traduzirErro(error), 'erro');

    await carregarLocaisBanco();
    atualizarLocaisNaTela();
    avisar(ativar ? 'Local reativado.' : 'Local inativado.');
}


/* ---------------- Auditoria ---------------- */

async function carregarAuditoria() {
    const tbody = document.getElementById('listaAuditoria');
    if (!tbody) return;
    try {
        const { data, error } = await supabaseClient.from('auditoria')
            .select('*, usuarios:usuario_id(nome,email)').order('data', { ascending: false }).limit(300);
        if (error) throw error;

        tbody.innerHTML = (data || []).map(reg => {
            const detalhes = reg.detalhes && typeof reg.detalhes === 'object'
                ? JSON.stringify(reg.detalhes, null, 2) : String(reg.detalhes || '');
            return `
                <tr>
                    <td>${escaparHTML(reg.data ? new Date(reg.data).toLocaleString('pt-BR') : '-')}</td>
                    <td><strong>${escaparHTML(reg.usuarios?.nome || reg.usuarios?.email || '—')}</strong></td>
                    <td><span class="auditoria-badge auditoria-${escaparHTML(String(reg.acao || '').toLowerCase())}">${escaparHTML(reg.acao || '-')}</span></td>
                    <td>${escaparHTML(reg.descricao || '-')}</td>
                    <td><pre class="auditoria-detalhes">${escaparHTML(detalhes)}</pre></td>
                </tr>`;
        }).join('') || '<tr><td colspan="5" class="empty-state">Nenhuma ação registrada.</td></tr>';
    } catch (erro) {
        console.error('ERRO AO CARREGAR AUDITORIA:', erro);
    }
}


/* ---------------- Ferramentas ---------------- */

/*
   Gera as miniaturas das fotos enviadas antes desta versão.
   Pode ser executada mais de uma vez: pula as que já existem.
*/
async function gerarMiniaturasAntigas() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador.', 'erro');

    const botao = document.getElementById('btnGerarMiniaturas');
    const status = document.getElementById('statusMiniaturas');
    const urls = [...new Set([...produtos, ...itens].map(r => r.foto_url).filter(u => caminhoNoStorage(u)))];

    if (!urls.length) return avisar('Nenhuma foto encontrada para processar.', 'info');
    if (!(await confirmar({ titulo: 'Gerar miniaturas', mensagem: `Serão processadas ${urls.length} foto(s). Pode levar alguns minutos: mantenha esta tela aberta.`, textoConfirmar: 'Começar' }))) return;

    if (botao) botao.disabled = true;
    let feitas = 0, existentes = 0, falhas = 0;

    for (const [indice, url] of urls.entries()) {
        if (status) status.textContent = `Processando ${indice + 1} de ${urls.length}...`;
        try {
            const jaExiste = await fetch(urlMiniatura(url), { method: 'HEAD', cache: 'no-store' });
            if (jaExiste.ok) { existentes++; continue; }

            const resposta = await fetch(url, { cache: 'no-store' });
            if (!resposta.ok) throw new Error('foto original indisponível');
            const blob = await resposta.blob();
            const mini = await comprimirImagem(new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' }), 360, 0.78, true);

            const { error } = await supabaseClient.storage.from('inventario')
                .upload(caminhoNoStorage(urlMiniatura(url)), mini, { upsert: true, contentType: 'image/jpeg' });
            if (error) throw error;
            feitas++;
        } catch (erro) {
            console.warn('Miniatura não gerada para', url, erro);
            falhas++;
        }
    }

    if (botao) botao.disabled = false;
    const resumo = `${feitas} miniatura(s) criada(s), ${existentes} já existiam` + (falhas ? `, ${falhas} com erro.` : '.');
    if (status) status.textContent = resumo;
    avisar(resumo, falhas ? 'info' : 'sucesso');
}

/* =========================================================
   13 · CONSULTA PÚBLICA (sem login)

   Corrigido nesta versão:
   • ordenação (o código procurava um campo com outro nome);
   • alternância grade/lista;
   • paginação com os estilos que já existiam;
   • filtros montados uma vez só (antes, 3 rotinas faziam isso).
========================================================= */

const ITENS_POR_PAGINA_CONSULTA = 24;
let itensConsultaPublica = [];
let paginaConsultaPublica = 1;

function abrirConsultaPublica() {
    abrirTela('consultaPublicaTela');
}

function voltarParaLogin() {
    abrirTela('loginTela');
}

async function carregarConsultaPublica() {
    const container = document.getElementById('listaConsultaPublica');
    if (!container) return;

    container.innerHTML = `
        <div class="consulta-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Carregando inventário...</span>
        </div>`;

    try {
        const { data, error } = await supabaseClient
            .from('consulta_publica_inventario')
            .select('nome,tipo,descricao,quantidade,local_id,status,foto_url')
            .eq('status', 'Ativo')
            .order('nome', { ascending: true });

        if (error) throw error;

        itensConsultaPublica = consolidarItensConsultaPublica(data || []);
        popularFiltrosConsultaPublica();
        paginaConsultaPublica = 1;
        renderizarConsultaPublica();
    } catch (erro) {
        console.error('ERRO CONSULTA PÚBLICA:', erro);
        container.innerHTML = `
            <div class="consulta-vazia">
                <div class="consulta-vazia-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h3>Não foi possível carregar o inventário</h3>
                <p>Verifique sua conexão e tente novamente.</p>
                <button type="button" class="btn-secondary" onclick="carregarConsultaPublica()">
                    <i class="fa-solid fa-rotate-right"></i> Tentar novamente
                </button>
            </div>`;
        renderizarPaginacaoConsultaPublica(0);
    }
}

async function atualizarConsultaPublica() {
    const botao = document.getElementById('btnAtualizarConsulta');
    const texto = botao?.innerHTML;
    if (botao) {
        botao.disabled = true;
        botao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';
    }
    try {
        await carregarConsultaPublica();
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = texto;
        }
    }
}

/* Junta registros da mesma peça no mesmo local (somando quantidades). */
function consolidarItensConsultaPublica(lista) {
    const mapa = new Map();
    lista.forEach(item => {
        const chave = [chaveNome(item.nome), chaveNome(item.tipo), String(item.local_id || '')].join('||');
        const existente = mapa.get(chave);
        if (existente) {
            existente.quantidade += quantidadeItem(item);
            if (!existente.foto_url && item.foto_url) existente.foto_url = item.foto_url;
        } else {
            mapa.set(chave, {
                nome: item.nome || 'Peça',
                tipo: item.tipo || '',
                descricao: item.descricao || '',
                local_id: item.local_id,
                foto_url: item.foto_url || '',
                quantidade: quantidadeItem(item)
            });
        }
    });
    return [...mapa.values()];
}

function popularFiltrosConsultaPublica() {
    const locais = new Map();
    const categorias = new Map();
    itensConsultaPublica.forEach(item => {
        if (item.local_id) locais.set(String(item.local_id), nomeLocal(item.local_id));
        const categoria = String(item.tipo || '').trim();
        if (categoria) categorias.set(normalizarTexto(categoria), categoria);
    });

    preencherSelect(document.getElementById('filtroLocalPublico'),
        [...locais].sort((a, b) => compararTexto(a[1], b[1])).map(([valor, texto]) => ({ valor, texto })),
        'Todos os locais');
    preencherSelect(document.getElementById('filtroCategoriaPublico'),
        [...categorias.values()].sort(compararTexto).map(c => ({ valor: c, texto: c })),
        'Todas as categorias');
}

const ORDENACOES_CONSULTA = {
    'nome-asc': (a, b) => compararTexto(a.nome, b.nome),
    'nome-desc': (a, b) => compararTexto(b.nome, a.nome),
    'quantidade-desc': (a, b) => b.quantidade - a.quantidade || compararTexto(a.nome, b.nome),
    'quantidade-asc': (a, b) => a.quantidade - b.quantidade || compararTexto(a.nome, b.nome),
    'local-asc': (a, b) => compararTexto(nomeLocal(a.local_id), nomeLocal(b.local_id)) || compararTexto(a.nome, b.nome)
};

function filtrarConsultaPublica() {
    paginaConsultaPublica = 1;
    renderizarConsultaPublica();
}

function renderizarConsultaPublica() {
    const container = document.getElementById('listaConsultaPublica');
    if (!container) return;

    const busca = normalizarTexto(document.getElementById('buscaPublica')?.value);
    const local = valorCampo('filtroLocalPublico');
    const categoria = valorCampo('filtroCategoriaPublico');
    const ordenar = ORDENACOES_CONSULTA[valorCampo('ordenacaoPublica')] || ORDENACOES_CONSULTA['nome-asc'];

    const filtrados = itensConsultaPublica.filter(item =>
        (!local || String(item.local_id) === local) &&
        (!categoria || String(item.tipo || '') === categoria) &&
        (!busca || busca.split(' ').every(parte =>
            normalizarTexto([item.nome, item.tipo, item.descricao, nomeLocal(item.local_id)].join(' ')).includes(parte)))
    ).sort(ordenar);

    definirTexto('contadorConsultaPublica', filtrados.length);

    if (!filtrados.length) {
        container.innerHTML = `
            <div class="consulta-vazia">
                <div class="consulta-vazia-icon"><i class="fa-solid fa-box-open"></i></div>
                <h3>Nenhum item encontrado</h3>
                <p>Tente alterar a pesquisa, categoria ou local.</p>
            </div>`;
        renderizarPaginacaoConsultaPublica(0);
        return;
    }

    const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA_CONSULTA);
    if (paginaConsultaPublica > totalPaginas) paginaConsultaPublica = 1;
    const inicio = (paginaConsultaPublica - 1) * ITENS_POR_PAGINA_CONSULTA;

    container.innerHTML = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA_CONSULTA).map(item => {
        const foto = item.foto_url
            ? `<div class="consulta-foto">
                   ${imgMiniatura(item.foto_url, { classe: '', alt: item.nome })}
                   <button type="button" class="consulta-foto-expandir" title="Ampliar foto"
                           onclick="event.stopPropagation(); abrirModalFoto('${escaparHTML(item.foto_url)}')">
                       <i class="fa-solid fa-expand"></i>
                   </button>
               </div>`
            : `<div class="consulta-foto consulta-sem-foto">
                   <i class="fa-solid fa-image"></i>
                   <span>Sem foto</span>
               </div>`;

        return `
            <article class="consulta-item-card">
                ${foto}
                <div class="consulta-card-conteudo">
                    <div class="consulta-card-topo">
                        <span class="consulta-status"><span class="consulta-status-dot"></span> Ativo</span>
                        <span class="consulta-tipo">${escaparHTML(item.tipo || 'Estoque')}</span>
                    </div>
                    <h3 class="consulta-item-nome">${escaparHTML(item.nome)}</h3>
                    ${item.descricao ? `<p class="consulta-descricao">${escaparHTML(item.descricao)}</p>` : ''}
                    <div class="consulta-info-grid">
                        <div class="consulta-info">
                            <span class="consulta-info-label">Quantidade</span>
                            <strong class="consulta-quantidade">${item.quantidade}</strong>
                            <small>unidade(s)</small>
                        </div>
                        <div class="consulta-info">
                            <span class="consulta-info-label">Localização</span>
                            <strong class="consulta-local"><i class="fa-solid fa-location-dot"></i> ${escaparHTML(nomeLocal(item.local_id))}</strong>
                        </div>
                    </div>
                </div>
            </article>`;
    }).join('');

    renderizarPaginacaoConsultaPublica(filtrados.length);
}

function renderizarPaginacaoConsultaPublica(total) {
    const lista = document.getElementById('listaConsultaPublica');
    if (!lista) return;

    let area = document.getElementById('paginacaoConsultaPublica');
    if (!area) {
        area = Object.assign(document.createElement('div'), { id: 'paginacaoConsultaPublica', className: 'consulta-publica-paginacao' });
        lista.insertAdjacentElement('afterend', area);
    }

    const paginas = Math.ceil(total / ITENS_POR_PAGINA_CONSULTA);
    if (paginas <= 1) {
        area.innerHTML = '';
        area.hidden = true;
        return;
    }
    area.hidden = false;

    const atual = paginaConsultaPublica;
    const numeros = [...new Set([1, atual - 1, atual, atual + 1, paginas])].filter(n => n >= 1 && n <= paginas).sort((a, b) => a - b);
    let anterior = 0;
    const botoes = numeros.map(n => {
        const lacuna = n - anterior > 1 ? '<span class="consulta-page-gap">…</span>' : '';
        anterior = n;
        return `${lacuna}<button type="button" class="consulta-page-btn ${n === atual ? 'active' : ''}" onclick="mudarPaginaConsultaPublica(${n})">${n}</button>`;
    }).join('');

    const inicio = (atual - 1) * ITENS_POR_PAGINA_CONSULTA + 1;
    const fim = Math.min(atual * ITENS_POR_PAGINA_CONSULTA, total);

    area.innerHTML = `
        <span class="consulta-paginacao-info">Exibindo <strong>${inicio}–${fim}</strong> de <strong>${total}</strong></span>
        <div class="consulta-paginacao-controles">
            <button type="button" class="consulta-page-btn" title="Página anterior" ${atual === 1 ? 'disabled' : ''}
                    onclick="mudarPaginaConsultaPublica(${atual - 1})"><i class="fa-solid fa-chevron-left"></i></button>
            ${botoes}
            <button type="button" class="consulta-page-btn" title="Próxima página" ${atual === paginas ? 'disabled' : ''}
                    onclick="mudarPaginaConsultaPublica(${atual + 1})"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`;
}

function mudarPaginaConsultaPublica(pagina) {
    paginaConsultaPublica = pagina;
    renderizarConsultaPublica();
    document.getElementById('listaConsultaPublica')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limparFiltrosConsultaPublica() {
    ['buscaPublica', 'filtroLocalPublico', 'filtroCategoriaPublico'].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = '';
    });
    const ordenacao = document.getElementById('ordenacaoPublica');
    if (ordenacao) ordenacao.value = 'nome-asc';
    filtrarConsultaPublica();
}

/* Grade ou lista — a escolha fica lembrada neste navegador. */
function aplicarVisualizacaoConsulta(modo) {
    document.getElementById('listaConsultaPublica')?.classList.toggle('consulta-lista-modo', modo === 'list');
    document.querySelectorAll('.consulta-view-buttons button').forEach(botao => {
        botao.classList.add('consulta-view-btn');
        botao.classList.toggle('active', botao.dataset.view === modo);
    });
    try { localStorage.setItem('consultaVisualizacao', modo); } catch { /* navegador sem armazenamento */ }
}

function iniciarConsultaPublica() {
    document.getElementById('buscaPublica')?.addEventListener('input', filtrarConsultaPublica);
    ['filtroLocalPublico', 'filtroCategoriaPublico', 'ordenacaoPublica'].forEach(id =>
        document.getElementById(id)?.addEventListener('change', filtrarConsultaPublica));
    document.querySelectorAll('.consulta-view-buttons button').forEach(botao =>
        botao.addEventListener('click', () => aplicarVisualizacaoConsulta(botao.dataset.view)));

    let salvo = 'grid';
    try { salvo = localStorage.getItem('consultaVisualizacao') === 'list' ? 'list' : 'grid'; } catch { /* sem armazenamento */ }
    aplicarVisualizacaoConsulta(salvo);
}

/* =========================================================
   14 · RÁDIOS HT E TERMO DE RESPONSABILIDADE
   A página que a pessoa abre para assinar é a termo.html.
========================================================= */

let radiosSelecionados = new Set();

const SITUACAO_TERMO = {
    ASSINADO:        { texto: 'Assinado',          classe: 'ativo',      icone: 'fa-circle-check' },
    PENDENTE:        { texto: 'Aguardando assinatura', classe: 'manutencao', icone: 'fa-hourglass-half' },
    EXPIRADO:        { texto: 'Link expirado',     classe: 'baixado',    icone: 'fa-clock' },
    SEM_TERMO:       { texto: 'Sem termo',         classe: 'baixado',    icone: 'fa-file-circle-exclamation' },
    SEM_RESPONSAVEL: { texto: 'Sem responsável',   classe: 'neutro',     icone: 'fa-user-slash' }
};


/* =========================================================
   CARREGAR E LISTAR
========================================================= */

/* Lista de modelos usados nos clubes; o primeiro é o padrão do cadastro. */
async function carregarModelosRadio() {
    const { data, error } = await supabaseClient.from('configuracoes').select('valor').eq('chave', 'radio_modelos').maybeSingle();
    if (error || !data?.valor) return;
    try {
        const lista = JSON.parse(data.valor).filter(m => m?.marca || m?.modelo);
        if (lista.length) modelosRadio = lista;
    } catch { /* mantém o padrão */ }
}

function textoModelo(m) {
    return [m?.marca, m?.modelo].filter(Boolean).join(' ');
}

function chaveModelo(marca, modelo) {
    return `${marca || ''}|${modelo || ''}`;
}

/* Números e séries do kit (para a busca). */
function camposKit(r) {
    return [r.bateria_codigo, r.bateria_serie, r.bateria_reserva_codigo, r.bateria_reserva_serie, r.carregador_codigo, r.carregador_serie]
        .filter(Boolean);
}

function resumoKit(r) {
    const partes = [
        r.bateria_codigo || r.bateria_serie ? `<span title="Bateria${r.bateria_serie ? ' · série ' + escaparHTML(r.bateria_serie) : ''}"><i class="fa-solid fa-battery-full"></i> ${escaparHTML(r.bateria_codigo || r.bateria_serie)}</span>` : '',
        r.bateria_reserva_codigo || r.bateria_reserva_serie ? `<span title="Bateria reserva${r.bateria_reserva_serie ? ' · série ' + escaparHTML(r.bateria_reserva_serie) : ''}"><i class="fa-solid fa-battery-half"></i> ${escaparHTML(r.bateria_reserva_codigo || r.bateria_reserva_serie)}</span>` : '',
        r.carregador_codigo || r.carregador_serie ? `<span title="Base carregadora${r.carregador_serie ? ' · série ' + escaparHTML(r.carregador_serie) : ''}"><i class="fa-solid fa-plug"></i> ${escaparHTML(r.carregador_codigo || r.carregador_serie)}</span>` : ''
    ].filter(Boolean);
    return partes.length ? `<small class="celula-sub kit-radio">${partes.join('')}</small>` : '';
}

async function carregarRadios() {
    carregarModelosRadio().catch(() => {});
    try {
        radios = await buscarTodasLinhas(() =>
            supabaseClient.from('vw_radios').select('*').order('identificacao', { ascending: true, nullsFirst: false }).order('numero_serie')
        );
    } catch (erro) {
        console.warn('Rádios indisponíveis:', erro?.message || erro);
        radios = [];
        const tbody = document.getElementById('listaRadios');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
                ${/does not exist|Could not find/i.test(erro?.message || '') ? 'Execute a migração v6 no Supabase para ativar os rádios.' : 'Não foi possível carregar os rádios.'}
            </td></tr>`;
        }
        return;
    }

    radiosSelecionados = new Set([...radiosSelecionados].filter(id => radios.some(r => Number(r.id) === id)));
    popularFiltrosRadios();
    popularListasRadios();
    renderizarRadios();
}

function abrirRadios() {
    abrirTela('radiosTela', document.getElementById('menuRadios'));
}

function valoresUnicos(campo) {
    const mapa = new Map();
    radios.forEach(r => {
        const valor = String(r[campo] || '').trim();
        if (valor) mapa.set(normalizarTexto(valor), valor);
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function popularFiltrosRadios() {
    const select = document.getElementById('filtroSetorRadio');
    if (!select) return;
    const atual = select.value;
    select.innerHTML = '<option value="">Todos os setores</option>' +
        valoresUnicos('setor').map(s => `<option value="${escaparHTML(s)}">${escaparHTML(s)}</option>`).join('');
    if ([...select.options].some(o => o.value === atual)) select.value = atual;
}

function popularListasRadios() {
    const garantir = id => {
        let lista = document.getElementById(id);
        if (!lista) {
            lista = Object.assign(document.createElement('datalist'), { id });
            document.body.appendChild(lista);
        }
        return lista;
    };
    garantir('dlSetoresRadio').innerHTML = valoresUnicos('setor').map(v => `<option value="${escaparHTML(v)}">`).join('');
    garantir('dlResponsaveisRadio').innerHTML = valoresUnicos('responsavel_nome').map(v => `<option value="${escaparHTML(v)}">`).join('');
    garantir('dlModelosRadio').innerHTML = valoresUnicos('modelo').map(v => `<option value="${escaparHTML(v)}">`).join('');
    garantir('dlMarcasRadio').innerHTML = valoresUnicos('marca').map(v => `<option value="${escaparHTML(v)}">`).join('');
}

function radiosFiltrados() {
    const busca = normalizarTexto(document.getElementById('buscaRadio')?.value);
    const setor = document.getElementById('filtroSetorRadio')?.value || '';
    const situacao = document.getElementById('filtroSituacaoRadio')?.value || '';
    const status = document.getElementById('filtroStatusRadio')?.value || '';

    return radios.filter(r =>
        (!setor || normalizarTexto(r.setor) === normalizarTexto(setor)) &&
        (!situacao || r.situacao_termo === situacao) &&
        (!status || r.status === status) &&
        (!busca || busca.split(' ').every(parte => normalizarTexto(
            [r.numero_serie, r.identificacao, r.marca, r.modelo, r.setor, r.responsavel_nome, nomeLocal(r.local_id), ...camposKit(r)].join(' ')
        ).includes(parte)))
    );
}

function renderizarRadios() {
    const tbody = document.getElementById('listaRadios');
    if (!tbody) return;

    const gestao = podeAdministrar();
    const lista = radiosFiltrados();

    const contar = s => radios.filter(r => r.situacao_termo === s).length;
    definirTexto('radiosTotal', numero.format(radios.length));
    definirTexto('radiosAssinados', numero.format(contar('ASSINADO')));
    definirTexto('radiosPendentes', numero.format(contar('PENDENTE') + contar('EXPIRADO')));
    definirTexto('radiosSemTermo', numero.format(contar('SEM_TERMO')));
    definirTexto('radiosListados', numero.format(lista.length));

    atualizarBarraSelecaoRadios();

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-walkie-talkie"></i>
            ${radios.length ? 'Nenhum rádio com esses filtros.' : 'Nenhum rádio cadastrado ainda.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(r => {
        const situacao = SITUACAO_TERMO[r.situacao_termo] || SITUACAO_TERMO.SEM_TERMO;
        const marcado = radiosSelecionados.has(Number(r.id));
        const dataTermo = r.situacao_termo === 'ASSINADO' && r.termo_assinado_em
            ? `<small class="celula-sub">em ${dataCurta(r.termo_assinado_em)}</small>`
            : (r.situacao_termo === 'PENDENTE' && r.termo_expira_em ? `<small class="celula-sub">link válido até ${dataCurta(r.termo_expira_em)}</small>` : '');

        let acaoTermo = '';
        if (gestao && r.responsavel_nome) {
            if (r.situacao_termo === 'ASSINADO' && r.termo_token) {
                acaoTermo = `<button type="button" class="btn-icon" title="Ver termo assinado" onclick="abrirLinkTermo('${escaparHTML(r.termo_token)}')">
                    <i class="fa-solid fa-file-circle-check"></i></button>`;
            } else if (r.situacao_termo === 'PENDENTE' && r.termo_token) {
                acaoTermo = `<button type="button" class="btn-icon btn-destaque" title="Enviar link do termo" onclick="mostrarLinkTermo('${escaparHTML(r.termo_token)}', ${Number(r.id)})">
                    <i class="fa-solid fa-share-from-square"></i></button>`;
            } else {
                acaoTermo = `<button type="button" class="btn-icon btn-destaque" title="Gerar termo" onclick="gerarTermoDoResponsavel(${Number(r.id)})">
                    <i class="fa-solid fa-file-signature"></i></button>`;
            }
        }

        return `
            <tr class="${marcado ? 'linha-selecionada' : ''}">
                ${gestao ? `<td class="col-check"><input type="checkbox" aria-label="Selecionar rádio" ${marcado ? 'checked' : ''}
                    onchange="alternarSelecaoRadio(${Number(r.id)}, this.checked)"></td>` : ''}
                <td>
                    <strong>${escaparHTML(r.identificacao || r.numero_serie)}</strong>
                    <small class="celula-sub serie">${r.identificacao ? `Série ${escaparHTML(r.numero_serie)} · ` : ''}${escaparHTML([r.marca, r.modelo].filter(Boolean).join(' ') || '—')}</small>
                    ${resumoKit(r)}
                </td>
                <td>${escaparHTML(r.setor || '—')}${r.local_id ? `<small class="celula-sub">${escaparHTML(nomeLocal(r.local_id))}</small>` : ''}</td>
                <td>${r.responsavel_nome
                        ? `<strong>${escaparHTML(r.responsavel_nome)}</strong>${r.responsavel_telefone ? `<small class="celula-sub">${escaparHTML(formatarTelefone(r.responsavel_telefone))}</small>` : ''}`
                        : '<span class="texto-suave">Sem responsável</span>'}</td>
                <td><span class="status-badge ${classeStatusRadio(r.status)}">${escaparHTML(r.status)}</span></td>
                <td><span class="status-badge ${situacao.classe}"><i class="fa-solid ${situacao.icone}"></i> ${situacao.texto}</span>${dataTermo}</td>
                <td>
                    <div class="acoes-tabela">
                        ${acaoTermo}
                        ${gestao ? `<button type="button" class="btn-icon" title="Editar rádio" onclick="abrirRadio(${Number(r.id)})">
                            <i class="fa-solid fa-pen"></i></button>` : ''}
                        ${gestao && r.responsavel_nome ? `<button type="button" class="btn-icon" title="Registrar devolução" onclick="devolverRadio(${Number(r.id)})">
                            <i class="fa-solid fa-rotate-left"></i></button>` : ''}
                    </div>
                </td>
            </tr>`;
    }).join('');

    const todos = document.getElementById('selecionarTodosRadios');
    if (todos) todos.checked = lista.length > 0 && lista.every(r => radiosSelecionados.has(Number(r.id)));
}

function classeStatusRadio(status) {
    return { 'Ativo': 'ativo', 'Reserva': 'neutro', 'Em manutenção': 'manutencao', 'Extraviado': 'extraviado', 'Baixado': 'baixado' }[status] || '';
}

/* =========================================================
   SELEÇÃO (gerar um termo para vários rádios)
========================================================= */

function alternarSelecaoRadio(id, marcado) {
    if (marcado) radiosSelecionados.add(Number(id));
    else radiosSelecionados.delete(Number(id));
    renderizarRadios();
}

function alternarTodosRadios(marcado) {
    radiosFiltrados().forEach(r => marcado ? radiosSelecionados.add(Number(r.id)) : radiosSelecionados.delete(Number(r.id)));
    renderizarRadios();
}

function atualizarBarraSelecaoRadios() {
    const barra = document.getElementById('barraSelecaoRadios');
    if (!barra) return;
    const qtd = radiosSelecionados.size;
    barra.hidden = qtd === 0 || !podeAdministrar();
    definirTexto('radiosSelecionadosQtd', `${qtd} rádio(s) selecionado(s)`);
}

function limparSelecaoRadios() {
    radiosSelecionados.clear();
    renderizarRadios();
}


/* =========================================================
   CADASTRO / EDIÇÃO
========================================================= */

function camposRadio(r = {}) {
    return [
        { id: 'numero_serie', rotulo: 'Número de série', valor: r.numero_serie, obrigatorio: true, placeholder: 'Ex.: 872TQA1234' },
        { id: 'identificacao', rotulo: 'Identificação', valor: r.identificacao, placeholder: 'Ex.: HT-07, Portaria 2',
          ajuda: 'Como o rádio é chamado no dia a dia (opcional).' },
        campoModeloRadio(r),
        { id: 'setor', rotulo: 'Setor', valor: r.setor, lista: 'dlSetoresRadio', placeholder: 'Ex.: Segurança' },
        { id: 'local_id', rotulo: 'Local (opcional)', tipo: 'select', valor: r.local_id || '',
          opcoes: [{ valor: '', texto: 'Não informado' }, ...LOCAIS.map(l => ({ valor: l.id, texto: l.nome }))] },
        { id: 'responsavel_nome', rotulo: 'Responsável (quem assina o termo)', valor: r.responsavel_nome, lista: 'dlResponsaveisRadio',
          placeholder: 'Nome completo' },
        { id: 'responsavel_telefone', rotulo: 'Celular do responsável', valor: formatarTelefone(r.responsavel_telefone),
          placeholder: '(11) 98888-7777', ajuda: 'Usado para enviar o link do termo pelo WhatsApp.' },
        { id: 'status', rotulo: 'Status', tipo: 'select', valor: r.status || 'Ativo', opcoes: STATUS_RADIO.map(s => ({ valor: s, texto: s })) },
        { id: 'titulo_kit', tipo: 'html', html: '<p class="form-subtitulo-kit"><i class="fa-solid fa-battery-full"></i> Acessórios que acompanham o rádio</p>' },
        { id: 'bateria_codigo', rotulo: 'Bateria · número', valor: r.bateria_codigo, placeholder: 'Ex.: 00201' },
        { id: 'bateria_serie', rotulo: 'Bateria · nº de série', valor: r.bateria_serie, placeholder: 'Ex.: 24N2802466' },
        { id: 'bateria_reserva_codigo', rotulo: 'Bateria reserva · número', valor: r.bateria_reserva_codigo, placeholder: 'Ex.: 00301' },
        { id: 'bateria_reserva_serie', rotulo: 'Bateria reserva · nº de série', valor: r.bateria_reserva_serie, placeholder: 'Ex.: 2430901996' },
        { id: 'carregador_codigo', rotulo: 'Base carregadora · número', valor: r.carregador_codigo, placeholder: 'Ex.: 00101' },
        { id: 'carregador_serie', rotulo: 'Base carregadora · nº de série', valor: r.carregador_serie, placeholder: 'Ex.: 24N28G2551' },
        { id: 'observacao', rotulo: 'Observação', tipo: 'textarea', valor: r.observacao, largo: true,
          placeholder: 'Acessórios, estado de conservação, canal programado...' }
    ];
}

/* Marca e modelo numa lista só; o padrão já vem escolhido no cadastro novo. */
function campoModeloRadio(r = {}) {
    const opcoes = modelosRadio.map((m, i) => ({
        valor: chaveModelo(m.marca, m.modelo),
        texto: textoModelo(m) + (i === 0 && modelosRadio.length > 1 ? ' (padrão)' : '')
    }));
    const atual = (r.marca || r.modelo) ? chaveModelo(r.marca, r.modelo) : opcoes[0]?.valor || '';
    if (atual && !opcoes.some(o => o.valor === atual)) {
        opcoes.push({ valor: atual, texto: `${textoModelo(r)} (cadastrado antes)` });
    }
    return {
        id: 'modelo_radio', rotulo: 'Marca e modelo', tipo: 'select', valor: atual, largo: true,
        opcoes: [...opcoes, { valor: '', texto: 'Não informado' }],
        ajuda: podeAdministrar() ? 'Falta algum modelo? Use o botão "Modelos de rádio".' : ''
    };
}

function dadosRadio(v) {
    const [marca, modelo] = String(v.modelo_radio || '|').split('|');
    return {
        numero_serie: v.numero_serie,
        identificacao: v.identificacao || null,
        marca: marca || null,
        modelo: modelo || null,
        setor: v.setor || null,
        local_id: v.local_id ? Number(v.local_id) : null,
        responsavel_nome: v.responsavel_nome || null,
        responsavel_telefone: v.responsavel_telefone || null,
        status: v.status || 'Ativo',
        observacao: v.observacao || null,
        ...(v.bateria_codigo !== undefined ? {
            bateria_codigo: v.bateria_codigo || null,
            bateria_serie: v.bateria_serie || null,
            bateria_reserva_codigo: v.bateria_reserva_codigo || null,
            bateria_reserva_serie: v.bateria_reserva_serie || null,
            carregador_codigo: v.carregador_codigo || null,
            carregador_serie: v.carregador_serie || null
        } : {})
    };
}

function erroRadio(erro) {
    if (erro?.code === '23505' || /ux_radios_serie/.test(erro?.message || '')) return 'Já existe um rádio com esse número de série.';
    return traduzirErro(erro);
}

function novoRadio() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador cadastra rádios.', 'erro');
    abrirFormulario({
        titulo: 'Novo rádio HT',
        subtitulo: 'Depois de salvar, gere o termo para o responsável assinar.',
        textoSalvar: 'Cadastrar rádio',
        campos: camposRadio(),
        aoSalvar: async valores => {
            const { error } = await supabaseClient.from('radios').insert([dadosRadio(valores)]);
            if (error) throw new Error(erroRadio(error));
            await carregarRadios();
            avisar(`Rádio ${valores.identificacao || valores.numero_serie} cadastrado.`);
        }
    });
}

function abrirRadio(id) {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador edita rádios.', 'erro');
    const r = radios.find(x => Number(x.id) === Number(id));
    if (!r) return;

    abrirFormulario({
        titulo: `Rádio ${r.identificacao || r.numero_serie}`,
        subtitulo: r.situacao_termo === 'ASSINADO'
            ? `Termo assinado por ${r.responsavel_nome}. Se trocar o responsável, gere um novo termo.`
            : 'Editar dados do rádio.',
        campos: camposRadio(r),
        aoSalvar: async valores => {
            const { error } = await supabaseClient.from('radios').update(dadosRadio(valores)).eq('id', id);
            if (error) throw new Error(erroRadio(error));
            const trocou = normalizarTexto(valores.responsavel_nome) !== normalizarTexto(r.responsavel_nome);
            await carregarRadios();
            avisar(trocou && valores.responsavel_nome
                ? 'Responsável alterado. Gere o termo para o novo responsável assinar.'
                : 'Rádio atualizado.', trocou ? 'info' : 'sucesso');
        }
    });
}

async function devolverRadio(id) {
    if (!podeAdministrar()) return;
    const r = radios.find(x => Number(x.id) === Number(id));
    if (!r) return;
    if (!(await confirmar({
        titulo: `Devolução do rádio ${r.identificacao || r.numero_serie}`,
        mensagem: `${r.responsavel_nome} está devolvendo o rádio?\n\nO rádio fica sem responsável e como "Reserva". O termo assinado continua guardado.`,
        textoConfirmar: 'Registrar devolução'
    }))) return;

    const { error } = await supabaseClient.from('radios')
        .update({ responsavel_nome: null, responsavel_telefone: null, status: 'Reserva' }).eq('id', id);
    if (error) return avisar(traduzirErro(error), 'erro');
    await carregarRadios();
    avisar('Devolução registrada.');
}


/* =========================================================
   TERMO
========================================================= */

function linkDoTermo(token) {
    const base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    return `${base}termo.html?t=${encodeURIComponent(token)}`;
}

function abrirLinkTermo(token) {
    window.open(linkDoTermo(token), '_blank', 'noopener');
}

function gerarTermoDoResponsavel(id) {
    const base = radios.find(x => Number(x.id) === Number(id));
    if (!base?.responsavel_nome) return avisar('Informe o responsável do rádio antes de gerar o termo.', 'erro');
    const doMesmo = radios.filter(r => normalizarTexto(r.responsavel_nome) === normalizarTexto(base.responsavel_nome));
    confirmarGerarTermo(doMesmo, doMesmo.filter(r => r.situacao_termo !== 'ASSINADO' || Number(r.id) === Number(id)));
}

function gerarTermoSelecionados() {
    const lista = radios.filter(r => radiosSelecionados.has(Number(r.id)));
    if (!lista.length) return;
    if (lista.some(r => !r.responsavel_nome)) return avisar('Há rádio selecionado sem responsável.', 'erro');
    const nomes = new Set(lista.map(r => normalizarTexto(r.responsavel_nome)));
    if (nomes.size > 1) return avisar('Um termo é por pessoa: selecione rádios do mesmo responsável.', 'erro');
    confirmarGerarTermo(lista, lista);
}

function confirmarGerarTermo(opcoes, marcados) {
    const marcadosIds = new Set(marcados.map(r => Number(r.id)));
    const responsavel = opcoes[0].responsavel_nome;

    abrirFormulario({
        titulo: 'Gerar termo de responsabilidade',
        subtitulo: `Responsável: ${responsavel}. Escolha os rádios que entram neste termo.`,
        textoSalvar: 'Gerar termo e link',
        campos: [
            ...opcoes.map(r => ({
                id: `radio_${r.id}`, tipo: 'checkbox', largo: true, valor: marcadosIds.has(Number(r.id)),
                rotulo: `${r.identificacao ? r.identificacao + ' · ' : ''}Série ${r.numero_serie}${r.modelo ? ' · ' + r.modelo : ''}` +
                        (r.situacao_termo === 'ASSINADO' ? '  (já tem termo assinado)' : '')
            })),
            { id: 'validade', rotulo: 'Validade do link (dias)', tipo: 'number', min: 1, step: '1', valor: 30,
              ajuda: 'Depois disso o link expira e é preciso gerar outro.' }
        ],
        aoSalvar: async valores => {
            const ids = opcoes.filter(r => valores[`radio_${r.id}`]).map(r => Number(r.id));
            if (!ids.length) throw new Error('Marque pelo menos um rádio.');

            const { data, error } = await supabaseClient.rpc('gerar_termo_radios', {
                p_radio_ids: ids, p_validade_dias: Math.round(valores.validade || 30)
            });
            if (error) throw error;

            radiosSelecionados.clear();
            await carregarRadios();
            setTimeout(() => mostrarLinkTermo(data.token, ids[0]), 50);
        }
    });
}

function mostrarLinkTermo(token, radioId) {
    const r = radios.find(x => Number(x.id) === Number(radioId)) || {};
    const link = linkDoTermo(token);
    const primeiroNome = String(r.responsavel_nome || '').split(' ')[0];
    const mensagem = `Olá${primeiroNome ? ', ' + primeiroNome : ''}! Segue o termo de responsabilidade do(s) rádio(s) HT sob sua guarda. ` +
                     `Por favor, leia e assine pelo link: ${link}`;
    const telefone = String(r.responsavel_telefone || '').replace(/\D/g, '');
    const whatsapp = `https://wa.me/${telefone ? (telefone.length <= 11 ? '55' + telefone : telefone) : ''}?text=${encodeURIComponent(mensagem)}`;
    const email = `mailto:?subject=${encodeURIComponent('Termo de responsabilidade — Rádio HT')}&body=${encodeURIComponent(mensagem)}`;

    abrirFormulario({
        titulo: 'Link do termo pronto',
        subtitulo: `Envie para ${r.responsavel_nome || 'o responsável'}. A pessoa assina pelo celular, sem precisar de login.`,
        textoSalvar: 'Concluir',
        semCancelar: true,
        campos: [{
            id: 'link', tipo: 'html', html: `
                <div class="link-termo">
                    <input type="text" id="campoLinkTermo" readonly value="${escaparHTML(link)}" onclick="this.select()">
                    <div class="link-termo-acoes">
                        <button type="button" class="btn-primary" onclick="copiarLinkTermo()"><i class="fa-solid fa-copy"></i> Copiar link</button>
                        <a class="btn-secondary" href="${escaparHTML(whatsapp)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
                        <a class="btn-secondary" href="${escaparHTML(email)}"><i class="fa-solid fa-envelope"></i> E-mail</a>
                        <a class="btn-secondary" href="${escaparHTML(link)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir</a>
                    </div>
                    ${telefone ? '' : '<small>Sem celular cadastrado: no WhatsApp, escolha o contato manualmente.</small>'}
                </div>`
        }],
        aoSalvar: async () => {}
    });
}

async function copiarLinkTermo() {
    const campo = document.getElementById('campoLinkTermo');
    if (!campo) return;
    try {
        await navigator.clipboard.writeText(campo.value);
    } catch {
        campo.select();
        document.execCommand('copy');
    }
    avisar('Link copiado.');
}

async function editarModeloTermo() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador edita o modelo.', 'erro');

    const { data, error } = await supabaseClient.from('configuracoes').select('valor').eq('chave', 'termo_radio_modelo').maybeSingle();
    if (error) return avisar(traduzirErro(error), 'erro');

    abrirFormulario({
        titulo: 'Modelo do termo',
        subtitulo: 'Vale para os próximos termos gerados. Os já gerados não mudam.',
        textoSalvar: 'Salvar modelo',
        campos: [
            { id: 'ajuda', tipo: 'html', html: `<p class="modelo-ajuda">Campos automáticos:
                <code>{{nome}}</code> <code>{{cpf}}</code> <code>{{setor}}</code> <code>{{radios}}</code> <code>{{data}}</code>.
                Recomendamos validar o texto com o RH/Jurídico.</p>` },
            { id: 'valor', rotulo: 'Texto do termo', tipo: 'textarea', valor: data?.valor || '', obrigatorio: true, largo: true }
        ],
        aoSalvar: async ({ valor }) => {
            const faltando = ['{{nome}}', '{{cpf}}', '{{radios}}', '{{data}}'].filter(m => !valor.includes(m));
            if (faltando.length) throw new Error(`O texto precisa conter: ${faltando.join(', ')}.`);
            const { data: salvo, error: erroSalvar } = await supabaseClient.from('configuracoes')
                .update({ valor }).eq('chave', 'termo_radio_modelo').select('chave');
            if (erroSalvar) throw erroSalvar;
            if (!salvo?.length) throw new Error('Seu perfil não tem permissão para esta operação.');
            avisar('Modelo do termo atualizado.');
        }
    });

    const area = document.getElementById('mcCampo_valor');
    if (area) area.rows = 18;
}


/* =========================================================
   MODELOS DE RÁDIO (lista padrão dos clubes)
========================================================= */

let modelosEmEdicao = [];

function htmlListaModelos() {
    if (!modelosEmEdicao.length) return '<p class="modelos-vazio">Nenhum modelo. Adicione pelo menos um abaixo.</p>';
    return modelosEmEdicao.map((m, i) => `
        <div class="modelo-radio-linha">
            <span><strong>${escaparHTML(textoModelo(m))}</strong>
                ${i === 0 ? '<em class="modelo-padrao">Padrão do cadastro</em>' : ''}</span>
            <span class="modelo-radio-acoes">
                ${i > 0 ? `<button type="button" class="btn-link" onclick="tornarModeloPadrao(${i})">Tornar padrão</button>` : ''}
                <button type="button" class="btn-icon btn-excluir" title="Remover da lista" aria-label="Remover"
                        onclick="removerModeloRadio(${i})"><i class="fa-solid fa-xmark"></i></button>
            </span>
        </div>`).join('');
}

function redesenharModelos() {
    const area = document.getElementById('listaModelosRadio');
    if (area) area.innerHTML = htmlListaModelos();
}

function tornarModeloPadrao(indice) {
    const [modelo] = modelosEmEdicao.splice(indice, 1);
    modelosEmEdicao.unshift(modelo);
    redesenharModelos();
}

function removerModeloRadio(indice) {
    modelosEmEdicao.splice(indice, 1);
    redesenharModelos();
}

async function editarModelosRadio() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador edita os modelos.', 'erro');
    await carregarModelosRadio();
    modelosEmEdicao = modelosRadio.map(m => ({ ...m }));

    abrirFormulario({
        titulo: 'Modelos de rádio',
        subtitulo: 'Marca e modelo usados nos clubes. O primeiro da lista já vem escolhido no cadastro de rádio.',
        textoSalvar: 'Salvar lista',
        campos: [
            { id: 'lista', tipo: 'html', html: `<div id="listaModelosRadio" class="modelos-radio">${htmlListaModelos()}</div>` },
            { id: 'nova_marca', rotulo: 'Adicionar: marca', placeholder: 'Ex.: Kytera' },
            { id: 'novo_modelo', rotulo: 'Adicionar: modelo', placeholder: 'Ex.: BP516 U(I)' }
        ],
        aoSalvar: async ({ nova_marca, novo_modelo }) => {
            const lista = [...modelosEmEdicao];
            if (nova_marca || novo_modelo) {
                if (!nova_marca || !novo_modelo) throw new Error('Para adicionar, preencha a marca e o modelo.');
                if (lista.some(m => normalizarTexto(textoModelo(m)) === normalizarTexto(`${nova_marca} ${novo_modelo}`))) {
                    throw new Error('Esse modelo já está na lista.');
                }
                lista.push({ marca: nova_marca, modelo: novo_modelo });
            }
            if (!lista.length) throw new Error('Deixe pelo menos um modelo na lista.');

            const { data, error } = await supabaseClient.from('configuracoes')
                .update({ valor: JSON.stringify(lista) }).eq('chave', 'radio_modelos').select('chave');
            if (error) throw new Error(traduzirErro(error));
            if (!data?.length) throw new Error('Rode a atualização v9 no Supabase para salvar a lista de modelos.');

            modelosRadio = lista;
            avisar('Lista de modelos salva.');
        }
    });
}

/* =========================================================
   15 · SEGURANÇA
   · Conferência de integridade do histórico.
   · Cópia de segurança de todos os dados.
========================================================= */

/* ---------------- Integridade do histórico ---------------- */

async function verificarIntegridade() {
    const botao = document.getElementById('btnVerificarIntegridade');
    const status = document.getElementById('statusIntegridade');
    if (!status) return;

    botao && (botao.disabled = true);
    status.className = 'integridade-status';
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conferindo cada registro...';

    try {
        const { data, error } = await supabaseClient.rpc('verificar_integridade');
        if (error) throw error;

        const quando = new Date(data.verificado_em).toLocaleString('pt-BR');
        if (data.ok) {
            status.classList.add('integridade-ok');
            status.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                <span><b>Histórico íntegro.</b> ${numero.format(data.registros)} registros conferidos em ${escaparHTML(quando)}.
                <br>Código atual da corrente: <code>${escaparHTML(String(data.ultimo_codigo).slice(0, 16))}</code></span>`;
        } else {
            status.classList.add('integridade-falha');
            const linhas = (data.problemas || []).map(p =>
                `<li>${p.termo ? `Termo nº ${escaparHTML(p.termo)}` : `Registro nº ${escaparHTML(p.registro)}`}: ${escaparHTML(p.problema)}</li>`
            ).join('');
            status.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
                <span><b>Atenção: o histórico foi alterado fora do sistema.</b> Conferido em ${escaparHTML(quando)}.
                <ul>${linhas}</ul></span>`;
        }
    } catch (erro) {
        console.error('ERRO INTEGRIDADE:', erro);
        status.classList.add('integridade-falha');
        status.textContent = traduzirErro(erro);
    } finally {
        botao && (botao.disabled = false);
    }
}


/* ---------------- Cópia de segurança ---------------- */

const TABELAS_COPIA = ['locais', 'subsetores', 'produtos', 'itens', 'movimentacoes', 'auditoria',
    'usuarios', 'radios', 'termos', 'termo_radios', 'configuracoes'];

/* Tabelas sem coluna "id": ordenadas pela chave delas (paginação estável). */
const ORDEM_COPIA = { termo_radios: 'termo_id', configuracoes: 'chave' };

async function baixarCopiaSeguranca() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador.', 'erro');
    const botao = document.getElementById('btnCopiaSeguranca');
    const status = document.getElementById('statusCopia');
    botao && (botao.disabled = true);

    try {
        const copia = { sistema: 'Inventário Central — Grupo Monte Carlo', gerada_em: new Date().toISOString(),
                        gerada_por: nomeUsuarioLogado || usuarioLogado?.email || '', tabelas: {} };
        for (const tabela of TABELAS_COPIA) {
            status && (status.textContent = `Lendo ${tabela}...`);
            const ordem = ORDEM_COPIA[tabela] || 'id';
            copia.tabelas[tabela] = await buscarTodasLinhas(() => supabaseClient.from(tabela).select('*').order(ordem));
        }

        const arquivo = new Blob([JSON.stringify(copia, null, 1)], { type: 'application/json' });
        const link = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(arquivo),
            download: `inventario-monte-carlo-copia-${hojeISO()}.json`
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);

        const total = Object.values(copia.tabelas).reduce((soma, linhas) => soma + linhas.length, 0);
        status && (status.textContent = `Cópia baixada: ${numero.format(total)} registros em ${TABELAS_COPIA.length} tabelas.`);
    } catch (erro) {
        console.error('ERRO CÓPIA:', erro);
        status && (status.textContent = 'Não foi possível gerar a cópia: ' + traduzirErro(erro));
    } finally {
        botao && (botao.disabled = false);
    }
}

/* =========================================================
   16 · NAVEGAÇÃO
   · Barra de botões no rodapé do celular
   · Busca geral no topo (peças, locais, setores e rádios)
   · Atualização automática dos dados
========================================================= */


/* ---------------- Barra inferior (celular) ---------------- */

function botoesBarraInferior() {
    const opera = podeMovimentar();
    return [
        { tela: 'ondeEstaTela', icone: 'fa-magnifying-glass-location', texto: 'Procurar', acao: 'abrirOndeEsta()' },
        opera
            ? { tela: 'movimentacaoTela', icone: 'fa-right-left', texto: 'Mover', acao: 'abrirMoverPecas()' }
            : { tela: 'foraLugarTela', icone: 'fa-arrow-right-arrow-left', texto: 'Fora do lugar', acao: 'abrirForaDoLugar()' },
        opera
            ? { tela: 'cadastroTela', icone: 'fa-box-open', texto: 'Cadastrar', acao: "abrirTela('cadastroTela', document.getElementById('menuCadastro'))" }
            : { tela: 'estoqueTela', icone: 'fa-warehouse', texto: 'Inventário', acao: "abrirTela('estoqueTela', document.getElementById('menuEstoque'))" },
        { tela: 'radiosTela', icone: 'fa-walkie-talkie', texto: 'Rádios', acao: 'abrirRadios()' },
        { tela: null, icone: 'fa-bars', texto: 'Menu', acao: 'toggleSidebar()' }
    ];
}

function atualizarBarraInferior() {
    let barra = document.getElementById('barraInferior');
    if (!usuarioLogado) {
        barra?.remove();
        document.body.classList.remove('com-barra-inferior');
        return;
    }
    if (!barra) {
        barra = Object.assign(document.createElement('nav'), { id: 'barraInferior', className: 'barra-inferior' });
        barra.setAttribute('aria-label', 'Atalhos');
        document.body.appendChild(barra);
    }
    barra.innerHTML = botoesBarraInferior().map(botao => `
        <button type="button" data-tela="${botao.tela || ''}" onclick="${botao.acao}">
            <i class="fa-solid ${botao.icone}"></i><span>${botao.texto}</span>
        </button>`).join('');
    document.body.classList.add('com-barra-inferior');
    marcarBarraInferior();
}

function marcarBarraInferior() {
    const atual = document.querySelector('.tela.activeTela')?.id;
    document.querySelectorAll('#barraInferior button').forEach(botao => {
        botao.classList.toggle('active', Boolean(botao.dataset.tela) && botao.dataset.tela === atual);
    });
}

function abrirMoverPecas() {
    if (!podeMovimentar()) return avisar('Seu perfil não pode mover peças.', 'erro');
    abrirTela('movimentacaoTela', document.getElementById('menuMovimentacao'));
    limparFormularioMovimentacao();
}


/* ---------------- Busca geral ---------------- */

const LIMITE_BUSCA_GERAL = 6;
let radiosPedidosParaBusca = false;

function resultadosBuscaGeral(texto) {
    const termo = normalizarTexto(texto);
    if (termo.length < 2) return [];
    const bate = (...campos) => normalizarTexto(campos.filter(Boolean).join(' ')).includes(termo);
    const grupos = [];

    // Peças: agrupadas pelo nome, com o total e em quantos lugares estão.
    const pecas = new Map();
    itens.filter(item => quantidadeItem(item) > 0 && bate(item.nome, item.tipo, item.onde_fica)).forEach(item => {
        const chave = chaveNome(item.nome);
        const atual = pecas.get(chave) || { nome: item.nome, total: 0, lugares: new Set(), foto: fotoDoItem(item) };
        atual.total += quantidadeItem(item);
        atual.lugares.add(lugarDoItem(item));
        pecas.set(chave, atual);
    });
    const listaPecas = [...pecas.values()].sort((a, b) => compararTexto(a.nome, b.nome));
    if (listaPecas.length) {
        grupos.push({
            titulo: 'Peças', total: listaPecas.length,
            itens: listaPecas.slice(0, LIMITE_BUSCA_GERAL).map(p => ({
                icone: 'fa-couch', foto: p.foto, titulo: p.nome,
                detalhe: `${numero.format(p.total)} peça(s) · ${p.lugares.size === 1 ? [...p.lugares][0] : `${p.lugares.size} lugares`}`,
                acao: () => abrirOndeEsta(p.nome)
            }))
        });
    }

    // Locais e setores: mostram o que há lá no "Onde está?".
    const locais = LOCAIS.filter(local => bate(local.nome)).map(local => ({
        icone: 'fa-location-dot', titulo: local.nome,
        detalhe: `${numero.format(itens.filter(i => Number(i.local_id) === Number(local.id)).reduce((t, i) => t + quantidadeItem(i), 0))} peça(s) neste local`,
        acao: () => abrirLocalNaBusca(local.id)
    }));
    const setores = subsetores.filter(s => s.ativo !== false && bate(s.nome)).map(s => ({
        icone: 'fa-door-open', titulo: `${nomeLocal(s.local_id)} / ${s.nome}`,
        detalhe: `${numero.format(itens.filter(i => Number(i.subsetor_id) === Number(s.id)).reduce((t, i) => t + quantidadeItem(i), 0))} peça(s) neste setor`,
        acao: () => abrirLocalNaBusca(s.local_id, s.nome)
    }));
    const lugares = [...locais, ...setores];
    if (lugares.length) grupos.push({ titulo: 'Locais e setores', total: lugares.length, itens: lugares.slice(0, LIMITE_BUSCA_GERAL) });

    // Rádios: número de série, identificação ou responsável.
    const listaRadios = radios.filter(r => bate(r.numero_serie, r.identificacao, r.responsavel_nome, r.setor, ...camposKit(r)));
    if (listaRadios.length) {
        grupos.push({
            titulo: 'Rádios', total: listaRadios.length,
            itens: listaRadios.slice(0, LIMITE_BUSCA_GERAL).map(r => ({
                icone: 'fa-walkie-talkie', titulo: [r.identificacao, r.numero_serie].filter(Boolean).join(' · '),
                detalhe: r.responsavel_nome ? `Com ${r.responsavel_nome}${r.setor ? ` · ${r.setor}` : ''}` : (r.status || 'Sem responsável'),
                acao: () => abrirRadioNaBusca(texto)
            }))
        });
    }
    return grupos;
}

function abrirLocalNaBusca(localId, textoSetor = '') {
    abrirOndeEsta(textoSetor);
    const filtro = document.getElementById('filtroLocalOndeEsta');
    if (filtro) {
        filtro.value = String(localId);
        renderizarOndeEsta();
    }
}

function abrirRadioNaBusca(texto) {
    const campo = document.getElementById('buscaRadio');
    if (campo) campo.value = texto;
    abrirRadios();
}

let acoesBuscaGeral = [];

function renderizarBuscaGeral() {
    const campo = document.getElementById('buscaGeral');
    const caixa = document.getElementById('resultadosBuscaGeral');
    if (!campo || !caixa) return;

    const texto = campo.value.trim();
    if (texto.length < 2) {
        caixa.hidden = true;
        return;
    }

    const grupos = resultadosBuscaGeral(texto);
    acoesBuscaGeral = [];

    if (!grupos.length) {
        caixa.innerHTML = `<div class="busca-geral-vazia"><i class="fa-solid fa-magnifying-glass"></i>
            Nada encontrado para "<b>${escaparHTML(texto)}</b>". Tente uma parte do nome.</div>`;
        caixa.hidden = false;
        return;
    }

    caixa.innerHTML = grupos.map(grupo => `
        <div class="busca-geral-grupo">
            <p>${escaparHTML(grupo.titulo)}${grupo.total > grupo.itens.length ? ` <small>(${grupo.itens.length} de ${grupo.total})</small>` : ''}</p>
            ${grupo.itens.map(item => {
                acoesBuscaGeral.push(item.acao);
                const indice = acoesBuscaGeral.length - 1;
                return `<button type="button" class="busca-geral-item" data-indice="${indice}" onmousedown="event.preventDefault()" onclick="escolherBuscaGeral(${indice})">
                    ${item.foto ? fotoPequena(item.foto, 'busca-geral-foto') : `<span class="busca-geral-foto"><i class="fa-solid ${item.icone}"></i></span>`}
                    <span><strong>${escaparHTML(item.titulo)}</strong><small>${escaparHTML(item.detalhe)}</small></span>
                </button>`;
            }).join('')}
        </div>`).join('');
    caixa.hidden = false;
}

function escolherBuscaGeral(indice) {
    const acao = acoesBuscaGeral[indice];
    fecharBuscaGeral(true);
    acao?.();
}

function fecharBuscaGeral(limpar = false) {
    const caixa = document.getElementById('resultadosBuscaGeral');
    if (caixa) caixa.hidden = true;
    if (limpar) {
        const campo = document.getElementById('buscaGeral');
        if (campo) { campo.value = ''; campo.blur(); }
    }
}

function ligarBuscaGeral() {
    const campo = document.getElementById('buscaGeral');
    if (!campo) return;
    let espera = null;
    campo.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(renderizarBuscaGeral, 120); });
    campo.addEventListener('focus', () => {
        // Os rádios só são carregados quando alguém abre a tela deles.
        if (!radios.length && !radiosPedidosParaBusca && usuarioLogado) {
            radiosPedidosParaBusca = true;
            carregarRadios().then(renderizarBuscaGeral).catch(() => {});
        }
        renderizarBuscaGeral();
    });
    campo.addEventListener('blur', () => setTimeout(() => fecharBuscaGeral(), 150));
    campo.addEventListener('keydown', evento => {
        if (evento.key === 'Escape') fecharBuscaGeral(true);
        if (evento.key === 'Enter') {
            evento.preventDefault();
            if (acoesBuscaGeral.length && !document.getElementById('resultadosBuscaGeral')?.hidden) escolherBuscaGeral(0);
        }
    });
}


/* ---------------- Atualização automática ----------------
   Os dados são recarregados quando a pessoa volta para a aba e,
   com a aba aberta, a cada 2 minutos. Assim o que outra pessoa
   moveu aparece sem precisar recarregar a página.
---------------------------------------------------------- */

const INTERVALO_ATUALIZACAO = 2 * 60 * 1000;
let ultimaAtualizacao = Date.now();
let atualizandoAgora = false;

async function atualizarDadosSeNecessario(forcar = false) {
    if (!usuarioLogado || atualizandoAgora || document.hidden) return;
    if (!forcar && Date.now() - ultimaAtualizacao < INTERVALO_ATUALIZACAO) return;
    // Não atrapalha quem está no meio de um formulário ou do assistente.
    if (!document.getElementById('mcModalForm')?.hidden && document.getElementById('mcModalForm')) return;
    if (document.querySelector('#movimentacaoTela.activeTela') && passoMov > 1) return;

    atualizandoAgora = true;
    try {
        await carregarDashboard();
        ultimaAtualizacao = Date.now();
    } catch (erro) {
        console.warn('Atualização automática falhou:', erro?.message || erro);
    } finally {
        atualizandoAgora = false;
    }
}

function ligarAtualizacaoAutomatica() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarDadosSeNecessario(); });
    window.addEventListener('focus', () => atualizarDadosSeNecessario());
    setInterval(() => atualizarDadosSeNecessario(), 30 * 1000);
}

/* =========================================================
   17 · IMPORTAR RÁDIOS DA PLANILHA
   1. A pessoa escolhe a planilha (.xlsx ou .csv).
   2. O navegador lê as colunas pelo nome (HT, SERIE, BATERIA…).
   3. O banco confere tudo (simulação) e mostra o que vai acontecer.
   4. Só depois de confirmar é que grava.
   Os números são copiados exatamente como estão na planilha.
========================================================= */

/* Nome da coluna (sem acento/espaço) → campo do rádio. */
const COLUNAS_PLANILHA_RADIOS = {
    identificacao: ['HT', 'IDENTIFICACAO', 'NUMEROHT', 'HTNUMERO'],
    numero_serie: ['SERIE', 'SERIERADIO', 'NUMERODESERIE', 'NSERIE', 'SERIEDORADIO'],
    bateria_codigo: ['BATERIA', 'BATERIAPRINCIPAL'],
    bateria_serie: ['SERIE2', 'SERIEBATERIA'],
    bateria_reserva_codigo: ['BATERIARESERVA', 'BATERIARESERVAS', 'RESERVA'],
    bateria_reserva_serie: ['SERIE3', 'SERIEBATERIARESERVA', 'SERIERESERVA'],
    carregador_codigo: ['BASECARREGADORA', 'CARREGADOR', 'BASE'],
    carregador_serie: ['SERIE4', 'SERIEBASE', 'SERIECARREGADOR'],
    setor: ['SETOR'],
    local: ['LOCAL', 'CLUBE', 'UNIDADE'],
    responsavel_nome: ['RESPONSAVEL', 'NOMEDORESPONSAVEL', 'NOME'],
    responsavel_telefone: ['CELULAR', 'TELEFONE', 'WHATSAPP'],
    status: ['STATUS', 'SITUACAO'],
    observacao: ['OBSERVACAO', 'OBS', 'OBSERVACOES'],
    marca: ['MARCA'],
    modelo: ['MODELO']
};

/* Colunas de "número" (HT, bateria…): o Excel às vezes tira os zeros da frente. */
const COLUNAS_CODIGO = ['identificacao', 'bateria_codigo', 'bateria_reserva_codigo', 'carregador_codigo'];

function chaveColuna(texto) {
    return normalizarTexto(texto).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function carregarLeitorPlanilha() {
    if (window.readXlsxFile) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = Object.assign(document.createElement('script'), { src: 'leitor-planilha.js' });
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Não foi possível carregar o leitor de planilhas (arquivo leitor-planilha.js).'));
        document.head.appendChild(script);
    });
}

function lerCsv(texto) {
    const separador = (texto.split('\n')[0].match(/;/g) || []).length >= (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const linhas = [];
    let linha = [], valor = '', aspas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (aspas) {
            if (c === '"' && texto[i + 1] === '"') { valor += '"'; i++; }
            else if (c === '"') aspas = false;
            else valor += c;
        } else if (c === '"') aspas = true;
        else if (c === separador) { linha.push(valor); valor = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && texto[i + 1] === '\n') i++;
            linha.push(valor); linhas.push(linha); linha = []; valor = '';
        } else valor += c;
    }
    if (valor || linha.length) { linha.push(valor); linhas.push(linha); }
    return linhas;
}

/* Devolve a tabela crua: [[cabeçalho...], [linha...], ...] da aba que tem a coluna SERIE. */
async function lerTabelaPlanilha(arquivo) {
    if (/\.(csv|txt)$/i.test(arquivo.name)) {
        return { aba: null, linhas: lerCsv((await arquivo.text()).replace(/^﻿/, '')) };
    }
    if (!/\.xlsx$/i.test(arquivo.name)) {
        throw new Error('Use uma planilha .xlsx (Excel) ou .csv. Arquivos .xls antigos: abra no Excel e salve como .xlsx.');
    }
    await carregarLeitorPlanilha();
    const abas = await window.readXlsxFile(arquivo);
    const lista = Array.isArray(abas) && abas[0]?.data ? abas : [{ sheet: '', data: abas }];
    const comSerie = lista.find(aba => (aba.data || []).slice(0, 10)
        .some(linha => (linha || []).some(celula => chaveColuna(celula) === 'SERIE')));
    if (!comSerie) throw new Error('Não achei a coluna "SERIE" (número de série do rádio) em nenhuma aba da planilha.');
    return { aba: comSerie.sheet, linhas: comSerie.data };
}

/* Transforma a tabela em rádios, reconhecendo as colunas pelo nome. */
function interpretarPlanilhaRadios(tabela, padroes = {}) {
    const linhas = tabela.linhas || [];
    const indiceCabecalho = linhas.slice(0, 10).findIndex(l => (l || []).some(c => chaveColuna(c) === 'SERIE'));
    if (indiceCabecalho < 0) throw new Error('Não achei a coluna "SERIE" (número de série do rádio).');

    // A planilha dos clubes usa SERIE (rádio), SERIE2 (bateria), SERIE3 (reserva) e SÉRIE (base).
    let series = 0;
    const colunas = (linhas[indiceCabecalho] || []).map(celula => {
        let chave = chaveColuna(celula);
        if (chave === 'SERIE') chave = ['SERIE', 'SERIE4'][series++] || `SERIE${series + 2}`;
        const campo = Object.keys(COLUNAS_PLANILHA_RADIOS).find(c => COLUNAS_PLANILHA_RADIOS[c].includes(chave));
        return { titulo: String(celula ?? '').trim(), campo };
    });

    const usados = new Set();
    colunas.forEach(c => { if (c.campo && usados.has(c.campo)) c.campo = null; else if (c.campo) usados.add(c.campo); });

    const corpo = linhas.slice(indiceCabecalho + 1);
    const tamanhoCodigo = {};
    colunas.forEach((c, i) => {
        if (!COLUNAS_CODIGO.includes(c.campo)) return;
        const textos = corpo.map(l => l?.[i]).filter(v => typeof v === 'string' && /^0\d+$/.test(v.trim()));
        if (textos.length) tamanhoCodigo[i] = Math.max(...textos.map(v => v.trim().length));
    });

    const texto = (valor, i) => {
        if (valor === null || valor === undefined) return '';
        if (typeof valor === 'number') {
            const s = Number.isInteger(valor) ? String(valor) : String(valor);
            return tamanhoCodigo[i] ? s.padStart(tamanhoCodigo[i], '0') : s;
        }
        if (valor instanceof Date) return valor.toLocaleDateString('pt-BR');
        return String(valor).trim();
    };

    const radiosLidos = [];
    corpo.forEach((linha, n) => {
        const r = { linha: indiceCabecalho + n + 2 };
        colunas.forEach((c, i) => { if (c.campo) r[c.campo] = texto(linha?.[i], i); });
        if (!Object.keys(COLUNAS_PLANILHA_RADIOS).some(k => r[k])) return;   // linha vazia

        if (r.identificacao && /^\d+$/.test(r.identificacao)) r.identificacao = `HT ${r.identificacao}`;
        if (r.setor) r.setor = tituloSetor(r.setor);
        r.setor = r.setor || padroes.setor || '';
        r.local = r.local || padroes.local || '';
        r.responsavel_nome = r.responsavel_nome || padroes.responsavel || '';
        r.status = statusDaPlanilha(r.status, r.responsavel_nome);
        radiosLidos.push(r);
    });

    return {
        radios: radiosLidos,
        reconhecidas: colunas.filter(c => c.campo).map(c => c.titulo),
        ignoradas: colunas.filter(c => !c.campo && c.titulo).map(c => c.titulo)
    };
}

function tituloSetor(texto) {
    const pequenas = ['de', 'da', 'do', 'das', 'dos', 'e'];
    return String(texto).toLowerCase().split(/\s+/).filter(Boolean)
        .map((p, i) => (i && pequenas.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

function statusDaPlanilha(valor, responsavel) {
    const chave = chaveColuna(valor);
    const mapa = { ATIVO: 'Ativo', RESERVA: 'Reserva', MANUTENCAO: 'Em manutenção', EMMANUTENCAO: 'Em manutenção',
                   EXTRAVIADO: 'Extraviado', BAIXADO: 'Baixado' };
    if (mapa[chave]) return mapa[chave];
    if (valor) return valor;   // o banco avisa que não reconheceu
    return responsavel ? 'Ativo' : 'Reserva';
}


/* ---------------- Telas ---------------- */

function abrirImportacaoRadios() {
    if (!podeAdministrar()) return avisar('Somente Gestor ou Administrador importa rádios.', 'erro');

    abrirFormulario({
        titulo: 'Importar rádios da planilha',
        subtitulo: 'O sistema lê as colunas pelo nome, confere tudo e mostra o resultado antes de gravar.',
        textoSalvar: 'Ler planilha',
        campos: [
            { id: 'arquivo', tipo: 'arquivo', rotulo: 'Planilha (.xlsx ou .csv)', obrigatorio: true, largo: true,
              accept: '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' },
            { id: 'ajuda', tipo: 'html', html: `<div class="importar-ajuda">
                <strong>Colunas reconhecidas</strong>
                <span>HT · SERIE (rádio) · BATERIA · SERIE2 · BATERIA RESERVA · SERIE3 · BASE CARREGADORA · SÉRIE (base)
                · SETOR · RESPONSÁVEL · LOCAL · CELULAR · STATUS · OBSERVAÇÃO</span>
                <small>Só "SERIE" é obrigatória. Outras colunas são ignoradas. Marca e modelo entram como o padrão
                (${escaparHTML(textoModelo(modelosRadio[0]))}) se a planilha não tiver.</small></div>` },
            { id: 'setor', rotulo: 'Setor (se a planilha não tiver)', lista: 'dlSetoresRadio', placeholder: 'Ex.: Segurança Externa' },
            { id: 'local', rotulo: 'Local (se a planilha não tiver)', tipo: 'select', valor: '',
              opcoes: [{ valor: '', texto: 'Não informado' }, ...LOCAIS.map(l => ({ valor: l.nome, texto: l.nome }))] },
            { id: 'responsavel', rotulo: 'Responsável (se a planilha não tiver)', lista: 'dlResponsaveisRadio', largo: true,
              placeholder: 'Nome completo de quem assina o termo' }
        ],
        aoSalvar: async valores => {
            if (!valores.arquivo) throw new Error('Escolha a planilha.');
            const tabela = await lerTabelaPlanilha(valores.arquivo);
            const lido = interpretarPlanilhaRadios(tabela, valores);
            if (!lido.radios.length) throw new Error('A planilha não tem nenhuma linha com rádio.');

            const { data, error } = await supabaseClient.rpc('importar_radios', { p_linhas: lido.radios, p_simular: true });
            if (error) {
                throw new Error(/importar_radios/.test(error.message || '')
                    ? 'Rode a atualização v11 no Supabase para liberar a importação.'
                    : traduzirErro(error));
            }
            setTimeout(() => mostrarPreviaImportacao(lido, data, valores.arquivo.name, tabela.aba), 0);
        }
    });
}

function mostrarPreviaImportacao(lido, resumo, nomeArquivo, aba) {
    const erros = resumo.erros || [];
    const erroPorLinha = new Map();
    erros.forEach(e => erroPorLinha.set(e.linha, [...(erroPorLinha.get(e.linha) || []), e.mensagem]));
    const aGravar = (resumo.novos || 0) + (resumo.atualizados || 0);

    const caixa = (numero, texto, classe) => `<div class="importar-numero ${classe}"><b>${numero}</b><span>${texto}</span></div>`;
    const tabela = lido.radios.slice(0, 400).map(r => {
        const problemas = erroPorLinha.get(r.linha);
        return `<tr class="${problemas ? 'importar-linha-erro' : ''}">
            <td>${r.linha}</td>
            <td>${escaparHTML(r.identificacao || '—')}</td>
            <td><b>${escaparHTML(r.numero_serie || '—')}</b></td>
            <td>${escaparHTML([r.bateria_codigo, r.bateria_serie].filter(Boolean).join(' · ') || '—')}</td>
            <td>${escaparHTML([r.bateria_reserva_codigo, r.bateria_reserva_serie].filter(Boolean).join(' · ') || '—')}</td>
            <td>${escaparHTML([r.carregador_codigo, r.carregador_serie].filter(Boolean).join(' · ') || '—')}</td>
            <td>${escaparHTML(r.setor || '—')}</td>
            <td>${escaparHTML(r.responsavel_nome || '—')}</td>
        </tr>${problemas ? `<tr class="importar-linha-erro"><td></td><td colspan="7">⚠ ${problemas.map(escaparHTML).join('<br>⚠ ')}</td></tr>` : ''}`;
    }).join('');

    const html = `
        <div class="importar-previa">
            <p class="importar-origem"><i class="fa-solid fa-file-excel"></i> ${escaparHTML(nomeArquivo)}${aba ? ` · aba "${escaparHTML(aba)}"` : ''}
               · ${lido.radios.length} linha(s)</p>
            <div class="importar-numeros">
                ${caixa(resumo.novos || 0, 'novos', 'novo')}
                ${caixa(resumo.atualizados || 0, 'atualizados', 'atualizado')}
                ${caixa(resumo.iguais || 0, 'já estavam iguais', 'igual')}
                ${caixa(erros.length, erros.length === 1 ? 'problema' : 'problemas', erros.length ? 'erro' : 'igual')}
            </div>
            ${erros.length ? `<p class="importar-aviso-erro"><i class="fa-solid fa-triangle-exclamation"></i>
                Nada será gravado enquanto houver problemas. Corrija a planilha (veja as linhas marcadas) e envie de novo.</p>` : ''}
            ${lido.ignoradas.length ? `<p class="importar-ignoradas">Colunas ignoradas: ${lido.ignoradas.map(escaparHTML).join(', ')}</p>` : ''}
            <p class="importar-ignoradas">Marca e modelo: ${escaparHTML(resumo.marca_padrao || '')} (quando a planilha não informa).</p>
            <div class="importar-tabela"><table>
                <thead><tr><th>Linha</th><th>HT</th><th>Rádio (série)</th><th>Bateria</th><th>Bateria reserva</th>
                    <th>Base carregadora</th><th>Setor</th><th>Responsável</th></tr></thead>
                <tbody>${tabela}</tbody>
            </table></div>
            ${lido.radios.length > 400 ? `<p class="importar-ignoradas">Mostrando as primeiras 400 linhas.</p>` : ''}
        </div>`;

    abrirFormulario({
        titulo: erros.length ? 'A planilha tem problemas' : 'Confira antes de gravar',
        subtitulo: erros.length
            ? 'Os números foram lidos da planilha. Veja abaixo o que precisa ser corrigido.'
            : aGravar ? `Tudo certo. ${aGravar} rádio(s) serão gravados.` : 'Todos os rádios da planilha já estão cadastrados assim.',
        textoSalvar: erros.length ? 'Escolher outra planilha' : aGravar ? `Gravar ${aGravar} rádio(s)` : 'Fechar',
        largo: true,
        campos: [{ id: 'previa', tipo: 'html', html }],
        aoSalvar: async () => {
            if (erros.length) return setTimeout(abrirImportacaoRadios, 0);
            if (!aGravar) return;
            const { data, error } = await supabaseClient.rpc('importar_radios', { p_linhas: lido.radios, p_simular: false });
            if (error) throw new Error(traduzirErro(error));
            if (data?.erros?.length) throw new Error('O banco encontrou um problema novo: ' + data.erros[0].mensagem);
            await carregarRadios();
            avisar(`Importação concluída: ${data.novos} novo(s), ${data.atualizados} atualizado(s).`);
        }
    });
}

/* =========================================================
   99 · INICIALIZAÇÃO
   Todos os eventos e a partida do sistema ficam aqui
   (antes estavam espalhados em 6 pontos diferentes).
========================================================= */

function ligarEventos() {
    const ligar = (id, evento, funcao) => document.getElementById(id)?.addEventListener(evento, funcao);

    ligarBuscaGeral();
    ligarAtualizacaoAutomatica();

    /* Onde está? / Fora do lugar */
    let espera = null;
    ligar('buscaOndeEsta', 'input', () => { clearTimeout(espera); espera = setTimeout(renderizarOndeEsta, 150); });
    ligar('filtroLocalOndeEsta', 'change', renderizarOndeEsta);
    ligar('filtroSomenteFora', 'change', renderizarOndeEsta);
    ligar('buscaForaLugar', 'input', renderizarForaDoLugar);
    ligar('filtroOrigemFora', 'change', renderizarForaDoLugar);
    ligar('filtroAtrasados', 'change', renderizarForaDoLugar);

    /* Cadastro */
    const nome = document.getElementById('nome');
    if (nome) {
        nome.setAttribute('list', 'dlProdutos');
        nome.setAttribute('autocomplete', 'off');
        nome.addEventListener('input', atualizarDicaProduto);
        nome.addEventListener('change', atualizarDicaProduto);
    }
    document.getElementById('tipoItem')?.setAttribute('list', 'dlCategorias');
    ligar('totalEsperado', 'input', recalcularDistribuicao);
    if (!document.querySelector('#linhasDistribuicao .dist-linha')) adicionarLinhaDistribuicao();

    /* Movimentação */
    ligar('destino', 'change', () => { popularSubsetoresMovimentacao(); atualizarAjudaMovimentacao(); });
    ligar('destinoSubsetor', 'change', atualizarAjudaMovimentacao);
    document.querySelectorAll('input[name="tipoMovimentacao"]').forEach(radio =>
        radio.addEventListener('change', atualizarAjudaMovimentacao));
    const retorno = document.getElementById('retornoPrevisto');
    if (retorno) {
        retorno.min = hojeISO();
        retorno.addEventListener('change', atualizarAjudaMovimentacao);
    }
    ligar('buscaPecaMov', 'input', renderizarPecasMov);
    ligar('destinoOndeFica', 'input', atualizarAjudaMovimentacao);
    ligar('quantidadeMov', 'input', atualizarResumoMov);
    document.getElementById('buscaPecaMov')?.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter') return;
        const unica = document.querySelectorAll('#listaPecasMov .mov-peca');
        if (unica.length === 1) unica[0].click();
    });
    atualizarAjudaMovimentacao();

    /* Catálogo */
    ['buscaProduto', 'filtroCategoriaProduto', 'filtroProdutosInativos'].forEach(id => {
        const campo = document.getElementById(id);
        campo?.addEventListener(['checkbox', 'select-one'].includes(campo.type) ? 'change' : 'input', renderizarProdutos);
    });
    popularListasCatalogo();

    /* Rádios */
    ligar('buscaRadio', 'input', renderizarRadios);
    ['filtroSetorRadio', 'filtroSituacaoRadio', 'filtroStatusRadio'].forEach(id => ligar(id, 'change', renderizarRadios));

    /* Consulta pública */
    iniciarConsultaPublica();
}

async function iniciarSistema() {
    document.body.classList.add('login-mode');

    await carregarLocaisBanco();
    carregarLocais();
    await carregarSubsetores();
    atualizarMenus();
    atualizarUsuarioInterface();

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) console.error('ERRO GET SESSION:', error);

    if (data?.session?.user) {
        usuarioLogado = data.session.user;
        try {
            await entrarNoSistema();
            if (VEIO_DO_LINK_DE_NOVA_SENHA) pedirNovaSenha();
        } catch (erro) {
            if (erro?.message !== 'ACESSO_NEGADO') throw erro;
            abrirTela('loginTela');
        }
    } else {
        abrirTela('loginTela');
    }

    /* Sessão encerrada em outra aba ou expirada: volta ao login. */
    supabaseClient.auth.onAuthStateChange((evento, sessao) => {
        if (evento === 'PASSWORD_RECOVERY' && !VEIO_DO_LINK_DE_NOVA_SENHA) pedirNovaSenha();
        if (evento === 'SIGNED_OUT' || (!sessao && usuarioLogado)) {
            usuarioLogado = null;
            perfilUsuario = null;
            nomeUsuarioLogado = '';
            atualizarMenus();
            atualizarUsuarioInterface();
            abrirTela('loginTela');
        }
    });
}

document.addEventListener('DOMContentLoaded', ligarEventos);

window.addEventListener('load', () => {
    iniciarSistema().catch(erro => {
        console.error('ERRO AO INICIAR SISTEMA:', erro);
        abrirTela('loginTela');
        erroLogin('Não foi possível conectar ao sistema. Confira a internet e recarregue a página.');
    });
});
