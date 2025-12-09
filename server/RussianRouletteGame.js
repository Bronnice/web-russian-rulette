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
        
        // Timer properties
        this.turnTimeLimit = 10000; // 10 seconds in milliseconds
        this.turnTimer = null;
        this.turnStartTime = null;
    }

    addPlayer(playerId, playerName, ws) {
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
            
            if (this.players.length >= 2 && !this.gameStarted) {
                this.gameStarted = true;
                this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
                this.startTurnTimer();
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

    handlePlayerDisconnect(playerName) {
        // Find the disconnecting player
        const disconnectedPlayer = this.players.find(p => p.name === playerName);
        if (!disconnectedPlayer) {
            return null;
        }

        // Mark the disconnected player as dead
        disconnectedPlayer.alive = false;

        // Find remaining alive players
        const alivePlayers = this.players.filter(p => p.alive);

        // Clear timer when game ends
        this.clearTurnTimer();

        // If only one player remains, they win
        if (alivePlayers.length === 1) {
            this.gameOver = true;
            return {
                shot: false,
                hit: false,
                disconnected: true,
                killed: disconnectedPlayer.id,
                killedName: disconnectedPlayer.name,
                winner: alivePlayers[0].id,
                winnerName: alivePlayers[0].name,
                gameOver: true,
                message: `🏃 ${disconnectedPlayer.name} покинул игру. ${alivePlayers[0].name} побеждает!`
            };
        }

        // If no players remain or game is already over
        if (alivePlayers.length === 0) {
            this.gameOver = true;
            return {
                shot: false,
                hit: false,
                disconnected: true,
                gameOver: true,
                message: 'Все игроки покинули игру'
            };
        }

        return null;
    }

    getCurrentPlayer() {
        if (this.players.length === 0) return null;
        return this.players[this.currentPlayerIndex];
    }

    shoot(targetId, isSelfShot = false) {
        if (this.gameOver) return { gameOver: true };

        // Clear the turn timer since player made a move
        this.clearTurnTimer();

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

        const result = this.chamberPosition === this.chamber;
        this.chamberPosition = (this.chamberPosition + 1) % 6;

        if (result) {
            targetPlayer.alive = false;
            this.clearTurnTimer();
            
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

        this.determineNextPlayer(isSelfShot, result);

        // Start timer for next player's turn
        if (!this.gameOver) {
            this.startTurnTimer();
        }

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
            this.lastShotSelf = true;
        } else if (!isSelfShot && !hitResult) {
            this.lastShotSelf = false;
            this.moveToNextAlivePlayer();
        } else if (hitResult) {
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

    startTurnTimer() {
        this.clearTurnTimer();
        this.turnStartTime = Date.now();
        
        this.turnTimer = setTimeout(() => {
            this.handleTurnTimeout();
        }, this.turnTimeLimit);
    }

    clearTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
        this.turnStartTime = null;
    }

    handleTurnTimeout() {
        if (this.gameOver) return;

        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return;

        // Pass turn to next player without shooting
        this.moveToNextAlivePlayer();

        // Broadcast timeout event
        this.broadcastToPlayers({
            type: 'turnTimeout',
            message: `⏰ Время вышло! ${currentPlayer.name} пропустил ход.`,
            state: this.getState()
        });

        // Start timer for next player
        this.startTurnTimer();
    }

    getRemainingTime() {
        if (!this.turnStartTime || this.gameOver) return 0;
        const elapsed = Date.now() - this.turnStartTime;
        const remaining = Math.max(0, this.turnTimeLimit - elapsed);
        return Math.ceil(remaining / 1000); // Return seconds
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
            lastShotSelf: this.lastShotSelf,
            remainingTime: this.getRemainingTime()
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
            if (player.ws && player.ws.readyState === 1) {
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