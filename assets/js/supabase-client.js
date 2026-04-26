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

// Formata segundos como hh:mm:ss / mm:ss
window.fmtSeg = function (s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};

// Data de hoje no fuso local em formato YYYY-MM-DD (evita bug do toISOString em UTC)
window.dataHojeLocal = function () {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
window.dataLocal = function (date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// --------- Banco de questões: escolaridade / níveis / instituições ----------

window.ESCOLARIDADES_QUESTAO = [
  'Fundamental II',
  'Ensino Médio',
  'Pré-militar / Vestibular',
  'Universitário'
];

// Níveis estilo OBMEP
window.NIVEIS = [
  { v: 1, label: 'Nível 1 — 6º ao 7º ano' },
  { v: 2, label: 'Nível 2 — 8º ao 9º ano' },
  { v: 3, label: 'Nível 3 — Ensino Médio' },
  { v: 4, label: 'Nível 4 — Universitário' },
];

// Instituições agrupadas (provas militares + olimpíadas de matemática + outras)
window.INSTITUICOES_GRUPOS = {
  'Provas Militares': [
    'EsPCEx', 'AFA', 'Escola Naval', 'EFOMM', 'ITA', 'IME',
    'EEAR', 'EsSA', 'Colégio Naval', 'EPCAr', 'CFN', 'CFO'
  ],
  'Olimpíadas de Matemática': [
    'OBM', 'OBMEP', 'Canguru de Matemática', 'OPM (Paulista)',
    'OMERJ', 'OMESP', 'OCM (Cearense)', 'OMA', 'OIbM (Ibero-americana)',
    'IMO (Internacional)', 'OMM', 'Cone Sul'
  ],
  'Olimpíadas Científicas': [
    'OBF (Física)', 'OBQ (Química)', 'OBB (Biologia)', 'OBI (Informática)',
    'ONC (Ciências)', 'OBA (Astronomia)', 'OBR (Robótica)',
    'ONHB (História)', 'OPF', 'OPQ'
  ],
};

// Lista plana, útil pra busca/inclusão simples
window.INSTITUICOES_TODAS = Object.values(window.INSTITUICOES_GRUPOS).flat();

// --------- Menu mobile (hambúrguer) ----------
// Adiciona automaticamente um botão hamburger na .navbar em telas pequenas
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const nav = navbar.querySelector('nav');
  if (!nav || navbar.querySelector('.menu-toggle')) return;

  const btn = document.createElement('button');
  btn.className = 'menu-toggle';
  btn.setAttribute('aria-label', 'Abrir menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  navbar.appendChild(btn);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.toggle('open');
    btn.classList.toggle('open');
  });

  // fecha ao clicar em link ou fora
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      btn.classList.remove('open');
    }
  });
  document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target)) {
      nav.classList.remove('open');
      btn.classList.remove('open');
    }
  });
});

// Popula um <select> com optgroups
window.popularSelectInstituicoes = function (selectEl, incluirVazio = true, valorVazio = 'Todas') {
  selectEl.innerHTML = '';
  if (incluirVazio) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = valorVazio;
    selectEl.appendChild(o);
  }
  Object.entries(window.INSTITUICOES_GRUPOS).forEach(([grupo, lista]) => {
    const og = document.createElement('optgroup');
    og.label = grupo;
    lista.forEach(item => {
      const o = document.createElement('option');
      o.value = item; o.textContent = item;
      og.appendChild(o);
    });
    selectEl.appendChild(og);
  });
};
