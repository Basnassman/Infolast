export const retry =
  async <T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 1000
  ): Promise<T> => {
    let lastError: unknown;

    for (
      let i = 0;
      i < retries;
      i++
    ) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delayMs
            )
        );
      }
    }

    throw lastError;
  };