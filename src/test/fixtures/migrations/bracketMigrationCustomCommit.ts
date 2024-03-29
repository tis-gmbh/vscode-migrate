import { readFileSync } from "fs";
import * as glob from "glob";
import { join, relative, resolve } from "path";
import { CommitInfo, IMigration, Match, MatchedFile } from "./migrationTypes";

@Migration({
    name: "Brackets - Custom Commit Message"
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
        const matches: Match[] = [];
        for (const match of regexMatches) {
            const content = readFileSync(filePath, { encoding: "utf-8" });
            const modifiedContent = content.substring(0, match.index!)
                + `<<<${match[1]}>>>`
                + content.substring(match.index! + match[1]!.length + 6);

            matches.push({
                label: match[0]!,
                modifiedContent
            });
        }
        return matches;
    }

    public getCommitMessage(commitInfo: CommitInfo): string {
        const relativePath = relative(resolve(__dirname, "../.."), commitInfo.filePath);
        const normalizedPath = relativePath.replace(/\\/g, "/");
        return `Migration 'Brackets - Custom Commit Message' for '${normalizedPath}' labeled '${commitInfo.matchLabel}' but the commit message is custom`
    }
}
