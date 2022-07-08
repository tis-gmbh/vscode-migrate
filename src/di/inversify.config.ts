import { ContainerModule } from "inversify";
import "reflect-metadata";
import { commands, extensions, tasks, window, workspace } from "vscode";
import { ApplyChangeCommand } from "../command/applyChangeCommand";
import { CommandManager } from "../command/commandManager";
import { StartMigrationCommand } from "../command/startMigrationCommand";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolder } from "../migration/migrationHolder";
import { MigrationLoader } from "../migration/migrationLoader";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
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
    bind(TYPES.MigrationHolder).to(MigrationHolder).inSingletonScope();
    bind(TYPES.MigrationLoader).to(MigrationLoader).inSingletonScope();
    bind(TYPES.CommandManager).to(CommandManager).inSingletonScope();
    bind(TYPES.VersionControl).to(VersionControl).inSingletonScope();
    bind(TYPES.GitExtension).to(GitExtension).inSingletonScope();
    bind(TYPES.CoverageDecorationProvider).to(CoverageDecorationProvider).inSingletonScope();
    bind(TYPES.TextDecorationConsumer).to(TextDecorationConsumer).inSingletonScope();
    bind(TYPES.MigrationOutputChannel).to(MigrationOutputChannel).inSingletonScope();
});

export const vscCommands = new ContainerModule(bind => {
    bind(TYPES.Command).to(ApplyChangeCommand);
    bind(TYPES.Command).to(StartMigrationCommand);
});

export const vscModules = new ContainerModule(bind => {
    bind(VSC_TYPES.VscCommands).toConstantValue(commands);
    bind(VSC_TYPES.VscWorkspace).toConstantValue(workspace);
    bind(VSC_TYPES.VscWindow).toConstantValue(window);
    bind(VSC_TYPES.VscExtensions).toConstantValue(extensions);
    bind(VSC_TYPES.VscTasks).toConstantValue(tasks);
});
