/* ===========================
   FAETERJ — Sistema de Avaliação
   js/leitura-template.js — Leitura da folha de respostas por template fixo
   (sem IA: o professor alinha 4 cantos na foto, o sistema retifica a
   perspectiva e mede o escurecimento de cada bolha)
   =========================== */

// ===== LIMIARES DE DECISÃO (ajustáveis) =====
const OMR_LIMIAR_BRANCO  = 195; // acima disso, bolha é considerada em branco
const OMR_LIMIAR_AMBIGUO = 25;  // diferença mínima entre a mais escura e a 2ª mais escura

// ===== TAMANHO MÁXIMO DA IMAGEM PROCESSADA (desempenho) =====
const OMR_MAX_DIM = 1400;

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
  pontos: [] // até 4 pontos, no espaço do alignCanvas
};

const ORDEM_CANTOS = ['Superior-esquerdo', 'Superior-direito', 'Inferior-direito', 'Inferior-esquerdo'];

// ===== CARREGAR IMAGEM =====

function omrCarregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
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
        omrDesenharAlinhamento();
      }
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    img.src = url;
  });
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
  }
}

// ===== CLIQUE NO CANVAS (marcar canto) =====

function omrClicarCanvas(evt) {
  if (omrState.pontos.length >= 4) return;
  const c = omrState.alignCanvas;
  const rect = c.getBoundingClientRect();
  const scaleX = c.width / rect.width;
  const scaleY = c.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  omrState.pontos.push({ x, y });
  omrDesenharAlinhamento();
  const status = document.getElementById('pontos-status');
  if (status) {
    status.textContent = omrState.pontos.length < 4
      ? `${omrState.pontos.length}/4 cantos marcados — próximo: ${ORDEM_CANTOS[omrState.pontos.length]}`
      : '4/4 cantos marcados — pronto para ler';
  }
  const btnLer = document.getElementById('btn-ler-bolhas');
  if (btnLer) btnLer.disabled = omrState.pontos.length !== 4;
}

function omrReiniciarPontos() {
  omrState.pontos = [];
  omrDesenharAlinhamento();
  const status = document.getElementById('pontos-status');
  if (status) status.textContent = `0/4 cantos marcados — próximo: ${ORDEM_CANTOS[0]}`;
  const btnLer = document.getElementById('btn-ler-bolhas');
  if (btnLer) btnLer.disabled = true;
}

// ===== AMOSTRAGEM DE ESCURECIMENTO DE UMA BOLHA =====

function omrLuminanciaMedia(ix, iy, raio) {
  const { offCtx, offW, offH } = omrState;
  const r = Math.max(2, Math.round(raio));
  const x0 = Math.max(0, Math.round(ix - r));
  const y0 = Math.max(0, Math.round(iy - r));
  const x1 = Math.min(offW, Math.round(ix + r));
  const y1 = Math.min(offH, Math.round(iy + r));
  if (x1 <= x0 || y1 <= y0) return 255;

  const data = offCtx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let soma = 0, n = 0;
  const w = x1 - x0;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const dx = xx - ix, dy = yy - iy;
      if (dx * dx + dy * dy > r * r) continue;
      const idx = ((yy - y0) * w + (xx - x0)) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      soma += lum; n++;
    }
  }
  return n ? soma / n : 255;
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
      const borda  = omrAplicar(H, b.x + FOLHA_BUBBLE_R, b.y);
      const raio = Math.max(3, Math.hypot(borda.x - centro.x, borda.y - centro.y) * 0.9);
      return { letra: b.letra, lum: omrLuminanciaMedia(centro.x, centro.y, raio) };
    });
    medidas.sort((a, b2) => a.lum - b2.lum);
    const [mais, seg] = medidas;

    if (mais.lum > OMR_LIMIAR_BRANCO) {
      respostas[q - 1] = '?'; // nada marcado
    } else if (seg && (seg.lum - mais.lum) < OMR_LIMIAR_AMBIGUO) {
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
  if (c) c.addEventListener('click', omrClicarCanvas);
}
