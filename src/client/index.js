import { WEBGL, Display, Game, Scale } from 'phaser3';
import { clientEvents, makeMessage } from '../share/events.js';
import Keyboard from './keyboard.js';

let clientId;
const clientEntities = {};
const rayInfo = {};
let platformInfo = [], colliderInfo = [];
const keyboard = new Keyboard();
const input = {};

let host;
if (window.location.host === 'localhost:3000') {
    host = 'ws://localhost:3000';
} else {
    host = 'wss://walk-and-jump-with-multiplayer-box2dwasm-phaser3-js.glitch.me';
}
const ws = new WebSocket(host);

const config = {
    type: WEBGL,

    canvas: document.getElementById('renderCanvas'),
    width: 800,
    height: 600,
    scaleMode: Scale.ScaleModes.FIT,
    autoCenter: Scale.Center.CENTER_BOTH,

    autoFocus: true,
    scene: { preload, create, update },
    backgroundColor: '#555',

    callbacks: {
        preBoot: (game) => {
            game.scale.on('resize', onResize, game);
        }
    }
};

function onResize() {
    const { right, top } = this.scale.canvasBounds;

    debugInfoPanel.style.top = `${top + 10}px`;
    debugInfoPanel.style.left = `${right - debugInfoPanel.clientWidth - 20}px`;
    debugInfoPanel.style.display = 'block';
}

const debugInfoCheckBox = document.getElementById('debugInfoCheckBox');
let showDebugInfo = debugInfoCheckBox.checked;
let clearColliderInfo = showDebugInfo;
debugInfoCheckBox.onchange = () => {
    showDebugInfo = debugInfoCheckBox.checked;
    ws.send(makeMessage(clientEvents.outgoing.TOGGLE_DEBUG_MODE,
        JSON.stringify({ debugMode: showDebugInfo })));
};

const debugInfoPanel = document.getElementById('debugInfoPanel');

function preload() {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('bomb', 'assets/bomb.png');
    this.load.spritesheet('dude', 'assets/dude.png', {
        frameWidth: 32,
        frameHeight: 48
    });
}

function create() {
    this.add.image(400, 300, 'sky');
    this.graphics = this.add.graphics();

    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn',
        frames: [{ key: 'dude', frame: 4 }]
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
    });

    ws.onmessage = event => {
        const action = JSON.parse(event.data).action;
        const data = JSON.parse(event.data).data;
        switch (action) {
            case clientEvents.incoming.CLIENT_ID: {
                clientId = JSON.parse(data).clientId;
                break;
            }
            case clientEvents.incoming.INITIAL_STATE: {
                const id = JSON.parse(data).clientId;
                const playerPosition = JSON.parse(data).playerPosition;
                const x = playerPosition.x;
                const y = playerPosition.y;
                clientEntities[id] = this.add.sprite(x, y, 'dude');
                break;
            }
            case clientEvents.incoming.CURRENT_STATE: {
                const d = JSON.parse(data);
                const id = d.clientId;
                // Position
                const playerPosition = d.playerPosition;
                const x = playerPosition.x;
                const y = playerPosition.y;
                clientEntities[id].x = x;
                clientEntities[id].y = y - 3;
                // Animations
                const playerVelocity = d.playerVelocity;
                const vx = playerVelocity.x;
                if (Math.abs(vx) < 0.001) {
                    clientEntities[id].anims.play('turn');
                } else if (vx < 0) {
                    clientEntities[id].anims.play('left', true);
                } else if (vx > 0) {
                    clientEntities[id].anims.play('right', true);
                }
                break;
            }
            case clientEvents.incoming.RAYS: {
                const d = JSON.parse(data);
                const id = d.clientId;
                rayInfo[id] = d.info;
                break;
            }
            case clientEvents.incoming.PLATFORM_INFO: {
                platformInfo = JSON.parse(data);
                // Platforms
                for (let i = 0; i < platformInfo.length; i++) {
                    const x = platformInfo[i].x;
                    const y = platformInfo[i].y;
                    const scale = platformInfo[i].scale;
                    this.add.image(x, y, 'ground').setScale(scale);
                }
                break;
            }
            case clientEvents.incoming.COLLIDER_INFO: {
                colliderInfo.push(JSON.parse(data));
                break;
            }
            case clientEvents.incoming.CLEAR_COLLIDER_INFO: {
                clearColliderInfo = true;
                break;
            }
            case clientEvents.incoming.REMOVE_CLIENT: {
                const id = JSON.parse(data).clientId;
                clientEntities[id].destroy();
                delete clientEntities[id];
                delete rayInfo[id];
                break;
            }
            default: {
                console.log('Uknown action');
            }
        }
    };

    ws.send(makeMessage(clientEvents.outgoing.READY, null));
    ws.send(makeMessage(clientEvents.outgoing.TOGGLE_DEBUG_MODE,
        JSON.stringify({ debugMode: showDebugInfo })));
}

