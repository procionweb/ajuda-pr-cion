export type ClientReadResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
  status?: number;
};
function temporary(result: ClientReadResult<unknown>) {
  return (
    (result.status ?? 0) >= 500 ||
    ["57014", "53300", "08000", "08006", "PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(
      result.error?.code ?? "",
    ) ||
    /fetch|network|timeout|timed out|connection/i.test(result.error?.message ?? "")
  );
}
// Retry reads only. Permission errors and validation errors remain final.
export async function readClientResource<T>(
  read: () => PromiseLike<ClientReadResult<T>>,
  pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<ClientReadResult<T>> {
  for (let attempt = 0; ; attempt++) {
    let result: ClientReadResult<T>;
    try {
      result = await read();
    } catch (error) {
      result = {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
        status: 0,
      };
    }
    if (!result.error || attempt >= 2 || !temporary(result)) return result;
    await pause(attempt === 0 ? 300 : 900);
  }
}
