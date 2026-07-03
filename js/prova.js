/* ===========================
   FAETERJ — Sistema de Avaliação
   js/prova.js — Lógica da prova objetiva
   =========================== */

// ===== CONSTRUIR GRADES DE QUESTÕES =====

function buildGrids() {
  const qtd = parseInt(document.getElementById('p-qtd').value);
  ['gab', 'resp'].forEach(prefix => {
    const g = document.getElementById(prefix + '-grid');
    if (!g) return;
    g.innerHTML = '';
    for (let i = 1; i <= qtd; i++) {
      const d = document.createElement('div');
      d.className = 'gab-item';
      d.innerHTML = `
        <span>Q${i}</span>
        <select id="${prefix}${i}">
          <option value="">—</option>
          <option>a</option>
          <option>b</option>
          <option>c</option>
          <option>d</option>
        </select>`;
      g.appendChild(d);
    }
  });
}

// ===== PREENCHER GABARITO DEMO =====

function preencherGabarito() {
  const qtd = parseInt(document.getElementById('p-qtd').value);
  const demo = ['c','b','c','b','b','c','b','b','b','c',
                 'b','b','b','b','b','b','c','b','b','b',
                 'b','b','b','b','c','b','b','b','b','c'];
  for (let i = 1; i <= qtd; i++) {
    const el = document.getElementById('gab' + i);
    if (el) el.value = demo[i - 1] || 'a';
  }
}

// ===== CORRIGIR PROVA =====

function corrigirProva() {
  const qtd    = parseInt(document.getElementById('p-qtd').value);
  const valor  = parseFloat(document.getElementById('p-valor').value);
  let acertos  = 0;
  const questoesCertas = [];
  const questoesErradas = [];

  const tbody = document.getElementById('res-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (let i = 1; i <= qtd; i++) {
    const gab  = document.getElementById('gab'  + i)?.value || '';
    const resp = document.getElementById('resp' + i)?.value || '';
    const ok   = gab && resp && gab === resp;
    if (ok) { acertos++; questoesCertas.push(i); } else { questoesErradas.push(i); }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600">Questão ${i}</td>
      <td style="color:#1a73e8;font-weight:600">${gab  || '—'}</td>
      <td style="font-weight:600">${resp || '—'}</td>
      <td><span class="badge ${ok ? 'badge-ok' : 'badge-err'}">${ok ? '✓ Acerto' : '✗ Erro'}</span></td>`;
    tbody.appendChild(tr);
  }

  // Calcular nota conforme tipo de avaliação
  const pct = Math.round(acertos / qtd * 100);
  let notaFinal, cls, msg;

  const n = (acertos / qtd * valor);
  notaFinal = n.toFixed(1).replace('.', ',');
  cls = n >= valor * 0.6 ? 'result-ok' : n >= valor * 0.4 ? 'result-warn' : 'result-bad';
  msg = n >= valor * 0.6 ? 'Aprovado' : n >= valor * 0.4 ? 'Recuperação' : 'Reprovado';

  const summary = document.getElementById('res-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="result-box ${cls}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="score-big">${acertos} / ${qtd}</div>
            <div class="score-label">${pct}% de acertos</div>
          </div>
          <div style="text-align:right">
            <div class="score-big">${notaFinal}</div>
            <div class="score-label">${msg}</div>
          </div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.1);font-size:12px">
          <div><strong>✓ Acertou (${questoesCertas.length}):</strong> ${questoesCertas.length ? questoesCertas.join(', ') : '—'}</div>
          <div style="margin-top:4px"><strong>✗ Errou (${questoesErradas.length}):</strong> ${questoesErradas.length ? questoesErradas.join(', ') : '—'}</div>
        </div>
      </div>`;
  }

  const resultado = document.getElementById('resultado-prova');
  if (resultado) {
    resultado.classList.remove('hidden');
    resultado.scrollIntoView({ behavior: 'smooth' });
  }

  // Guardar para salvar no histórico
  window._lastProvaResult = { acertos, qtd, nota: notaFinal, pct };
}

// ===== LIMPAR PROVA =====

function limparProva() {
  buildGrids();
  const resultado = document.getElementById('resultado-prova');
  if (resultado) resultado.classList.add('hidden');
  const nome = document.getElementById('p-nome');
  if (nome) nome.value = '';
}

// ===== SALVAR PROVA NO HISTÓRICO =====

function salvarProva() {
  if (!window._lastProvaResult) {
    alert('Corrija a prova primeiro.');
    return;
  }
  const nome = document.getElementById('p-nome')?.value || 'Sem nome';
  const disc = document.getElementById('p-disc')?.value || '—';
  const avTipo = document.getElementById('p-tipo')?.value || 'Prova';
  const item = {
    tipo: 'prova',
    nome,
    disc,
    avTipo,
    nota: window._lastProvaResult.nota,
    data: new Date().toLocaleDateString('pt-BR')
  };
  adicionarAoHistorico(item);
  alert(`✅ Resultado de ${nome} salvo no histórico!`);
}

// ===== INICIALIZAR =====
document.addEventListener('DOMContentLoaded', () => {
  buildGrids();
  setDataHoje('p-data');
  popularSelect('p-disc', DISCIPLINAS);

  const qtdEl = document.getElementById('p-qtd');
  if (qtdEl) qtdEl.addEventListener('change', buildGrids);
});
