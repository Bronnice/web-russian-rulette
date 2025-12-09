const RussianRouletteGame = require('./RussianRouletteGame');

class GameManager {
    constructor() {
        this.games = new Map();
    }

    createGame(creatorName) {
        const game = new RussianRouletteGame(creatorName);
        this.games.set(game.id, game);
        return game;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    removeGame(gameId) {
        this.games.delete(gameId);
    }

    getActiveGames() {
        return Array.from(this.games.values())
            .filter(game => !game.gameOver)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    findGameByPlayer(playerName) {
        for (const game of this.games.values()) {
            if (game.hasPlayer(playerName)) {
                return {
                    game,
                    playerId: game.players.find(p => p.name === playerName)?.id
                };
            }
        }
        return null;
    }

    broadcastLobbyUpdate(wss) {
        const lobbyList = this.getActiveGames().map(game => game.getLobbyInfo());

        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.isInLobby) {
                try {
                    client.send(JSON.stringify({
                        type: 'lobbyUpdate',
                        games: lobbyList
                    }));
                } catch (error) {
                    console.error('Error sending lobby update:', error);
                }
            }
        });
    }

    cleanupEmptyGames() {
        for (const [gameId, game] of this.games.entries()) {
            if (game.players.length === 0) {
                this.games.delete(gameId);
                console.log(`Removed empty game: ${gameId}`);
            }
        }
    }
}

module.exports = GameManager;