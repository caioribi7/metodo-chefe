// Cliente Supabase global — requer config.js e supabase-js v2 carregados antes
(function () {
  const cfg = window.METODO_CHEFE_CONFIG || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith('COLE_')) {
    console.error('⚠️  Configure assets/js/config.js com sua SUPABASE_URL e SUPABASE_ANON_KEY.');
  }
  const { createClient } = window.supabase;
  window.db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
})();

// Helpers de UI globais
window.toast = function (msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, 3200);
};

window.fmtData = function (iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

window.escapeHtml = function (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};

// Redireciona conforme sessão/role
window.requireAuth = async function (requiredRole) {
  const { data: { session } } = await window.db.auth.getSession();
  if (!session) { location.href = 'index.html'; return null; }
  const { data: profile, error } = await window.db
    .from('profiles').select('*').eq('id', session.user.id).single();
  if (error || !profile) {
    await window.db.auth.signOut();
    location.href = 'index.html';
    return null;
  }
  if (requiredRole && profile.role !== requiredRole) {
    location.href = profile.role === 'admin' ? 'admin.html' : 'aluno.html';
    return null;
  }
  return { session, profile };
};

// Lista de provas / olimpíadas — fonte única
window.PROVAS_MILITARES = [
  'EsPCEx', 'AFA', 'Escola Naval', 'EFOMM', 'ITA', 'IME',
  'EEAR', 'EsSA', 'Colégio Naval', 'EPCAr', 'CFN', 'CFO'
];
window.OLIMPIADAS = [
  'OBM', 'OBMEP', 'OBF', 'OBQ', 'OBB', 'OBI',
  'ONC', 'ONHB', 'OBA', 'OBR', 'OPF', 'OPQ'
];
window.MATERIAS = [
  'Matemática', 'Física', 'Química', 'Biologia',
  'Português', 'Redação', 'História', 'Geografia',
  'Inglês', 'Informática'
];

// --------- Helpers compartilhados (acervo + ciclo) ---------

// Segunda-feira (00:00) da semana de `d`. Aceita Date ou ISO.
window.inicioSemana = function (d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dia = x.getDay(); // 0=dom, 1=seg
  const offset = dia === 0 ? -6 : 1 - dia;
  x.setDate(x.getDate() + offset);
  return x;
};

// Formata minutos como "1h30" / "45min"
window.fmtMin = function (min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return m + 'min';
  if (!m) return h + 'h';
  return `${h}h${String(m).padStart(2, '0')}`;
};

// Extrai ID do YouTube de URLs comuns
window.youtubeId = function (url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/
  );
  return m ? m[1] : null;
};

// Retorna HTML de embed para uma URL de vídeo (YouTube, Vimeo) ou link genérico
window.embedVideo = function (url) {
  const yt = window.youtubeId(url);
  if (yt) {
    return `<div class="player-wrap"><iframe src="https://www.youtube.com/embed/${yt}" allowfullscreen allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
  }
  const vimeo = String(url).match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return `<div class="player-wrap"><iframe src="https://player.vimeo.com/video/${vimeo[1]}" allowfullscreen></iframe></div>`;
  }
  return `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir vídeo em nova aba ↗</a></p>`;
};

// Ícone SVG por tipo de material
window.iconeMat = function (tipo) {
  const icons = {
    pasta: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>',
    curso: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>',
    pdf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/></svg>',
    video: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="14" height="12" rx="1"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
    dica: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2v.3h6V17c0-.7.4-1.5 1-2A7 7 0 0012 2z"/></svg>',
    lista: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01"/></svg>',
  };
  return icons[tipo] || icons.pasta;
};

window.LABEL_TIPO = {
  pasta: 'Pasta', curso: 'Curso', pdf: 'PDF',
  video: 'Vídeo-aula', dica: 'Dica', lista: 'Lista'
};
