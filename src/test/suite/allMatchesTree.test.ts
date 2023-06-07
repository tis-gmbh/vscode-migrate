import { expect } from "chai";
import { stringify, toFileUri, toMatchUri } from "../../utils/uri";
import { applyAllFor, applyChangesFor } from "../utils/apply";
import { commandRecords } from "../utils/commands";
import { actualUri } from "../utils/fs";
import { progressRecords } from "../utils/gui";
import { stopMigration } from "../utils/process";
import { allMatchesTree, allTreeUpdate, clickTreeItem, getAllMatchesTree, getFirstMatch, getTreeItemsOfUri } from "../utils/tree";

suite("All Matches Tree", () => {
    test("shows matches", async () => {
        await scenario.load("twoFile", "Brackets");

        expect(progressRecords()).to.deep.contain({
            messages: ["Finding files..."],
            done: true
        });
        expect(progressRecords()).to.deep.contain({
            messages: ["Creating migration", "Fetching matches"],
            done: true
        });
        expect(commandRecords()).to.deep.contain({
            id: "vscode-migrate.all-matches.focus",
            args: [],
            result: undefined
        });

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

        await expect(allMatchesTree(expectedTree)).to.eventually.exist;
        await expect(allTreeUpdate([undefined])).to.eventually.exist;
    });

    test("is updated when change was applied", async () => {
        await scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedTree = {
            "main.ts": [
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ]
        };

        await applyChangesFor(firstMatch);

        await expect(allMatchesTree(expectedTree)).to.eventually.exist;
        await expect(allTreeUpdate([[stringify(toFileUri(firstMatch))]])).to.eventually.exist;
    });

    test("removes file when all changes have been applied", async () => {
        await scenario.load("twoFile", "Brackets");
        const filePath = actualUri("src/firstFile.ts");
        const expectedTree = {
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };

        await applyAllFor(filePath);

        await expect(allMatchesTree(expectedTree)).to.eventually.exist;
        await expect(allTreeUpdate([undefined])).to.eventually.exist;
    });

    test("opens diff when tree item is selected", async () => {
        await scenario.load("singleFile", "Brackets");
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
        await scenario.load("singleFile", "Brackets");

        await stopMigration();

        const actualTree = await getAllMatchesTree();
        const expectedTree = {};
        expect(actualTree).to.deep.equal(expectedTree);
    });
});
