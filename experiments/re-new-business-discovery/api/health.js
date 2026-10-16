export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ status: "ok", fictional: true, service: "re-new-business-discovery-trial" }));
}
