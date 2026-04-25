// ==========================================================
// MÉTODO CHEFE — Painel do admin (mentor)
// ==========================================================

let CURRENT = null;
let CACHE_ALUNOS = [];

// Estado das imagens no modal de questão
const IMG_STATE = {
  enunciado: { file: null, urlAtual: null, removerAtual: false },
  resolucao: { file: null, urlAtual: null, removerAtual: false },
};
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

(async () => {
  const r = await window.requireAuth('admin');
  if (!r) return;
  CURRENT = r;
  inicializar();
})();

function inicializar() {
  document.getElementById('adminNome').textContent =
    'Chefe ' + CURRENT.profile.nome.split(' ')[0];

  // Popular selects
  ['tcMateria', 'qMat', 'aqfMateria'].forEach(id => {
    const el = document.getElementById(id);
    if (id === 'aqfMateria') el.innerHTML = '<option value="">Todas</option>';
    else if (id === 'qMat') el.innerHTML = '<option value="">Selecione...</option>';
    else el.innerHTML = '<option value="">—</option>';
    window.MATERIAS.forEach(m => el.insertAdjacentHTML('beforeend', `<option>${m}</option>`));
  });

  // Selects do modal de questão
  const qInst = document.getElementById('qInstituicao');
  window.popularSelectInstituicoes(qInst, true, '— Sem instituição');
  const qEsc = document.getElementById('qEscolaridade');
  qEsc.innerHTML = '<option value="">—</option>';
  window.ESCOLARIDADES_QUESTAO.forEach(e => qEsc.insertAdjacentHTML('beforeend', `<option>${e}</option>`));
  const qNivel = document.getElementById('qNivel');
  qNivel.innerHTML = '<option value="">—</option>';
  window.NIVEIS.forEach(n => qNivel.insertAdjacentHTML('beforeend', `<option value="${n.v}">${n.label}</option>`));

  // Selects de filtros do banco de questões
  window.popularSelectInstituicoes(document.getElementById('aqfInstituicao'), true, 'Todas');
  const aqfEsc = document.getElementById('aqfEscolaridade');
  window.ESCOLARIDADES_QUESTAO.forEach(e => aqfEsc.insertAdjacentHTML('beforeend', `<option>${e}</option>`));
  const aqfNivel = document.getElementById('aqfNivel');
  window.NIVEIS.forEach(n => aqfNivel.insertAdjacentHTML('beforeend', `<option value="${n.v}">${n.label}</option>`));

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      trocarAba(a.dataset.tab);
    });
  });

  // Sair
  document.getElementById('btnSair').addEventListener('click', async e => {
    e.preventDefault();
    await window.db.auth.signOut();
    location.href = 'index.html';
  });

  // Formulários
  document.getElementById('formTC').addEventListener('submit', criarTC);
  document.getElementById('formQuestao').addEventListener('submit', salvarQuestao);

  // Inputs de imagem
  configurarInputImagem('enunciado', 'qImgEnun', 'qImgEnunBox', 'qImgEnunPrev', 'qImgEnunRemover');
  configurarInputImagem('resolucao', 'qImgResol', 'qImgResolBox', 'qImgResolPrev', 'qImgResolRemover');

  document.querySelectorAll('[data-filtro-tc]').forEach(b => {
    b.addEventListener('click', () => carregarTcsAdmin(b.dataset.filtroTc));
  });

  ['aqfMateria', 'aqfDif', 'aqfInstituicao', 'aqfEscolaridade', 'aqfNivel']
    .forEach(id => document.getElementById(id).addEventListener('change', carregarQuestoesAdmin));
  document.getElementById('aqfAssunto').addEventListener('input', debounce(carregarQuestoesAdmin, 300));

  // Acervo
  document.getElementById('formPasta').addEventListener('submit', salvarPasta);
  document.getElementById('formMaterial').addEventListener('submit', salvarMaterial);
  document.getElementById('mArquivo')?.addEventListener('change', () => {
    document.getElementById('mUrlExterna').value = '';
  });

  // Ciclo
  document.getElementById('cicloAluno').addEventListener('change', carregarCicloAluno);
  document.getElementById('btnSalvarCiclo').addEventListener('click', salvarCiclo);

  // Carregar tudo
  carregarStats();
  carregarAlunos();
  carregarTcsAdmin('todas');
  carregarQuestoesAdmin();
  carregarFeedRecente();
  navegarPasta(null);
}

