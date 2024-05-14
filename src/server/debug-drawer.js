import { box2d } from './init-box2d.js';
import { serverEvents, makeMessage } from '../share/events.js';

const sizeOfB2Vec2 = Float32Array.BYTES_PER_ELEMENT * 2;

export default class DebugDrawer {
    constructor(pixelsPerMeter, clientsInDebugMode) {
        this.pixelsPerMeter = pixelsPerMeter;
        this.clientsInDebugMode = clientsInDebugMode;

        const {
            b2Color,
            b2Draw: { e_shapeBit },
            b2Vec2,
            JSDraw,
            wrapPointer
        } = box2d;

        const reifyArray = (array_p, numElements, sizeOfElement, ctor) =>
            Array(numElements)
            .fill(undefined)
            .map((_, index) =>
                wrapPointer(array_p + index * sizeOfElement, ctor)
            );

        let self = this;
        const debugDrawer = Object.assign(new JSDraw(), {
            DrawSegment(vert1_p, vert2_p, color_p) {},
            DrawPolygon(vertices_p, vertexCount, color_p) {},
            DrawSolidPolygon(vertices_p, vertexCount, color_p) {
                const color = wrapPointer(color_p, b2Color);
                const vertices = reifyArray(vertices_p, vertexCount,
                    sizeOfB2Vec2, b2Vec2);
                for (const key in self.clientsInDebugMode) {
                    const vertList = [];
                    for (let i = 0; i < vertices.length; i++) {
                        vertList[i] = { x: vertices[i].x * self.pixelsPerMeter,
                            y: vertices[i].y * self.pixelsPerMeter };
                    }
                    const colliderInfo = { colliderType: 'rectangle', vertices: vertList, color: { r: color.r, g: color.g, b: color.b } };
                    self.clientsInDebugMode[key].send(makeMessage(serverEvents.outgoing.COLLIDER_INFO,
                        JSON.stringify(colliderInfo)));
                }
            },
            DrawCircle(center_p, radius, color_p) {},
            DrawSolidCircle(center_p, radius, axis_p, color_p) {
                const center = wrapPointer(center_p, b2Vec2);
                const color = wrapPointer(color_p, b2Color);
                for (const key in self.clientsInDebugMode) {
                    const colliderInfo = {
                        colliderType: 'circle',
                        position: { x: center.x * self.pixelsPerMeter, y: center.y * self.pixelsPerMeter },
                        radius: radius * self.pixelsPerMeter,
                        color: { r: color.r, g: color.g, b: color.b }
                    };
                    self.clientsInDebugMode[key].send(makeMessage(serverEvents.outgoing.COLLIDER_INFO,
                        JSON.stringify(colliderInfo)));
                }
            },
            DrawTransform(transform_p) {},
            DrawPoint(vertex_p, sizeMetres, color_p) {}
        });
        debugDrawer.SetFlags(e_shapeBit);
        this.instance = debugDrawer;
    }
}
