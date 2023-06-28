import { BracketMigration } from "./bracketMigration";

@Migration({
    name: "Brackets - Fail Verify"
})
class FailVerify extends BracketMigration {
    public verify(): void | Promise<void> {
        return Promise.reject();
    }
}
