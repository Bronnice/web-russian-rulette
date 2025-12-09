import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface Player {
  id: string;
  name: string;
  isAlive: boolean;
}

interface GameState {
  id: string;
  players: Player[];
  currentTurn: number;
  bulletPosition: number;
  chamberPosition: number;
  isStarted: boolean;
  isFinished: boolean;
  winner: string | null;
  createdAt: number;
  turnStartTime: number;
}

interface CreateGameRequest {
  action: "create";
  playerId: string;
  playerName: string;
}

interface JoinGameRequest {
  action: "join";
  gameId: string;
  playerId: string;
  playerName: string;
}

interface ShootRequest {
  action: "shoot";
  gameId: string;
  playerId: string;
  targetId: string;
}

interface GetLobbyRequest {
  action: "getLobby";
}

interface LeaveGameRequest {
  action: "leave";
  gameId: string;
  playerId: string;
}

type GameRequest =
  | CreateGameRequest
  | JoinGameRequest
  | ShootRequest
  | GetLobbyRequest
  | LeaveGameRequest;

function generateGameId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createNewGame(playerId: string, playerName: string): GameState {
  return {
    id: generateGameId(),
    players: [
      {
        id: playerId,
        name: playerName,
        isAlive: true,
      },
    ],
    currentTurn: 0,
    bulletPosition: Math.floor(Math.random() * 6),
    chamberPosition: 0,
    isStarted: false,
    isFinished: false,
    winner: null,
    createdAt: Date.now(),
    turnStartTime: 0,
  };
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as GameRequest;
    const store = getStore("games");
    const lobbyStore = getStore("lobby");

    switch (body.action) {
      case "create": {
        const game = createNewGame(body.playerId, body.playerName);
        await store.setJSON(game.id, game);

        // Add to lobby
        const lobbyGames = (await lobbyStore.get("games", { type: "json" })) as string[] || [];
        lobbyGames.push(game.id);
        await lobbyStore.setJSON("games", lobbyGames);

        return new Response(
          JSON.stringify({
            type: "gameCreated",
            gameId: game.id,
            playerId: body.playerId,
            playerName: body.playerName,
            state: getPublicGameState(game),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "join": {
        const game = await store.get(body.gameId, { type: "json" }) as GameState | null;

        if (!game) {
          return new Response(
            JSON.stringify({ type: "error", message: "Game not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (game.players.length >= 2) {
          return new Response(
            JSON.stringify({ type: "error", message: "Game is full" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (game.isStarted) {
          return new Response(
            JSON.stringify({ type: "error", message: "Game already started" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        game.players.push({
          id: body.playerId,
          name: body.playerName,
          isAlive: true,
        });

        game.isStarted = true;
        game.turnStartTime = Date.now();

        await store.setJSON(game.id, game);

        // Remove from lobby
        const lobbyGames = (await lobbyStore.get("games", { type: "json" })) as string[] || [];
        const updatedLobby = lobbyGames.filter((id: string) => id !== game.id);
        await lobbyStore.setJSON("games", updatedLobby);

        return new Response(
          JSON.stringify({
            type: "joinedGame",
            gameId: game.id,
            playerId: body.playerId,
            playerName: body.playerName,
            state: getPublicGameState(game),
            gameStarted: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "shoot": {
        const game = await store.get(body.gameId, { type: "json" }) as GameState | null;

        if (!game) {
          return new Response(
            JSON.stringify({ type: "error", message: "Game not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        if (game.isFinished) {
          return new Response(
            JSON.stringify({ type: "error", message: "Game is finished" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const currentPlayer = game.players[game.currentTurn];
        if (currentPlayer.id !== body.playerId) {
          return new Response(
            JSON.stringify({ type: "error", message: "Not your turn" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const isBulletFired = game.chamberPosition === game.bulletPosition;
        const targetPlayer = game.players.find((p) => p.id === body.targetId);

        if (!targetPlayer) {
          return new Response(
            JSON.stringify({ type: "error", message: "Invalid target" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        let result: {
          shooter: string;
          target: string;
          isBulletFired: boolean;
          targetDied: boolean;
        };

        if (isBulletFired) {
          targetPlayer.isAlive = false;
          game.isFinished = true;
          game.winner = game.players.find(
            (p) => p.id !== targetPlayer.id && p.isAlive
          )?.name || null;

          result = {
            shooter: currentPlayer.name,
            target: targetPlayer.name,
            isBulletFired: true,
            targetDied: true,
          };
        } else {
          game.chamberPosition = (game.chamberPosition + 1) % 6;
          game.currentTurn = (game.currentTurn + 1) % game.players.length;
          game.turnStartTime = Date.now();

          result = {
            shooter: currentPlayer.name,
            target: targetPlayer.name,
            isBulletFired: false,
            targetDied: false,
          };
        }

        await store.setJSON(game.id, game);

        return new Response(
          JSON.stringify({
            type: "shotResult",
            result,
            state: getPublicGameState(game),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "getLobby": {
        const lobbyGameIds = (await lobbyStore.get("games", { type: "json" })) as string[] || [];
        const games: Array<{
          id: string;
          creatorName: string;
          playerCount: number;
        }> = [];

        for (const gameId of lobbyGameIds) {
          const game = await store.get(gameId, { type: "json" }) as GameState | null;
          if (game && !game.isStarted && !game.isFinished) {
            games.push({
              id: game.id,
              creatorName: game.players[0]?.name || "Unknown",
              playerCount: game.players.length,
            });
          }
        }

        return new Response(
          JSON.stringify({
            type: "lobbyUpdate",
            games,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      case "leave": {
        const game = await store.get(body.gameId, { type: "json" }) as GameState | null;

        if (game) {
          game.players = game.players.filter((p) => p.id !== body.playerId);

          if (game.players.length === 0) {
            await store.delete(body.gameId);
            const lobbyGames = (await lobbyStore.get("games", { type: "json" })) as string[] || [];
            const updatedLobby = lobbyGames.filter((id: string) => id !== body.gameId);
            await lobbyStore.setJSON("games", updatedLobby);
          } else if (game.isStarted && !game.isFinished) {
            game.isFinished = true;
            game.winner = game.players[0]?.name || null;
            await store.setJSON(body.gameId, game);
          } else {
            await store.setJSON(body.gameId, game);
          }
        }

        return new Response(
          JSON.stringify({
            type: "leftGame",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ type: "error", message: "Unknown action" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Game API error:", error);
    return new Response(
      JSON.stringify({ type: "error", message: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

function getPublicGameState(game: GameState) {
  return {
    id: game.id,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      isAlive: p.isAlive,
    })),
    currentTurn: game.currentTurn,
    currentPlayerName: game.players[game.currentTurn]?.name,
    isStarted: game.isStarted,
    isFinished: game.isFinished,
    winner: game.winner,
    remainingChambers: 6 - game.chamberPosition,
    turnStartTime: game.turnStartTime,
  };
}

export const config: Config = {
  path: "/api/game",
};
