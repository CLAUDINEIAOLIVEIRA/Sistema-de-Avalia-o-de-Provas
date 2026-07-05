/* ===========================
   FAETERJ — Sistema de Avaliação
   js/leitura-template.js — Leitura da folha de respostas por template fixo
   (sem IA: o professor alinha 4 cantos na foto, o sistema retifica a
   perspectiva e mede o escurecimento de cada bolha)
   =========================== */

// ===== LIMIARES DE DECISÃO (ajustáveis) =====
// A leitura conta, dentro de cada bolha, quantos pixels são "escuros"
// (tinta) em vez de calcular só a média — assim funciona bem mesmo com
// rabisco/espiral que não preenche 100% da bolha, e com caneta azul
// (que fica mais "clara" que preta em fórmulas de luminância comuns).
const OMR_LIMIAR_PIXEL_ESCURO   = 170; // um pixel conta como "tinta" se for mais escuro que isso
const OMR_LIMIAR_FRACAO_MARCADA = 0.15; // % mínima de pixels escuros pra bolha ser considerada marcada
const OMR_LIMIAR_AMBIGUO        = 0.06; // diferença mínima (em %) entre a 1ª e a 2ª mais marcada
const OMR_FATOR_RAIO_AMOSTRA    = 1.3;  // multiplicador do raio da bolha na amostragem (tolera leve erro de alinhamento)

// ===== TAMANHO MÁXIMO DA IMAGEM PROCESSADA (desempenho) =====
const OMR_MAX_DIM = 1400;

// ===== TEMPO MÁXIMO DE ESPERA AO CARREGAR UMA IMAGEM (arquivo corrompido/vazio) =====
const OMR_TIMEOUT_CARREGAR_MS = 12000;

// ===== DETECÇÃO AUTOMÁTICA DOS 4 CANTOS (marcadores pretos) =====
const OMR_CONFIANCA_MINIMA_CANTO = 0.45; // abaixo disso, não confia na detecção automática
const OMR_RAIO_DISTANCIA_ARRASTO = 26;   // distância (px no canvas visível) pra "pegar" um ponto já marcado

// ===== ÁLGEBRA: HOMOGRAFIA DE 4 PONTOS =====

function omrGaussSolve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivotRow = col, maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxAbs) { maxAbs = Math.abs(M[r][col]); pivotRow = r; }
    }
    if (pivotRow !== col) { const tmp = M[col]; M[col] = M[pivotRow]; M[pivotRow] = tmp; }
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivot;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function omrHomografia(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
  }
  const h = omrGaussSolve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function omrAplicar(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
}

// ===== ESTADO DO ALINHAMENTO =====

const omrState = {
  img: null,
  offCanvas: null,
  offCtx: null,
  offW: 0,
  offH: 0,
  alignCanvas: null,
  alignCtx: null,
  pontos: [], // até 4 pontos, no espaço do alignCanvas
  arrastando: null // índice do ponto sendo arrastado, ou null
};

const ORDEM_CANTOS = ['Superior-esquerdo', 'Superior-direito', 'Inferior-direito', 'Inferior-esquerdo'];

// ===== CARREGAR IMAGEM =====

