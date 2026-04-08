export function arrayify(a) {
	if (!a)
		a=[];

	if (!Array.isArray(a))
		a=[a];

	return a.flat(Infinity);
}