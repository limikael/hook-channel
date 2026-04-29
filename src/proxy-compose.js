export function proxyCompose(...layers) {
	return new Proxy({}, {
		get(_, prop, receiver) {
			// handle symbols properly (e.g. inspect, iterator)
			if (typeof prop === "symbol") {
				for (const layer of layers) {
					if (prop in layer) {
						return Reflect.get(layer, prop, receiver);
					}
				}
				return undefined;
			}

			for (const layer of layers) {
				if (prop in layer) {
					const value = Reflect.get(layer, prop, receiver);

					if (typeof value === "function") {
						return value; //.bind(receiver);
					}

					return value;
				}
			}

			return undefined;
		}
	});
}

export function proxyComposeFb(...args) {
	if (args.length === 0) {
		throw new Error("proxyComposeFb requires at least a fallback function");
	}

	const fallback = args.pop();

	if (typeof fallback !== "function") {
		throw new Error("Last argument to proxyComposeFb must be a function");
	}

	const layers = args;

	return new Proxy({}, {
		get(_, prop, receiver) {
			//console.log("get: "+prop);

			// handle symbols properly
			if (typeof prop === "symbol") {
				for (const layer of layers) {
					if (prop in layer) {
						return Reflect.get(layer, prop, receiver);
					}
				}
				return undefined;
			}

			for (const layer of layers) {
				if (prop in layer) {
					const value = Reflect.get(layer, prop, receiver);

					if (typeof value === "function") {
						return value; //.bind(receiver);
					}

					return value;
				}
			}

			if (prop === "then" || prop=="bind") {
				return undefined;
			}

			// fallback → turn into callable method
			//console.log("fallback, prop="+prop);
			return function(...args) {
				//console.log("call fallback",this);
				return fallback(prop, args, receiver);
			};
		}
	});
}