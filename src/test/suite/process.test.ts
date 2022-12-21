import { expect } from "chai";
import { Position, Range } from "vscode";
import { stringify } from "../../utils/uri";
import { actualUri } from "../utils/fs";
import { startMigration } from "../utils/process";
import { addBreakpoint, restartProcess, startDebugging, stopDebugging, waitForBreakpointHit } from "../utils/process";
import { getDisplayedTree } from "../utils/tree";
import { Scenario } from "./scenario";

suite("Migration Script Process", () => {
    test("can be debugged", async () => {
        await Scenario.load("singleFile");

        await startDebugging();
        const breakPointHold = waitForBreakpointHit();
        addBreakpoint(
            actualUri(".vscode/migrations/bracketMigration.ts"),
            new Position(11, 9)
        );
        void startMigration("Brackets");

        const breakpoint = await breakPointHold;
        expect(breakpoint.location.range).to.deep.equal(new Range(new Position(11, 9), new Position(11, 9)));
        expect(stringify(breakpoint.location.uri))
            .to.equal(stringify(actualUri(".vscode/migrations/bracketMigration.ts")));
    });

    test("can be stopped debugging", async () => {
        await Scenario.load("singleFile");

        const breakPointHold = waitForBreakpointHit();
        addBreakpoint(
            actualUri(".vscode/migrations/bracketMigration.ts"),
            new Position(11, 9)
        );
        await startDebugging();
        const migrationStarted = startMigration("Brackets");

        await breakPointHold;

        await stopDebugging();
        await migrationStarted;
        const actualTree = await getDisplayedTree();
        const expectedTree = {
            "main.ts": [
                `>>>First match<<<`,
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ]
        };

        expect(actualTree).to.deep.equal(expectedTree);
    });

    test("clears migration when restarted", async () => {
        await Scenario.load("singleFile", "Brackets");

        await restartProcess();

        const actualTree = await getDisplayedTree();
        const expectedTree = {};
        expect(actualTree).to.deep.equal(expectedTree);
    });
});
