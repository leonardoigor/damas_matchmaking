const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let players = [];
let gameState = {
    players: {},
    objects: []
};
const Log = (...messages) => {
    const date = new Date().toLocaleString();
    console.log(`[${date}]`, ...messages);
};

wss.on('connection', (ws) => {
    const playerId = generatePlayerId();
    Log("new Player Connected id=", playerId);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        Log(JSON.stringify(data))
        handleGameMessage(ws, playerId, data);
    });

    ws.on('close', () => {
        handlePlayerDisconnect(playerId);
    });

    // Enviar estado inicial
    ws.send(JSON.stringify({
        type: 'game_start',
        initialState: gameState,
        playerId
    }));

    // Adicionar jogador ao estado
    gameState.players[playerId] = {
        x: 0,
        y: 0,
        health: 100
    };

    // Notificar outros jogadores
    broadcastGameState();
});

function handleGameMessage(ws, playerId, data) {
    switch (data.type) {
        case 'player_move':
            updatePlayerPosition(playerId, data.direction);
            break;

        case 'player_action':
            handlePlayerAction(playerId, data.action);
            break;
    }
}

function updatePlayerPosition(playerId, direction) {
    const player = gameState.players[playerId];
    // Lógica de movimento (exemplo)
    switch (direction) {
        case 'up': player.y -= 5; break;
        case 'down': player.y += 5; break;
        case 'left': player.x -= 5; break;
        case 'right': player.x += 5; break;
    }
    broadcastGameState();
}

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

function generatePlayerId() {
    return Math.random().toString(36).substr(2, 9);
}

function handlePlayerDisconnect(playerId) {
    delete gameState.players[playerId];
    broadcastGameState();
}