import { expect } from "chai";
import { TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { matches } from "../../utils/matches";
import { stringify, toFileUri } from "../../utils/uri";
import { applyAllFor, applyChangesFor, applyWellCoveredMatches, commits } from "../utils/apply";
import { modifyContent } from "../utils/editor";
import { actual, actualUri, expected } from "../utils/fs";
import { message, progress, progressRecords } from "../utils/gui";
import { getFirstMatch, getNthMatchUriOf, wellCoveredMatchesReady } from "../utils/tree";
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

    test("shows queue notification if another match is applied when the previous application isn't done yet", async () => {
        await scenario.load("twoFile", "Brackets - Never Resolve Verify");

        void applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 1));
        void applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 2));

        await expect(message({
            message: "Failed to apply. Reason: Previous execution is still running.",
            level: "error"
        })).to.eventually.exist;
    });

    test("does not show queue notification if another match is applied when the previous application is already done", async () => {
        await scenario.load("twoFile", "Brackets");

        await applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 1));
        await applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 2));

        expect(progressRecords().filter(record => matches(record, {
            messages: [
                "Saving File",
                "Running verification tasks",
                "Committing file"
            ],
            done: true
        }))).to.have.lengthOf(2);
    });

    test("shows error notification if another match is applied when the previous application of well covered matches isn't done yet", async () => {
        await scenario.load("covered", "Brackets - Never Resolve Verify");

        await wellCoveredMatchesReady();
        void applyWellCoveredMatches();

        await progress(entry => entry.messages.includes("Running verification tasks"));

        void applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 2));

        await expect(message({
            message: "Failed to apply. Reason: Previous execution is still running.",
            level: "error"
        })).to.eventually.exist;
    });

    test("shows error notification if well covered matches are applied when a previous application isn't done yet", async () => {
        await scenario.load("covered", "Brackets - Never Resolve Verify");

        await wellCoveredMatchesReady();
        void applyChangesFor(getNthMatchUriOf(actualUri("src/firstFile.ts"), 2));

        await progress(entry => entry.messages.includes("Running verification tasks"));

        void applyWellCoveredMatches();

        await expect(message({
            message: "Failed to apply. Reason: Previous execution is still running.",
            level: "error"
        })).to.eventually.exist;
    });
});
