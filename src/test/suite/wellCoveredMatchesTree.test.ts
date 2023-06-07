import { expect } from "chai";
import { move } from "fs-extra";
import { stringify } from "../../utils/uri";
import { applyChangesFor, applyWellCoveredMatches, commit } from "../utils/apply";
import { commandRecord } from "../utils/commands";
import { actual, actualPath, actualUri, expected } from "../utils/fs";
import { getFirstMatch, getWellCoveredMatchesTree, wellCoveredMatchesTree, wellCoveredTreeUpdate } from "../utils/tree";

suite("Well Covered Matches Tree", () => {
    test("shows full tree if all matches are covered", async () => {
        await scenario.load("fullCoverage", "Brackets");

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
        await expect(wellCoveredMatchesTree(expectedTree)).to.eventually.exist;
        await expect(commandRecord({
            id: "setContext",
            args: ["vscode-migrate.hasWellCoveredMatches", true],
            result: undefined
        })).to.eventually.exist;
    });

    test("shows only well covered matches", async () => {
        await scenario.load("covered", "Brackets");

        const expectedTree = {
            "firstFile.ts": [
                `>>>First match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };
        await expect(wellCoveredMatchesTree(expectedTree)).to.eventually.exist;
    });

    test("is updated when coverage is added", async () => {
        await scenario.load("hiddenCoverage", "Brackets");

        await move(actualPath("coverage/hidden_lcov.info"), actualPath("coverage/lcov.info"));

        await expect(wellCoveredMatchesTree({
            "firstFile.ts": [
                `>>>First match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        })).to.eventually.exist;
        await expect(wellCoveredTreeUpdate([undefined])).to.eventually.exist;
    });

    test("is updated when coverage changes", async () => {
        await scenario.load("hiddenCoverage", "Brackets");

        await move(actualPath("coverage/hidden_lcov.info"), actualPath("coverage/lcov.info"));

        await expect(wellCoveredMatchesTree({
            "firstFile.ts": [
                `>>>First match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        })).to.eventually.exist;

        await move(actualPath("coverage/hidden_full_lcov.info"), actualPath("coverage/lcov.info"), { overwrite: true });

        await expect(wellCoveredMatchesTree({
            "firstFile.ts": [
                `>>>First match<<<`,
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        })).to.eventually.exist;
        await expect(wellCoveredTreeUpdate([[stringify(actualUri("src/firstFile.ts"))]])).to.eventually.exist;
    });

    test("is updated when change was applied", async () => {
        await scenario.load("covered", "Brackets");

        const expectedInitialTree = {
            "firstFile.ts": [
                `>>>First match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };
        await expect(wellCoveredMatchesTree(expectedInitialTree)).to.eventually.exist;

        const firstMatch = getFirstMatch();
        const expectedTree = {
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        };

        await applyChangesFor(firstMatch);

        await expect(wellCoveredMatchesTree(expectedTree)).to.eventually.exist;
        await expect(wellCoveredTreeUpdate([undefined])).to.eventually.exist;
    });

    test("applies multiple well covered matches per file when the command is chosen", async () => {
        await scenario.load("fullCoverage", "Brackets");

        await expect(wellCoveredMatchesTree({
            "firstFile.ts": [
                `>>>First match<<<`,
                `>>>Second match<<<`,
                `>>>Third match<<<`
            ],
            "secondFile.ts": [
                `>>>Second file match<<<`
            ]
        })).to.eventually.exist;
        await applyWellCoveredMatches();

        await expect(getWellCoveredMatchesTree()).to.eventually.deep.equal({});

        await expect(commit({
            message: `Batch application of 4 well covered matches for migration 'Brackets'`
        })).to.eventually.exist;
        const expectedContentFirstFile = expected("src/firstFile.ts");
        const expectedContentSecondFile = expected("src/secondFile.ts");
        const actualContentFirstFile = actual("src/firstFile.ts");
        const actualContentSecondFile = actual("src/secondFile.ts");
        expect(actualContentFirstFile).to.equal(expectedContentFirstFile);
        expect(actualContentSecondFile).to.equal(expectedContentSecondFile);
    });

    test("is empty when there are no well covered matches", async () => {
        await scenario.load("hiddenCoverage", "Brackets");

        expect(await getWellCoveredMatchesTree()).to.deep.equal({});
        await expect(commandRecord({
            id: "setContext",
            args: ["vscode-migrate.hasWellCoveredMatches", false],
            result: undefined
        })).to.eventually.exist;
    });

    test("treats partially covered matches as uncovered", async () => {
        await scenario.load("covered", "Brackets - Whole File As Single Change");

        const expectedTree = {
            "secondFile.ts": [
                `all in secondFile.ts`
            ]
        };

        await expect(wellCoveredMatchesTree(expectedTree)).to.eventually.exist;
    });
});
