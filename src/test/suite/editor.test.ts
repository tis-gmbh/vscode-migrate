import { expect } from "chai";
import { toMatchUri } from "../../utils/uri";
import { applyChangesFor } from "../utils/apply";
import { createCoverageScheme, getChangedContentFor, getDecorationsFor, modifyContent, updateOf } from "../utils/editor";
import { actual, actualUri, expected } from "../utils/fs";
import { getFirstMatch, getNthMatchUriOf } from "../utils/tree";
import { Scenario } from "./scenario";

suite("Editor", () => {
    test("generates the change", async () => {
        await Scenario.load("singleFile", "Brackets");
        const firstMatch = getFirstMatch()!;
        const expectedNewContent = expected("src/main.ts");

        const actualNewContent = await getChangedContentFor(firstMatch);

        expect(actualNewContent).to.equal(expectedNewContent);
    });

    test("generates code coverage decorations", async () => {
        await Scenario.load("singleFile", "Brackets");

        const decorations = await getDecorationsFor(actualUri("src/main.ts"));

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

    test("updates content when another change was applied", async () => {
        await Scenario.load("applyWhileEdit", "Brackets");
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
        await Scenario.load("manualMerge", "Brackets");
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
        await Scenario.load("singleFile", "Brackets");
        const unchangedContent = actual("src/main.ts");
        const invalidMatchUri = toMatchUri(actualUri("src/main.ts"), "999999");

        const actualContent = await getChangedContentFor(invalidMatchUri);

        expect(actualContent).to.equal(unchangedContent);
    });
});
