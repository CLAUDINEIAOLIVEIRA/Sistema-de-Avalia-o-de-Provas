/* ===========================
   FAETERJ — Sistema de Avaliação
   js/auth.js — Sessão, login e controle de acesso (organizacional)

   IMPORTANTE: Este controle de acesso roda 100% no navegador (sem
   servidor), então serve apenas para organizar o uso do dia a dia
   (esconder telas, lembrar o papel de cada pessoa). Não é segurança
   de verdade — qualquer pessoa com conhecimento técnico pode burlar
   pelo console do navegador. Antes de usar com dados sensíveis em
   produção, trocar por um backend de autenticação real.
   =========================== */

const AUTH_CHAVE_SESSAO = 'faeterj-sessao';
const PAPEIS_EQUIPE = ['Professor', 'Coordenação', 'Diretor', 'Secretaria'];
const PERMISSOES_EQUIPE = ['TOTAL', 'PARCIAL'];

// ===== SESSÃO =====

function authGetSessao() {
  return JSON.parse(localStorage.getItem(AUTH_CHAVE_SESSAO) || 'null');
}

function authSalvarSessao(sessao) {
  localStorage.setItem(AUTH_CHAVE_SESSAO, JSON.stringify(sessao));
}

function authLogout() {
  localStorage.removeItem(AUTH_CHAVE_SESSAO);
}

// ===== LOGIN =====

// Só entra em "modo bootstrap" (libera acesso sem login) se ninguém
// da equipe tiver usuário/senha configurados ainda — necessário para
// cadastrar a primeira pessoa com permissão TOTAL.
function authExisteEquipeComLogin() {
  return getProfessores().some(p => p.usuario && p.senha);
}

function authFazerLogin(usuario, senha) {
  usuario = (usuario || '').trim();
  if (!usuario || !senha) return false;
  const pessoa = getProfessores().find(p =>
    p.usuario && p.usuario.trim().toLowerCase() === usuario.toLowerCase() && p.senha === senha
  );
  if (!pessoa) return false;
  authSalvarSessao({
    nome: pessoa.nome,
    papel: pessoa.papel || 'Professor',
    permissao: pessoa.permissao || 'PARCIAL',
    usuario: pessoa.usuario
  });
  return true;
}

function authFazerLogout() {
  authLogout();
  window.location.href = 'login.html';
}

// ===== GUARDA DE PÁGINA =====
// Chame no topo de cada página protegida. Retorna { sessao, bootstrap }
// ou null (e já redireciona) quando o acesso é negado.
function authProtegerPagina(opcoes) {
  opcoes = opcoes || {};
  const bootstrap = !authExisteEquipeComLogin();

  if (bootstrap && opcoes.permitirBootstrap) {
    return { sessao: null, bootstrap: true };
  }

  const sessao = authGetSessao();
  if (!sessao) {
    window.location.href = 'login.html';
    return null;
  }
  if (opcoes.exigirTotal && sessao.permissao !== 'TOTAL') {
    alert('⚠️ Esta área é restrita a usuários com permissão TOTAL.');
    window.location.href = 'index.html';
    return null;
  }
  return { sessao, bootstrap: false };
}

// ===== INDICADOR DE SESSÃO (cabeçalho) =====

// Esconde links/atalhos pro Cadastro de quem não tem permissão TOTAL
function authAplicarRestricoesUI(sessao) {
  if (!sessao || sessao.permissao === 'TOTAL') return;
  document.querySelectorAll('a[href="cadastro.html"]').forEach(el => { el.style.display = 'none'; });
}

function authRenderIndicador(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const sessao = authGetSessao();
  if (!sessao) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <span class="auth-usuario">👤 ${sessao.nome} · ${sessao.papel} (${sessao.permissao})</span>
    <button class="auth-sair" onclick="authFazerLogout()">Sair</button>
  `;
}
