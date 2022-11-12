import { expect } from "chai";
import { Position, Range } from "vscode";
import { fileUriToFsPath, stringify, toFileUri, toMatchUri } from "../../utils/uri";
import { createCoverageScheme, Scenario } from "./scenario";

suite("VSCode Migrate", () => {
    let scenario: Scenario;

    teardown(function () {
        if (this.currentTest?.state === "failed") {
            scenario?.dumpLogs();
        }
        (scenario as any) = undefined;
    });

    test("shows matches", async () => {
        scenario = await Scenario.load("twoFile", "Brackets");
        const actualTree = await scenario.getDisplayedTree();
        const expectedTree = {
            "firstFile.ts": [
                `>>>First match<<<`,
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };

        expect(actualTree).to.deep.equal(expectedTree);
        expect(scenario.treeUpdates).to.deep.equal([[undefined]]);
    });

    test("generates the change", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");
        const firstMatch = scenario.getFirstMatch()!;
        const expectedNewContent = scenario.expected("src/main.ts");

        const actualNewContent = await scenario.getChangedContentFor(firstMatch);

        expect(actualNewContent).to.equal(expectedNewContent);
    });

    test("generates code coverage decorations", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");

        const decorations = await scenario.getDecorationsFor(scenario.actualUri("src/main.ts"));

        expect(decorations).to.deep.equal(createCoverageScheme([
            1,
            1,
            1,
            null,
            null,
            1,
            0,
            0,
            0,
            null,
            1,
            null
        ]));
    });

    test("applies a change", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");
        const firstMatch = scenario.getFirstMatch()!;
        await scenario.applyChangesFor(firstMatch);
        const expectedNewContent = scenario.expected("src/main.ts");

        const actualNewContent = scenario.actual("src/main.ts");

        expect(actualNewContent).to.equal(expectedNewContent);
        expect(scenario.stagedPaths).to.deep.contain([toFileUri(firstMatch).fsPath]);
        expect(scenario.commitMessages).to.deep.equal([
            `(Auto) Migration 'Brackets' for 'src/main.ts' labeled '>>>First match<<<'`
        ]);
    });

    test("updates matches when change was applied", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");
        const firstMatch = scenario.getFirstMatch()!;
        const expectedTree = {
            "main.ts": [
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ]
        };

        await scenario.applyChangesFor(firstMatch);

        const actualTree = await scenario.getDisplayedTree();
        expect(actualTree).to.deep.equal(expectedTree);
        expect(scenario.treeUpdates).to.deep.contain([[stringify(toFileUri(firstMatch))]]);
    });

    test("removes file from tree when all changes have been applied", async () => {
        scenario = await Scenario.load("twoFile", "Brackets");
        const filePath = scenario.actualUri("src/firstFile.ts");
        const expectedTree = {
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };

        await scenario.applyAllFor(filePath);

        const actualTree = await scenario.getDisplayedTree();
        expect(actualTree).to.deep.equal(expectedTree);
        expect(scenario.treeUpdates).to.deep.contain([undefined]);
    });

    test("saves change that was manually modified", async () => {
        scenario = await Scenario.load("manualModification", "Brackets");
        const firstMatch = scenario.getFirstMatch()!;
        const expectedContent = scenario.expected("src/main.ts");

        await scenario.modifyContent(firstMatch,
            content => content.replace("originalMatch", "Manually modified match"));
        await scenario.applyChangesFor(firstMatch);
        const actualContent = scenario.actual("src/main.ts");

        expect(actualContent).to.equal(expectedContent);
    });

    test("updates content of editor when another change was applied", async () => {
        scenario = await Scenario.load("applyWhileEdit", "Brackets");
        const secondMatch = scenario.getNthMatchUriOf(scenario.actualUri("src/main.ts"), 2);
        await scenario.getChangedContentFor(secondMatch);

        const secondFileUpdate = scenario.updateOf(secondMatch);
        await scenario.applyChangesFor(scenario.getFirstMatch());
        await secondFileUpdate;

        const updatedContent: string = await scenario.getChangedContentFor(secondMatch);
        const expectedContent: string = scenario.expected("src/main.ts");
        expect(updatedContent).to.deep.equal(expectedContent);
    });

    test("merges manual modifications with updates from disk", async () => {
        scenario = await Scenario.load("manualMerge", "Brackets");
        const secondMatch = scenario.getNthMatchUriOf(scenario.actualUri("src/main.ts"), 2);
        await scenario.modifyContent(secondMatch, original => original.replace(
            "No match", "manual modification"
        ));

        const secondFileUpdate = scenario.updateOf(secondMatch);
        await scenario.applyChangesFor(scenario.getFirstMatch());
        await secondFileUpdate;

        const updatedContent: string = await scenario.getChangedContentFor(secondMatch);
        const expectedContent: string = scenario.expected("src/main.ts");
        expect(updatedContent).to.deep.equal(expectedContent);
    });

    test("opens diff when tree item is selected", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");
        const fileUri = scenario.actualUri("src/main.ts");
        const firstTreeItem = (await scenario.getTreeItemsOfUri(fileUri))[0]!;
        const command = firstTreeItem.command!;

        const actualLeftUri = stringify(command?.arguments![0]!);
        const actualRightUri = stringify(command?.arguments![1]!);
        const expectedLeftUri = stringify(fileUri);
        const expectedRightUri = stringify(toMatchUri(fileUri, "0"));
        expect(actualLeftUri).to.equal(expectedLeftUri);
        expect(actualRightUri).to.equal(expectedRightUri);
    });

    test("shows identical file when match isn't found", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");
        const unchangedContent = scenario.actual("src/main.ts");
        const invalidMatchUri = toMatchUri(scenario.actualUri("src/main.ts"), "999999");

        const actualContent = await scenario.getChangedContentFor(invalidMatchUri);

        expect(actualContent).to.equal(unchangedContent);
    });

    test("commits with custom commit message", async () => {
        scenario = await Scenario.load("singleFile", "Brackets - Custom Commit Message");
        const firstMatch = scenario.getFirstMatch();

        await scenario.applyChangesFor(firstMatch);

        expect(scenario.commitMessages).to.deep.equal([
            `Migration 'Brackets - Custom Commit Message' for 'src/main.ts' labeled '>>>First match<<<' but the commit message is custom`
        ]);
    });

    test("commits all modified and untracked files", async () => {
        scenario = await Scenario.load("twoFile", "Brackets");
        const firstMatch = scenario.getFirstMatch();

        scenario.setModified(scenario.actualUri("src/secondFile.ts"));
        scenario.setUntracked(scenario.actualUri("src/newlyAddedFile.ts"));

        await scenario.applyChangesFor(firstMatch);

        expect(scenario.stagedPaths[0]).to.contain(fileUriToFsPath(toFileUri(firstMatch)));
        expect(scenario.stagedPaths[0]).to.contain(scenario.actualPath("src/secondFile.ts"));
        expect(scenario.stagedPaths[0]).to.contain(scenario.actualPath("src/newlyAddedFile.ts"));
    });

    test("debugs migration script process", async () => {
        scenario = await Scenario.load("singleFile");

        const breakPointHold = scenario.waitForBreakpointHit();
        await scenario.addBreakpoint(
            scenario.actualUri(".vscode/migrations/bracketMigration.ts"),
            new Position(11, 9)
        );
        await scenario.startDebugging();
        void scenario.startMigration("Brackets");

        const breakpoint = await breakPointHold;
        expect(breakpoint.location.range).to.deep.equal(new Range(new Position(11, 9), new Position(11, 9)));
        expect(stringify(breakpoint.location.uri))
            .to.equal(stringify(scenario.actualUri(".vscode/migrations/bracketMigration.ts")));
    });

    test("stops migration script debugging", async () => {
        scenario = await Scenario.load("singleFile");

        const breakPointHold = scenario.waitForBreakpointHit();
        await scenario.addBreakpoint(
            scenario.actualUri(".vscode/migrations/bracketMigration.ts"),
            new Position(11, 9)
        );
        await scenario.startDebugging();
        const migrationStarted = scenario.startMigration("Brackets");

        await breakPointHold;

        await scenario.stopDebugging();
        await migrationStarted;
        const actualTree = await scenario.getDisplayedTree();
        const expectedTree = {
            "main.ts": [
                `>>>First match<<<`,
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ]
        };

        expect(actualTree).to.deep.equal(expectedTree);
    });

    test("stops migration", async () => {
        scenario = await Scenario.load("singleFile", "Brackets");

        await scenario.stopMigration();

        const actualTree = await scenario.getDisplayedTree();
        const expectedTree = {};
        expect(actualTree).to.deep.equal(expectedTree);
    });
});
