class PlayerManager {
    constructor() {
        this.playerSessions = new Map();
    }

    createSession(playerName, gameId, playerId, ws) {
        this.playerSessions.set(playerName, {
            gameId,
            playerId,
            ws,
            lastActive: Date.now()
        });
    }

    updateSession(playerName, ws) {
        const session = this.playerSessions.get(playerName);
        if (session) {
            session.ws = ws;
            session.lastActive = Date.now();
        }
    }

    removeSession(playerName) {
        this.playerSessions.delete(playerName);
    }

    getSession(playerName) {
        return this.playerSessions.get(playerName);
    }

    isPlayerInGame(playerName, gameManager) {
        return gameManager.findGameByPlayer(playerName) !== null;
    }

    cleanupInactiveSessions(timeout = 3600000) {
        const now = Date.now();
        for (const [playerName, session] of this.playerSessions.entries()) {
            if (now - session.lastActive > timeout) {
                this.playerSessions.delete(playerName);
                console.log(`Removed inactive session for: ${playerName}`);
            }
        }
    }
}

module.exports = PlayerManager;