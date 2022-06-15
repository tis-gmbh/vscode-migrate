class TestClass {
    private simple(): void {
        const match = "<<<First match>>>";
    }

    private deeplyNested(): void {
        const noMatch = ">!>manual modification<!<";
        const match2 = "<<<Second match>>>";
        const match3 = ">>>Third match<<<";
    }
}
