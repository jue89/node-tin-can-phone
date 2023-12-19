import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
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

	test('serialize custom type', () => {
		class MyType {
			constructor (foo) { this.foo = foo; }
		}
		const {stringify, parse} = genSerializer([{cls: MyType, toJSON: (x) => x.foo, fromJSON: (x) => new MyType(x)}]);

		const src = {
			myType: new MyType('bar')
		};
		const dst = parse(stringify(src));
		assert(dst.myType instanceof MyType);
		assert.equal(src.foo, dst.foo);
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