function trocarAba(nome) {
  document.querySelectorAll('[data-painel]').forEach(p => p.classList.add('hidden'));
  document.querySelector(`[data-painel="${nome}"]`).classList.remove('hidden');
  document.querySelectorAll('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === nome));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---------- STATS ----------
async function carregarStats() {
  const [{ count: nAlunos }, { count: nTcs }, { count: nQ }] = await Promise.all([
    window.db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'aluno'),
    window.db.from('tarefas_casa').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    window.db.from('questoes').select('id', { count: 'exact', head: true }),
  ]);
  document.getElementById('sAlunos').textContent = nAlunos ?? 0;
  document.getElementById('sTcs').textContent = nTcs ?? 0;
  document.getElementById('sQuestoes').textContent = nQ ?? 0;
}

// ---------- ALUNOS ----------
async function carregarAlunos() {
  const { data, error } = await window.db
    .from('profiles').select('*').eq('role', 'aluno').order('nome');
  if (error) { toast(error.message, 'err'); return; }
  CACHE_ALUNOS = data;

  // Seletor no form TC
  const selTC = document.getElementById('tcAluno');
  selTC.innerHTML = '<option value="">Selecione o aluno...</option>';
  data.forEach(a => selTC.insertAdjacentHTML('beforeend', `<option value="${a.id}">${escapeHtml(a.nome)}</option>`));

  // Seletor de aluno no ciclo
  const selCiclo = document.getElementById('cicloAluno');
  if (selCiclo) {
    const atual = selCiclo.value;
    selCiclo.innerHTML = '<option value="">Selecione...</option>';
    data.forEach(a => selCiclo.insertAdjacentHTML('beforeend', `<option value="${a.id}">${escapeHtml(a.nome)}</option>`));
    if (atual) selCiclo.value = atual;
  }

  // Horas de estudo dos últimos 7 dias
  const seteAtras = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const { data: sess } = await window.db
    .from('sessoes_estudo').select('aluno_id, duracao_minutos')
    .gte('data_estudo', seteAtras);
  const mapaHoras = {};
  (sess || []).forEach(s => { mapaHoras[s.aluno_id] = (mapaHoras[s.aluno_id] || 0) + s.duracao_minutos; });

  // Tabela
  const tb = document.getElementById('tbodyAlunos');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">Nenhum aluno cadastrado ainda.</td></tr>'; return; }
  tb.innerHTML = data.map(a => `
    <tr>
      <td><strong>${escapeHtml(a.nome)}</strong></td>
      <td class="small muted">${escapeHtml(a.escolaridade || '—')}</td>
      <td>${a.prova_militar ? `<span class="chip gold">${escapeHtml(a.prova_militar)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${(a.olimpiadas || []).map(o => `<span class="chip">${escapeHtml(o)}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
      <td><span class="chip gold">${formatarHoras(mapaHoras[a.id] || 0)}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="verAluno('${a.id}')">Abrir</button></td>
    </tr>
  `).join('');

  // Ranking do painel
  const rank = [...data].map(a => ({ ...a, horas: mapaHoras[a.id] || 0 }))
    .sort((x, y) => y.horas - x.horas).slice(0, 8);
  const el = document.getElementById('rankAlunos');
  if (!rank.length) { el.innerHTML = '<p class="muted small">Sem dados ainda.</p>'; return; }
  const max = Math.max(1, rank[0].horas);
  el.innerHTML = rank.map(a => `
    <div style="margin-bottom:.7rem;">
      <div class="row between small"><span>${escapeHtml(a.nome)}</span><span class="gold font-mono">${formatarHoras(a.horas)}</span></div>
      <div style="height:6px; background:rgba(255,255,255,.05); border:1px solid var(--border); margin-top:.3rem;">
        <div style="height:100%; width:${(a.horas / max * 100).toFixed(0)}%; background:linear-gradient(90deg, var(--gold-dim), var(--gold));"></div>
      </div>
    </div>
  `).join('');
}

function formatarHoras(min) {
  if (!min) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return m + 'min';
  if (m === 0) return h + 'h';
  return `${h}h${String(m).padStart(2, '0')}`;
}

window.verAluno = async function (id) {
  const a = CACHE_ALUNOS.find(x => x.id === id);
  if (!a) return;
  const { data: sess } = await window.db
    .from('sessoes_estudo').select('*').eq('aluno_id', id)
    .order('data_estudo', { ascending: false }).limit(20);
  const { data: tcs } = await window.db
    .from('tarefas_casa').select('*').eq('aluno_id', id)
    .order('created_at', { ascending: false });

  const html = `
    <div class="panel-head"><h3 class="panel-title">${escapeHtml(a.nome)}</h3></div>
    <div class="panel-body">
      <div class="row wrap" style="gap:.4rem; margin-bottom:1rem;">
        ${a.escolaridade ? `<span class="chip">${escapeHtml(a.escolaridade)}</span>` : ''}
        ${a.prova_militar ? `<span class="chip gold">${escapeHtml(a.prova_militar)}</span>` : ''}
        ${(a.olimpiadas || []).map(o => `<span class="chip gold">${escapeHtml(o)}</span>`).join('')}
      </div>
      <div class="kicker">Últimas sessões</div>
      <div class="mt-2">
        ${(sess || []).length === 0 ? '<p class="muted small">Sem sessões ainda.</p>' :
          '<table class="tbl"><thead><tr><th>Data</th><th>Matéria</th><th>Tópico</th><th>Duração</th></tr></thead><tbody>' +
          sess.map(s => `<tr><td class="small font-mono">${fmtData(s.data_estudo)}</td><td>${escapeHtml(s.materia)}</td><td class="small muted">${escapeHtml(s.topico || '—')}</td><td><span class="chip gold">${formatarHoras(s.duracao_minutos)}</span></td></tr>`).join('') +
          '</tbody></table>'}
      </div>
      <div class="kicker mt-3">TCs</div>
      <div class="mt-2">
        ${(tcs || []).length === 0 ? '<p class="muted small">Sem TCs ainda.</p>' :
          tcs.map(t => `<div style="padding:.5rem 0; border-bottom:1px solid var(--border);">
            <div class="row between"><strong>${escapeHtml(t.titulo)}</strong>
            <span class="chip ${t.status === 'concluida' ? 'ok' : 'warn'}">${t.status}</span></div>
            ${t.prazo ? `<span class="muted small">Prazo: ${fmtData(t.prazo)}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>`;
  abrirModalCustom(html);
};

function abrirModalCustom(html) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.onclick = e => { if (e.target === back) back.remove(); };
  back.innerHTML = `<div class="modal panel"><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button>${html}</div>`;
  document.body.appendChild(back);
}

// ---------- TCs ----------
async function criarTC(e) {
  e.preventDefault();
  const payload = {
    aluno_id: document.getElementById('tcAluno').value,
    criado_por: CURRENT.session.user.id,
    titulo: document.getElementById('tcTitulo').value.trim(),
    descricao: document.getElementById('tcDesc').value.trim() || null,
    materia: document.getElementById('tcMateria').value || null,
    prazo: document.getElementById('tcPrazo').value || null,
  };
  const { error } = await window.db.from('tarefas_casa').insert(payload);
  if (error) { toast(error.message, 'err'); return; }
  toast('TC emitida com sucesso.', 'ok');
  e.target.reset();
  carregarStats();
  carregarTcsAdmin('todas');
}

async function carregarTcsAdmin(filtro) {
  let q = window.db
    .from('tarefas_casa')
    .select('*, profiles!tarefas_casa_aluno_id_fkey(nome)')
    .order('created_at', { ascending: false });
  if (filtro === 'pendente') q = q.eq('status', 'pendente');
  if (filtro === 'concluida') q = q.eq('status', 'concluida');
  const { data, error } = await q;
  const el = document.getElementById('listaTcsAdmin');
  if (error) { el.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">Sem TCs.</p>'; return; }
  el.innerHTML = data.map(t => `
    <div class="panel panel-body" style="margin-bottom:.8rem;">
      <div class="row wrap" style="gap:.4rem; margin-bottom:.4rem;">
        <span class="chip gold">${escapeHtml(t.profiles?.nome || '—')}</span>
        ${t.materia ? `<span class="chip">${escapeHtml(t.materia)}</span>` : ''}
        <span class="chip ${t.status === 'concluida' ? 'ok' : 'warn'}">${t.status}</span>
        ${t.prazo ? `<span class="chip">Prazo: ${fmtData(t.prazo)}</span>` : ''}
      </div>
      <h4 style="margin:.2rem 0; font-family:'Playfair Display', serif;">${escapeHtml(t.titulo)}</h4>
      ${t.descricao ? `<p class="muted small" style="margin:.3rem 0;">${escapeHtml(t.descricao)}</p>` : ''}
      <div class="row mt-2">
        <button class="btn btn-danger btn-sm" onclick="excluirTC('${t.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

window.excluirTC = async function (id) {
  if (!confirm('Excluir esta TC? O aluno perderá o histórico.')) return;
  const { error } = await window.db.from('tarefas_casa').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('TC excluída.', 'ok');
  carregarStats();
  carregarTcsAdmin('todas');
};

// ---------- FEED ----------
async function carregarFeedRecente() {
  const { data } = await window.db
    .from('sessoes_estudo')
    .select('*, profiles!sessoes_estudo_aluno_id_fkey(nome)')
    .order('created_at', { ascending: false })
    .limit(8);
  const el = document.getElementById('feedRecente');
  if (!data || !data.length) { el.innerHTML = '<p class="muted small">Sem atividade recente.</p>'; return; }
  el.innerHTML = data.map(s => `
    <div style="padding:.6rem 0; border-bottom:1px solid var(--border);">
      <div class="row between">
        <span><strong>${escapeHtml(s.profiles?.nome || '?')}</strong> <span class="muted small">registrou ${escapeHtml(s.materia)}</span></span>
        <span class="chip gold">${formatarHoras(s.duracao_minutos)}</span>
      </div>
      <div class="muted small">${escapeHtml(s.topico || '—')} · ${fmtData(s.data_estudo)}</div>
    </div>
  `).join('');
}

// ---------- QUESTÕES ----------
async function carregarQuestoesAdmin() {
  let q = window.db.from('questoes').select('*').order('created_at', { ascending: false });
  const mat = document.getElementById('aqfMateria').value;
  const dif = document.getElementById('aqfDif').value;
  const inst = document.getElementById('aqfInstituicao').value;
  const esc = document.getElementById('aqfEscolaridade').value;
  const nivel = document.getElementById('aqfNivel').value;
  const assunto = document.getElementById('aqfAssunto').value.trim();
  if (mat) q = q.eq('materia', mat);
  if (dif) q = q.eq('dificuldade', dif);
  if (inst) q = q.eq('instituicao', inst);
  if (esc) q = q.eq('escolaridade', esc);
  if (nivel) q = q.eq('nivel', parseInt(nivel));
  if (assunto) q = q.ilike('assunto', `%${assunto}%`);
  const { data, error } = await q;
  const el = document.getElementById('listaQuestoesAdmin');
  if (error) { el.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">Nenhuma questão ainda. Adicione a primeira.</p>'; return; }
  el.innerHTML = data.map(q => `
    <div class="panel panel-body" style="margin-bottom:1rem;">
      <div class="row wrap" style="gap:.4rem; margin-bottom:.5rem;">
        <span class="chip gold">${escapeHtml(q.materia)}</span>
        ${q.assunto ? `<span class="chip">${escapeHtml(q.assunto)}</span>` : ''}
        ${q.instituicao ? `<span class="chip gold">${escapeHtml(q.instituicao)}${q.ano ? ' · ' + q.ano : ''}</span>` : (q.fonte ? `<span class="chip">${escapeHtml(q.fonte)}</span>` : '')}
        ${q.nivel ? `<span class="chip">Nível ${q.nivel}</span>` : ''}
        ${q.escolaridade ? `<span class="chip">${escapeHtml(q.escolaridade)}</span>` : ''}
        ${q.dificuldade ? `<span class="chip ${q.dificuldade === 'dificil' ? 'danger' : q.dificuldade === 'medio' ? 'warn' : 'ok'}">${q.dificuldade}</span>` : ''}
        ${q.imagem_url ? '<span class="chip">📷 enunciado</span>' : ''}
        ${q.imagem_resolucao_url ? '<span class="chip">📷 resolução</span>' : ''}
      </div>
      <div class="row" style="gap:1rem; align-items:flex-start;">
        ${q.imagem_url ? `<img src="${escapeHtml(q.imagem_url)}" style="width:110px; height:80px; object-fit:cover; border:1px solid var(--border); flex-shrink:0;" />` : ''}
        <div style="white-space:pre-wrap; flex:1;">${escapeHtml(q.enunciado.slice(0, 280))}${q.enunciado.length > 280 ? '...' : ''}</div>
      </div>
      <div class="row mt-2">
        <button class="btn btn-ghost btn-sm" onclick='abrirModalQuestao(${JSON.stringify(q).replace(/'/g, "&#39;")})'>Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirQuestao('${q.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

window.abrirModalQuestao = function (q) {
  const m = document.getElementById('modalQuestao');
  m.classList.remove('hidden');
  document.getElementById('formQuestao').reset();
  resetImgState();
  if (q && q.id) {
    document.getElementById('modalQuestaoTitulo').textContent = 'Editar questão';
    document.getElementById('qId').value = q.id;
    document.getElementById('qEnun').value = q.enunciado || '';
    document.getElementById('qMat').value = q.materia || '';
    document.getElementById('qAssunto').value = q.assunto || '';
    document.getElementById('qDif').value = q.dificuldade || '';
    document.getElementById('qFonte').value = q.fonte || '';
    document.getElementById('qAno').value = q.ano || '';
    document.getElementById('qInstituicao').value = q.instituicao || '';
    document.getElementById('qEscolaridade').value = q.escolaridade || '';
    document.getElementById('qNivel').value = q.nivel || '';
    document.getElementById('qResp').value = q.resposta_correta || '';
    document.getElementById('qResol').value = q.resolucao || '';
    const alts = q.alternativas || {};
    ['a', 'b', 'c', 'd', 'e'].forEach(k => {
      document.getElementById('qA_' + k).value = alts[k] || '';
    });
    // Imagens existentes
    if (q.imagem_url) carregarImagemExistente('enunciado', q.imagem_url, 'qImgEnunBox', 'qImgEnunPrev');
    if (q.imagem_resolucao_url) carregarImagemExistente('resolucao', q.imagem_resolucao_url, 'qImgResolBox', 'qImgResolPrev');
  } else {
    document.getElementById('modalQuestaoTitulo').textContent = 'Nova questão';
    document.getElementById('qId').value = '';
  }
};
window.fecharModalQuestao = function () {
  document.getElementById('modalQuestao').classList.add('hidden');
};

function resetImgState() {
  IMG_STATE.enunciado = { file: null, urlAtual: null, removerAtual: false };
  IMG_STATE.resolucao = { file: null, urlAtual: null, removerAtual: false };
  ['qImgEnunBox', 'qImgResolBox'].forEach(id => document.getElementById(id).classList.add('hidden'));
  ['qImgEnunPrev', 'qImgResolPrev'].forEach(id => document.getElementById(id).removeAttribute('src'));
}

function carregarImagemExistente(tipo, url, boxId, imgId) {
  IMG_STATE[tipo].urlAtual = url;
  document.getElementById(imgId).src = url;
  document.getElementById(boxId).classList.remove('hidden');
}

function configurarInputImagem(tipo, inputId, boxId, imgId, btnRemoverId) {
  const input = document.getElementById(inputId);
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Arquivo precisa ser uma imagem.', 'err');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMG_BYTES) {
      toast('Imagem maior que 5MB. Reduza antes de enviar.', 'err');
      input.value = '';
      return;
    }
    IMG_STATE[tipo].file = file;
    IMG_STATE[tipo].removerAtual = false;
    document.getElementById(imgId).src = URL.createObjectURL(file);
    document.getElementById(boxId).classList.remove('hidden');
  });

  document.getElementById(btnRemoverId).addEventListener('click', () => {
    IMG_STATE[tipo].file = null;
    IMG_STATE[tipo].removerAtual = !!IMG_STATE[tipo].urlAtual;
    input.value = '';
    document.getElementById(imgId).removeAttribute('src');
    document.getElementById(boxId).classList.add('hidden');
  });
}

// Extrai o caminho do objeto a partir do URL público
function pathDoStorage(url) {
  if (!url) return null;
  const marcador = '/storage/v1/object/public/questoes/';
  const i = url.indexOf(marcador);
  return i >= 0 ? url.slice(i + marcador.length) : null;
}

async function processarImagem(tipo) {
  const st = IMG_STATE[tipo];
  // Caso 1: subir nova (substitui ou cria)
  if (st.file) {
    if (st.urlAtual) {
      const oldPath = pathDoStorage(st.urlAtual);
      if (oldPath) await window.db.storage.from('questoes').remove([oldPath]);
    }
    const ext = (st.file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${tipo}/${crypto.randomUUID()}.${ext}`;
    const { error } = await window.db.storage.from('questoes').upload(path, st.file, {
      cacheControl: '3600', upsert: false, contentType: st.file.type
    });
    if (error) throw error;
    const { data } = window.db.storage.from('questoes').getPublicUrl(path);
    return data.publicUrl;
  }
  // Caso 2: remover a atual
  if (st.removerAtual && st.urlAtual) {
    const oldPath = pathDoStorage(st.urlAtual);
    if (oldPath) await window.db.storage.from('questoes').remove([oldPath]);
    return null;
  }
  // Caso 3: manter como estava
  return st.urlAtual;
}

async function salvarQuestao(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSalvarQ');
  btn.disabled = true; const txtOrig = btn.textContent; btn.textContent = 'Salvando...';

  try {
    const alts = {};
    ['a', 'b', 'c', 'd', 'e'].forEach(k => {
      const v = document.getElementById('qA_' + k).value.trim();
      if (v) alts[k] = v;
    });

    const imagem_url = await processarImagem('enunciado');
    const imagem_resolucao_url = await processarImagem('resolucao');

    const payload = {
      enunciado: document.getElementById('qEnun').value.trim(),
      materia: document.getElementById('qMat').value,
      assunto: document.getElementById('qAssunto').value.trim() || null,
      dificuldade: document.getElementById('qDif').value || null,
      fonte: document.getElementById('qFonte').value.trim() || null,
      ano: document.getElementById('qAno').value ? parseInt(document.getElementById('qAno').value) : null,
      instituicao: document.getElementById('qInstituicao').value || null,
      escolaridade: document.getElementById('qEscolaridade').value || null,
      nivel: document.getElementById('qNivel').value ? parseInt(document.getElementById('qNivel').value) : null,
      alternativas: Object.keys(alts).length ? alts : null,
      resposta_correta: document.getElementById('qResp').value.trim() || null,
      resolucao: document.getElementById('qResol').value.trim() || null,
      imagem_url,
      imagem_resolucao_url,
    };
    const id = document.getElementById('qId').value;
    const req = id
      ? window.db.from('questoes').update(payload).eq('id', id)
      : window.db.from('questoes').insert(payload);
    const { error } = await req;
    if (error) throw error;
    toast('Questão salva.', 'ok');
    fecharModalQuestao();
    carregarStats();
    carregarQuestoesAdmin();
  } catch (err) {
    toast('Erro: ' + (err.message || err), 'err');
  } finally {
    btn.disabled = false; btn.textContent = txtOrig;
  }
}

window.excluirQuestao = async function (id) {
  if (!confirm('Excluir esta questão permanentemente?')) return;
  // Pega as imagens antes de apagar a linha
  const { data: q } = await window.db.from('questoes')
    .select('imagem_url, imagem_resolucao_url').eq('id', id).single();
  const paths = [];
  if (q?.imagem_url) { const p = pathDoStorage(q.imagem_url); if (p) paths.push(p); }
  if (q?.imagem_resolucao_url) { const p = pathDoStorage(q.imagem_resolucao_url); if (p) paths.push(p); }
  if (paths.length) await window.db.storage.from('questoes').remove(paths);

  const { error } = await window.db.from('questoes').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('Questão excluída.', 'ok');
  carregarStats();
  carregarQuestoesAdmin();
};

// ==========================================================
// ACERVO
// ==========================================================
let PASTA_ATUAL = null;             // id da pasta corrente (null = raiz)
let CAMINHO_PASTAS = [];            // breadcrumb [{id, nome}, ...]
const MAX_PDF_BYTES = 30 * 1024 * 1024;

async function navegarPasta(pastaId) {
  PASTA_ATUAL = pastaId;
  if (pastaId === null) CAMINHO_PASTAS = [];
  else {
    // monta caminho buscando ancestrais
    CAMINHO_PASTAS = [];
    let atual = pastaId;
    while (atual) {
      const { data } = await window.db.from('pastas').select('id, nome, parent_id').eq('id', atual).single();
      if (!data) break;
      CAMINHO_PASTAS.unshift({ id: data.id, nome: data.nome });
      atual = data.parent_id;
    }
  }
  renderizarBreadcrumb();
  await renderizarConteudoAcervo();
}
window.navegarPasta = navegarPasta;

function renderizarBreadcrumb() {
  const el = document.getElementById('breadcrumbAdmin');
  if (!el) return;
  let html = `<a href="#" onclick="navegarPasta(null); return false;">Raiz</a>`;
  CAMINHO_PASTAS.forEach((p, i) => {
    const ultimo = i === CAMINHO_PASTAS.length - 1;
    html += ` <span class="sep">›</span> `;
    html += ultimo
      ? `<span class="atual">${escapeHtml(p.nome)}</span>`
      : `<a href="#" onclick="navegarPasta('${p.id}'); return false;">${escapeHtml(p.nome)}</a>`;
  });
  el.innerHTML = html;
}

async function renderizarConteudoAcervo() {
  const el = document.getElementById('acervoConteudoAdmin');
  el.innerHTML = '<p class="muted small">Carregando...</p>';
  const filtroPasta = PASTA_ATUAL ? { eq: PASTA_ATUAL } : { is: null };
  const [{ data: pastas }, { data: mats }] = await Promise.all([
    PASTA_ATUAL
      ? window.db.from('pastas').select('*').eq('parent_id', PASTA_ATUAL).order('ordem').order('nome')
      : window.db.from('pastas').select('*').is('parent_id', null).order('ordem').order('nome'),
    PASTA_ATUAL
      ? window.db.from('materiais').select('*').eq('pasta_id', PASTA_ATUAL).order('ordem').order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  const cards = [];
  (pastas || []).forEach(p => {
    cards.push(`
      <div class="acervo-card" onclick="navegarPasta('${p.id}')">
        <div class="ac-actions">
          <button onclick="event.stopPropagation(); editarPasta('${p.id}')" title="Editar">✎</button>
          <button class="danger" onclick="event.stopPropagation(); excluirPasta('${p.id}')" title="Excluir">×</button>
        </div>
        <div class="ac-icon">${window.iconeMat(p.tipo)}</div>
        <div class="ac-meta">${p.tipo === 'curso' ? 'Curso' : 'Pasta'}</div>
        <div class="ac-titulo">${escapeHtml(p.nome)}</div>
        ${p.descricao ? `<div class="muted small">${escapeHtml(p.descricao)}</div>` : ''}
      </div>
    `);
  });
  (mats || []).forEach(m => {
    cards.push(`
      <div class="acervo-card" onclick='abrirMaterialAdmin(${JSON.stringify(m).replace(/'/g, "&#39;")})'>
        <div class="ac-actions">
          <button onclick="event.stopPropagation(); editarMaterial('${m.id}')" title="Editar">✎</button>
          <button class="danger" onclick="event.stopPropagation(); excluirMaterial('${m.id}')" title="Excluir">×</button>
        </div>
        <div class="ac-icon">${window.iconeMat(m.tipo)}</div>
        <div class="ac-meta">${window.LABEL_TIPO[m.tipo]}</div>
        <div class="ac-titulo">${escapeHtml(m.titulo)}</div>
        ${m.descricao ? `<div class="muted small">${escapeHtml(m.descricao.slice(0, 90))}${m.descricao.length > 90 ? '...' : ''}</div>` : ''}
      </div>
    `);
  });

  if (!cards.length) {
    el.innerHTML = '<p class="muted">Esta pasta está vazia. Use os botões acima para adicionar pastas, cursos ou materiais.</p>';
  } else {
    el.innerHTML = `<div class="acervo-grid">${cards.join('')}</div>`;
  }
}

window.abrirMaterialAdmin = function (m) {
  abrirVisualizadorMaterial(m);
};

// ----- Modal pasta/curso -----
window.abrirModalPasta = function (tipo, dados = null) {
  document.getElementById('modalPasta').classList.remove('hidden');
  document.getElementById('formPasta').reset();
  document.getElementById('pTipo').value = tipo;
  if (dados) {
    document.getElementById('pId').value = dados.id;
    document.getElementById('pNome').value = dados.nome;
    document.getElementById('pDesc').value = dados.descricao || '';
    document.getElementById('modalPastaTitulo').textContent =
      'Editar ' + (dados.tipo === 'curso' ? 'curso' : 'pasta');
  } else {
    document.getElementById('pId').value = '';
    document.getElementById('modalPastaTitulo').textContent =
      'Nova ' + (tipo === 'curso' ? 'curso' : 'pasta');
  }
};
window.fecharModalPasta = function () {
  document.getElementById('modalPasta').classList.add('hidden');
};
async function salvarPasta(e) {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const payload = {
    nome: document.getElementById('pNome').value.trim(),
    descricao: document.getElementById('pDesc').value.trim() || null,
    tipo: document.getElementById('pTipo').value,
    parent_id: PASTA_ATUAL,
  };
  const req = id
    ? window.db.from('pastas').update(payload).eq('id', id)
    : window.db.from('pastas').insert(payload);
  const { error } = await req;
  if (error) { toast(error.message, 'err'); return; }
  toast(id ? 'Pasta atualizada.' : 'Pasta criada.', 'ok');
  fecharModalPasta();
  renderizarConteudoAcervo();
}
window.editarPasta = async function (id) {
  const { data } = await window.db.from('pastas').select('*').eq('id', id).single();
  if (data) abrirModalPasta(data.tipo, data);
};
window.excluirPasta = async function (id) {
  if (!confirm('Excluir esta pasta e TUDO que houver dentro dela?')) return;
  const paths = await coletarArquivosDescendentes(id);
  if (paths.length) await window.db.storage.from('acervo').remove(paths);
  const { error } = await window.db.from('pastas').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('Pasta excluída.', 'ok');
  renderizarConteudoAcervo();
};

async function coletarArquivosDescendentes(pastaId) {
  // Coleta paths de PDFs do storage para limpar antes de apagar a pasta
  const paths = [];
  const fila = [pastaId];
  while (fila.length) {
    const id = fila.shift();
    const { data: subs } = await window.db.from('pastas').select('id').eq('parent_id', id);
    (subs || []).forEach(s => fila.push(s.id));
    const { data: mats } = await window.db.from('materiais').select('url').eq('pasta_id', id);
    (mats || []).forEach(m => {
      const p = pathStorageAcervo(m.url);
      if (p) paths.push(p);
    });
  }
  return paths;
}
function pathStorageAcervo(url) {
  if (!url) return null;
  const marc = '/storage/v1/object/public/acervo/';
  const i = url.indexOf(marc);
  return i >= 0 ? url.slice(i + marc.length) : null;
}

// ----- Modal material -----
window.abrirModalMaterial = function (tipo, dados = null) {
  document.getElementById('modalMaterial').classList.remove('hidden');
  document.getElementById('formMaterial').reset();
  document.getElementById('mTipo').value = tipo;

  ['campoArquivo', 'campoVideo', 'campoDica'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('mArquivoAtual').classList.add('hidden');
  document.getElementById('mArquivoAtual').textContent = '';

  if (tipo === 'pdf' || tipo === 'lista') document.getElementById('campoArquivo').classList.remove('hidden');
  if (tipo === 'video') document.getElementById('campoVideo').classList.remove('hidden');
  if (tipo === 'dica') document.getElementById('campoDica').classList.remove('hidden');

  document.getElementById('modalMaterialTitulo').textContent =
    (dados ? 'Editar ' : 'Novo ') + window.LABEL_TIPO[tipo].toLowerCase();

  if (dados) {
    document.getElementById('mId').value = dados.id;
    document.getElementById('mTitulo').value = dados.titulo;
    document.getElementById('mDesc').value = dados.descricao || '';
    if (tipo === 'video') document.getElementById('mUrlVideo').value = dados.url || '';
    if (tipo === 'pdf' || tipo === 'lista') {
      // Se url for do storage, mostra como "atual"; se externa, vai pro campo de URL externa
      if (dados.url && pathStorageAcervo(dados.url)) {
        const lbl = document.getElementById('mArquivoAtual');
        lbl.textContent = 'Arquivo atual mantido se você não enviar outro.';
        lbl.classList.remove('hidden');
      } else if (dados.url) {
        document.getElementById('mUrlExterna').value = dados.url;
      }
    }
    if (tipo === 'dica') document.getElementById('mConteudo').value = dados.conteudo || '';
  } else {
    document.getElementById('mId').value = '';
  }
};
window.fecharModalMaterial = function () {
  document.getElementById('modalMaterial').classList.add('hidden');
};

async function salvarMaterial(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSalvarMaterial');
  btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Salvando...';
  try {
    const tipo = document.getElementById('mTipo').value;
    const id = document.getElementById('mId').value;
    const payload = {
      pasta_id: PASTA_ATUAL,
      tipo,
      titulo: document.getElementById('mTitulo').value.trim(),
      descricao: document.getElementById('mDesc').value.trim() || null,
      url: null,
      conteudo: null,
    };

    if (tipo === 'video') {
      payload.url = document.getElementById('mUrlVideo').value.trim() || null;
    } else if (tipo === 'dica') {
      payload.conteudo = document.getElementById('mConteudo').value.trim() || null;
    } else if (tipo === 'pdf' || tipo === 'lista') {
      const file = document.getElementById('mArquivo').files[0];
      const urlExterna = document.getElementById('mUrlExterna').value.trim();
      if (file) {
        if (file.size > MAX_PDF_BYTES) throw new Error('Arquivo maior que 30MB.');
        // Apaga o anterior se for do storage
        if (id) {
          const { data: ant } = await window.db.from('materiais').select('url').eq('id', id).single();
          const oldP = pathStorageAcervo(ant?.url);
          if (oldP) await window.db.storage.from('acervo').remove([oldP]);
        }
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const path = `${tipo}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await window.db.storage.from('acervo').upload(path, file, {
          cacheControl: '3600', contentType: file.type
        });
        if (upErr) throw upErr;
        const { data: pub } = window.db.storage.from('acervo').getPublicUrl(path);
        payload.url = pub.publicUrl;
      } else if (urlExterna) {
        payload.url = urlExterna;
      } else if (id) {
        // Mantém URL antiga
        const { data: ant } = await window.db.from('materiais').select('url').eq('id', id).single();
        payload.url = ant?.url || null;
      }
    }

    const req = id
      ? window.db.from('materiais').update(payload).eq('id', id)
      : window.db.from('materiais').insert(payload);
    const { error } = await req;
    if (error) throw error;
    toast(id ? 'Material atualizado.' : 'Material salvo.', 'ok');
    fecharModalMaterial();
    renderizarConteudoAcervo();
  } catch (err) {
    toast('Erro: ' + (err.message || err), 'err');
  } finally {
    btn.disabled = false; btn.textContent = txt;
  }
}
window.editarMaterial = async function (id) {
  const { data } = await window.db.from('materiais').select('*').eq('id', id).single();
  if (data) abrirModalMaterial(data.tipo, data);
};
window.excluirMaterial = async function (id) {
  if (!confirm('Excluir este material?')) return;
  const { data } = await window.db.from('materiais').select('url').eq('id', id).single();
  const p = pathStorageAcervo(data?.url);
  if (p) await window.db.storage.from('acervo').remove([p]);
  const { error } = await window.db.from('materiais').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('Material excluído.', 'ok');
  renderizarConteudoAcervo();
};

