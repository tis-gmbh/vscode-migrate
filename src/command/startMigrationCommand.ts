import { inject, injectable } from "inversify";
import { ProgressLocation } from "vscode";
import { TYPES, VSC_TYPES, VscCommands, VscWindow } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MigrationLoaderRemote } from "../migration/migrationLoaderRemote";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { tick } from "../utils/tick";
import { Command } from "./command";

@injectable()
export class StartMigrationCommand implements Command {
    public readonly id: string = "vscode-migrate.start-migration";
    public static isRunning = false;

    public constructor(
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.MigrationLoaderRemote) protected readonly migrationLoader: MigrationLoaderRemote,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(TYPES.MigrationScriptProcessController) protected readonly migrationScriptProcessController: MigrationScriptProcessController
    ) { }

    public async execute(): Promise<void> {
        await this.migrationScriptProcessController.spawn();
        await this.startMigration();
    }

    protected async startMigration(): Promise<void> {
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
        await this.migrationLoader.getMigrations();
        const availableMigrations = await this.migrationLoader.getNames();
        return this.window.showQuickPick(
            availableMigrations.map(migration => migration)
        );
    }

    private async showQueuedChanges(): Promise<void> {
        await this.commands.executeCommand("vscode-migrate.all-matches.focus");
    }
}
