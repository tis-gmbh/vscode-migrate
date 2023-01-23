import { runTests } from "@vscode/test-electron";
import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import { join, resolve } from "path";


async function main(): Promise<void> {
    try {
        await createCoverConfig();
        const testWorkspace = await createTestWorkspace();

        const extensionDevelopmentPath = path.resolve(__dirname, "../../");
        const extensionTestsPath = path.resolve(__dirname, "./suite/");

        await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace] });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to run tests");
        process.exit(1);
    }
}

async function createTestWorkspace(): Promise<string> {
    const testWorkspace = join(__dirname, "../../src/test/fixtures/_testWorkspace");
    await mkdir(testWorkspace, { recursive: true });
    return testWorkspace;
}

async function createCoverConfig(): Promise<void> {
    const stringifiedConfig = JSON.stringify(getCoverConfig());
    await writeFile(
        resolve("./out/coverConfig.json"),
        stringifiedConfig
    );
}

function getCoverConfig(): Record<string, any> {
    if (process.argv.includes("--coverage")) {
        return {
            enabled: true,
            relativeSourcePath: "../..",
            relativeCoverageDir: "../../../coverage",
            ignorePatterns: [
                "**/node_modules/**",
                "**/test/**"
            ],
            reports: [
                "cobertura",
                "lcov",
                "json"
            ],
            verbose: false,
            remapOptions: {
                "basePath": "..",
                "useAbsolutePaths": true
            }
        };
    } else {
        return {
            enabled: false,
            relativeSourcePath: "../..",
        };
    }
}

void main();
