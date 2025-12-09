export class LobbyScreen {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.element = document.getElementById('lobbyScreen');
        this.init();
    }

    init() {
        document.getElementById('refreshLobbyBtn').addEventListener('click', () => this.refreshLobby());
        document.getElementById('createLobbyGameBtn').addEventListener('click', () => this.createGame());
        document.getElementById('directJoinBtn').addEventListener('click', () => this.joinDirectGame());
    }

    refreshLobby() {
        this.gameClient.refreshLobby();
        const container = document.getElementById('lobbyGamesContainer');
        if (container) {
            container.innerHTML = '<p>Загрузка списка игр...</p>';
        }
    }

    createGame() {
        this.gameClient.createGame();
        
        const createBtn = document.getElementById('createLobbyGameBtn');
        const originalText = createBtn.textContent;
        createBtn.textContent = 'Создание игры...';
        createBtn.disabled = true;
        
        setTimeout(() => {
            createBtn.textContent = originalText;
            createBtn.disabled = false;
        }, 3000);
    }

    joinDirectGame() {
        const gameId = document.getElementById('directGameIdInput').value.trim();
        if (gameId) {
            this.gameClient.joinGame(gameId);
        } else {
            this.showError('lobbyError', 'Пожалуйста, введите ID игры');
        }
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    updateLobby(games) {
        const container = document.getElementById('lobbyGamesContainer');
        const noGamesMsg = document.getElementById('noGamesMessage');
        
        if (!container) return;
        
        if (!games || games.length === 0) {
            container.innerHTML = '';
            if (noGamesMsg) {
                noGamesMsg.style.display = 'block';
                noGamesMsg.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <h3>🎮 Лобби пусто</h3>
                        <p>На данный момент нет играющих или ожидающих начала игроков</p>
                        <p style="margin-top: 20px;">Создайте свою игру и станьте первым!</p>
                        <div style="margin-top: 30px; font-size: 48px;">🎯</div>
                    </div>
                `;
            }
            return;
        }
        
        if (noGamesMsg) {
            noGamesMsg.style.display = 'none';
        }
        
        container.innerHTML = '';
        
        games.forEach(game => {
            const gameElement = this.createGameElement(game);
            container.appendChild(gameElement);
        });
    }

    createGameElement(game) {
        const status = this.getGameStatus(game);
        const isMyGame = this.gameClient.isMyGame(game);
        const canJoin = !game.gameStarted && game.playerCount < game.maxPlayers && !isMyGame;
        
        const gameElement = document.createElement('div');
        gameElement.className = `lobby-game ${status.class}`;
        gameElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0;">Игра от: ${game.creatorName}</h4>
                <span class="game-status ${status.label}">${status.text}</span>
            </div>
            <div class="players-list">
                <strong>Игроки (${game.playerCount}/${game.maxPlayers}):</strong><br>
                ${game.players.map(player => 
                    `<span class="player-badge">${player}</span>`
                ).join('')}
            </div>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">
                ID: ${game.gameId}
            </p>
            ${canJoin ? 
                `<button data-game-id="${game.gameId}" class="join-game-btn" 
                        style="width: 100%; margin-top: 10px;">
                    🎮 Присоединиться
                </button>` : 
                isMyGame ?
                '<p style="color: #28a745; font-style: italic; margin-top: 10px; font-weight: bold;">✅ Это ваша игра</p>' :
                '<p style="color: #999; font-style: italic; margin-top: 10px;">Игра уже началась или заполнена</p>'
            }
        `;
        
        // Добавляем обработчик события для кнопки присоединения
        const joinBtn = gameElement.querySelector('.join-game-btn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                this.gameClient.joinGame(game.gameId);
            });
        }
        
        return gameElement;
    }

    getGameStatus(game) {
        if (game.gameStarted) {
            return { class: 'playing', text: 'В игре', label: 'status-playing' };
        } else if (game.playerCount >= game.maxPlayers) {
            return { class: 'full', text: 'Заполнена', label: 'status-full' };
        } else {
            return { class: 'waiting', text: 'Ожидание', label: 'status-waiting' };
        }
    }

    show() {
        this.element.classList.add('active');
        this.refreshLobby();
    }

    hide() {
        this.element.classList.remove('active');
    }
}