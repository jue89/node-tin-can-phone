import {REG} from './types.mjs';
import {getMethods, genCallee, genCaller} from './rpc.mjs';
import {attachEventListener, genEventEmitter} from './events.mjs';

export async function initSession ({send, recv, localProxy, onEvent, isServer}) {
	localProxy ||= {};
	onEvent ||= () => {};

	// Setup and exchange RPC methods
	genCallee(localProxy, {send, recv});
	let remoteMethods;
	if (isServer) {
		send([REG, ...getMethods(localProxy)]);
		remoteMethods = await recv([REG]);
	} else {
		remoteMethods = await recv([REG]);
		send([REG, ...getMethods(localProxy)]);
	}
	const remoteProxy = genCaller(remoteMethods, {send, recv});

	// Setup event bus
	attachEventListener(onEvent, {recv});
	const emitEvent = genEventEmitter({send});

	return {localProxy, remoteProxy, emitEvent};
}
