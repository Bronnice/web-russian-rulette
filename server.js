const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const GameServer = require('./server/GameServer');

const app = express();

// Try to load SSL certificates if available
let server;
const sslKeyPath = path.join(__dirname, 'ssl', 'key.pem');
const sslCertPath = path.join(__dirname, 'ssl', 'cert.pem');

if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    // HTTPS server with SSL certificates
    const sslOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
    };
    server = https.createServer(sslOptions, app);
    console.log('Using HTTPS server with SSL certificates');
} else {
    // Fallback to HTTP server
    server = http.createServer(app);
    console.log('Using HTTP server (no SSL certificates found)');
}

const gameServer = new GameServer(server);

app.use(express.static(__dirname));
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
const protocol = server instanceof https.Server ? 'https' : 'http';
const wsProtocol = server instanceof https.Server ? 'wss' : 'ws';

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${protocol}://0.0.0.0:${PORT}`);
    console.log(`WebSocket server running on ${wsProtocol}://0.0.0.0:${PORT}`);
});

module.exports = { app, server, gameServer };