function update() {
    keyboardHandler();
    ws.send(makeMessage(clientEvents.outgoing.INPUT,
        JSON.stringify({ input: input })));
    input.up = false;
    input.left = false;
    input.right = false;

    if (showDebugInfo) {
        for (let i = 0; i < colliderInfo.length; i++) {
            const color = colliderInfo[i].color;
            const c = new Display.Color().setGLTo(color.r, color.g, color.b);
            this.graphics.lineStyle(3, c.color, 1);
            if (colliderInfo[i].colliderType == 'rectangle') {
                const vertices = colliderInfo[i].vertices;
                this.graphics.beginPath();
                this.graphics.moveTo(vertices[0].x, vertices[0].y);
                this.graphics.lineTo(vertices[1].x, vertices[1].y);
                this.graphics.lineTo(vertices[2].x, vertices[2].y);
                this.graphics.lineTo(vertices[3].x, vertices[3].y);
                this.graphics.closePath();
                this.graphics.strokePath();
            } else if (colliderInfo[i].colliderType == 'circle') {
                let angle = 0;
                const angleStep = 20;
                const n = 360 / angleStep;
                const x0 = colliderInfo[i].position.x;
                const y0 = colliderInfo[i].position.y;
                const radius = colliderInfo[i].radius;

                this.graphics.beginPath();

                let x = radius * Math.cos(angle * Math.PI / 180);
                let y = radius * Math.sin(angle * Math.PI / 180);
                this.graphics.moveTo(x0 + x, y0 + y);
                angle += angleStep;

                for (let i = 0; i < n; i++) {
                    x = radius * Math.cos(angle * Math.PI / 180);
                    y = radius * Math.sin(angle * Math.PI / 180);
                    this.graphics.lineTo(x0 + x, y0 + y);
                    angle += angleStep;
                }
                this.graphics.closePath();
                this.graphics.strokePath();
            }
        }

        for (const key in rayInfo) {
            const c = new Display.Color().setGLTo(1, 0, 0, 1);
            this.graphics.lineStyle(3, c.color, 1.0);
            this.graphics.beginPath();
            this.graphics.moveTo(rayInfo[key].leftRayBeginPoint.x,
                rayInfo[key].leftRayBeginPoint.y);
            this.graphics.lineTo(rayInfo[key].leftRayEndPoint.x,
                rayInfo[key].leftRayEndPoint.y);
            this.graphics.moveTo(rayInfo[key].rightRayBeginPoint.x,
                rayInfo[key].rightRayBeginPoint.y);
            this.graphics.lineTo(rayInfo[key].rightRayEndPoint.x,
                rayInfo[key].rightRayEndPoint.y);
            this.graphics.closePath();
            this.graphics.strokePath();
        }
    }

    setTimeout(() => {
        if (clearColliderInfo) {
            colliderInfo = [];
            this.graphics.clear();
            clearColliderInfo = false;
        }
    }, 0);
}

function keyboardHandler() {
    if (keyboard.pressed('KeyW') || keyboard.pressed('ArrowUp')) {
        input.up = true;
    }

    if (keyboard.pressed('KeyS') || keyboard.pressed('ArrowDown')) {
        input.down = true;
    }

    if (keyboard.pressed('KeyA') || keyboard.pressed('ArrowLeft')) {
        input.left = true;
    }

    if (keyboard.pressed('KeyD') || keyboard.pressed('ArrowRight')) {
        input.right = true;
    }
}

ws.onopen = () => {
    console.log('Connected to server');
    const game = new Game(config);
};