// Visualizador (compartilhado com o aluno)
function abrirVisualizadorMaterial(m) {
  let body = '';
  if (m.tipo === 'video') {
    body = window.embedVideo(m.url);
  } else if (m.tipo === 'pdf' || m.tipo === 'lista') {
    if (m.url) {
      body = `<div class="player-wrap"><iframe src="${escapeHtml(m.url)}" allow="autoplay"></iframe></div>
              <p class="mt-2"><a href="${escapeHtml(m.url)}" target="_blank">Abrir em nova aba ↗</a></p>`;
    } else {
      body = '<p class="muted">Sem arquivo associado.</p>';
    }
  } else if (m.tipo === 'dica') {
    body = `<div style="white-space:pre-wrap; line-height:1.7;">${escapeHtml(m.conteudo || '')}</div>`;
  }
  const html = `
    <div class="panel-head">
      <h3 class="panel-title">${escapeHtml(m.titulo)}</h3>
    </div>
    <div class="panel-body">
      <div class="row wrap" style="gap:.4rem; margin-bottom:.8rem;">
        <span class="chip gold">${window.LABEL_TIPO[m.tipo]}</span>
      </div>
      ${m.descricao ? `<p class="muted">${escapeHtml(m.descricao)}</p>` : ''}
      <div class="mt-2">${body}</div>
    </div>
  `;
  abrirModalCustom(html);
}
window.abrirVisualizadorMaterial = abrirVisualizadorMaterial;

