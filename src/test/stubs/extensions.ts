import { inject, injectable } from "inversify";
import { Extension, extensions } from "vscode";
import { VscExtensions } from "../../di/types";
import { TEST_TYPES } from "../types";
import { GitExtensionStub } from "./gitExtension";

@injectable()
export class ExtensionsStub implements VscExtensions {
    public constructor(
        @inject(TEST_TYPES.GitExtension) private readonly gitExtensionStub: GitExtensionStub,
    ) { }

    public getExtension<T>(extensionId: string): Extension<T> | undefined {
        if (extensionId === "vscode.git") {
            return this.gitExtensionStub as Partial<Extension<T>> as Extension<T>;
        }

        return extensions.getExtension(extensionId);
    }
}
