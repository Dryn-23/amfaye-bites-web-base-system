import "dotenv/config";
import { app } from "./express.js";
import { connectDatabase } from "./config/database.js";
if ( !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith("replace_") ) { console.error("Set JWT_SECRET"); process.exit(1); }
try { await connectDatabase(); const PORT = process.env.PORT || 5000; app.listen(PORT, "0.0.0.0", () => console.log("API on", PORT)); } catch (e) { console.error("DB error", e); process.exit(1); }
