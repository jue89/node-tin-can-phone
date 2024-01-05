import assert from './assert.mjs';

function arrMatch (needle, candidate) {
	for (let [idx, val] of needle.entries()) {
		if (candidate[idx] != val) return false;
	}
	return true;
}

export function genBus (logSend = () => {}) {
	let listeners = [];

	function recv (filter, cb) {
		if (!cb) {
			let resolve;
			const promise = new Promise((r) => { resolve = r; });
			listeners.push([filter, (args) => {
				resolve(args);
				return true;
			}]);
			return promise;
		} else {
			listeners.push([filter, cb]);
		}
	}

	function send (args) {
		logSend(args);
		assert(Array.isArray(args), 'args must be an array');
		listeners = listeners.filter(([filter, cb]) => {
			if (!arrMatch(filter, args)) return true;
			const remove = cb(args.slice(filter.length));
			return !remove;
		});
	}

	return {send, recv};
}

export function genDialog ({send, recv}) {
	return async (args, filter = []) => {
		const result = recv(filter);
		send(args);
		return result;
	};
}
