/* ===========================
   FAETERJ — Sistema de Avaliação
   js/trabalho.js — Lógica de avaliação de trabalhos/artigos
   =========================== */

// ===== CRITÉRIOS DA RUBRICA =====

const RUBRICAS = [
  {
    nome: 'Conteúdo',
    peso: 15,
    desc: 'Demonstra profundo entendimento do tema com informações precisas e relevantes'
  },
  {
    nome: 'Estrutura',
    peso: 20,
    desc: 'Organização lógica, com introdução, desenvolvimento e conclusão claros'
  },
  {
    nome: 'Criatividade',
    peso: 20,
    desc: 'Apresenta ideias originais e inovadoras, superando as expectativas'
  },
  {
    nome: 'Resultados e análise',
    peso: 20,
    desc: 'Dados apresentados de forma clara e interpretados corretamente'
  },
 
  {
    nome: 'Escrita e normas ABNT',
    peso: 15,
    desc: 'Linguagem técnica adequada, gramática correta e formatação dentro das normas'
  },

{
    nome: 'Pontualidade',
    peso: 10,
    desc: 'Entregue antes ou na data marcada, seguindo todas as normas'
  },

];

// Array que guarda a nota de cada critério (0-10)
const notasCriterios = new Array(RUBRICAS.length).fill(0);

// ===== CONSTRUIR RUBRICA =====

function buildRubrica() {
  const container = document.getElementById('rubrica-container');
  if (!container) return;
  container.innerHTML = '';

  RUBRICAS.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'rubrica-item';
    d.innerHTML = `
      <div class="rubrica-header">
        <span>${r.nome}</span>
        <small>Peso: ${r.peso}%</small>
      </div>
      <div class="rubrica-desc">${r.desc}</div>
      <div class="stars">
        ${[1, 2, 3, 4, 5].map(s => `
          <div class="star" id="star-${i}-${s}" onclick="setStar(${i}, ${s})" title="${s * 2}/10">${s}</div>
        `).join('')}
        <span class="star-val" id="star-val-${i}">Não avaliado</span>
      </div>`;
    container.appendChild(d);
  });
}

// ===== DEFINIR ESTRELA =====

function setStar(ri, val) {
  notasCriterios[ri] = val * 2;

  for (let s = 1; s <= 5; s++) {
    const star = document.getElementById(`star-${ri}-${s}`);
    if (star) star.classList.toggle('sel', s <= val);
  }

  const valEl = document.getElementById('star-val-' + ri);
  if (valEl) valEl.textContent = `${val * 2}/10`;

  calcularNota();
}

// ===== CALCULAR NOTA =====

function calcularNota() {
  let total = 0;
  RUBRICAS.forEach((r, i) => {
    total += notasCriterios[i] * r.peso / 100;
  });

  const valorMax = parseFloat(document.getElementById('t-valor')?.value || 10);
  const notaConv = (total / 10 * valorMax).toFixed(1).replace('.', ',');
  const el = document.getElementById('nota-calc');
  if (el) {
    el.textContent = total > 0
      ? `${total.toFixed(1)}/10 → ${notaConv}/${valorMax}`
      : '— / 10';
  }
  return total;
}

// ===== ANÁLISE COM IA =====

async function analisarIA() {
  const texto = document.getElementById('t-texto')?.value.trim();
  const nome  = document.getElementById('t-nome')?.value  || 'aluno(a)';
  const tipo  = document.getElementById('t-tipo')?.value  || 'trabalho';
  const disc  = document.getElementById('t-disc')?.value  || 'disciplina';
  const titulo = document.getElementById('t-titulo')?.value || 'trabalho';

  if (!texto) {
    alert('Cole o texto do trabalho antes de analisar.');
    return;
  }

  const box = document.getElementById('ai-result');
  if (!box) return;
  box.innerHTML = '<span class="ai-loading">⏳ Analisando com IA... aguarde alguns segundos.</span>';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Você é a Professora Claudineia Moreira de Oliveira, da FAETERJ Barra Mansa, disciplina de ${disc}.

Avalie o seguinte ${tipo} intitulado "${titulo}" do aluno(a) ${nome}:

"${texto}"

Forneça feedback pedagógico em português estruturado assim:

**1. Pontos fortes:**
(Liste 2-3 aspectos positivos do trabalho)

**2. Pontos a melhorar:**
(Liste 2-3 aspectos que precisam de atenção ou revisão)

**3. Sugestão específica:**
(Uma ação concreta e objetiva para melhorar o trabalho)

**4. Nota sugerida:** X/10

Use linguagem acadêmica, seja construtiva, direta e incentivadora.`
        }]
      })
    });

    const data = await response.json();
    const texto_ia = data.content?.map(c => c.text || '').join('') || 'Não foi possível gerar análise.';
    box.innerHTML = texto_ia
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

  } catch (error) {
    box.innerHTML = '<span style="color:#c5221f">❌ Erro ao conectar com a IA. Verifique sua conexão e tente novamente.</span>';
  }
}

// ===== SALVAR TRABALHO NO HISTÓRICO =====

function salvarTrabalho() {
  const nome  = document.getElementById('t-nome')?.value  || 'Sem nome';
  const disc  = document.getElementById('t-disc')?.value  || '—';
  const avTipo = document.getElementById('t-tipo')?.value || 'Trabalho';

  const total = calcularNota();
  const valorMax = parseFloat(document.getElementById('t-valor')?.value || 10);
  let nota = '—';
  if (total > 0) {
    nota = (total / 10 * valorMax).toFixed(1).replace('.', ',');
  }

  const item = {
    tipo: 'trabalho',
    nome,
    disc,
    avTipo,
    nota,
    data: new Date().toLocaleDateString('pt-BR')
  };
  adicionarAoHistorico(item);
  alert(`✅ Resultado de ${nome} salvo no histórico!`);
}

// ===== INICIALIZAR =====
document.addEventListener('DOMContentLoaded', () => {
  buildRubrica();
  setDataHoje('t-data');
  popularSelect('t-disc', DISCIPLINAS);
});
