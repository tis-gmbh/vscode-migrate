import { BracketMigration } from "./bracketMigration";

@Migration({
    name: "Brackets - Never Resolve Verify"
})
class NeverResolveVerify extends BracketMigration {
    public verify(): void | Promise<void> {
        return new Promise<void>(_ => { });
    }
}
