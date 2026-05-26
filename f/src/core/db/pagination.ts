export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  items: T[];

  meta: {
    page: number;

    limit: number;

    total: number;

    totalPages: number;
  };
}

export const buildPagination =
  (
    query: PaginationQuery
  ) => {
    const page =
      Math.max(
        Number(query.page) ||
          1,
        1
      );

    const limit =
      Math.min(
        Number(query.limit) ||
          20,
        100
      );

    return {
      page,

      limit,

      skip:
        (page - 1) *
        limit,
    };
  };

export const paginate =
  <T>(
    items: T[],
    total: number,
    page: number,
    limit: number
  ): PaginationResult<T> => {
    return {
      items,

      meta: {
        page,

        limit,

        total,

        totalPages:
          Math.ceil(
            total / limit
          ),
      },
    };
  };