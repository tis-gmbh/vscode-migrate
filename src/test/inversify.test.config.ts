import { ContainerModule } from "inversify";
import { VSC_TYPES } from "../di/types";
import { Logger } from "./logger";
import { CommandsStub } from "./stubs/commands";
import { DebugStub } from "./stubs/debug";
import { ExtensionsStub } from "./stubs/extensions";
import { GitExtensionStub } from "./stubs/gitExtension";
import { WindowStub } from "./stubs/window";
import { WorkspaceStub } from "./stubs/workspace";
import { TEST_TYPES } from "./types";

export const vscStubs = new ContainerModule(bind => {
    bind(VSC_TYPES.VscCommands).to(CommandsStub).inSingletonScope();
    bind(VSC_TYPES.VscWorkspace).to(WorkspaceStub).inSingletonScope();
    bind(VSC_TYPES.VscWindow).to(WindowStub).inSingletonScope();
    bind(VSC_TYPES.VscExtensions).to(ExtensionsStub).inSingletonScope();
    bind(VSC_TYPES.VscDebug).to(DebugStub).inSingletonScope();
});

export const testModule = new ContainerModule(bind => {
    bind(TEST_TYPES.GitExtension).to(GitExtensionStub).inSingletonScope();
    bind(TEST_TYPES.Logger).to(Logger).inSingletonScope();
});