// ==========================================================
// CICLO DE ESTUDOS
// ==========================================================
async function carregarCicloAluno() {
  const id = document.getElementById('cicloAluno').value;
  const box = document.getElementById('cicloConfigBox');
  const preview = document.getElementById('cicloPreview');
  if (!id) {
    box.classList.add('hidden');
    preview.innerHTML = '<p class="muted small">Selecione um aluno para ver o progresso da semana.</p>';
    return;
  }
  box.classList.remove('hidden');

  const { data: metas } = await window.db.from('ciclo_metas').select('*').eq('aluno_id', id);
  const mapa = {};
  (metas || []).forEach(m => { mapa[m.materia] = m.minutos_semanais; });

  const lista = document.getElementById('cicloConfigList');
  lista.innerHTML = window.MATERIAS.map(m => {
    const horas = ((mapa[m] || 0) / 60).toFixed(1).replace('.0', '');
    return `
      <div class="row" style="gap:.6rem; margin-bottom:.5rem;">
        <span style="flex:1;">${escapeHtml(m)}</span>
        <input class="input" type="number" min="0" step="0.5" data-materia="${escapeHtml(m)}"
               value="${horas === '0' ? '' : horas}" placeholder="0" style="width:90px;" />
        <span class="muted small">h/sem</span>
      </div>
    `;
  }).join('');

  await renderizarCicloPreview(id);
}

