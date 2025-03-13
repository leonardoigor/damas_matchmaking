const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const TAMANHO_CASA = 50;
const LINHAS = 8;
const COLUNAS = 8;

let gameState = {
    tabuleiro: [],
    turno: 'preto', // Começa com as peças pretas
    pontosPretas: 0,
    pontosVermelhas: 0,
    players: {} // Jogadores conectados
};

// Inicializa o tabuleiro
function inicializarTabuleiro() {
    for (let i = 0; i < LINHAS; i++) {
        gameState.tabuleiro[i] = [];
        for (let j = 0; j < COLUNAS; j++) {
            if ((i + j) % 2 === 0) {
                gameState.tabuleiro[i][j] = null; // Casas brancas
            } else {
                if (i < 3) {
                    gameState.tabuleiro[i][j] = 'preto'; // Peças pretas
                } else if (i > 4) {
                    gameState.tabuleiro[i][j] = 'vermelho'; // Peças vermelhas
                } else {
                    gameState.tabuleiro[i][j] = null; // Casas vazias no meio
                }
            }
        }
    }
}

// Verifica se um movimento é válido
function movimentoValido(linhaInicial, colunaInicial, linhaFinal, colunaFinal, peca) {
    const pecaAlvo = gameState.tabuleiro[linhaFinal][colunaFinal];

    // Verifica se a casa final está vazia
    if (pecaAlvo !== null) {
        return false;
    }

    // Verifica o movimento das peças normais
    if (peca === 'preto' || peca === 'vermelho') {
        const deltaLinha = linhaFinal - linhaInicial;
        const deltaColuna = colunaFinal - colunaInicial;

        // Verifica se o movimento é diagonal
        if (Math.abs(deltaLinha) !== 1 && Math.abs(deltaLinha) !== 2) {
            return false;
        }
        if (Math.abs(deltaColuna) !== 1 && Math.abs(deltaColuna) !== 2) {
            return false;
        }

        // Verifica se é uma captura
        if (Math.abs(deltaLinha) === 2 && Math.abs(deltaColuna) === 2) {
            const linhaMeio = (linhaInicial + linhaFinal) / 2;
            const colunaMeio = (colunaInicial + colunaFinal) / 2;
            if (ehPecaAdversaria(gameState.tabuleiro[linhaMeio][colunaMeio], peca)) {
                return true; // Captura de peça
            }
        }

        // Verifica se é um movimento simples
        if (Math.abs(deltaLinha) === 1 && Math.abs(deltaColuna) === 1) {
            return true;
        }
    }

    // Verifica o movimento das damas
    if (peca === 'preto-dama' || peca === 'vermelho-dama') {
        const deltaLinha = linhaFinal - linhaInicial;
        const deltaColuna = colunaFinal - colunaInicial;

        // Verifica se o movimento é diagonal
        if (Math.abs(deltaLinha) !== Math.abs(deltaColuna)) {
            return false;
        }

        // Verifica se há peças no caminho
        const passoLinha = deltaLinha > 0 ? 1 : -1;
        const passoColuna = deltaColuna > 0 ? 1 : -1;
        let i = linhaInicial + passoLinha;
        let j = colunaInicial + passoColuna;
        let pecasNoCaminho = 0;

        while (i !== linhaFinal && j !== colunaFinal) {
            if (gameState.tabuleiro[i][j] !== null) {
                pecasNoCaminho++;
                if (pecasNoCaminho > 1 || !ehPecaAdversaria(gameState.tabuleiro[i][j], peca)) {
                    return false;
                }
            }
            i += passoLinha;
            j += passoColuna;
        }

        return true;
    }

    return false;
}

