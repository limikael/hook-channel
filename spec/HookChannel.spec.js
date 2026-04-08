import {dirnameFromImportMeta} from "../src/node-util.js";
import path from "path";
import HookChannel from "../src/HookChannel.js";

let __dirname=dirnameFromImportMeta(import.meta);

describe("HookChannel",()=>{
	it("can load",async ()=>{
		let channel=new HookChannel({cwd: path.join(__dirname,"basic")});
		await channel.load();

		expect(channel.pkg.packageJson.name).toEqual("basic");
	});
});
