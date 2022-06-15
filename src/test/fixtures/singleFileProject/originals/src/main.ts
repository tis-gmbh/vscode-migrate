export class TestClass {
    public simple(): void {
        const match = ">>>First match<<<";
    }

    private deeplyNested(): void {
        const noMatch = ">!>No match<!<";
        const match2 = ">>>Second match<<<";
        const match3 = ">>>Third match<<<";
    }
}