function omrCarregarImagem(file) {
  if (!file || !file.size) {
    return Promise.reject(new Error(`O arquivo "${file ? file.name : ''}" está vazio ou corrompido. Tente enviar a foto novamente.`));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let resolvido = false;

    const timeoutId = setTimeout(() => {
      if (resolvido) return;
      resolvido = true;
      URL.revokeObjectURL(url);
      reject(new Error(`A imagem "${file.name}" demorou demais para carregar — o arquivo pode estar corrompido. Tente enviar novamente.`));
    }, OMR_TIMEOUT_CARREGAR_MS);

    img.onload = () => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timeoutId);

      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        reject(new Error(`Não foi possível ler a imagem "${file.name}" — o arquivo parece estar corrompido.`));
        return;
      }

      omrState.img = img;
      omrState.pontos = [];

      // Canvas offscreen em resolução "natural" (limitada) — usado para amostrar os pixels
      const escala = Math.min(1, OMR_MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      omrState.offW = Math.round(img.naturalWidth * escala);
      omrState.offH = Math.round(img.naturalHeight * escala);
      omrState.offCanvas = document.createElement('canvas');
      omrState.offCanvas.width = omrState.offW;
      omrState.offCanvas.height = omrState.offH;
      omrState.offCtx = omrState.offCanvas.getContext('2d', { willReadFrequently: true });
      omrState.offCtx.drawImage(img, 0, 0, omrState.offW, omrState.offH);

      // Canvas visível para o professor clicar nos 4 cantos
      const alignCanvas = document.getElementById('align-canvas');
      if (alignCanvas) {
        const larguraExibida = Math.min(700, omrState.offW);
        alignCanvas.width = larguraExibida;
        alignCanvas.height = Math.round(larguraExibida * (omrState.offH / omrState.offW));
        omrState.alignCanvas = alignCanvas;
        omrState.alignCtx = alignCanvas.getContext('2d');

        // Tenta detectar os 4 marcadores automaticamente, pra não depender
        // da precisão do clique manual do professor.
        const cantosAuto = omrDetectarCantos();
        if (cantosAuto) {
          const fx = alignCanvas.width / omrState.offW;
          const fy = alignCanvas.height / omrState.offH;
          omrState.pontos = cantosAuto.map(p => ({ x: p.x * fx, y: p.y * fy }));
        }
        omrDesenharAlinhamento();
        omrAtualizarStatusPontos(cantosAuto ? 'auto' : 'falhou');
      }
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(new Error(`Não foi possível abrir o arquivo "${file.name}" — ele pode estar vazio ou corrompido.`));
    };
    img.src = url;
  });
}

// ===== DETECÇÃO AUTOMÁTICA DOS 4 MARCADORES PRETOS DOS CANTOS =====
// Procura, em cada quadrante da folha, a janela mais "escura" (marcador
// preto impresso) — evita depender da precisão do clique manual do professor.

function omrBuscarCantoEmRegiao(x0, y0, x1, y1, raioJanela) {
  const { offCtx, offW, offH } = omrState;
  x0 = Math.max(0, Math.round(x0));
  y0 = Math.max(0, Math.round(y0));
  x1 = Math.min(offW, Math.round(x1));
  y1 = Math.min(offH, Math.round(y1));
  if (x1 - x0 <= raioJanela * 2 || y1 - y0 <= raioJanela * 2) return null;

  const w = x1 - x0, h = y1 - y0;
  const data = offCtx.getImageData(x0, y0, w, h).data;
  const brilho = (lx, ly) => {
    const idx = ((ly - y0) * w + (lx - x0)) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  };

  let melhor = null, melhorScore = -1;
  const passoCentro = 4, passoAmostra = 3;
  for (let y = y0 + raioJanela; y < y1 - raioJanela; y += passoCentro) {
    for (let x = x0 + raioJanela; x < x1 - raioJanela; x += passoCentro) {
      let escuros = 0, total = 0;
      for (let dy = -raioJanela; dy <= raioJanela; dy += passoAmostra) {
        for (let dx = -raioJanela; dx <= raioJanela; dx += passoAmostra) {
          if (brilho(x + dx, y + dy) < 70) escuros++;
          total++;
        }
      }
      const score = total ? escuros / total : 0;
      if (score > melhorScore) { melhorScore = score; melhor = { x, y }; }
    }
  }
  if (!melhor) return null;

  // A busca em janela (passo 4px) tende a "grudar" na borda da região de
  // busca quando há qualquer coisa escura por perto (sombra, borda da folha,
  // fundo da mesa) em vez de cair exatamente no centro do marcador impresso.
  // Refina o ponto calculando o centroide (média) dos pixels escuros numa
  // janela um pouco maior ao redor do melhor ponto — isso "puxa" o ponto
  // para o centro real do quadrado preto.
  const rr = Math.round(raioJanela * 1.6);
  const rx0 = Math.max(x0, Math.round(melhor.x - rr));
  const ry0 = Math.max(y0, Math.round(melhor.y - rr));
  const rx1 = Math.min(x1, Math.round(melhor.x + rr));
  const ry1 = Math.min(y1, Math.round(melhor.y + rr));
  let sx = 0, sy = 0, n = 0;
  for (let y = ry0; y < ry1; y++) {
    for (let x = rx0; x < rx1; x++) {
      if (brilho(x, y) < 70) { sx += x; sy += y; n++; }
    }
  }
  const centro = n ? { x: sx / n, y: sy / n } : melhor;
  return { x: centro.x, y: centro.y, score: melhorScore };
}

