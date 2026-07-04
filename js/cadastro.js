/* ===========================
   FAETERJ — Sistema de Avaliação
   js/cadastro.js — Cadastro de alunos e professores (localStorage)
   Suporta importação em lote de arquivos .xlsx, .csv e .xml
   =========================== */

const CADASTRO_CHAVE_ALUNOS = 'faeterj-alunos';
const CADASTRO_CHAVE_PROFESSORES = 'faeterj-professores';

// ===== ALUNOS (CRUD) =====

function getAlunos() {
  return JSON.parse(localStorage.getItem(CADASTRO_CHAVE_ALUNOS) || '[]');
}
function salvarAlunos(lista) {
  localStorage.setItem(CADASTRO_CHAVE_ALUNOS, JSON.stringify(lista));
}
function adicionarAluno(aluno) {
  const lista = getAlunos();
  lista.push(aluno);
  salvarAlunos(lista);
}
function removerAluno(indice) {
  const lista = getAlunos();
  lista.splice(indice, 1);
  salvarAlunos(lista);
}

// ===== PROFESSORES (CRUD) =====

function getProfessores() {
  return JSON.parse(localStorage.getItem(CADASTRO_CHAVE_PROFESSORES) || '[]');
}
function salvarProfessores(lista) {
  localStorage.setItem(CADASTRO_CHAVE_PROFESSORES, JSON.stringify(lista));
}
function adicionarProfessor(professor) {
  const lista = getProfessores();
  lista.push(professor);
  salvarProfessores(lista);
}
function removerProfessor(indice) {
  const lista = getProfessores();
  lista.splice(indice, 1);
  salvarProfessores(lista);
}

// ===== AUTOCOMPLETAR (usado em prova.html / trabalho.html / folha.html) =====

function popularDatalistAlunos(datalistId) {
  const el = document.getElementById(datalistId);
  if (!el) return;
  el.innerHTML = getAlunos().map(a => `<option value="${String(a.nome).replace(/"/g, '&quot;')}"></option>`).join('');
}

function popularDatalistProfessores(datalistId) {
  const el = document.getElementById(datalistId);
  if (!el) return;
  el.innerHTML = getProfessores().map(p => `<option value="${String(p.nome).replace(/"/g, '&quot;')}"></option>`).join('');
}

function buscarAlunoPorNome(nome) {
  return getAlunos().find(a => a.nome === nome);
}

// ===== TEXTO NORMALIZADO (busca/detecção de colunas sem acento e maiúsculas) =====

function cadastroNormalizar(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ===== ALIASES DE COLUNAS/TAGS ACEITAS NA IMPORTAÇÃO =====

const ALIASES_ALUNO = {
  nome: ['nome', 'aluno', 'discente', 'estudante', 'nome do aluno', 'nome completo'],
  matricula: ['matricula', 'ra', 'registro', 'codigo', 'matricula do aluno'],
  periodo: ['periodo', 'turma', 'semestre', 'serie'],
  disciplina: ['disciplina', 'disciplinas', 'materia', 'materias', 'curso']
};
const ALIASES_PROFESSOR = {
  nome: ['nome', 'professor', 'docente', 'nome do professor'],
  disciplina: ['disciplina', 'disciplinas', 'materia', 'materias', 'curso']
};

function cadastroAcharColuna(headerNormalizado, aliases) {
  return headerNormalizado.findIndex(h => aliases.includes(h));
}

// Uma célula pode ter mais de uma disciplina separada por vírgula ou ponto e vírgula
function cadastroParseDisciplinas(valor) {
  if (!valor) return [];
  const texto = String(valor);
  const delim = texto.includes(';') ? ';' : ',';
  return texto.split(delim).map(s => s.trim()).filter(Boolean);
}

// ===== LEITURA DE ARQUIVO =====

function cadastroLerComoTexto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    r.readAsText(file, 'UTF-8');
  });
}

function cadastroLerComoArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    r.readAsArrayBuffer(file);
  });
}

// ===== PARSER CSV (aceita vírgula ou ponto-e-vírgula) =====

function cadastroParseCSV(texto) {
  const linhas = texto.split(/\r\n|\r|\n/).filter(l => l.trim() !== '');
  if (!linhas.length) return [];
  const delim = linhas[0].split(';').length >= linhas[0].split(',').length ? ';' : ',';
  return linhas.map(l => l.split(delim).map(c => c.trim().replace(/^"|"$/g, '')));
}

// ===== PARSER XLSX (via biblioteca SheetJS, carregada em cadastro.html) =====

function cadastroLinhasDeXLSX(arrayBuffer) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Biblioteca de leitura de Excel não carregou. Verifique sua conexão com a internet e tente novamente.');
  }
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const aba = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(aba, { header: 1, defval: '' });
}

// ===== PARSER XML GENÉRICO =====
// Considera "registro" qualquer elemento cujos filhos diretos sejam todos
// folhas de texto (sem sub-elementos) — funciona com XML simples do tipo
// <alunos><aluno><nome>...</nome><matricula>...</matricula></aluno>...</alunos>

function cadastroRegistrosDeXML(texto) {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Arquivo XML inválido.');

  const todos = Array.from(doc.getElementsByTagName('*'));
  const registros = todos.filter(el => {
    const filhos = Array.from(el.children);
    return filhos.length > 0 && filhos.every(f => f.children.length === 0);
  });

  return registros.map(el => {
    const obj = {};
    Array.from(el.children).forEach(f => {
      obj[cadastroNormalizar(f.tagName)] = f.textContent.trim();
    });
    Array.from(el.attributes || []).forEach(a => {
      obj[cadastroNormalizar(a.name)] = a.value;
    });
    return obj;
  });
}

