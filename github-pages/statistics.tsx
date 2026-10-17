import { createRoot } from "react-dom/client";
import Statistics from "../app/estadisticas/statistics";
import { API_ORIGIN } from "./config";

createRoot(document.getElementById("root")!).render(<Statistics apiOrigin={API_ORIGIN} gameUrl="./" qrUrl="./acceso-qr.svg" />);
