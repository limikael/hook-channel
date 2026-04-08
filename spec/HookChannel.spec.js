import {dirnameFromImportMeta} from "../src/node-util.js";
import path from "path";
import {loadHookChannel} from "../src/HookChannel.js";
import fs, {promises as fsp} from "fs";
import HookEvent from "../src/HookEvent.js";

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
			extraModuleDirs: path.join(__dirname,"basic/packages")
		});

		//console.log(channel.pkg);
		expect(channel.pkg.name).toEqual("basic");

		//console.log(channel.moduleFilenames);
		expect(channel.moduleFilenames[0]).toContain("hello-peac.js");

		//console.log(channel.listeners);
		expect(channel.listeners.build.length).toEqual(2);

		//let ev=await channel.dispatch(new HookEvent("build",{messages: []}));
		let ev=await channel.dispatch("build",{messages: []});
		expect(ev.messages).toContain("hello-peac here");
		expect(ev.messages).toContain("plugin2 here");
	});
});
