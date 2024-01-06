export const defaultTypes = [{
	cls: Date,
	toJSON: (x) => x.toISOString(),
	fromJSON: (x) => new Date(x),
}, {
	cls: Error,
	toJSON: (x) => x.message,
	fromJSON: (x) => new Error(x),
}, {
	cls: Map,
	toJSON: (x) => [...x.entries()],
	fromJSON: (x) => new Map(x),
}, {
	cls: Set,
	toJSON: (x) => [...x.values()],
	fromJSON: (x) => new Set(x),
}];

function isDict (x) {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function genSerializer (converter = []) {
	function tryToJSON (value) {
		const conv = converter.find((c) => value instanceof c.cls);
		if (!conv) return value;
		return {
			type: conv.cls.name,
			value: conv.toJSON(value)
		};
	}

	function stringify (obj) {
		return JSON.stringify(obj, (key, value) => {
			/* We have to look inside the objects and arrays before JSON.stringify
			 * calls the Classes toJSON() method instead of the given one ... */
			if (isDict(value)) {
				return Object.fromEntries(Object.entries(value).map(([key, value]) => {
					return [key, tryToJSON(value)];
				}));
			} else if (Array.isArray(value)) {
				return value.map((value) => {
					return tryToJSON(value);
				});
			} else {
				return value;
			}
		});
	}

	function parse (json) {
		return JSON.parse(json, (key, value) => {
			if (!isDict(value)) return value;
			const {type} = value;
			if (!type) return value;
			const conv = converter.find((c) => type === c.cls.name);
			if (!conv) return value;
			return conv.fromJSON(value.value);
		});
	}

	return {stringify, parse};
}
