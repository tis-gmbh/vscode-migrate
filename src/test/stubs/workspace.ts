import { injectable } from "inversify";
import { Disposable, workspace } from "vscode";
import { VscWorkspace } from "../../di/types";

@injectable()
export class WorkspaceStub implements VscWorkspace {
    public registerFileSystemProvider(): Disposable {
        return new Disposable(() => { });
    }

    public fs = workspace.fs;
    public textDocuments = workspace.textDocuments;
    public createFileSystemWatcher = workspace.createFileSystemWatcher;
    public findFiles = workspace.findFiles;
    public asRelativePath = workspace.asRelativePath;
    public workspaceFolders = workspace.workspaceFolders;
}
