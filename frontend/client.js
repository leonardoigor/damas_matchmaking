const ws = new WebSocket('ws://localhost:3000'); // Conecta ao backend
let username = '';

// Elementos da interface
const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username');
const usernameDisplay = document.getElementById('username-display');
const loginForm = document.getElementById('login-form');
const cancelQueueButton = document.getElementById('cancel-queue');

// Evento de login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    username = usernameInput.value.trim();

    if (username) {
        // Envia o nome de usuário para o backend
        ws.send(JSON.stringify({ type: 'login', username }));

        // Mostra a tela de espera
        loginScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        usernameDisplay.textContent = username;

        // Entra na fila de matchmaking
        ws.send(JSON.stringify({ type: 'join_queue' }));
    }
});

// Evento de cancelar busca por partida
cancelQueueButton.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'cancel_queue' }));
    waitingScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

// Recebe mensagens do backend
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'login_success':
            console.log('Login realizado com sucesso:', data.username);
            break;

        case 'match_found':
            // Mostra a tela do jogo
            waitingScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');

            // Conecta ao jogo de damas
            const gameWs = new WebSocket(`ws://${data.podUrl}`);
            iniciarJogoDamas(gameWs); // Inicia o jogo de damas
            break;

        case 'end_game_success':
            alert('Partida finalizada com sucesso!');
            gameScreen.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            break;

        case 'end_game_error':
            alert('Erro ao finalizar partida.');
            break;
    }
};

