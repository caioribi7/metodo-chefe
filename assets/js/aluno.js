// ==========================================================
// MÉTODO CHEFE — Painel do aluno
// ==========================================================

let CURRENT = null; // { session, profile }

(async () => {
  const r = await window.requireAuth('aluno');
  if (!r) return;
  CURRENT = r;
  inicializar();
})();

function inicializar() {
  document.getElementById('boasVindas').textContent =
    CURRENT.profile.nome.split(' ')[0];

  const chips = document.getElementById('perfilChips');
  chips.innerHTML = '';
  if (CURRENT.profile.escolaridade)
    chips.appendChild(chip(CURRENT.profile.escolaridade));
  if (CURRENT.profile.prova_militar)
    chips.appendChild(chip('🎯 ' + CURRENT.profile.prova_militar, 'gold'));
  (CURRENT.profile.olimpiadas || []).forEach(o => chips.appendChild(chip(o, 'gold')));

  // Popula selects de matéria
  const sMat = document.getElementById('sMateria');
  const qfMat = document.getElementById('qfMateria');
  sMat.innerHTML = '<option value="">Selecione...</option>';
  window.MATERIAS.forEach(m => {
    sMat.insertAdjacentHTML('beforeend', `<option>${m}</option>`);
    qfMat.insertAdjacentHTML('beforeend', `<option>${m}</option>`);
  });

  // Data atual
  document.getElementById('sData').value = new Date().toISOString().slice(0, 10);

  // Tabs
  document.querySelectorAll('[data-tab]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      trocarAba(a.dataset.tab);
    });
  });

  // Sair
  document.getElementById('btnSair').addEventListener('click', async (e) => {
    e.preventDefault();
    await window.db.auth.signOut();
    location.href = 'index.html';
  });

  // Form sessão
  document.getElementById('formSessao').addEventListener('submit', criarSessao);

  // Filtro TCs
  document.querySelectorAll('[data-filtro-tc]').forEach(b => {
    b.addEventListener('click', () => carregarTCs(b.dataset.filtroTc));
  });

  // Filtros questões
  ['qfMateria', 'qfDif', 'qfFonte'].forEach(id => {
    document.getElementById(id).addEventListener('change', carregarQuestoes);
  });
  document.getElementById('qfFonte').addEventListener('input', debounce(carregarQuestoes, 300));

  // Carregas iniciais
  carregarStats();
  carregarSessoes();
  carregarTCs('todas');
  carregarTcsPendentesPainel();
  carregarQuestoes();
  carregarCicloAluno();
  navegarPastaAluno(null);
}

function chip(txt, cls = '') {
  const s = document.createElement('span');
  s.className = 'chip ' + cls;
  s.textContent = txt;
  return s;
}

