export class NameScreen {
    constructor(gameClient) {
        this.gameClient = gameClient;
        this.element = document.getElementById('nameScreen');
        this.init();
    }

    init() {
        document.getElementById('setNameBtn').addEventListener('click', () => this.setPlayerName());
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.setPlayerName();
        });
    }

    setPlayerName() {
        const nameInput = document.getElementById('playerNameInput');
        const name = nameInput.value.trim();
        
        if (name.length < 2) {
            this.showError('nameError', 'Имя должно содержать минимум 2 символа');
            return;
        }
        
        if (name.length > 20) {
            this.showError('nameError', 'Имя должно быть не более 20 символов');
            return;
        }
        
        this.gameClient.setPlayerName(name);
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
            setTimeout(() => {
                element.style.display = 'none';
            }, 5000);
        }
    }

    show() {
        this.element.classList.add('active');
    }

    hide() {
        this.element.classList.remove('active');
    }
}