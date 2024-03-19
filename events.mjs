import {EVT} from './types.mjs';

export function attachEventListener (onEvent, {recv}) {
	recv([EVT], ([eventName, ...params]) => {
		onEvent(eventName, ...params);
	});
}

export function genEventEmitter ({send}) {
	return (eventName, ...params) => send([EVT, eventName, ...params]);
}
