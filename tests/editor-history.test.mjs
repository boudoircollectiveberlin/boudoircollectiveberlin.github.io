import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../editor/history.mjs';

test('editor history supports undo, redo and new edit branches', () => {
  const history = createHistory('<p>one</p>');
  assert.equal(history.canUndo, false);
  history.push('<p>two</p>');
  history.push('<p>three</p>');
  assert.equal(history.undo(), '<p>two</p>');
  assert.equal(history.undo(), '<p>one</p>');
  assert.equal(history.canUndo, false);
  assert.equal(history.redo(), '<p>two</p>');
  history.push('<p>new branch</p>');
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(), '<p>two</p>');
});

test('editor history ignores equal states, resets after save and respects its limit', () => {
  const history = createHistory('0', 3);
  assert.equal(history.push('0'), false);
  history.push('1');
  history.push('2');
  history.push('3');
  assert.equal(history.undo(), '2');
  assert.equal(history.undo(), '1');
  assert.equal(history.canUndo, false);
  history.reset('saved');
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
});