async function salvarCiclo() {
  const id = document.getElementById('cicloAluno').value;
  if (!id) return;
  const inputs = document.querySelectorAll('#cicloConfigList input[data-materia]');
  const linhas = [];
  inputs.forEach(i => {
    const horas = parseFloat(i.value) || 0;
    linhas.push({
      aluno_id: id,
      materia: i.dataset.materia,
      minutos_semanais: Math.round(horas * 60),
    });
  });
  const { error } = await window.db
    .from('ciclo_metas')
    .upsert(linhas, { onConflict: 'aluno_id,materia' });
  if (error) { toast(error.message, 'err'); return; }
  toast('Ciclo salvo.', 'ok');
  renderizarCicloPreview(id);
}

async function renderizarCicloPreview(alunoId) {
  const inicio = window.inicioSemana();
  const inicioISO = inicio.toISOString().slice(0, 10);

  const [{ data: metas }, { data: sessoes }] = await Promise.all([
    window.db.from('ciclo_metas').select('*').eq('aluno_id', alunoId),
    window.db.from('sessoes_estudo').select('materia, duracao_minutos')
      .eq('aluno_id', alunoId).gte('data_estudo', inicioISO),
  ]);

  const ativas = (metas || []).filter(m => m.minutos_semanais > 0);
  const el = document.getElementById('cicloPreview');
  if (!ativas.length) {
    el.innerHTML = '<p class="muted small">Sem matérias com meta definida ainda.</p>';
    return;
  }
  const acumulado = {};
  (sessoes || []).forEach(s => { acumulado[s.materia] = (acumulado[s.materia] || 0) + s.duracao_minutos; });

  el.innerHTML = ativas.map(m => renderCardCiclo(m, acumulado[m.materia] || 0, false)).join('');
}

