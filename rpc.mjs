import assert from './assert.mjs';
import {REQ, RSP} from './types.mjs';

const RSP_OK = 'ok';
const RSP_ERR = 'err';

export function getMethods (obj) {
	if (obj.constructor && typeof obj.constructor.getMethods === 'function') {
		/* use helper to find available method names */
		return obj.constructor.getMethods();
	} else {
		/* dive into object to find methods */
		if (obj === Object.prototype) return [];
		return Object.getOwnPropertyNames(obj)
			.filter((key) => key !== 'constructor' && typeof obj[key] === 'function')
			.concat(getMethods(Object.getPrototypeOf(obj)));
	}
}

export function genCallee (obj, {send, recv}, logErr = (() => {})) {
	async function callMethod ([name, id, params]) {
		/* silently ignore everything that's not addressable */
		if (typeof name !== 'string') return;
		if (typeof id !== 'number') return;

		try {
			assert(Array.isArray(params), 'Parameter must be an array');
			assert(typeof obj[name] === 'function', `Method '${name}' not implemented`);
			return [RSP, name, id, RSP_OK, await obj[name](...params)];
		} catch (err) {
			logErr(err);
			return [RSP, name, id, RSP_ERR, err];
		}
	}

	recv([REQ], (args) => {
		callMethod(args).then((result) => result && send(result));
	});
}

export function genCaller (methods, {send, recv}) {
	let cnt = 0;
	return Object.fromEntries(methods.map((name) => [name, async (...params) => {
		const id = cnt++;
		send([REQ, name, id, params]);
		const [type, value] = await recv([RSP, name, id]);
		if (type === RSP_ERR) {
			throw new Error(value);
		}
		return value;
	}]));
}