function trocarAba(nome) {
  document.querySelectorAll('[data-painel]').forEach(p => p.classList.add('hidden'));
  document.querySelector(`[data-painel="${nome}"]`).classList.remove('hidden');
  document.querySelectorAll('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === nome));
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- SESSÕES ----------
async function criarSessao(e) {
  e.preventDefault();
  const payload = {
    aluno_id: CURRENT.session.user.id,
    materia: document.getElementById('sMateria').value,
    topico: document.getElementById('sTopico').value.trim() || null,
    duracao_minutos: parseInt(document.getElementById('sDuracao').value, 10),
    data_estudo: document.getElementById('sData').value,
    observacoes: document.getElementById('sObs').value.trim() || null,
  };
  const { error } = await window.db.from('sessoes_estudo').insert(payload);
  if (error) { toast('Erro: ' + error.message, 'err'); return; }
  toast('Sessão registrada. Continue firme.', 'ok');
  e.target.reset();
  document.getElementById('sData').value = new Date().toISOString().slice(0, 10);
  carregarStats();
  carregarSessoes();
  carregarCicloAluno();
}

async function carregarStats() {
  const hoje = new Date().toISOString().slice(0, 10);
  const semanaInicio = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const { data: sessoes } = await window.db
    .from('sessoes_estudo')
    .select('duracao_minutos, data_estudo')
    .gte('data_estudo', semanaInicio);

  const totHoje = (sessoes || []).filter(s => s.data_estudo === hoje).reduce((a, b) => a + b.duracao_minutos, 0);
  const totSemana = (sessoes || []).reduce((a, b) => a + b.duracao_minutos, 0);
  document.getElementById('statHoje').textContent = formatarHoras(totHoje);
  document.getElementById('statSemana').textContent = formatarHoras(totSemana);
}

function formatarHoras(min) {
  if (!min) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return m + 'min';
  if (m === 0) return h + 'h';
  return `${h}h${String(m).padStart(2, '0')}`;
}

async function carregarSessoes() {
  const { data, error } = await window.db
    .from('sessoes_estudo')
    .select('*')
    .order('data_estudo', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  const tb = document.getElementById('tbodySessoes');
  if (error) { tb.innerHTML = `<tr><td colspan="6" class="muted">${error.message}</td></tr>`; return; }
  if (!data.length) { tb.innerHTML = `<tr><td colspan="6" class="muted">Nenhuma sessão registrada ainda.</td></tr>`; return; }
  tb.innerHTML = data.map(s => `
    <tr>
      <td class="font-mono small">${fmtData(s.data_estudo)}</td>
      <td>${escapeHtml(s.materia)}</td>
      <td class="muted small">${escapeHtml(s.topico || '—')}</td>
      <td><span class="chip gold">${formatarHoras(s.duracao_minutos)}</span></td>
      <td class="muted small">${escapeHtml(s.observacoes || '')}</td>
      <td><button class="btn btn-danger btn-sm" onclick="excluirSessao('${s.id}')">×</button></td>
    </tr>
  `).join('');
}

window.excluirSessao = async function (id) {
  if (!confirm('Excluir esta sessão?')) return;
  const { error } = await window.db.from('sessoes_estudo').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('Sessão excluída', 'ok');
  carregarStats(); carregarSessoes(); carregarCicloAluno();
};

// ---------- TCs ----------
async function carregarTCs(filtro) {
  let q = window.db.from('tarefas_casa').select('*').order('prazo', { ascending: true, nullsFirst: false });
  if (filtro === 'pendente') q = q.eq('status', 'pendente');
  if (filtro === 'concluida') q = q.eq('status', 'concluida');
  const { data, error } = await q;
  const el = document.getElementById('listaTcs');
  if (error) { el.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = `<p class="muted">Sem TCs nesta categoria.</p>`; return; }
  el.innerHTML = data.map(cardTC).join('');
}

async function carregarTcsPendentesPainel() {
  const { data } = await window.db
    .from('tarefas_casa').select('*')
    .eq('status', 'pendente')
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(5);
  const el = document.getElementById('listaTcsPendentes');
  if (!data || !data.length) { el.innerHTML = '<p class="muted small">Nenhuma TC pendente. Bom trabalho.</p>'; return; }
  el.innerHTML = data.map(cardTC).join('');
}

function cardTC(t) {
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasada = t.status === 'pendente' && t.prazo && t.prazo < hoje;
  const concluida = t.status === 'concluida';
  return `
    <div class="panel panel-body" style="margin-bottom:.8rem;">
      <div class="row between wrap" style="gap:.8rem;">
        <div style="flex:1; min-width:260px;">
          <div class="row wrap" style="gap:.4rem; margin-bottom:.4rem;">
            ${t.materia ? `<span class="chip gold">${escapeHtml(t.materia)}</span>` : ''}
            ${concluida ? `<span class="chip ok">Concluída</span>` :
              atrasada ? `<span class="chip danger">Atrasada</span>` :
              `<span class="chip warn">Pendente</span>`}
            ${t.prazo ? `<span class="chip">Prazo: ${fmtData(t.prazo)}</span>` : ''}
          </div>
          <h3 style="margin:0; font-family: 'Playfair Display', serif; font-size:1.15rem;">${escapeHtml(t.titulo)}</h3>
          ${t.descricao ? `<p class="muted small" style="margin:.4rem 0 0;">${escapeHtml(t.descricao)}</p>` : ''}
        </div>
        <div class="row">
          ${!concluida
            ? `<button class="btn btn-sm" onclick="marcarTC('${t.id}', 'concluida')">Marcar como concluída</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="marcarTC('${t.id}', 'pendente')">Reabrir</button>`}
        </div>
      </div>
    </div>
  `;
}

window.marcarTC = async function (id, status) {
  const patch = { status, concluida_em: status === 'concluida' ? new Date().toISOString() : null };
  const { error } = await window.db.from('tarefas_casa').update(patch).eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast(status === 'concluida' ? 'TC concluída. Parabéns.' : 'TC reaberta', 'ok');
  carregarTCs('todas');
  carregarTcsPendentesPainel();
};

// ---------- QUESTÕES ----------
async function carregarQuestoes() {
  let q = window.db.from('questoes').select('*').order('created_at', { ascending: false }).limit(50);
  const mat = document.getElementById('qfMateria').value;
  const dif = document.getElementById('qfDif').value;
  const fonte = document.getElementById('qfFonte').value.trim();
  if (mat) q = q.eq('materia', mat);
  if (dif) q = q.eq('dificuldade', dif);
  if (fonte) q = q.ilike('fonte', `%${fonte}%`);
  const { data, error } = await q;
  const el = document.getElementById('listaQuestoes');
  if (error) { el.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = `<p class="muted">Nenhuma questão encontrada com esses filtros.</p>`; return; }
  el.innerHTML = data.map(cardQuestao).join('');
}

// ==========================================================
// CICLO DE ESTUDOS (aluno)
// ==========================================================
async function carregarCicloAluno() {
  const inicio = window.inicioSemana();
  const fim = new Date(inicio); fim.setDate(fim.getDate() + 6);
  const inicioISO = inicio.toISOString().slice(0, 10);

  document.getElementById('cicloPeriodo').textContent =
    `Semana de ${fmtData(inicio.toISOString())} a ${fmtData(fim.toISOString())}`;

  const [{ data: metas }, { data: sessoes }] = await Promise.all([
    window.db.from('ciclo_metas').select('*').eq('aluno_id', CURRENT.session.user.id),
    window.db.from('sessoes_estudo')
      .select('materia, duracao_minutos')
      .eq('aluno_id', CURRENT.session.user.id)
      .gte('data_estudo', inicioISO),
  ]);

  const ativas = (metas || []).filter(m => m.minutos_semanais > 0);
  const lista = document.getElementById('cicloAlunoLista');

  if (!ativas.length) {
    lista.innerHTML = `
      <div class="panel panel-body" style="text-align:center;">
        <p class="muted">Seu ciclo ainda não foi configurado pelo mentor.</p>
        <p class="small muted">Quando ele definir suas horas semanais por matéria, elas aparecem aqui com bolinhas pra você marcar conforme estuda.</p>
      </div>`;
    document.getElementById('cicloPctGeral').textContent = '0%';
    document.getElementById('cicloTotalGeral').textContent = '0h / 0h';
    return;
  }

  const acumulado = {};
  (sessoes || []).forEach(s => { acumulado[s.materia] = (acumulado[s.materia] || 0) + s.duracao_minutos; });

  let totalMeta = 0, totalFeito = 0;
  ativas.forEach(m => {
    totalMeta += m.minutos_semanais;
    totalFeito += Math.min(m.minutos_semanais, acumulado[m.materia] || 0);
  });
  const pct = totalMeta ? Math.round((totalFeito / totalMeta) * 100) : 0;
  document.getElementById('cicloPctGeral').textContent = pct + '%';
  document.getElementById('cicloTotalGeral').textContent =
    `${window.fmtMin(totalFeito)} / ${window.fmtMin(totalMeta)}`;

  lista.innerHTML = ativas.map(m => renderCardCicloAluno(m, acumulado[m.materia] || 0)).join('');
}

function renderCardCicloAluno(meta, minutosFeitos) {
  const total = meta.minutos_semanais;
  const pct = Math.min(100, (minutosFeitos / total) * 100);
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

  return `
    <div class="ciclo-card ${completo ? 'completo' : ''}">
      <div class="ciclo-head">
        <span class="ciclo-materia">${escapeHtml(meta.materia)}</span>
        <span class="ciclo-progresso">${window.fmtMin(minutosFeitos)} / ${window.fmtMin(total)}</span>
      </div>
      <div class="bolinhas">${bolinhas}</div>
      <div class="ciclo-bar"><div style="width:${pct}%;"></div></div>
      <div class="ciclo-actions mt-2">
        <button class="btn btn-sm" onclick="registroRapido('${escapeHtml(meta.materia)}', 30)">+30min</button>
        <button class="btn btn-ghost btn-sm" onclick="registroRapido('${escapeHtml(meta.materia)}', 60)">+1h</button>
      </div>
    </div>
  `;
}

window.registroRapido = async function (materia, minutos) {
  const payload = {
    aluno_id: CURRENT.session.user.id,
    materia,
    duracao_minutos: minutos,
    data_estudo: new Date().toISOString().slice(0, 10),
    observacoes: 'Registro rápido (ciclo)',
  };
  const { error } = await window.db.from('sessoes_estudo').insert(payload);
  if (error) { toast(error.message, 'err'); return; }
  toast(`+${minutos}min em ${materia}.`, 'ok');
  carregarStats();
  carregarSessoes();
  carregarCicloAluno();
};

// ==========================================================
// ACERVO (aluno — só leitura)
// ==========================================================
let PASTA_ATUAL_AL = null;
let CAMINHO_AL = [];

async function navegarPastaAluno(pastaId) {
  PASTA_ATUAL_AL = pastaId;
  if (pastaId === null) CAMINHO_AL = [];
  else {
    CAMINHO_AL = [];
    let atual = pastaId;
    while (atual) {
      const { data } = await window.db.from('pastas').select('id, nome, parent_id').eq('id', atual).single();
      if (!data) break;
      CAMINHO_AL.unshift({ id: data.id, nome: data.nome });
      atual = data.parent_id;
    }
  }
  renderBreadcrumbAluno();
  renderConteudoAcervoAluno();
}
window.navegarPastaAluno = navegarPastaAluno;

function renderBreadcrumbAluno() {
  const el = document.getElementById('breadcrumbAluno');
  let html = `<a href="#" onclick="navegarPastaAluno(null); return false;">Raiz</a>`;
  CAMINHO_AL.forEach((p, i) => {
    const ult = i === CAMINHO_AL.length - 1;
    html += ` <span class="sep">›</span> `;
    html += ult
      ? `<span class="atual">${escapeHtml(p.nome)}</span>`
      : `<a href="#" onclick="navegarPastaAluno('${p.id}'); return false;">${escapeHtml(p.nome)}</a>`;
  });
  el.innerHTML = html;
}

async function renderConteudoAcervoAluno() {
  const el = document.getElementById('acervoConteudoAluno');
  el.innerHTML = '<p class="muted small">Carregando...</p>';
  const [{ data: pastas }, { data: mats }] = await Promise.all([
    PASTA_ATUAL_AL
      ? window.db.from('pastas').select('*').eq('parent_id', PASTA_ATUAL_AL).order('ordem').order('nome')
      : window.db.from('pastas').select('*').is('parent_id', null).order('ordem').order('nome'),
    PASTA_ATUAL_AL
      ? window.db.from('materiais').select('*').eq('pasta_id', PASTA_ATUAL_AL).order('ordem').order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  const cards = [];
  (pastas || []).forEach(p => {
    cards.push(`
      <div class="acervo-card" onclick="navegarPastaAluno('${p.id}')">
        <div class="ac-icon">${window.iconeMat(p.tipo)}</div>
        <div class="ac-meta">${p.tipo === 'curso' ? 'Curso' : 'Pasta'}</div>
        <div class="ac-titulo">${escapeHtml(p.nome)}</div>
        ${p.descricao ? `<div class="muted small">${escapeHtml(p.descricao)}</div>` : ''}
      </div>
    `);
  });
  (mats || []).forEach(m => {
    cards.push(`
      <div class="acervo-card" onclick='abrirMaterialAluno(${JSON.stringify(m).replace(/'/g, "&#39;")})'>
        <div class="ac-icon">${window.iconeMat(m.tipo)}</div>
        <div class="ac-meta">${window.LABEL_TIPO[m.tipo]}</div>
        <div class="ac-titulo">${escapeHtml(m.titulo)}</div>
        ${m.descricao ? `<div class="muted small">${escapeHtml(m.descricao.slice(0, 90))}${m.descricao.length > 90 ? '...' : ''}</div>` : ''}
      </div>
    `);
  });

  el.innerHTML = cards.length
    ? `<div class="acervo-grid">${cards.join('')}</div>`
    : '<p class="muted">Esta pasta está vazia.</p>';
}

window.abrirMaterialAluno = function (m) {
  let body = '';
  if (m.tipo === 'video') {
    body = window.embedVideo(m.url);
  } else if (m.tipo === 'pdf' || m.tipo === 'lista') {
    if (m.url) {
      body = `<div class="player-wrap"><iframe src="${escapeHtml(m.url)}"></iframe></div>
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
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.onclick = e => { if (e.target === back) back.remove(); };
  back.innerHTML = `<div class="modal panel"><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button>${html}</div>`;
  document.body.appendChild(back);
};

function cardQuestao(q) {
  const alternativas = q.alternativas && typeof q.alternativas === 'object'
    ? Object.entries(q.alternativas).map(([k, v]) => `<li><strong class="gold">${k.toUpperCase()})</strong> ${escapeHtml(v)}</li>`).join('')
    : '';
  const imgEnun = q.imagem_url
    ? `<div style="margin:.4rem 0 .8rem;"><img src="${escapeHtml(q.imagem_url)}" alt="Imagem do enunciado" style="max-width:100%; max-height:420px; border:1px solid var(--border); cursor:zoom-in;" onclick="window.open(this.src,'_blank')" /></div>`
    : '';
  const imgResol = q.imagem_resolucao_url
    ? `<div style="margin:.6rem 0;"><img src="${escapeHtml(q.imagem_resolucao_url)}" alt="Imagem da resolução" style="max-width:100%; max-height:420px; border:1px solid var(--border); cursor:zoom-in;" onclick="window.open(this.src,'_blank')" /></div>`
    : '';
  return `
    <div class="panel panel-body" style="margin-bottom:1rem;">
      <div class="row wrap" style="gap:.4rem; margin-bottom:.6rem;">
        <span class="chip gold">${escapeHtml(q.materia)}</span>
        ${q.assunto ? `<span class="chip">${escapeHtml(q.assunto)}</span>` : ''}
        ${q.fonte ? `<span class="chip">${escapeHtml(q.fonte)}${q.ano ? ' · ' + q.ano : ''}</span>` : ''}
        ${q.dificuldade ? `<span class="chip ${q.dificuldade === 'dificil' ? 'danger' : q.dificuldade === 'medio' ? 'warn' : 'ok'}">${q.dificuldade}</span>` : ''}
      </div>
      <div style="white-space:pre-wrap; margin-bottom:.6rem;">${escapeHtml(q.enunciado)}</div>
      ${imgEnun}
      ${alternativas ? `<ul style="list-style:none; padding-left:0; display:flex; flex-direction:column; gap:.3rem;">${alternativas}</ul>` : ''}
      ${q.resolucao || q.resposta_correta || q.imagem_resolucao_url ? `
        <details style="margin-top:.8rem; border-top:1px solid var(--border); padding-top:.6rem;">
          <summary style="cursor:pointer; color:var(--gold); font-family: 'JetBrains Mono', monospace; font-size:.75rem; letter-spacing:.15em; text-transform:uppercase;">▸ Ver gabarito e resolução</summary>
          <div style="margin-top:.6rem;">
            ${q.resposta_correta ? `<p><strong class="gold">Resposta:</strong> ${escapeHtml(q.resposta_correta)}</p>` : ''}
            ${q.resolucao ? `<div style="white-space:pre-wrap; color:var(--cream-dim);">${escapeHtml(q.resolucao)}</div>` : ''}
            ${imgResol}
          </div>
        </details>` : ''}
    </div>
  `;
}
