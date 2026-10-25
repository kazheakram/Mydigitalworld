// Lists inside lists can't be stored by Firestore (the cloud version), so both versions refuse them,
// and restoring an older backup into the cloud converts them instead of failing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasNestedList, unnestLists, validateItem } from '../../shared/logic';

test('nested lists are detected anywhere in an item', () => {
  assert.equal(hasNestedList({ a: [1, 2], b: { c: ['x'] } }), false);
  assert.equal(hasNestedList({ map: { links: [['d:a', 'd:b']] } }), true);
  assert.equal(hasNestedList({ list: [{ inner: [[1]] }] }), true);
  assert.match(validateItem('expedition', 'private', { map: { links: [['a', 'b']] } }, null)!, /list inside a list/);
  assert.equal(validateItem('expedition', 'private', { map: { links: [{ from: 'a', to: 'b' }], pos: { 'd:a': [1, 2] } } }, null), null);
});

test('older data is made storable: map threads become {from, to}, other inner lists become indexed objects', () => {
  const out = unnestLists({ map: { links: [['d:a', 'd:b']], pos: { 'd:a': [3, 4] } }, grid: [[1, 2], [3]], keep: ['x', { y: [1] }] });
  assert.deepEqual(out.map.links, [{ from: 'd:a', to: 'd:b' }]);
  assert.deepEqual(out.map.pos, { 'd:a': [3, 4] });
  assert.deepEqual(out.grid, [{ 0: 1, 1: 2 }, { 0: 3 }]);
  assert.deepEqual(out.keep, ['x', { y: [1] }]);
  assert.equal(hasNestedList(out), false);
});
