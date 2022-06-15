export interface IMigration {
    getMatchedFiles(): MatchedFile[] | Promise<MatchedFile[]>;
    verify?(): void | Promise<void>;
}

export interface MatchedFile {
    path: string;
    matches: Match[];
}

export interface Match {
    label: string;
    modifiedContent: string;
}

export type MigrationConstructor = new () => IMigration;
export type MigrationFactory = () => IMigration | Promise<IMigration>;

declare global {
    var Migration: (options: { name: string, factory?: MigrationFactory }) => (target: MigrationConstructor) => void;
    var registerMigration: (name: string, migration: MigrationConstructor | MigrationFactory) => void;
}
