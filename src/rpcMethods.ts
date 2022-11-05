import { CommitInfo, MatchedFile } from "./migrationTypes";

export type RPCMethodNames = keyof RPCInterface;

export interface RPCInterface {
    startMigration: (migrationName: string) => Promise<void>;
    stopMigration: () => void;
    getMigrationName: () => string | undefined;
    getMatchedFiles: () => Promise<MatchedFile[]>;
    getCommitMessage: (commitInfo: CommitInfo) => Promise<string | undefined>;
    getMigrationNames: () => string[];
    refreshMigrations: (dir: string) => Promise<Record<string, any>>;
    verify: () => Promise<void>;
};
