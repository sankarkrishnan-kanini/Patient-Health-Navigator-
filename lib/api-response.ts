import { NextResponse } from "next/server";

type SuccessBody<T> = {
  success: true;
  data: T;
};

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiSuccess<T>(data: T, status = 200): NextResponse<SuccessBody<T>> {
  return NextResponse.json(
    {
      success: true,
      data
    },
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ErrorBody> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details })
      }
    },
    { status }
  );
}

export function apiNotImplemented(routeName: string): NextResponse<ErrorBody> {
  return apiError(
    "NOT_IMPLEMENTED",
    `${routeName} is scaffolded but not implemented yet.`,
    501
  );
}