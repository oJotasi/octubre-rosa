import { handleApi } from "../../../lib/api";
export const POST = (request: Request) => handleApi(request, "finish");
export const OPTIONS = POST;