// Verifica se uma peça é adversária
function ehPecaAdversaria(pecaAlvo, pecaAtual) {
    if (pecaAtual === 'preto' || pecaAtual === 'preto-dama') {
        return pecaAlvo === 'vermelho' || pecaAlvo === 'vermelho-dama';
    } else if (pecaAtual === 'vermelho' || pecaAtual === 'vermelho-dama') {
        return pecaAlvo === 'preto' || pecaAlvo === 'preto-dama';
    }
    return false;
}

// Move uma peça no tabuleiro
function moverPeca(linhaInicial, colunaInicial, linhaFinal, colunaFinal) {
    const peca = gameState.tabuleiro[linhaInicial][colunaInicial];

    if (movimentoValido(linhaInicial, colunaInicial, linhaFinal, colunaFinal, peca)) {
        // Verifica se é uma captura
        if (Math.abs(linhaFinal - linhaInicial) === 2 || Math.abs(linhaFinal - linhaInicial) > 2) {
            const passoLinha = (linhaFinal - linhaInicial) / Math.abs(linhaFinal - linhaInicial);
            const passoColuna = (colunaFinal - colunaInicial) / Math.abs(colunaFinal - colunaInicial);
            let i = linhaInicial + passoLinha;
            let j = colunaInicial + passoColuna;

            while (i !== linhaFinal && j !== colunaFinal) {
                if (gameState.tabuleiro[i][j] !== null) {
                    gameState.tabuleiro[i][j] = null; // Remove a peça capturada
                    if (gameState.turno === 'preto') {
                        gameState.pontosPretas++; // Atualiza o placar
                    } else {
                        gameState.pontosVermelhas++; // Atualiza o placar
                    }
                }
                i += passoLinha;
                j += passoColuna;
            }
        }

        // Move a peça
        gameState.tabuleiro[linhaFinal][colunaFinal] = peca;
        gameState.tabuleiro[linhaInicial][colunaInicial] = null;

        // Transforma em dama se alcançar o lado oposto
        if (peca === 'preto' && linhaFinal === LINHAS - 1) {
            gameState.tabuleiro[linhaFinal][colunaFinal] = 'preto-dama';
        } else if (peca === 'vermelho' && linhaFinal === 0) {
            gameState.tabuleiro[linhaFinal][colunaFinal] = 'vermelho-dama';
        }

        // Troca o turno
        gameState.turno = gameState.turno === 'preto' ? 'vermelho' : 'preto';

        return true;
    }
    return false;
}

// Inicializa o tabuleiro ao iniciar o servidor
inicializarTabuleiro();

wss.on('connection', (ws) => {
    const playerId = generatePlayerId();
    // Adiciona o jogador ao estado do jogo
    gameState.players[playerId] = {
        team: Object.keys(gameState.players).length % 2 === 0 ? 'preto' : 'vermelho' // Alterna entre times
    };
    console.log("Novo jogador conectado. ID:", playerId, JSON.stringify(gameState));


    // Envia o estado inicial do jogo para o jogador
    ws.send(JSON.stringify({
        type: 'game_start',
        initialState: gameState,
        playerId
    }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log("Mensagem recebida:", data);

        switch (data.type) {
            case 'move':
                const { linhaInicial, colunaInicial, linhaFinal, colunaFinal } = data;
                if (moverPeca(linhaInicial, colunaInicial, linhaFinal, colunaFinal)) {
                    broadcastGameState();
                }
                break;
            case 'my-username':
                // const { username, playerId } = data
                // gameState[playerId]["username"] = username
                // ws.send(JSON.stringify({
                //     type: 'game_start',
                //     initialState: gameState,
                //     playerId
                // }));
                break;
        }
    });

    ws.on('close', () => {
        console.log("Jogador desconectado. ID:", playerId);
        delete gameState.players[playerId];
        broadcastGameState();
    });
});

// Envia o estado do jogo para todos os clientes
function broadcastGameState() {
    const message = JSON.stringify({
        type: 'game_update',
        state: gameState
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Gera um ID único para o jogador
function generatePlayerId() {
    return Math.random().toString(36).substr(2, 9);
}