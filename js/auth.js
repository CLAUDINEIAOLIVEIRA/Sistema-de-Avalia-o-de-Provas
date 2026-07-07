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

// Código exigido pra cadastrar o PRIMEIRO usuário TOTAL (quando ainda não há
// ninguém com login). Sem isso, qualquer pessoa que ache o site na internet
// conseguiria se auto-cadastrar como TOTAL antes de você configurar a equipe.
// Troque esse valor quando quiser (só quem edita o código sabe o novo).
const AUTH_CODIGO_INSTALACAO = 'FAETERJBM-2026';

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

// ===== BARRA LATERAL (MENU) =====
// Substitui o antigo indicador de topo + <nav> de cada página por um menu
// lateral fixo (vira gaveta com botão ☰ no celular).

const AUTH_MENU_ITENS = [
  { href: 'index.html',     icone: '🏠', label: 'Início' },
  { href: 'prova.html',     icone: '📋', label: 'Prova objetiva' },
  { href: 'trabalho.html',  icone: '📄', label: 'Trabalho / Artigo' },
  { href: 'cadastro.html',  icone: '🗂️', label: 'Cadastro', exigeTotal: true },
  { href: 'historico.html', icone: '🕐', label: 'Histórico' }
];

function authRenderSidebar(paginaAtual) {
  const sessao = authGetSessao();
  if (!sessao) return;
  document.body.classList.add('tem-sidebar');

  const iniciais = sessao.nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const linksHTML = AUTH_MENU_ITENS
    .filter(item => !item.exigeTotal || sessao.permissao === 'TOTAL')
    .map(item => `<a href="${item.href}" class="${item.href === paginaAtual ? 'active' : ''}">${item.icone} ${item.label}</a>`)
    .join('');

  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-topo">
      <img src="../img/logo_oficial_FAETERJ.jpeg" alt="Logo FAETERJ">
      <span>Sistema de Avaliação Escolar</span>
    </div>
    <div class="sidebar-perfil">
      <div class="sidebar-avatar">${iniciais}</div>
      <div class="sidebar-perfil-info">
        <div class="sidebar-perfil-nome">${sessao.nome}</div>
        <div class="sidebar-perfil-papel">${sessao.papel} · ${sessao.permissao}</div>
      </div>
    </div>
    <div class="sidebar-links">${linksHTML}</div>
    <div class="sidebar-rodape">
      <button class="sidebar-btn-senha" onclick="authAbrirTrocaSenha()">🔑 Trocar senha</button>
      <button class="sidebar-btn-sair" onclick="authFazerLogout()">🚪 Sair</button>
    </div>
  `;

  const toggle = document.createElement('button');
  toggle.className = 'sidebar-toggle';
  toggle.type = 'button';
  toggle.innerHTML = '☰';
  toggle.setAttribute('aria-label', 'Abrir menu');

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';

  document.body.prepend(overlay);
  document.body.prepend(sidebar);
  document.body.prepend(toggle);

  const fechar = () => { sidebar.classList.remove('aberta'); overlay.classList.remove('aberta'); };
  const abrir  = () => { sidebar.classList.add('aberta'); overlay.classList.add('aberta'); };
  toggle.addEventListener('click', () => {
    sidebar.classList.contains('aberta') ? fechar() : abrir();
  });
  overlay.addEventListener('click', fechar);
}

// ===== TROCAR A PRÓPRIA SENHA (útil pra quem recebeu uma senha provisória) =====
// Qualquer pessoa logada pode trocar a própria senha a qualquer momento,
// sem precisar de permissão TOTAL nem passar pelo Cadastro.

function authAbrirTrocaSenha() {
  if (document.getElementById('auth-modal-senha')) return; // já está aberto
  const overlay = document.createElement('div');
  overlay.id = 'auth-modal-senha';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:10px;padding:20px;max-width:320px;width:100%;">
      <h3 style="margin:0 0 12px;font-size:16px;">🔑 Trocar minha senha</h3>
      <div class="form-row"><label>Senha atual</label><input id="ts-atual" type="password" autocomplete="off" placeholder="Senha atual (ou a provisória)"></div>
      <div class="form-row"><label>Nova senha</label><input id="ts-nova" type="password" autocomplete="new-password" placeholder="Nova senha"></div>
      <div class="form-row"><label>Confirmar nova senha</label><input id="ts-confirma" type="password" autocomplete="new-password" placeholder="Repita a nova senha"></div>
      <div id="ts-erro" style="color:#c5221f;font-size:12px;margin-top:4px;display:none"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn btn-primary" onclick="authSalvarNovaSenha()">Salvar</button>
        <button class="btn" onclick="authFecharTrocaSenha()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('ts-atual').focus();
}

function authFecharTrocaSenha() {
  const el = document.getElementById('auth-modal-senha');
  if (el) el.remove();
}

function authSalvarNovaSenha() {
  const sessao = authGetSessao();
  if (!sessao) { authFecharTrocaSenha(); return; }
  const atual = document.getElementById('ts-atual').value;
  const nova = document.getElementById('ts-nova').value;
  const confirma = document.getElementById('ts-confirma').value;
  const erroEl = document.getElementById('ts-erro');
  const mostrarErro = (msg) => { erroEl.textContent = msg; erroEl.style.display = 'block'; };

  const profs = getProfessores();
  const eu = profs.find(p => p.usuario && p.usuario.toLowerCase() === sessao.usuario.toLowerCase());
  if (!eu || eu.senha !== atual) { mostrarErro('❌ Senha atual incorreta.'); return; }
  if (!nova || nova.length < 4) { mostrarErro('⚠️ A nova senha deve ter pelo menos 4 caracteres.'); return; }
  if (nova !== confirma) { mostrarErro('⚠️ A confirmação não confere com a nova senha.'); return; }

  eu.senha = nova;
  salvarProfessores(profs);
  authFecharTrocaSenha();
  alert('✅ Senha alterada com sucesso!');
}
