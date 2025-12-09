class RussianRouletteGame {
    constructor(creatorName = 'Игрок') {
        this.id = Math.random().toString(36).substr(2, 9);
        this.creatorName = creatorName;
        this.createdAt = Date.now();
        this.maxPlayers = 2;
        
        this.players = [];
        this.currentPlayerIndex = 0;
        this.chamber = Math.floor(Math.random() * 6);
        this.chamberPosition = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.lastShotSelf = false;
    }

    addPlayer(playerId, playerName, ws) {
        // Проверяем, не подключен ли уже игрок к этой игре
        if (this.players.some(p => p.name === playerName)) {
            const existingPlayer = this.players.find(p => p.name === playerName);
            existingPlayer.ws = ws;
            existingPlayer.id = playerId;
            return true;
        }
        
        if (this.players.length < this.maxPlayers && !this.gameOver) {
            this.players.push({
                id: playerId,
                name: playerName,
                alive: true,
                ws: ws
            });
            
            // Если подключился второй игрок, начинаем игру
            if (this.players.length >= 2 && !this.gameStarted) {
                this.gameStarted = true;
                this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
            }
            
            return true;
        }
        return false;
    }

    removePlayer(playerName) {
        const playerIndex = this.players.findIndex(p => p.name === playerName);
        if (playerIndex !== -1) {
            this.players.splice(playerIndex, 1);
            
            if (playerIndex === this.currentPlayerIndex && this.players.length > 0) {
                this.currentPlayerIndex = this.currentPlayerIndex % this.players.length;
            }
            
            return true;
        }
        return false;
    }

    getCurrentPlayer() {
        if (this.players.length === 0) return null;
        return this.players[this.currentPlayerIndex];
    }

    shoot(targetId, isSelfShot = false) {
        if (this.gameOver) return { gameOver: true };

        const currentPlayer = this.getCurrentPlayer();
        let targetPlayer;
        
        if (isSelfShot) {
            targetPlayer = currentPlayer;
        } else {
            targetPlayer = this.players.find(p => p.id === targetId);
        }
        
        if (!targetPlayer || !targetPlayer.alive) {
            return { error: 'Invalid target' };
        }

        // Стрельба
        const result = this.chamberPosition === this.chamber;
        this.chamberPosition = (this.chamberPosition + 1) % 6;

        if (result) {
            targetPlayer.alive = false;
            
            const alivePlayers = this.players.filter(p => p.alive);
            if (alivePlayers.length <= 1) {
                this.gameOver = true;
                return {
                    shot: true,
                    hit: true,
                    killed: targetPlayer.id,
                    killedName: targetPlayer.name,
                    isSelfShot: isSelfShot,
                    winner: alivePlayers.length === 1 ? alivePlayers[0].id : null,
                    winnerName: alivePlayers.length === 1 ? alivePlayers[0].name : null,
                    gameOver: true
                };
            }
        }

        // Определяем следующего игрока по правилам
        this.determineNextPlayer(isSelfShot, result);

        return {
            shot: true,
            hit: result,
            isSelfShot: isSelfShot,
            currentPlayer: this.getCurrentPlayer()?.id,
            currentPlayerName: this.getCurrentPlayer()?.name,
            gameOver: this.gameOver,
            message: this.getShotMessage(result, isSelfShot)
        };
    }

    determineNextPlayer(isSelfShot, hitResult) {
        if (this.gameOver) return;

        if (isSelfShot && !hitResult) {
            // Выстрел в себя, холостой патрон - ход остается
            this.lastShotSelf = true;
        } else if (!isSelfShot && !hitResult) {
            // Выстрел в другого, холостой патрон - ход переходит
            this.lastShotSelf = false;
            this.moveToNextAlivePlayer();
        } else if (hitResult) {
            // Был смертельный выстрел
            this.lastShotSelf = false;
            this.moveToNextAlivePlayer();
        }
    }

    moveToNextAlivePlayer() {
        let attempts = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            attempts++;
            if (attempts > this.players.length) break;
        } while (!this.players[this.currentPlayerIndex].alive);
    }

    getShotMessage(hitResult, isSelfShot) {
        if (hitResult) {
            return '💥 Бах! Выстрел был смертельным!';
        } else if (isSelfShot) {
            return '🔫 Щелчок... Пустой патрон. Вы стреляете снова!';
        } else {
            return '🔫 Щелчок... Пустой патрон. Ход переходит сопернику!';
        }
    }

    getState() {
        const currentPlayer = this.getCurrentPlayer();
        return {
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                alive: p.alive
            })),
            currentPlayer: currentPlayer?.id,
            currentPlayerName: currentPlayer?.name,
            gameOver: this.gameOver,
            gameStarted: this.gameStarted,
            roundNumber: this.chamberPosition + 1,
            lastShotSelf: this.lastShotSelf
        };
    }

    getLobbyInfo() {
        return {
            gameId: this.id,
            creatorName: this.creatorName,
            players: this.players.map(p => p.name),
            playerCount: this.players.length,
            maxPlayers: this.maxPlayers,
            gameStarted: this.gameStarted,
            gameOver: this.gameOver,
            createdAt: this.createdAt
        };
    }

    broadcastToPlayers(message) {
        this.players.forEach(player => {
            if (player.ws && player.ws.readyState === 1) { // WebSocket.OPEN
                try {
                    player.ws.send(JSON.stringify(message));
                } catch (error) {
                    console.error(`Error sending to player ${player.id}:`, error);
                }
            }
        });
    }

    hasPlayer(playerName) {
        return this.players.some(p => p.name === playerName);
    }

    isFull() {
        return this.players.length >= this.maxPlayers;
    }
}

module.exports = RussianRouletteGame;