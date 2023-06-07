import { config as chaiConfig } from "chai";
import * as glob from "glob";
import * as Mocha from "mocha";
import * as path from "path";
import { Scenario } from "./scenario";

declare global {
    var scenario: Scenario;
}

declare module globalThis {
    var scenario: Scenario;
}

async function setupCoverage(): Promise<any> {
    const nycConfig = {
        all: false,
        cwd: path.resolve(__dirname, "..", ".."),
        exclude: ["**/test/**", ".vscode-test/**", "**/**.test.*s"],
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
        reporter: ["text", "html", "lcov", "json-summary"],
        reportDir: path.resolve(__dirname, "..", "..", "..", "coverage"),
        useSpawnWrap: true
    };

    const sw = require("spawn-wrap");
    const wrapper = require.resolve("./wrap.js");
    sw([wrapper], {
        NYC_CONFIG: JSON.stringify(nycConfig),
        NYC_CWD: process.cwd()
    });

    const NYC = require("nyc");
    const nyc = new NYC(nycConfig);

    await nyc.reset().catch(() => { });
    nyc.wrap();

    return nyc;
}

export async function run(): Promise<void> {
    let nyc: any;

    if (process.env.COVERAGE) {
        nyc = await setupCoverage();
    }

    // Create the mocha test
    const mocha = new Mocha({
        ui: "tdd",
        color: true,
        timeout: 15000,
        slow: 4000
    });

    chaiConfig.truncateThreshold = 0;
    globalThis.scenario = undefined as any as Scenario;

    const testsRoot = path.resolve(__dirname, "..");
    mocha.addFile(path.resolve(testsRoot, "suite/setup.js"));

    for (const file of glob.sync("**/**.test.js", { cwd: testsRoot })) {
        mocha.addFile(path.resolve(testsRoot, file));
    }

    try {
        await new Promise((resolve, reject) => {
            mocha.run((failures) => {
                failures > 0
                    ? reject(new Error(`${failures} tests failed.`))
                    : resolve(undefined);
            });
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        throw err;
    } finally {
        // eslint-disable-next-line no-console
        console.log("Done running tests");
        if (nyc) {
            nyc.writeCoverageFile();
            await nyc.report();
        }
    }
}
