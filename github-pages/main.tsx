import { createRoot } from "react-dom/client";
import Experience from "../app/experience";
import { API_ORIGIN } from "./config";

window.OCTUBRE_ROSA_API_ORIGIN = API_ORIGIN;
createRoot(document.getElementById("root")!).render(<Experience />);
