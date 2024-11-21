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
    origin: "http://localhost:5173", // Replace with your frontend URL
    methods: ["GET", "POST"], // Allow specific methods
    credentials: true, // Allow cookies if needed
  },
});
const PORT = process.env.PORT || 5000;
const games = {};

io.on("connection", (socket) => {
  console.log("user connnected", socket.id);

  socket.on("createGame", () => {
    gameId = `game-${Date.now()}`;
    games[gameId] = {
      chess: new Chess(),
      players: { white: socket.id, black: null },
    };
    socket.join(gameId);
    socket.emit("gameCreated", { gameId, role: "white" }); //can change later
    console.log(`Game created: ${gameId}`);
  });

  socket.on("joinGame", (gameId) => {
    const game = games[gameId];
    if (game && !game.players.black) {
      game.players.black = socket.id;
      socket.join(gameId);
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
    io.to(gameId).emit("moveMade", {
      board: game.chess.board(),
      fen: game.chess.fen(),
      move: result,
    });
  });

  //  socket gets disconnected
  socket.on("disconnect", () => console.log("disconnectded"));
});

server.listen(PORT, () => {
  console.log("server is started");
});
