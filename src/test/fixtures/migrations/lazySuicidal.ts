import { IMigration, MatchedFile } from "./migrationTypes";

@Migration({
    name: "Lazy Suicidal",
    factory: () => {
        setTimeout(() => process.exit(1), 0);
        return new Promise(() => { });
    }
})
export class SuicidalMigration implements IMigration {
    getMatchedFiles(): MatchedFile[] | Promise<MatchedFile[]> {
        return [];
    }
}
