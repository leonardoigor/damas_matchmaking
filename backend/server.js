const WebSocket = require('ws');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require("path")

const wss = new WebSocket.Server({ port: 3000 });
const matchQueue = [];
const activeMatches = [];
const activeConnections = new Map();

// Configuração Kubernetes
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

wss.on('connection', (ws) => {
    console.log('Nova conexão com o backend');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        handleClientMessage(ws, data);
    });

    ws.on('close', () => {
        handleDisconnection(ws);
    });
});

function handleClientMessage(ws, data) {
    console.log(`${JSON.stringify(data)}`);

    switch (data.type) {
        case 'login':
            handleLogin(ws, data.username);
            break;

        case 'join_queue':
            handleJoinQueue(ws);
            break;

        case 'end_game':
            handleEndGame(ws, data.podUrl, data.matchId);
            break;
        case 'cancel_queue':
            console.log("cancel_queue", data);
            activeConnections.delete(ws)
            const index = matchQueue.indexOf(ws);
            if (index !== -1) {
                matchQueue.splice(index, 1);
            }
            break;
    }
}

function handleLogin(ws, username) {
    // Mock de autenticação
    activeConnections.set(ws, { username, inQueue: false });
    const data = JSON.stringify({
        type: 'login_success',
        username
    });
    console.log(data);

    ws.send(data);
}

function handleJoinQueue(ws) {
    const user = activeConnections.get(ws);
    if (user) {
        user.inQueue = true;
        matchQueue.push(ws);
        console.log(`${JSON.stringify(user)}`);

        if (matchQueue.length >= 2) {
            const players = matchQueue.splice(0, 2);
            startNewGame(players);
        }
    }
}

async function startNewGame(players) {
    try {
        // Notificar jogadores
        players.forEach(player => {
            if (player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({
                    type: 'match_creating'
                }));
                activeConnections.delete(player);
            }
        });
        const yamlPath = path.join(__dirname, 'kubernetes', 'game-pod.yaml');
        const normalizedPath = path.normalize(yamlPath);
        let fileContents = fs.readFileSync(yamlPath, 'utf8');
        let podName = `damas-pod-${Date.now()}`;
        fileContents = fileContents.replace(/{{ .PodName }}/g, podName);

        const podManifest = {
            metadata: { name: podName, labels: { app: podName } },
            spec: {
                containers: [{
                    name: 'damas-pod',
                    image: 'igormendonca/damas-pod',
                    ports: [{ containerPort: 8080 }]
                }]
            }
        };
        // const podManifest = yaml.load(fileContents);
        // Criar Pod do jogo


        const { body: pod } = await k8sApi.createNamespacedPod('default', podManifest);
        console.log('Pod criado:', pod.metadata.name);

        // Esperar o Pod ficar pronto
        const podIP = await waitForPodReady(podName);
        console.log('Pod pronto:', podIP);

        // Criar Service para o Pod
        const service = await createGameService(podName);
        const nodePort = service.spec.ports[0].nodePort;
        const nodeIP = await getNodeIP(); // IP do nó (Minikube, Kind, etc.)
        const podUrl = `${nodeIP}:${nodePort}`;

        console.log('Service criado:', podUrl);

        // Registrar a partida ativa
        const matchId = activeMatches.push({
            players,
            podName,
            serviceName: `game-service-${podName}`
        });

        // Notificar jogadores
        players.forEach(player => {
            if (player.readyState === WebSocket.OPEN) {
                player.send(JSON.stringify({
                    type: 'match_found',
                    podUrl: podUrl,
                    matchId
                }));
                activeConnections.delete(player);
            }
        });
    } catch (error) {
        console.error('Erro ao criar partida:', error);
    }
}

async function createGameService(podName) {
    const serviceName = `game-service-${podName}`;
    const serviceManifest = {
        metadata: { name: serviceName },
        spec: {
            selector: { app: podName }, // Usa o nome do Pod como selector
            ports: [{ protocol: 'TCP', port: 8080, targetPort: 8080 }],
            type: 'NodePort' // Expõe o Service em uma porta do nó
        }
    };

    const { body: service } = await k8sApi.createNamespacedService('default', serviceManifest);
    return service;
}

async function waitForPodReady(podName) {
    return new Promise((resolve, reject) => {
        const watch = new k8s.Watch(kc);
        const timeout = setTimeout(() => {
            watch.abort();
            reject(new Error(`Timeout: O pod ${podName} não ficou pronto a tempo`));
        }, 60000); // 60 segundos

        watch.watch(
            `/api/v1/namespaces/default/pods`,
            {},
            (type, obj) => {
                console.log(`Pod name ${obj.metadata.name}, status ${obj.status.phase}`);

                if (obj.metadata.name.includes(podName) && obj.status.phase === 'Running') {
                    clearTimeout(timeout); // Cancela o timeout
                    // watch.abort(); // Fecha o watcher
                    console.log('Echou pod ', obj.status.podIP || 'Sem IP definido', obj.metadata.name, podName);

                    resolve(obj.status.podIP || 'Sem IP definido');
                }
            },
            (err) => {
                clearTimeout(timeout);
                reject(err);
            }
        );
    });
}


async function getNodeIP() {
    // Se estiver usando Minikube
    if (process.env.MINIKUBE_IP) {
        return process.env.MINIKUBE_IP;
    }

    // Se estiver usando Docker Desktop Kubernetes
    return 'localhost';
}

function handleDisconnection(ws) {
    const user = activeConnections.get(ws);
    if (user) {
        if (user.inQueue) {
            const index = matchQueue.indexOf(ws);
            if (index > -1) matchQueue.splice(index, 1);
        }
        activeConnections.delete(ws);
    }
}

async function handleEndGame(ws, podUrl, matchId) {
    try {
        const success = await deleteGameResources(podUrl);

        if (success) {
            const match = activeMatches[matchId - 1];
            if (!match) {
                console.error("handleEndGame: partida não encontrada. ID:", matchId);
                return;
            }

            // Notificar jogadores
            match.players.forEach(player => {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify({
                        type: 'end_game_success',
                        message: 'Partida finalizada com sucesso.'
                    }));
                }
            });

            // Remover a partida da lista de partidas ativas
            activeMatches.splice(matchId - 1, 1);
        } else {
            ws.send(JSON.stringify({
                type: 'end_game_error',
                message: 'Erro ao finalizar partida.'
            }));
        }
    } catch (error) {
        console.error('Erro ao finalizar partida:', error);
        ws.send(JSON.stringify({
            type: 'end_game_error',
            message: 'Erro ao finalizar partida.'
        }));
    }
}

async function deleteGameResources(podUrl) {
    try {
        // Extrair a porta do NodePort do podUrl
        const nodePort = podUrl.split(':')[1];

        // Obter todos os Services
        const services = await k8sApi.listNamespacedService('default');
        const service = services.body.items.find(svc => {
            return svc.spec.ports[0].nodePort === parseInt(nodePort);
        });

        if (!service) {
            console.error('Service não encontrado para o NodePort:', nodePort);
            return false;
        }

        const serviceName = service.metadata.name;
        const podName = serviceName.replace('game-service-', '');

        // Deletar o Pod
        await k8sApi.deleteNamespacedPod(podName, 'default');
        console.log(`Pod ${podName} deletado.`);

        // Deletar o Service
        await k8sApi.deleteNamespacedService(serviceName, 'default');
        console.log(`Service ${serviceName} deletado.`);

        return true;
    } catch (error) {
        console.error('Erro ao deletar recursos:', error);
        return false;
    }
}