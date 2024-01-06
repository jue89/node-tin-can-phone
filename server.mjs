import {WebSocketServer} from 'ws';
import assert from './assert.mjs';
import {genBus} from './bus.mjs';
import {defaultTypes, genSerializer} from './serialize.mjs';
import {initSession} from './session.mjs';

function retriggerableTimeout (fn, delay) {
	let handle;
	function abort () {
		clearTimeout(handle);
	}
	function reset () {
		clearTimeout(handle);
		handle = setTimeout(fn, delay);
	}
	return {reset, abort};
}

function abortableInterval (fn, interval) {
	const handle = setInterval(fn, interval);
	function stop () {
		clearInterval(handle);
	}
	return {stop};
}

export class TinCanServer {
	constructor ({server, customTypes = [], onConnection, pingInterval = 30000}) {
		assert(typeof server === 'object', 'server must be a Server instance');
		assert(typeof onConnection === 'function', 'onConnection must be a function');

		this.sessions = [];

		const {parse, stringify} = genSerializer([...defaultTypes, ...customTypes]);

		const wss = new WebSocketServer({server});
		wss.on('connection', async (ws, connection) => {
			let session;

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

			// Setup keep-alive
			const pingTimeout = retriggerableTimeout(() => close, pingInterval * 3);
			ws.on('pong', () => pingTimeout.reset());
			const ping = abortableInterval(() => ws.ping(), pingInterval);

			// Setup disconnect handler
			let disconnectHandler = () => {};
			ws.on('close', () => {
				this.sessions = this.sessions.filter((s) => s !== session);
				pingTimeout.abort();
				ping.stop();
				disconnectHandler();
			});

			// Prepare startSession hook
			const startSession = async ({proxy, onEvent, onDisconnect}) => {
				disconnectHandler = onDisconnect || (() => {});
				session = {
					...await initSession({
						isServer: true,
						recv: ingress,
						send: outgress,
						proxy,
						onEvent
					}),
					connection,
					close
				};
				this.sessions.push(session);
				return session;
			};

			// Ask the connection handle to start the session
			// Errors will terminate the session
			try {
				await onConnection({connection, startSession});
			} catch (err) {
				close();
			}
		});
	}
}
