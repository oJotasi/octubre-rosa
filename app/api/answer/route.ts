import { handleApi } from "../../../lib/api";
export const POST = (request: Request) => handleApi(request, "answer");
export const OPTIONS = POST;
