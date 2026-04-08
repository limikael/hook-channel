import {readPackageUp} from "read-package-up";

export default class HookChannel {
	constructor({keyword, exportPath, cwd}) {
		this.cwd=cwd;
	}

	async load() {
		this.pkg=await readPackageUp({cwd: this.cwd});
		//console.log(pkg);
	}
}