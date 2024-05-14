import express from 'express';
import http from 'http';
import shortId from 'shortid';
import { WebSocketServer } from 'ws';
import path from 'path';
import { box2d, initBox2D } from './init-box2d.js';
import { serverEvents, makeMessage } from '../share/events.js';
import DebugDrawer from './debug-drawer.js';
import Player from './player.js';

const app = express();
let world;
const pixelsPerMeter = 50;
const metaData = {};
const playersInDebugMode = {};
const players = {};
const clientIds = [];
const clientBodies = [];

const platformInfo = [];
platformInfo[0] = { x: 400, y: 568, w: 400, h: 32, scale: 2 };
platformInfo[1] = { x: 600, y: 400, w: 400, h: 32, scale: 1 };
platformInfo[2] = { x: 50, y: 250, w: 400, h: 32, scale: 1 };
platformInfo[3] = { x: 750, y: 220, w: 400, h: 32, scale: 1 };

const wallInfo = [];
wallInfo[0] = { x: 0, y: 300, w: 10, h: 600, xOffset: -5, yOffset: 0 };
wallInfo[1] = { x: 800, y: 300, w: 10, h: 600, xOffset: 5, yOffset: 0 };
wallInfo[2] = { x: 400, y: 0, w: 800, h: 10, xOffset: 0, yOffset: -5 };

app.use(express.static(path.join(process.cwd(), 'public')));

const httpServer = http.createServer(app);
const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`Listening at port: ${port}`);
    init();
});

const webSocketServer = new WebSocketServer({ server: httpServer });

webSocketServer.on('connection', client => {
    const clientId = shortId.generate();
    console.log(`Client with id=${clientId} was connected`);

    client.onmessage = event => {
        const action = JSON.parse(event.data).action;
        const data = JSON.parse(event.data).data;
        switch (action) {
            case serverEvents.incoming.READY: {
                players[clientId] = new Player(metaData);
                players[clientId].socket = client;
                clientIds.push(clientId);

                const {
                    b2_dynamicBody,
                    b2BodyDef,
                    b2CircleShape,
                    b2Vec2,
                    getPointer
                } = box2d;

                const playerInitialPosition = { x: 100, y: 450 };

                const playerShape = new b2CircleShape();
                playerShape.m_radius = 20 / pixelsPerMeter;
                const playerBodyDef = new b2BodyDef();
                playerBodyDef.type = b2_dynamicBody;
                const playerPosX = playerInitialPosition.x / pixelsPerMeter;
                const playerPosY = playerInitialPosition.y / pixelsPerMeter;
                playerBodyDef.set_position(new b2Vec2(playerPosX, playerPosY));
                const playerBody = world.CreateBody(playerBodyDef);
                playerBody.SetFixedRotation(true);
                const playerFixture = playerBody.CreateFixture(playerShape, 1);
                playerFixture.SetFriction(3);
                metaData[getPointer(playerFixture)] = {
                    name: clientId
                };
                clientBodies.push(playerBody);
                players[clientId].body = playerBody;

                client.send(makeMessage(serverEvents.outgoing.CLIENT_ID,
                    JSON.stringify({
                        clientId: clientId
                    })));

                for (let i = 0; i < clientIds.length; i++) {
                    const s = players[clientIds[i]].socket;
                    if (s) {
                        s.send(makeMessage(serverEvents.outgoing.INITIAL_STATE,
                            JSON.stringify({
                                clientId: clientId,
                                playerPosition: playerInitialPosition
                            })));
                    }
                }

                for (let i = 0; i < clientIds.length; i++) {
                    if (clientIds[i] !== clientId) {
                        const playerBodyPosition = clientBodies[i].GetPosition();
                        const x = playerBodyPosition.x * pixelsPerMeter;
                        const y = playerBodyPosition.y * pixelsPerMeter;
                        client.send(makeMessage(serverEvents.outgoing.INITIAL_STATE,
                            JSON.stringify({
                                clientId: clientIds[i],
                                playerPosition: { x: x, y: y }
                            })));
                    }
                }

                client.send(makeMessage(serverEvents.outgoing.PLATFORM_INFO,
                    JSON.stringify(platformInfo)));
                break;
            }
            case serverEvents.incoming.TOGGLE_DEBUG_MODE: {
                const dm = JSON.parse(data).debugMode;
                if (dm) {
                    playersInDebugMode[clientId] = client;
                } else {
                    delete playersInDebugMode[clientId];
                }
                break;
            }
            case serverEvents.incoming.INPUT: {
                const input = JSON.parse(data).input;
                const p = players[clientId];

                if (input.left) {
                    const vel = p.body.GetLinearVelocity();
                    vel.x = -3;
                    p.body.SetLinearVelocity(vel);
                }

                if (input.right) {
                    const vel = p.body.GetLinearVelocity();
                    vel.x = 3;
                    p.body.SetLinearVelocity(vel);
                }

                if (input.up && (p.groundedLeftRay || p.groundedRightRay)) {
                    const vel = p.body.GetLinearVelocity();
                    vel.y = -9;
                    p.body.SetLinearVelocity(vel);
                    p.groundedLeftRay = false;
                    p.groundedRightRay = false;
                }

                break;
            }
            default: {
                console.log('Uknown action');
                break;
            }
        }
    };

    client.onclose = () => {
        console.log(`Client with id=${clientId} was disconnected`);
        if (playersInDebugMode[clientId]) {
            delete playersInDebugMode[clientId];
        }

        const index = clientIds.indexOf(clientId);
        if (index > -1) { // only splice array when item is found
            clientIds.splice(index, 1); // 2nd parameter means remove one item only
            world.DestroyBody(clientBodies[index]);
            clientBodies.splice(index, 1);
        }

        delete players[clientId];
        for (const key in players) {
            if (key !== clientId) {
                players[key].socket.send(makeMessage(serverEvents.outgoing.REMOVE_CLIENT,
                    JSON.stringify({ clientId: clientId })));
            }
        }
    };
});

