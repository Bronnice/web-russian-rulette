export default class WebSocketClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.pingInterval = null;
        this.messageHandlers = new Map();
    }

    connect(host) {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `wss://${host}`;
                console.log('Connecting to WebSocket:', wsUrl);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('WebSocket connected successfully');
                    this.isConnected = true;
                    this.startPing();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                };
                
                this.ws.onclose = () => {
                    console.log('WebSocket disconnected');
                    this.isConnected = false;
                    this.stopPing();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(new Error('WebSocket connection error'));
                };
                
            } catch (error) {
                console.error('Connection error:', error);
                reject(error);
            }
        });
    }

    send(type, data = {}) {
        if (this.ws && this.isConnected) {
            const message = { type, ...data };
            this.ws.send(JSON.stringify(message));
        }
    }

    on(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    handleMessage(data) {
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        } else {
            console.log('No handler for message type:', data.type);
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.isConnected) {
                this.send('ping');
            }
        }, 30000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        this.stopPing();
    }
}