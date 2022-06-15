import { DecorationOptions, Event, ProviderResult, Range, TextEditor, TextEditorDecorationType } from "vscode";

export interface TextDecorationProvider {
    onDecorationsChanged?: Event<TextEditor[] | undefined>;
    decorationType: TextEditorDecorationType;
    getDecorations(editor: TextEditor): ProviderResult<Range[] | DecorationOptions[]>;
}
