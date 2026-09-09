import test from 'node:test';
import assert from 'node:assert/strict';
import { JCARD_DIMENSIONS, getJCardDimensions } from '../src/constants/app.js';

test('10.7 mm spine reallocates width to inner flap without moving front or changing print scale', () => {
  const standard = getJCardDimensions();
  const narrow = getJCardDimensions({ spineSize: 'narrow' });
  assert.deepEqual(standard, JCARD_DIMENSIONS);
  assert.equal(narrow.width, standard.width);
  assert.equal(narrow.height, standard.height);
  assert.equal(narrow.panels.front, standard.panels.front);
  assert.equal(narrow.panels.back, standard.panels.back);
  assert.ok(Math.abs(narrow.panels.spine * 25.4 / 300 - 10.7) < 1e-10);
  assert.equal(narrow.panels.shortBack + narrow.panels.spine, standard.panels.shortBack + standard.panels.spine);
  assert.equal(Object.values(narrow.panels).reduce((a, b) => a + b, 0), standard.width);
});
