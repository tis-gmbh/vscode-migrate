import { removeAllBreakpoints } from "../utils/process";
import { killProcess } from "../utils/process";

teardown(async function () {
    tryRemoveAllBreakpoints();
    await tryKillProcess();
    await scenario?.teardown();
    if (this.currentTest?.state === "failed") {
        scenario?.dumpLogs(this.currentTest.titlePath().join("-"));
    }
    (scenario as any) = undefined;
});

function tryRemoveAllBreakpoints(): void {
    try { removeAllBreakpoints(); } catch { }
}

async function tryKillProcess(): Promise<void> {
    try { await killProcess(); } catch { }
}
