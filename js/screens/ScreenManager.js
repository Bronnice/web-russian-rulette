export class ScreenManager {
    constructor() {
        this.screens = new Map();
        this.currentScreen = null;
    }

    registerScreen(name, screen) {
        this.screens.set(name, screen);
        screen.hide();
    }

    showScreen(name) {
        if (this.currentScreen) {
            this.currentScreen.hide();
        }
        
        const screen = this.screens.get(name);
        if (screen) {
            screen.show();
            this.currentScreen = screen;
        }
    }

    getScreen(name) {
        return this.screens.get(name);
    }
}