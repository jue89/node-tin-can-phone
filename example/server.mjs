import {TinCanServer} from '../server.mjs';
import {createServer} from 'node:http';

const server = createServer();
const tcs = new TinCanServer({server, onConnection: () => {
	console.log('new session');
	return {
		onDisconnect: () => console.log('closed session'),
		proxy: {
			say: (x) => console.log('say', x),
			echo: (x) => x,
		}
	};
}});

server.listen(8080);