async function init() {
    await initBox2D();

    const {
        b2_dynamicBody,
        b2_staticBody,
        b2BodyDef,
        b2CircleShape,
        b2PolygonShape,
        b2Vec2,
        b2World,
        getPointer
    } = box2d;

    const gravity = new b2Vec2(0, 10);
    world = new b2World(gravity);

    // Platforms
    for (let i = 0; i < platformInfo.length; i++) {
        const shape = new b2PolygonShape();
        const halfWidth = platformInfo[i].w * platformInfo[i].scale / 2 / pixelsPerMeter;
        const halfHeight = platformInfo[i].h * platformInfo[i].scale / 2 / pixelsPerMeter;
        shape.SetAsBox(halfWidth, halfHeight);
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2_staticBody;
        const x = platformInfo[i].x / pixelsPerMeter;
        const y = platformInfo[i].y / pixelsPerMeter;
        bodyDef.set_position(new b2Vec2(x, y));
        const body = world.CreateBody(bodyDef);
        const fixture = body.CreateFixture(shape, 0);
        fixture.SetFriction(3);
        metaData[getPointer(fixture)] = {
            name: 'platform'
        };
    }

    // Walls
    for (let i = 0; i < wallInfo.length; i++) {
        const shape = new b2PolygonShape();
        const halfWidth = wallInfo[i].w / 2 / pixelsPerMeter;
        const halfHeight = wallInfo[i].h / 2 / pixelsPerMeter;
        shape.SetAsBox(halfWidth, halfHeight);
        const bodyDef = new b2BodyDef();
        bodyDef.type = b2_staticBody;
        const x = (wallInfo[i].x + wallInfo[i].xOffset) / pixelsPerMeter;
        const y = (wallInfo[i].y + wallInfo[i].yOffset) / pixelsPerMeter;
        bodyDef.set_position(new b2Vec2(x, y));
        const body = world.CreateBody(bodyDef);
        const fixture = body.CreateFixture(shape, 0);
        fixture.SetFriction(0);
    }

    const debugDrawer = new DebugDrawer(pixelsPerMeter, playersInDebugMode);
    world.SetDebugDraw(debugDrawer.instance);
    setInterval(() => physicsLoop(), 16);
}

function physicsLoop() {
    world.Step(0.016, 3, 2);

    for (let i = 0; i < clientIds.length; i++) {
        const targetSocket = players[clientIds[i]].socket;
        if (targetSocket) {
            for (let j = 0; j < clientIds.length; j++) {
                const playerBodyPosition = clientBodies[j].GetPosition();
                const x = playerBodyPosition.x * pixelsPerMeter;
                const y = playerBodyPosition.y * pixelsPerMeter;
                const playerBodyVelocity = clientBodies[j].GetLinearVelocity();
                const vx = playerBodyVelocity.x;
                const vy = playerBodyVelocity.y;
                targetSocket.send(makeMessage(serverEvents.outgoing.CURRENT_STATE,
                    JSON.stringify({
                        clientId: clientIds[j],
                        playerPosition: { x: x, y: y },
                        playerVelocity: { x: vx, y: vy }
                    })));
            }
        }
    }

    const {
        b2Vec2
    } = box2d;

    for (let i = 0; i < clientIds.length; i++) {
        const p = players[clientIds[i]];
        const b = clientBodies[i];
        const x = b.GetPosition().x;
        const y = b.GetPosition().y;
        // Left ray
        const leftRayBeginPoint = new b2Vec2(x - 12 / pixelsPerMeter, y + 5 / pixelsPerMeter);
        const leftRayEndPoint = new b2Vec2( x - 12 / pixelsPerMeter, y + 25 / pixelsPerMeter);
        world.RayCast(p.leftRayCastCallback.instance, leftRayBeginPoint, leftRayEndPoint);
        // Right ray
        const rightRayBeginPoint = new b2Vec2(x + 12 / pixelsPerMeter, y + 5 / pixelsPerMeter);
        const rightRayEndPoint = new b2Vec2( x + 12 / pixelsPerMeter, y + 25 / pixelsPerMeter);
        world.RayCast(p.rightRayCastCallback.instance, rightRayBeginPoint, rightRayEndPoint);
    }

    if (Object.keys(playersInDebugMode).length !== 0) {
        world.DebugDraw();

        for (let i = 0; i < clientIds.length; i++) {
            const targetSocket = players[clientIds[i]].socket;
            for (let j = 0; j < clientBodies.length; j++) {
                const body = clientBodies[j];
                const x = body.GetPosition().x;
                const y = body.GetPosition().y;
                targetSocket.send(makeMessage(serverEvents.outgoing.RAYS,
                    JSON.stringify({
                        clientId: clientIds[j],
                        info: {
                            leftRayBeginPoint: { x: x * pixelsPerMeter - 12, y: y * pixelsPerMeter + 5 },
                            leftRayEndPoint: { x: x * pixelsPerMeter - 12, y: y * pixelsPerMeter + 25 },
                            rightRayBeginPoint: { x: x * pixelsPerMeter + 12, y: y * pixelsPerMeter + 5 },
                            rightRayEndPoint: { x: x * pixelsPerMeter + 12, y: y * pixelsPerMeter + 25 }
                        }
                    })));
                }
        }

        // Clear colliders
        for (const key in playersInDebugMode) {
            playersInDebugMode[key].send(makeMessage(serverEvents.outgoing.CLEAR_COLLIDER_INFO, null));
        }
    }
}
