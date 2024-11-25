const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const app = express();
const server = http.createServer(app);
const corsOptions = {
  origin: "https://chess-mania-mrxgroot.vercel.app",
  methods: ["GET", "POST"],
  credentials: true,
};
const io = new Server(server, { cors: corsOptions });
const PORT = process.env.PORT || 5000;
const games = {};
const waitingQueue = [];

//utility functions
const createGameId = () => `game-${Date.now()}`;

const initializeGame = (whitePlayerId, blackPlayerId) => ({
  chess: new Chess(),
  players: { white: whitePlayerId, black: blackPlayerId },
});

const handleError = (socket, message) => {
  socket.emit("error", message);
};

const sendWaitingMessage = (socket, msg) => {
  socket.emit("waitingForOpponent", msg);
};

const handleCreateGame = (socket) => {
  if (socket.gameId) return;
  gameId = createGameId();
  games[gameId] = initializeGame(socket.id);
  socket.join(gameId);
  socket.gameId = gameId;
  socket.emit("gameCreated", { gameId, role: "white" });
  console.log(`Game created: ${gameId}`);
};

const handleJoinRandom = (socket) => {
  if (waitingQueue.includes(socket)) return;
  if (waitingQueue.length > 0) {
    const gameId = createGameId();
    const player = socket;
    const opponent = waitingQueue.shift();
    games[gameId] = initializeGame();
    player.join(gameId);
    opponent.join(gameId);
    player.gameId = gameId;
    opponent.gameId = gameId;
    player.emit("gameCreated", { gameId, role: "white" });
    opponent.emit("gameCreated", { gameId, role: "black" });
    io.to(gameId).emit("loadBoard");
  } else {
    waitingQueue.push(socket);
    sendWaitingMessage(socket, "Wait for the opponent to join");
  }
};

const handleClientReady = (socket) => {
  socket.emit("connected");
};

const handleJoinGame = (socket, gameId) => {
  const game = games[gameId];
  if (game.players.white === socket.id) return;
  if (game && !game.players.black) {
    game.players.black = socket.id;
    socket.join(gameId);
    socket.gameId = gameId;
    console.log("jointed", socket.gameId);
    socket.emit("playerJoined", { players: game.players, gameId });
    socket.emit("roleAssigned", { role: "black" });
    io.to(gameId).emit("loadBoard");
  }
};

const handleMakeMove = (socket, gameId, move) => {
  const game = games[gameId];
  if (!game) {
    handleError(socket, "game not found");
    return;
  }

  let result;
  try {
    result = game.chess.move(move);
  } catch (e) {}

  if (result == null || result == undefined || !result) {
    return;
  }
  if (game.chess.isGameOver()) {
    console.log("check mate");
    io.to(gameId).emit("matchClosed", "Check Mate..!");
  }
  io.to(gameId).emit("moveMade", {
    fen: game.chess.fen(),
  });
};

const handleDisconnect = (socket) => {
  console.log("player Disconnected");
  if (socket.gameId) {
    io.to(socket.gameId).emit("matchClosed", "Opponent left the game");
    delete games[socket.gameId];
    console.log("game deleted");
    console.log("socket.gameId", socket.gameId);
  }

  //remove the waiting queue
  const index = waitingQueue.indexOf(socket);
  if (index !== -1) {
    waitingQueue.splice(index, 1);
    console.log(`Player ${socket.id} removed from waiting queue`);
  }
};

io.on("connection", (socket) => {
  console.log("user connnected", socket.id);

  socket.on("clientReady", () => handleClientReady(socket));

  socket.on("createGame", () => handleCreateGame(socket));

  socket.on("joinRandom", () => handleJoinRandom(socket));

  socket.on("joinGame", (gameId) => handleJoinGame(socket, gameId));

  socket.on("makeMove", ({ gameId, move }) =>
    handleMakeMove(socket, gameId, move)
  );

  socket.on("disconnect", () => handleDisconnect(socket));
});

server.listen(PORT, () => {
  console.log("server is started");
});
