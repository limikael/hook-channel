export default class HookEvent {
	constructor(type, props={}) {
		Object.assign(this,props);
		this.type=type;
	}
}