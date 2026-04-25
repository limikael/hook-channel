import {packageUp} from "package-up";
import {resolveAllExports} from 'resolve-import'
import resolvePackagePath from "resolve-package-path";
import fs, {promises as fsp} from "fs";
import HookEvent from "./HookEvent.js";
import {arrayify} from "./js-util.js";
import path from "path";
import HookChannelModule from "./HookChannelModule.js";

export default class HookChannel {
	constructor({keyword, exportPath, cwd, conditions, extraModuleDirs, capsKeys, defaultEnableKey,
			enableKey, disableKey}) {
		this.cwd=cwd;
		this.keyword=keyword;
		this.conditions=conditions;
		this.exportPath=exportPath;

		if (!this.exportPath.startsWith("."))
			this.exportPath="./"+this.exportPath;

		//this.moduleFilenames=[];
		this.modules=[];
		this.listeners={};
		this.extraModuleDirs=arrayify(extraModuleDirs);
		this.capsKeys=arrayify(capsKeys);
		this.defaultEnableKey=defaultEnableKey;
		this.enableKey=enableKey;
		this.disableKey=disableKey;
	}

	async loadInfo() {
		this.pkgPath=await packageUp({cwd: this.cwd});
		this.pkg=JSON.parse(await fsp.readFile(this.pkgPath));

		let deps=this.pkg.dependencies;
		if (!deps)
			deps={};

		for (let depName in deps) {
			let p=resolvePackagePath(depName,this.pkgPath);
			await this.processPackagePath(p);
		}

		for (let parentDir of this.extraModuleDirs) {
			for (let dir of await fsp.readdir(parentDir)) {
				let p=path.join(parentDir,dir,"package.json");
				await this.processPackagePath(p);
			}
		}
	}

	async loadModules() {
		if (this.modulesLoaded)
			return;

		this.modulesLoaded=true;
		for (let mod of this.getModules({enabled: true}))
			this.addListenerModule(await mod.getModule());
	}

	async processPackagePath(depPackagePath) {
		let depPkg=JSON.parse(await fsp.readFile(depPackagePath));
		if (this.keyword) {
			if (!depPkg.keywords || !depPkg.keywords.includes(this.keyword))
				return;
		}

		let pathPackageName=path.basename(path.dirname(depPackagePath))
		if (pathPackageName!=depPkg.name)
			throw new Error("Unexpected module name / path: "+depPackagePath);

		if (depPkg.type!="module")
			throw new Error("Not a module: "+depPackagePath);

		let allExports=await resolveAllExports(depPackagePath,{conditions: this.conditions});
		if (!allExports[this.exportPath])
			return;

		this.modules.push(new HookChannelModule({
			pkg: depPkg,
			name: depPkg.name,
			exportPathname: allExports[this.exportPath].pathname,
			hookChannel: this
		}));
	}

	addListener(type, listener, {priority}={}) {
		if (!this.listeners[type])
			this.listeners[type]=[];

		if (priority)
			listener.priority=priority;

		if (!listener.priority)
			listener.priority=10;

		this.listeners[type].push(listener);
		this.listeners[type].sort((a,b)=>a.priority-b.priority);
	}

	addListenerModule(mod) {
		for (let name in mod) {
			if (!["default"].includes(name)) {
				let event=name;
				if (mod[name].event)
					event=mod[name].event;

				this.addListener(event,mod[name]);
			}
		}
	}

	async dispatch(ev, props={}) {
		await this.loadModules();

		if (typeof ev=="string")
			ev=new HookEvent(ev,props);

		let listeners=[];
		if (this.listeners[ev.type])
			listeners.push(...this.listeners[ev.type]);		

		for (let listener of listeners)
			await listener(ev);

		return ev;
	}

	getModules({cap, enabled, name}={}) {
		return this.modules.filter(mod=>{
			if (enabled!==undefined && mod.isEnabled()!=enabled)
				return false;

			if (cap && !mod.getCaps().includes(cap))
				return false;

			if (name && mod.getName()!=name)
				return false;

			return true;
		});
	}

	getModuleByName(name) {
		let mods=this.getModules({name});
		if (!mods.length)
			throw new Error("Not installed: "+name);

		return mods[0];
	}

	isModuleInstalled(name) {
		let mods=this.getModules({name});
		return mods.length>0;
	}

	async enablePlugin(name, {save}={save: true}) {
		if (!this.enableKey || !this.disableKey)
			throw new Error("Enable/disable not available");

		this.modulesLoaded=false;
		this.listeners={};

		this.pkg[this.enableKey]=arrayify(this.pkg[this.enableKey]).filter(n=>n!=name);
		this.pkg[this.disableKey]=arrayify(this.pkg[this.disableKey]).filter(n=>n!=name);

		if (this.isModuleInstalled(name) &&
				!this.getModuleByName(name).isDefaultEnabled())
			this.pkg[this.enableKey].push(name);

		if (!this.pkg[this.enableKey].length)
			delete this.pkg[this.enableKey]

		if (!this.pkg[this.disableKey].length)
			delete this.pkg[this.disableKey]

		if (save)
			await this.savePkgJson();
	}

	async disablePlugin(name, {save}={save: true}) {
		if (!this.enableKey || !this.disableKey)
			throw new Error("Enable/disable not available");

		this.modulesLoaded=false;
		this.listeners={};

		this.pkg[this.enableKey]=arrayify(this.pkg[this.enableKey]).filter(n=>n!=name);
		this.pkg[this.disableKey]=arrayify(this.pkg[this.disableKey]).filter(n=>n!=name);

		if (this.isModuleInstalled(name) &&
				this.getModuleByName(name).isDefaultEnabled())
			this.pkg[this.disableKey].push(name);

		if (!this.pkg[this.enableKey].length)
			delete this.pkg[this.enableKey]

		if (!this.pkg[this.disableKey].length)
			delete this.pkg[this.disableKey]

		if (save)
			await this.savePkgJson();
	}

	async savePkgJson() {
		let content=JSON.stringify(this.pkg,null,2);
		await fsp.writeFile(this.pkgPath,content);
	}
}

export async function loadHookChannel(options) {
	let channel=new HookChannel(options);
	await channel.loadInfo();
	return channel;
}