import path = require("path");

export const workspaceFolder = path.join(__dirname, "..", "..");
export const testWorkspace = path.join(workspaceFolder, "testWorkspace");

/**
 * Recursive structure that lists folders/files and describes their contents.
 */
export interface IFileTree {
    [directoryOrFile: string]: string | string[] | Buffer | IFileTree;
}
