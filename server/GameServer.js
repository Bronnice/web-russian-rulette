const WebSocket = require('ws');
const GameManager = require('./GameManager');
const PlayerManager = require('./PlayerManager');

class GameServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.gameManager = new GameManager();
        this.playerManager = new PlayerManager();
        
        this.setupWebSocket();
        this.setupCleanupInterval();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection established');
            
            let playerName = null;
            let gameId = null;
            let playerId = null;
            ws.isInLobby = false;

            ws.on('message', (message) => this.handleMessage(ws, message));
            ws.on('close', () => this.handleDisconnect(ws));
            ws.on('error', (error) => this.handleError(ws, error));

            this.sendWelcomeMessage(ws);
        });
    }

    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);
            
            switch (data.type) {
                case 'setName':
                    this.handleSetName(ws, data);
                    break;
                case 'getLobby':
                    this.handleGetLobby(ws);
                    break;
                case 'createGame':
                    this.handleCreateGame(ws, data);
                    break;
                case 'joinGame':
                    this.handleJoinGame(ws, data);
                    break;
                case 'shoot':
                    this.handleShoot(ws, data);
                    break;
                case 'leaveGame':
                    this.handleLeaveGame(ws);
                    break;
                case 'ping':
                    this.handlePing(ws);
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
            this.sendError(ws, 'Ошибка сервера: ' + error.message);
        }
    }

    handleSetName(ws, data) {
        const playerName = data.name || `Игрок_${Math.random().toString(36).substr(2, 5)}`;
        ws.playerName = playerName;
        
        const playerGame = this.gameManager.findGameByPlayer(playerName);
        if (playerGame) {
            ws.send(JSON.stringify({
                type: 'hasActiveGame',
                gameId: playerGame.game.id,
                gameStarted: playerGame.game.gameStarted,
                playerId: playerGame.playerId
            }));
        } else {
            ws.send(JSON.stringify({ type: 'noActiveGame' }));
        }
    }

    handleGetLobby(ws) {
        ws.isInLobby = true;
        const lobbyList = this.gameManager.getActiveGames().map(game => game.getLobbyInfo());
        ws.send(JSON.stringify({
            type: 'lobbyUpdate',
            games: lobbyList
        }));
    }

    handleCreateGame(ws, data) {
        const playerName = data.playerName || ws.playerName;
        
        if (this.playerManager.isPlayerInGame(playerName, this.gameManager)) {
            this.sendError(ws, 'Вы уже находитесь в игре');
            return;
        }
        
        const game = this.gameManager.createGame(playerName);
        const playerId = `player_${Math.random().toString(36).substr(2, 9)}`;
        
        if (game.addPlayer(playerId, playerName, ws)) {
            ws.isInLobby = false;
            this.playerManager.createSession(playerName, game.id, playerId, ws);
            
            ws.send(JSON.stringify({
                type: 'gameCreated',
                gameId: game.id,
                playerId: playerId,
                playerName: playerName,
                state: game.getState()
            }));
            
            this.gameManager.broadcastLobbyUpdate(this.wss);
        }
    }

    handleJoinGame(ws, data) {
        const playerName = data.playerName || ws.playerName;
        const game = this.gameManager.getGame(data.gameId);
        
        if (!game) {
            this.sendError(ws, 'Игра не найдена');
            return;
        }
        
        if (this.playerManager.isPlayerInGame(playerName, this.gameManager)) {
            this.sendError(ws, 'Вы уже находитесь в игре');
            return;
        }
        
        const playerId = `player_${Math.random().toString(36).substr(2, 9)}`;
        
        if (game.addPlayer(playerId, playerName, ws)) {
            ws.isInLobby = false;
            this.playerManager.createSession(playerName, game.id, playerId, ws);
            
            if (game.gameStarted) {
                const firstPlayer = game.getCurrentPlayer();
                game.broadcastToPlayers({
                    type: 'gameStarted',
                    state: game.getState(),
                    message: `🎲 Случайно выбран первый игрок: ${firstPlayer.name}`
                });
            }
            
            game.broadcastToPlayers({
                type: 'stateUpdate',
                state: game.getState()
            });
            
            ws.send(JSON.stringify({
                type: 'joinedGame',
                playerId: playerId,
                playerName: playerName,
                gameId: game.id,
                state: game.getState()
            }));
            
            this.gameManager.broadcastLobbyUpdate(this.wss);
        } else {
            this.sendError(ws, 'Нельзя присоединиться - игра заполнена или завершена');
        }
    }

    handleShoot(ws, data) {
        const session = this.playerManager.getSession(ws.playerName);
        if (!session) return;
        
        const game = this.gameManager.getGame(session.gameId);
        if (!game || game.gameOver) return;
        
        const isSelfShot = data.targetId === session.playerId;
        const result = game.shoot(data.targetId, isSelfShot);
        
        game.broadcastToPlayers({
            type: 'shotResult',
            result: result,
            state: game.getState()
        });
        
        if (result.gameOver) {
            setTimeout(() => {
                this.gameManager.removeGame(session.gameId);
                this.gameManager.broadcastLobbyUpdate(this.wss);
            }, 30000);
        }
    }

    handleLeaveGame(ws) {
        const playerName = ws.playerName;
        const session = this.playerManager.getSession(playerName);
        
        if (session) {
            const game = this.gameManager.getGame(session.gameId);
            if (game) {
                game.removePlayer(playerName);
                game.broadcastToPlayers({
                    type: 'stateUpdate',
                    state: game.getState()
                });
            }
            
            this.playerManager.removeSession(playerName);
            this.gameManager.cleanupEmptyGames();
            this.gameManager.broadcastLobbyUpdate(this.wss);
        }
        
        ws.send(JSON.stringify({
            type: 'leftGame',
            message: 'Вы покинули игру'
        }));
    }

    handlePing(ws) {
        ws.send(JSON.stringify({ type: 'pong' }));
    }

    handleDisconnect(ws) {
        console.log('WebSocket connection closed');
        
        const playerName = ws.playerName;
        if (playerName) {
            const session = this.playerManager.getSession(playerName);
            if (session) {
                const game = this.gameManager.getGame(session.gameId);
                if (game) {
                    game.removePlayer(playerName);
                    game.broadcastToPlayers({
                        type: 'stateUpdate',
                        state: game.getState()
                    });
                }
                
                this.playerManager.removeSession(playerName);
                this.gameManager.cleanupEmptyGames();
                this.gameManager.broadcastLobbyUpdate(this.wss);
            }
        }
    }

    handleError(ws, error) {
        console.error('WebSocket error:', error);
    }

    sendWelcomeMessage(ws) {
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Подключено к серверу Русской Рулетки'
        }));
    }

    sendError(ws, message) {
        ws.send(JSON.stringify({
            type: 'error',
            message: message
        }));
    }

    setupCleanupInterval() {
        setInterval(() => {
            this.playerManager.cleanupInactiveSessions();
            this.gameManager.cleanupEmptyGames();
        }, 60000); // Каждую минуту
    }
}

module.exports = GameServer;