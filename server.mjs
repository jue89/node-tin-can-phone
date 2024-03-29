import {WebSocketServer} from 'ws';
import {debuglog} from 'node:util';
import assert from './assert.mjs';
import {genBus} from './bus.mjs';
import {jsonSerializer} from 'packaging-tape';
import {initSession} from './session.mjs';
import {EXT} from './types.mjs';

const debug = debuglog('tincan');

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

		const {parse, stringify} = jsonSerializer({customTypes});

		const wss = new WebSocketServer({server});
		wss.on('connection', async (ws, connection) => {
			let session;

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

			// Setup keep-alive
			const pingTimeout = retriggerableTimeout(() => close, pingInterval * 3);
			ws.on('pong', () => pingTimeout.reset());
			const ping = abortableInterval(() => ws.ping(), pingInterval);

			// Listen for last words from the client
			let lastWords;
			ingress([EXT], ([msg]) => { lastWords = msg; });

			// Setup disconnect handler
			let disconnectHandler = () => {};
			ws.on('close', () => {
				this.sessions = this.sessions.filter((s) => s !== session);
				pingTimeout.abort();
				ping.stop();
				disconnectHandler(lastWords);
			});

			// Prepare startSession hook
			const startSession = async ({proxy, onEvent, onDisconnect} = {}) => {
				disconnectHandler = onDisconnect || (() => {});
				session = {
					...await initSession({
						isServer: true,
						recv: ingress,
						send: outgress,
						proxy,
						onEvent,
						logErr: debug
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
				const obj = await onConnection({connection, startSession});
				if (!session) await startSession(obj);
			} catch (err) {
				close(err);
			}
		});
	}
}
