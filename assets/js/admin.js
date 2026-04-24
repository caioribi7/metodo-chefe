// ==========================================================
// MÉTODO CHEFE — Painel do admin (mentor)
// ==========================================================

let CURRENT = null;
let CACHE_ALUNOS = [];

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

  document.querySelectorAll('[data-filtro-tc]').forEach(b => {
    b.addEventListener('click', () => carregarTcsAdmin(b.dataset.filtroTc));
  });

  ['aqfMateria', 'aqfDif'].forEach(id => document.getElementById(id).addEventListener('change', carregarQuestoesAdmin));
  document.getElementById('aqfFonte').addEventListener('input', debounce(carregarQuestoesAdmin, 300));

  // Carregar tudo
  carregarStats();
  carregarAlunos();
  carregarTcsAdmin('todas');
  carregarQuestoesAdmin();
  carregarFeedRecente();
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
  const fonte = document.getElementById('aqfFonte').value.trim();
  if (mat) q = q.eq('materia', mat);
  if (dif) q = q.eq('dificuldade', dif);
  if (fonte) q = q.ilike('fonte', `%${fonte}%`);
  const { data, error } = await q;
  const el = document.getElementById('listaQuestoesAdmin');
  if (error) { el.innerHTML = `<p class="muted">${error.message}</p>`; return; }
  if (!data.length) { el.innerHTML = '<p class="muted">Nenhuma questão ainda. Adicione a primeira.</p>'; return; }
  el.innerHTML = data.map(q => `
    <div class="panel panel-body" style="margin-bottom:1rem;">
      <div class="row wrap" style="gap:.4rem; margin-bottom:.5rem;">
        <span class="chip gold">${escapeHtml(q.materia)}</span>
        ${q.assunto ? `<span class="chip">${escapeHtml(q.assunto)}</span>` : ''}
        ${q.fonte ? `<span class="chip">${escapeHtml(q.fonte)}${q.ano ? ' · ' + q.ano : ''}</span>` : ''}
        ${q.dificuldade ? `<span class="chip ${q.dificuldade === 'dificil' ? 'danger' : q.dificuldade === 'medio' ? 'warn' : 'ok'}">${q.dificuldade}</span>` : ''}
      </div>
      <div style="white-space:pre-wrap;">${escapeHtml(q.enunciado.slice(0, 280))}${q.enunciado.length > 280 ? '...' : ''}</div>
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
  if (q && q.id) {
    document.getElementById('modalQuestaoTitulo').textContent = 'Editar questão';
    document.getElementById('qId').value = q.id;
    document.getElementById('qEnun').value = q.enunciado || '';
    document.getElementById('qMat').value = q.materia || '';
    document.getElementById('qAssunto').value = q.assunto || '';
    document.getElementById('qDif').value = q.dificuldade || '';
    document.getElementById('qFonte').value = q.fonte || '';
    document.getElementById('qAno').value = q.ano || '';
    document.getElementById('qResp').value = q.resposta_correta || '';
    document.getElementById('qResol').value = q.resolucao || '';
    const alts = q.alternativas || {};
    ['a', 'b', 'c', 'd', 'e'].forEach(k => {
      document.getElementById('qA_' + k).value = alts[k] || '';
    });
  } else {
    document.getElementById('modalQuestaoTitulo').textContent = 'Nova questão';
    document.getElementById('qId').value = '';
  }
};
window.fecharModalQuestao = function () {
  document.getElementById('modalQuestao').classList.add('hidden');
};

async function salvarQuestao(e) {
  e.preventDefault();
  const alts = {};
  ['a', 'b', 'c', 'd', 'e'].forEach(k => {
    const v = document.getElementById('qA_' + k).value.trim();
    if (v) alts[k] = v;
  });
  const payload = {
    enunciado: document.getElementById('qEnun').value.trim(),
    materia: document.getElementById('qMat').value,
    assunto: document.getElementById('qAssunto').value.trim() || null,
    dificuldade: document.getElementById('qDif').value || null,
    fonte: document.getElementById('qFonte').value.trim() || null,
    ano: document.getElementById('qAno').value ? parseInt(document.getElementById('qAno').value) : null,
    alternativas: Object.keys(alts).length ? alts : null,
    resposta_correta: document.getElementById('qResp').value.trim() || null,
    resolucao: document.getElementById('qResol').value.trim() || null,
  };
  const id = document.getElementById('qId').value;
  const req = id
    ? window.db.from('questoes').update(payload).eq('id', id)
    : window.db.from('questoes').insert(payload);
  const { error } = await req;
  if (error) { toast(error.message, 'err'); return; }
  toast('Questão salva.', 'ok');
  fecharModalQuestao();
  carregarStats();
  carregarQuestoesAdmin();
}

window.excluirQuestao = async function (id) {
  if (!confirm('Excluir esta questão permanentemente?')) return;
  const { error } = await window.db.from('questoes').delete().eq('id', id);
  if (error) { toast(error.message, 'err'); return; }
  toast('Questão excluída.', 'ok');
  carregarStats();
  carregarQuestoesAdmin();
};
