import assert from 'node:assert/strict';
import test from 'node:test';
import { MagCalRecorder, POLES, calQuality, fitSphere } from '../src/tabs/position/mag_cal.js';

const OFFSET = [105, 239, -40];
const RADIUS = 480;

// Field vector seen by the sensor for unit direction d, with hard iron and noise
function sample(d, noise = 0, seed = { s: 1 }) {
    const rnd = () => {
        seed.s = (seed.s * 1103515245 + 12345) % 2147483648;
        return seed.s / 2147483648 - 0.5;
    };
    return d.map((c, i) => OFFSET[i] + RADIUS * c + noise * rnd());
}

function sphereDirs(n, zMax = 1) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const z = -1 + (2 * (i + 0.5)) / n;
        if (z > zMax) continue;
        const r = Math.sqrt(1 - z * z);
        const phi = i * 2.399963;
        out.push([r * Math.cos(phi), r * Math.sin(phi), z]);
    }
    return out;
}

test('sphere fit recovers centre and radius', () => {
    const fit = fitSphere(sphereDirs(200).map((d) => sample(d, 10)));
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(fit.centre[i] - OFFSET[i]) < 5);
    assert.ok(Math.abs(fit.radius - RADIUS) < 5);
});

test('full coverage reaches every pole and rates ok', () => {
    const rec = new MagCalRecorder();
    for (const d of sphereDirs(300)) rec.add(sample(d, 6));
    const res = rec.analyse();
    assert.equal(res.poles.length, POLES.length);
    for (const p of res.poles) assert.ok(p > 0.95, `pole ${p}`);
    assert.ok(res.centreError < 3);
    assert.equal(calQuality(res), 'ok');
    rec.firmwareOffsets.forEach((o, i) => assert.ok(Math.abs(o - OFFSET[i]) < 15));
});

test('never inverted: +Z pole missing and centre off', () => {
    const rec = new MagCalRecorder();
    for (const d of sphereDirs(300, 0.2)) rec.add(sample(d, 6));
    const res = rec.analyse();
    const iz = POLES.findIndex((p) => p.axis === 2 && p.sign > 0);
    assert.ok(res.poles[iz] < 0.4, `+Z ${res.poles[iz]}`);
    assert.ok(res.centreError > 20);
    assert.equal(calQuality(res), 'bad');
});

test('too few samples gives no result', () => {
    const rec = new MagCalRecorder();
    for (const d of sphereDirs(10)) rec.add(sample(d));
    assert.equal(rec.analyse(), null);
    assert.equal(calQuality(null), 'bad');
});
