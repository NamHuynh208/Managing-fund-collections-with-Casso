import http from "node:http";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    try {
      await pool.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", db: "connected" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", db: "down" }));
    }
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Backend dang chay tren cong", process.env.PORT || 3000);
});