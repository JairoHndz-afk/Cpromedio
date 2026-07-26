import { HttpInterceptorFn } from "@angular/common/http";

import { API_BASE_URL } from "./api-base";

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE_URL)) {
    return next(request);
  }

  return next(
    request.clone({
      withCredentials: true,
      setHeaders: {
        "X-Requested-With": "XMLHttpRequest"
      }
    })
  );
};
