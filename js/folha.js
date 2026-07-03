/* ===========================
   FAETERJ — Sistema de Avaliação
   js/folha.js — Layout compartilhado da folha de respostas
   (usado tanto para IMPRIMIR a folha quanto para LER a foto preenchida)
   =========================== */

// Tamanho de referência do layout (proporção A4 retrato)
const FOLHA_REF_W = 850;
const FOLHA_REF_H = 1200;
const FOLHA_MARGEM = 50;
const FOLHA_BUBBLE_R = 19;
const FOLHA_FUNDO = '#eaf2fd';

// ===== CALCULAR LAYOUT DA GRADE DE BOLHAS =====
// Retorna os 4 marcadores de canto (espaço de referência) e a posição
// de cada bolha (questão + letra) também no espaço de referência.
function folhaLayout(qtd) {
  const cantos = {
    tl: { x: FOLHA_MARGEM, y: FOLHA_MARGEM },
    tr: { x: FOLHA_REF_W - FOLHA_MARGEM, y: FOLHA_MARGEM },
    br: { x: FOLHA_REF_W - FOLHA_MARGEM, y: FOLHA_REF_H - FOLHA_MARGEM },
    bl: { x: FOLHA_MARGEM, y: FOLHA_REF_H - FOLHA_MARGEM }
  };

  const colunas = qtd <= 10 ? 1 : (qtd <= 20 ? 2 : 3);
  const linhas = Math.ceil(qtd / colunas);

  const gridXStart = 95;
  const gridXEnd = FOLHA_REF_W - 95;
  const gridYStart = 315;
  const gridYEnd = FOLHA_REF_H - 90;

  // Largura "natural" de uma coluna (com 3 colunas, que é o caso mais cheio),
  // usada como referência para centralizar o bloco quando há menos colunas.
  const colWidth = (gridXEnd - gridXStart) / 3;
  const blocoLargura = colunas * colWidth;
  const gridXInicioBloco = gridXStart + (gridXEnd - gridXStart - blocoLargura) / 2;
  const rowHeight = Math.min(95, (gridYEnd - gridYStart) / linhas);

  const letras = ['a', 'b', 'c', 'd'];
  const bubbleSpacing = 48;
  const labelOffset = 28;

  const bubbles = [];
  for (let i = 0; i < qtd; i++) {
    const col = Math.floor(i / linhas);
    const row = i % linhas;
    const cx0 = gridXInicioBloco + col * colWidth + labelOffset;
    const cy = gridYStart + row * rowHeight + rowHeight / 2;
    letras.forEach((letra, li) => {
      bubbles.push({
        questao: i + 1,
        letra,
        x: cx0 + li * bubbleSpacing,
        y: cy,
        labelX: cx0 - labelOffset + 8,
        labelY: cy
      });
    });
  }

  return { cantos, colunas, linhas, gridXStart, gridYStart, rowHeight, bubbles };
}

