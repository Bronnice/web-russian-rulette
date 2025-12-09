const express = require('express');
const http = require('http');
const GameServer = require('./server/GameServer');

const app = express();
const server = http.createServer(app);
const gameServer = new GameServer(server);

app.use(express.static(__dirname));
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});

module.exports = { app, server, gameServer };