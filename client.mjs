import assert from './assert.mjs';
import {genBus} from './bus.mjs';
import {defaultTypes, genSerializer} from './serialize.mjs';
import {initSession} from './session.mjs';
import {EXT} from './types.mjs';

assert(WebSocket);

function genDefaultURL () {
	return `${document.location.protocol.replace('http', 'ws')}//${document.location.host}`;
}

export async function connectTinCan ({url, customTypes = [], onEvent, proxy, onDisconnect} = {}) {
	const {parse, stringify} = genSerializer([...defaultTypes, ...customTypes]);

	url ||= genDefaultURL();
	const ws = new WebSocket(url);

	// Setup messaging
	const pipe = genBus();
	ws.addEventListener('message', (evt) => {
		try {
			const msg = parse(evt.data);
			pipe.send(msg);
		} catch (err) {
			console.error('Cannot decode ingress message', err);
		}
	});
	const ingress = pipe.recv;
	const outgress = (msg) => ws.send(stringify(msg));

	// Setup close helper
	const close = (msg) => {
		outgress([EXT, msg]);
		ws.close();
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
		logErr: console.error
	});

	return {...session, close};
}