// Função para iniciar o jogo de damas
function iniciarJogoDamas(gameWs) {
    const canvas = document.getElementById('damasCanvas');
    const ctx = canvas.getContext('2d');
    const TAMANHO_CASA = 50;

    let minhaPeca; // Armazena a peça do jogador (preto ou vermelho)
    let pecaSelecionada = null; // Peça selecionada pelo jogador
    let casasValidas = []; // Casas válidas para mover a peça selecionada
    let gameState = null; // Armazena o estado do jogo

    gameWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data);

        switch (data.type) {
            case 'game_start':
                minhaPeca = data.initialState.players[data.playerId].team; // Define a peça do jogador
                gameState = data.initialState; // Armazena o estado inicial do jogo
                desenharTabuleiro(gameState.tabuleiro);
                atualizarPlacar(gameState.pontosPretas, gameState.pontosVermelhas);
                atualizarVez(gameState.turno);
                break;

            case 'game_update':
                gameState = data.state; // Atualiza o estado do jogo
                desenharTabuleiro(gameState.tabuleiro);
                atualizarPlacar(gameState.pontosPretas, gameState.pontosVermelhas);
                atualizarVez(gameState.turno);
                break;
        }
    };

    // Função para desenhar o tabuleiro
    function desenharTabuleiro(tabuleiro) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                // Desenha as casas
                ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#000';
                ctx.fillRect(j * TAMANHO_CASA, i * TAMANHO_CASA, TAMANHO_CASA, TAMANHO_CASA);

                // Desenha as peças
                const peca = tabuleiro[i][j];
                if (peca === 'preto' || peca === 'preto-dama') {
                    ctx.fillStyle = peca === 'preto' ? '#0000ff' : '#0000aa';
                    ctx.beginPath();
                    ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    if (peca === 'preto-dama') {
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (peca === 'vermelho' || peca === 'vermelho-dama') {
                    ctx.fillStyle = peca === 'vermelho' ? '#ff0000' : '#aa0000';
                    ctx.beginPath();
                    ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    if (peca === 'vermelho-dama') {
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        // Desenha a peça selecionada
        if (pecaSelecionada) {
            const { linha, coluna } = pecaSelecionada;
            ctx.strokeStyle = '#00ff00'; // Cor da borda da peça selecionada
            ctx.lineWidth = 3;
            ctx.strokeRect(coluna * TAMANHO_CASA, linha * TAMANHO_CASA, TAMANHO_CASA, TAMANHO_CASA);
        }
    }

    // Evento de clique no tabuleiro
    canvas.addEventListener('click', (event) => {
        const x = event.offsetX;
        const y = event.offsetY;

        const coluna = Math.floor(x / TAMANHO_CASA);
        const linha = Math.floor(y / TAMANHO_CASA);

        // Verifica se é a vez do jogador
        if (gameState.turno === minhaPeca) {
            if (!pecaSelecionada) {
                // Seleciona uma peça
                if (gameState.tabuleiro[linha][coluna] === minhaPeca || gameState.tabuleiro[linha][coluna] === `${minhaPeca}-dama`) {
                    pecaSelecionada = { linha, coluna };
                    calcularCasasValidas(linha, coluna);
                    desenharTabuleiro(gameState.tabuleiro);
                }
            } else {
                // Verifica se o movimento é válido
                if (casasValidas.some(casa => casa.linha === linha && casa.coluna === coluna)) {
                    // Movimento válido (simples ou captura)
                    gameWs.send(JSON.stringify({
                        type: 'move',
                        linhaInicial: pecaSelecionada.linha,
                        colunaInicial: pecaSelecionada.coluna,
                        linhaFinal: linha,
                        colunaFinal: coluna
                    }));
                    pecaSelecionada = null;
                    casasValidas = [];
                } else {
                    alert('Movimento inválido!');
                }
            }
        } else {
            alert('Não é a sua vez!');
        }
    });

    // Função para calcular casas válidas
    function calcularCasasValidas(linha, coluna) {
        casasValidas = [];

        // Verifica movimentos simples (1 casa)
        const direcoes = minhaPeca === 'preto' ? [1] : [-1]; // Pretas movem para baixo, vermelhas para cima
        for (const dirLinha of direcoes) {
            for (const dirColuna of [-1, 1]) {
                const novaLinha = linha + dirLinha;
                const novaColuna = coluna + dirColuna;

                if (novaLinha >= 0 && novaLinha < 8 && novaColuna >= 0 && novaColuna < 8) {
                    if (gameState.tabuleiro[novaLinha][novaColuna] === null) {
                        casasValidas.push({ linha: novaLinha, coluna: novaColuna });
                    }
                }
            }
        }

        // Verifica capturas (2 casas)
        for (const dirLinha of direcoes) {
            for (const dirColuna of [-2, 2]) {
                const novaLinha = linha + dirLinha;
                const novaColuna = coluna + dirColuna;

                if (novaLinha >= 0 && novaLinha < 8 && novaColuna >= 0 && novaColuna < 8) {
                    const pecaMeio = gameState.tabuleiro[(linha + novaLinha) / 2][(coluna + novaColuna) / 2];
                    if (pecaMeio && ehPecaAdversaria(pecaMeio, minhaPeca) && gameState.tabuleiro[novaLinha][novaColuna] === null) {
                        casasValidas.push({ linha: novaLinha, coluna: novaColuna });
                    }
                }
            }
        }
    }

    // Função para verificar se uma peça é adversária
    function ehPecaAdversaria(peca, minhaPeca) {
        return (minhaPeca === 'preto' && (peca === 'vermelho' || peca === 'vermelho-dama')) ||
            (minhaPeca === 'vermelho' && (peca === 'preto' || peca === 'preto-dama'));
    }

    // Função para atualizar o placar
    function atualizarPlacar(pontosPretas, pontosVermelhas) {
        document.getElementById('pontosPretas').textContent = pontosPretas;
        document.getElementById('pontosVermelhas').textContent = pontosVermelhas;
    }


    // Função para atualizar a vez do jogador
    function atualizarVez(turno) {
        const vezDisplay = document.getElementById('vez');
        if (turno === 'preto') {
            vezDisplay.textContent = 'Vez: Azuis';
        } else if (turno === 'vermelho') {
            vezDisplay.textContent = 'Vez: Vermelhas';
        }
    }

    // Tratamento de erros
    gameWs.onerror = (error) => {
        console.error('Erro na conexão com o jogo:', error);
        alert('Erro na conexão com o jogo. Tente novamente.');
    };

    gameWs.onclose = () => {
        console.log('Conexão com o jogo fechada.');
        alert('Conexão com o jogo fechada.');
    };
}