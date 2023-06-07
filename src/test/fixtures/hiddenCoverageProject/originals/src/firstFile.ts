export class TestClass {
    public firstMethod(): string {
        return ">>>First match<<<";
    }

    public secondMethod(): string[] {
        return [">!>No match<!<", ">>>Second match<<<", ">>>Third match<<<"];
    }
}
