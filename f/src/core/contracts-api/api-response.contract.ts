export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiCreated<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiMessage = {
  success: true;
  message: string;
};

export type ApiResponse<T> =
  | ApiSuccess<T>
  | ApiCreated<T>;