import assert from './assert.mjs';
import {genBus} from './bus.mjs';
import {genSerializer} from './serialize.mjs';
import {initSession} from './session.mjs';

assert(WebSocket);

export async function connectTinCan ({url, customTypes, onEvent, proxy, onDisconnect}) {
	const {parse, stringify} = genSerializer(customTypes);

	const ws = new WebSocket(url);

	// Setup close helper
	const close = () => ws.close();

	// Setup messaging
	const pipe = genBus();
	ws.addEventListener('message', (evt) => {
		try {
			const msg = parse(evt.data);
			pipe.send(msg);
		} catch (e) { /* NOP */ }
	});
	const ingress = pipe.recv;
	const outgress = (msg) => ws.send(stringify(msg));

	// Setup disconnect handler
	ws.addEventListener('close', () => onDisconnect && onDisconnect());

	const session = await initSession({
		isServer: false,
		recv: ingress,
		send: outgress,
		proxy,
		onEvent
	});

	return {...session, close};
}