// Retorna 4 pontos (espaço do offCanvas), na ordem de ORDEM_CANTOS, ou
// null se não conseguir detectar todos os 4 com confiança mínima.
function omrDetectarCantos() {
  const { offW, offH } = omrState;
  const raio = Math.max(6, Math.round(offW * 0.018));
  const regioes = [
    { x0: 0,           y0: 0,           x1: offW * 0.30, y1: offH * 0.18 }, // superior-esquerdo
    { x0: offW * 0.70, y0: 0,           x1: offW,        y1: offH * 0.18 }, // superior-direito
    { x0: offW * 0.70, y0: offH * 0.70, x1: offW,        y1: offH        }, // inferior-direito
    { x0: 0,           y0: offH * 0.70, x1: offW * 0.30, y1: offH        }, // inferior-esquerdo
  ];
  const resultados = regioes.map(r => omrBuscarCantoEmRegiao(r.x0, r.y0, r.x1, r.y1, raio));
  if (resultados.some(r => !r || r.score < OMR_CONFIANCA_MINIMA_CANTO)) return null;
  return resultados.map(r => ({ x: r.x, y: r.y }));
}

// ===== DESENHAR CANVAS DE ALINHAMENTO (imagem + pontos marcados) =====

function omrDesenharAlinhamento() {
  const c = omrState.alignCanvas, ctx = omrState.alignCtx;
  if (!c || !ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(omrState.img, 0, 0, c.width, c.height);

  omrState.pontos.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(234,67,53,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), p.x, p.y + 4);
  });

  if (omrState.pontos.length === 4) {
    ctx.beginPath();
    ctx.moveTo(omrState.pontos[0].x, omrState.pontos[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(omrState.pontos[i].x, omrState.pontos[i].y);
    ctx.closePath();
    ctx.strokeStyle = '#34a853';
    ctx.lineWidth = 2;
    ctx.stroke();

    omrDesenharGradeBolhas();
  }
}

// Descobre a quantidade de questões configurada na tela (individual ou lote)
// pra poder desenhar a prévia da grade de bolhas sobre a foto.
function omrQtdAtual() {
  const idCampo = (typeof modoLeituraAtual !== 'undefined' && modoLeituraAtual === 'lote') ? 'lote-qtd' : 'p-qtd';
  const el = document.getElementById(idCampo) || document.getElementById('p-qtd') || document.getElementById('lote-qtd');
  return el ? (parseInt(el.value) || 0) : 0;
}

// Desenha, por cima da foto, um pontinho azul em cada posição de bolha
// prevista pela homografia atual — assim o professor VÊ na hora se os 4
// cantos estão bem alinhados (pontinhos caindo no centro de cada bolha
// impressa) ou se precisam ser arrastados para o lugar certo.
function omrDesenharGradeBolhas() {
  const c = omrState.alignCanvas, ctx = omrState.alignCtx;
  const qtd = omrQtdAtual();
  if (!qtd) return;
  try {
    const layout = folhaLayout(qtd);
    const fx = omrState.offW / c.width;
    const fy = omrState.offH / c.height;
    const dst = omrState.pontos.map(p => ({ x: p.x * fx, y: p.y * fy }));
    const src = [layout.cantos.tl, layout.cantos.tr, layout.cantos.br, layout.cantos.bl];
    const H = omrHomografia(src, dst);
    ctx.fillStyle = 'rgba(66,133,244,0.95)';
    layout.bubbles.forEach(b => {
      const p = omrAplicar(H, b.x, b.y);
      ctx.beginPath();
      ctx.arc(p.x / fx, p.y / fy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  } catch (e) {
    // qtd inválida/layout indisponível nesse momento — ignora a prévia
  }
}

// ===== INTERAÇÃO NO CANVAS: clicar para marcar canto, ou arrastar um já marcado =====

function omrCoordCanvas(evt) {
  const c = omrState.alignCanvas;
  const rect = c.getBoundingClientRect();
  const scaleX = c.width / rect.width;
  const scaleY = c.height / rect.height;
  const clientX = evt.touches && evt.touches.length ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches && evt.touches.length ? evt.touches[0].clientY : evt.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function omrPontoMaisProximo(x, y) {
  let indice = -1, distancia = Infinity;
  omrState.pontos.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < distancia) { distancia = d; indice = i; }
  });
  return { indice, distancia };
}

function omrAtualizarStatusPontos(modo) {
  const status = document.getElementById('pontos-status');
  if (status) {
    if (modo === 'auto') {
      status.textContent = '✅ 4 cantos detectados automaticamente — confira e, se precisar, arraste algum ponto para ajustar';
    } else if (modo === 'falhou') {
      status.textContent = `Não consegui detectar os cantos automaticamente — marque manualmente: ${ORDEM_CANTOS[0]}`;
    } else if (omrState.pontos.length < 4) {
      status.textContent = `${omrState.pontos.length}/4 cantos marcados — próximo: ${ORDEM_CANTOS[omrState.pontos.length]}`;
    } else {
      status.textContent = '4/4 cantos marcados — arraste algum ponto pra ajustar, ou clique em "Ler bolhas"';
    }
  }
  const btnLer = document.getElementById('btn-ler-bolhas');
  if (btnLer) btnLer.disabled = omrState.pontos.length !== 4;
}

function omrIniciarInteracao(evt) {
  if (evt.cancelable) evt.preventDefault();
  const { x, y } = omrCoordCanvas(evt);
  if (omrState.pontos.length > 0) {
    const { indice, distancia } = omrPontoMaisProximo(x, y);
    if (distancia <= OMR_RAIO_DISTANCIA_ARRASTO) {
      omrState.arrastando = indice;
      return;
    }
  }
  if (omrState.pontos.length < 4) {
    omrState.pontos.push({ x, y });
    omrDesenharAlinhamento();
    omrAtualizarStatusPontos();
  }
}

function omrMoverInteracao(evt) {
  if (omrState.arrastando == null) return;
  if (evt.cancelable) evt.preventDefault();
  const { x, y } = omrCoordCanvas(evt);
  omrState.pontos[omrState.arrastando] = { x, y };
  omrDesenharAlinhamento();
}

function omrFinalizarInteracao() {
  omrState.arrastando = null;
}

function omrReiniciarPontos() {
  omrState.pontos = [];
  omrState.arrastando = null;
  omrDesenharAlinhamento();
  omrAtualizarStatusPontos();
}

// ===== AMOSTRAGEM DE ESCURECIMENTO DE UMA BOLHA =====
// Em vez de calcular a luminância MÉDIA da bolha inteira (que sai clara
// demais quando a marcação é um rabisco/espiral que não cobre 100% da
// área, ou quando a tinta é azul), conta a FRAÇÃO de pixels "escuros"
// dentro do raio — muito mais tolerante a marcações reais de caneta.
function omrFracaoMarcada(ix, iy, raio) {
  const { offCtx, offW, offH } = omrState;
  const r = Math.max(2, Math.round(raio));
  const x0 = Math.max(0, Math.round(ix - r));
  const y0 = Math.max(0, Math.round(iy - r));
  const x1 = Math.min(offW, Math.round(ix + r));
  const y1 = Math.min(offH, Math.round(iy + r));
  if (x1 <= x0 || y1 <= y0) return 0;

  const data = offCtx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let escuros = 0, total = 0;
  const w = x1 - x0;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const dx = xx - ix, dy = yy - iy;
      if (dx * dx + dy * dy > r * r) continue;
      const idx = ((yy - y0) * w + (xx - x0)) * 4;
      // Brilho simples (média dos 3 canais, sem peso) — detecta tinta
      // de qualquer cor (preta, azul etc.) melhor que luminância ponderada,
      // que "clareia" demais tons de azul saturado.
      const brilho = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brilho < OMR_LIMIAR_PIXEL_ESCURO) escuros++;
      total++;
    }
  }
  return total ? escuros / total : 0;
}

