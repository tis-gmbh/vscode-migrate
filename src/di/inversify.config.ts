import { ContainerModule } from "inversify";
import "reflect-metadata";
import { commands, debug, extensions, window, workspace } from "vscode";
import { ApplyChangeCommand } from "../command/applyChangeCommand";
import { ApplyWellCoveredChangesCommand } from "../command/applyWellCoveredChangesCommand";
import { CommandManager } from "../command/commandManager";
import { DebugMigrationScriptProcessCommand } from "../command/debugMigrationScriptProcessCommand";
import { KillMigrationScriptProcessCommand } from "../command/killMigrationScriptProcessCommand";
import { StartMigrationCommand } from "../command/startMigrationCommand";
import { StopMigrationCommand } from "../command/stopMigrationCommand";
import { MergeService } from "../mergeService";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MigrationLoaderRemote } from "../migration/migrationLoaderRemote";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "../migration/migrationStdOutChannel";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { AllMatchesProvider } from "../providers/allMatchesProvider";
import { CoverageDecorationProvider } from "../providers/coverageDecorationProvider";
import { CoverageProvider } from "../providers/coverageProvider";
import { MatchCoverageFilter } from "../providers/matchCoverageFilter";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { TextDecorationConsumer } from "../providers/textDecorationConsumer";
import { WellCoveredMatchesTreeProvider } from "../providers/wellCoveredMatchesTreeProvider";
import { Lock } from "../utils/lock";
import { GitExtension } from "../vcs/gitExtension";
import { VersionControl } from "../vcs/versionControl";
import { VSCodeMigrate } from "../vscodeMigrate";
import { TYPES, VSC_TYPES } from "./types";

export const modules = new ContainerModule(bind => {
    bind(TYPES.VscMigrate).to(VSCodeMigrate).inSingletonScope();
    bind(TYPES.MatchManager).to(MatchManager).inSingletonScope();
    bind(TYPES.AllMatchesTreeProvider).to(AllMatchesProvider).inSingletonScope();
    bind(TYPES.WellCoveredMatchesTreeProvider).to(WellCoveredMatchesTreeProvider).inSingletonScope();
    bind(TYPES.MatchFileSystemProvider).to(MatchFileSystemProvider).inSingletonScope();
    bind(TYPES.MigrationHolderRemote).to(MigrationHolderRemote).inSingletonScope();
    bind(TYPES.MigrationLoaderRemote).to(MigrationLoaderRemote).inSingletonScope();
    bind(TYPES.CommandManager).to(CommandManager).inSingletonScope();
    bind(TYPES.VersionControl).to(VersionControl).inSingletonScope();
    bind(TYPES.GitExtension).to(GitExtension).inSingletonScope();
    bind(TYPES.CoverageDecorationProvider).to(CoverageDecorationProvider).inSingletonScope();
    bind(TYPES.TextDecorationConsumer).to(TextDecorationConsumer).inSingletonScope();
    bind(TYPES.MigrationOutputChannel).to(MigrationOutputChannel).inSingletonScope();
    bind(TYPES.MigrationScriptProcessController).to(MigrationScriptProcessController).inSingletonScope();
    bind(TYPES.MigrationStdOutChannel).to(MigrationStdOutChannel).inSingletonScope();
    bind(TYPES.CoverageProvider).to(CoverageProvider).inSingletonScope();
    bind(TYPES.MergeService).to(MergeService).inSingletonScope();
    bind(TYPES.MatchCoverageFilter).to(MatchCoverageFilter).inSingletonScope();

    bind(TYPES.ApplyExecutionLock).toConstantValue(new Lock());
});

export const vscCommands = new ContainerModule(bind => {
    bind(TYPES.Command).to(ApplyChangeCommand);
    bind(TYPES.Command).to(ApplyWellCoveredChangesCommand);
    bind(TYPES.Command).to(StartMigrationCommand);
    bind(TYPES.Command).to(StopMigrationCommand);
    bind(TYPES.Command).to(DebugMigrationScriptProcessCommand);
    bind(TYPES.Command).to(KillMigrationScriptProcessCommand);
});

export const vscModules = new ContainerModule(bind => {
    bind(VSC_TYPES.VscCommands).toConstantValue(commands);
    bind(VSC_TYPES.VscWorkspace).toConstantValue(workspace);
    bind(VSC_TYPES.VscWindow).toConstantValue(window);
    bind(VSC_TYPES.VscExtensions).toConstantValue(extensions);
    bind(VSC_TYPES.VscDebug).toConstantValue(debug);
});
