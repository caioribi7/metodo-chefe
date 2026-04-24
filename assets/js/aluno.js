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
  carregarStats(); carregarSessoes();
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
