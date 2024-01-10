import {connectTinCan} from '../client-node.mjs';

const session = await connectTinCan({
	url: 'ws://localhost:8080'
});

await session.call.say(await session.call.echo('hi'));

session.close('tschööö');
