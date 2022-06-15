import { inject, injectable } from "inversify";
import { VscExtensions, VSC_TYPES } from "../di/types";
import { API, GitExtension as VscGitExtension } from "./git";

@injectable()
export class GitExtension {
    private cachedApi?: API;

    public constructor(
        @inject(VSC_TYPES.VscExtensions) private readonly extensions: VscExtensions,
    ) { }

    public async getGitApi(): Promise<API> {
        return this.cachedApi || await this.fetchGitApi();
    }

    private async fetchGitApi(): Promise<API> {
        const extension = this.extensions.getExtension<VscGitExtension>("vscode.git");
        if (extension === undefined) {
            throw new Error("Git API not found");
        }

        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        this.cachedApi = gitExtension.getAPI(1);
        return this.cachedApi;
    }
}
