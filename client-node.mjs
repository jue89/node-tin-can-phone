import {WebSocket} from 'ws';
import {genBus} from './bus.mjs';
import {genSerializer} from './serialize.mjs';
import {initSession} from './session.mjs';

export async function connectTinCan ({url, customTypes, onEvent, proxy, onDisconnect}) {
	const {parse, stringify} = genSerializer(customTypes);

	const ws = new WebSocket(url);

	// Setup close helper
	const close = () => ws.terminate();

	// Setup messaging
	const pipe = genBus();
	ws.on('message', (msg) => {
		try {
			msg = parse(msg);
			pipe.send(msg);
		} catch (e) { /* NOP */ }
	});
	const ingress = pipe.recv;
	const outgress = (msg) => ws.send(stringify(msg));

	// Setup disconnect handler
	ws.on('close', () => onDisconnect && onDisconnect());

	const session = await initSession({
		isServer: false,
		recv: ingress,
		send: outgress,
		proxy,
		onEvent
	});

	return {...session, close};
}
