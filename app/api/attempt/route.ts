import { handleApi } from "../../../lib/api";
export const POST = (request: Request) => handleApi(request, "attempt");
export const OPTIONS = POST;
