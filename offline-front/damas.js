const canvas = document.getElementById('damasCanvas');
const ctx = canvas.getContext('2d');

const TAMANHO_CASA = 50;
const LINHAS = 8;
const COLUNAS = 8;

let tabuleiro = [];
let turno = 'preto'; // Começa com as peças pretas
let pecaSelecionada = null; // Armazena a peça selecionada
let pontosPretas = 0; // Placar das peças pretas
let pontosVermelhas = 0; // Placar das peças vermelhas

// Elementos da interface
const labelVez = document.getElementById('vez');
const labelPontosPretas = document.getElementById('pontosPretas');
const labelPontosVermelhas = document.getElementById('pontosVermelhas');

// Atualiza a interface (vez e placar)
function atualizarInterface() {
    labelVez.textContent = `Vez: ${turno === 'preto' ? 'Pretas' : 'Vermelhas'}`;
    labelPontosPretas.textContent = pontosPretas;
    labelPontosVermelhas.textContent = pontosVermelhas;
}

// Inicializa o tabuleiro
function inicializarTabuleiro() {
    for (let i = 0; i < LINHAS; i++) {
        tabuleiro[i] = [];
        for (let j = 0; j < COLUNAS; j++) {
            if ((i + j) % 2 === 0) {
                tabuleiro[i][j] = null; // Casas brancas
            } else {
                if (i < 3) {
                    tabuleiro[i][j] = 'preto'; // Peças pretas
                } else if (i > 4) {
                    tabuleiro[i][j] = 'vermelho'; // Peças vermelhas
                } else {
                    tabuleiro[i][j] = null; // Casas vazias no meio
                }
            }
        }
    }
}

// Desenha o tabuleiro
function desenharTabuleiro() {
    for (let i = 0; i < LINHAS; i++) {
        for (let j = 0; j < COLUNAS; j++) {
            // Desenha as casas
            ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#000';
            ctx.fillRect(j * TAMANHO_CASA, i * TAMANHO_CASA, TAMANHO_CASA, TAMANHO_CASA);

            // Desenha as peças
            if (tabuleiro[i][j] === 'preto' || tabuleiro[i][j] === 'preto-dama') {
                ctx.fillStyle = tabuleiro[i][j] === 'preto' ? '#0000ff' : '#0000aa'; // Azul para peças pretas
                ctx.beginPath();
                ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 2.5, 0, Math.PI * 2);
                ctx.fill();
                if (tabuleiro[i][j] === 'preto-dama') {
                    // Desenha um círculo menor para indicar a dama
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (tabuleiro[i][j] === 'vermelho' || tabuleiro[i][j] === 'vermelho-dama') {
                ctx.fillStyle = tabuleiro[i][j] === 'vermelho' ? '#ff0000' : '#aa0000'; // Vermelho para peças vermelhas
                ctx.beginPath();
                ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 2.5, 0, Math.PI * 2);
                ctx.fill();
                if (tabuleiro[i][j] === 'vermelho-dama') {
                    // Desenha um círculo menor para indicar a dama
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(j * TAMANHO_CASA + TAMANHO_CASA / 2, i * TAMANHO_CASA + TAMANHO_CASA / 2, TAMANHO_CASA / 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

// Verifica se um movimento é válido
function movimentoValido(linhaInicial, colunaInicial, linhaFinal, colunaFinal) {
    const peca = tabuleiro[linhaInicial][colunaInicial];
    const pecaAlvo = tabuleiro[linhaFinal][colunaFinal];

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
            if (ehPecaAdversaria(tabuleiro[linhaMeio][colunaMeio], peca)) {
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
            if (tabuleiro[i][j] !== null) {
                pecasNoCaminho++;
                if (pecasNoCaminho > 1 || !ehPecaAdversaria(tabuleiro[i][j], peca)) {
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
    if (movimentoValido(linhaInicial, colunaInicial, linhaFinal, colunaFinal)) {
        const peca = tabuleiro[linhaInicial][colunaInicial];

        // Verifica se é uma captura
        if (Math.abs(linhaFinal - linhaInicial) === 2 || Math.abs(linhaFinal - linhaInicial) > 2) {
            const passoLinha = (linhaFinal - linhaInicial) / Math.abs(linhaFinal - linhaInicial);
            const passoColuna = (colunaFinal - colunaInicial) / Math.abs(colunaFinal - colunaInicial);
            let i = linhaInicial + passoLinha;
            let j = colunaInicial + passoColuna;

            while (i !== linhaFinal && j !== colunaFinal) {
                if (tabuleiro[i][j] !== null) {
                    tabuleiro[i][j] = null; // Remove a peça capturada
                    if (turno === 'preto') {
                        pontosPretas++; // Atualiza o placar
                    } else {
                        pontosVermelhas++; // Atualiza o placar
                    }
                }
                i += passoLinha;
                j += passoColuna;
            }
        }

        // Move a peça
        tabuleiro[linhaFinal][colunaFinal] = peca;
        tabuleiro[linhaInicial][colunaInicial] = null;

        // Transforma em dama se alcançar o lado oposto
        if (peca === 'preto' && linhaFinal === LINHAS - 1) {
            tabuleiro[linhaFinal][colunaFinal] = 'preto-dama';
        } else if (peca === 'vermelho' && linhaFinal === 0) {
            tabuleiro[linhaFinal][colunaFinal] = 'vermelho-dama';
        }

        return true;
    }
    return false;
}

// Função para trocar o turno
function trocarTurno() {
    turno = turno === 'preto' ? 'vermelho' : 'preto';
    atualizarInterface(); // Atualiza a interface após trocar o turno
}

// Evento de clique no canvas
canvas.addEventListener('click', (event) => {
    const x = event.offsetX;
    const y = event.offsetY;

    const coluna = Math.floor(x / TAMANHO_CASA);
    const linha = Math.floor(y / TAMANHO_CASA);

    if (pecaSelecionada === null) {
        // Seleciona uma peça
        if (tabuleiro[linha][coluna] === turno || tabuleiro[linha][coluna] === `${turno}-dama`) {
            pecaSelecionada = { linha, coluna };
        }
    } else {
        // Tenta mover a peça selecionada
        if (moverPeca(pecaSelecionada.linha, pecaSelecionada.coluna, linha, coluna)) {
            trocarTurno(); // Troca o turno após um movimento válido
        }
        pecaSelecionada = null; // Desseleciona a peça
    }

    desenharTabuleiro(); // Redesenha o tabuleiro após cada movimento
});

// Função principal
function main() {
    inicializarTabuleiro();
    desenharTabuleiro();
    atualizarInterface(); // Inicializa a interface
}

main();