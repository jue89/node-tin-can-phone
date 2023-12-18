import assert from 'node:assert/strict';
import {describe, test, mock} from 'node:test';
import {genBus} from '../bus.mjs';

describe('genBus()', () => {
	test('send and recv', async () => {
		const {send, recv} = genBus();
		const res = recv(['a', 1]);
		send(['a', 1, 'foo', 'bar']);
		assert.deepEqual(await res, ['foo', 'bar']);
	});

	test('filter result', async () => {
		const {send, recv} = genBus();
		const res = recv(['b']);
		send(['a', 1]);
		send(['b', 2]);
		assert.deepEqual(await res, [2]);
	});

	test('recv multiple times', () => {
		const {send, recv} = genBus();
		const onMsg = mock.fn();
		recv(['a'], onMsg);
		send(['a', 1]);
		send(['a', 2]);
		send(['b', 3]);
		assert.equal(onMsg.mock.callCount(), 2);
		assert.deepEqual(onMsg.mock.calls[0].arguments[0], [1]);
		assert.deepEqual(onMsg.mock.calls[1].arguments[0], [2]);
	});

	test('remove listener', () => {
		const {send, recv} = genBus();
		const onMsg = mock.fn(() => true);
		recv(['a'], onMsg);
		send(['a', 1]);
		send(['a', 2]);
		assert.equal(onMsg.mock.callCount(), 1);
	});
});
