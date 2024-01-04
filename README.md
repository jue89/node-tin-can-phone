# 🥫 Tin Can Phone RPC

## Example

```js
import {createServer} from 'node:http';
import {TinCanServer} from 'tin-can-phone/server';

class ClientProxy {
	constructor (server) {
		this.server = server;
	}

	register (name) {
		assert(!this.server.sessions.find(({proxy}) => proxy.name === name), `${name} already in use!`);
		this.name = name;
		this.server.sessions.forEach(({emitEvent}) => emitEvent('join', {name}));
	}

	send (msg) {
		assert(this.name, 'Please register before chatting!');
		this.server.sessions.forEach(({emitEvent}) => emitEvent('msg', {name: this.name, msg}));
	}

	async poke (name) {
		const session = this.server.sessions.find(({proxy}) => proxy.name === name);
		assert(session, `No user ${name} found!`);
		await session.call.poke();
	}

}

const httpServer = createServer();
httpServer.listen(8080);
const myServer = new TinCanServer({
	server: httpServer,
	onConnection: async ({connection, startSession}) => {
		const proxy = new ClientProxy(myServer);
		await startSession({proxy});
	}
});

setInterval(() => myServer.sessions.forEach(({emitEvent}) => emitEvent('heartbeat')), 1000);
```

```js
import {connectTinCan} from 'tin-can-phone/client';

const evtBus = new EventTarget();
const {call} = await connectTinCan({
	url: 'ws://localhost:8080',
	proxy: { poke: () => console.log('You have been poked!') },
	onEvent: (name, data) => evtBus.dispatchEvent(new CustomEvent(name, {detail: data})),
});

evtBus.addEventListener('message', (evt) => console.log(evt.detail.name, evt.detail.msg))
evtBus.addEventListener('join', (evt) => console.log('Join', evt.detail.name));

const name = prompt('Enter name');
const name = await call.register(name);
await call.send('Hello world');
```
