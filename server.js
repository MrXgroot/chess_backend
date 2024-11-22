const express = require("express");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://chess-mania-mrxgroot.vercel.app", // Updated to your frontend URL
    methods: ["GET", "POST"], // Allow specific methods
    credentials: true, // Allow cookies if needed
  },
});

const PORT = process.env.PORT || 5000;
const games = {};
const waitingQueue = [];

io.on("connection", (socket) => {
  console.log("user connnected", socket.id);

  socket.on("createGame", () => {
    gameId = `game-${Date.now()}`;
    games[gameId] = {
      chess: new Chess(),
      players: { white: socket.id, black: null },
    };
    socket.join(gameId);
    socket.gameId = gameId;
    socket.emit("gameCreated", { gameId, role: "white" }); //can change later
    console.log(`Game created: ${gameId}`);
  });

  socket.on("joinRandom", () => {
    if (waitingQueue.length !== 0) {
      const gameId = `game-${Date.now()}`;

      const player = socket;
      const opponent = waitingQueue.shift();
      games[gameId] = {
        chess: new Chess(),
        players: { white: player, black: opponent },
      };
      player.join(gameId);
      opponent.join(gameId);
      player.gameId = gameId;
      opponent.gameId = gameId;
      player.emit("gameCreated", { gameId, role: "white" });
      opponent.emit("gameCreated", { gameId, role: "black" });
      io.to(gameId).emit("loadBoard");
    } else {
      waitingQueue.push(socket);
      socket.emit("waitnigForOpponent");
    }
  });

  socket.on("joinGame", (gameId) => {
    const game = games[gameId];
    if (game && !game.players.black) {
      game.players.black = socket.id;
      socket.join(gameId);
      socket.gameId = gameId;
      console.log("jointed", socket.gameId);
      socket.emit("playerJoined", { players: game.players, gameId });
      socket.emit("roleAssigned", { role: "black" });
      io.to(gameId).emit("loadBoard");
    }
  });

  //make move
  socket.on("makeMove", ({ gameId, move }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit("error", "Game not Found");
      return;
    }

    let result;
    try {
      result = game.chess.move(move);
    } catch (e) {}

    if (result == null || result == undefined || !result) {
      // socket.emit('error','Invalid move');
      return;
    }
    if (game.chess.isGameOver()) {
      console.log("check mate");
      io.to(gameId).emit("matchClosed", "Check Mate..!");
    }
    io.to(gameId).emit("moveMade", {
      board: game.chess.board(),
      fen: game.chess.fen(),
      move: result,
    });
  });

  //  socket gets disconnected
  socket.on("disconnect", () => {
    console.log("player Disconnected");
    if (socket.gameId) {
      delete games[socket.gameId];
      console.log("game deleted");
      console.log("socket.gameId", socket.gameId);
      io.to(socket.gameId).emit("matchClosed", "Opponent left the game");
    }

    //remove the waiting queue
    const index = waitingQueue.indexOf(socket);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
      console.log(`Player ${socket.id} removed from waiting queue`);
    }
  });
});

server.listen(PORT, () => {
  console.log("server is started");
});
