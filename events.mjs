import {EVT} from './types.mjs';

export function attachEventListener (onEvent, {recv}) {
	recv([EVT], ([eventName, ...params]) => onEvent(eventName, ...params));
}
