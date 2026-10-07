# Amfaye Bites — Visual Data Flows

Level 0 (System): Browser → HTTPS → Vercel → API → Render → MongoDB Atlas
Level 1 (Subsystem): Customer / Order Service / Admin Services → Atlas
Level 2 (Component): Router → Auth Middleware → Controller → Service → Model → Transaction
Level 3 (Transaction): POST /orders → Validate → Lock → Deduct Inventory → Pay → Update Status → Commit/Rollback
