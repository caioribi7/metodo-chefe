// ==========================================================
// MÉTODO CHEFE — Fórum de dúvidas (aluno e admin compartilham)
// Requer: window.db, window.escapeHtml, window.fmtData, window.MATERIAS,
// e um window.FORUM_USER = { id, nome, isAdmin } setado pelo chamador.
// ==========================================================

(function () {
  let TOPICO_ABERTO = null;

  window.iniciarForum = function () {
    const elNovo = document.getElementById('formNovoTopico');
    const elFiltroMat = document.getElementById('forumFiltroMat');
    const elFiltroStatus = document.getElementById('forumFiltroStatus');
    const elNovoMat = document.getElementById('forumNovoMateria');
    if (!elNovo) return;

    // Popula matérias
    elNovoMat.innerHTML = '<option value="">— Geral —</option>';
    elFiltroMat.innerHTML = '<option value="">Todas</option>';
    window.MATERIAS.forEach(m => {
      elNovoMat.insertAdjacentHTML('beforeend', `<option>${m}</option>`);
      elFiltroMat.insertAdjacentHTML('beforeend', `<option>${m}</option>`);
    });

    elNovo.addEventListener('submit', criarTopico);
    elFiltroMat.addEventListener('change', listarTopicos);
    elFiltroStatus.addEventListener('change', listarTopicos);

    listarTopicos();
  };

  async function criarTopico(e) {
    e.preventDefault();
    const titulo = document.getElementById('forumNovoTitulo').value.trim();
    const conteudo = document.getElementById('forumNovoConteudo').value.trim();
    const materia = document.getElementById('forumNovoMateria').value || null;
    if (!titulo || !conteudo) { window.toast('Preencha título e conteúdo.', 'err'); return; }

    const { error } = await window.db.from('topicos_duvidas').insert({
      autor_id: window.FORUM_USER.id,
      titulo, conteudo, materia
    });
    if (error) { window.toast(error.message, 'err'); return; }

    window.toast('Dúvida publicada!', 'ok');
    e.target.reset();
    listarTopicos();
  }

  async function listarTopicos() {
    const mat = document.getElementById('forumFiltroMat').value;
    const status = document.getElementById('forumFiltroStatus').value;
    let q = window.db.from('topicos_duvidas_view').select('*').order('created_at', { ascending: false }).limit(80);
    if (mat) q = q.eq('materia', mat);
    if (status === 'aberto') q = q.eq('resolvido', false);
    if (status === 'resolvido') q = q.eq('resolvido', true);

    const { data, error } = await q;
    const el = document.getElementById('forumLista');
    if (error) { el.innerHTML = `<p class="muted small">${window.escapeHtml(error.message)}</p>`; return; }
    if (!data || !data.length) {
      el.innerHTML = '<p class="muted small">Nenhuma dúvida ainda. Seja o primeiro a perguntar.</p>';
      return;
    }
    el.innerHTML = data.map(t => `
      <div class="forum-topico ${t.resolvido ? 'resolvido' : ''}" onclick="abrirTopico('${t.id}')">
        <h3 class="forum-topico-titulo">${window.escapeHtml(t.titulo)}</h3>
        <div class="forum-topico-meta">
          <span class="autor">${window.escapeHtml(String(t.autor_nome).split(' ')[0])}${t.autor_role === 'admin' ? ' • mentor' : ''}</span>
          <span>·</span>
          <span>${window.fmtData(t.created_at)}</span>
          ${t.materia ? `<span>·</span><span class="chip" style="font-size:.65rem; padding:.1rem .4rem;">${window.escapeHtml(t.materia)}</span>` : ''}
          <span>·</span>
          <span>${t.qtd_respostas} resposta${t.qtd_respostas == 1 ? '' : 's'}</span>
          ${t.resolvido ? '<span>·</span><span class="badge-solucao">✓ Resolvido</span>' : ''}
        </div>
        <p class="forum-topico-conteudo-preview">${window.escapeHtml(t.conteudo)}</p>
      </div>
    `).join('');
  }

  window.abrirTopico = async function (id) {
    TOPICO_ABERTO = id;
    const [{ data: t }, { data: respostas }] = await Promise.all([
      window.db.from('topicos_duvidas_view').select('*').eq('id', id).single(),
      window.db.from('respostas_duvidas_view').select('*').eq('topico_id', id).order('created_at', { ascending: true }),
    ]);
    if (!t) return;

    const ehAutor = t.autor_id === window.FORUM_USER.id;
    const podeGerir = ehAutor || window.FORUM_USER.isAdmin;

    const html = `
      <div class="panel-head">
        <div style="flex:1; min-width:0;">
          <h3 class="panel-title" style="margin:0;">${window.escapeHtml(t.titulo)}</h3>
          <div class="forum-topico-meta mt-2">
            <span class="autor">${window.escapeHtml(String(t.autor_nome).split(' ')[0])}${t.autor_role === 'admin' ? ' • mentor' : ''}</span>
            <span>·</span>
            <span>${window.fmtData(t.created_at)}</span>
            ${t.materia ? `<span>·</span><span class="chip" style="font-size:.65rem; padding:.1rem .4rem;">${window.escapeHtml(t.materia)}</span>` : ''}
            ${t.resolvido ? '<span>·</span><span class="badge-solucao">✓ Resolvido</span>' : ''}
          </div>
        </div>
      </div>
      <div class="panel-body">
        <div class="resposta ${t.autor_role === 'admin' ? 'do-admin' : ''}">
          <div class="resposta-cabecalho">
            <span class="resposta-autor">${window.escapeHtml(String(t.autor_nome).split(' ')[0])}${t.autor_role === 'admin' ? '<span class="badge-admin">Mentor</span>' : ''}</span>
            <span class="muted small">${window.fmtData(t.created_at)}</span>
          </div>
          <div class="resposta-conteudo">${window.escapeHtml(t.conteudo)}</div>
        </div>

        <h4 class="kicker mt-3">Respostas (${(respostas || []).length})</h4>
        <div id="listaRespostas" class="mt-2"></div>

        <h4 class="kicker mt-3">Sua resposta</h4>
        <form id="formNovaResposta" class="mt-2">
          <div class="field">
            <textarea class="textarea" id="novaRespostaTexto" required placeholder="Compartilhe sua resposta, dica ou referência..." style="min-height:110px;"></textarea>
          </div>
          <div class="row wrap" style="gap:.5rem;">
            <button class="btn btn-sm" type="submit">Enviar resposta</button>
            ${podeGerir ? `
              <button class="btn btn-ghost btn-sm" type="button" onclick="alternarResolvido('${t.id}', ${!t.resolvido})">
                ${t.resolvido ? '↺ Reabrir' : '✓ Marcar como resolvido'}
              </button>
              <button class="btn btn-danger btn-sm" type="button" onclick="excluirTopico('${t.id}')">Excluir tópico</button>
            ` : ''}
          </div>
        </form>
      </div>
    `;
    abrirModalForum(html);
    renderizarRespostas(respostas || [], ehAutor);
    document.getElementById('formNovaResposta').addEventListener('submit', enviarResposta);
  };

  function renderizarRespostas(respostas, ehAutor) {
    const el = document.getElementById('listaRespostas');
    if (!respostas.length) { el.innerHTML = '<p class="muted small">Sem respostas ainda.</p>'; return; }
    el.innerHTML = respostas.map(r => {
      const isAdminResp = r.autor_role === 'admin';
      const ehAutorResp = r.autor_id === window.FORUM_USER.id;
      const podeApagar = ehAutorResp || window.FORUM_USER.isAdmin;
      return `
      <div class="resposta ${isAdminResp ? 'do-admin' : ''} ${r.marcada_solucao ? 'solucao' : ''}">
        <div class="resposta-cabecalho">
          <span class="resposta-autor">${window.escapeHtml(String(r.autor_nome).split(' ')[0])}${isAdminResp ? '<span class="badge-admin">Mentor</span>' : ''}</span>
          <div class="row" style="gap:.4rem;">
            ${r.marcada_solucao ? '<span class="badge-solucao">✓ Solução</span>' : ''}
            <span class="muted small">${window.fmtData(r.created_at)}</span>
            ${(ehAutor || window.FORUM_USER.isAdmin) ? `<button class="btn btn-ghost btn-sm" onclick="marcarSolucao('${r.id}', ${!r.marcada_solucao})">${r.marcada_solucao ? '↺' : '★'}</button>` : ''}
            ${podeApagar ? `<button class="btn btn-danger btn-sm" onclick="excluirResposta('${r.id}')">×</button>` : ''}
          </div>
        </div>
        <div class="resposta-conteudo">${window.escapeHtml(r.conteudo)}</div>
      </div>
      `;
    }).join('');
  }

  async function enviarResposta(e) {
    e.preventDefault();
    const texto = document.getElementById('novaRespostaTexto').value.trim();
    if (!texto) return;
    const { error } = await window.db.from('respostas_duvidas').insert({
      topico_id: TOPICO_ABERTO,
      autor_id: window.FORUM_USER.id,
      conteudo: texto
    });
    if (error) { window.toast(error.message, 'err'); return; }
    window.toast('Resposta publicada.', 'ok');
    document.querySelector('.modal-backdrop')?.remove();
    abrirTopico(TOPICO_ABERTO);
    listarTopicos();
  }

  window.alternarResolvido = async function (id, valor) {
    const { error } = await window.db.from('topicos_duvidas').update({ resolvido: valor }).eq('id', id);
    if (error) { window.toast(error.message, 'err'); return; }
    window.toast(valor ? 'Marcado como resolvido.' : 'Reaberto.', 'ok');
    document.querySelector('.modal-backdrop')?.remove();
    abrirTopico(id);
    listarTopicos();
  };

  window.excluirTopico = async function (id) {
    if (!confirm('Excluir este tópico e todas as respostas?')) return;
    const { error } = await window.db.from('topicos_duvidas').delete().eq('id', id);
    if (error) { window.toast(error.message, 'err'); return; }
    window.toast('Tópico excluído.', 'ok');
    document.querySelector('.modal-backdrop')?.remove();
    listarTopicos();
  };

  window.excluirResposta = async function (id) {
    if (!confirm('Excluir esta resposta?')) return;
    const { error } = await window.db.from('respostas_duvidas').delete().eq('id', id);
    if (error) { window.toast(error.message, 'err'); return; }
    window.toast('Resposta excluída.', 'ok');
    document.querySelector('.modal-backdrop')?.remove();
    abrirTopico(TOPICO_ABERTO);
    listarTopicos();
  };

  window.marcarSolucao = async function (id, valor) {
    const { error } = await window.db.from('respostas_duvidas').update({ marcada_solucao: valor }).eq('id', id);
    if (error) { window.toast(error.message, 'err'); return; }
    if (valor) await window.db.from('topicos_duvidas').update({ resolvido: true }).eq('id', TOPICO_ABERTO);
    document.querySelector('.modal-backdrop')?.remove();
    abrirTopico(TOPICO_ABERTO);
    listarTopicos();
  };

  function abrirModalForum(html) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.onclick = e => { if (e.target === back) back.remove(); };
    back.innerHTML = `<div class="modal panel"><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">×</button>${html}</div>`;
    document.body.appendChild(back);
  }
})();
