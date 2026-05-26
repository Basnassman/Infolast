import csrf from "csurf";

export const csrfMiddleware =
  csrf({
    cookie: false,
  });