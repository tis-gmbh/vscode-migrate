import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { AwaitEntryArray } from "../utils/awaitEntryArray";
import { Scenario } from "./scenario";

chai.use(chaiAsPromised);

setup(function () {
    scenario = new Scenario();
});

teardown(async function () {
    const unresolvedAwaitArrays = AwaitEntryArray.instances.filter(instance => instance.awaitedCriteria.length > 0);
    if (unresolvedAwaitArrays.length > 0) {
        let message = "Records matching the following criteria were awaited, but never met. If this test failed due to a timeout, this is likely the cause. If the test didn't fail, you're probably missing an await.\n";
        for (const instance of unresolvedAwaitArrays) {
            message += `Awaited: ${JSON.stringify(instance.awaitedCriteria, null, 2)}\n`
                + ` in ${JSON.stringify(instance, null, 2)}\n`;

        }
        // eslint-disable-next-line no-console
        console.warn(message);
        scenario.log(message);
        AwaitEntryArray.instances = [];
    }

    const logDumper = scenario.getLogDumper(this.currentTest!.titlePath().join("-"));

    await tryKillProcess();
    await scenario.teardown();

    if (this.currentTest?.state === "failed") {
        logDumper();
    }
    (scenario as any) = undefined;
});

async function tryKillProcess(): Promise<void> {
    try { await hardKillProcess(); } catch { }
}

async function hardKillProcess(): Promise<void> {
    const controller = scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController);
    await controller.kill();
}
