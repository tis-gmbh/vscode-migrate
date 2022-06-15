import { inject, injectable } from "inversify";
import { ExtensionContext, FileSystemProvider, TreeDataProvider } from "vscode";
import { CommandManager } from "./command/commandManager";
import { TYPES, VscWindow, VscWorkspace, VSC_TYPES } from "./di/types";
import { MatchManager } from "./migration/matchManger";
import { CoverageDecorationProvider } from "./providers/coverageDecorationProvider";
import { TextDecorationConsumer } from "./providers/textDecorationConsumer";

@injectable()
export class VSCodeMigrate {
    public constructor(
        @inject(TYPES.CommandManager) private readonly cmdManager: CommandManager,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MatchManager) public readonly matchManager: MatchManager,
        @inject(TYPES.MatchesTreeProvider) public readonly queuedChangesProvider: TreeDataProvider<string>,
        @inject(TYPES.ChangedContentProvider) public readonly matchReplacementProvider: FileSystemProvider,
        @inject(TYPES.TextDecorationConsumer) private readonly textDecorationConsumer: TextDecorationConsumer,
        @inject(TYPES.CoverageDecorationProvider) public readonly coverageDecorationProvider: CoverageDecorationProvider
    ) { }

    public async activate(context: ExtensionContext): Promise<void> {
        this.cmdManager.registerCommands(context);

        context.subscriptions.push(
            this.window.registerTreeDataProvider("vscode-migrate.queued-matches", this.queuedChangesProvider),
            this.workspace.registerFileSystemProvider("match", this.matchReplacementProvider),
            this.textDecorationConsumer.registerTextDecorationProvider(this.coverageDecorationProvider)
        );
    }
}
