import { handleApi } from "../../../lib/api";
export const POST = (request: Request) => handleApi(request, "start");
export const OPTIONS = POST;
