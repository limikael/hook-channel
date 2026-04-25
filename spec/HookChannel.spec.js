import {dirnameFromImportMeta} from "../src/node-util.js";
import path from "path";
import {loadHookChannel, HookEvent} from "../src/exports-node.js";
import fs, {promises as fsp} from "fs";

let __dirname=dirnameFromImportMeta(import.meta);

describe("HookChannel",()=>{
	it("can load",async ()=>{
		fs.rmSync(path.join(__dirname,"basic/node_modules"),{recursive: true, force: true});
		fs.cpSync(
			path.join(__dirname,"basic/node_modules.keep"),
			path.join(__dirname,"basic/node_modules"),
			{recursive:true}
		);

		let channel=await loadHookChannel({
			cwd: path.join(__dirname,"basic"),
			conditions: ["peac"],
			keyword: "sys-plugin",
			exportPath: "hello",
			extraModuleDirs: path.join(__dirname,"basic/packages"),
			capsKeys: ["caps","otherCaps"],
			defaultEnableKey: "defaultEn",
			enableKey: "enablePlugins",
			disableKey: "disablePlugins",
		});

		//console.log(channel.pkg);
		expect(channel.pkg.name).toEqual("basic");
		expect(channel.modules.length).toEqual(2);
		expect(channel.modules[0].exportPathname).toContain("hello-peac.js");

		expect(channel.getModules({enabled: true}).length).toEqual(1);

		channel.pkg.enablePlugins="plugin2";
		expect(channel.getModules({enabled: true}).length).toEqual(2);

		let ev=await channel.dispatch("build",{messages: []});
		expect(ev.messages).toContain("hello-peac here");
		expect(ev.messages).toContain("plugin2 here");
	});
});
