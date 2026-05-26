export const secretsService =
  {
    get(
      key: string
    ): string {
      const value =
        process.env[key];

      if (!value) {
        throw new Error(
          `Missing secret: ${key}`
        );
      }

      return value;
    },
  };