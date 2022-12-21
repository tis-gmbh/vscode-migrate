import { expect } from "chai";
import { stringify, toFileUri } from "../../utils/uri";
import { applyChangesFor, commits } from "../utils/apply";
import { modifyContent } from "../utils/editor";
import { actual, actualUri, expected } from "../utils/fs";
import { getFirstMatch } from "../utils/tree";
import { setModified, setUntracked } from "../utils/vcs";
import { Scenario } from "./scenario";

suite("Change Application", () => {
    test("applies a change", async () => {
        await Scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
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
        await Scenario.load("manualModification", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedContent = expected("src/main.ts");

        await modifyContent(firstMatch,
            content => content.replace("originalMatch", "Manually modified match"));
        await applyChangesFor(firstMatch);
        const actualContent = actual("src/main.ts");

        expect(actualContent).to.equal(expectedContent);
    });

    test("commits with custom commit message", async () => {
        await Scenario.load("singleFile", "Brackets - Custom Commit Message");
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
        await Scenario.load("twoFile", "Brackets");
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

});
