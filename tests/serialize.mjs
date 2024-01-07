import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {Buffer} from 'node:buffer';
import {genSerializer, defaultTypes} from '../serialize.mjs';

describe('genSerializer()', () => {
	test('serialize common JS types', () => {
		const {stringify, parse} = genSerializer();
		const src = {
			a: 'hallo',
			b: {d: 1234},
			c: [null, true],
		};
		const json = stringify(src);
		assert(typeof json === 'string');
		const dst = parse(json);
		assert.deepEqual(src, dst);

	});

	test('serialize custom type with explizit packing', () => {
		class MyType {
			static pack (x) { return x.foo; }
			static unpack (x) { return new MyType(x); }
			constructor (foo) { this.foo = foo; }
		}
		const {stringify, parse} = genSerializer([{cls: MyType}]);

		const src = {
			myType: new MyType('bar'),
			foo: [new MyType('bar')]
		};
		const dst = parse(stringify(src));
		assert(dst.myType instanceof MyType);
		assert(dst.foo[0] instanceof MyType);
		assert.deepEqual(src.myType, dst.myType);
		assert.deepEqual(src.foo[0], dst.foo[0]);
	});

	test('serialize custom type with implizit packing', () => {
		class MyType {
			constructor (foo) { this.foo = foo; }
		}
		const {stringify, parse} = genSerializer([{cls: MyType}]);

		const src = new MyType('foo');
		const dst = parse(stringify(src));
		assert(dst instanceof MyType);
		assert.deepEqual(src, dst);
	});

	test('serialize with external packers', () => {
		const {stringify, parse} = genSerializer([{
			cls: Buffer,
			pack: (x) => x.toString('hex'),
			unpack: (x) => Buffer.from(x, 'hex')
		}]);

		const src = [Buffer.from('hello')];
		const ser = stringify(src);
		const parsedSer = JSON.parse(ser);
		assert.equal(parsedSer[0].type, 'Buffer');
		assert.equal(parsedSer[0].value, '68656c6c6f');
		const dst = parse(ser);
		assert(dst[0] instanceof Buffer);
		assert.equal(dst[0].toString(), 'hello');
	});
});

test('defaultTypes', () => {
	const {stringify, parse} = genSerializer(defaultTypes);
	const src = {
		myDate: new Date(),
		myErr: new Error('foo'),
		myMap: new Map([[1, 'a'], [2, 'b']]),
		mySet: new Set([1, 2, 3]),
	};
	const dst = parse(stringify(src));
	assert(dst.myDate instanceof Date);
	assert.equal(dst.myDate.getDate(), src.myDate.getDate());
	assert(dst.myErr instanceof Error);
	assert.equal(dst.myErr.message, src.myErr.message);
	assert(dst.myMap instanceof Map);
	assert.deepEqual([...dst.myMap.entries()], [...src.myMap.entries()]);
	assert(dst.mySet instanceof Set);
	assert.deepEqual([...dst.mySet.values()], [...src.mySet.values()]);
});
