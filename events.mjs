import {EVT} from './types.mjs';

export function attachEventBus (emit, busRecv) {
	busRecv([EVT], ([...params]) => emit(...params));
}