// ===== LER TODAS AS BOLHAS DA FOLHA =====
// Retorna { respostas: ['a','b','?',...], confiancaBaixa: [numeros das questões duvidosas] }
function omrLerRespostas(qtd) {
  if (omrState.pontos.length !== 4) throw new Error('Marque os 4 cantos da folha antes de ler.');

  const layout = folhaLayout(qtd);
  const c = layout.cantos;
  // pontos no espaço do alignCanvas -> converter para espaço da imagem natural (offCanvas)
  const fx = omrState.offW / omrState.alignCanvas.width;
  const fy = omrState.offH / omrState.alignCanvas.height;
  const dst = omrState.pontos.map(p => ({ x: p.x * fx, y: p.y * fy }));
  const src = [c.tl, c.tr, c.br, c.bl];
  const H = omrHomografia(src, dst);

  const respostas = new Array(qtd).fill('?');
  const duvidosas = [];

  for (let q = 1; q <= qtd; q++) {
    const bolhasQ = layout.bubbles.filter(b => b.questao === q);
    const medidas = bolhasQ.map(b => {
      const centro = omrAplicar(H, b.x, b.y);
      // Raio calculado nas direções X e Y (não só X) — mais preciso quando
      // a foto tem perspectiva/rotação, já que a bolha deixa de ser um
      // círculo perfeito na imagem.
      const bordaX = omrAplicar(H, b.x + FOLHA_BUBBLE_R, b.y);
      const bordaY = omrAplicar(H, b.x, b.y + FOLHA_BUBBLE_R);
      const raioX = Math.hypot(bordaX.x - centro.x, bordaX.y - centro.y);
      const raioY = Math.hypot(bordaY.x - centro.x, bordaY.y - centro.y);
      const raio = Math.max(3, ((raioX + raioY) / 2) * OMR_FATOR_RAIO_AMOSTRA);
      return { letra: b.letra, fracao: omrFracaoMarcada(centro.x, centro.y, raio) };
    });
    medidas.sort((a, b2) => b2.fracao - a.fracao);
    const [mais, seg] = medidas;

    if (mais.fracao < OMR_LIMIAR_FRACAO_MARCADA) {
      respostas[q - 1] = '?'; // nada marcado
    } else if (seg && (mais.fracao - seg.fracao) < OMR_LIMIAR_AMBIGUO) {
      respostas[q - 1] = '?'; // marcação ambígua
      duvidosas.push(q);
    } else {
      respostas[q - 1] = mais.letra;
    }
  }

  return { respostas, duvidosas };
}

// ===== PREENCHER GRADE COM RESPOSTAS LIDAS =====

function preencherRespostasLidas(respostas) {
  respostas.forEach((resp, i) => {
    const el = document.getElementById('resp' + (i + 1));
    if (el && resp !== '?') el.value = resp.toLowerCase();
  });
}

// ===== MOSTRAR PREVIEW DA IMAGEM ENVIADA =====

function mostrarPreview(file) {
  const preview = document.getElementById('img-preview');
  const container = document.getElementById('preview-container');
  if (!preview || !container) return;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.style.display = 'block';
  container.classList.remove('hidden');
}

// ===== INICIALIZAR (liga o clique do canvas) =====

function initLeituraTemplate() {
  const c = document.getElementById('align-canvas');
  if (!c) return;
  c.addEventListener('mousedown', omrIniciarInteracao);
  c.addEventListener('mousemove', omrMoverInteracao);
  window.addEventListener('mouseup', omrFinalizarInteracao);
  c.addEventListener('touchstart', omrIniciarInteracao, { passive: false });
  c.addEventListener('touchmove', omrMoverInteracao, { passive: false });
  window.addEventListener('touchend', omrFinalizarInteracao);
}