function cadastroPegarCampo(registro, aliases) {
  for (const chave in registro) {
    if (aliases.includes(chave)) return registro[chave];
  }
  return '';
}

// ===== MAPEAR LINHAS (XLSX/CSV) PARA OBJETOS =====

function cadastroMapearLinhasParaAlunos(linhas) {
  if (!linhas.length) return [];
  const header = linhas[0].map(c => cadastroNormalizar(c));
  const idxNome = cadastroAcharColuna(header, ALIASES_ALUNO.nome);
  const temHeader = idxNome !== -1;
  const idxMatricula = temHeader ? cadastroAcharColuna(header, ALIASES_ALUNO.matricula) : 1;
  const idxPeriodo = temHeader ? cadastroAcharColuna(header, ALIASES_ALUNO.periodo) : 2;
  const idxDisciplina = temHeader ? cadastroAcharColuna(header, ALIASES_ALUNO.disciplina) : 3;
  const nomeCol = temHeader ? idxNome : 0;
  const linhasDados = temHeader ? linhas.slice(1) : linhas;

  return linhasDados
    .map(row => ({
      nome: String(row[nomeCol] ?? '').trim(),
      matricula: idxMatricula >= 0 ? String(row[idxMatricula] ?? '').trim() : '',
      periodo: idxPeriodo >= 0 ? String(row[idxPeriodo] ?? '').trim() : '',
      disciplinas: idxDisciplina >= 0 ? cadastroParseDisciplinas(row[idxDisciplina]) : []
    }))
    .filter(a => a.nome);
}

function cadastroMapearLinhasParaProfessores(linhas) {
  if (!linhas.length) return [];
  const header = linhas[0].map(c => cadastroNormalizar(c));
  const idxNome = cadastroAcharColuna(header, ALIASES_PROFESSOR.nome);
  const temHeader = idxNome !== -1;
  const idxDisciplina = temHeader ? cadastroAcharColuna(header, ALIASES_PROFESSOR.disciplina) : 1;
  const nomeCol = temHeader ? idxNome : 0;
  const linhasDados = temHeader ? linhas.slice(1) : linhas;

  return linhasDados
    .map(row => ({
      nome: String(row[nomeCol] ?? '').trim(),
      disciplinas: idxDisciplina >= 0 ? cadastroParseDisciplinas(row[idxDisciplina]) : []
    }))
    .filter(p => p.nome);
}

function cadastroMapearXMLParaAlunos(registros) {
  return registros
    .map(r => ({
      nome: cadastroPegarCampo(r, ALIASES_ALUNO.nome),
      matricula: cadastroPegarCampo(r, ALIASES_ALUNO.matricula),
      periodo: cadastroPegarCampo(r, ALIASES_ALUNO.periodo),
      disciplinas: cadastroParseDisciplinas(cadastroPegarCampo(r, ALIASES_ALUNO.disciplina))
    }))
    .filter(a => a.nome);
}

function cadastroMapearXMLParaProfessores(registros) {
  return registros
    .map(r => ({
      nome: cadastroPegarCampo(r, ALIASES_PROFESSOR.nome),
      disciplinas: cadastroParseDisciplinas(cadastroPegarCampo(r, ALIASES_PROFESSOR.disciplina))
    }))
    .filter(p => p.nome);
}

// ===== IMPORTAR ARQUIVO (detecta formato pela extensão) =====

async function cadastroExtrairRegistros(file, mapearLinhas, mapearXML) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await cadastroLerComoArrayBuffer(file);
    return mapearLinhas(cadastroLinhasDeXLSX(buf));
  }
  if (ext === 'csv' || ext === 'txt') {
    const texto = await cadastroLerComoTexto(file);
    return mapearLinhas(cadastroParseCSV(texto));
  }
  if (ext === 'xml') {
    const texto = await cadastroLerComoTexto(file);
    return mapearXML(cadastroRegistrosDeXML(texto));
  }
  throw new Error('Formato não suportado. Use .xlsx, .csv ou .xml.');
}

async function importarAlunosDeArquivo(file) {
  const novos = await cadastroExtrairRegistros(file, cadastroMapearLinhasParaAlunos, cadastroMapearXMLParaAlunos);
  if (!novos.length) throw new Error('Nenhum aluno encontrado no arquivo.');

  const atuais = getAlunos();
  const existentes = new Set(atuais.map(a => cadastroNormalizar(a.nome) + '|' + cadastroNormalizar(a.matricula)));
  let adicionados = 0;
  novos.forEach(n => {
    const chave = cadastroNormalizar(n.nome) + '|' + cadastroNormalizar(n.matricula);
    if (!existentes.has(chave)) {
      atuais.push(n);
      existentes.add(chave);
      adicionados++;
    }
  });
  salvarAlunos(atuais);
  return { total: novos.length, adicionados, duplicados: novos.length - adicionados };
}

async function importarProfessoresDeArquivo(file) {
  const novos = await cadastroExtrairRegistros(file, cadastroMapearLinhasParaProfessores, cadastroMapearXMLParaProfessores);
  if (!novos.length) throw new Error('Nenhum professor encontrado no arquivo.');

  const atuais = getProfessores();
  const existentes = new Set(atuais.map(p => cadastroNormalizar(p.nome)));
  let adicionados = 0;
  novos.forEach(n => {
    const chave = cadastroNormalizar(n.nome);
    if (!existentes.has(chave)) {
      atuais.push(n);
      existentes.add(chave);
      adicionados++;
    }
  });
  salvarProfessores(atuais);
  return { total: novos.length, adicionados, duplicados: novos.length - adicionados };
}