function renderCardCiclo(meta, minutosFeitos, interativo) {
  const total = meta.minutos_semanais;
  const pct = Math.min(100, (minutosFeitos / total) * 100);
  // Cada bolinha = 30 min
  const totalBolinhas = Math.max(1, Math.ceil(total / 30));
  const cheias = Math.floor(minutosFeitos / 30);
  const minutoParcial = minutosFeitos % 30;
  const completo = minutosFeitos >= total;

  let bolinhas = '';
  for (let i = 0; i < totalBolinhas; i++) {
    if (i < cheias) bolinhas += '<div class="bolinha cheia"></div>';
    else if (i === cheias && minutoParcial > 0) {
      const p = (minutoParcial / 30) * 100;
      bolinhas += `<div class="bolinha parcial" style="--p:${p}%"></div>`;
    } else bolinhas += '<div class="bolinha"></div>';
  }

  const acoes = interativo ? `
    <div class="ciclo-actions mt-2">
      <button class="btn btn-sm" onclick="registroRapido('${escapeHtml(meta.materia)}', 30)">+30min</button>
      <button class="btn btn-ghost btn-sm" onclick="registroRapido('${escapeHtml(meta.materia)}', 60)">+1h</button>
    </div>` : '';

  return `
    <div class="ciclo-card ${completo ? 'completo' : ''}">
      <div class="ciclo-head">
        <span class="ciclo-materia">${escapeHtml(meta.materia)}</span>
        <span class="ciclo-progresso">${window.fmtMin(minutosFeitos)} / ${window.fmtMin(total)}</span>
      </div>
      <div class="bolinhas">${bolinhas}</div>
      <div class="ciclo-bar"><div style="width:${pct}%;"></div></div>
      ${acoes}
    </div>
  `;
}
window.renderCardCiclo = renderCardCiclo;
