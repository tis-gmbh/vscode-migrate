import { IMigration, MatchedFile } from "./migrationTypes";

@Migration({
    name: "Suicidal",
})
export class SuicidalMigration implements IMigration {
    public constructor() {
        throw new Error("I am a suicidal migration script");
    }

    getMatchedFiles(): MatchedFile[] | Promise<MatchedFile[]> {
        return [];
    }
}
