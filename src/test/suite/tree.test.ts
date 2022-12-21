import { expect } from "chai";
import { stringify, toFileUri, toMatchUri } from "../../utils/uri";
import { applyAllFor, applyChangesFor } from "../utils/apply";
import { commandRecords } from "../utils/commands";
import { actualUri } from "../utils/fs";
import { progressRecords, treeUpdates } from "../utils/gui";
import { stopMigration } from "../utils/process";
import { clickTreeItem, getDisplayedTree, getFirstMatch, getTreeItemsOfUri } from "../utils/tree";
import { Scenario } from "./scenario";

suite("Tree", () => {
    test("shows matches", async () => {
        await Scenario.load("twoFile", "Brackets");

        expect(progressRecords()).to.deep.contain({
            messages: ["Finding files..."],
            done: true
        });
        expect(progressRecords()).to.deep.contain({
            messages: ["Creating migration", "Fetching matches"],
            done: true
        });
        expect(commandRecords()).to.deep.contain({
            id: "vscode-migrate.queued-matches.focus",
            args: [],
            result: undefined
        });

        const actualTree = await getDisplayedTree();
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
        expect(treeUpdates()).to.deep.equal([[undefined]]);
    });

    test("is updated when change was applied", async () => {
        await Scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedTree = {
            "main.ts": [
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ]
        };

        await applyChangesFor(firstMatch);

        const actualTree = await getDisplayedTree();
        expect(actualTree).to.deep.equal(expectedTree);
        expect(treeUpdates()).to.deep.contain([[stringify(toFileUri(firstMatch))]]);
    });

    test("removes file when all changes have been applied", async () => {
        await Scenario.load("twoFile", "Brackets");
        const filePath = actualUri("src/firstFile.ts");
        const expectedTree = {
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };

        await applyAllFor(filePath);

        const actualTree = await getDisplayedTree();
        expect(actualTree).to.deep.equal(expectedTree);
        expect(treeUpdates()).to.deep.contain([undefined]);
    });

    test("opens diff when tree item is selected", async () => {
        await Scenario.load("singleFile", "Brackets");
        const fileUri = actualUri("src/main.ts");
        const expectedLeftUri = stringify(fileUri);
        const expectedRightUri = stringify(toMatchUri(fileUri, "0"));

        const firstTreeItem = (await getTreeItemsOfUri(fileUri))[0]!;
        await clickTreeItem(firstTreeItem);

        expect(commandRecords()).to.deep.contain({
            id: "vscode.diff",
            args: [expectedLeftUri, expectedRightUri, "main.ts: >>>First match<<<"],
            result: undefined
        });
    });

    test("is cleared when migration is stopped", async () => {
        await Scenario.load("singleFile", "Brackets");

        await stopMigration();

        const actualTree = await getDisplayedTree();
        const expectedTree = {};
        expect(actualTree).to.deep.equal(expectedTree);
    });
});
