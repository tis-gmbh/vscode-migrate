export async function nextTick<C>(callback: () => C): Promise<C> {
    await tick();
    return callback();
}

export function tick(): Promise<void> {
    return new Promise(res => {
        setTimeout(res, 0);
    });
}
