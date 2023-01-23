import { expect } from "chai";
import { TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { stringify, toFileUri } from "../../utils/uri";
import { applyAllFor, applyChangesFor, commits } from "../utils/apply";
import { commandRecords } from "../utils/commands";
import { modifyContent } from "../utils/editor";
import { actual, actualUri, expected } from "../utils/fs";
import { getFirstMatch, getNthMatchUriOf } from "../utils/tree";
import { setModified, setUntracked } from "../utils/vcs";

suite("Change Application", () => {
    test("applies a change", async () => {
        await scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
        const secondMatch = getNthMatchUriOf(toFileUri(firstMatch), 2)!;
        await applyChangesFor(firstMatch);
        const expectedNewContent = expected("src/main.ts");

        const actualNewContent = actual("src/main.ts");

        expect(actualNewContent).to.equal(expectedNewContent);
        expect(commits()).to.deep.equal([{
            message: `(Auto) Migration 'Brackets' for 'src/main.ts' labeled '>>>First match<<<'`,
            changes: [{
                uri: stringify(toFileUri(firstMatch)),
                status: "modified",
            }]
        }]);

        expect(commandRecords()).to.deep.include({
            id: "vscode.diff",
            args: [
                stringify(toFileUri(secondMatch)),
                stringify(secondMatch),
                "main.ts: >>>Second match<<<"
            ],
            result: undefined
        });
    });

    test("applies change that was manually modified", async () => {
        await scenario.load("manualModification", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedContent = expected("src/main.ts");

        await modifyContent(firstMatch,
            content => content.replace("originalMatch", "Manually modified match"));
        await applyChangesFor(firstMatch);
        const actualContent = actual("src/main.ts");

        expect(actualContent).to.equal(expectedContent);
    });

    test("commits with custom commit message", async () => {
        await scenario.load("singleFile", "Brackets - Custom Commit Message");
        const firstMatch = getFirstMatch();

        await applyChangesFor(firstMatch);

        expect(commits()).to.deep.equal([{
            message: `Migration 'Brackets - Custom Commit Message' for 'src/main.ts' labeled '>>>First match<<<' but the commit message is custom`,
            changes: [{
                uri: stringify(toFileUri(firstMatch)),
                status: "modified",
            }]
        }]);
    });

    test("commits all modified and untracked files", async () => {
        await scenario.load("twoFile", "Brackets");
        const firstMatch = getFirstMatch();
        const secondUri = actualUri("src/secondFile.ts");
        const thirdUri = actualUri("src/newlyAddedFile.ts");

        setModified(secondUri);
        setUntracked(thirdUri);

        await applyChangesFor(firstMatch);

        expect(commits()).to.deep.equal([{
            message: `(Auto) Migration 'Brackets' for 'src/firstFile.ts' labeled '>>>First match<<<'`,
            changes: [{
                uri: stringify(secondUri),
                status: "modified",
            }, {
                uri: stringify(thirdUri),
                status: "added",
            }, {
                uri: stringify(toFileUri(firstMatch)),
                status: "modified",
            }]
        }]);
    });

    test("kills process if all matches have been applied", async () => {
        await scenario.load("singleFile", "Brackets");

        await applyAllFor(actualUri("src/main.ts"));

        const migrationScriptProcess = scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController);
        expect(migrationScriptProcess.isRunning).to.be.false;
    });
});
