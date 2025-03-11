let backendSocket; // Conexão com o backend
let gameSocket;    // Conexão com o Pod do jogo
let gamePodUrl;    // Endereço do Pod da partida atual
let matchId
// Conectar ao backend WebSocket quando a página carregar
window.onload = function () {
    connectToBackend();
};

function connectToBackend() {
    backendSocket = new WebSocket('ws://localhost:3000');
    // backendSocket = new WebSocket('ws://backend-service:3000');

    backendSocket.onopen = () => {
        console.log('Conectado ao backend');
    };

    backendSocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleBackendMessage(message);
    };

    backendSocket.onclose = () => {
        console.log('Conexão com o backend fechada, tentando reconectar...');
        setTimeout(connectToBackend, 3000);
    };
}

function handleBackendMessage(message) {
    console.log(message);

    switch (message.type) {
        case 'login_success':
            document.getElementById('login').style.display = 'none';
            document.getElementById('lobby').style.display = 'block';
            break;

        case 'match_found':
            connectToGamePod(message.podUrl);
            matchId = message.matchId
            break;

        case 'game_state':
            updateGameState(message.state);
            break;

        case 'error':
            console.error('Erro:', message.content);
            break;
        case 'end_game_success':
            document.getElementById('login').style.display = 'block';
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('game').style.display = 'none';
            console.log('end_game_success:', message);
            break;
    }
}

function login() {
    username = document.getElementById('username').value;
    sendToBackend({
        type: 'login',
        username: username
    });
}

function findMatch() {
    sendToBackend({
        type: 'join_queue'
    });
}

function sendToBackend(data) {
    if (backendSocket.readyState === WebSocket.OPEN) {
        backendSocket.send(JSON.stringify(data));
    }
}

function connectToGamePod(podUrl) {
    gamePodUrl = podUrl; // Salva o endereço do Pod
    gameSocket = new WebSocket(`ws://${podUrl}`);

    gameSocket.onopen = () => {
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        sendToGamePod({ type: 'player_ready' });
    };

    gameSocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleGameMessage(message);
    };

    gameSocket.onclose = () => {
        console.log('Conexão com o jogo fechada');
    };
}

// Função para finalizar o jogo
function endGame() {
    if (gamePodUrl) {
        sendToBackend({
            type: 'end_game',
            podUrl: gamePodUrl,
            matchId
        });
    }
}

function handleGameMessage(message) {
    switch (message.type) {
        case 'game_start':
            initGame(message.initialState);
            break;

        case 'game_update':
            updateGameState(message.state);
            break;

        case 'player_move':
            handlePlayerMove(message.playerId, message.position);
            break;
    }
}


const canvasGame = document.getElementById("gameCanvas")
const ctx = canvasGame.getContext("2d");


function sendToGamePod(data) {
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        gameSocket.send(JSON.stringify(data));
    }
}

// Exemplo: Enviar movimento do jogador
function sendPlayerMovement(direction) {
    sendToGamePod({
        type: 'player_move',
        direction: direction
    });
}

// Funções do jogo (exemplo)
function initGame(initialState) {
    // Inicializar canvas e estado do jogo
    console.log("initGame", initialState);

}

function updateGameState(state) {
    // Atualizar renderização do jogo
    console.log("updateGameState", state);
    drawPlayers(state)
}

function handlePlayerMove(playerId, position) {
    // Atualizar posição do jogador no cliente
    console.log("handlePlayerMove", playerId, position);
}

function drawPlayers(gameState) {
    ctx.clearRect(0, 0, canvasGame.width, canvasGame.height);

    for (const playerId in gameState.players) {
        const player = gameState.players[playerId];
        ctx.fillStyle = "blue";
        ctx.fillRect(player.x + canvasGame.width / 2, player.y + canvasGame.height / 2, 20, 20);
    }
}


document.addEventListener("keydown", (event) => {
    if (gameSocket && gameSocket.readyState === 1)
        switch (event.key) {
            case "ArrowUp": sendPlayerMovement("up"); break;
            case "ArrowDown": sendPlayerMovement("down"); break;
            case "ArrowLeft": sendPlayerMovement("left"); break;
            case "ArrowRight": sendPlayerMovement("right"); break;
        }
});