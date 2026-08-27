export default function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GALILEO_API_KEY;

  return res.json({
    status: apiKey ? "connected" : "disconnected",
  });
}