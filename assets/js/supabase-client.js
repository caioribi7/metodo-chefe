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
