import { Merge, StringEngine } from "@asmartbear/diff-merge/dist";
import { injectable } from "inversify";

@injectable()
export class MergeService {
    private readonly eng = new StringEngine();

    public nWayMerge(baseVersion: string, firstVersion: string, ...otherVersions: string[]): string {
        return otherVersions
            .reduce(
                (mergeResult, nextVersion) => this.threeWayMerge(baseVersion, mergeResult, nextVersion),
                firstVersion
            );
    }

    public threeWayMerge(base: string, a: string, b: string): string {
        const originalToA = this.eng.getEditsByCharacter(base, a);
        const originalToB = this.eng.getEditsByCharacter(base, b);

        const merge = new Merge<string>();
        const result = merge.merge3(originalToB, originalToA);
        return result.join("");
    }

    public getDiffSections(a: string, b: string): Array<{ startLine: number, endLine: number }> {
        const changedLines = this.eng.getEditsByLine(a, b);

        let lineNo = 1;

        const changedSections: Array<{ startLine: number, endLine: number }> = [];
        changedLines.visitEditsForward(edit => {
            const startLine = lineNo;
            const containedLines = edit.next.toString().split(/\r\n|\n|\r/);
            const linesToCheck = containedLines.filter(line => line.length > 0);
            const endLine = lineNo + linesToCheck.length - 1;
            lineNo = lineNo + containedLines.length - 1;

            if (edit.isEquality()) return;
            changedSections.push({ startLine, endLine });
        });

        return changedSections;
    }
}