// ===== ESCAPAR TEXTO PARA USO SEGURO DENTRO DO SVG =====
function folhaEsc(str) {
  return String(str || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ===== GERAR SVG DA FOLHA (usado na impressão) =====
function folhaSVG(qtd, dadosAluno) {
  dadosAluno = dadosAluno || {};
  const layout = folhaLayout(qtd);
  const marcador = (c) =>
    `<rect x="${c.x - 15}" y="${c.y - 15}" width="30" height="30" fill="#000"></rect>`;

  const bubblesHTML = layout.bubbles.map(b => `
    <circle cx="${b.x}" cy="${b.y}" r="${FOLHA_BUBBLE_R}" fill="#fff" stroke="#000" stroke-width="3"></circle>
    <text x="${b.x}" y="${b.y + 6}" font-size="17" font-weight="600" text-anchor="middle" font-family="Arial" fill="#000">${b.letra}</text>
  `).join('');

  const labelsHTML = [];
  for (let i = 1; i <= qtd; i++) {
    const b = layout.bubbles.find(x => x.questao === i && x.letra === 'a');
    labelsHTML.push(`<text x="${b.labelX}" y="${b.labelY + 6}" font-size="20" font-weight="700" font-family="Arial" text-anchor="end" fill="#000">${i}</text>`);
  }

  // ===== CABEÇALHO — TABELA COM OS MESMOS CAMPOS DO MODELO FAETERJ =====
  const TX = 90, TW = FOLHA_REF_W - 90 - TX; // 90..760
  const COL1 = TX + 370; // divisória entre a coluna da esquerda e a direita, igual nas 3 linhas

  // Texto com largura forçada (encolhe automaticamente se não couber na célula)
  const folhaTexto = (x, y, texto, fontSize, weight, maxWidthPx) => {
    const esc = folhaEsc(texto);
    const estWidth = esc.length * fontSize * 0.56;
    const extra = maxWidthPx && estWidth > maxWidthPx
      ? ` textLength="${maxWidthPx}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="${weight}" font-family="Arial" fill="#000"${extra}>${esc}</text>`;
  };

  const celula = (x, y, w, h, label, valor) => {
    const maxW = w - 16;
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="1.5"></rect>`;
    out += folhaTexto(x + 8, y + 18, label, 12, 700, maxW);
    if (valor) out += folhaTexto(x + 8, y + 35, String(valor), 12, 400, maxW);
    return out;
  };

  const celulaChecklist = (x, y, w, h, opcoes, selecionado) => {
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#000" stroke-width="1.5"></rect>`;
    let cx = x + 10;
    const cy = y + h / 2;
    opcoes.forEach(op => {
      const marcado = op === selecionado;
      out += `<rect x="${cx}" y="${cy - 7}" width="14" height="14" fill="${marcado ? '#000' : '#fff'}" stroke="#000" stroke-width="1.5"></rect>`;
      out += folhaTexto(cx + 20, cy + 5, op, 12, 700, null);
      cx += 34 + op.length * 7.2;
    });
    return out;
  };

  const y0 = 95;
  const h1 = 54, h2 = 42, h3 = 54;
  const y1 = y0 + h1; // fim linha 1
  const y2 = y1 + h2; // fim linha 2
  const y3 = y2 + h3; // fim linha 3

  const cabecalhoHTML = `
    ${celula(TX, y0, COL1 - TX, h1, 'Nome do aluno (a):', dadosAluno.nome)}
    ${celula(COL1, y0, (TX + TW - COL1) * 0.5, h1, 'Período:', dadosAluno.periodo)}
    ${celula(COL1 + (TX + TW - COL1) * 0.5, y0, (TX + TW - COL1) * 0.5, h1, 'Matrícula:', dadosAluno.matricula)}

    ${celula(TX, y1, COL1 - TX, h2, 'Professor (a):', dadosAluno.professor)}
    ${celula(COL1, y1, TX + TW - COL1, h2, 'Disciplina:', dadosAluno.disc)}

    ${celulaChecklist(TX, y2, COL1 - TX, h3, ['P1', 'P2', '2ª Chamada', 'Prova final'], dadosAluno.avTipo)}
    ${celula(COL1, y2, (TX + TW - COL1) / 3, h3, 'Data:', dadosAluno.data)}
    ${celula(COL1 + (TX + TW - COL1) / 3, y2, (TX + TW - COL1) / 3, h3, 'Valor:', dadosAluno.valor)}
    ${celula(COL1 + (TX + TW - COL1) * 2 / 3, y2, (TX + TW - COL1) / 3, h3, 'Nota:', '')}
  `;

  return `
<svg viewBox="0 0 ${FOLHA_REF_W} ${FOLHA_REF_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:${FOLHA_FUNDO}">
  <rect x="0" y="0" width="${FOLHA_REF_W}" height="${FOLHA_REF_H}" fill="${FOLHA_FUNDO}"></rect>
  ${marcador(layout.cantos.tl)}
  ${marcador(layout.cantos.tr)}
  ${marcador(layout.cantos.br)}
  ${marcador(layout.cantos.bl)}

  <text x="${FOLHA_REF_W / 2}" y="70" font-size="18" font-weight="700" font-family="Arial" text-anchor="middle" fill="#000">FOLHA DE RESPOSTAS — FAETERJ Barra Mansa</text>

  ${cabecalhoHTML}

  <text x="${TX}" y="${y3 + 20}" font-size="11" font-family="Arial" fill="#c5221f">Pinte completamente a bolha da alternativa escolhida, com caneta preta ou azul. · ${qtd} questões</text>
  <line x1="${TX}" y1="${y3 + 32}" x2="${TX + TW}" y2="${y3 + 32}" stroke="#ccc" stroke-width="1"></line>

  ${labelsHTML.join('')}
  ${bubblesHTML}
</svg>`;
}
