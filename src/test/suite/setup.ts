import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { Scenario } from "./scenario";

chai.use(chaiAsPromised);

setup(async function () {
    scenario = new Scenario();
});

teardown(async function () {
    if (this.currentTest?.state === "failed") {
        scenario?.dumpLogs(this.currentTest.titlePath().join("-"));
    }

    await tryKillProcess();
    await scenario?.teardown();
    (scenario as any) = undefined;
});

async function tryKillProcess(): Promise<void> {
    try { await hardKillProcess(); } catch { }
}

async function hardKillProcess(): Promise<void> {
    const controller = scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController);
    await controller.kill();
}
