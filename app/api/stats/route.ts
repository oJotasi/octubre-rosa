import { handleApi } from "../../../lib/api";
export const GET = (request: Request) => handleApi(request, "stats");
export const OPTIONS = GET;
