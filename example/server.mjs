import {TinCanServer} from '../server.mjs';
import {createServer} from 'node:http';

const server = createServer();
const tcs = new TinCanServer({server, onConnection: ({startSession}) => {
	console.log('new session');
	const onDisconnect = () => console.log('closed session')
	startSession({
		onDisconnect,
		proxy: {
			say: (x) => console.log('say', x),
			echo: (x) => x,
		}
	});
}});

server.listen(8080);
