export class WaitingScreen {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.element = document.getElementById('waitingScreen');
        this.init();
    }

    init() {
        document.getElementById('copyGameIdBtn').addEventListener('click', () => this.copyGameId());
        document.getElementById('backToLobbyBtn').addEventListener('click', () => this.leaveGame());
    }

    copyGameId() {
        const gameId = document.getElementById('gameIdDisplay').textContent;
        if (!gameId) return;
        
        navigator.clipboard.writeText(gameId).then(() => {
            const btn = document.getElementById('copyGameIdBtn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Скопировано!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    }

    leaveGame() {
        this.gameClient.leaveGame();
    }

    updateGameInfo(gameId, playerName) {
        document.getElementById('gameIdDisplay').textContent = gameId;
        document.getElementById('myPlayerNameDisplay').textContent = playerName;
    }

    updatePlayersList(players) {
        const container = document.getElementById('playersContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (players && players.length > 0) {
            players.forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = `player ${!player.alive ? 'dead' : ''}`;
                playerDiv.textContent = player.name + (!player.alive ? ' (мертв)' : '');
                container.appendChild(playerDiv);
            });
        }
    }

    show() {
        this.element.classList.add('active');
    }

    hide() {
        this.element.classList.remove('active');
    }
}