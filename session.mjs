import {REG} from './types.mjs';
import {getMethods, genCallee, genCaller} from './rpc.mjs';
import {attachEventListener, genEventEmitter} from './events.mjs';

export async function initSession ({send, recv, proxy, onEvent, isServer, logErr}) {
	proxy ||= {};
	onEvent ||= () => {};

	// Setup and exchange RPC methods
	genCallee(proxy, {send, recv}, logErr);
	let remoteMethods;
	if (isServer) {
		send([REG, ...getMethods(proxy)]);
		remoteMethods = await recv([REG]);
	} else {
		remoteMethods = await recv([REG]);
		send([REG, ...getMethods(proxy)]);
	}
	const call = genCaller(remoteMethods, {send, recv});

	// Setup event bus
	attachEventListener(onEvent, {recv});
	const emitEvent = genEventEmitter({send});

	return {proxy, call, emitEvent};
}
