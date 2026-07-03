/* ===========================
   FAETERJ — Sistema de Avaliação
   js/utils.js — Funções utilitárias compartilhadas
   =========================== */

// ===== HISTÓRICO (localStorage) =====

function getHistorico() {
  return JSON.parse(localStorage.getItem('faeterj-hist') || '[]');
}

function salvarHistorico(historico) {
  localStorage.setItem('faeterj-hist', JSON.stringify(historico));
}

function adicionarAoHistorico(item) {
  const historico = getHistorico();
  historico.unshift(item);
  salvarHistorico(historico);
}

function limparHistorico() {
  if (confirm('Tem certeza que deseja limpar todo o histórico de avaliações?')) {
    localStorage.removeItem('faeterj-hist');
    return true;
  }
  return false;
}

// ===== EXPORTAÇÃO CSV =====

function exportarCSV() {
  const historico = getHistorico();
  if (!historico.length) {
    alert('Nenhum dado para exportar.');
    return;
  }
  const cabecalho = 'Nome,Disciplina,Tipo de Avaliação,Nota,Data\n';
  const linhas = historico.map(h =>
    `"${h.nome}","${h.disc}","${h.avTipo}","${h.nota}","${h.data}"`
  ).join('\n');
  const csv = cabecalho + linhas;
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'avaliacoes_faeterj.csv';
  a.click();
}

// ===== RENDERIZAR HISTÓRICO =====

function renderHistorico(containerId) {
  const historico = getHistorico();
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!historico.length) {
    el.innerHTML = '<p class="empty-state">Nenhuma avaliação salva ainda.<br>Corrija uma prova ou trabalho e clique em "Salvar".</p>';
    return;
  }

  el.innerHTML = historico.map((h, i) => `
    <div class="hist-item">
      <div>
        <div class="hist-nome">${h.nome}</div>
        <div class="hist-sub">
          ${h.disc} · ${h.avTipo} · ${h.data}
          <span class="tag ${h.tipo === 'prova' ? 'tag-prova' : 'tag-trabalho'}">
            ${h.tipo === 'prova' ? '📋 Prova' : '📄 Trabalho'}
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="hist-nota">${h.nota}</div>
        <div class="hist-tipo">nota</div>
      </div>
    </div>
  `).join('');
}

// ===== DATA ATUAL =====

function setDataHoje(inputId) {
  const el = document.getElementById(inputId);
  if (el) el.valueAsDate = new Date();
}

// ===== DISCIPLINAS (lista padrão) =====

const DISCIPLINAS = [
  'Gestão de Sistemas Digitais na Web',
  'Engenharia de Software e da Usabilidade',
  'Qualidade e Testes de Software',
  'Legislação Digital',
  'Programação e Web Design',
  'Algoritmos e Linguagem de Programação I',
  'Fundam. de Sistemas Operacionais',
  'Gestão Ambiental e Resp. Social',
  'Inglês Instrumental',
  'Intodução a Lógica',
  'Matemática Aplicada',
  'Organização de Com',
  'Algoritimo e Linguagem de Programação II',
  'Estatística Aplicada',
  'Fundamentos de Estruturas de Dados',
  'Fundamentos de Estrutura de Redes de Computadores',
  'Metodologia de Pesquisa Científica',
  'Modelagem Conceitual de Dados',
  'Analise e Projeto de Sistemas',
  'Ética e Cidadania',
  'Gestão de Projetos de Banco de Dados',
  'Gestão de Processos',
  'Mídias Gigitais',
  'Programaçõa Web Design II',
  'Projeto de Extenção',
  'Empreendedorismo Digital',
  'Programação Cliente Servidor',
  'Programação para Dispositivos Móveis',
  'Projeto Integrador I',
  'Projeto de Extensão II',
  'Governança de TI',
  'Legislação em Negócios Digitais',
  'Programação Web Design III',
  'Projeto Integrador II',
  'Qualidade e Teste de Software',
  'Segurança em Sistemas de Informação',
];

// Mantém a lista sempre em ordem alfabética, mesmo que uma disciplina
// nova seja adicionada fora de ordem no array acima.
DISCIPLINAS.sort((a, b) => a.trim().localeCompare(b.trim(), 'pt-BR'));

function popularSelect(selectId, opcoes, selecionado) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = opcoes.map(o =>
    `<option ${o === selecionado ? 'selected' : ''}>${o}</option>`
  ).join('');
}

// ===== QUANTIDADE DE QUESTÕES (1 até o máximo) =====

function popularQuestoesSelect(selectId, max, selecionado) {
  const el = document.getElementById(selectId);
  if (!el) return;
  let opts = '';
  for (let i = 1; i <= max; i++) {
    opts += `<option value="${i}"${i === selecionado ? ' selected' : ''}>${i}</option>`;
  }
  el.innerHTML = opts;
}
