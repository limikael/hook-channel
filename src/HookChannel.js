import {readPackageUp} from "read-package-up";
import {resolveAllExports} from 'resolve-import'
import resolvePackagePath from "resolve-package-path";
import fs, {promises as fsp} from "fs";
import HookEvent from "./HookEvent.js";
import {arrayify} from "./js-util.js";
import path from "path";

export default class HookChannel {
	constructor({keyword, exportPath, cwd, conditions, extraModuleDirs}) {
		this.cwd=cwd;
		this.keyword=keyword;
		this.conditions=conditions;
		this.exportPath=exportPath;

		if (!this.exportPath.startsWith("."))
			this.exportPath="./"+this.exportPath;

		this.moduleFilenames=[];
		this.modules=[];
		this.listeners={};

		this.extraModuleDirs=arrayify(extraModuleDirs);
	}

	async load() {
		let res=await readPackageUp({cwd: this.cwd});
		this.pkg=res.packageJson;
		this.pkgPath=res.path;

		for (let depName in this.pkg.dependencies) {
			let p=resolvePackagePath(depName,this.pkgPath);
			await this.processPackagePath(p);
		}

		for (let parentDir of this.extraModuleDirs) {
			for (let dir of await fsp.readdir(parentDir)) {
				let p=path.join(parentDir,dir,"package.json");
				await this.processPackagePath(p);
			}
		}

		for (let moduleFilename of this.moduleFilenames) {
			let mod=await import(moduleFilename);
			this.modules.push(mod);
			this.addListenerModule(mod);
		}
	}

	async processPackagePath(depPackagePath) {
		let depPkg=JSON.parse(await fsp.readFile(depPackagePath));
		let pathPackageName=path.basename(path.dirname(depPackagePath))
		if (pathPackageName!=depPkg.name)
			throw new Error("Unexpected module name / path: "+depPackagePath);

		if (depPkg.type!="module")
			throw new Error("Not a module: "+depPackagePath);

		if (this.keyword) {
			if (!depPkg.keywords || !depPkg.keywords.includes(this.keyword))
				return;
		}

		let allExports=await resolveAllExports(depPackagePath,{conditions: this.conditions});
		if (!allExports[this.exportPath])
			return;

		this.moduleFilenames.push(allExports[this.exportPath].pathname);
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
		if (typeof ev=="string")
			ev=new HookEvent(ev,props);

		let listeners=[];
		if (this.listeners[ev.type])
			listeners.push(...this.listeners[ev.type]);		

		for (let listener of listeners)
			await listener(ev);

		return ev;
	}
}

export async function loadHookChannel(options) {
	let channel=new HookChannel(options);
	await channel.load();
	return channel;
}