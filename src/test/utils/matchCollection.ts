import { Uri } from "vscode";
import { MatchSource } from "../../providers/matchTreeProvider";
import { stringify } from "../../utils/uri";

export class MatchCollection extends Array<Uri> {
    public ofFile(file: Uri): Uri[] {
        const stringifiedFile = stringify(file);
        return this.filter((match) => stringify(match) === stringifiedFile);
    }

    public files(): Uri[] {
        return this.reduce((files, match) => {
            const stringifiedFile = stringify(match);
            return files.includes(stringifiedFile) ? files : [...files, stringifiedFile];
        }, [] as string[])
            .map((file) => Uri.parse(file));
    }

    public byFile(): Record<string, Uri[]> {
        return this.reduce((byFile, match) => {
            const stringifiedMatch = stringify(match);
            const fileMatches = byFile[stringifiedMatch] || [];
            return {
                ...byFile,
                [stringifiedMatch]: [...fileMatches, match],
            };
        }, {} as Record<string, Uri[]>);
    }

    public static async fromMatchSource(matchSource: MatchSource): Promise<MatchCollection> {
        const filesWithCoveredMatches = await matchSource.getQueuedFiles();
        const matches = new MatchCollection();

        for (const file of filesWithCoveredMatches) {
            const matchUris = await matchSource.getMatchUrisByFileUri(file);
            matches.push(...matchUris);
        }

        return matches;
    }
}
