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
        omrDesenharAlinhamento();
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
  if (c) c.addEventListener('click', omrClicarCanvas);
}
