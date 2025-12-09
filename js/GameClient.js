import AblyClient from './AblyClient.js';
import { ScreenManager } from './screens/ScreenManager.js';
import { NameScreen } from './screens/NameScreen.js';
import { LobbyScreen } from './screens/LobbyScreen.js';
import { WaitingScreen } from './screens/WaitingScreen.js';
import { GameScreen } from './screens/GameScreen.js';

export default class GameClient {
    constructor() {
        this.playerId = null;
        this.playerName = 'Игрок';
        this.gameId = null;

        this.wsClient = new AblyClient();
        this.screenManager = new ScreenManager();
        
        this.init();
    }

    init() {
        this.nameScreen = new NameScreen(this);
        this.lobbyScreen = new LobbyScreen(this);
        this.waitingScreen = new WaitingScreen(this);
        this.gameScreen = new GameScreen(this);
        
        this.screenManager.registerScreen('nameScreen', this.nameScreen);
        this.screenManager.registerScreen('lobbyScreen', this.lobbyScreen);
        this.screenManager.registerScreen('waitingScreen', this.waitingScreen);
        this.screenManager.registerScreen('gameScreen', this.gameScreen);
        
        this.setupMessageHandlers();
        
        this.screenManager.showScreen('nameScreen');
    }

    setupMessageHandlers() {
        this.wsClient.on('connected', () => {
            console.log('Server connected');
        });

        this.wsClient.on('gameCreated', (data) => {
            this.handleGameCreated(data);
        });

        this.wsClient.on('joinedGame', (data) => {
            this.handleJoinedGame(data);
        });

        this.wsClient.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });

        this.wsClient.on('stateUpdate', (data) => {
            this.handleStateUpdate(data);
        });

        this.wsClient.on('shotResult', (data) => {
            this.handleShotResult(data);
        });

        this.wsClient.on('lobbyUpdate', (data) => {
            this.handleLobbyUpdate(data);
        });

        this.wsClient.on('hasActiveGame', (data) => {
            this.handleHasActiveGame(data);
        });

        this.wsClient.on('noActiveGame', () => {
            this.screenManager.showScreen('lobbyScreen');
        });

        this.wsClient.on('leftGame', () => {
            this.gameId = null;
            this.playerId = null;
            this.screenManager.showScreen('lobbyScreen');
        });

        this.wsClient.on('timerUpdate', (data) => {
            this.handleTimerUpdate(data);
        });

        this.wsClient.on('turnTimeout', (data) => {
            this.handleTurnTimeout(data);
        });

        this.wsClient.on('error', (data) => {
            console.error('Server error:', data.message);
        });
    }

    setPlayerName(name) {
        this.playerName = name;
        this.connect();
    }

    async connect() {
        try {
            await this.wsClient.connect();
            this.playerId = this.wsClient.clientId;

            this.wsClient.send('setName', { name: this.playerName });

        } catch (error) {
            console.error('Connection error:', error);
            this.nameScreen.showError('nameError', 'Ошибка подключения к серверу');
        }
    }

    refreshLobby() {
        this.wsClient.send('getLobby');
    }

    createGame() {
        this.wsClient.send('createGame', { playerName: this.playerName });
    }

    joinGame(gameId) {
        this.wsClient.send('joinGame', { 
            gameId: gameId, 
            playerName: this.playerName 
        });
    }

    shoot(targetId) {
        this.wsClient.send('shoot', { targetId: targetId });
    }

    leaveGame() {
        this.wsClient.send('leaveGame');
    }

    handleGameCreated(data) {
        this.gameId = data.gameId;
        this.playerId = this.wsClient.clientId;
        this.playerName = data.playerName || this.playerName;

        this.waitingScreen.updateGameInfo(this.gameId, this.playerName);
        if (data.state) {
            this.waitingScreen.updatePlayersList(data.state.players);
        }

        this.screenManager.showScreen('waitingScreen');
    }

    handleJoinedGame(data) {
        this.gameId = data.gameId;
        this.playerId = this.wsClient.clientId;
        this.playerName = data.playerName || this.playerName;

        this.gameScreen.updateGameInfo(this.playerName, this.gameId);
        if (data.state) {
            this.gameScreen.updateGameState(data.state);
        }

        this.screenManager.showScreen('gameScreen');
    }

    handleGameStarted(data) {
        if (data.state) {
            this.gameScreen.updateGameState(data.state);
        }
        
        if (this.screenManager.currentScreen === this.waitingScreen) {
            this.screenManager.showScreen('gameScreen');
        }
        
        if (data.message) {
            this.gameScreen.showMessage(data.message, 'info');
        }
    }

    handleStateUpdate(data) {
        if (data.state) {
            this.gameScreen.updateGameState(data.state);
        }
    }

    handleShotResult(data) {
        if (data.result && data.state) {
            this.gameScreen.showShotResult(data.result);
            this.gameScreen.updateGameState(data.state);
        }
    }

    handleLobbyUpdate(data) {
        this.lobbyScreen.updateLobby(data.games, data.onlinePlayers || []);
    }

    handleTimerUpdate(data) {
        if (this.screenManager.currentScreen === this.gameScreen) {
            this.gameScreen.updateTimer(data.remainingTime);
        }
    }

    handleTurnTimeout(data) {
        if (this.screenManager.currentScreen === this.gameScreen) {
            this.gameScreen.showTimeoutMessage(data.message);
            if (data.state) {
                this.gameScreen.updateGameState(data.state);
            }
        }
    }

    handleHasActiveGame(data) {
        this.gameId = data.gameId;
        this.playerId = this.wsClient.clientId;

        if (data.gameStarted) {
            this.joinGame(data.gameId);
        } else {
            this.screenManager.showScreen('waitingScreen');
            setTimeout(() => {
                this.joinGame(data.gameId);
            }, 500);
        }
    }

    isMyGame(game) {
        return game.players.includes(this.playerName) || game.creatorName === this.playerName;
    }
}