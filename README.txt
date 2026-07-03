=========================================
SISTEMA DE AVALIAÇÃO — FAETERJ BARRA MANSA
Professora Claudineia Moreira de Oliveira
=========================================

ESTRUTURA DO PROJETO:
---------------------
faeterj-avaliacao/
│
├── pages/
│   ├── index.html       → Página inicial (menu principal)
│   ├── prova.html       → Correção de provas objetivas
│   ├── trabalho.html    → Avaliação de trabalhos/artigos
│   └── historico.html   → Histórico de avaliações
│
├── css/
│   └── style.css        → Todos os estilos visuais
│
├── js/
│   ├── utils.js         → Funções compartilhadas (histórico, CSV, etc.)
│   ├── prova.js         → Lógica da prova objetiva
│   └── trabalho.js      → Lógica da avaliação de trabalhos + IA
│
└── README.txt           → Este arquivo

COMO USAR:
----------
1. Abra a pasta "pages" no explorador de arquivos
2. Dê duplo clique em "index.html"
3. O sistema abrirá no navegador (Chrome, Firefox, Edge, etc.)
4. Navegue pelas abas: Prova / Trabalho / Histórico

FUNCIONALIDADES:
----------------
📋 PROVA OBJETIVA
  - Cadastro do nome, disciplina e tipo de avaliação
  - Gabarito configurável (10, 15, 20, 25 ou 30 questões)
  - Lançamento das respostas do aluno
  - Correção automática com contagem de acertos
  - Cálculo de nota (regra N2: 24-30 = 3,0 / 1-23 = 2,0)
  - Tabela detalhada por questão (✓/✗)
  - Opção de imprimir o resultado

📄 TRABALHO / ARTIGO
  - Rubrica com 5 critérios e pesos:
    • Estrutura e organização (15%)
    • Fundamentação teórica (25%)
    • Metodologia (20%)
    • Resultados e análise (25%)
    • Escrita e normas ABNT (15%)
  - Sistema de estrelas (1-5) por critério
  - Cálculo automático da nota ponderada

🕐 HISTÓRICO
  - Lista todas as avaliações salvas
  - Filtro por nome, tipo e disciplina
  - Exportação para CSV (abre no Excel)
  - Limpeza do histórico

OBSERVAÇÕES:
------------
- Os dados ficam salvos no navegador (localStorage)
- O CSV exportado pode ser aberto no Excel ou Google Sheets
- Compatível com Chrome, Firefox, Edge e Safari
