import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {genBus, genDialog} from '../bus.mjs';
import {getMethods, genCallee, genCaller} from '../rpc.mjs';

describe('getMethods()', () => {
	test('extract methods from object', () => {
		assert.deepEqual(getMethods({
			a: () => {},
			b: () => {},
			c: true
		}), ['a', 'b']);
	});

	test('extract methods from object prototype', () => {
		class Foo {
			a () {}
			b () {}
		}

		assert.deepEqual(getMethods(new Foo()), ['a', 'b']);
	});

	test('extract methods from static helper', () => {
		class Foo {
			static getMethods () {
				return ['a', 'b'];
			}
		}

		assert.deepEqual(getMethods(new Foo()), ['a', 'b']);
	});
});

describe('genCaller() / genCallee()', () => {
	test('call methods using the proxy', async () => {
		const a = genBus();
		const b = genBus();

		const obj = {
			ctr: 0,
			add: function (val) {
				this.ctr += val;
				return this.ctr;
			}
		};

		genCallee(obj, {recv: a.recv, send: b.send});
		const proxy = genCaller(getMethods(obj), {recv: b.recv, send: a.send});

		assert.equal(await proxy.add(1), 1);
		assert.equal(await proxy.add(2), 3);
		assert.equal(obj.ctr, 3);
	});

	test('invalid params', async () => {
		const a = genBus();
		const b = genBus();
		genCallee({}, {recv: a.recv, send: b.send});
		const sendAndRecv = genDialog({recv: b.recv, send: a.send});
		a.send(['req', true]);
		a.send(['req', 'a', true]);
		assert.deepEqual(await sendAndRecv(['req', 'a', 1]), ['rsp', 'a', 1, 'err', new Error('Parameter must be an array')]);
		assert.deepEqual(await sendAndRecv(['req', 'a', 1, []]), ['rsp', 'a', 1, 'err', new Error('Method \'a\' not implemented')]);
	});

	test('propagate errs', async () => {
		const a = genBus();
		const b = genBus();
		const obj = {
			rejectedString: () => Promise.reject('foo'),
			rejectedError: () => Promise.reject(new Error('bar')),
			thrownError: () => { throw new Error('baz'); },
		};
		genCallee(obj, {recv: a.recv, send: b.send});
		const proxy = genCaller(getMethods(obj), {recv: b.recv, send: a.send});
		assert.rejects(() => proxy.rejectedString(), {message: 'foo'});
		assert.rejects(() => proxy.rejectedError(), {message: 'Error: bar'});
		assert.rejects(() => proxy.thrownError(), {message: 'Error: baz'});
	});
});
