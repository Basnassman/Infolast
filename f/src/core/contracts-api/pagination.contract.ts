export type PaginationMeta = {
  page: number;

  limit: number;

  total: number;

  totalPages: number;

  hasNextPage: boolean;

  hasPreviousPage: boolean;
};

export type PaginatedResponse<T> = {
  success: true;

  data: T[];

  pagination: PaginationMeta;
};

export type PaginationQuery = {
  page?: number;

  limit?: number;
};