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

function isDict (obj) {
	return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

export function genSerializer (converter = []) {
	function stringify (obj) {
		return JSON.stringify(obj, (key, value) => {
			if (!isDict(value)) return value;

			/* We have to look inside the object before JSON.stringify calls the Class' toJSON() method
			 * instead of the given one ... */
			return Object.fromEntries(Object.entries(value).map(([key, value]) => {
				const conv = converter.find((c) => value instanceof c.cls);
				if (conv) {
					value = {
						type: conv.cls.name,
						value: conv.toJSON(value)
					};
				}
				return [key, value];
			}));
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
