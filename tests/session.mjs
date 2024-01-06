import {initSession} from '../session.mjs';
import {genBus} from '../bus.mjs';
import {describe, test, mock} from 'node:test';
import {nextTick} from 'node:process';
import assert from 'node:assert/strict';

function defer (fn) {
	return (arg) => {
		assert(arg);
		nextTick(() => fn(arg));
	};
}

function observer () {
	let resolve;
	const promise = new Promise((r) => { resolve = r; });
	const fn = (...params) => resolve(params);
	fn.result = promise;
	return fn;
}

describe('initSession', () => {
	test('connect rpc endpoints', async () => {
		const ab = genBus();
		const ba = genBus();
		const a = {afn: mock.fn()};
		const b = {bfn: mock.fn()};
		const [sa, sb] = await Promise.all([
			initSession({send: defer(ab.send), recv: ba.recv, proxy: a, isServer: false}),
			initSession({send: defer(ba.send), recv: ab.recv, proxy: b, isServer: true}),
		]);
		assert.equal(sa.proxy, a);
		assert.equal(sb.proxy, b);
		await sa.call.bfn();
		await sb.call.afn();
		assert.equal(a.afn.mock.callCount(), 1);
		assert.equal(b.bfn.mock.callCount(), 1);
	});

	test('connect event endpoints', async () => {
		const ab = genBus();
		const ba = genBus();
		const eva = observer();
		const evb = observer();
		const [sa, sb] = await Promise.all([
			initSession({send: defer(ab.send), recv: ba.recv, onEvent: eva, isServer: false}),
			initSession({send: defer(ba.send), recv: ab.recv, onEvent: evb, isServer: true}),
		]);
		sa.emitEvent('foo', 1, 2);
		sb.emitEvent('bar', 3, 4);
		assert.deepEqual(await evb.result, ['foo', 1, 2]);
		assert.deepEqual(await eva.result, ['bar', 3, 4]);
	});
});
