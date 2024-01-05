import {REG} from './types.mjs';
import {getMethods, genCallee, genCaller} from './rpc.mjs';
import {attachEventListener, genEventEmitter} from './events.mjs';

export async function initSession ({send, recv, local, onEvent}) {
	local ||= {};
	onEvent ||= () => {};

	// Setup and exchange RPC methods
	genCallee(local, {send, recv});
	send([REG, ...getMethods(local)]);
	const remoteMethods = await recv([REG]);
	const remote = genCaller(remoteMethods, {send, recv});

	// Setup event bus
	attachEventListener(onEvent, {recv});
	const emitEvent = genEventEmitter({send});

	return {local, remote, emitEvent};
}
