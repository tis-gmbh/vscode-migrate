class TestClass {
    private simple(): void {
        const match = ">>>Discarded match<<<";
    }

    private deeplyNested(): void {
        const noMatch = ">!>No match<!<";
        const match2 = "<<<Applied match>>>";
        const match3 = ">>>Remaining match<<<";
    }
}
