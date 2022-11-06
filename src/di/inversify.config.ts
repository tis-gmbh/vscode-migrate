import { ContainerModule } from "inversify";
import "reflect-metadata";
import { commands, debug, extensions, tasks, window, workspace } from "vscode";
import { ApplyChangeCommand } from "../command/applyChangeCommand";
import { CommandManager } from "../command/commandManager";
import { DebugMigrationScriptProcessCommand } from "../command/debugMigrationScriptProcesCommand";
import { StartMigrationCommand } from "../command/startMigrationCommand";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MigrationLoaderRemote } from "../migration/migrationLoaderRemote";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "../migration/migrationStdOutChannel";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { ChangedContentProvider } from "../providers/changedContentProvider";
import { CoverageDecorationProvider } from "../providers/coverageDecorationProvider";
import { QueuedMatchesProvider } from "../providers/queuedMatchesProvider";
import { TextDecorationConsumer } from "../providers/textDecorationConsumer";
import { GitExtension } from "../vcs/gitExtension";
import { VersionControl } from "../vcs/versionControl";
import { VSCodeMigrate } from "../vscodeMigrate";
import { TYPES, VSC_TYPES } from "./types";

export const modules = new ContainerModule(bind => {
    bind(TYPES.VscMigrate).to(VSCodeMigrate).inSingletonScope();
    bind(TYPES.MatchManager).to(MatchManager).inSingletonScope();
    bind(TYPES.MatchesTreeProvider).to(QueuedMatchesProvider).inSingletonScope();
    bind(TYPES.ChangedContentProvider).to(ChangedContentProvider).inSingletonScope();
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
});

export const vscCommands = new ContainerModule(bind => {
    bind(TYPES.Command).to(ApplyChangeCommand);
    bind(TYPES.Command).to(StartMigrationCommand);
    bind(TYPES.Command).to(DebugMigrationScriptProcessCommand);
});

export const vscModules = new ContainerModule(bind => {
    bind(VSC_TYPES.VscCommands).toConstantValue(commands);
    bind(VSC_TYPES.VscWorkspace).toConstantValue(workspace);
    bind(VSC_TYPES.VscWindow).toConstantValue(window);
    bind(VSC_TYPES.VscExtensions).toConstantValue(extensions);
    bind(VSC_TYPES.VscTasks).toConstantValue(tasks);
    bind(VSC_TYPES.VscDebug).toConstantValue(debug);
});
