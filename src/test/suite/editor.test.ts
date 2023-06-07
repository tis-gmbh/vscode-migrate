import { expect } from "chai";
import { move } from "fs-extra";
import { TYPES } from "../../di/types";
import { CoverageDecorationProvider } from "../../providers/coverageDecorationProvider";
import { toMatchUri } from "../../utils/uri";
import { applyChangesFor } from "../utils/apply";
import { createCoverageScheme, getChangedContentFor, getDecorationsFor, modifyContent, updateOf } from "../utils/editor";
import { actual, actualPath, actualUri, expected } from "../utils/fs";
import { message } from "../utils/gui";
import { getFirstMatch, getNthMatchUriOf } from "../utils/tree";

suite("Editor", () => {
    test("generates the change", async () => {
        await scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedNewContent = expected("src/main.ts");

        const actualNewContent = await getChangedContentFor(firstMatch);

        expect(actualNewContent).to.equal(expectedNewContent);
    });

    test("generates code coverage decorations", async () => {
        await scenario.load("singleFile", "Brackets");


        const coverageUpdated = new Promise(res => scenario.get<CoverageDecorationProvider>(TYPES.CoverageDecorationProvider).onDecorationsChanged(res));
        await coverageUpdated;

        const decorations = getDecorationsFor(actualUri("src/main.ts"));
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

    test("updates code coverage decorations when coverage changes", async () => {
        await scenario.load("hiddenCoverage", "Brackets");

        const decorations = getDecorationsFor(actualUri("src/firstFile.ts"));
        expect(decorations).to.deep.equal([]);

        const coverageUpdated = new Promise(res => scenario.get<CoverageDecorationProvider>(TYPES.CoverageDecorationProvider).onDecorationsChanged(res));
        await move(actualPath("coverage/hidden_lcov.info"), actualPath("coverage/lcov.info"));
        await coverageUpdated;

        const updatedDecorations = getDecorationsFor(actualUri("src/firstFile.ts"));
        expect(updatedDecorations).to.deep.equal(createCoverageScheme([
            1,
            null,
            1,
            null,
            null,
            null,
            0,
            null,
            null,
            null,
            null,
            null
        ]));
    });

    test("updates content when another change was applied", async () => {
        await scenario.load("applyWhileEdit", "Brackets");
        const secondMatch = getNthMatchUriOf(actualUri("src/main.ts"), 2);
        await getChangedContentFor(secondMatch);

        const secondFileUpdate = updateOf(secondMatch);
        await applyChangesFor(getFirstMatch());
        await secondFileUpdate;

        const updatedContent: string = await getChangedContentFor(secondMatch);
        const expectedContent: string = expected("src/main.ts");
        expect(updatedContent).to.deep.equal(expectedContent);
    });

    test("merges manual modifications with updates from disk", async () => {
        await scenario.load("manualMerge", "Brackets");
        const secondMatch = getNthMatchUriOf(actualUri("src/main.ts"), 2);
        await modifyContent(secondMatch, original => original.replace(
            "No match", "manual modification"
        ));

        const secondFileUpdate = updateOf(secondMatch);
        await applyChangesFor(getFirstMatch());
        await secondFileUpdate;

        const updatedContent: string = await getChangedContentFor(secondMatch);
        const expectedContent: string = expected("src/main.ts");
        expect(updatedContent).to.deep.equal(expectedContent);
    });

    test("shows identical file when match isn't found", async () => {
        await scenario.load("singleFile", "Brackets");
        const unchangedContent = actual("src/main.ts");
        const invalidMatchUri = toMatchUri(actualUri("src/main.ts"), "999999");

        const actualContent = await getChangedContentFor(invalidMatchUri);

        expect(actualContent).to.equal(unchangedContent);
    });

    test("logs, why coverage is unavailable", async () => {
        await scenario.load("twoFile", "Brackets");

        await expect(message({
            level: "warn",
            message: "VSCode Migrate is much more useful with coverage info, but was unable to find any at 'coverage/lcov.info'."
        })).to.eventually.exist;
    });
});
