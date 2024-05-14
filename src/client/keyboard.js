export default class Keyboard {
    constructor() {
        this.keys = {};
        document.addEventListener("keydown", (event) => { this.onKeyChange(event, true) }, true);
        document.addEventListener("keyup", (event) => { this.onKeyChange(event, false) }, false);
    }

    pressed(key) {
        return this.keys[key];
    }

    onKeyChange(event, pressed) {
        this.keys[event.code] = pressed;
    }
}
