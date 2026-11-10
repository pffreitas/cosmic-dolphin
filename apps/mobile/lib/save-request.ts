/** An acknowledgement timeout never discards a durable capture. */
export async function saveRequest<T>(operation: (signal: AbortSignal) => Promise<T>, lifetime?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let reject!: (reason: Error) => void;
  const interrupted = new Promise<never>((_, fail) => { reject = fail; });
  const abort = () => { controller.abort(); reject(new Error("Save interrupted")); };
  lifetime?.addEventListener("abort", abort);
  const timer = setTimeout(abort, 8000);
  try {
    if (lifetime?.aborted) throw new Error("Save interrupted");
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally { clearTimeout(timer); lifetime?.removeEventListener("abort", abort); }
}
