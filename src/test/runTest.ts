import { runTests } from "@vscode/test-electron";
import { mkdir } from "fs/promises";
import * as path from "path";
import { join } from "path";

async function main(): Promise<void> {
    try {
        const testWorkspace = join(__dirname, "../../src/test/fixtures/_testWorkspace");
        await mkdir(testWorkspace, { recursive: true });

        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace] });
    } catch (err) {
        console.error("Failed to run tests");
        process.exit(1);
    }
}

void main();
