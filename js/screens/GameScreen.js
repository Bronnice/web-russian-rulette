export class GameScreen {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.element = document.getElementById('gameScreen');
        this.init();
    }

    init() {
        document.getElementById('shootSelfBtn').addEventListener('click', () => this.shootSelf());
        document.getElementById('leaveGameBtn').addEventListener('click', () => this.leaveGame());
    }

    shootSelf() {
        this.gameClient.shoot(this.gameClient.playerId);
    }

    leaveGame() {
        if (confirm('Вы уверены, что хотите покинуть игру?')) {
            this.gameClient.leaveGame();
        }
    }

    updateGameInfo(playerName, gameId) {
        document.getElementById('playerNameDisplay').textContent = playerName;
        document.getElementById('currentGameIdDisplay').textContent = gameId;
    }

    updateGameState(state) {
        if (state.roundNumber) {
            document.getElementById('roundNumber').textContent = state.roundNumber;
        }
        
        this.updatePlayersStatus(state);
        
        this.updateCurrentPlayerInfo(state);
    }

    updatePlayersStatus(state) {
        const statusContainer = document.getElementById('playersStatus');
        if (statusContainer && state.players) {
            statusContainer.innerHTML = '<h3>Игроки:</h3>';
            
            state.players.forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = this.getPlayerClass(player, state.currentPlayer);
                playerDiv.textContent = player.name + (!player.alive ? ' (мертв)' : '');
                statusContainer.appendChild(playerDiv);
            });
        }
    }

    updateCurrentPlayerInfo(state) {
        const currentInfo = document.getElementById('currentPlayerInfo');
        if (!currentInfo) return;
        
        if (state.gameOver) {
            document.getElementById('actionButtons').style.display = 'none';
            currentInfo.innerHTML = '<p style="color:red;font-weight:bold;">Игра окончена!</p>';
        } else if (state.currentPlayer === this.gameClient.playerId) {
            currentInfo.innerHTML = '<p style="color:green;font-weight:bold;">🎯 Ваш ход! Выберите цель:</p>';
            document.getElementById('actionButtons').style.display = 'block';
            this.createShootButtons(state.players);
        } else if (state.currentPlayer) {
            document.getElementById('actionButtons').style.display = 'none';
            const currentPlayerName = this.getCurrentPlayerName(state);
            currentInfo.innerHTML = `<p>⏳ Ход игрока: <strong>${currentPlayerName}</strong></p>`;
        }
    }

    getPlayerClass(player, currentPlayerId) {
        let className = 'player';
        if (player.id === currentPlayerId) {
            className += ' current';
        }
        if (!player.alive) {
            className += ' dead';
        }
        return className;
    }

    getCurrentPlayerName(state) {
        if (state.players) {
            const currentPlayer = state.players.find(p => p.id === state.currentPlayer);
            if (currentPlayer) {
                return currentPlayer.name;
            }
        }
        return state.currentPlayer;
    }

    createShootButtons(players) {
        const container = document.getElementById('shootOthers');
        if (!container) return;
        
        container.innerHTML = '<h4>🎯 Или выстрелить в соперника:</h4>';
        
        if (players) {
            players.forEach(player => {
                if (player.id !== this.gameClient.playerId && player.alive) {
                    const btn = document.createElement('button');
                    btn.textContent = `🎯 Выстрелить в ${player.name}`;
                    btn.addEventListener('click', () => {
                        this.gameClient.shoot(player.id);
                    });
                    container.appendChild(btn);
                }
            });
        }
    }

    showShotResult(result) {
        const resultDiv = document.getElementById('shotResultDisplay');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.className = this.getResultClass(result);
        resultDiv.innerHTML = this.getResultHTML(result);
        
        if (result.gameOver) {
            this.showGameResult(result);
        }
        
        setTimeout(() => {
            if (resultDiv && !result.gameOver) {
                resultDiv.style.display = 'none';
            }
        }, 3000);
    }

    getResultClass(result) {
        if (result.hit) {
            return 'shot-result shot-hit';
        } else if (result.isSelfShot) {
            return 'shot-result shot-self-miss';
        } else {
            return 'shot-result shot-miss';
        }
    }

    getResultHTML(result) {
        if (result.hit) {
            return `
                <div style="font-size: 36px;">💥</div>
                <div>${result.message || 'Бах! Выстрел был смертельным!'}</div>
                <div>Игрок ${result.killedName || result.killed} убит!</div>
            `;
        } else {
            return `
                <div style="font-size: 36px;">🔫</div>
                <div>${result.message || 'Щелчок... Пустой патрон!'}</div>
            `;
        }
    }

    showGameResult(result) {
        const gameResultDiv = document.getElementById('gameResult');
        gameResultDiv.style.display = 'block';
        
        if (result.winner) {
            const isWinner = result.winner === this.gameClient.playerId;
            gameResultDiv.className = isWinner ? 'shot-result shot-miss' : 'shot-result shot-hit';
            gameResultDiv.innerHTML = `
                <div style="font-size: 36px;">${isWinner ? '🏆' : '💀'}</div>
                <div>${isWinner ? '🎉 ПОБЕДА!' : '😔 ПОРАЖЕНИЕ!'}</div>
                <div>${result.winnerName || result.winner} ${isWinner ? 'выигрывает игру!' : 'победил!'}</div>
            `;
        } else {
            gameResultDiv.className = 'shot-result shot-hit';
            gameResultDiv.innerHTML = `
                <div style="font-size: 36px;">☠️</div>
                <div>НИЧЬЯ!</div>
                <div>Все игроки мертвы!</div>
            `;
        }
    }

    showMessage(message, type = 'info') {
        const resultDiv = document.getElementById('shotResultDisplay');
        if (!resultDiv) return;
        
        resultDiv.className = type === 'info' ? 'shot-result shot-miss' : 'shot-result shot-hit';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="font-size: 36px;">${type === 'info' ? '🎲' : '⚠️'}</div>
            <div>${message}</div>
        `;
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
    }

    show() {
        this.element.classList.add('active');
        document.getElementById('shotResultDisplay').style.display = 'none';
        document.getElementById('gameResult').style.display = 'none';
    }

    hide() {
        this.element.classList.remove('active');
    }
}