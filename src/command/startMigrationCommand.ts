import { inject, injectable } from "inversify";
import { ProgressLocation } from "vscode";
import { TYPES, VscCommands, VscWindow, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolder } from "../migration/migrationHolder";
import { MigrationLoader } from "../migration/migrationLoader";
import { tick } from "../utils/tick";
import { Command } from "./command";

@injectable()
export class StartMigrationCommand implements Command {
    public readonly id = "vscode-migrate.start-migration";
    public static isRunning = false;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(VSC_TYPES.VscCommands) private readonly commands: VscCommands,
        @inject(TYPES.MigrationHolder) private readonly migrationHolder: MigrationHolder,
        @inject(TYPES.MigrationLoader) private readonly migrationLoader: MigrationLoader,
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager
    ) { }

    public async execute(): Promise<void> {
        if (StartMigrationCommand.isRunning) return;
        StartMigrationCommand.isRunning = true;

        await this.startMigration();

        StartMigrationCommand.isRunning = false;
    }

    private async startMigration(): Promise<void> {
        const selectedMigration = await this.selectMigration();

        if (!selectedMigration) return;

        await this.showQueuedChanges();

        await this.window.withProgress({
            location: ProgressLocation.Notification,
            title: "Starting migration"
        }, async (progress) => {
            progress.report({ message: "Creating migration" });
            await tick();
            await this.migrationHolder.start(selectedMigration);

            progress.report({ message: "Fetching matches" });
            await this.matchManager.ready;
        });
    }

    private async selectMigration(): Promise<string | undefined> {
        await this.migrationLoader.refresh();
        const availableMigrations = this.migrationLoader.getNames();
        return this.window.showQuickPick(
            availableMigrations.map(migration => migration)
        );
    }

    private async showQueuedChanges(): Promise<void> {
        await this.commands.executeCommand("vscode-migrate.queued-matches.focus");
    }
}
