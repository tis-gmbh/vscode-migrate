import { readFileSync } from "fs";
import * as glob from "glob";
import { basename, join } from "path";
import { IMigration, Match, MatchedFile } from "./migrationTypes";

@Migration({
    name: "Brackets - Whole File As Single Change",
})
class BracketMigration implements IMigration {
    public getMatchedFiles(): MatchedFile[] {
        const originalPath = join(__dirname, "../../", "**/*.ts");
        const globPath = originalPath.replace(/\\/g, "/");
        const files = glob.sync(globPath);
        return files.map(file => {
            return {
                path: file,
                matches: this.getMatchesOf(file)
            }
        });
    }

    public getMatchesOf(filePath: string): Match[] {
        const content = readFileSync(filePath, { encoding: "utf-8" });
        const regexMatches = content.matchAll(/>>>(.+?)<<</g);

        let modifiedContent = content;
        for (const match of regexMatches) {
            // this only works because the replacement is exactly the same length as the match
            modifiedContent = modifiedContent.substring(0, match.index!)
                + `<<<${match[1]}>>>`
                + modifiedContent.substring(match.index! + match[1]!.length + 6);
        }

        if (content === modifiedContent) {
            return [];
        }

        return [{
            label: "all in " + basename(filePath),
            modifiedContent
        }];
    }
}
