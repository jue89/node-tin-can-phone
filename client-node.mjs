import {WebSocket} from 'ws';
import {debuglog} from 'node:util';
import {genBus} from './bus.mjs';
import {defaultTypes, genSerializer} from './serialize.mjs';
import {initSession} from './session.mjs';
import {EXT} from './types.mjs';

const debug = debuglog('tincan');

export async function connectTinCan ({url, customTypes = [], onEvent, proxy, onDisconnect}) {
	const {parse, stringify} = genSerializer([...defaultTypes, ...customTypes]);

	const ws = new WebSocket(url);

	// Setup messaging
	const pipe = genBus();
	ws.on('message', (msg) => {
		try {
			msg = parse(msg);
			pipe.send(msg);
		} catch (err) {
			debug('Cannot decode ingress message: %s', err.stack);
		}
	});
	const ingress = pipe.recv;
	const outgress = (msg) => ws.send(stringify(msg));

	// Setup close helper
	const close = (msg) => {
		outgress([EXT, msg]);
		ws.terminate();
	};

	// Listen for last words
	let lastWords;
	ingress([EXT], ([x]) => { lastWords = x; });

	// Setup disconnect handler
	onDisconnect ||= () => {};
	ws.addEventListener('close', () => onDisconnect(lastWords));

	const session = await initSession({
		isServer: false,
		recv: ingress,
		send: outgress,
		proxy,
		onEvent,
		logErr: debug
	});

	return {...session, close};
}
