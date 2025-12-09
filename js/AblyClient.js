export default class AblyClient {
    constructor() {
        this.ably = null;
        this.lobbyChannel = null;
        this.gameChannel = null;
        this.clientId = null;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.currentGameId = null;
    }

    async connect() {
        return new Promise(async (resolve, reject) => {
            try {
                this.clientId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

                // Load Ably SDK if not already loaded
                if (!window.Ably) {
                    await this.loadAblySDK();
                }

                // Get token from auth endpoint
                const tokenResponse = await fetch(`/api/ably-auth?clientId=${this.clientId}`);
                if (!tokenResponse.ok) {
                    throw new Error('Failed to get Ably token');
                }
                const tokenRequest = await tokenResponse.json();

                // Initialize Ably client
                this.ably = new window.Ably.Realtime({
                    authCallback: async (tokenParams, callback) => {
                        try {
                            const response = await fetch(`/api/ably-auth?clientId=${this.clientId}`);
                            const token = await response.json();
                            callback(null, token);
                        } catch (error) {
                            callback(error, null);
                        }
                    }
                });

                this.ably.connection.on('connected', () => {
                    console.log('Ably connected');
                    this.isConnected = true;
                    this.subscribeToLobby();
                    this.handleMessage({ type: 'connected' });
                    resolve();
                });

                this.ably.connection.on('failed', (err) => {
                    console.error('Ably connection failed:', err);
                    reject(new Error('Ably connection failed'));
                });

                this.ably.connection.on('disconnected', () => {
                    console.log('Ably disconnected');
                    this.isConnected = false;
                });

            } catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }

    loadAblySDK() {
        return new Promise((resolve, reject) => {
            if (window.Ably) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.ably.com/lib/ably.min-1.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    subscribeToLobby() {
        this.lobbyChannel = this.ably.channels.get('lobby');

        this.lobbyChannel.subscribe('lobbyUpdate', (message) => {
            this.handleMessage({ type: 'lobbyUpdate', ...message.data });
        });

        this.lobbyChannel.subscribe('gameCreated', (message) => {
            // Notify lobby about new game
            this.refreshLobby();
        });
    }

    async subscribeToGame(gameId) {
        if (this.gameChannel) {
            await this.gameChannel.detach();
        }

        this.currentGameId = gameId;
        this.gameChannel = this.ably.channels.get(`game:${gameId}`);

        this.gameChannel.subscribe('gameStarted', (message) => {
            this.handleMessage({ type: 'gameStarted', ...message.data });
        });

        this.gameChannel.subscribe('stateUpdate', (message) => {
            this.handleMessage({ type: 'stateUpdate', ...message.data });
        });

        this.gameChannel.subscribe('shotResult', (message) => {
            this.handleMessage({ type: 'shotResult', ...message.data });
        });

        this.gameChannel.subscribe('playerJoined', (message) => {
            this.handleMessage({ type: 'playerJoined', ...message.data });
        });

        this.gameChannel.subscribe('playerLeft', (message) => {
            this.handleMessage({ type: 'playerLeft', ...message.data });
        });

        this.gameChannel.subscribe('timerUpdate', (message) => {
            this.handleMessage({ type: 'timerUpdate', ...message.data });
        });

        // Use presence for player tracking
        await this.gameChannel.presence.enter({ clientId: this.clientId });
    }

    async send(type, data = {}) {
        try {
            switch (type) {
                case 'setName':
                    // Store name locally, will be used in game requests
                    this.playerName = data.name;
                    // Check for active game by querying the API
                    this.handleMessage({ type: 'noActiveGame' });
                    break;

                case 'getLobby':
                    await this.refreshLobby();
                    break;

                case 'createGame':
                    await this.createGame(data.playerName);
                    break;

                case 'joinGame':
                    await this.joinGame(data.gameId, data.playerName);
                    break;

                case 'shoot':
                    await this.shoot(data.targetId);
                    break;

                case 'leaveGame':
                    await this.leaveGame();
                    break;

                case 'ping':
                    // Ably handles keepalive automatically
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Send error:', error);
            this.handleMessage({ type: 'error', message: error.message });
        }
    }

    async refreshLobby() {
        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getLobby' })
            });
            const data = await response.json();
            this.handleMessage(data);
        } catch (error) {
            console.error('Failed to get lobby:', error);
        }
    }

    async createGame(playerName) {
        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    playerId: this.clientId,
                    playerName: playerName
                })
            });
            const data = await response.json();

            if (data.type === 'gameCreated') {
                await this.subscribeToGame(data.gameId);
                // Notify lobby channel about new game
                this.lobbyChannel.publish('gameCreated', { gameId: data.gameId });
            }

            this.handleMessage(data);
        } catch (error) {
            console.error('Failed to create game:', error);
            this.handleMessage({ type: 'error', message: 'Failed to create game' });
        }
    }

    async joinGame(gameId, playerName) {
        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'join',
                    gameId: gameId,
                    playerId: this.clientId,
                    playerName: playerName
                })
            });
            const data = await response.json();

            if (data.type === 'joinedGame') {
                await this.subscribeToGame(gameId);

                // Notify other players in the game
                this.gameChannel.publish('gameStarted', {
                    state: data.state,
                    message: `${playerName} присоединился! Игра начинается!`
                });
            }

            this.handleMessage(data);
        } catch (error) {
            console.error('Failed to join game:', error);
            this.handleMessage({ type: 'error', message: 'Failed to join game' });
        }
    }

    async shoot(targetId) {
        if (!this.currentGameId) {
            console.error('No active game');
            return;
        }

        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'shoot',
                    gameId: this.currentGameId,
                    playerId: this.clientId,
                    targetId: targetId
                })
            });
            const data = await response.json();

            if (data.type === 'shotResult') {
                // Broadcast result to all players in the game
                this.gameChannel.publish('shotResult', data);
            }

            this.handleMessage(data);
        } catch (error) {
            console.error('Failed to shoot:', error);
            this.handleMessage({ type: 'error', message: 'Failed to shoot' });
        }
    }

    async leaveGame() {
        if (!this.currentGameId) {
            return;
        }

        try {
            const response = await fetch('/api/game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'leave',
                    gameId: this.currentGameId,
                    playerId: this.clientId
                })
            });
            const data = await response.json();

            if (this.gameChannel) {
                await this.gameChannel.presence.leave();
                this.gameChannel.publish('playerLeft', { playerId: this.clientId });
                await this.gameChannel.detach();
                this.gameChannel = null;
            }

            this.currentGameId = null;
            this.handleMessage(data);
        } catch (error) {
            console.error('Failed to leave game:', error);
        }
    }

    on(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('No handler for message type:', data.type);
        }
    }

    disconnect() {
        if (this.gameChannel) {
            this.gameChannel.detach();
        }
        if (this.lobbyChannel) {
            this.lobbyChannel.detach();
        }
        if (this.ably) {
            this.ably.close();
        }
        this.isConnected = false;
    }
}
