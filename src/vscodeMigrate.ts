import { inject, injectable } from "inversify";
import { ExtensionContext, FileSystemProvider, TreeDataProvider } from "vscode";
import { CommandManager } from "./command/commandManager";
import { TYPES, VSC_TYPES, VscWindow, VscWorkspace } from "./di/types";
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
        @inject(TYPES.AllMatchesTreeProvider) public readonly allMatchesProvider: TreeDataProvider<string>,
        @inject(TYPES.WellCoveredMatchesTreeProvider) public readonly wellCoveredMatchesProvider: TreeDataProvider<string>,
        @inject(TYPES.MatchFileSystemProvider) public readonly matchReplacementProvider: FileSystemProvider,
        @inject(TYPES.TextDecorationConsumer) private readonly textDecorationConsumer: TextDecorationConsumer,
        @inject(TYPES.CoverageDecorationProvider) public readonly coverageDecorationProvider: CoverageDecorationProvider
    ) { }

    public activate(context: ExtensionContext): void {
        this.cmdManager.registerCommands(context);

        context.subscriptions.push(
            this.window.registerTreeDataProvider("vscode-migrate.all-matches", this.allMatchesProvider),
            this.window.registerTreeDataProvider("vscode-migrate.well-covered-matches", this.wellCoveredMatchesProvider),
            this.workspace.registerFileSystemProvider("match", this.matchReplacementProvider),
            this.textDecorationConsumer.registerTextDecorationProvider(this.coverageDecorationProvider)
        );
    }
}
