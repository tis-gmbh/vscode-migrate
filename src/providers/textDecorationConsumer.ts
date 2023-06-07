import { inject, injectable } from "inversify";
import { Disposable, TextEditor } from "vscode";
import { TYPES, VSC_TYPES, VscWindow } from "../di/types";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
import { TextDecorationProvider } from "./textDecorationProvider";

@injectable()
export class TextDecorationConsumer {
    private readonly providers: TextDecorationProvider[] = [];

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel,
    ) {
        this.window.onDidChangeVisibleTextEditors(() => this.applyAll());
    }

    private applyAll(): void {
        for (const provider of this.providers) {
            this.applyDecorationsFrom(provider);
        }
    }

    public registerTextDecorationProvider(provider: TextDecorationProvider): Disposable {
        this.providers.push(provider);
        this.applyDecorationsFrom(provider);
        return new Disposable(() => {
            const providerIndex = this.providers.indexOf(provider);
            this.providers.splice(providerIndex, 1);
        });
    }

    private applyDecorationsFrom(provider: TextDecorationProvider): void {
        for (const editor of this.window.visibleTextEditors) {
            void this.tryToSetDecorations(provider, editor);
        }
    }

    private async tryToSetDecorations(provider: TextDecorationProvider, editor: TextEditor): Promise<void> {
        try {
            const decorations = await provider.getDecorations(editor) || [];
            editor.setDecorations(provider.decorationType, decorations);
        } catch (error) {
            this.outputChannel.append(`Failed to set decorations for ${editor.document.uri.toString()}: ${error}\n`);
        }
    }
}
