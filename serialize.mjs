export const defaultTypes = [{
	cls: Date,
	pack: (x) => x.toISOString(),
	unpack: (x) => new Date(x),
}, {
	cls: Error,
	pack: (x) => x.message,
	unpack: (x) => new Error(x),
}, {
	cls: Map,
	pack: (x) => [...x.entries()],
	unpack: (x) => new Map(x),
}, {
	cls: Set,
	pack: (x) => [...x.values()],
	unpack: (x) => new Set(x),
}];

function isDict (x) {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function genSerializer (converter = []) {
	function tryPack (value) {
		const conv = converter.find((c) => value instanceof c.cls);
		if (!conv) return value;
		return {
			type: conv.cls.name,
			value: conv.pack(value)
		};
	}

	function stringify (obj, indent) {
		return JSON.stringify(obj, (key, value) => {
			/* We have to look inside the objects and arrays before JSON.stringify
			 * calls the Classes toJSON() method instead of the given one ... */
			if (isDict(value)) {
				return Object.fromEntries(Object.entries(value).map(([key, value]) => {
					return [key, tryPack(value)];
				}));
			} else if (Array.isArray(value)) {
				return value.map((value) => {
					return tryPack(value);
				});
			} else {
				return value;
			}
		}, indent);
	}

	function parse (json) {
		return JSON.parse(json, (key, value) => {
			if (!isDict(value)) return value;
			const {type} = value;
			if (!type) return value;
			const conv = converter.find((c) => type === c.cls.name);
			if (!conv) return value;
			return conv.unpack(value.value);
		});
	}

	return {stringify, parse};
}
