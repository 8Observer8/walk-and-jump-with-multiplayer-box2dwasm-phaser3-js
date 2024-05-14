import { box2d } from './init-box2d.js';

export default class RayCastCallback {
    constructor(callback) {
        this.callback = callback;

        const {
            JSRayCastCallback
        } = box2d;

        const self = this;
        this.instance = Object.assign(new JSRayCastCallback(), {
            ReportFixture(fixture_p, point_p, normal_p, fraction) {
                self.callback(fixture_p, point_p, normal_p, fraction);
            }
        });
    }
}
