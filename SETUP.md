# Método Chefe — Guia de instalação

Plataforma de mentoria com Supabase (Auth + Postgres + RLS) e front-end em HTML/CSS/JS puro.

---

## 1) Estrutura de arquivos

```
mentoria/
├── index.html             # Landing + login
├── cadastro.html          # Alistamento (signup)
├── aluno.html             # Painel do aluno
├── admin.html             # Painel do mentor (admin)
├── supabase-schema.sql    # Script para rodar no Supabase
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── config.js            # ← suas chaves
│       ├── supabase-client.js
│       ├── aluno.js
│       └── admin.js
└── SETUP.md (este arquivo)
```

---

## 2) Criar o projeto no Supabase

1. Acesse <https://supabase.com> → **Start your project** → entre com GitHub ou e-mail.
2. **New project**:
   - Nome: `metodo-chefe`
   - Senha do banco: gere e **guarde em local seguro** (você raramente vai precisar)
   - Região: `South America (São Paulo)`
   - Plano: **Free** (suficiente para começar)
3. Aguarde ~2 minutos até o projeto ficar verde.

---

## 3) Rodar o schema (tabelas + segurança)

1. No painel do Supabase, vá em **SQL Editor** → **New query**.
2. Cole **todo** o conteúdo do arquivo `supabase-schema.sql`.
3. Clique em **Run** (canto inferior direito).
4. Você deve ver `Success. No rows returned`.

Isso cria:
- `profiles` (perfis), `sessoes_estudo`, `tarefas_casa`, `questoes`
- Políticas de **Row Level Security** separando aluno × admin
- Trigger que cria o profile automaticamente ao se cadastrar

---

## 4) Configurar autenticação

No painel Supabase → **Authentication** → **Providers**:

1. **Email** já vem habilitado.
2. **Para facilitar testes locais**, desative a confirmação de e-mail:
   - **Authentication** → **Sign In / Providers** → **Email**
   - Desmarque **Confirm email** → **Save**
   - (Em produção, deixe ligado.)

---

## 5) Copiar suas credenciais para o front

No painel Supabase → **Project Settings (ícone ⚙)** → **API**:

- Copie o **Project URL**
- Copie a **anon public key** (NÃO a `service_role`!)

Abra `assets/js/config.js` e preencha:

```js
window.METODO_CHEFE_CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi......',
};
```

Salve.

---

## 6) Rodar localmente

O jeito mais simples: abra o terminal na pasta `mentoria/` e rode um servidor HTTP estático. Em Windows, com Python instalado:

```bash
python -m http.server 5500
```

Depois acesse: **<http://localhost:5500>**

> ⚠️ Abrir o `index.html` direto pelo duplo-clique (`file://`) **não funciona** — o Supabase precisa de um servidor HTTP. Se não tiver Python, use a extensão **Live Server** do VS Code (clique com o botão direito em `index.html` → `Open with Live Server`).

---

## 7) Criar o seu usuário admin (você, o mentor)

1. Abra `http://localhost:5500/cadastro.html`
2. Preencha com seu nome, e-mail, senha. **Não** precisa marcar olimpíadas.
3. Clique em **Fazer o alistamento**.
4. Você será direcionado para o painel do aluno — isso é esperado, porque por padrão todo novo cadastro vira `aluno`.
5. Volte ao Supabase → **SQL Editor** e rode:

```sql
update public.profiles
set role = 'admin'
where nome = 'Seu Nome Aqui';
-- OU, mais direto, pelo e-mail:
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'seu@email.com');
```

6. Dê **logout** na plataforma e faça login de novo — agora você vai cair no `admin.html`.

---

## 8) Cadastrar um aluno de teste

- Use uma janela anônima para ficar desconectado.
- `cadastro.html` → crie uma conta para um aluno fictício.
- Volte ao seu login admin → aba **Alunos** → ele deve aparecer na tropa.

---

## 9) Fluxo do dia a dia

### Aluno
- Aba **Painel**: registra sessão de estudo (matéria, tópico, duração).
- Aba **Sessões**: histórico completo.
- Aba **TCs**: lista de tarefas de casa enviadas pelo mentor, com botão "Marcar como concluída".
- Aba **Questões**: navega no banco de questões, vê gabarito e resolução.

### Admin (mentor)
- Aba **Painel**: estatísticas gerais e feed de atividade.
- Aba **Alunos**: tabela de todos os alunos + horas estudadas; clique em **Abrir** para ver sessões e TCs de um aluno específico.
- Aba **TCs**: formulário para criar TC (escolhe o aluno, título, descrição, matéria, prazo) e lista das TCs emitidas.
- Aba **Questões**: clique em **+ Nova questão** para cadastrar. Suporta alternativas A-E, resposta correta e resolução.

---

## 10) Publicar na internet (opcional, quando quiser compartilhar)

Mais fácil: **Netlify Drop**:
1. Acesse <https://app.netlify.com/drop>
2. Arraste a pasta `mentoria/` inteira
3. Pronto, URL pública gerada.

Alternativas: **Vercel**, **GitHub Pages**, **Cloudflare Pages**.

> Depois de publicar, volte ao Supabase → **Authentication** → **URL Configuration** e adicione a URL em **Site URL** e **Redirect URLs**.

---

## 11) Segurança — o que está coberto

- Toda comunicação com o banco passa por **RLS**: o aluno só enxerga as próprias sessões e TCs; admin enxerga tudo. Mesmo que alguém mexa no JS do navegador, o Supabase vai barrar no banco.
- Senhas são armazenadas com hash pelo próprio Supabase Auth.
- A `anon key` no front é pública **por design** — ela só concede o que as políticas RLS permitem.
- **Nunca** coloque a `service_role` key no front.

---

## 12) Problemas comuns

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| `new row violates row-level security policy` ao cadastrar | Trigger `handle_new_user` não rodou | Rode o `supabase-schema.sql` de novo |
| Login OK mas "não achei profile" / redireciona sem fim | Profile não foi criado | No SQL Editor: `insert into profiles (id, nome) values ('<user-id>', 'Nome');` |
| Admin não vê os alunos | Você ainda está com `role='aluno'` | Rode o `update profiles set role='admin'...` do passo 7 |
| Tela em branco | `config.js` com URL/chave errada | Abra o console do navegador (F12) e veja o erro |
| "Invalid login credentials" | Confirmação de e-mail está ligada e você não confirmou | Passo 4 — desative em dev, ou clique no link que chega no e-mail |

---

## 13) Próximos passos sugeridos

- Adicionar upload de PDF de enunciados (Supabase Storage)
- Notificações de TC com prazo próximo (Edge Functions + cron)
- Gráfico de evolução de horas por semana no painel do aluno
- Turmas / grupos (relação N-para-N aluno ↔ turma)

Qualquer dúvida ou bug, me chama.
