import { injectable } from "inversify";
import { Extension, Uri } from "vscode";
import { stringify } from "../../utils/uri";
import { API, Change, GitExtension, Repository, Status } from "../../vcs/git";
import { AwaitEntryArray } from "../utils/awaitEntryArray";

export interface CommitRecord {
    message: string;
    changes: Array<{
        uri: string;
        status: "modified" | "added";
    }>;
}

@injectable()
export class GitExtensionStub implements Partial<Extension<GitExtension>> {
    public commitRecords = new AwaitEntryArray<CommitRecord>();
    private workingTreeChanges: Change[] = [];
    private scannedWorkingTreeChanges: Change[] = [];

    public activate(): Promise<GitExtension> {
        const self = this;
        return Promise.resolve({
            getAPI(): API {
                return {
                    getRepository(_uri: Uri): Repository {
                        return {
                            add: (paths: string[]) => {
                                paths.forEach(path => {
                                    if (!path) return;
                                    self.setUntracked(Uri.file(path));
                                });
                            },
                            commit: (message: string) => {
                                self.createCommit(message);
                                self.workingTreeChanges = [];
                            },
                            state: {
                                get workingTreeChanges() {
                                    return self.scannedWorkingTreeChanges;
                                }
                            },
                            status: () => {
                                self.scannedWorkingTreeChanges =
                                    JSON.parse(JSON.stringify(self.workingTreeChanges));
                                return Promise.resolve();
                            }
                        } as Partial<Repository> as Repository;
                    }
                } as Partial<API> as API;
            }
        } as Partial<GitExtension> as GitExtension);
    }

    private createCommit(message: string): void {
        const commitRecord: CommitRecord = {
            message,
            changes: this.workingTreeChanges.map(change => ({
                uri: stringify(change.uri),
                status: change.status === Status.MODIFIED ? "modified" : "added"
            }))
        };
        this.commitRecords.push(commitRecord);
    }

    public setModified(fileUri: Uri): void {
        this.workingTreeChanges.push({
            originalUri: fileUri,
            renameUri: fileUri,
            uri: fileUri,
            status: Status.MODIFIED
        });
    }

    public setUntracked(fileUri: Uri): void {
        this.workingTreeChanges.push({
            originalUri: fileUri,
            renameUri: fileUri,
            uri: fileUri,
            status: Status.UNTRACKED
        });
    }
}
