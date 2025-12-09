import GameClient from './GameClient.js';

// Инициализируем клиент при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.gameClient = new GameClient();
});