import {arrayify} from "./js-util.js";

export default class HookChannelModule {
	constructor({name, exportPathname, hookChannel, pkg}) {
		this.name=name;
		this.exportPathname=exportPathname;
		this.pkg=pkg;
		this.hookChannel=hookChannel;
	}

	getName() {
		return this.name;
	}

	getDescription() {
		let desc=this.pkg.description;
		if (!desc)
			desc="";

		return desc;
	}

	async getModule() {
		if (!this.module)
			this.module=await import(this.exportPathname);

		return this.module;
	}

	getCaps() {
		let caps=[];
		caps.push(this.name);

		for (let key of this.hookChannel.capsKeys) {
			for (let cap of arrayify(this.pkg[key]))
				caps.push(cap);
		}

		caps=Array.from(new Set(caps));

		return caps;
	}

	isDefaultEnabled() {
		let enabled=true;
		if (this.hookChannel.defaultEnableKey &&
				this.pkg.hasOwnProperty([this.hookChannel.defaultEnableKey]))
			enabled=this.pkg[this.hookChannel.defaultEnableKey];

		return enabled;
	}

	isEnabled() {
		let enabled=true;
		if (this.hookChannel.defaultEnableKey &&
				this.pkg.hasOwnProperty([this.hookChannel.defaultEnableKey]))
			enabled=this.pkg[this.hookChannel.defaultEnableKey];

		if (this.hookChannel.disableKey && 
				arrayify(this.hookChannel.pkg[this.hookChannel.disableKey]).includes(this.name))
			enabled=false;

		if (this.hookChannel.enableKey && 
				arrayify(this.hookChannel.pkg[this.hookChannel.enableKey]).includes(this.name))
			enabled=true;

		return enabled;
	}
}