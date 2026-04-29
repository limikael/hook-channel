import {packageUp} from "package-up";
import {resolveAllExports} from 'resolve-import'
import resolvePackagePath from "resolve-package-path";
import fs, {promises as fsp} from "fs";
import HookEvent from "./HookEvent.js";
import {arrayify, DeclaredError} from "./js-util.js";
import path from "path";
import HookChannelModule from "./HookChannelModule.js";
import {proxyComposeFb} from "./proxy-compose.js";

export default class HookChannel {
	constructor({keyword, exportPath, cwd, conditions, extraModuleDirs, extraModules,
			capsKeys, defaultEnableKey, enableKey, disableKey}) {
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
		this.extraModules=arrayify(extraModules);
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

	call=async (method, args)=>{
		let methods=[];

		for (let channelModule of this.getModules({enabled: true})) {
			let mod=await channelModule.getModule();
			if (mod[method])
				methods.push(mod[method]);
		}

		for (let mod of this.extraModules) {
			if (mod[method])
				methods.push(mod[method]);
		}

		methods.sort((a,b)=>a.priority??10-b.priority??10);

		for (let method of methods)
			await method.bind(this)(...args);
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
		//console.log(mods);
		return mods.length>0;
	}

	isModuleKnown(name) {
		return (this.isModuleInstalled(name) ||
			arrayify(this.pkg[this.enableKey]).includes(name) ||
			arrayify(this.pkg[this.disableKey]).includes(name))
	}

	async enablePlugin(name, {save}={save: true}) {
		if (!this.enableKey || !this.disableKey)
			throw new Error("Enable/disable not available");

		if (!this.isModuleKnown(name))
			throw new DeclaredError("Unknown plugin: "+name);

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

		if (!this.isModuleKnown(name))
			throw new DeclaredError("Unknown plugin: "+name);

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
	//let start=Date.now();
	let channel=new HookChannel(options);
	await channel.loadInfo();
	//console.log("load hook channel: "+(Date.now()-start));
	return channel;
}

export async function importChannel(options) {
	let channel=new HookChannel(options);
	await channel.loadInfo();
	//console.log("load hook channel: "+(Date.now()-start));
	return proxyComposeFb(channel,async function(method, args) {
		//console.log("here...",this);
		return await channel.call(method,args);
	});
}
